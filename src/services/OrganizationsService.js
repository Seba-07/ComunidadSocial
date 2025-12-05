/**
 * Servicio de Gestión de Organizaciones
 * Conecta con el backend API
 */

import { apiService } from './ApiService.js';

// Estados posibles de una organización
export const ORG_STATUS = {
  DRAFT: 'draft',
  WAITING_MINISTRO_REQUEST: 'waiting_ministro',
  MINISTRO_SCHEDULED: 'ministro_scheduled',
  MINISTRO_APPROVED: 'ministro_approved',
  PENDING_REVIEW: 'pending_review',
  IN_REVIEW: 'in_review',
  REJECTED: 'rejected',
  SENT_TO_REGISTRY: 'sent_registry',
  APPROVED: 'approved',
  DISSOLVED: 'dissolved'
};

// Etiquetas de estado en español
export const ORG_STATUS_LABELS = {
  [ORG_STATUS.DRAFT]: 'Borrador',
  [ORG_STATUS.WAITING_MINISTRO_REQUEST]: 'Esperando Solicitud Ministro de Fe',
  [ORG_STATUS.MINISTRO_SCHEDULED]: 'Ministro de Fe Agendado',
  [ORG_STATUS.MINISTRO_APPROVED]: 'Aprobado por Ministro de Fe',
  [ORG_STATUS.PENDING_REVIEW]: 'Pendiente de Revisión',
  [ORG_STATUS.IN_REVIEW]: 'En Revisión',
  [ORG_STATUS.REJECTED]: 'Requiere Correcciones',
  [ORG_STATUS.SENT_TO_REGISTRY]: 'Enviada al Registro Civil',
  [ORG_STATUS.APPROVED]: 'Aprobada',
  [ORG_STATUS.DISSOLVED]: 'Disuelta'
};

// Colores de estado
export const ORG_STATUS_COLORS = {
  [ORG_STATUS.DRAFT]: '#6b7280',
  [ORG_STATUS.WAITING_MINISTRO_REQUEST]: '#f59e0b',
  [ORG_STATUS.MINISTRO_SCHEDULED]: '#8b5cf6',
  [ORG_STATUS.MINISTRO_APPROVED]: '#06b6d4',
  [ORG_STATUS.PENDING_REVIEW]: '#f59e0b',
  [ORG_STATUS.IN_REVIEW]: '#3b82f6',
  [ORG_STATUS.REJECTED]: '#ef4444',
  [ORG_STATUS.SENT_TO_REGISTRY]: '#0891b2',
  [ORG_STATUS.APPROVED]: '#10b981',
  [ORG_STATUS.DISSOLVED]: '#4b5563'
};

class OrganizationsService {
  constructor() {
    this.organizations = [];
    this.loaded = false;
  }

