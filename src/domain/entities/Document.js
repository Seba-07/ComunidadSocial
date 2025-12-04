/**
 * Document Entity
 * Representa un documento adjunto a una solicitud
 */
export class Document {
  constructor({
    id = null,
    applicationId,
    type, // 'ACTA_CONSTITUTIVA' | 'ESTATUTOS' | 'REGISTRO_SOCIOS' | 'DECLARACION_JURADA_PRESIDENTE' | 'CERTIFICADO_ANTECEDENTES' | 'OTHER'
    name,
    fileName,
    fileURL,
    fileSize,
    mimeType,
    status = 'PENDING', // 'PENDING' | 'APPROVED' | 'REJECTED'
    uploadedBy,
    reviewedBy = null,
    reviewComments = null,
    isRequired = true
  }) {
    this.id = id;
    this.applicationId = applicationId;
    this.type = type;
    this.name = name;
    this.fileName = fileName;
    this.fileURL = fileURL;
    this.fileSize = fileSize;
    this.mimeType = mimeType;
    this.status = status;
    this.uploadedBy = uploadedBy;
    this.reviewedBy = reviewedBy;
    this.reviewComments = reviewComments;
    this.isRequired = isRequired;
    this.uploadedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Tipos de documentos requeridos según Ley 19.418
   */
  static DOCUMENT_TYPES = {
    ACTA_CONSTITUTIVA: {
      name: 'Acta Constitutiva',
      description: 'Acta de la asamblea constitutiva con firmas de los asistentes',
      required: true
    },
    ESTATUTOS: {
      name: 'Estatutos',
      description: 'Estatutos de la organización aprobados en asamblea',
      required: true
    },
    REGISTRO_SOCIOS: {
      name: 'Registro de Socios',
      description: 'Listado completo de socios con datos personales',
      required: true
    },
    DECLARACION_JURADA_PRESIDENTE: {
      name: 'Declaración Jurada del Presidente',
      description: 'Declaración jurada simple del presidente electo',
      required: true
    },
    CERTIFICADO_ANTECEDENTES: {
      name: 'Certificado de Antecedentes',
      description: 'Certificados de antecedentes de los directores electos',
      required: true
    },
    ACTA_COMISION_ELECTORAL: {
      name: 'Acta de Comisión Electoral',
      description: 'Acta de establecimiento de la comisión electoral',
      required: false
    },
    OTHER: {
      name: 'Otro Documento',
      description: 'Documento adicional',
      required: false
    }
  };

  /**
   * Valida el documento
   */
  validate() {
    const errors = [];

    if (!this.type || !Document.DOCUMENT_TYPES[this.type]) {
      errors.push('Tipo de documento inválido');
    }

    if (!this.fileName || this.fileName.trim().length === 0) {
      errors.push('Nombre de archivo requerido');
    }

    if (!this.fileURL) {
      errors.push('URL del archivo requerida');
    }

    if (!this.mimeType) {
      errors.push('Tipo MIME requerido');
    }

    if (!this.isValidFileType()) {
      errors.push('Tipo de archivo no permitido. Solo se permiten PDF, DOC, DOCX, JPG, PNG');
    }

    if (this.fileSize && this.fileSize > 10 * 1024 * 1024) { // 10MB
      errors.push('El archivo no debe superar los 10MB');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Verifica si el tipo de archivo es válido
   */
  isValidFileType() {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];
    return allowedTypes.includes(this.mimeType);
  }

  /**
   * Obtiene la extensión del archivo
   */
  getFileExtension() {
    return this.fileName.split('.').pop().toLowerCase();
  }

  /**
   * Formatea el tamaño del archivo
   */
  getFormattedSize() {
    if (!this.fileSize) return 'Desconocido';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = this.fileSize;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Cambia el estado del documento
   */
  changeStatus(newStatus, reviewedBy = null, comments = null) {
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];

    if (!validStatuses.includes(newStatus)) {
      throw new Error('Estado inválido');
    }

    this.status = newStatus;
    this.reviewedBy = reviewedBy;
    this.reviewComments = comments;
    this.updatedAt = new Date();
  }

  /**
   * Verifica si el documento está aprobado
   */
  isApproved() {
    return this.status === 'APPROVED';
  }

  /**
   * Verifica si el documento está rechazado
   */
  isRejected() {
    return this.status === 'REJECTED';
  }

  /**
   * Verifica si el documento está pendiente de revisión
   */
  isPending() {
    return this.status === 'PENDING';
  }

  /**
   * Obtiene información del tipo de documento
   */
  getTypeInfo() {
    return Document.DOCUMENT_TYPES[this.type] || Document.DOCUMENT_TYPES.OTHER;
  }

  toJSON() {
    return {
      id: this.id,
      applicationId: this.applicationId,
      type: this.type,
      name: this.name,
      fileName: this.fileName,
      fileURL: this.fileURL,
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      status: this.status,
      uploadedBy: this.uploadedBy,
      reviewedBy: this.reviewedBy,
      reviewComments: this.reviewComments,
      isRequired: this.isRequired,
      uploadedAt: this.uploadedAt,
      updatedAt: this.updatedAt
    };
  }
}
