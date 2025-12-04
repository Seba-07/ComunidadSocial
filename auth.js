/**
 * Authentication Page Script
 * Maneja login y registro de usuarios
 */

import { initializeApp } from './src/app.js';
import { container } from './src/infrastructure/config/container.js';

console.log('🔐 Auth page loaded');

// Inicializar app
await initializeApp();

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    animation: slideInRight 0.3s ease;
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Validar RUT chileno (formato y dígito verificador)
function validateRut(rut) {
  // Eliminar puntos y guión
  const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();

  // Verificar longitud mínima (7 dígitos + 1 verificador)
  if (cleanRut.length < 8 || cleanRut.length > 9) return false;

  const body = cleanRut.slice(0, -1);
  const digit = cleanRut.slice(-1);

  // Verificar que el cuerpo sean solo números
  if (!/^\d+$/.test(body)) return false;

  // Verificar que el dígito sea número o K
  if (!/^[\dK]$/.test(digit)) return false;

  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const calculatedDigit = 11 - remainder;

  let expectedDigit;
  if (calculatedDigit === 11) {
    expectedDigit = '0';
  } else if (calculatedDigit === 10) {
    expectedDigit = 'K';
  } else {
    expectedDigit = calculatedDigit.toString();
  }

  return digit === expectedDigit;
}

