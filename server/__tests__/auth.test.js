import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import app from '../index.js';
import User from '../models/User.js';
import { createUser } from './helpers.js';

const request = supertest(app);

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request.post('/api/auth/register').send({
        rut: '11111111-1',
        firstName: 'Juan',
        lastName: 'Perez',
        email: 'juan@test.com',
        password: 'TestPass1'
      });
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('juan@test.com');
      expect(res.body.user.role).toBe('ORGANIZADOR');
      expect(res.body.token).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      await createUser({ email: 'dup@test.com', rut: '22222222-2' });
      const res = await request.post('/api/auth/register').send({
        rut: '33333333-3',
        firstName: 'Ana',
        lastName: 'Lopez',
        email: 'dup@test.com',
        password: 'TestPass1'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });

    it('should reject duplicate RUT', async () => {
      // Register first user via API so RUT gets formatted consistently
      await request.post('/api/auth/register').send({
        rut: '44444444-4',
        firstName: 'First',
        lastName: 'User',
        email: 'unique1@test.com',
        password: 'TestPass1'
      });
      const res = await request.post('/api/auth/register').send({
        rut: '44444444-4',
        firstName: 'Carlos',
        lastName: 'Diaz',
        email: 'unique2@test.com',
        password: 'TestPass1'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('RUT');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      await createUser({ email: 'login@test.com', rut: '55555555-5', password: 'TestPass1' });
      const res = await request.post('/api/auth/login').send({
        email: 'login@test.com',
        password: 'TestPass1'
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('login@test.com');
    });

    it('should reject wrong password', async () => {
      await createUser({ email: 'wrong@test.com', rut: '66666666-6' });
      const res = await request.post('/api/auth/login').send({
        email: 'wrong@test.com',
        password: 'WrongPass1'
      });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent email', async () => {
      const res = await request.post('/api/auth/login').send({
        email: 'nobody@test.com',
        password: 'TestPass1'
      });
      expect(res.status).toBe(401);
    });

    it('should reject inactive user', async () => {
      await createUser({ email: 'inactive@test.com', rut: '77777777-7', active: false });
      const res = await request.post('/api/auth/login').send({
        email: 'inactive@test.com',
        password: 'TestPass1'
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const { token } = await createUser({ email: 'me@test.com', rut: '88888888-8' });
      const res = await request.get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('me@test.com');
    });

    it('should reject request without token', async () => {
      const res = await request.get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request.get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/login-socio', () => {
    it('should login member with lastName + RUT', async () => {
      const { user } = await createUser({
        rut: '99999999-9',
        lastName: 'Gonzalez',
        email: 'member@test.com',
        role: 'MIEMBRO'
      });
      // Password for MIEMBRO is the cleaned RUT (set during account creation)
      // We need to manually set the password to the cleaned RUT for this test
      user.password = '999999999';
      await user.save();

      const res = await request.post('/api/auth/login-socio').send({
        lastName: 'Gonzalez',
        rut: '99999999-9'
      });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('MIEMBRO');
    });
  });
});
