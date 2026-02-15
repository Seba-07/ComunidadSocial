/**
 * Servicio de Alertas para Organizaciones
 * Maneja alertas y responsabilidades post-aprobación según Ley 19.418
 */

import { organizationsService, ORG_STATUS } from './OrganizationsService.js';

// Tipos de alertas
export const ALERT_TYPES = {
  DIRECTORIO_DEFINITIVO: 'directorio_definitivo',       // 60 días post-aprobación
  REGISTRO_SOCIOS: 'registro_socios',                   // Cada 6 meses
  COMISION_REVISORA: 'comision_revisora',               // Anual
  TRICEL_DESIGNATION: 'tricel_designation',             // 2 meses antes de vencimiento
  DIRECTORIO_RENEWAL: 'directorio_renewal'              // 3 años, renovar directorio
};

// Prioridades de alerta
export const ALERT_PRIORITY = {
  CRITICAL: 'critical',    // Vencido
  HIGH: 'high',           // < 7 días
  MEDIUM: 'medium',       // 7-30 días
  LOW: 'low'              // > 30 días
};

class AlertsService {
  constructor() {
    this.alerts = [];
  }

  /**
   * Obtiene todas las alertas de una organización
   * @param {string} orgId - ID de la organización
   * @returns {Array} Lista de alertas
   */
  getOrganizationAlerts(orgId) {
    const org = organizationsService.getById(orgId);
    if (!org || org.status !== ORG_STATUS.APPROVED) {
      return [];
    }

    const alerts = [];
    const now = new Date();

    // 1. ALERTA: Directorio Definitivo (60 días post-aprobación)
    if (org.provisionalDirectorio && org.provisionalDirectorio.type === 'PROVISIONAL') {
      const expiresAt = new Date(org.provisionalDirectorio.expiresAt);
      const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

      if (daysRemaining >= 0 || daysRemaining > -30) { // Mostrar hasta 30 días después de vencido
        alerts.push({
          id: `${orgId}_directorio_definitivo`,
          type: ALERT_TYPES.DIRECTORIO_DEFINITIVO,
          title: 'Elección de Directorio Definitivo',
          description: 'Debe elegir y registrar el Directorio Definitivo dentro de 60 días desde la aprobación',
          dueDate: expiresAt,
          daysRemaining,
          priority: this.calculatePriority(daysRemaining),
          actionRequired: true,
          actionLabel: 'Registrar Directorio Definitivo',
          completed: org.definitiveDirectorio ? true : false
        });
      }
    }

    // 2. ALERTA: Registro de Socios (Semestral)
    if (org.approvalDate) {
      const lastUpdate = org.lastSociosUpdate ? new Date(org.lastSociosUpdate) : new Date(org.approvalDate);
      const nextUpdate = new Date(lastUpdate);
      nextUpdate.setMonth(nextUpdate.getMonth() + 6);

      const daysRemaining = Math.ceil((nextUpdate - now) / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 30) { // Mostrar 30 días antes
        alerts.push({
          id: `${orgId}_registro_socios`,
          type: ALERT_TYPES.REGISTRO_SOCIOS,
          title: 'Actualización de Registro de Socios',
          description: 'Debe remitir copia actualizada del Registro de Socios (nuevas incorporaciones o renuncias)',
          dueDate: nextUpdate,
          daysRemaining,
          priority: this.calculatePriority(daysRemaining),
          actionRequired: true,
          actionLabel: 'Actualizar Registro',
          frequency: 'Semestral',
          completed: false
        });
      }
    }

    // 3. ALERTA: Comisión Revisora de Cuentas (Anual)
    if (org.approvalDate) {
      const lastElection = org.lastComisionRevisoraElection ? new Date(org.lastComisionRevisoraElection) : new Date(org.approvalDate);
      const nextElection = new Date(lastElection);
      nextElection.setFullYear(nextElection.getFullYear() + 1);

      const daysRemaining = Math.ceil((nextElection - now) / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 30) { // Mostrar 30 días antes
        alerts.push({
          id: `${orgId}_comision_revisora`,
          type: ALERT_TYPES.COMISION_REVISORA,
          title: 'Elección de Comisión Revisora de Cuentas',
          description: 'Debe elegir anualmente la Comisión Revisora de Cuentas',
          dueDate: nextElection,
          daysRemaining,
          priority: this.calculatePriority(daysRemaining),
          actionRequired: true,
          actionLabel: 'Registrar Comisión Revisora',
          frequency: 'Anual',
          completed: false
        });
      }
    }

    // 4. ALERTA: Designación TRICEL (2 meses antes de vencimiento directorio)
    if (org.definitiveDirectorio) {
      const directorioStart = new Date(org.definitiveDirectorio.electedAt);
      const directorioExpires = new Date(directorioStart);
      directorioExpires.setFullYear(directorioExpires.getFullYear() + 3); // 3 años de duración

      const tricelDeadline = new Date(directorioExpires);
      tricelDeadline.setMonth(tricelDeadline.getMonth() - 2); // 2 meses antes

      const daysRemaining = Math.ceil((tricelDeadline - now) / (1000 * 60 * 60 * 24));

      if (daysRemaining >= 0 && daysRemaining <= 60) { // Mostrar 60 días antes
        alerts.push({
          id: `${orgId}_tricel`,
          type: ALERT_TYPES.TRICEL_DESIGNATION,
          title: 'Designación de TRICEL (Comisión Electoral)',
          description: 'Debe designar el Tribunal Calificador de Elecciones 2 meses antes del vencimiento del directorio',
          dueDate: tricelDeadline,
          daysRemaining,
          priority: this.calculatePriority(daysRemaining),
          actionRequired: true,
          actionLabel: 'Designar TRICEL',
          relatedDate: directorioExpires,
          completed: org.tricelDesignated ? true : false
        });
      }

      // 5. ALERTA: Renovación de Directorio (3 años)
      const daysToRenewal = Math.ceil((directorioExpires - now) / (1000 * 60 * 60 * 24));

      if (daysToRenewal >= 0 && daysToRenewal <= 60) {
        alerts.push({
          id: `${orgId}_renewal`,
          type: ALERT_TYPES.DIRECTORIO_RENEWAL,
          title: 'Renovación de Directorio',
          description: 'El directorio actual vence. Debe realizar nueva elección de directorio',
          dueDate: directorioExpires,
          daysRemaining: daysToRenewal,
          priority: this.calculatePriority(daysToRenewal),
          actionRequired: true,
          actionLabel: 'Iniciar Proceso Electoral',
          completed: false
        });
      }
    }

    // Ordenar por prioridad y fecha
    return alerts.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.daysRemaining - b.daysRemaining;
    });
  }

  /**
   * Calcula la prioridad según días restantes
   * @param {number} daysRemaining - Días restantes
   * @returns {string} Prioridad
   */
  calculatePriority(daysRemaining) {
    if (daysRemaining < 0) return ALERT_PRIORITY.CRITICAL;
    if (daysRemaining <= 7) return ALERT_PRIORITY.HIGH;
    if (daysRemaining <= 30) return ALERT_PRIORITY.MEDIUM;
    return ALERT_PRIORITY.LOW;
  }

  /**
   * Obtiene el color según prioridad
   * @param {string} priority - Prioridad
   * @returns {string} Color hex
   */
  getPriorityColor(priority) {
    const colors = {
      [ALERT_PRIORITY.CRITICAL]: '#dc2626',  // Rojo
      [ALERT_PRIORITY.HIGH]: '#ea580c',      // Naranja
      [ALERT_PRIORITY.MEDIUM]: '#f59e0b',    // Amarillo
      [ALERT_PRIORITY.LOW]: '#2563eb'        // Azul
    };
    return colors[priority] || '#6b7280';
  }

  /**
   * Obtiene el ícono según prioridad
   * @param {string} priority - Prioridad
   * @returns {string} Emoji
   */
  getPriorityIcon(priority) {
    const icons = {
      [ALERT_PRIORITY.CRITICAL]: '🚨',
      [ALERT_PRIORITY.HIGH]: '⚠️',
      [ALERT_PRIORITY.MEDIUM]: '⏰',
      [ALERT_PRIORITY.LOW]: 'ℹ️'
    };
    return icons[priority] || 'ℹ️';
  }

  /**
   * Obtiene resumen de alertas por usuario
   * @param {string} userId - ID del usuario
   * @returns {Object} Resumen de alertas
   */
  getUserAlertsSummary(userId) {
    const orgs = organizationsService.getByUser(userId);
    let critical = 0;
    let high = 0;
    let total = 0;

    orgs.forEach(org => {
      const alerts = this.getOrganizationAlerts(org.id);
      total += alerts.length;
      alerts.forEach(alert => {
        if (alert.priority === ALERT_PRIORITY.CRITICAL) critical++;
        else if (alert.priority === ALERT_PRIORITY.HIGH) high++;
      });
    });

    return { critical, high, total };
  }

  /**
   * FASE 5: Verifica si una organización es "fantasma"
   * @param {string} orgId - ID de la organización
   * @returns {Object} Estado de la organización
   */
  isGhostOrganization(orgId) {
    const alerts = this.getOrganizationAlerts(orgId);

    // Criterios para organización fantasma:
    const criticalAlerts = alerts.filter(a => a.priority === ALERT_PRIORITY.CRITICAL);
    const totalOverdue = criticalAlerts.length;

    // Calcular días totales de atraso
    const totalOverdueDays = criticalAlerts.reduce((sum, alert) => {
      return sum + Math.abs(alert.daysRemaining);
    }, 0);

    // Es fantasma si:
    // 1. Tiene 2+ alertas críticas (vencidas)
    // 2. O tiene 1 alerta vencida por más de 60 días
    const isGhost = totalOverdue >= 2 || totalOverdueDays > 60;

    return {
      isGhost,
      criticalCount: totalOverdue,
      totalOverdueDays,
      severity: totalOverdueDays > 120 ? 'severe' : totalOverdueDays > 60 ? 'high' : 'medium',
      alerts: criticalAlerts
    };
  }

  /**
   * FASE 5: Obtiene todas las organizaciones fantasma
   * @returns {Array} Lista de organizaciones fantasma con detalles
   */
  getGhostOrganizations() {
    const allOrgs = organizationsService.getAll();
    const ghosts = [];

    allOrgs.forEach(org => {
      if (org.status === ORG_STATUS.APPROVED) {
        const ghostStatus = this.isGhostOrganization(org.id);
        if (ghostStatus.isGhost) {
          ghosts.push({
            org,
            ...ghostStatus
          });
        }
      }
    });

    // Ordenar por severidad
    return ghosts.sort((a, b) => b.totalOverdueDays - a.totalOverdueDays);
  }

  /**
   * Marca una acción como completada
   * @param {string} orgId - ID de la organización
   * @param {string} alertType - Tipo de alerta
   * @param {Object} data - Datos adicionales
   */
  completeAlert(orgId, alertType, data = {}) {
    const org = organizationsService.getById(orgId);
    if (!org) return false;

    const now = new Date().toISOString();

    switch (alertType) {
      case ALERT_TYPES.DIRECTORIO_DEFINITIVO:
        org.definitiveDirectorio = {
          ...data.directorio,
          electedAt: now,
          type: 'DEFINITIVE'
        };
        org.provisionalDirectorio = null;
        break;

      case ALERT_TYPES.REGISTRO_SOCIOS:
        org.lastSociosUpdate = now;
        break;

      case ALERT_TYPES.COMISION_REVISORA:
        org.lastComisionRevisoraElection = now;
        org.comisionRevisora = data.comision;
        break;

      case ALERT_TYPES.TRICEL_DESIGNATION:
        org.tricelDesignated = true;
        org.tricelData = {
          ...data.tricel,
          designatedAt: now
        };
        break;

      case ALERT_TYPES.DIRECTORIO_RENEWAL:
        org.definitiveDirectorio = {
          ...data.directorio,
          electedAt: now,
          type: 'DEFINITIVE'
        };
        org.tricelDesignated = false; // Reset para próximo ciclo
        break;
    }

    organizationsService.update(orgId, org);
    return true;
  }
}

// Instancia singleton
export const alertsService = new AlertsService();
