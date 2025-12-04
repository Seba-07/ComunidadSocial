/**
 * Servicio de Gestión de Organizaciones
 * Maneja el estado y persistencia de las organizaciones del usuario
 */

import { notificationService } from './NotificationService.js';

const STORAGE_KEY = 'user_organizations';

// Estados posibles de una organización
export const ORG_STATUS = {
  DRAFT: 'draft',                           // Borrador (wizard no completado)
  WAITING_MINISTRO_REQUEST: 'waiting_ministro', // Usuario completó pasos 1-2, esperando solicitud Ministro de Fe
  MINISTRO_SCHEDULED: 'ministro_scheduled', // Ministro de Fe agendado por municipalidad
  MINISTRO_APPROVED: 'ministro_approved',   // Ministro de Fe aprobó, puede continuar wizard
  PENDING_REVIEW: 'pending_review',         // Enviada, pendiente de revisión municipal
  IN_REVIEW: 'in_review',                   // En revisión por la municipalidad
  REJECTED: 'rejected',                     // Rechazada (requiere correcciones)
  SENT_TO_REGISTRY: 'sent_registry',        // Enviada al Registro Civil
  APPROVED: 'approved',                     // Aprobada y vigente
  DISSOLVED: 'dissolved'                    // Organización disuelta
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
  [ORG_STATUS.DRAFT]: '#6b7280',                    // Gris
  [ORG_STATUS.WAITING_MINISTRO_REQUEST]: '#f59e0b', // Amarillo
  [ORG_STATUS.MINISTRO_SCHEDULED]: '#8b5cf6',       // Púrpura
  [ORG_STATUS.MINISTRO_APPROVED]: '#06b6d4',        // Cyan claro
  [ORG_STATUS.PENDING_REVIEW]: '#f59e0b',           // Amarillo
  [ORG_STATUS.IN_REVIEW]: '#3b82f6',                // Azul
  [ORG_STATUS.REJECTED]: '#ef4444',                 // Rojo
  [ORG_STATUS.SENT_TO_REGISTRY]: '#0891b2',         // Cyan/Teal - más visible
  [ORG_STATUS.APPROVED]: '#10b981',                 // Verde
  [ORG_STATUS.DISSOLVED]: '#4b5563'                 // Gris oscuro
};

class OrganizationsService {
  constructor() {
    this.organizations = [];
    this.loadFromStorage();
  }

  /**
   * Carga las organizaciones desde localStorage
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.organizations = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading organizations:', e);
      this.organizations = [];
    }
  }

  /**
   * Guarda las organizaciones en localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.organizations));
    } catch (e) {
      console.error('Error saving organizations:', e);
    }
  }

  /**
   * Obtiene todas las organizaciones (para admin)
   */
  getAll() {
    return this.organizations;
  }

  /**
   * Obtiene las organizaciones de un usuario específico
   */
  getByUser(userId) {
    if (!userId) return [];
    return this.organizations.filter(org => org.userId === userId);
  }

  /**
   * Obtiene las organizaciones del usuario actual
   */
  getCurrentUserOrganizations() {
    try {
      const userData = localStorage.getItem('currentUser');
      if (!userData) return [];
      const user = JSON.parse(userData);
      return this.getByUser(user.id);
    } catch (e) {
      console.error('Error getting current user organizations:', e);
      return [];
    }
  }

  /**
   * Obtiene una organización por ID
   */
  getById(id) {
    return this.organizations.find(org => org.id === id);
  }

