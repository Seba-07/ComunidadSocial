/**
 * Tests para User Entity
 */
import { describe, it, expect } from 'vitest';
import { User, UserProfile } from '../domain/entities/User.js';

describe('User Entity', () => {
  describe('constructor', () => {
    it('should create a user with all required fields', () => {
      const user = new User({
        id: '123',
        email: 'test@example.com',
        password: 'password123',
        role: 'ORGANIZADOR',
        profile: { firstName: 'Juan', lastName: 'Pérez' }
      });

      expect(user.id).toBe('123');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('ORGANIZADOR');
      expect(user.profile).toEqual({ firstName: 'Juan', lastName: 'Pérez' });
    });

    it('should set organizationId for MIEMBRO users', () => {
      const user = new User({
        email: 'miembro@example.com',
        password: 'password123',
        role: 'MIEMBRO',
        profile: { firstName: 'Ana', lastName: 'García' },
        organizationId: 'org123'
      });

      expect(user.organizationId).toBe('org123');
    });
  });

  describe('validate', () => {
    it('should return valid for correct user data', () => {
      const user = new User({
        email: 'test@example.com',
        password: 'password123',
        role: 'ORGANIZADOR',
        profile: { firstName: 'Juan', lastName: 'Pérez' }
      });

      const result = user.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid email', () => {
      const user = new User({
        email: 'invalid-email',
        password: 'password123',
        role: 'ORGANIZADOR',
        profile: { firstName: 'Juan', lastName: 'Pérez' }
      });

      const result = user.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email inválido');
    });

    it('should reject short password', () => {
      const user = new User({
        email: 'test@example.com',
        password: '12345',
        role: 'ORGANIZADOR',
        profile: { firstName: 'Juan', lastName: 'Pérez' }
      });

      const result = user.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña debe tener al menos 6 caracteres');
    });

    it('should reject invalid role', () => {
      const user = new User({
        email: 'test@example.com',
        password: 'password123',
        role: 'INVALID_ROLE',
        profile: { firstName: 'Juan', lastName: 'Pérez' }
      });

      const result = user.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Rol inválido');
    });

    it('should require organizationId for MIEMBRO role', () => {
      const user = new User({
        email: 'test@example.com',
        password: 'password123',
        role: 'MIEMBRO',
        profile: { firstName: 'Juan', lastName: 'Pérez' }
      });

      const result = user.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Los miembros deben estar asociados a una organización');
    });
  });

  describe('role checks', () => {
    it('isMunicipalidad returns true for MUNICIPALIDAD role', () => {
      const user = new User({
        email: 'admin@renca.cl',
        password: 'password123',
        role: 'MUNICIPALIDAD',
        profile: {}
      });

      expect(user.isMunicipalidad()).toBe(true);
      expect(user.isAdmin()).toBe(true);
      expect(user.isOrganizador()).toBe(false);
      expect(user.isMiembro()).toBe(false);
      expect(user.isMinistroFe()).toBe(false);
    });

    it('isOrganizador returns true for ORGANIZADOR role', () => {
      const user = new User({
        email: 'user@example.com',
        password: 'password123',
        role: 'ORGANIZADOR',
        profile: {}
      });

      expect(user.isOrganizador()).toBe(true);
      expect(user.isMunicipalidad()).toBe(false);
    });

    it('isMiembro returns true for MIEMBRO role', () => {
      const user = new User({
        email: 'member@example.com',
        password: 'password123',
        role: 'MIEMBRO',
        profile: {},
        organizationId: 'org123'
      });

      expect(user.isMiembro()).toBe(true);
      expect(user.isOrganizador()).toBe(false);
    });

    it('isMinistroFe returns true for MINISTRO_FE role', () => {
      const user = new User({
        email: 'ministro@renca.cl',
        password: 'password123',
        role: 'MINISTRO_FE',
        profile: {}
      });

      expect(user.isMinistroFe()).toBe(true);
      expect(user.isMunicipalidad()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should not include password in JSON output', () => {
      const user = new User({
        id: '123',
        email: 'test@example.com',
        password: 'secret123',
        role: 'ORGANIZADOR',
        profile: { firstName: 'Juan', lastName: 'Pérez' }
      });

      const json = user.toJSON();
      expect(json.password).toBeUndefined();
      expect(json.email).toBe('test@example.com');
      expect(json.id).toBe('123');
    });
  });
});

describe('UserProfile Entity', () => {
  describe('validateRut', () => {
    it('should validate correct RUT format', () => {
      const profile = new UserProfile({
        rut: '12345678-9',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '912345678',
        commune: 'Renca',
        birthDate: '1990-01-15'
      });

      expect(profile.validateRut()).toBe(true);
    });

    it('should reject invalid RUT format', () => {
      const profile = new UserProfile({
        rut: '12345678',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '912345678',
        commune: 'Renca'
      });

      expect(profile.validateRut()).toBe(false);
    });

    it('should accept RUT with K verifier', () => {
      const profile = new UserProfile({
        rut: '12345678-K',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '912345678',
        commune: 'Renca'
      });

      expect(profile.validateRut()).toBe(true);
    });
  });

  describe('getAge', () => {
    it('should calculate correct age', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 25);

      const profile = new UserProfile({
        rut: '12345678-9',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '912345678',
        commune: 'Renca',
        birthDate: birthDate.toISOString().split('T')[0]
      });

      expect(profile.getAge()).toBe(25);
    });

    it('should return null if no birthDate', () => {
      const profile = new UserProfile({
        rut: '12345678-9',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '912345678',
        commune: 'Renca'
      });

      expect(profile.getAge()).toBeNull();
    });
  });

  describe('hasMinimumAge', () => {
    it('should return true for users 14 or older', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 14);

      const profile = new UserProfile({
        rut: '12345678-9',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '912345678',
        commune: 'Renca',
        birthDate: birthDate.toISOString().split('T')[0]
      });

      expect(profile.hasMinimumAge()).toBe(true);
    });

    it('should return false for users under 14', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 13);

      const profile = new UserProfile({
        rut: '12345678-9',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '912345678',
        commune: 'Renca',
        birthDate: birthDate.toISOString().split('T')[0]
      });

      expect(profile.hasMinimumAge()).toBe(false);
    });
  });

  describe('fullName', () => {
    it('should return combined first and last name', () => {
      const profile = new UserProfile({
        rut: '12345678-9',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '912345678',
        commune: 'Renca'
      });

      expect(profile.fullName).toBe('Juan Pérez');
    });
  });

  describe('validate', () => {
    it('should return valid for correct profile data', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 30);

      const profile = new UserProfile({
        rut: '12345678-9',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '912345678',
        commune: 'Renca',
        birthDate: birthDate.toISOString().split('T')[0]
      });

      const result = profile.validate();
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid phone', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 30);

      const profile = new UserProfile({
        rut: '12345678-9',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '123',
        commune: 'Renca',
        birthDate: birthDate.toISOString().split('T')[0]
      });

      const result = profile.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Teléfono inválido');
    });
  });
});
