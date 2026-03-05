import { describe, it, expect } from 'vitest';
import app from '../index.js';
import Organization from '../models/Organization.js';
import { createUser, createOrganization, generateMembers, createRequest } from './helpers.js';

const request = createRequest(app);

describe('Voting System', () => {
  let ownerToken, ownerUser;

  beforeEach(async () => {
    const owner = await createUser({ email: `owner-${Date.now()}@test.com`, rut: `${10000000 + Math.floor(Math.random() * 9999999)}-0` });
    ownerToken = owner.token;
    ownerUser = owner.user;
  });

  /**
   * Creates an org with an assembly that has voting enabled.
   */
  async function setupVotingAssembly(votingMode = 'per_cargo') {
    const members = generateMembers(15);
    const org = await createOrganization(ownerUser._id, {
      status: 'approved',
      members
    });

    // Create assembly with agenda item for election
    org.assemblies = [{
      id: 'assembly_vote_1',
      type: 'ordinaria',
      date: '2026-04-01',
      time: '10:00',
      title: 'Election Assembly',
      status: 'en_curso',
      quorumType: 'percentage',
      quorumValue: 50,
      agendaItems: [{
        id: 'agenda_election_1',
        title: 'Elección Directorio',
        type: 'eleccion_directorio',
        votingMode,
        candidates: votingMode === 'per_cargo' ? [
          { rut: members[5].rut, firstName: members[5].firstName, lastName: members[5].lastName, cargo: 'Presidente' },
          { rut: members[6].rut, firstName: members[6].firstName, lastName: members[6].lastName, cargo: 'Presidente' },
          { rut: members[7].rut, firstName: members[7].firstName, lastName: members[7].lastName, cargo: 'Secretario' },
          { rut: members[8].rut, firstName: members[8].firstName, lastName: members[8].lastName, cargo: 'Secretario' }
        ] : [
          { rut: members[5].rut, firstName: members[5].firstName, lastName: members[5].lastName, lista: 'Lista A' },
          { rut: members[6].rut, firstName: members[6].firstName, lastName: members[6].lastName, lista: 'Lista B' }
        ],
        votes: [],
        votingOpen: true
      }],
      attendance: 0,
      attendees: [],
      startedAt: new Date(),
      createdAt: new Date()
    }];
    await org.save();
    return org;
  }

  /**
   * Creates a member user linked to an org.
   */
  async function createMemberUser(org, memberIndex = 3) {
    const member = org.members[memberIndex];
    const cleanRut = member.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
    const memberUser = await createUser({
      rut: member.rut,
      firstName: member.firstName,
      lastName: member.lastName,
      email: `member-${Date.now()}-${memberIndex}@test.com`,
      password: cleanRut,
      role: 'MIEMBRO'
    });
    // Link member to org
    memberUser.user.organizationIds = [org._id];
    await memberUser.user.save();
    return memberUser;
  }

  describe('Casting votes (per_cargo)', () => {
    it('should allow a member to vote', async () => {
      const org = await setupVotingAssembly('per_cargo');
      const { token } = await createMemberUser(org, 3);

      const res = await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          agendaItemId: 'agenda_election_1',
          votes: [
            { cargo: 'Presidente', candidateRut: org.members[5].rut },
            { cargo: 'Secretario', candidateRut: org.members[7].rut }
          ]
        });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('exitosamente');

      // Verify votes are stored (anonymous votes + voter registry)
      const updated = await Organization.findById(org._id);
      const agenda = updated.assemblies[0].agendaItems[0];
      expect(agenda.anonymousVotes.length).toBe(2);
      expect(agenda.voterRegistry.length).toBe(1);
    });

    it('should prevent duplicate voting', async () => {
      const org = await setupVotingAssembly('per_cargo');
      const { token } = await createMemberUser(org, 3);

      // First vote
      await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          agendaItemId: 'agenda_election_1',
          votes: [{ cargo: 'Presidente', candidateRut: org.members[5].rut }]
        });

      // Second vote - should be rejected
      const res = await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          agendaItemId: 'agenda_election_1',
          votes: [{ cargo: 'Presidente', candidateRut: org.members[6].rut }]
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Ya has votado');
    });

    it('should auto-checkin voter on vote', async () => {
      const org = await setupVotingAssembly('per_cargo');
      const { token } = await createMemberUser(org, 4);

      await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          agendaItemId: 'agenda_election_1',
          votes: [{ cargo: 'Presidente', candidateRut: org.members[5].rut }]
        });

      const updated = await Organization.findById(org._id);
      expect(updated.assemblies[0].attendees.length).toBe(1);
      expect(updated.assemblies[0].attendance).toBe(1);
    });
  });

  describe('Casting votes (per_lista)', () => {
    it('should allow voting for a list', async () => {
      const org = await setupVotingAssembly('per_lista');
      const { token } = await createMemberUser(org, 3);

      const res = await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          agendaItemId: 'agenda_election_1',
          votes: [{ lista: 'Lista A' }]
        });
      expect(res.status).toBe(200);
    });
  });

  describe('Access control', () => {
    it('should reject vote from non-MIEMBRO role', async () => {
      const org = await setupVotingAssembly('per_cargo');
      // Owner is ORGANIZADOR, not MIEMBRO
      const res = await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/vote`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          agendaItemId: 'agenda_election_1',
          votes: [{ cargo: 'Presidente', candidateRut: org.members[5].rut }]
        });
      expect(res.status).toBe(403);
    });

    it('should reject vote from member of different org', async () => {
      const org = await setupVotingAssembly('per_cargo');
      // Create a member not linked to this org
      const outsider = await createUser({
        rut: '50000000-0',
        email: `outsider-${Date.now()}@test.com`,
        role: 'MIEMBRO'
      });
      // No organizationIds set -> not in this org

      const res = await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/vote`)
        .set('Authorization', `Bearer ${outsider.token}`)
        .send({
          agendaItemId: 'agenda_election_1',
          votes: [{ cargo: 'Presidente', candidateRut: org.members[5].rut }]
        });
      expect(res.status).toBe(403);
    });

    it('should reject vote when voting is not open', async () => {
      const org = await setupVotingAssembly('per_cargo');
      // Close voting
      org.assemblies[0].agendaItems[0].votingOpen = false;
      await org.save();

      const { token } = await createMemberUser(org, 3);
      const res = await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          agendaItemId: 'agenda_election_1',
          votes: [{ cargo: 'Presidente', candidateRut: org.members[5].rut }]
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('no está abierta');
    });

    it('should reject vote when assembly is not en_curso', async () => {
      const org = await setupVotingAssembly('per_cargo');
      org.assemblies[0].status = 'convocada';
      await org.save();

      const { token } = await createMemberUser(org, 3);
      const res = await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          agendaItemId: 'agenda_election_1',
          votes: [{ cargo: 'Presidente', candidateRut: org.members[5].rut }]
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('no está en curso');
    });
  });

  describe('Attendance (checkin)', () => {
    it('should register attendance', async () => {
      const org = await setupVotingAssembly('per_cargo');
      const { token } = await createMemberUser(org, 3);

      const res = await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/checkin`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.attendance).toBe(1);
    });

    it('should prevent duplicate checkin', async () => {
      const org = await setupVotingAssembly('per_cargo');
      const { token } = await createMemberUser(org, 3);

      await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/checkin`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      const res = await request.post(`/api/organizations/${org._id}/assemblies/assembly_vote_1/checkin`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Ya registrado');
    });
  });
});
