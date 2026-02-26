import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import app from '../index.js';
import Organization from '../models/Organization.js';
import { createUser, createOrganization, createOrgWithAssembly } from './helpers.js';

const request = supertest(app);

describe('Assembly Lifecycle', () => {
  let ownerToken, ownerUser;

  beforeEach(async () => {
    const owner = await createUser({ email: `owner-${Date.now()}@test.com`, rut: `${10000000 + Math.floor(Math.random() * 9999999)}-0` });
    ownerToken = owner.token;
    ownerUser = owner.user;
  });

  describe('CRUD', () => {
    it('should create an assembly', async () => {
      const org = await createOrganization(ownerUser._id, { status: 'approved' });
      const res = await request.post(`/api/organizations/${org._id}/assemblies`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'ordinaria',
          date: '2026-04-01',
          time: '10:00',
          title: 'Asamblea General',
          description: 'Primera asamblea',
          agendaItems: [{ title: 'Aprobación acta anterior' }]
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('draft');
      expect(res.body.agendaItems).toHaveLength(1);
    });

    it('should update a draft assembly', async () => {
      const { org, assembly } = await createOrgWithAssembly(ownerUser._id);
      const res = await request.put(`/api/organizations/${org._id}/assemblies/${assembly.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Updated Title' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
    });

    it('should delete a draft assembly', async () => {
      const { org, assembly } = await createOrgWithAssembly(ownerUser._id);
      const res = await request.delete(`/api/organizations/${org._id}/assemblies/${assembly.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);

      const updated = await Organization.findById(org._id);
      expect(updated.assemblies).toHaveLength(0);
    });

    it('should not delete a finalizada assembly', async () => {
      const { org, assembly } = await createOrgWithAssembly(ownerUser._id, { status: 'finalizada' });
      const res = await request.delete(`/api/organizations/${org._id}/assemblies/${assembly.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(400);
    });

    it('should not update a finalizada assembly', async () => {
      const { org, assembly } = await createOrgWithAssembly(ownerUser._id, { status: 'finalizada' });
      const res = await request.put(`/api/organizations/${org._id}/assemblies/${assembly.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Try Update' });
      expect(res.status).toBe(400);
    });
  });

  describe('Status transitions', () => {
    it('should transition draft -> convocada via convocar action', async () => {
      const { org, assembly } = await createOrgWithAssembly(ownerUser._id);
      const res = await request.post(`/api/organizations/${org._id}/assemblies/${assembly.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ action: 'convocar' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('convocada');
    });

    it('should transition convocada -> en_curso via iniciar action', async () => {
      const { org, assembly } = await createOrgWithAssembly(ownerUser._id, { status: 'convocada' });
      const res = await request.post(`/api/organizations/${org._id}/assemblies/${assembly.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ action: 'iniciar' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('en_curso');
    });

    it('should transition en_curso -> finalizada via finalizar action', async () => {
      const { org, assembly } = await createOrgWithAssembly(ownerUser._id, { status: 'en_curso' });
      const res = await request.post(`/api/organizations/${org._id}/assemblies/${assembly.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ action: 'finalizar' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('finalizada');
    });
  });

  describe('Permissions', () => {
    it('should reject assembly creation from non-owner', async () => {
      const org = await createOrganization(ownerUser._id, { status: 'approved' });
      const other = await createUser({ email: `other-${Date.now()}@test.com`, rut: `${30000000 + Math.floor(Math.random() * 9999999)}-0` });
      const res = await request.post(`/api/organizations/${org._id}/assemblies`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ type: 'ordinaria', date: '2026-04-01', title: 'Test' });
      expect(res.status).toBe(403);
    });

    it('should allow MUNICIPALIDAD to manage assemblies', async () => {
      const admin = await createUser({ role: 'MUNICIPALIDAD', email: `admin-${Date.now()}@test.com`, rut: `${40000000 + Math.floor(Math.random() * 9999999)}-0` });
      const org = await createOrganization(ownerUser._id, { status: 'approved' });
      const res = await request.post(`/api/organizations/${org._id}/assemblies`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ type: 'ordinaria', date: '2026-04-01', title: 'Admin Assembly' });
      expect(res.status).toBe(201);
    });
  });
});
