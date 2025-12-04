/**
 * Servicio de Asignaciones de Ministros de Fe
 * Gestiona las asignaciones de ministros a asambleas
 */

class MinistroAssignmentService {
  constructor() {
    this.storageKey = 'ministro_assignments';
  }

  /**
   * Obtiene todas las asignaciones
   */
  getAll() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error al obtener asignaciones:', error);
      return [];
    }
  }

  /**
   * Obtiene asignaciones de un ministro específico
   */
  getByMinistroId(ministroId) {
    return this.getAll().filter(a => a.ministroId === ministroId);
  }

  /**
   * Obtiene asignaciones de una organización específica
   */
  getByOrganizationId(orgId) {
    return this.getAll().filter(a => a.organizationId === orgId);
  }

  /**
   * Crea una nueva asignación
   */
  create(assignmentData) {
    const assignments = this.getAll();

    const newAssignment = {
      id: `assignment-${Date.now()}`,
      ministroId: assignmentData.ministroId,
      ministroName: assignmentData.ministroName,
      ministroRut: assignmentData.ministroRut,
      organizationId: assignmentData.organizationId,
      organizationName: assignmentData.organizationName,
      scheduledDate: assignmentData.scheduledDate,
      scheduledTime: assignmentData.scheduledTime,
      location: assignmentData.location,
      status: 'pending', // pending, completed, cancelled
      signaturesValidated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    assignments.push(newAssignment);
    this.saveAll(assignments);

    return newAssignment;
  }

  /**
   * Actualiza una asignación
   */
  update(id, updates) {
    const assignments = this.getAll();
    const index = assignments.findIndex(a => a.id === id);

    if (index === -1) {
      throw new Error('Asignación no encontrada');
    }

    assignments[index] = {
      ...assignments[index],
      ...updates,
      id: assignments[index].id,
      createdAt: assignments[index].createdAt,
      updatedAt: new Date().toISOString()
    };

    this.saveAll(assignments);
    return assignments[index];
  }

  /**
   * Marca firmas como validadas
   */
  markSignaturesValidated(id, validatedData) {
    return this.update(id, {
      signaturesValidated: true,
      validatedAt: new Date().toISOString(),
      validatedBy: validatedData.validatedBy, // 'MINISTRO' o 'USER'
      signatures: validatedData.signatures
    });
  }

  /**
   * Completa una asignación
   */
  complete(id) {
    return this.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  }

  /**
   * Cancela una asignación
   */
  cancel(id, reason) {
    return this.update(id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason
    });
  }

  /**
   * Verifica si un ministro tiene conflicto de horario
   */
  hasScheduleConflict(ministroId, date, time) {
    const assignments = this.getByMinistroId(ministroId);

    return assignments.some(a =>
      a.status !== 'cancelled' &&
      a.scheduledDate === date &&
      a.scheduledTime === time
    );
  }

  /**
   * Obtiene asignaciones pendientes de un ministro
   */
  getPendingByMinistro(ministroId) {
    return this.getByMinistroId(ministroId).filter(a => a.status === 'pending');
  }

  /**
   * Obtiene asignaciones completadas de un ministro
   */
  getCompletedByMinistro(ministroId) {
    return this.getByMinistroId(ministroId).filter(a => a.status === 'completed');
  }

  /**
   * Guarda todas las asignaciones
   */
  saveAll(assignments) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(assignments));
    } catch (error) {
      console.error('Error al guardar asignaciones:', error);
      throw new Error('No se pudo guardar la información');
    }
  }

  /**
   * Obtiene estadísticas de un ministro
   */
  getStatsByMinistro(ministroId) {
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

// Exportar instancia singleton
export const ministroAssignmentService = new MinistroAssignmentService();
