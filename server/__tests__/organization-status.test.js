import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import app from '../index.js';
import { createUser, createOrganization } from './helpers.js';

const request = supertest(app);

// Valid status transitions map (mirrors server/routes/organizations.js)
const VALID_TRANSITIONS = {
  'draft': ['waiting_ministro', 'rejected'],
  'waiting_ministro': ['ministro_scheduled', 'rejected', 'draft'],
  'ministro_scheduled': ['ministro_approved', 'waiting_ministro', 'rejected'],
  'ministro_approved': ['pending_review', 'in_review', 'sent_registry', 'rejected'],
  'pending_review': ['in_review', 'rejected', 'approved'],
  'in_review': ['approved', 'rejected', 'sent_registry'],
  'rejected': ['pending_review', 'draft', 'waiting_ministro'],
  'sent_registry': ['approved', 'registry_observations', 'rejected'],
  'registry_observations': ['sent_registry', 'approved', 'rejected'],
  'approved': ['dissolved'],
  'dissolved': [],
  'deletion_requested': []
};

describe('Organization Status Transitions', () => {
  let adminToken;
  let adminUser;

  beforeEach(async () => {
    const admin = await createUser({ role: 'MUNICIPALIDAD', email: `admin-${Date.now()}@test.com`, rut: `${10000000 + Math.floor(Math.random() * 9999999)}-0` });
    adminToken = admin.token;
    adminUser = admin.user;
  });

  describe('Valid transitions', () => {
    it('should allow draft -> waiting_ministro', async () => {
      const org = await createOrganization(adminUser._id, { status: 'draft' });
      const res = await request.post(`/api/organizations/${org._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'waiting_ministro' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('waiting_ministro');
    });

    it('should allow pending_review -> approved', async () => {
      const org = await createOrganization(adminUser._id, { status: 'pending_review' });
      const res = await request.post(`/api/organizations/${org._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
    });

    it('should allow approved -> dissolved', async () => {
      const org = await createOrganization(adminUser._id, { status: 'approved' });
      const res = await request.post(`/api/organizations/${org._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'dissolved' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('dissolved');
    });

    it('should allow rejected -> pending_review (resubmit)', async () => {
      const org = await createOrganization(adminUser._id, { status: 'rejected' });
      const res = await request.post(`/api/organizations/${org._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'pending_review' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending_review');
    });
  });

  describe('Invalid transitions', () => {
    it('should reject draft -> approved (skip intermediate steps)', async () => {
      const org = await createOrganization(adminUser._id, { status: 'draft' });
      const res = await request.post(`/api/organizations/${org._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('no permitida');
    });

    it('should reject dissolved -> draft (terminal state)', async () => {
      const org = await createOrganization(adminUser._id, { status: 'dissolved' });
      const res = await request.post(`/api/organizations/${org._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'draft' });
      expect(res.status).toBe(400);
    });

    it('should reject approved -> draft', async () => {
      const org = await createOrganization(adminUser._id, { status: 'approved' });
      const res = await request.post(`/api/organizations/${org._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'draft' });
      expect(res.status).toBe(400);
    });
  });

  describe('Status history tracking', () => {
    it('should add entry to statusHistory on transition', async () => {
      const org = await createOrganization(adminUser._id, { status: 'draft' });
      await request.post(`/api/organizations/${org._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'waiting_ministro', comment: 'Ready for ministro' });

      const res = await request.get(`/api/organizations/${org._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const history = res.body.statusHistory;
      expect(history.length).toBeGreaterThan(0);
      const last = history[history.length - 1];
      expect(last.status).toBe('waiting_ministro');
    });
  });

  describe('Role-based access', () => {
    it('should reject status change from ORGANIZADOR', async () => {
      const orgUser = await createUser({ role: 'ORGANIZADOR', email: `org-${Date.now()}@test.com`, rut: `${20000000 + Math.floor(Math.random() * 9999999)}-0` });
      const org = await createOrganization(orgUser.user._id, { status: 'draft' });
      const res = await request.post(`/api/organizations/${org._id}/status`)
        .set('Authorization', `Bearer ${orgUser.token}`)
        .send({ status: 'waiting_ministro' });
      expect(res.status).toBe(403);
    });
  });

  describe('Exhaustive transition validation', () => {
    for (const [fromStatus, allowedTargets] of Object.entries(VALID_TRANSITIONS)) {
      const allStatuses = Object.keys(VALID_TRANSITIONS);
      const invalidTargets = allStatuses.filter(s => !allowedTargets.includes(s) && s !== fromStatus);

      for (const invalidTarget of invalidTargets.slice(0, 2)) { // Test 2 invalid per status to avoid test explosion
        it(`should reject ${fromStatus} -> ${invalidTarget}`, async () => {
          const org = await createOrganization(adminUser._id, { status: fromStatus });
          const res = await request.post(`/api/organizations/${org._id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: invalidTarget });
          expect(res.status).toBe(400);
        });
      }
    }
  });
});
