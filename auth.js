/**
 * Authentication Page Script
 * Maneja login y registro de usuarios usando la API
 */

import { apiService } from './src/services/ApiService.js';

console.log('🔐 Auth page loaded');

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
  const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();

  if (cleanRut.length < 8 || cleanRut.length > 9) return false;

  const body = cleanRut.slice(0, -1);
  const digit = cleanRut.slice(-1);

  if (!/^\d+$/.test(body)) return false;
  if (!/^[\dK]$/.test(digit)) return false;

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
  rut = rut.replace(/\./g, '').replace(/-/g, '');

  if (rut.length < 2) return rut;

  const body = rut.slice(0, -1);
  const digit = rut.slice(-1);

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
    const result = await apiService.login(email, password);
    const user = result.user;

    if (!user) {
      throw new Error('Error de autenticación');
    }

    console.log('✅ Login successful:', user);

    // Redirigir según el rol del usuario
    if (user.role === 'MINISTRO') {
      // Es un ministro de fe - guardar en currentMinistro y redirigir al dashboard de ministro
      localStorage.removeItem('currentUser'); // Limpiar por si acaso
      localStorage.setItem('currentMinistro', JSON.stringify(user));
      localStorage.setItem('isMinistroAuthenticated', 'true');

      showToast(`¡Bienvenido ${user.firstName}!`, 'success');

      if (user.mustChangePassword) {
        setTimeout(() => {
          window.location.href = '/ministro-dashboard.html?changePassword=true';
        }, 500);
      } else {
        setTimeout(() => {
          window.location.href = '/ministro-dashboard.html';
        }, 500);
      }
    } else if (user.role === 'ADMIN') {
      // Es un admin - redirigir al panel de admin
      localStorage.setItem('isAuthenticated', 'true');

      showToast(`¡Bienvenido Administrador ${user.firstName || 'Admin'}!`, 'success');

      setTimeout(() => {
        window.location.href = '/?admin=true';
      }, 500);
    } else {
      // Es un usuario normal
      localStorage.setItem('isAuthenticated', 'true');

      showToast(`¡Bienvenido ${user.firstName || user.profile?.firstName || 'Usuario'}!`, 'success');

      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    }

  } catch (error) {
    console.error('❌ Login error:', error);

    if (error.message.includes('no encontrado') || error.message.includes('Usuario') || error.message.includes('Credenciales inválidas') || error.message.includes('inválidas')) {
      showError('login-email', 'Correo o contraseña incorrectos');
      showError('login-password', 'Correo o contraseña incorrectos');
    } else if (error.message.includes('contraseña') || error.message.includes('Contraseña')) {
      showError('login-password', 'Contraseña incorrecta');
    } else if (error.message.includes('desactivada') || error.message.includes('inactivo')) {
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
    const userData = {
      rut,
      firstName,
      lastName,
      email,
      password
    };

    const result = await apiService.register(userData);

    console.log('✅ User registered successfully:', result.user);

    localStorage.setItem('isAuthenticated', 'true');

    showToast('¡Cuenta creada exitosamente! Redirigiendo...', 'success');

    setTimeout(() => {
      window.location.href = '/';
    }, 1500);

  } catch (error) {
    console.error('❌ Register error:', error);

    if (error.message.includes('email') || error.message.includes('Email')) {
      showError('register-email', error.message);
    } else if (error.message.includes('RUT') || error.message.includes('rut')) {
      showError('register-rut', error.message);
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
// Note: In production with a real backend, this would send a reset email
// For now, we show a message to contact the administrator

const forgotPasswordLink = document.getElementById('forgot-password-link');
const forgotPasswordModal = document.getElementById('forgot-password-modal');
const closeModalBtn = document.getElementById('close-modal');
const recoverPasswordForm = document.getElementById('recover-password-form');
const passwordResult = document.getElementById('password-result');

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

  submitBtn.textContent = 'Procesando...';
  submitBtn.disabled = true;

  // Show message to contact administrator
  passwordResult.innerHTML = `
    <p style="margin: 0 0 12px 0; color: #065f46; font-weight: 600; font-size: 16px;">📧 Recuperación de contraseña</p>
    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
      Para recuperar tu contraseña, por favor contacta al administrador del sistema en:<br><br>
      <strong>Email:</strong> admin@renca.cl<br>
      <strong>Teléfono:</strong> +56 2 2345 6789<br><br>
      Proporciona tu email registrado: <strong>${email}</strong>
    </p>
  `;
  passwordResult.style.display = 'block';
  passwordResult.style.background = '#fef3c7';
  passwordResult.style.borderColor = '#fbbf24';

  submitBtn.textContent = originalText;
  submitBtn.disabled = false;
});
