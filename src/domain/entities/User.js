/**
 * User Entity
 * Representa un usuario del sistema (Ciudadano o Administrador Municipal)
 */
export class User {
  constructor({
    id = null,
    email,
    password,
    role, // 'USER' | 'ADMIN'
    profile
  }) {
    this.id = id;
    this.email = email;
    this.password = password;
    this.role = role;
    this.profile = profile;
    this.createdAt = new Date();
  }

  /**
   * Valida que el usuario tenga los datos mínimos requeridos
   */
  validate() {
    const errors = [];

    if (!this.email || !this.email.includes('@')) {
      errors.push('Email inválido');
    }

    if (!this.password || this.password.length < 6) {
      errors.push('La contraseña debe tener al menos 6 caracteres');
    }

    if (!['USER', 'ADMIN'].includes(this.role)) {
      errors.push('Rol inválido');
    }

    if (!this.profile) {
      errors.push('Perfil requerido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Verifica si el usuario es administrador
   */
  isAdmin() {
    return this.role === 'ADMIN';
  }

  /**
   * Convierte la entidad a objeto plano (para persistencia)
   */
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      role: this.role,
      profile: this.profile,
      createdAt: this.createdAt
    };
  }
}

/**
 * UserProfile Entity
 * Información personal del usuario
 */
export class UserProfile {
  constructor({
    rut,
    firstName,
    lastName,
    phone,
    address,
    commune,
    birthDate
  }) {
    this.rut = rut;
    this.firstName = firstName;
    this.lastName = lastName;
    this.phone = phone;
    this.address = address;
    this.commune = commune;
    this.birthDate = birthDate;
  }

  /**
   * Valida RUT chileno (formato básico)
   */
  validateRut() {
    const rutPattern = /^[0-9]+-[0-9kK]{1}$/;
    return rutPattern.test(this.rut);
  }

  /**
   * Calcula edad del usuario
   */
  getAge() {
    if (!this.birthDate) return null;
    const today = new Date();
    const birth = new Date(this.birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Verifica si tiene edad mínima para ser miembro (14 años según Ley 19.418)
   */
  hasMinimumAge() {
    return this.getAge() >= 14;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  validate() {
    const errors = [];

    if (!this.validateRut()) {
      errors.push('RUT inválido');
    }

    if (!this.firstName || this.firstName.trim().length < 2) {
      errors.push('Nombre inválido');
    }

    if (!this.lastName || this.lastName.trim().length < 2) {
      errors.push('Apellido inválido');
    }

    if (!this.phone || this.phone.length < 9) {
      errors.push('Teléfono inválido');
    }

    if (!this.commune) {
      errors.push('Comuna requerida');
    }

    if (!this.hasMinimumAge()) {
      errors.push('Debe tener al menos 14 años para ser miembro de una organización comunitaria');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  toJSON() {
    return {
      rut: this.rut,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone,
      address: this.address,
      commune: this.commune,
      birthDate: this.birthDate
    };
  }
}
