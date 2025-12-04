/**
 * Application Entity
 * Representa una solicitud/postulación para formar una organización comunitaria
 */
export class Application {
  constructor({
    id = null,
    userId,
    organizationId,
    status = 'DRAFT', // 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REQUIRES_CHANGES'
    currentStep = 1,
    totalSteps = 6,
    documents = [],
    statutes = null,
    electoralCommission = null,
    reviewComments = [],
    submittedAt = null,
    reviewedAt = null,
    reviewedBy = null,
    approvalDate = null,
    rejectionReason = null
  }) {
    this.id = id;
    this.userId = userId;
    this.organizationId = organizationId;
    this.status = status;
    this.currentStep = currentStep;
    this.totalSteps = totalSteps;
    this.documents = documents;
    this.statutes = statutes;
    this.electoralCommission = electoralCommission;
    this.reviewComments = reviewComments;
    this.submittedAt = submittedAt;
    this.reviewedAt = reviewedAt;
    this.reviewedBy = reviewedBy;
    this.approvalDate = approvalDate;
    this.rejectionReason = rejectionReason;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Avanza al siguiente paso del wizard
   */
  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.updatedAt = new Date();
    }
  }

  /**
   * Retrocede al paso anterior del wizard
   */
  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updatedAt = new Date();
    }
  }

  /**
   * Va a un paso específico
   */
  goToStep(step) {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
      this.updatedAt = new Date();
    } else {
      throw new Error('Paso inválido');
    }
  }

  /**
   * Calcula el progreso de la aplicación (porcentaje)
   */
  getProgress() {
    return Math.round((this.currentStep / this.totalSteps) * 100);
  }

  /**
   * Verifica si la aplicación está completa
   */
  isComplete() {
    return this.currentStep === this.totalSteps && this.hasAllRequiredDocuments();
  }

  /**
   * Verifica si tiene todos los documentos requeridos
   */
  hasAllRequiredDocuments() {
    const requiredDocTypes = [
      'ACTA_CONSTITUTIVA',
      'ESTATUTOS',
      'REGISTRO_SOCIOS',
      'DECLARACION_JURADA_PRESIDENTE',
      'CERTIFICADO_ANTECEDENTES'
    ];

    return requiredDocTypes.every(docType =>
      this.documents.some(doc => doc.type === docType && doc.status === 'APPROVED')
    );
  }

  /**
   * Agrega un documento a la aplicación
   */
  addDocument(document) {
    this.documents.push(document);
    this.updatedAt = new Date();
  }

  /**
   * Remueve un documento de la aplicación
   */
  removeDocument(documentId) {
    const index = this.documents.findIndex(doc => doc.id === documentId);
    if (index !== -1) {
      this.documents.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  /**
   * Cambia el estado de la aplicación
   */
  changeStatus(newStatus, reason = null, reviewedBy = null) {
    const validStatuses = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REQUIRES_CHANGES'];

    if (!validStatuses.includes(newStatus)) {
      throw new Error('Estado inválido');
    }

    this.status = newStatus;
    this.updatedAt = new Date();

    if (newStatus === 'SUBMITTED') {
      this.submittedAt = new Date();
    }

    if (['APPROVED', 'REJECTED', 'REQUIRES_CHANGES'].includes(newStatus)) {
      this.reviewedAt = new Date();
      this.reviewedBy = reviewedBy;
    }

    if (newStatus === 'APPROVED') {
      this.approvalDate = new Date();
    }

    if (newStatus === 'REJECTED') {
      this.rejectionReason = reason;
    }
  }

  /**
   * Agrega un comentario de revisión
   */
  addReviewComment(comment, author) {
    this.reviewComments.push({
      text: comment,
      author: author,
      createdAt: new Date()
    });
    this.updatedAt = new Date();
  }

  /**
   * Verifica si puede ser enviada
   */
  canBeSubmitted() {
    return this.status === 'DRAFT' && this.isComplete();
  }

  /**
   * Verifica si puede ser editada
   */
  canBeEdited() {
    return ['DRAFT', 'REQUIRES_CHANGES'].includes(this.status);
  }

  /**
   * Verifica si está pendiente de revisión
   */
  isPendingReview() {
    return ['SUBMITTED', 'UNDER_REVIEW'].includes(this.status);
  }

  /**
   * Establece los estatutos de la organización
   */
  setStatutes(statutes) {
    this.statutes = statutes;
    this.updatedAt = new Date();
  }

  /**
   * Establece la comisión electoral
   */
  setElectoralCommission(commission) {
    this.electoralCommission = commission;
    this.updatedAt = new Date();
  }

  /**
   * Calcula días desde la última actualización
   */
  daysSinceLastUpdate() {
    const now = new Date();
    const updated = new Date(this.updatedAt);
    const diffTime = Math.abs(now - updated);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      organizationId: this.organizationId,
      status: this.status,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      documents: this.documents.map(doc => doc.toJSON ? doc.toJSON() : doc),
      statutes: this.statutes,
      electoralCommission: this.electoralCommission,
      reviewComments: this.reviewComments,
      submittedAt: this.submittedAt,
      reviewedAt: this.reviewedAt,
      reviewedBy: this.reviewedBy,
      approvalDate: this.approvalDate,
      rejectionReason: this.rejectionReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