  /**
   * Carga las organizaciones desde el backend
   */
  async loadFromServer() {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (currentUser?.role === 'ADMIN') {
        this.organizations = await apiService.getOrganizations();
      } else {
        this.organizations = await apiService.getMyOrganizations();
      }
      this.loaded = true;
      // Cache local para acceso sincrónico
      localStorage.setItem('user_organizations', JSON.stringify(this.organizations));
    } catch (e) {
      console.error('Error loading organizations from server:', e);
      // Fallback a cache local
      this.loadFromStorage();
    }
  }

  /**
   * Carga desde localStorage (fallback/cache)
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem('user_organizations');
      if (saved) {
        this.organizations = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading organizations:', e);
      this.organizations = [];
    }
  }

  /**
   * Sincroniza con el servidor
   */
  async sync() {
    await this.loadFromServer();
  }

  /**
   * Obtiene todas las organizaciones (para admin)
   */
  getAll() {
    return this.organizations;
  }

  /**
   * Obtiene todas las organizaciones desde el servidor (async)
   */
  async getAllAsync() {
    try {
      const orgs = await apiService.getOrganizations();
      this.organizations = orgs;
      localStorage.setItem('user_organizations', JSON.stringify(orgs));
      return orgs;
    } catch (e) {
      console.error('Error fetching organizations:', e);
      return this.organizations;
    }
  }

  /**
   * Obtiene las organizaciones del usuario actual
   */
  async getCurrentUserOrganizations() {
    try {
      const orgs = await apiService.getMyOrganizations();
      this.organizations = orgs;
      localStorage.setItem('user_organizations', JSON.stringify(orgs));
      return orgs;
    } catch (e) {
      console.error('Error getting current user organizations:', e);
      return [];
    }
  }

  /**
   * Obtiene una organización por ID
   */
  getById(id) {
    return this.organizations.find(org => org.id === id || org._id === id);
  }

  /**
   * Obtiene una organización por ID desde el servidor
   */
  async getByIdAsync(id) {
    try {
      return await apiService.getOrganization(id);
    } catch (e) {
      console.error('Error fetching organization:', e);
      return this.getById(id);
    }
  }

  /**
   * Crea una nueva organización
   */
  async create(orgData) {
    try {
      const newOrg = await apiService.createOrganization(orgData);
      this.organizations.push(newOrg);
      localStorage.setItem('user_organizations', JSON.stringify(this.organizations));
      return newOrg;
    } catch (e) {
      console.error('Error creating organization:', e);
      throw e;
    }
  }

  /**
   * Actualiza una organización
   */
  async update(id, updates) {
    try {
      const updated = await apiService.updateOrganization(id, updates);
      const index = this.organizations.findIndex(org => org.id === id || org._id === id);
      if (index !== -1) {
        this.organizations[index] = updated;
        localStorage.setItem('user_organizations', JSON.stringify(this.organizations));
      }
      return updated;
    } catch (e) {
      console.error('Error updating organization:', e);
      throw e;
    }
  }

  /**
   * Actualiza el estado de una organización
   */
  async updateStatus(id, newStatus, comment = '') {
    try {
      const updated = await apiService.updateOrgStatus(id, newStatus, comment);
      const index = this.organizations.findIndex(org => org.id === id || org._id === id);
      if (index !== -1) {
        this.organizations[index] = updated;
        localStorage.setItem('user_organizations', JSON.stringify(this.organizations));
      }
      return updated;
    } catch (e) {
      console.error('Error updating status:', e);
      throw e;
    }
  }

  /**
   * Rechaza una organización con correcciones detalladas
   */
  async rejectWithCorrections(id, corrections, generalComment = '') {
    try {
      const updated = await apiService.rejectOrganization(id, corrections, generalComment);
      const index = this.organizations.findIndex(org => org.id === id || org._id === id);
      if (index !== -1) {
        this.organizations[index] = updated;
        localStorage.setItem('user_organizations', JSON.stringify(this.organizations));
      }
      return updated;
    } catch (e) {
      console.error('Error rejecting organization:', e);
      throw e;
    }
  }

  /**
   * Reenvía una organización corregida para revisión
   */
  async resubmitForReview(id, userComment = '', fieldResponses = {}) {
    try {
      const updated = await apiService.resubmitOrganization(id, userComment, fieldResponses);
      const index = this.organizations.findIndex(org => org.id === id || org._id === id);
      if (index !== -1) {
        this.organizations[index] = updated;
        localStorage.setItem('user_organizations', JSON.stringify(this.organizations));
      }
      return updated;
    } catch (e) {
      console.error('Error resubmitting organization:', e);
      throw e;
    }
  }

  /**
   * Verifica si hay organizaciones
   */
  hasOrganizations() {
    return this.organizations.length > 0;
  }

  /**
   * Obtiene el conteo por estado
   */
  async getCountByStatus() {
    try {
      return await apiService.getOrganizationStats();
    } catch (e) {
      console.error('Error getting stats:', e);
      const counts = {};
      Object.values(ORG_STATUS).forEach(status => {
        counts[status] = this.organizations.filter(org => org.status === status).length;
      });
      return counts;
    }
  }

  /**
   * Solicita un Ministro de Fe (después de completar pasos 1-2)
   */
  async requestMinistro(requestData) {
    try {
      const orgData = {
        ...requestData.organizationData,
        status: 'waiting_ministro',
        electionDate: requestData.electionDate,
        electionTime: requestData.electionTime || null,
        assemblyAddress: requestData.assemblyAddress || null,
        comments: requestData.comments || null
      };

      const newOrg = await apiService.createOrganization(orgData);
      this.organizations.push(newOrg);
      localStorage.setItem('user_organizations', JSON.stringify(this.organizations));
      return newOrg;
    } catch (e) {
      console.error('Error requesting ministro:', e);
      throw e;
    }
  }

  /**
   * Agenda un Ministro de Fe (Admin)
   */
  async scheduleMinistro(id, ministroData) {
    try {
      const updated = await apiService.scheduleMinistro(id, ministroData);
      const index = this.organizations.findIndex(org => org.id === id || org._id === id);
      if (index !== -1) {
        this.organizations[index] = updated;
        localStorage.setItem('user_organizations', JSON.stringify(this.organizations));
      }
      return updated;
    } catch (e) {
      console.error('Error scheduling ministro:', e);
      throw e;
    }
  }

  /**
   * Aprueba con Ministro de Fe y designa Directorio Provisorio
   */
  async approveByMinistro(id, provisionalDirectorio, ministroSignature) {
    try {
      const updated = await apiService.approveByMinistro(id, {
        provisionalDirectorio,
        ministroSignature
      });
      const index = this.organizations.findIndex(org => org.id === id || org._id === id);
      if (index !== -1) {
        this.organizations[index] = updated;
        localStorage.setItem('user_organizations', JSON.stringify(this.organizations));
      }
      return updated;
    } catch (e) {
      console.error('Error approving by ministro:', e);
      throw e;
    }
  }

  /**
   * Obtiene organizaciones que requieren solicitud de Ministro de Fe
   */
  getPendingMinistroRequests() {
    return this.organizations.filter(org => org.status === ORG_STATUS.WAITING_MINISTRO_REQUEST);
  }

  /**
   * Obtiene organizaciones con Ministro agendado
   */
  getScheduledMinistros() {
    return this.organizations.filter(org => org.status === ORG_STATUS.MINISTRO_SCHEDULED);
  }
}

// Instancia singleton
export const organizationsService = new OrganizationsService();
