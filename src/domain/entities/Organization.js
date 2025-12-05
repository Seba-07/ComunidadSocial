/**
 * Organization Entity
 * Representa una Junta de Vecinos u Organización Comunitaria según Ley 19.418
 */

// Tipos válidos de organizaciones
const VALID_ORG_TYPES = [
  // Territoriales
  'JUNTA_VECINOS', 'COMITE_VECINOS',
  // Funcionales
  'CLUB_DEPORTIVO', 'CLUB_ADULTO_MAYOR', 'CLUB_JUVENIL', 'CLUB_CULTURAL',
  'CENTRO_MADRES', 'CENTRO_PADRES', 'CENTRO_CULTURAL',
  'AGRUPACION_FOLCLORICA', 'AGRUPACION_CULTURAL', 'AGRUPACION_JUVENIL', 'AGRUPACION_AMBIENTAL',
  'COMITE_VIVIENDA', 'COMITE_ALLEGADOS', 'COMITE_APR',
  'ORG_SCOUT', 'ORG_MUJERES', 'GRUPO_TEATRO', 'CORO', 'TALLER_ARTESANIA',
  'OTRA_FUNCIONAL'
];

export class Organization {
  constructor({
    id = null,
    name,
    type, // Tipo específico de organización (ver VALID_ORG_TYPES)
    description,
    address,
    commune,
    neighborhood, // Unidad vecinal
    email,
    phone,
    objectives = [],
    members = [],
    minimumMembers = null, // Se calcula automáticamente
    status = 'DRAFT', // 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE'
    foundingDate = null,
    approvalDate = null,
    rejectionReason = null,
    createdBy
  }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.description = description;
    this.address = address;
    this.commune = commune;
    this.neighborhood = neighborhood;
    this.email = email;
    this.phone = phone;
    this.objectives = objectives;
    this.members = members;
    // Quórum según Ley 19.418 actualizada:
    // - Junta de Vecinos: 200 personas mínimo (Renca)
    // - Otras organizaciones: 15 personas mínimo
    this.minimumMembers = minimumMembers || (type === 'JUNTA_VECINOS' ? 200 : 15);
    this.status = status;
    this.foundingDate = foundingDate;
    this.approvalDate = approvalDate;
    this.rejectionReason = rejectionReason;
    this.createdBy = createdBy;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Valida que la organización cumpla con requisitos mínimos
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.trim().length < 5) {
      errors.push('El nombre debe tener al menos 5 caracteres');
    }

    if (!VALID_ORG_TYPES.includes(this.type)) {
      errors.push('Tipo de organización inválido');
    }

    if (!this.address || this.address.trim().length < 10) {
      errors.push('Dirección inválida');
    }

    if (!this.commune) {
      errors.push('Comuna requerida');
    }

    if (this.type === 'JUNTA_VECINOS' && !this.neighborhood) {
      errors.push('Unidad vecinal requerida para Junta de Vecinos');
    }

    if (!this.email || !this.email.includes('@')) {
      errors.push('Email inválido');
    }

    if (this.objectives.length === 0) {
      errors.push('Debe definir al menos un objetivo');
    }

    if (!this.hasMinimumMembers()) {
      errors.push(`Se requieren al menos ${this.minimumMembers} miembros`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Verifica si cumple con el número mínimo de miembros
   */
  hasMinimumMembers() {
    return this.members.length >= this.minimumMembers;
  }

  /**
   * Agrega un miembro a la organización
   */
  addMember(member) {
    if (!member.id) {
      throw new Error('El miembro debe tener un ID');
    }

    const exists = this.members.find(m => m.id === member.id);
    if (exists) {
      throw new Error('El miembro ya está registrado');
    }

    this.members.push(member);
    this.updatedAt = new Date();
  }

  /**
   * Remueve un miembro de la organización
   */
  removeMember(memberId) {
    const index = this.members.findIndex(m => m.id === memberId);
    if (index === -1) {
      throw new Error('Miembro no encontrado');
    }

    this.members.splice(index, 1);
    this.updatedAt = new Date();
  }

  /**
   * Cambia el estado de la organización
   */
  changeStatus(newStatus, reason = null) {
    const validStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE'];

    if (!validStatuses.includes(newStatus)) {
      throw new Error('Estado inválido');
    }

    this.status = newStatus;
    this.updatedAt = new Date();

    if (newStatus === 'APPROVED') {
      this.approvalDate = new Date();
    }

    if (newStatus === 'REJECTED') {
      this.rejectionReason = reason;
    }
  }

  /**
   * Verifica si la organización está activa
   */
  isActive() {
    return this.status === 'ACTIVE';
  }

  /**
   * Verifica si la organización puede ser editada
   */
  canBeEdited() {
    return ['DRAFT', 'REJECTED'].includes(this.status);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: this.description,
      address: this.address,
      commune: this.commune,
      neighborhood: this.neighborhood,
      email: this.email,
      phone: this.phone,
      objectives: this.objectives,
      members: this.members,
      minimumMembers: this.minimumMembers,
      status: this.status,
      foundingDate: this.foundingDate,
      approvalDate: this.approvalDate,
      rejectionReason: this.rejectionReason,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * OrganizationMember Entity
 * Representa un miembro de la organización
 */
export class OrganizationMember {
  constructor({
    id,
    rut,
    firstName,
    lastName,
    email,
    phone,
    address,
    joinDate = new Date(),
    role = 'MEMBER', // 'MEMBER' | 'BOARD_MEMBER' | 'PRESIDENT' | 'SECRETARY' | 'TREASURER'
    isFoundingMember = false
  }) {
    this.id = id;
    this.rut = rut;
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.phone = phone;
    this.address = address;
    this.joinDate = joinDate;
    this.role = role;
    this.isFoundingMember = isFoundingMember;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  /**
   * Calcula antigüedad en la organización (en años)
   */
  getSeniority() {
    const today = new Date();
    const joined = new Date(this.joinDate);
    return today.getFullYear() - joined.getFullYear();
  }

  /**
   * Verifica si tiene antigüedad mínima (1 año) para ser parte de Comisión Electoral
   */
  hasMinimumSeniority() {
    return this.getSeniority() >= 1;
  }

  isBoardMember() {
    return ['BOARD_MEMBER', 'PRESIDENT', 'SECRETARY', 'TREASURER'].includes(this.role);
  }

  toJSON() {
    return {
      id: this.id,
      rut: this.rut,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      address: this.address,
      joinDate: this.joinDate,
      role: this.role,
      isFoundingMember: this.isFoundingMember
    };
  }
}
