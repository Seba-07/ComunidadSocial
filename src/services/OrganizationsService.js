/**
 * Servicio de Gestión de Organizaciones
 * Conecta con el backend API
 */

import { apiService } from './ApiService.js';
import { scheduleService } from './ScheduleService.js';

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

      // Limpiar reservas de organizaciones que ya no existen
      this.cleanOrphanedBookings();
    } catch (e) {
      console.error('Error loading organizations from server:', e);
      // Fallback a cache local
      this.loadFromStorage();
    }
  }

  /**
   * Limpia reservas de organizaciones que ya no existen en el servidor
   */
  cleanOrphanedBookings() {
    try {
      // Obtener todas las organizaciones del servidor (para admin) o usar las cargadas
      const allOrgsJson = localStorage.getItem('user_organizations');
      const allOrgs = allOrgsJson ? JSON.parse(allOrgsJson) : [];

      // Extraer IDs válidos
      const validOrgIds = allOrgs.map(org => org._id || org.id).filter(id => id);

      // Limpiar reservas huérfanas
      if (validOrgIds.length > 0 || allOrgs.length === 0) {
        scheduleService.cleanOrphanedBookings(validOrgIds);
      }
    } catch (e) {
      console.error('Error limpiando reservas huérfanas:', e);
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

      // Limpiar reservas de organizaciones que ya no existen
      this.cleanOrphanedBookings();

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
      const orgInfo = requestData.organizationData?.organization || {};
      const members = requestData.organizationData?.members || [];

      // Mapear miembros al formato del backend
      const mappedMembers = members.map((m, index) => ({
        rut: m.rut,
        firstName: m.firstName || m.nombre?.split(' ')[0] || '',
        lastName: m.lastName || m.nombre?.split(' ').slice(1).join(' ') || m.apellido || '',
        address: m.address || m.direccion || '',
        phone: m.phone || m.telefono || '',
        email: m.email || '',
        birthDate: m.birthDate || m.fechaNacimiento || '',
        occupation: m.occupation || m.profesion || '',
        role: index === 0 ? 'president' : index === 1 ? 'secretary' : index === 2 ? 'treasurer' : index < 5 ? 'director' : 'member'
      }));

      // Mapear directorio provisorio
      const dirProv = requestData.directorioProvisorio || {};
      const provisionalDirectorio = {
        president: dirProv.presidente ? {
          rut: dirProv.presidente.rut,
          firstName: dirProv.presidente.firstName || dirProv.presidente.nombre?.split(' ')[0] || '',
          lastName: dirProv.presidente.lastName || dirProv.presidente.apellido || dirProv.presidente.nombre?.split(' ').slice(1).join(' ') || ''
        } : null,
        secretary: dirProv.secretario ? {
          rut: dirProv.secretario.rut,
          firstName: dirProv.secretario.firstName || dirProv.secretario.nombre?.split(' ')[0] || '',
          lastName: dirProv.secretario.lastName || dirProv.secretario.apellido || dirProv.secretario.nombre?.split(' ').slice(1).join(' ') || ''
        } : null,
        treasurer: dirProv.tesorero ? {
          rut: dirProv.tesorero.rut,
          firstName: dirProv.tesorero.firstName || dirProv.tesorero.nombre?.split(' ')[0] || '',
          lastName: dirProv.tesorero.lastName || dirProv.tesorero.apellido || dirProv.tesorero.nombre?.split(' ').slice(1).join(' ') || ''
        } : null
      };

      // Mapear comisión electoral
      const comisionElectoral = (requestData.comisionElectoral || []).map(m => ({
        rut: m.rut,
        firstName: m.firstName || m.nombre?.split(' ')[0] || '',
        lastName: m.lastName || m.apellido || m.nombre?.split(' ').slice(1).join(' ') || '',
        role: 'electoral_commission'
      }));

      const orgData = {
        organizationName: orgInfo.nombre || orgInfo.organizationName || orgInfo.name || 'Sin nombre',
        organizationType: this.mapOrganizationType(orgInfo.tipo || orgInfo.organizationType || orgInfo.type),
        address: orgInfo.direccion || orgInfo.address || requestData.assemblyAddress || '',
        comuna: orgInfo.comuna || orgInfo.commune || 'Renca',
        region: orgInfo.region || 'Metropolitana',
        unidadVecinal: orgInfo.unidadVecinal || '',
        territory: orgInfo.territory || orgInfo.territorio || '',
        // Datos de contacto del usuario solicitante (del paso 1)
        contactEmail: orgInfo.contactEmail || orgInfo.email || '',
        contactPhone: orgInfo.contactPhone || orgInfo.phone || '',
        members: mappedMembers,
        // Directorio Provisorio (paso 5)
        provisionalDirectorio: provisionalDirectorio,
        // Comisión Electoral (paso 5)
        electoralCommission: comisionElectoral,
        electionDate: requestData.electionDate,
        electionTime: requestData.electionTime || null,
        assemblyAddress: requestData.assemblyAddress || null,
        comments: requestData.comments || null
      };

      console.log('📤 Enviando organización:', orgData);

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
   * Mapea el tipo de organización al enum del backend
   */
  mapOrganizationType(type) {
    if (!type) return 'OTRA_FUNCIONAL';

    // Lista de tipos válidos del backend
    const validTypes = [
      'JUNTA_VECINOS', 'COMITE_VECINOS',
      'CLUB_DEPORTIVO', 'CLUB_ADULTO_MAYOR', 'CLUB_JUVENIL', 'CLUB_CULTURAL',
      'CENTRO_MADRES', 'CENTRO_PADRES', 'CENTRO_CULTURAL',
      'AGRUPACION_FOLCLORICA', 'AGRUPACION_CULTURAL', 'AGRUPACION_JUVENIL', 'AGRUPACION_AMBIENTAL', 'AGRUPACION_EMPRENDEDORES',
      'COMITE_VIVIENDA', 'COMITE_ALLEGADOS', 'COMITE_APR', 'COMITE_ADELANTO', 'COMITE_MEJORAMIENTO', 'COMITE_CONVIVENCIA',
      'ORG_SCOUT', 'ORG_MUJERES', 'ORG_INDIGENA', 'ORG_SALUD', 'ORG_SOCIAL', 'ORG_CULTURAL',
      'GRUPO_TEATRO', 'CORO', 'TALLER_ARTESANIA',
      'OTRA_FUNCIONAL'
    ];

    // Si el tipo ya es válido, devolverlo directamente
    const upperType = type.toUpperCase();
    if (validTypes.includes(upperType)) {
      return upperType;
    }

    // Mapeo de nombres legibles a códigos
    const typeMap = {
      'junta_vecinos': 'JUNTA_VECINOS',
      'junta de vecinos': 'JUNTA_VECINOS',
      'club adulto mayor': 'CLUB_ADULTO_MAYOR',
      'club de adulto mayor': 'CLUB_ADULTO_MAYOR',
      'centro de padres': 'CENTRO_PADRES',
      'centro de padres y apoderados': 'CENTRO_PADRES',
      'comité de vivienda': 'COMITE_VIVIENDA',
      'club deportivo': 'CLUB_DEPORTIVO'
    };

    return typeMap[type.toLowerCase()] || type.toUpperCase() || 'OTRA_FUNCIONAL';
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
