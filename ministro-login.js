/**
 * Ministro Login Page Script
 * Maneja login de Ministros de Fe
 */

import { ministroService } from './src/services/MinistroService.js';

console.log('⚖️ Ministro login page loaded');

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

// Show error in form
function showError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);

  input.classList.add('error');
  errorEl.textContent = message;
  errorEl.classList.add('show');
}

// Clear errors
function clearErrors() {
  document.querySelectorAll('.error-message').forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });
  document.querySelectorAll('input').forEach(el => el.classList.remove('error'));
}

// Check if already logged in
const currentMinistro = localStorage.getItem('currentMinistro');
if (currentMinistro) {
  try {
    const ministro = JSON.parse(currentMinistro);
    if (ministro.role === 'MINISTRO_FE') {
      window.location.href = '/ministro-dashboard.html';
    }
  } catch (e) {
    localStorage.removeItem('currentMinistro');
  }
}

// Login Form
const form = document.getElementById('ministro-login-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('login-btn');
  const originalText = btn.textContent;

  // Validate
  let hasErrors = false;

  if (!email) {
    showError('email', 'El correo es requerido');
    hasErrors = true;
  } else if (!email.includes('@')) {
    showError('email', 'Ingresa un correo válido');
    hasErrors = true;
  }

  if (!password) {
    showError('password', 'La contraseña es requerida');
    hasErrors = true;
  }

  if (hasErrors) return;

  btn.textContent = 'Verificando...';
  btn.disabled = true;

  try {
    const result = await ministroService.authenticate(email, password);

    console.log('✅ Ministro login successful:', result);

    // Save to localStorage
    localStorage.setItem('currentMinistro', JSON.stringify(result));
    localStorage.setItem('isMinistroAuthenticated', 'true');

    showToast(`¡Bienvenido ${result.firstName}!`, 'success');

    // Check if must change password
    if (result.mustChangePassword) {
      setTimeout(() => {
        window.location.href = '/ministro-dashboard.html?changePassword=true';
      }, 500);
    } else {
      setTimeout(() => {
        window.location.href = '/ministro-dashboard.html';
      }, 500);
    }

  } catch (error) {
    console.error('❌ Login error:', error);

    const errorMsg = error.message || 'Error al iniciar sesión';
    if (errorMsg.includes('Credenciales') || errorMsg.includes('inválidas')) {
      showError('password', 'Correo o contraseña incorrectos');
    } else {
      showToast(errorMsg, 'error');
    }

    btn.textContent = originalText;
    btn.disabled = false;
  }
});
