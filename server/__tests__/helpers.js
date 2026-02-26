/**
 * Test helpers: factory functions for creating test data.
 */

import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { generateToken } from '../middleware/auth.js';

/**
 * Creates a user and returns user + auth token.
 */
export async function createUser(overrides = {}) {
  const defaults = {
    rut: '12345678-9',
    firstName: 'Test',
    lastName: 'User',
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass1',
    role: 'ORGANIZADOR'
  };
  const user = await User.create({ ...defaults, ...overrides });
  const token = generateToken(user);
  return { user, token };
}

/**
 * Creates a minimal organization for testing.
 */
export async function createOrganization(userId, overrides = {}) {
  const members = overrides.members || generateMembers(15);
  const defaults = {
    userId,
    organizationName: 'Org Test',
    organizationType: 'CLUB_DEPORTIVO',
    address: 'Test Address 123',
    comuna: 'Renca',
    region: 'Metropolitana',
    members,
    status: 'draft'
  };
  return Organization.create({ ...defaults, ...overrides });
}

/**
 * Generates N member objects with unique RUTs.
 */
export function generateMembers(count, startIndex = 0) {
  return Array.from({ length: count }, (_, i) => {
    const idx = startIndex + i;
    const rut = `${10000000 + idx}-${idx % 10}`;
    let role = 'member';
    if (idx === 0) role = 'president';
    else if (idx === 1) role = 'secretary';
    else if (idx === 2) role = 'treasurer';
    return {
      rut,
      firstName: `Name${idx}`,
      lastName: `Last${idx}`,
      role,
      address: 'Address',
      phone: '+56912345678'
    };
  });
}

/**
 * Creates an organization with an assembly in a given status.
 */
export async function createOrgWithAssembly(userId, assemblyOverrides = {}) {
  const org = await createOrganization(userId, { status: 'approved' });
  const assembly = {
    id: 'assembly_test_1',
    type: 'ordinaria',
    date: '2026-03-15',
    time: '10:00',
    title: 'Test Assembly',
    status: 'draft',
    quorumType: 'percentage',
    quorumValue: 50,
    agendaItems: [],
    attendance: 0,
    attendees: [],
    createdAt: new Date(),
    ...assemblyOverrides
  };
  org.assemblies.push(assembly);
  await org.save();
  return { org, assembly };
}