  /**
   * Crea una nueva organización
   */
  create(orgData) {
    // Obtener userId del usuario actual
    let userId = null;
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        userId = user.id;
      }
    } catch (e) {
      console.error('Error getting current user:', e);
    }

    const newOrg = {
      id: 'org_' + Date.now(),
      userId: userId,
      ...orgData,
      status: ORG_STATUS.PENDING_REVIEW,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        {
          status: ORG_STATUS.PENDING_REVIEW,
          date: new Date().toISOString(),
          comment: 'Solicitud enviada'
        }
      ]
    };

    this.organizations.push(newOrg);
    this.saveToStorage();
    return newOrg;
  }

  /**
   * Actualiza una organización
   */
  update(id, updates) {
    const index = this.organizations.findIndex(org => org.id === id);
    if (index !== -1) {
      this.organizations[index] = {
        ...this.organizations[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveToStorage();
      return this.organizations[index];
    }
    return null;
  }

  /**
   * Actualiza el estado de una organización
   */
  updateStatus(id, newStatus, comment = '') {
    const org = this.getById(id);
    if (org) {
      org.status = newStatus;
      org.updatedAt = new Date().toISOString();
      org.statusHistory.push({
        status: newStatus,
        date: new Date().toISOString(),
        comment
      });
      this.saveToStorage();
      return org;
    }
    return null;
  }

  /**
   * Rechaza una organización con correcciones detalladas
   * @param {string} id - ID de la organización
   * @param {Object} corrections - Objeto con las correcciones requeridas
   * @param {string} generalComment - Comentario general del revisor
   */
  rejectWithCorrections(id, corrections, generalComment = '') {
    const org = this.getById(id);
    if (org) {
      org.status = ORG_STATUS.REJECTED;
      org.updatedAt = new Date().toISOString();

      // Guardar las correcciones requeridas
      org.corrections = {
        fields: corrections.fields || {},      // { fieldKey: { comment: '', required: true } }
        documents: corrections.documents || {}, // { docType: { comment: '', required: true } }
        certificates: corrections.certificates || {}, // { memberId: { comment: '', required: true } }
        generalComment: generalComment,
        createdAt: new Date().toISOString(),
        resolved: false
      };

      org.statusHistory.push({
        status: ORG_STATUS.REJECTED,
        date: new Date().toISOString(),
        comment: generalComment || 'Solicitud requiere correcciones',
        corrections: org.corrections
      });

      this.saveToStorage();
      return org;
    }
    return null;
  }

  /**
   * Reenvía una organización corregida para revisión
   * @param {string} id - ID de la organización
   * @param {string} userComment - Comentario general del usuario para el revisor
   * @param {Object} fieldResponses - Respuestas por campo { field: {key: response}, document: {key: response}, certificate: {key: response} }
   */
  resubmitForReview(id, userComment = '', fieldResponses = {}) {
    const org = this.getById(id);
    if (org && org.status === ORG_STATUS.REJECTED) {
      org.status = ORG_STATUS.PENDING_REVIEW;
      org.updatedAt = new Date().toISOString();

      // Marcar correcciones como resueltas pero mantener historial
      if (org.corrections) {
        org.corrections.resolved = true;
        org.corrections.resolvedAt = new Date().toISOString();
        // Guardar comentario general del usuario si existe
        if (userComment) {
          org.corrections.userResponse = userComment;
        }
        // Guardar respuestas por campo
        if (Object.keys(fieldResponses).length > 0) {
          org.corrections.userFieldResponses = fieldResponses;
        }
      }

      // Crear comentario para el historial
      let historyComment = 'Solicitud reenviada con correcciones';
      if (userComment) {
        historyComment += ` - Observación general: "${userComment}"`;
      }

      org.statusHistory.push({
        status: ORG_STATUS.PENDING_REVIEW,
        date: new Date().toISOString(),
        comment: historyComment,
        userComment: userComment || null,
        userFieldResponses: Object.keys(fieldResponses).length > 0 ? fieldResponses : null
      });

      this.saveToStorage();
      return org;
    }
    return null;
  }

  /**
   * Elimina una organización (solo borradores)
   */
  delete(id) {
    const org = this.getById(id);
    if (org && org.status === ORG_STATUS.DRAFT) {
      this.organizations = this.organizations.filter(o => o.id !== id);
      this.saveToStorage();
      return true;
    }
    return false;
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
  getCountByStatus() {
    const counts = {};
    Object.values(ORG_STATUS).forEach(status => {
      counts[status] = this.organizations.filter(org => org.status === status).length;
    });
    return counts;
  }

  /**
   * Solicita un Ministro de Fe (después de completar pasos 1-2)
   * @param {Object} requestData - Datos de la solicitud
   * @param {Object} requestData.organizationData - Datos de pasos 1-2 (info básica y miembros)
   * @param {string} requestData.electionDate - Fecha programada para elección
   */
  requestMinistro(requestData) {
    let userId = null;
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        userId = user.id;
      }
    } catch (e) {
      console.error('Error getting current user:', e);
    }

    const newOrg = {
      id: 'org_' + Date.now(),
      userId: userId,
      ...requestData.organizationData,
      status: ORG_STATUS.WAITING_MINISTRO_REQUEST,
      electionDate: requestData.electionDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        {
          status: ORG_STATUS.WAITING_MINISTRO_REQUEST,
          date: new Date().toISOString(),
          comment: `Solicitud de Ministro de Fe para fecha: ${requestData.electionDate}`
        }
      ],
      ministroData: null, // Se llenará cuando admin asigne
      provisionalDirectorio: null // Se llenará cuando Ministro de Fe designe
    };

    this.organizations.push(newOrg);
    this.saveToStorage();
    return newOrg;
  }

  /**
   * Agenda un Ministro de Fe (Admin)
   * @param {string} id - ID de la organización
   * @param {Object} ministroData - Datos del Ministro de Fe
   * @param {string} ministroData.name - Nombre del Ministro de Fe
   * @param {string} ministroData.rut - RUT del Ministro de Fe
   * @param {string} ministroData.scheduledDate - Fecha agendada
   * @param {string} ministroData.scheduledTime - Hora agendada
   * @param {string} ministroData.location - Lugar de la reunión
   */
  scheduleMinistro(id, ministroData) {
    const org = this.getById(id);
    if (org) {
      // Detectar si es cambio de horario
      const hadPreviousSchedule = org.ministroData && org.ministroData.scheduledDate && org.ministroData.scheduledTime;
      const isScheduleChange = hadPreviousSchedule && (
        org.ministroData.scheduledDate !== ministroData.scheduledDate ||
        org.ministroData.scheduledTime !== ministroData.scheduledTime
      );

      // Guardar horario anterior si es cambio
      if (isScheduleChange) {
        const oldSchedule = {
          date: org.ministroData.scheduledDate,
          time: org.ministroData.scheduledTime
        };
        const newSchedule = {
          date: ministroData.scheduledDate,
          time: ministroData.scheduledTime
        };

        // Crear notificación de cambio de horario
        try {
          notificationService.notifyScheduleChange(
            org.userId,
            oldSchedule,
            newSchedule,
            org.organizationName
          );
        } catch (error) {
          console.error('Error creating schedule change notification:', error);
        }
      } else if (!hadPreviousSchedule) {
        // Primera vez que se asigna ministro - crear notificación
        try {
          notificationService.notifyMinistroAssigned(
            org.userId,
            ministroData,
            org.organizationName
          );
        } catch (error) {
          console.error('Error creating ministro assigned notification:', error);
        }
      }

      org.status = ORG_STATUS.MINISTRO_SCHEDULED;
      org.updatedAt = new Date().toISOString();
      org.ministroData = {
        ...ministroData,
        assignedAt: new Date().toISOString()
      };

      org.statusHistory.push({
        status: ORG_STATUS.MINISTRO_SCHEDULED,
        date: new Date().toISOString(),
        comment: `Ministro de Fe agendado: ${ministroData.name} para ${ministroData.scheduledDate} a las ${ministroData.scheduledTime}`
      });

      this.saveToStorage();
      return org;
    }
    return null;
  }

  /**
   * Aprueba con Ministro de Fe y designa Directorio Provisorio
   * @param {string} id - ID de la organización
   * @param {Object} provisionalDirectorio - Directorio provisorio designado
   * @param {Object} provisionalDirectorio.president - Presidente
   * @param {Object} provisionalDirectorio.secretary - Secretario
   * @param {Object} provisionalDirectorio.treasurer - Tesorero (vocal)
   * @param {string} ministroSignature - Firma digital del Ministro de Fe (base64)
   */
  approveByMinistro(id, provisionalDirectorio, ministroSignature) {
    const org = this.getById(id);
    if (org) {
      org.status = ORG_STATUS.MINISTRO_APPROVED;
      org.updatedAt = new Date().toISOString();
      org.provisionalDirectorio = {
        ...provisionalDirectorio,
        designatedAt: new Date().toISOString(),
        type: 'PROVISIONAL', // Provisorio, tiene 60 días para elegir definitivo
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 días
      };
      org.ministroSignature = ministroSignature;

      org.statusHistory.push({
        status: ORG_STATUS.MINISTRO_APPROVED,
        date: new Date().toISOString(),
        comment: `Aprobado por Ministro de Fe. Directorio Provisorio designado. Plazo: 60 días para elección definitiva.`
      });

      this.saveToStorage();
      return org;
    }
    return null;
  }

  /**
   * Disuelve una organización (Admin o User)
   * @param {string} id - ID de la organización
   * @param {string} reason - Razón de la disolución
   * @param {string} dissolvedBy - 'admin' o 'user'
   */
  dissolveOrganization(id, reason, dissolvedBy = 'admin') {
    const org = this.getById(id);
    if (org) {
      org.status = ORG_STATUS.DISSOLVED;
      org.updatedAt = new Date().toISOString();
      org.dissolvedAt = new Date().toISOString();
      org.dissolutionReason = reason;
      org.dissolvedBy = dissolvedBy;

      org.statusHistory.push({
        status: ORG_STATUS.DISSOLVED,
        date: new Date().toISOString(),
        comment: `Organización disuelta. Razón: ${reason}. Iniciado por: ${dissolvedBy === 'admin' ? 'Municipalidad' : 'Usuario'}`
      });

      this.saveToStorage();
      return org;
    }
    return null;
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
