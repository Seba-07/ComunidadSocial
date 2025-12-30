/**
 * MockAuthService
 * Servicio de autenticación simulado para desarrollo local
 */
export class MockAuthService {
  constructor(userRepository) {
    this.userRepository = userRepository;
    this.currentUser = null;
    this.sessionKey = 'mock_auth_session';

    // Restaurar sesión si existe
    this.restoreSession();
  }

  /**
   * Inicia sesión
   */
  async login(email, password) {
    const user = await this.userRepository.authenticate(email, password);

    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    this.currentUser = user;
    this.saveSession(user);

    return user;
  }

  /**
   * Registra un nuevo usuario
   */
  async register(userData) {
    // Verificar si el email ya existe
    const exists = await this.userRepository.existsByEmail(userData.email);
    if (exists) {
      throw new Error('El email ya está registrado');
    }

    // Crear el usuario
    const user = await this.userRepository.create(userData);

    // No devolver la contraseña
    const { password, ...userWithoutPassword } = user;

    this.currentUser = userWithoutPassword;
    this.saveSession(userWithoutPassword);

    return userWithoutPassword;
  }

  /**
   * Cierra sesión
   */
  async logout() {
    this.currentUser = null;
    localStorage.removeItem(this.sessionKey);
  }

  /**
   * Obtiene el usuario actual
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Verifica si hay un usuario autenticado
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * Verifica si el usuario actual es admin
   */
  isAdmin() {
    return this.currentUser?.role === 'MUNICIPALIDAD';
  }

  /**
   * Verifica si el usuario actual es ministro de fe
   */
  isMinistro() {
    return this.currentUser?.role === 'MINISTRO_FE';
  }

  /**
   * Verifica si el usuario actual es organizador
   */
  isOrganizador() {
    return this.currentUser?.role === 'ORGANIZADOR';
  }

  /**
   * Verifica si el usuario actual es miembro
   */
  isMiembro() {
    return this.currentUser?.role === 'MIEMBRO';
  }

  /**
   * Obtiene el rol del usuario actual
   */
  getUserRole() {
    return this.currentUser?.role || null;
  }

  /**
   * Guarda la sesión en localStorage
   */
  saveSession(user) {
    localStorage.setItem(this.sessionKey, JSON.stringify(user));
  }

  /**
   * Restaura la sesión desde localStorage
   */
  restoreSession() {
    try {
      const sessionData = localStorage.getItem(this.sessionKey);
      if (sessionData) {
        this.currentUser = JSON.parse(sessionData);
      }
    } catch (error) {
      console.error('Error al restaurar sesión:', error);
      localStorage.removeItem(this.sessionKey);
    }
  }

  /**
   * Actualiza el perfil del usuario actual
   */
  async updateProfile(updates) {
    if (!this.currentUser) {
      throw new Error('No hay usuario autenticado');
    }

    const updatedUser = await this.userRepository.update(
      this.currentUser.id,
      updates
    );

    const { password, ...userWithoutPassword } = updatedUser;
    this.currentUser = userWithoutPassword;
    this.saveSession(userWithoutPassword);

    return userWithoutPassword;
  }
}
