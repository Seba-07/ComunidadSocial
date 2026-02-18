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
  REGISTRY_OBSERVATIONS: 'registry_observations', // Observaciones del Registro Civil
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
  [ORG_STATUS.REGISTRY_OBSERVATIONS]: 'Observaciones del Registro Civil',
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
  [ORG_STATUS.IN_REVIEW]: '#2563eb',
  [ORG_STATUS.REJECTED]: '#ef4444',
  [ORG_STATUS.SENT_TO_REGISTRY]: '#0891b2',
  [ORG_STATUS.REGISTRY_OBSERVATIONS]: '#dc2626',
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
      if (currentUser?.role === 'MUNICIPALIDAD') {
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

      // Función helper para construir firstName desde campos del wizard
      const buildFirstName = (m) => {
        // Formato WizardController: primerNombre, segundoNombre
        if (m.primerNombre) {
          return [m.primerNombre, m.segundoNombre].filter(Boolean).join(' ');
        }
        // Formato estándar
        if (m.firstName) return m.firstName;
        // Formato alternativo: nombre completo
        if (m.nombre) return m.nombre.split(' ')[0] || '';
        // Formato alternativo: name
        if (m.name) return m.name.split(' ')[0] || '';
        return '';
      };

      // Función helper para construir lastName desde campos del wizard
      const buildLastName = (m) => {
        // Formato WizardController: apellidoPaterno, apellidoMaterno
        if (m.apellidoPaterno) {
          return [m.apellidoPaterno, m.apellidoMaterno].filter(Boolean).join(' ');
        }
        // Formato estándar
        if (m.lastName) return m.lastName;
        // Formato alternativo
        if (m.apellido) return m.apellido;
        // Desde nombre completo
        if (m.nombre) return m.nombre.split(' ').slice(1).join(' ') || '';
        // Desde name
        if (m.name) return m.name.split(' ').slice(1).join(' ') || '';
        return '';
      };

      // Helper: solo incluir email si es válido
      const cleanEmail = (val) => {
        if (!val || typeof val !== 'string') return '';
        const trimmed = val.trim();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
      };

      // Mapear miembros al formato del backend
      const mappedMembers = members.map((m, index) => ({
        rut: m.rut,
        firstName: m.primerNombre || m.firstName || (m.nombre ? m.nombre.split(' ')[0] : ''),
        segundoNombre: m.segundoNombre || '',
        lastName: m.apellidoPaterno || m.lastName || m.apellido || '',
        apellidoMaterno: m.apellidoMaterno || '',
        address: m.address || m.direccion || '',
        phone: m.phone || m.telefono || '',
        email: cleanEmail(m.email),
        birthDate: m.birthDate || m.fechaNacimiento || '',
        occupation: m.occupation || m.profesion || '',
        genero: m.genero || m.sexo || '',
        role: index === 0 ? 'president' : index === 1 ? 'secretary' : index === 2 ? 'treasurer' : index < 5 ? 'director' : 'member'
      }));

      // Log para depuración de miembros - mostrar datos originales y mapeados
      console.log('📋 Miembros originales (primeros 3):', members.slice(0, 3).map(m => ({
        rut: m.rut,
        primerNombre: m.primerNombre,
        segundoNombre: m.segundoNombre,
        apellidoPaterno: m.apellidoPaterno,
        apellidoMaterno: m.apellidoMaterno,
        genero: m.genero,
        firstName: m.firstName,
        lastName: m.lastName,
        nombre: m.nombre
      })));
      console.log('📋 Miembros mapeados (primeros 3):', mappedMembers.slice(0, 3).map(m => ({
        rut: m.rut,
        firstName: m.firstName || '❌ VACÍO',
        segundoNombre: m.segundoNombre,
        lastName: m.lastName || '❌ VACÍO',
        apellidoMaterno: m.apellidoMaterno,
        genero: m.genero
      })));

      // Verificar si hay miembros con nombres vacíos
      const membrosConNombresVacios = mappedMembers.filter(m => !m.firstName || !m.lastName);
      if (membrosConNombresVacios.length > 0) {
        console.error('⚠️ HAY MIEMBROS CON NOMBRES VACÍOS:', membrosConNombresVacios.length);
        console.error('⚠️ Detalle:', membrosConNombresVacios.map(m => ({ rut: m.rut, firstName: m.firstName, lastName: m.lastName })));
      }

      // Mapear directorio provisorio
      const dirProv = requestData.directorioProvisorio || {};
      console.log('🔍 directorioProvisorio recibido:', dirProv);

      // Función helper para extraer nombre de un miembro (reutilizando helpers)
      const extractName = (member) => {
        if (!member) return { firstName: '', lastName: '' };
        return { firstName: buildFirstName(member), lastName: buildLastName(member) };
      };

      // Mapear miembros adicionales (vicepresidente, directores, etc.)
      const additionalMembers = (dirProv.miembrosAdicionales || []).map(m => {
        const names = extractName(m);
        // Mapear nombres de cargos a labels legibles
        const cargoLabels = {
          'vicepresidente': 'Vicepresidente/a',
          'director1': 'Director/a',
          'director2': 'Director/a',
          'director3': 'Director/a'
        };
        return {
          rut: m.rut,
          name: `${names.firstName} ${names.lastName}`.trim(),
          firstName: names.firstName,
          lastName: names.lastName,
          cargo: cargoLabels[m.cargo] || m.cargo,
          role: 'director'
        };
      });

      const provisionalDirectorio = {
        president: dirProv.presidente ? {
          rut: dirProv.presidente.rut,
          name: `${extractName(dirProv.presidente).firstName} ${extractName(dirProv.presidente).lastName}`.trim(),
          ...extractName(dirProv.presidente)
        } : null,
        secretary: dirProv.secretario ? {
          rut: dirProv.secretario.rut,
          name: `${extractName(dirProv.secretario).firstName} ${extractName(dirProv.secretario).lastName}`.trim(),
          ...extractName(dirProv.secretario)
        } : null,
        treasurer: dirProv.tesorero ? {
          rut: dirProv.tesorero.rut,
          name: `${extractName(dirProv.tesorero).firstName} ${extractName(dirProv.tesorero).lastName}`.trim(),
          ...extractName(dirProv.tesorero)
        } : null,
        additionalMembers: additionalMembers
      };

      console.log('📤 provisionalDirectorio mapeado:', provisionalDirectorio);
      console.log('📤 additionalMembers:', additionalMembers);

      // Mapear comisión electoral
      console.log('🔍 comisionElectoral recibida:', requestData.comisionElectoral);
      const comisionElectoral = (requestData.comisionElectoral || []).map(m => {
        const names = extractName(m);
        return {
          rut: m.rut,
          name: `${names.firstName} ${names.lastName}`.trim(),
          firstName: names.firstName,
          lastName: names.lastName,
          role: 'electoral_commission'
        };
      });
      console.log('📤 comisionElectoral mapeada:', comisionElectoral);

      const orgData = {
        organizationName: orgInfo.nombre || orgInfo.organizationName || orgInfo.name || 'Sin nombre',
        organizationType: this.mapOrganizationType(orgInfo.tipo || orgInfo.organizationType || orgInfo.type),
        address: orgInfo.direccion || orgInfo.address || requestData.assemblyAddress || '',
        street: orgInfo.street || '',
        streetNumber: orgInfo.streetNumber || '',
        postalCode: orgInfo.postalCode || '',
        comuna: orgInfo.comuna || orgInfo.commune || 'Renca',
        region: orgInfo.region || 'Metropolitana',
        unidadVecinal: orgInfo.unidadVecinal || '',
        territory: orgInfo.territory || orgInfo.territorio || '',
        // Datos de contacto del usuario solicitante (del paso 1)
        contactEmail: orgInfo.contactEmail || orgInfo.email || '',
        contactPhone: orgInfo.contactPhone || orgInfo.phone || '',
        contactPreference: orgInfo.contactPreference || 'phone',
        members: mappedMembers,
        // Directorio Provisorio (paso 5)
        provisionalDirectorio: provisionalDirectorio,
        // Comisión Electoral (paso 5)
        electoralCommission: comisionElectoral,
        // Certificados de Antecedentes del Directorio (paso 5) - SOLO metadata, sin base64
        // El base64 se guarda en colección separada CertificateFiles post-creación
        certificatesStep5: (() => {
          const certs = requestData.certificatesStep5;
          if (!certs || typeof certs !== 'object' || Array.isArray(certs)) return {};
          const result = {};
          for (const [key, cert] of Object.entries(certs)) {
            if (cert) {
              result[key] = {
                name: cert.name || cert.fileName || '',
                type: cert.type || '',
                memberId: cert.memberId || '',
                memberName: cert.memberName || ''
              };
            }
          }
          return result;
        })(),
        // Estatutos (paso 6)
        estatutos: requestData.estatutos || '',
        electionDate: requestData.electionDate,
        electionTime: requestData.electionTime || null,
        assemblyAddress: requestData.assemblyAddress || null,
        comments: requestData.comments || null
      };

      console.log('📤 Enviando organización:', orgData);

      const newOrg = await apiService.createOrganization(orgData);
      this.organizations.push(newOrg);
      localStorage.setItem('user_organizations', JSON.stringify(this.organizations));

      // Guardar certificados base64 en colección separada (evita límite BSON 16MB)
      const certs = requestData.certificatesStep5;
      if (certs && typeof certs === 'object' && !Array.isArray(certs)) {
        try {
          const certFiles = Object.entries(certs)
            .filter(([_, cert]) => cert && (cert.base64 || cert.certificate || cert.data))
            .map(([key, cert]) => {
              let base64 = cert.base64 || cert.certificate || cert.data || '';
              if (base64 && base64.includes(',')) base64 = base64.split(',')[1];
              return {
                memberId: key,
                memberName: cert.memberName || cert.name || '',
                certificate: base64
              };
            });

          if (certFiles.length > 0) {
            await apiService.post(`/organizations/${newOrg._id}/certificate-files`, { certificates: certFiles });
            console.log('✅ Certificados base64 guardados:', certFiles.length);
          }
        } catch (certError) {
          console.error('⚠️ Error guardando certificados (org creada OK):', certError);
        }
      }

      // Guardar documentos generados en colección separada (evita límite BSON 16MB)
      if (requestData.generatedDocuments && typeof requestData.generatedDocuments === 'object') {
        try {
          const docs = Object.entries(requestData.generatedDocuments)
            .filter(([_, doc]) => doc && doc.content)
            .map(([key, doc]) => ({
              docType: key,
              content: doc.content,
              generatedAt: doc.generatedAt || new Date().toISOString(),
              editedAt: doc.editedAt || null,
              cargoId: doc.cargoId || null,
              cargoNombre: doc.cargoNombre || null
            }));

          if (docs.length > 0) {
            await apiService.post(`/organizations/${newOrg._id}/generated-documents`, { documents: docs });
            console.log('✅ Documentos generados guardados:', docs.length);
          }
        } catch (docError) {
          console.error('⚠️ Error guardando documentos generados (org creada OK):', docError);
          // No lanzar error — la org ya se creó exitosamente
        }
      }

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

  /**
   * Solicita la disolución de una organización
   */
  async dissolveOrganization(id, reason, details = '') {
    try {
      const comment = `Motivo: ${reason}. ${details}`.trim();
      const updated = await apiService.updateOrgStatus(id, ORG_STATUS.DISSOLVED, comment);
      const index = this.organizations.findIndex(org => org.id === id || org._id === id);
      if (index !== -1) {
        this.organizations[index] = updated;
        localStorage.setItem('user_organizations', JSON.stringify(this.organizations));
      }
      return updated;
    } catch (e) {
      console.error('Error dissolving organization:', e);
      throw e;
    }
  }
}

// Instancia singleton
export const organizationsService = new OrganizationsService();
