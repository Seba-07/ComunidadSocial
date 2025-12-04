import { IOrganizationRepository } from '../../domain/repositories/IOrganizationRepository.js';

/**
 * MockOrganizationRepository
 * Implementación en memoria del repositorio de organizaciones (sin Firebase)
 */
export class MockOrganizationRepository extends IOrganizationRepository {
  constructor() {
    super();
    this.organizations = new Map();
    this.currentId = 1;
  }

  async create(organization) {
    const id = `org-${this.currentId++}`;
    const orgData = {
      ...organization.toJSON(),
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.organizations.set(id, orgData);
    return orgData;
  }

  async findById(id) {
    return this.organizations.get(id) || null;
  }

  async update(id, updates) {
    const org = this.organizations.get(id);
    if (!org) {
      throw new Error('Organización no encontrada');
    }

    const updatedOrg = {
      ...org,
      ...updates,
      updatedAt: new Date()
    };

    this.organizations.set(id, updatedOrg);
    return updatedOrg;
  }

  async delete(id) {
    return this.organizations.delete(id);
  }

  async findAll(options = {}) {
    const { limit = 10, offset = 0, status, type, commune } = options;
    let allOrgs = Array.from(this.organizations.values());

    // Filtros
    if (status) {
      allOrgs = allOrgs.filter(org => org.status === status);
    }
    if (type) {
      allOrgs = allOrgs.filter(org => org.type === type);
    }
    if (commune) {
      allOrgs = allOrgs.filter(org => org.commune === commune);
    }

    const organizations = allOrgs.slice(offset, offset + limit);

    return {
      organizations,
      total: allOrgs.length
    };
  }

  async findByCreator(userId) {
    const orgs = Array.from(this.organizations.values()).filter(
      org => org.createdBy === userId
    );
    return orgs;
  }

  async findByStatus(status) {
    const orgs = Array.from(this.organizations.values()).filter(
      org => org.status === status
    );
    return orgs;
  }

  async findByCommune(commune) {
    const orgs = Array.from(this.organizations.values()).filter(
      org => org.commune === commune
    );
    return orgs;
  }

  async findByType(type) {
    const orgs = Array.from(this.organizations.values()).filter(
      org => org.type === type
    );
    return orgs;
  }

  async addMember(organizationId, member) {
    const org = await this.findById(organizationId);
    if (!org) {
      throw new Error('Organización no encontrada');
    }

    org.members.push(member);
    org.updatedAt = new Date();
    this.organizations.set(organizationId, org);
    return org;
  }

  async removeMember(organizationId, memberId) {
    const org = await this.findById(organizationId);
    if (!org) {
      throw new Error('Organización no encontrada');
    }

    org.members = org.members.filter(m => m.id !== memberId);
    org.updatedAt = new Date();
    this.organizations.set(organizationId, org);
    return org;
  }

  async changeStatus(organizationId, newStatus, reason = null) {
    const org = await this.findById(organizationId);
    if (!org) {
      throw new Error('Organización no encontrada');
    }

    org.status = newStatus;
    org.updatedAt = new Date();

    if (newStatus === 'APPROVED') {
      org.approvalDate = new Date();
    }

    if (newStatus === 'REJECTED') {
      org.rejectionReason = reason;
    }

    this.organizations.set(organizationId, org);
    return org;
  }

  async existsByNameAndCommune(name, commune) {
    for (const org of this.organizations.values()) {
      if (org.name === name && org.commune === commune) {
        return true;
      }
    }
    return false;
  }
}
