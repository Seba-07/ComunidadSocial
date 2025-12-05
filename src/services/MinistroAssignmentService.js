/**
 * Servicio de Asignaciones de Ministros de Fe
 * Conecta con el backend API
 */

import { apiService } from './ApiService.js';

class MinistroAssignmentService {
  constructor() {
    this.assignments = [];
    this.loaded = false;
  }

  /**
   * Carga las asignaciones desde el servidor
   */
  async loadFromServer() {
    try {
      this.assignments = await apiService.getAssignments();
      this.loaded = true;
      localStorage.setItem('ministro_assignments', JSON.stringify(this.assignments));
    } catch (e) {
      console.error('Error loading assignments from server:', e);
      this.loadFromStorage();
    }
  }

  /**
   * Carga desde localStorage (fallback)
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem('ministro_assignments');
      this.assignments = data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error al obtener asignaciones:', error);
      this.assignments = [];
    }
  }

  /**
   * Sincroniza con el servidor
   */
  async sync() {
    await this.loadFromServer();
  }

  /**
   * Obtiene todas las asignaciones
   */
  getAll() {
    return this.assignments;
  }

  /**
   * Obtiene todas las asignaciones desde el servidor
   */
  async getAllAsync() {
    try {
      const assignments = await apiService.getAssignments();
      this.assignments = assignments;
      localStorage.setItem('ministro_assignments', JSON.stringify(assignments));
      return assignments;
    } catch (e) {
      console.error('Error fetching assignments:', e);
      return this.assignments;
    }
  }

  /**
   * Obtiene asignaciones de un ministro específico
   */
  getByMinistroId(ministroId) {
    return this.assignments.filter(a =>
      a.ministroId === ministroId || a.ministroId === ministroId.toString()
    );
  }

  /**
   * Obtiene asignaciones de un ministro desde el servidor
   */
  async getByMinistroIdAsync(ministroId) {
    try {
      const assignments = await apiService.getMinistroAssignments(ministroId);
      return assignments;
    } catch (e) {
      console.error('Error fetching ministro assignments:', e);
      return this.getByMinistroId(ministroId);
    }
  }

  /**
   * Obtiene asignaciones de una organización específica
   */
  getByOrganizationId(orgId) {
    return this.assignments.filter(a =>
      a.organizationId === orgId || a.organizationId === orgId.toString()
    );
  }

  /**
   * Obtiene una asignación por ID
   */
  getById(id) {
    return this.assignments.find(a => a.id === id || a._id === id);
  }

  /**
   * Obtiene una asignación por ID desde el servidor
   */
  async getByIdAsync(id) {
    try {
      return await apiService.getAssignment(id);
    } catch (e) {
      console.error('Error fetching assignment:', e);
      return this.getById(id);
    }
  }

  /**
   * Crea una nueva asignación
   */
  async create(assignmentData) {
    try {
      const newAssignment = await apiService.createAssignment(assignmentData);
      this.assignments.push(newAssignment);
      localStorage.setItem('ministro_assignments', JSON.stringify(this.assignments));
      return newAssignment;
    } catch (e) {
      console.error('Error creating assignment:', e);
      throw e;
    }
  }

  /**
   * Actualiza una asignación
   */
  async update(id, updates) {
    try {
      const updated = await apiService.updateAssignment(id, updates);
      const index = this.assignments.findIndex(a => a.id === id || a._id === id);
      if (index !== -1) {
        this.assignments[index] = updated;
        localStorage.setItem('ministro_assignments', JSON.stringify(this.assignments));
      }
      return updated;
    } catch (e) {
      console.error('Error updating assignment:', e);
      throw e;
    }
  }

  /**
   * Marca firmas como validadas
   */
  async markSignaturesValidated(id, validatedData) {
    try {
      const updated = await apiService.validateSignatures(id, validatedData.signatures, validatedData.wizardData);
      const index = this.assignments.findIndex(a => a.id === id || a._id === id);
      if (index !== -1) {
        this.assignments[index] = updated;
        localStorage.setItem('ministro_assignments', JSON.stringify(this.assignments));
      }
      return updated;
    } catch (e) {
      console.error('Error validating signatures:', e);
      throw e;
    }
  }

  /**
   * Resetea la validación para permitir edición
   */
  async resetValidation(id) {
    try {
      const updated = await apiService.resetValidation(id);
      const index = this.assignments.findIndex(a => a.id === id || a._id === id);
      if (index !== -1) {
        this.assignments[index] = updated;
        localStorage.setItem('ministro_assignments', JSON.stringify(this.assignments));
      }
      return updated;
    } catch (e) {
      console.error('Error resetting validation:', e);
      throw e;
    }
  }

  /**
   * Completa una asignación
   */
  async complete(id) {
    try {
      const updated = await apiService.completeAssignment(id);
      const index = this.assignments.findIndex(a => a.id === id || a._id === id);
      if (index !== -1) {
        this.assignments[index] = updated;
        localStorage.setItem('ministro_assignments', JSON.stringify(this.assignments));
      }
      return updated;
    } catch (e) {
      console.error('Error completing assignment:', e);
      throw e;
    }
  }

  /**
   * Cancela una asignación
   */
  async cancel(id, reason) {
    try {
      const updated = await apiService.cancelAssignment(id, reason);
      const index = this.assignments.findIndex(a => a.id === id || a._id === id);
      if (index !== -1) {
        this.assignments[index] = updated;
        localStorage.setItem('ministro_assignments', JSON.stringify(this.assignments));
      }
      return updated;
    } catch (e) {
      console.error('Error cancelling assignment:', e);
      throw e;
    }
  }

  /**
   * Verifica si un ministro tiene conflicto de horario
   */
  async hasScheduleConflict(ministroId, date, time) {
    try {
      const result = await apiService.checkScheduleConflict(ministroId, date, time);
      return result.hasConflict;
    } catch (e) {
      console.error('Error checking schedule conflict:', e);
      // Fallback local
      return this.assignments.some(a =>
        (a.ministroId === ministroId || a.ministroId === ministroId.toString()) &&
        a.status !== 'cancelled' &&
        a.scheduledDate === date &&
        a.scheduledTime === time
      );
    }
  }

  /**
   * Obtiene asignaciones pendientes de un ministro
   */
  getPendingByMinistro(ministroId) {
    return this.getByMinistroId(ministroId).filter(a => a.status === 'pending');
  }

  /**
   * Obtiene asignaciones pendientes desde el servidor
   */
  async getPendingByMinistroAsync(ministroId) {
    try {
      const assignments = await apiService.getMyPendingAssignments();
      return assignments;
    } catch (e) {
      console.error('Error fetching pending assignments:', e);
      return this.getPendingByMinistro(ministroId);
    }
  }

  /**
   * Obtiene asignaciones completadas de un ministro
   */
  getCompletedByMinistro(ministroId) {
    return this.getByMinistroId(ministroId).filter(a => a.status === 'completed');
  }

  /**
   * Obtiene estadísticas de un ministro
   */
  async getStatsByMinistro(ministroId) {
    try {
      return await apiService.getAssignmentStats(ministroId);
    } catch (e) {
      console.error('Error getting stats:', e);
      const assignments = this.getByMinistroId(ministroId);
      return {
        total: assignments.length,
        pending: assignments.filter(a => a.status === 'pending').length,
        completed: assignments.filter(a => a.status === 'completed').length,
        cancelled: assignments.filter(a => a.status === 'cancelled').length,
        signaturesValidated: assignments.filter(a => a.signaturesValidated).length
      };
    }
  }
}

// Exportar instancia singleton
export const ministroAssignmentService = new MinistroAssignmentService();