// Format RUT
function formatRut(rut) {
  // Remove existing formatting
  rut = rut.replace(/\./g, '').replace(/-/g, '');

  if (rut.length < 2) return rut;

  const body = rut.slice(0, -1);
  const digit = rut.slice(-1);

  // Add dots every 3 digits
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${formattedBody}-${digit}`;
}

// Tab switching
const tabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('.auth-form');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;

    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    forms.forEach(f => f.classList.remove('active'));
    document.getElementById(`${targetTab}-form`).classList.add('active');
  });
});

// Format RUT input
const rutInput = document.getElementById('register-rut');
if (rutInput) {
  rutInput.addEventListener('input', (e) => {
    const value = e.target.value.replace(/\./g, '').replace(/-/g, '');
    if (value) {
      e.target.value = formatRut(value);
    }
  });
}

// Login Form
const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('login-submit');
  const originalText = submitBtn.textContent;

  // Clear previous errors
  document.querySelectorAll('#login-form .error-message').forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });
  document.querySelectorAll('#login-form input').forEach(el => el.classList.remove('error'));

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  // Validate inputs
  let hasErrors = false;

  if (!email) {
    showError('login-email', 'El email es requerido');
    hasErrors = true;
  } else if (!email.includes('@') || !email.includes('.')) {
    showError('login-email', 'Ingresa un email válido');
    hasErrors = true;
  }

  if (!password) {
    showError('login-password', 'La contraseña es requerida');
    hasErrors = true;
  }

  if (hasErrors) {
    return;
  }

  submitBtn.textContent = 'Iniciando sesión...';
  submitBtn.disabled = true;

  try {
    // Get auth service
    const authService = container.get('authService');

    let user = null;
    let isMinistro = false;

    // Primero intentar login como usuario/admin
    try {
      user = await authService.login(email, password);
      console.log('✅ Login successful as USER/ADMIN:', user);
    } catch (userError) {
      // Si falla, intentar como ministro
      console.log('User login failed, trying ministro...');

      try {
        const { ministroService } = await import('./src/services/MinistroService.js');
        user = ministroService.authenticate(email, password);
        isMinistro = true;
        console.log('✅ Login successful as MINISTRO:', user);
      } catch (ministroError) {
        // Si ambos fallan, lanzar el error original
        throw userError;
      }
    }

    if (!user) {
      throw new Error('Error de autenticación');
    }

    // Save to localStorage según el tipo de usuario
    if (isMinistro) {
      localStorage.setItem('currentMinistro', JSON.stringify(user));
      localStorage.setItem('isMinistroAuthenticated', 'true');

      showToast(`¡Bienvenido ${user.firstName}!`, 'success');

      // Redirigir al dashboard de ministro
      if (user.mustChangePassword) {
        setTimeout(() => {
          window.location.href = '/ministro-dashboard.html?changePassword=true';
        }, 500);
      } else {
        setTimeout(() => {
          window.location.href = '/ministro-dashboard.html';
        }, 500);
      }
    } else {
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('isAuthenticated', 'true');

      showToast(`¡Bienvenido ${user.profile?.firstName || 'Usuario'}!`, 'success');

      // Redirigir al dashboard principal (admin o user)
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    }

  } catch (error) {
    console.error('❌ Login error:', error);

    // Show error in form
    if (error.message.includes('no encontrado') || error.message.includes('Usuario') || error.message.includes('Credenciales inválidas')) {
      showError('login-email', 'Correo o contraseña incorrectos');
      showError('login-password', 'Correo o contraseña incorrectos');
    } else if (error.message.includes('contraseña') || error.message.includes('Contraseña')) {
      showError('login-password', 'Contraseña incorrecta');
    } else if (error.message.includes('desactivada')) {
      showToast(error.message, 'error');
    } else {
      showToast(error.message || 'Error al iniciar sesión', 'error');
    }

    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Register Form
const registerForm = document.getElementById('register-form');
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('register-submit');
  const originalText = submitBtn.textContent;

  // Get form values
  const firstName = document.getElementById('register-name').value.trim();
  const lastName = document.getElementById('register-lastname').value.trim();
  const rut = document.getElementById('register-rut').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const passwordConfirm = document.getElementById('register-password-confirm').value;

  // Clear previous errors
  document.querySelectorAll('#register-form .error-message').forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });
  document.querySelectorAll('#register-form input').forEach(el => el.classList.remove('error'));

  // Validate
  let hasErrors = false;

  if (firstName.length < 2) {
    showError('register-name', 'El nombre debe tener al menos 2 caracteres');
    hasErrors = true;
  }

  if (lastName.length < 2) {
    showError('register-lastname', 'El apellido debe tener al menos 2 caracteres');
    hasErrors = true;
  }

  if (!validateRut(rut)) {
    showError('register-rut', 'RUT inválido');
    hasErrors = true;
  }

  if (!email.includes('@') || !email.includes('.')) {
    showError('register-email', 'Email inválido');
    hasErrors = true;
  }

  if (password.length < 6) {
    showError('register-password', 'La contraseña debe tener al menos 6 caracteres');
    hasErrors = true;
  }

  if (password !== passwordConfirm) {
    showError('register-password-confirm', 'Las contraseñas no coinciden');
    hasErrors = true;
  }

  if (hasErrors) {
    return;
  }

  submitBtn.textContent = 'Creando cuenta...';
  submitBtn.disabled = true;

  try {
    // Get auth service
    const authService = container.get('authService');

    // Create user data
    const userData = {
      email,
      password,
      role: 'USER',
      profile: {
        firstName,
        lastName,
        rut,
        phone: '',
        address: ''
      }
    };

    // Register user (creates and logs in automatically)
    const user = await authService.register(userData);

    console.log('✅ User registered successfully:', user);

    // Save to localStorage
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('isAuthenticated', 'true');

    showToast('¡Cuenta creada exitosamente! Redirigiendo...', 'success');

    // Redirect to main app
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);

  } catch (error) {
    console.error('❌ Register error:', error);

    // Show specific errors
    if (error.message.includes('email') || error.message.includes('Email')) {
      showError('register-email', error.message);
    } else {
      showToast(error.message || 'Error al crear la cuenta', 'error');
    }

    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

function showError(inputId, message) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(`${inputId}-error`);

  if (input) input.classList.add('error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }
}

// CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// ===== FORGOT PASSWORD FUNCTIONALITY =====

const forgotPasswordLink = document.getElementById('forgot-password-link');
const forgotPasswordModal = document.getElementById('forgot-password-modal');
const closeModalBtn = document.getElementById('close-modal');
const recoverPasswordForm = document.getElementById('recover-password-form');
const passwordResult = document.getElementById('password-result');
const passwordDisplay = document.getElementById('password-display');
const copyPasswordBtn = document.getElementById('copy-password');

// Open modal
forgotPasswordLink.addEventListener('click', (e) => {
  e.preventDefault();
  forgotPasswordModal.style.display = 'flex';
  passwordResult.style.display = 'none';
  document.getElementById('recover-email').value = '';
  document.getElementById('recover-email-error').classList.remove('show');
});

// Close modal
closeModalBtn.addEventListener('click', () => {
  forgotPasswordModal.style.display = 'none';
});

// Close modal clicking outside
forgotPasswordModal.addEventListener('click', (e) => {
  if (e.target === forgotPasswordModal) {
    forgotPasswordModal.style.display = 'none';
  }
});

// Recover password form
recoverPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('recover-submit');
  const originalText = submitBtn.textContent;
  const email = document.getElementById('recover-email').value.trim();

  // Clear previous errors
  document.getElementById('recover-email-error').classList.remove('show');
  document.getElementById('recover-email-error').textContent = '';
  document.getElementById('recover-email').classList.remove('error');
  passwordResult.style.display = 'none';

  // Validate email
  if (!email) {
    document.getElementById('recover-email-error').textContent = 'El email es requerido';
    document.getElementById('recover-email-error').classList.add('show');
    document.getElementById('recover-email').classList.add('error');
    return;
  }

  if (!email.includes('@') || !email.includes('.')) {
    document.getElementById('recover-email-error').textContent = 'Ingresa un email válido';
    document.getElementById('recover-email-error').classList.add('show');
    document.getElementById('recover-email').classList.add('error');
    return;
  }

  submitBtn.textContent = 'Buscando...';
  submitBtn.disabled = true;

  try {
    // Get auth service
    const authService = container.get('authService');
    const userRepository = container.get('userRepository');

    // DEBUG: Log all users
    const allUsers = await userRepository.findAll({ limit: 100 });
    console.log('📋 Todos los usuarios registrados:', allUsers);
    console.log('🔍 Buscando email:', email);

    // Find user by email
    const user = await userRepository.findByEmail(email);

    if (!user) {
      // Show available emails in error message
      const availableEmails = allUsers.users.map(u => u.email).slice(0, 3).join(', ');
      document.getElementById('recover-email-error').textContent = `No existe una cuenta con este email. Emails disponibles: ${availableEmails}...`;
      document.getElementById('recover-email-error').classList.add('show');
      document.getElementById('recover-email').classList.add('error');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      return;
    }

    // Show password
    passwordDisplay.textContent = user.password;
    passwordResult.style.display = 'block';

    showToast('¡Contraseña encontrada!', 'success');

  } catch (error) {
    console.error('❌ Recovery error:', error);
    showToast('Error al buscar la contraseña', 'error');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Copy password to clipboard
copyPasswordBtn.addEventListener('click', async () => {
  const password = passwordDisplay.textContent;

  try {
    await navigator.clipboard.writeText(password);
    copyPasswordBtn.textContent = '✓ Copiado';
    copyPasswordBtn.style.background = '#059669';

    setTimeout(() => {
      copyPasswordBtn.textContent = 'Copiar';
      copyPasswordBtn.style.background = '#10b981';
    }, 2000);

    showToast('Contraseña copiada al portapapeles', 'success');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showToast('No se pudo copiar. Copia manualmente.', 'error');
  }
});
