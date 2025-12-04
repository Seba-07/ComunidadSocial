/**
 * ElectoralCommission Entity
 * Representa la Comisión Electoral de una organización comunitaria
 * Según Ley 19.418, debe estar integrada por 3 miembros con al menos 1 año de antigüedad
 */
export class ElectoralCommission {
  constructor({
    id = null,
    organizationId,
    members = [],
    establishedAt = null,
    electionDate = null,
    status = 'DRAFT', // 'DRAFT' | 'ACTIVE' | 'COMPLETED'
    minutes = null // Acta de establecimiento
  }) {
    this.id = id;
    this.organizationId = organizationId;
    this.members = members;
    this.establishedAt = establishedAt;
    this.electionDate = electionDate;
    this.status = status;
    this.minutes = minutes;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Valida que la comisión cumpla con los requisitos legales
   */
  validate() {
    const errors = [];

    // Debe tener exactamente 3 miembros
    if (this.members.length !== 3) {
      errors.push('La Comisión Electoral debe estar integrada por exactamente 3 miembros');
    }

    // Todos los miembros deben tener al menos 1 año de antigüedad
    const membersWithoutSeniority = this.members.filter(member => !member.hasMinimumSeniority);
    if (membersWithoutSeniority.length > 0) {
      errors.push('Todos los miembros deben tener al menos 1 año de antigüedad en la organización');
    }

    // Los miembros no pueden ser parte del directorio
    const boardMembers = this.members.filter(member => member.isBoardMember);
    if (boardMembers.length > 0) {
      errors.push('Los miembros de la Comisión Electoral no pueden ser parte del directorio');
    }

    if (!this.electionDate) {
      errors.push('Fecha de elección requerida');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Agrega un miembro a la comisión
   */
  addMember(member) {
    if (this.members.length >= 3) {
      throw new Error('La Comisión Electoral solo puede tener 3 miembros');
    }

    if (!member.hasMinimumSeniority) {
      throw new Error('El miembro debe tener al menos 1 año de antigüedad');
    }

    if (member.isBoardMember) {
      throw new Error('El miembro no puede ser parte del directorio');
    }

    const exists = this.members.find(m => m.id === member.id);
    if (exists) {
      throw new Error('El miembro ya está en la comisión');
    }

    this.members.push(member);
    this.updatedAt = new Date();
  }

  /**
   * Remueve un miembro de la comisión
   */
  removeMember(memberId) {
    const index = this.members.findIndex(m => m.id === memberId);
    if (index === -1) {
      throw new Error('Miembro no encontrado en la comisión');
    }

    this.members.splice(index, 1);
    this.updatedAt = new Date();
  }

  /**
   * Establece la comisión (activa)
   */
  establish() {
    const validation = this.validate();
    if (!validation.isValid) {
      throw new Error(`No se puede establecer la comisión: ${validation.errors.join(', ')}`);
    }

    this.status = 'ACTIVE';
    this.establishedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Verifica si la comisión está completa (3 miembros)
   */
  isComplete() {
    return this.members.length === 3;
  }

  /**
   * Verifica si la comisión está activa
   */
  isActive() {
    return this.status === 'ACTIVE';
  }

  /**
   * Marca la comisión como completada (después de la elección)
   */
  complete() {
    if (!this.isActive()) {
      throw new Error('La comisión debe estar activa para ser completada');
    }

    this.status = 'COMPLETED';
    this.updatedAt = new Date();
  }

  /**
   * Establece el acta de establecimiento
   */
  setMinutes(minutes) {
    this.minutes = minutes;
    this.updatedAt = new Date();
  }

  /**
   * Verifica si debe establecerse (2 meses antes de la elección)
   */
  shouldBeEstablished() {
    if (!this.electionDate) return false;

    const today = new Date();
    const election = new Date(this.electionDate);
    const twoMonthsBefore = new Date(election);
    twoMonthsBefore.setMonth(twoMonthsBefore.getMonth() - 2);

    return today >= twoMonthsBefore;
  }

  /**
   * Calcula días hasta la elección
   */
  daysUntilElection() {
    if (!this.electionDate) return null;

    const today = new Date();
    const election = new Date(this.electionDate);
    const diffTime = election - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      members: this.members.map(m => m.toJSON ? m.toJSON() : m),
      establishedAt: this.establishedAt,
      electionDate: this.electionDate,
      status: this.status,
      minutes: this.minutes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * CommissionMember Entity
 * Representa un miembro de la Comisión Electoral
 */
export class CommissionMember {
  constructor({
    id,
    rut,
    firstName,
    lastName,
    email,
    phone,
    joinDate,
    role = 'MEMBER', // 'PRESIDENT' | 'SECRETARY' | 'MEMBER'
    hasMinimumSeniority = false,
    isBoardMember = false
  }) {
    this.id = id;
    this.rut = rut;
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.phone = phone;
    this.joinDate = joinDate;
    this.role = role;
    this.hasMinimumSeniority = hasMinimumSeniority;
    this.isBoardMember = isBoardMember;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  toJSON() {
    return {
      id: this.id,
      rut: this.rut,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      joinDate: this.joinDate,
      role: this.role,
      hasMinimumSeniority: this.hasMinimumSeniority,
      isBoardMember: this.isBoardMember
    };
  }
}
