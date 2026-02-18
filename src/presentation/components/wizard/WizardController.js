/**
 * WizardController
 * Controla la lógica del wizard de creación de organizaciones
 */

import { getWizardHTML, getStep4HTML_Estatutos, getStep5HTML_Comision, getStep6HTML_Documentos } from './WizardHTML.js';
import { indexedDBService } from '../../../infrastructure/database/IndexedDBService.js';
import { showToast } from '../../../app.js';
import { CHILE_REGIONS } from '../../../data/chile-regions.js';
import { ESTATUTOS_TIPO, generarEstatutos, mapearTipoOrganizacion } from '../../../data/estatutosTipo.js';
import unidadesVecinalesService from '../../../services/UnidadesVecinalesService.js';
import { jsPDF } from 'jspdf';
import { apiService } from '../../../services/ApiService.js';

// Importar utilidades compartidas
import { getOrgType as getOrgTypeFromUtils } from '../../../shared/utils/index.js';
// SEGURIDAD: Importar funciones de sanitización para prevenir XSS
import { sanitizeText, escapeHtml } from '../../../shared/utils/sanitize.js';

// ============================================================================
// TIPOS DE ORGANIZACIÓN DINÁMICOS (con fallback a constantes locales)
// ============================================================================

// Tipos de organizaciones territoriales (FALLBACK)
const TERRITORIAL_TYPES_FALLBACK = {
  'JUNTA_VECINOS': 'Junta de Vecinos',
  'COMITE_VECINOS': 'Comité de Vecinos'
};

// Tipos de organizaciones funcionales (FALLBACK)
const FUNCIONAL_TYPES_FALLBACK = {
  'CLUB_ADULTO_MAYOR': 'Club de Adulto Mayor',
  'CENTRO_PADRES': 'Centro de Padres y Apoderados',
  'COMITE_ADELANTO': 'Comité de Adelanto',
  'ORG_CULTURAL': 'Organización Cultural',
  'CLUB_DEPORTIVO': 'Club Deportivo',
  'AGRUPACION_EMPRENDEDORES': 'Agrupación de Emprendedores',
  'AGRUPACION_FOLCLORICA': 'Agrupación Folclórica',
  'ORG_INDIGENA': 'Organización Indígena',
  'COMITE_MEJORAMIENTO': 'Comité de Mejoramiento',
  'ORG_MUJERES': 'Organización de Mujeres',
  'ORG_SALUD': 'Organización de Salud',
  'COMITE_CONVIVENCIA': 'Comité Vecinal de Prevención y Convivencia Comunitaria',
  'ORG_SOCIAL': 'Organización Social',
  'COMITE_VIVIENDA': 'Comité de Vivienda',
  'OTRA_FUNCIONAL': 'Otra'
};

// Cache de tipos desde API
let cachedOrganizationTypes = null;
let typesLoadPromise = null;

/**
 * Carga tipos de organización desde la API (con cache)
 * @returns {Promise<{territorial: Object, funcional: Object, all: Object}>}
 */
async function loadOrganizationTypes() {
  // Si ya está en cache, retornar
  if (cachedOrganizationTypes) {
    return cachedOrganizationTypes;
  }

  // Si ya hay una carga en progreso, esperar
  if (typesLoadPromise) {
    return typesLoadPromise;
  }

  // Iniciar carga
  typesLoadPromise = (async () => {
    try {
      const grouped = await apiService.getOrganizationTypesGrouped();

      // Procesar tipos territoriales
      const territorial = {};
      if (grouped.TERRITORIAL) {
        grouped.TERRITORIAL.forEach(t => { territorial[t.value] = t.label; });
      }

      // Procesar tipos funcionales (combinar todas las categorías no-territoriales)
      const funcional = {};
      Object.entries(grouped).forEach(([category, types]) => {
        if (category !== 'TERRITORIAL') {
          types.forEach(t => { funcional[t.value] = t.label; });
        }
      });

      // Crear mapa de todos los tipos
      const all = { ...territorial, ...funcional };

      cachedOrganizationTypes = { territorial, funcional, all, grouped };
      console.log('✅ Tipos de organización cargados desde API:', Object.keys(all).length, 'tipos');
      return cachedOrganizationTypes;
    } catch (error) {
      console.warn('⚠️ Error cargando tipos desde API, usando fallback:', error.message);
      // Usar fallback
      cachedOrganizationTypes = {
        territorial: TERRITORIAL_TYPES_FALLBACK,
        funcional: FUNCIONAL_TYPES_FALLBACK,
        all: { ...TERRITORIAL_TYPES_FALLBACK, ...FUNCIONAL_TYPES_FALLBACK },
        grouped: null
      };
      return cachedOrganizationTypes;
    } finally {
      typesLoadPromise = null;
    }
  })();

  return typesLoadPromise;
}

/**
 * Obtiene el label de un tipo de organización (sincrónico, usa cache)
 * @param {string} typeKey - Key del tipo (ej: 'JUNTA_VECINOS')
 * @returns {string} Label del tipo o el key si no se encuentra
 */
function getOrganizationTypeLabel(typeKey) {
  if (!typeKey) return '';

  // Si hay cache, usar
  if (cachedOrganizationTypes?.all) {
    return cachedOrganizationTypes.all[typeKey] || typeKey;
  }

  // Fallback a constantes locales
  return TERRITORIAL_TYPES_FALLBACK[typeKey] ||
         FUNCIONAL_TYPES_FALLBACK[typeKey] ||
         typeKey;
}

// Aliases para compatibilidad (mantenidos para código existente)
const TERRITORIAL_TYPES = TERRITORIAL_TYPES_FALLBACK;
const FUNCIONAL_TYPES = FUNCIONAL_TYPES_FALLBACK;

// Configuración de Directorio por tipo de organización (FALLBACK)
// Se usa solo cuando la API no está disponible
const DIRECTORIO_CONFIG_FALLBACK = {
  // Organizaciones Territoriales - 5 miembros
  'JUNTA_VECINOS': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb', required: true },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true }
    ],
    totalRequerido: 5
  },
  'COMITE_VECINOS': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb', required: true },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true }
    ],
    totalRequerido: 5
  },
  // Comité de Vivienda - 5 miembros
  'COMITE_VIVIENDA': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb', required: true },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true },
      { id: 'director1', nombre: 'Director/a 1', color: '#6366f1', required: true },
      { id: 'director2', nombre: 'Director/a 2', color: '#ec4899', required: true }
    ],
    totalRequerido: 5
  },
  // Centro de Padres - 4 miembros (mínimo según estatutos)
  'CENTRO_PADRES': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb', required: true },
      { id: 'secretario', nombre: 'Secretario General', color: '#10b981', required: true },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true }
    ],
    totalRequerido: 4
  },
  // CVPCC - 6 miembros
  'COMITE_CONVIVENCIA': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb', required: true },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true },
      { id: 'directorPrevencion', nombre: 'Director/a de Prevención', color: '#ef4444', required: true },
      { id: 'directorConvivencia', nombre: 'Director/a de Convivencia', color: '#06b6d4', required: true }
    ],
    totalRequerido: 6
  },
  // Organizaciones Funcionales genéricas - 5 miembros
  'DEFAULT': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#2563eb', required: true },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true }
    ],
    totalRequerido: 5
  }
};

// Caché de configuraciones de directorio obtenidas desde la API
const directorioConfigCache = {};

/**
 * Obtiene la configuración del directorio desde la API (con caché)
 * @param {string} orgType - Tipo de organización
 * @returns {Promise<Object>} Configuración del directorio
 */
async function fetchDirectorioConfig(orgType) {
  // Si ya está en caché, devolverla
  if (directorioConfigCache[orgType]) {
    return directorioConfigCache[orgType];
  }

  try {
    const response = await fetch(`/api/estatuto-templates/${orgType}/config`);
    if (response.ok) {
      const data = await response.json();
      if (data.directorio) {
        // Guardar en caché
        directorioConfigCache[orgType] = data.directorio;
        return data.directorio;
      }
    }
  } catch (error) {
    console.warn(`No se pudo obtener config de directorio desde API para ${orgType}:`, error);
  }

  // Fallback a configuración local
  const fallbackConfig = DIRECTORIO_CONFIG_FALLBACK[orgType] || DIRECTORIO_CONFIG_FALLBACK['DEFAULT'];
  directorioConfigCache[orgType] = fallbackConfig;
  return fallbackConfig;
}

// Función sincrónica para obtener la configuración (usa caché o fallback)
function getDirectorioConfig(orgType) {
  // Primero intentar desde caché
  if (directorioConfigCache[orgType]) {
    return directorioConfigCache[orgType];
  }
  // Si no está en caché, usar fallback local
  return DIRECTORIO_CONFIG_FALLBACK[orgType] || DIRECTORIO_CONFIG_FALLBACK['DEFAULT'];
}

/**
 * Genera el HTML para un cargo del directorio
 * @param {Object} cargo - Configuración del cargo
 * @param {boolean} isLast - Si es el último cargo (sin margin-bottom)
 */
function generateCargoHTML(cargo, isLast = false) {
  const marginStyle = isLast ? '' : 'margin-bottom: 16px;';
  return `
    <div class="directivo-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; ${marginStyle}">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span style="background: ${cargo.color}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${cargo.nombre.toUpperCase()}</span>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group">
          <label for="dir-${cargo.id}">Seleccionar Miembro <span class="required">*</span></label>
          <select id="dir-${cargo.id}" name="${cargo.id}" required class="member-select directorio-select">
            <option value="">Seleccione un miembro fundador...</option>
          </select>
        </div>
        <div class="form-group">
          <label for="cert-${cargo.id}">Certificado de Antecedentes <span class="required">*</span></label>
          <div class="file-upload-wrapper">
            <input type="file" id="cert-${cargo.id}" name="cert${cargo.id}" accept=".pdf,.jpg,.jpeg,.png" class="file-input-hidden cert-directorio">
            <button type="button" class="btn-upload-cert" onclick="document.getElementById('cert-${cargo.id}').click()">
              📎 Subir Certificado
            </button>
            <span class="file-name-display" id="cert-${cargo.id}-name"></span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Genera el HTML para los badges de certificados
 * @param {Object} config - Configuración del directorio
 */
function generateCertBadgesHTML(config) {
  let html = '';
  // Badges para directorio
  config.cargos.forEach(cargo => {
    const shortName = cargo.nombre.length > 10 ? cargo.nombre.substring(0, 10) + '.' : cargo.nombre;
    html += `<span class="cert-badge pending" id="cert-badge-${cargo.id}">❌ ${shortName}</span>\n`;
  });
  // Badges para comisión electoral (siempre 3)
  html += `<span class="cert-badge pending" id="cert-badge-com1">❌ Com. 1</span>\n`;
  html += `<span class="cert-badge pending" id="cert-badge-com2">❌ Com. 2</span>\n`;
  html += `<span class="cert-badge pending" id="cert-badge-com3">❌ Com. 3</span>\n`;
  return html;
}

// Usar getOrgType de utils para nombre legible
const getOrgTypeName = getOrgTypeFromUtils;

export class WizardController {
  constructor() {
    // Exponer instancia para onclick handlers en HTML
    window.wizardController = this;

    this.currentStep = 1;
    this.totalSteps = 6;
    this.storageKey = 'wizardProgress';
    this.formData = {
      organization: {
        contactPreference: 'phone' // 'phone' o 'email'
      },
      members: [],
      commission: {
        members: [],
        electionDate: null
      },
      statutes: {
        type: 'template',
        content: null
      },
      documents: {},
      certificates: {},
      otherDocuments: [],
      signatures: {}, // Firmas por miembro: { memberId: { type, data, ... } }
      // Campos del Paso 5: Directorio Provisorio y Certificados
      directorioProvisorio: {},
      certificatesStep5: {}
    };
    this.otherDocumentCounter = 0;
    this.currentSignatureMethod = 'draw';
    this.existingOrganizationId = null; // Para continuar org existente después de Ministro de Fe
  }

  /**
   * Guarda el progreso en localStorage
   * Nota: Los certificados base64 NO se guardan en localStorage por límites de espacio
   */
  saveProgress() {
    // Crear copia del formData sin los datos base64 de certificados (son muy grandes)
    const formDataForStorage = { ...this.formData };

    // Guardar solo metadatos de certificados (sin base64)
    if (formDataForStorage.certificatesStep5) {
      const certsMetadata = {};
      Object.keys(formDataForStorage.certificatesStep5).forEach(key => {
        const cert = formDataForStorage.certificatesStep5[key];
        if (cert) {
          certsMetadata[key] = {
            name: cert.name,
            size: cert.size,
            type: cert.type
            // NO incluir base64 - es muy grande para localStorage
          };
        }
      });
      formDataForStorage.certificatesStep5 = certsMetadata;
    }

    const progress = {
      currentStep: this.currentStep,
      formData: formDataForStorage,
      organizationId: this.existingOrganizationId || null,
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(progress));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage:', e.message);
      // Si aún falla, intentar limpiar y guardar sin certificados
      if (e.name === 'QuotaExceededError') {
        formDataForStorage.certificatesStep5 = {};
        const minimalProgress = {
          currentStep: this.currentStep,
          formData: formDataForStorage,
          organizationId: this.existingOrganizationId || null,
          savedAt: new Date().toISOString()
        };
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(minimalProgress));
        } catch (e2) {
          console.error('Error crítico guardando progreso:', e2);
        }
      }
    }
  }

  /**
   * Carga el progreso desde localStorage
   */
  loadProgress() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        // Verificar que no sea muy antiguo (7 días)
        const savedDate = new Date(progress.savedAt);
        const now = new Date();
        const daysDiff = (now - savedDate) / (1000 * 60 * 60 * 24);

        if (daysDiff < 7) {
          return progress;
        } else {
          this.clearProgress();
        }
      } catch (e) {
        console.error('Error loading wizard progress:', e);
      }
    }
    return null;
  }

  /**
   * Limpia el progreso guardado
   */
  clearProgress() {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Abre el wizard
   */
  open() {
    // Verificar que el usuario tenga perfil completo
    const userData = localStorage.getItem('currentUser');
    if (!userData) {
      showToast('Debes iniciar sesión para crear una organización', 'error');
      return;
    }

    const user = JSON.parse(userData);

    // Los datos del usuario vienen directamente en user, no en user.profile
    // Crear un objeto profile con los datos del usuario para compatibilidad
    const profile = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email,
      address: user.address,
      region: user.region,
      commune: user.commune
    };

    // Verificar que tenga teléfono configurado
    // Nota: Región y comuna ya no son requeridas porque todas las organizaciones son de Renca
    if (!user.phone) {
      showToast('Debes completar tu número de teléfono antes de crear una organización', 'error');

      // Mostrar modal informativo
      this.showProfileRequiredModal(true);
      return;
    }

    // Guardar email del usuario
    this.userEmail = user.email;

    // Guardar datos del usuario para uso en el wizard
    this.userProfile = profile;
    this.userId = user._id || user.id;

    // Verificar si hay progreso guardado
    const savedProgress = this.loadProgress();
    if (savedProgress && savedProgress.currentStep > 1) {
      this.showResumeModal(savedProgress);
      return;
    }

    this.startWizard();
  }

  /**
   * Muestra modal para continuar o empezar de nuevo
   */
  showResumeModal(savedProgress) {
    const savedDate = new Date(savedProgress.savedAt);
    const formattedDate = savedDate.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    const modalHTML = `
      <div class="modal-overlay" id="resume-wizard-modal">
        <div class="modal-content modal-resume-styled">
          <div class="modal-resume-header">
            <div class="modal-resume-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
            </div>
            <h3>Solicitud en Progreso</h3>
            <p>Tienes una solicitud sin completar</p>
          </div>

          <div class="modal-resume-body">
            <div class="resume-info">
              <div class="resume-info-item">
                <span class="resume-label">Paso actual:</span>
                <span class="resume-value">${savedProgress.currentStep} de 6</span>
              </div>
              <div class="resume-info-item">
                <span class="resume-label">Organización:</span>
                <span class="resume-value">${savedProgress.formData.organization?.name || 'Sin nombre'}</span>
              </div>
              <div class="resume-info-item">
                <span class="resume-label">Miembros registrados:</span>
                <span class="resume-value">${savedProgress.formData.members?.length || 0}</span>
              </div>
              <div class="resume-info-item">
                <span class="resume-label">Guardado:</span>
                <span class="resume-value">${formattedDate}</span>
              </div>
            </div>
          </div>

          <div class="modal-resume-actions">
            <button type="button" class="btn-outline-danger" id="btn-start-new">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              Empezar de Nuevo
            </button>
            <button type="button" class="btn-submit" id="btn-continue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Continuar
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-start-new').addEventListener('click', () => {
      document.getElementById('resume-wizard-modal').remove();
      this.clearProgress();
      this.startWizard();
    });

    document.getElementById('btn-continue').addEventListener('click', async () => {
      document.getElementById('resume-wizard-modal').remove();
      // Restaurar formData asegurando que todos los campos existan
      this.formData = {
        organization: savedProgress.formData.organization || {},
        members: savedProgress.formData.members || [],
        commission: savedProgress.formData.commission || { members: [], electionDate: null },
        statutes: savedProgress.formData.statutes || { type: 'template', content: null },
        documents: savedProgress.formData.documents || {},
        certificates: savedProgress.formData.certificates || {},
        otherDocuments: savedProgress.formData.otherDocuments || [],
        signatures: savedProgress.formData.signatures || {},
        // Campos del Paso 5: Directorio Provisorio y Certificados
        directorioProvisorio: savedProgress.formData.directorioProvisorio || {},
        certificatesStep5: savedProgress.formData.certificatesStep5 || {},
        // Estado de pantalla de Ministro (para restaurar correctamente)
        showingMinistroScreen: savedProgress.formData.showingMinistroScreen || false
      };

      // Cargar certificados desde IndexedDB (tienen el base64 completo)
      try {
        // Primero asegurar que IndexedDB esté inicializada
        await indexedDBService.init();
        console.log('🔄 Buscando certificados en IndexedDB...');
        const idbCerts = await indexedDBService.getAllWizardCertificates();
        console.log('📦 Certificados encontrados en IndexedDB:', idbCerts);
        if (idbCerts && Object.keys(idbCerts).length > 0) {
          console.log('✅ Certificados restaurados desde IndexedDB:', Object.keys(idbCerts));
          // Merge con los metadatos de localStorage
          Object.keys(idbCerts).forEach(key => {
            if (idbCerts[key] && idbCerts[key].base64) {
              this.formData.certificatesStep5[key] = idbCerts[key];
              console.log('✅ Certificado restaurado:', key);
            }
          });
        } else {
          console.warn('⚠️ No hay certificados en IndexedDB');
        }
      } catch (e) {
        console.error('❌ Error cargando certificados de IndexedDB:', e);
      }

      this.currentStep = savedProgress.currentStep;
      // Restaurar organizationId si existe (para actualizar org existente)
      this.existingOrganizationId = savedProgress.organizationId || null;
      this.startWizard(true);
    });
  }

  /**
   * Inicia el wizard
   */
  startWizard(resuming = false) {
    const wizardHTML = getWizardHTML();
    document.body.insertAdjacentHTML('beforeend', wizardHTML);

    if (!resuming) {
      this.currentStep = 1;
    }

    this.bindEvents();
    this.updateUI();
    this.updateProgressBar();
    this.initializeCurrentStep();

    // Si estamos resumiendo y el usuario estaba en la pantalla del Ministro, mostrarla
    if (resuming && this.currentStep === 6 && this.formData.showingMinistroScreen) {
      console.log('🔄 Restaurando pantalla de solicitud de Ministro de Fe...');
      setTimeout(() => {
        this.showMinistroRequestScreen();
      }, 100);
    }
  }

  /**
   * Muestra modal indicando que se requiere completar el perfil
   */
  showProfileRequiredModal(missingPhone = false) {
    const modalHTML = `
      <div class="modal-overlay" id="profile-required-modal">
        <div class="modal-content profile-required-modal">
          <button class="modal-close-btn" id="close-profile-modal">&times;</button>

          <div class="profile-required-icon">
            <div class="icon-circle">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
          </div>

          <h3 class="profile-required-title">Completa tu Perfil</h3>
          <p class="profile-required-subtitle">Para crear una organización comunitaria necesitamos tu número de teléfono de contacto</p>

          <div class="profile-required-items">
            <div class="required-item">
              <div class="required-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <div class="required-item-text">
                <span class="required-item-label">Teléfono</span>
                <span class="required-item-desc">Número de contacto para la organización</span>
              </div>
            </div>
          </div>

          <p class="profile-required-note">
            Este número se usará como contacto de la organización. Todas las organizaciones se registran en la comuna de Renca, Región Metropolitana.
          </p>

          <div class="profile-required-actions">
            <button type="button" class="btn-ghost" id="cancel-profile-modal">Cancelar</button>
            <button type="button" class="btn-primary-gradient" id="go-to-profile">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Ir a Mi Perfil
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Eventos
    document.getElementById('close-profile-modal').addEventListener('click', () => {
      document.getElementById('profile-required-modal').remove();
    });

    document.getElementById('cancel-profile-modal').addEventListener('click', () => {
      document.getElementById('profile-required-modal').remove();
    });

    document.getElementById('go-to-profile').addEventListener('click', () => {
      document.getElementById('profile-required-modal').remove();
      // Importar appState dinámicamente para navegar
      import('../../../app.js').then(({ appState }) => {
        appState.navigateTo('profile');
      });
    });
  }

  /**
   * Cierra el wizard
   */
  close() {
    const overlay = document.getElementById('wizard-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Vincula eventos
   */
  bindEvents() {
    // Cerrar wizard
    document.getElementById('wizard-close').addEventListener('click', () => {
      this.showExitConfirmation();
    });

    // Guardar y salir
    document.getElementById('wizard-save').addEventListener('click', () => {
      this.saveAndExit();
    });

    // Navegación
    document.getElementById('wizard-next').addEventListener('click', () => {
      this.nextStep();
    });

    document.getElementById('wizard-prev').addEventListener('click', () => {
      this.previousStep();
    });

    // Click fuera del wizard
    document.getElementById('wizard-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'wizard-overlay') {
        this.showExitConfirmation();
      }
    });
  }

  /**
   * Muestra confirmación para salir
   */
  showExitConfirmation() {
    const modalHTML = `
      <div class="modal-overlay" id="exit-confirm-modal">
        <div class="modal-content modal-exit-confirm">
          <div class="modal-exit-header">
            <div class="exit-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3>¿Desea salir del formulario?</h3>
          </div>
          <div class="modal-exit-body">
            <p>Puede guardar su progreso para continuar más tarde o salir sin guardar.</p>
          </div>
          <div class="modal-exit-actions">
            <button class="btn-ghost" id="btn-exit-discard">Salir sin guardar</button>
            <button class="btn-secondary" id="btn-exit-cancel">Cancelar</button>
            <button class="btn-primary" id="btn-exit-save">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Guardar y Salir
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-exit-discard').addEventListener('click', () => {
      document.getElementById('exit-confirm-modal').remove();
      this.clearProgress();
      this.close();
    });

    document.getElementById('btn-exit-cancel').addEventListener('click', () => {
      document.getElementById('exit-confirm-modal').remove();
    });

    document.getElementById('btn-exit-save').addEventListener('click', () => {
      document.getElementById('exit-confirm-modal').remove();
      this.saveAndExit();
    });
  }

  /**
   * Guarda el progreso y cierra el wizard
   */
  saveAndExit() {
    // Intentar guardar datos del paso actual
    try {
      this.saveCurrentStepData();
    } catch (e) {
      console.log('No se pudo guardar paso actual:', e);
    }

    this.saveProgress();
    showToast('Progreso guardado correctamente. Puede continuar más tarde.', 'success');
    this.close();
  }

  /**
   * Guarda solo los datos del paso actual sin validar
   */
  saveCurrentStepData() {
    switch (this.currentStep) {
      case 1:
        const form = document.getElementById('form-step-1');
        if (form) {
          const formData = new FormData(form);
          const street = formData.get('street') || '';
          const streetNumber = formData.get('streetNumber') || '';
          const postalCode = formData.get('postalCode') || '';
          // Componer address para compatibilidad con el resto del sistema
          const composedAddress = `${street} ${streetNumber}`.trim();

          // Actualizar campo hidden
          const addressHidden = document.getElementById('org-address');
          if (addressHidden) addressHidden.value = composedAddress;

          this.formData.organization = {
            type: formData.get('type') || '',
            name: formData.get('name') || '',
            description: formData.get('description') || '',
            address: composedAddress,
            street,
            streetNumber,
            postalCode,
            region: formData.get('region') || '',
            regionId: formData.get('regionId') || '',
            commune: formData.get('commune') || '',
            neighborhood: formData.get('neighborhood') || null,
            email: formData.get('email') || '',
            phone: formData.get('phone') || '',
            contactPreference: formData.get('contactPreference') || 'phone'
          };
        }
        break;
      case 3:
        const electionDate = document.getElementById('election-date')?.value;
        if (electionDate) {
          this.formData.commission.electionDate = electionDate;
        }
        break;
    }
  }

  /**
   * Inicializa el paso 1
   */
  initializeStep1() {
    // Cargar datos desde el perfil del usuario
    const regionInput = document.getElementById('org-region');
    const regionIdInput = document.getElementById('org-region-id');
    const communeInput = document.getElementById('org-commune');
    const emailInput = document.getElementById('org-email');
    const phoneInput = document.getElementById('org-phone');

    // FORZAR REGIÓN Y COMUNA PARA MUNICIPALIDAD DE RENCA
    // Independientemente del perfil del usuario, todas las organizaciones
    // deben ser de Renca, Región Metropolitana
    regionInput.value = 'Región Metropolitana de Santiago';
    regionIdInput.value = '13';
    communeInput.value = 'Renca';

    // Cargar email y teléfono desde perfil del usuario
    if (this.userProfile) {
      if (this.userEmail) {
        emailInput.value = this.userEmail;
      }

      if (this.userProfile.phone) {
        phoneInput.value = this.userProfile.phone;
      }
    }

    // Manejar cambio de categoría
    const categorySelect = document.getElementById('org-category');
    const typeRow = document.getElementById('org-type-row');
    const typeSelect = document.getElementById('org-type');
    const typeHelp = document.getElementById('org-type-help');
    const neighborhoodRow = document.getElementById('neighborhood-row');

    categorySelect.addEventListener('change', async (e) => {
      const category = e.target.value;

      // Limpiar select de tipo
      typeSelect.innerHTML = '<option value="">Seleccione...</option>';

      // Cargar tipos dinámicos (usa cache si disponible)
      const orgTypes = await loadOrganizationTypes();

      if (category === 'TERRITORIAL') {
        // Poblar con tipos territoriales desde API (o fallback)
        const territorialTypes = orgTypes.territorial || TERRITORIAL_TYPES_FALLBACK;
        Object.entries(territorialTypes).forEach(([key, label]) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = label;
          typeSelect.appendChild(option);
        });
        typeHelp.textContent = 'Organizaciones basadas en un territorio geográfico específico (unidad vecinal)';
        typeRow.style.display = 'flex';

      } else if (category === 'FUNCIONAL') {
        // Poblar con tipos funcionales desde API (o fallback)
        const funcionalTypes = orgTypes.funcional || FUNCIONAL_TYPES_FALLBACK;
        Object.entries(funcionalTypes).forEach(([key, label]) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = label;
          typeSelect.appendChild(option);
        });
        typeHelp.textContent = 'Organizaciones que promueven valores e intereses específicos de la comunidad';
        typeRow.style.display = 'flex';

      } else {
        typeRow.style.display = 'none';
        neighborhoodRow.style.display = 'none';
        document.getElementById('org-neighborhood').required = false;
      }

      // Reset tipo seleccionado
      typeSelect.value = '';
    });

    // Mostrar/ocultar campo de unidad vecinal según tipo específico
    typeSelect.addEventListener('change', (e) => {
      const type = e.target.value;

      // Solo Junta de Vecinos requiere unidad vecinal
      if (type === 'JUNTA_VECINOS') {
        neighborhoodRow.style.display = 'flex';
        document.getElementById('org-neighborhood').required = true;
        // Intentar detectar UV si ya hay dirección ingresada
        this.detectUnidadVecinal();
      } else {
        neighborhoodRow.style.display = 'none';
        document.getElementById('org-neighborhood').required = false;
      }

      // Actualizar requisitos de miembros según tipo
      this.updateMemberRequirements(type);
    });

    // Auto-detección de Unidad Vecinal al cambiar dirección
    const streetInput = document.getElementById('org-street');
    const streetNumberInput = document.getElementById('org-street-number');
    const postalCodeInput = document.getElementById('org-postal-code');

    // Debounce para evitar muchas llamadas mientras escribe
    let uvDetectionTimeout = null;
    const detectUVOnChange = () => {
      clearTimeout(uvDetectionTimeout);
      uvDetectionTimeout = setTimeout(() => {
        // Solo detectar si es Junta de Vecinos
        if (typeSelect.value === 'JUNTA_VECINOS') {
          this.detectUnidadVecinal();
        }
      }, 800); // Esperar 800ms después de que el usuario deje de escribir
    };

    streetInput.addEventListener('input', detectUVOnChange);
    streetNumberInput.addEventListener('input', detectUVOnChange);
    postalCodeInput.addEventListener('input', detectUVOnChange);
  }

  /**
   * Detecta la Unidad Vecinal según la dirección ingresada
   */
  async detectUnidadVecinal() {
    const streetInput = document.getElementById('org-street');
    const streetNumberInput = document.getElementById('org-street-number');
    const neighborhoodInput = document.getElementById('org-neighborhood');
    const loadingIndicator = document.getElementById('uv-loading-indicator');
    const successIndicator = document.getElementById('uv-success-indicator');
    const helpText = document.getElementById('uv-help-text');

    const street = streetInput?.value?.trim() || '';
    const streetNumber = streetNumberInput?.value?.trim() || '';

    // Necesitamos al menos la calle para buscar
    if (!street) {
      neighborhoodInput.value = '';
      helpText.textContent = 'Ingresa la dirección para detectar la unidad vecinal';
      helpText.style.color = '#64748b';
      successIndicator.style.display = 'none';
      return;
    }

    // Construir dirección completa
    const fullAddress = `${street} ${streetNumber}`.trim();

    // Mostrar indicador de carga
    loadingIndicator.style.display = 'inline';
    successIndicator.style.display = 'none';
    helpText.textContent = 'Buscando unidad vecinal...';
    helpText.style.color = '#2563eb';

    try {
      const result = await unidadesVecinalesService.buscarPorDireccion(fullAddress);

      loadingIndicator.style.display = 'none';

      if (result.encontrada && result.unidadVecinal) {
        const uv = result.unidadVecinal;
        neighborhoodInput.value = `UV ${uv.numero} - ${uv.nombre}`;
        this.formData.organization.neighborhood = uv.numero;
        this.formData.organization.neighborhoodName = uv.nombre;

        successIndicator.style.display = 'inline';
        helpText.textContent = `✓ Unidad Vecinal detectada: ${uv.nombre}`;
        helpText.style.color = '#10b981';
      } else {
        neighborhoodInput.value = '';
        helpText.textContent = 'No se encontró unidad vecinal para esta dirección. Verifique que sea en Renca.';
        helpText.style.color = '#f59e0b';
      }
    } catch (error) {
      console.error('Error detectando unidad vecinal:', error);
      loadingIndicator.style.display = 'none';
      neighborhoodInput.value = '';
      helpText.textContent = 'Error al buscar unidad vecinal. Intente nuevamente.';
      helpText.style.color = '#ef4444';
    }
  }

  /**
   * Actualiza los requisitos de miembros según el tipo de organización
   */
  updateMemberRequirements(orgType) {
    const requirementsList = document.getElementById('org-requirements-list');
    const minMembersRequired = document.getElementById('min-members-required');
    const step2Description = document.getElementById('step2-description');

    const isJuntaVecinos = orgType === 'JUNTA_VECINOS';
    const minMembers = isJuntaVecinos ? 200 : 15;

    // Actualizar lista de requisitos en Paso 1
    if (requirementsList) {
      if (isJuntaVecinos) {
        requirementsList.innerHTML = `
          <li>Mínimo 200 miembros fundadores</li>
          <li>Todos los miembros deben tener mínimo 14 años</li>
          <li>Deben residir en la unidad vecinal correspondiente</li>
        `;
      } else {
        requirementsList.innerHTML = `
          <li>Mínimo 15 miembros fundadores</li>
          <li>Todos los miembros deben tener mínimo 14 años</li>
          <li>Deben residir en la comuna correspondiente</li>
        `;
      }
    }

    // Actualizar mínimo requerido en Paso 2
    if (minMembersRequired) {
      minMembersRequired.textContent = minMembers;
    }

    // Actualizar descripción en Paso 2
    if (step2Description) {
      step2Description.textContent = `Registre a los miembros fundadores de la organización (mínimo ${minMembers} personas).`;
    }

    // Actualizar contador de miembros si ya existe
    this.updateMembersCount();
  }

  /**
   * Avanza al siguiente paso
   */
  async nextStep() {
    // Validar paso actual
    const isValid = await this.validateCurrentStep();

    if (!isValid) {
      return;
    }

    // Guardar datos del paso actual
    await this.saveCurrentStep();

    // FASE 2: Interceptar después del paso 6 (Documentos)
    // El usuario debe completar todos los pasos y documentos antes de solicitar Ministro de Fe
    if (this.currentStep === 6 && !this.formData.ministroApproved) {
      try {
        console.log('🔄 Mostrando pantalla de solicitud de Ministro de Fe...');
        await this.showMinistroRequestScreen();
        console.log('✅ Pantalla de Ministro de Fe mostrada correctamente');
      } catch (error) {
        console.error('❌ Error mostrando pantalla de Ministro:', error);
        showToast('Error al cargar la pantalla de Ministro de Fe: ' + error.message, 'error');
      }
      return;
    }

    // Si es el último paso, enviar solicitud
    if (this.currentStep === this.totalSteps) {
      await this.submitApplication();
      return;
    }

    // ESPECIAL: Si vamos a pasar del paso 5 al 6, mostrar overlay de carga de documentos
    if (this.currentStep === 5) {
      await this.transitionToStep6WithLoading();
      return;
    }

    // Avanzar al siguiente paso
    this.currentStep++;
    this.updateUI();
    this.updateProgressBar();
    this.initializeCurrentStep();

    // Guardar progreso
    this.saveProgress();
  }

  /**
   * Transición especial del paso 5 al 6 con pantalla de carga
   * Espera a que todos los documentos se generen antes de mostrar el paso 6
   */
  async transitionToStep6WithLoading() {
    // Mostrar overlay de carga
    this.showDocumentLoadingOverlay();

    try {
      // Avanzar al paso 6
      this.currentStep = 6;
      this.updateUI();
      this.updateProgressBar();

      // Actualizar mensaje de progreso
      this.updateLoadingProgress('Preparando generación de documentos...', 10);

      // Generar todos los documentos
      this.updateLoadingProgress('Generando Acta Constitutiva...', 20);
      await this.generateAllDocuments();

      // Validar que los documentos principales se generaron
      this.updateLoadingProgress('Verificando documentos generados...', 80);
      const docsValidation = this.validateGeneratedDocuments();

      if (!docsValidation.success) {
        // Reintentar una vez si falló
        this.updateLoadingProgress('Reintentando generación de documentos...', 85);
        await this.generateAllDocuments();

        const retryValidation = this.validateGeneratedDocuments();
        if (!retryValidation.success) {
          throw new Error(`No se pudieron generar todos los documentos: ${retryValidation.missing.join(', ')}`);
        }
      }

      // Aplicar firmas a los documentos
      this.updateLoadingProgress('Aplicando firmas a documentos...', 90);
      this.updateDocumentsWithSignatures();

      // Renderizar lista de documentos
      this.updateLoadingProgress('Preparando vista de documentos...', 95);
      this.renderDocumentsList();
      this.renderOtherDocumentsList();

      // Configurar botones del paso 6
      this.updateLoadingProgress('Finalizando...', 100);

      // Pequeña pausa para mostrar el 100%
      await new Promise(resolve => setTimeout(resolve, 300));

      // Ocultar overlay
      this.hideDocumentLoadingOverlay();

      // Configurar event listeners del paso 6
      this.setupStep6EventListeners();

      // Guardar progreso
      this.saveProgress();

    } catch (error) {
      console.error('Error generando documentos:', error);
      this.hideDocumentLoadingOverlay();
      showToast('Error al generar documentos: ' + error.message, 'error');

      // Volver al paso 5
      this.currentStep = 5;
      this.updateUI();
      this.updateProgressBar();
    }
  }

  /**
   * Valida que los documentos principales se hayan generado correctamente
   */
  validateGeneratedDocuments() {
    const requiredDocs = [
      'ACTA_CONSTITUTIVA',
      'ESTATUTOS',
      'REGISTRO_SOCIOS',
      'CERTIFICADO_MINISTRO_FE',
      'CERTIFICACION_MUNICIPAL',
      'DEPOSITO_ANTECEDENTES'
    ];

    const missing = [];

    for (const docType of requiredDocs) {
      const doc = this.formData.documents[docType];
      if (!doc || !doc.isGenerated || !doc.content) {
        missing.push(docType);
      }
    }

    return {
      success: missing.length === 0,
      missing: missing
    };
  }

  /**
   * Configura los event listeners del paso 6
   */
  setupStep6EventListeners() {
    setTimeout(() => {
      // Botón agregar otro documento
      const btnAddDoc = document.getElementById('btn-add-other-document');
      if (btnAddDoc) {
        btnAddDoc.onclick = () => this.addOtherDocumentSlot();
      }

      // Asignar onclick a botones de documento
      document.querySelectorAll('.btn-preview').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const docType = btn.dataset.docType;
          if (docType) this.showDocumentPreview(docType);
        };
      });

      document.querySelectorAll('.btn-edit-doc').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const docType = btn.dataset.docType;
          if (docType) this.showEditDocumentModal(docType);
        };
      });

      document.querySelectorAll('.btn-download').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const docType = btn.dataset.docType;
          if (docType) this.downloadDocument(docType);
        };
      });
    }, 100);
  }

  /**
   * Muestra el overlay de carga de documentos
   */
  showDocumentLoadingOverlay() {
    // Remover overlay existente si hay
    const existing = document.getElementById('document-loading-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'document-loading-overlay';
    overlay.innerHTML = `
      <div class="document-loading-content">
        <div class="document-loading-icon">
          <svg class="document-spinner" viewBox="0 0 50 50">
            <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
          </svg>
          <div class="document-icon-stack">
            <div class="doc-icon doc-1">📄</div>
            <div class="doc-icon doc-2">📄</div>
            <div class="doc-icon doc-3">📄</div>
          </div>
        </div>
        <h3 class="loading-title">Generando Documentos</h3>
        <p class="loading-message" id="loading-progress-message">Preparando la generación de documentos legales...</p>
        <div class="loading-progress-bar">
          <div class="loading-progress-fill" id="loading-progress-fill" style="width: 0%"></div>
        </div>
        <p class="loading-hint">Por favor espere, esto puede tomar unos segundos...</p>
      </div>
    `;

    // Agregar estilos si no existen
    if (!document.getElementById('document-loading-styles')) {
      const styles = document.createElement('style');
      styles.id = 'document-loading-styles';
      styles.textContent = `
        #document-loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .document-loading-content {
          background: white;
          border-radius: 16px;
          padding: 40px 50px;
          text-align: center;
          max-width: 420px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.4s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .document-loading-icon {
          position: relative;
          width: 100px;
          height: 100px;
          margin: 0 auto 24px;
        }

        .document-spinner {
          position: absolute;
          width: 100%;
          height: 100%;
          animation: rotate 1.5s linear infinite;
        }

        @keyframes rotate {
          100% { transform: rotate(360deg); }
        }

        .document-spinner .path {
          stroke: #2563eb;
          stroke-linecap: round;
          animation: dash 1.5s ease-in-out infinite;
        }

        @keyframes dash {
          0% {
            stroke-dasharray: 1, 150;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -35;
          }
          100% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -124;
          }
        }

        .document-icon-stack {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .doc-icon {
          font-size: 24px;
          position: absolute;
          animation: docPulse 2s ease-in-out infinite;
        }

        .doc-icon.doc-1 {
          top: -15px;
          left: -12px;
          animation-delay: 0s;
        }

        .doc-icon.doc-2 {
          top: -8px;
          left: -6px;
          animation-delay: 0.3s;
        }

        .doc-icon.doc-3 {
          top: 0;
          left: 0;
          animation-delay: 0.6s;
        }

        @keyframes docPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        .loading-title {
          font-size: 22px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 12px 0;
        }

        .loading-message {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 20px 0;
          min-height: 20px;
        }

        .loading-progress-bar {
          width: 100%;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .loading-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #2563eb, #3b82f6);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .loading-hint {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(overlay);
  }

  /**
   * Actualiza el progreso del overlay de carga
   */
  updateLoadingProgress(message, percentage) {
    const messageEl = document.getElementById('loading-progress-message');
    const fillEl = document.getElementById('loading-progress-fill');

    if (messageEl) messageEl.textContent = message;
    if (fillEl) fillEl.style.width = `${percentage}%`;
  }

  /**
   * Oculta el overlay de carga de documentos
   */
  hideDocumentLoadingOverlay() {
    const overlay = document.getElementById('document-loading-overlay');
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => overlay.remove(), 300);

      // Agregar keyframe de fadeOut si no existe
      if (!document.querySelector('style[data-fadeout]')) {
        const style = document.createElement('style');
        style.setAttribute('data-fadeout', 'true');
        style.textContent = `
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }

  /**
   * Retrocede al paso anterior
   */
  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateUI();
      this.updateProgressBar();
      this.initializeCurrentStep();
    }
  }

  /**
   * Navega directamente a un paso específico
   */
  goToStep(step) {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
      this.updateUI();
      this.updateProgressBar();
      this.initializeCurrentStep();
      this.saveProgress();
    }
  }

  /**
   * Actualiza la UI según el paso actual
   */
  updateUI() {
    // Ocultar todos los pasos
    document.querySelectorAll('.wizard-step-content').forEach(step => {
      step.classList.remove('active');
    });

    // Mostrar paso actual
    const currentStepElement = document.getElementById(`step-${this.currentStep}`);
    if (currentStepElement) {
      currentStepElement.classList.add('active');
    }

    // Actualizar indicadores de pasos
    document.querySelectorAll('.wizard-step').forEach((step, index) => {
      step.classList.remove('active', 'completed');

      if (index + 1 === this.currentStep) {
        step.classList.add('active');
      } else if (index + 1 < this.currentStep) {
        step.classList.add('completed');
      }
    });

    // Actualizar botones
    const prevBtn = document.getElementById('wizard-prev');
    const nextBtn = document.getElementById('wizard-next');

    // Restaurar visibilidad de botones (pueden estar ocultos por showMinistroRequestScreen)
    if (prevBtn) {
      if (this.currentStep === 1) {
        prevBtn.style.display = 'none';
      } else {
        prevBtn.style.display = 'block';
      }
    }

    // Siempre mostrar el botón siguiente y actualizar su texto
    if (nextBtn) {
      nextBtn.style.display = 'block';
      if (this.currentStep === this.totalSteps) {
        nextBtn.textContent = '✓ Enviar Solicitud';
        nextBtn.classList.add('btn-success');
      } else {
        nextBtn.textContent = 'Siguiente →';
        nextBtn.classList.remove('btn-success');
      }
    }
  }

  /**
   * Actualiza la barra de progreso
   */
  updateProgressBar() {
    const progressBar = document.getElementById('wizard-progress-bar');
    const progress = (this.currentStep / this.totalSteps) * 100;
    progressBar.style.width = `${progress}%`;
  }

  /**
   * Valida el paso actual
   */
  async validateCurrentStep() {
    switch (this.currentStep) {
      case 1:
        return this.validateStep1();
      case 2:
        return this.validateStep2();
      case 3:
        return this.validateStep3_ConfigEstatutos(); // Config Estatutos es paso 3
      case 4:
        return this.validateStep4_Estatutos(); // Estatutos es paso 4
      case 5:
        return this.validateStep5_Comision(); // Comisión es paso 5
      case 6:
        return this.validateStep6_Documentos(); // Documentos es paso 6
      default:
        return true;
    }
  }

  /**
   * Valida paso 1: Datos básicos
   */
  validateStep1() {
    const form = document.getElementById('form-step-1');

    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }

    const type = document.getElementById('org-type').value;
    const neighborhood = document.getElementById('org-neighborhood').value;

    if (type === 'JUNTA_VECINOS' && !neighborhood) {
      showToast('La unidad vecinal es requerida para Juntas de Vecinos', 'error');
      return false;
    }

    return true;
  }

  /**
   * Valida paso 2: Miembros
   */
  validateStep2() {
    const orgType = this.formData.organization?.type;
    const requiredMembers = orgType === 'JUNTA_VECINOS' ? 200 : 15;

    if (this.formData.members.length < requiredMembers) {
      const orgName = orgType === 'JUNTA_VECINOS' ? 'Junta de Vecinos' : 'Organización';
      showToast(`${orgName} requiere al menos ${requiredMembers} miembros fundadores. Tienes ${this.formData.members.length}.`, 'error');
      return false;
    }

    // Validar que ningún miembro sea menor de 14 años
    const today = new Date();
    const underage = [];
    for (const m of this.formData.members) {
      if (m.birthDate) {
        const birth = new Date(m.birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        if (age < 14) {
          const name = m.primerNombre
            ? `${m.primerNombre} ${m.apellidoPaterno || ''}`.trim()
            : `${m.firstName || ''} ${m.lastName || ''}`.trim();
          underage.push(name || m.rut || 'Sin nombre');
        }
      }
    }

    if (underage.length > 0) {
      showToast(`Hay ${underage.length} miembro(s) menor(es) de 14 años: ${underage.slice(0, 3).join(', ')}${underage.length > 3 ? '...' : ''}. Todos deben tener al menos 14 años según la Ley 19.418.`, 'error');
      return false;
    }

    return true;
  }

  /**
   * Valida paso 5: Directorio Provisorio y Comisión Electoral
   */
  validateStep5_Comision() {
    const config = this.currentDirectorioConfig || getDirectorioConfig('DEFAULT');

    // Validar que se seleccionaron todos los miembros del directorio (dinámico)
    const missingDirectorio = [];
    config.cargos.forEach(cargo => {
      const value = document.getElementById(`dir-${cargo.id}`)?.value;
      if (!value) {
        missingDirectorio.push(cargo.nombre);
      }
    });

    if (missingDirectorio.length > 0) {
      showToast(`Debe seleccionar todos los miembros del Directorio Provisorio. Faltan: ${missingDirectorio.join(', ')}`, 'error');
      return false;
    }

    // Validar que se seleccionaron todos los miembros de la comisión
    const com1 = document.getElementById('com-miembro1')?.value;
    const com2 = document.getElementById('com-miembro2')?.value;
    const com3 = document.getElementById('com-miembro3')?.value;

    if (!com1 || !com2 || !com3) {
      showToast('La Comisión Electoral debe tener exactamente 3 miembros', 'error');
      return false;
    }

    // Validar que no hay miembros duplicados
    if (!this.validateUniqueSelections()) {
      showToast('Un miembro no puede tener más de un cargo. Revise las selecciones.', 'error');
      return false;
    }

    // Validar que se subieron todos los certificados (dinámico)
    const certs = this.formData.certificatesStep5 || {};
    const certConfig = this.getCertificateConfig();
    const missingCerts = certConfig.filter(c => !certs[c.key] || !certs[c.key].base64);

    if (missingCerts.length > 0) {
      const names = missingCerts.map(c => c.label).join(', ');
      showToast('Faltan certificados de antecedentes: ' + names, 'error');
      return false;
    }

    // Guardar datos antes de continuar
    this.saveStep5Data();

    return true;
  }

  /**
   * Valida paso 6: Firmas
   */
  validateStep6_Firmas() {
    // Verificar que todos los miembros de la comisión hayan firmado
    const commission = this.formData.commission.members || [];
    const signatures = this.formData.signatures || {};
    const signedCount = commission.filter(m => signatures[m.id]).length;

    if (commission.length === 0) {
      showToast('No hay miembros de comisión. Vuelva al Paso 4.', 'error');
      return false;
    }

    if (signedCount < commission.length) {
      const missing = commission.length - signedCount;
      showToast(`Faltan ${missing} firma(s). Todos los miembros de la Comisión Electoral deben firmar.`, 'error');
      return false;
    }

    return true;
  }

  /**
   * Valida paso 3: Configuración de Estatutos
   */
  validateStep3_ConfigEstatutos() {
    try {
      // Los selects tienen valores por defecto, solo guardamos los datos
      const mesAsamblea1 = document.getElementById('config-mes-asamblea-1')?.value || 'Marzo';
      const mesAsamblea2 = document.getElementById('config-mes-asamblea-2')?.value || 'Noviembre';
      const mesInforme = document.getElementById('config-mes-informe')?.value || 'Marzo';
      const mesEleccion = document.getElementById('config-mes-eleccion')?.value || 'Marzo';

      // Guardar configuración de estatutos en formData
      this.formData.configEstatutos = {
        mesAsamblea1: mesAsamblea1,
        mesAsamblea2: mesAsamblea2,
        mesInforme: mesInforme,
        mesEleccion: mesEleccion,
        cuotaIncMin: document.getElementById('config-cuota-inc-min')?.value || '0.1',
        cuotaIncMax: document.getElementById('config-cuota-inc-max')?.value || '0.5',
        cuotaOrdMin: document.getElementById('config-cuota-ord-min')?.value || '0.25',
        cuotaOrdMax: document.getElementById('config-cuota-ord-max')?.value || '0.5',
        entidadDisolucion: document.getElementById('config-entidad-disolucion')?.value || 'Corporación Municipal de Renca'
      };

      return true;
    } catch (error) {
      console.error('Error en validateStep3_ConfigEstatutos:', error);
      showToast('Error al validar configuración de estatutos', 'error');
      return false;
    }
  }

  /**
   * Valida paso 4: Estatutos (antes de solicitar Ministro de Fe)
   */
  validateStep4_Estatutos() {
    const statutesOption = document.querySelector('input[name="statutes-option"]:checked')?.value;

    if (statutesOption === 'custom') {
      const fileInput = document.getElementById('custom-statutes-file');
      if (!fileInput.files.length) {
        showToast('Debe cargar un archivo de estatutos', 'error');
        return false;
      }
    } else {
      // Verificar que hay contenido en los estatutos generados
      const statutesContent = document.getElementById('statutes-editor')?.value;
      if (!statutesContent || statutesContent.trim().length < 100) {
        showToast('Los estatutos deben tener contenido válido', 'error');
        return false;
      }
    }

    // Guardar los estatutos en formData
    const editorContent = document.getElementById('statutes-editor')?.value || '';
    this.formData.estatutos = {
      tipo: statutesOption || 'template',
      contenido: editorContent
    };

    // Guardar también en IndexedDB para recovery/sync
    if (editorContent) {
      indexedDBService.init().then(() => {
        indexedDBService.saveWizardEstatutos(editorContent);
        console.log('✅ Estatutos guardados en IndexedDB');
      }).catch(e => console.warn('⚠️ Error guardando estatutos en IndexedDB:', e));
    }

    return true;
  }

  /**
   * Valida paso 6: Documentos
   */
  validateStep6_Documentos() {
    const errors = [];

    // Validar documentos auto-generados (solo los principales)
    const requiredDocs = [
      'ACTA_CONSTITUTIVA',
      'ESTATUTOS',
      'REGISTRO_SOCIOS'
    ];

    const missingDocs = requiredDocs.filter(doc => !this.formData.documents[doc]);

    if (missingDocs.length > 0) {
      errors.push('Algunos documentos no fueron generados correctamente');
    }

    // Validar certificados de antecedentes (usando certificatesStep5 del paso 5)
    const certs = this.formData.certificatesStep5 || {};
    const certConfig = this.getCertificateConfig();
    const missingCerts = certConfig.filter(c => !certs[c.key] || !certs[c.key].base64);

    if (missingCerts.length > 0) {
      errors.push({
        title: 'Certificados de Antecedentes pendientes',
        items: missingCerts.map(c => c.label)
      });
    }

    if (errors.length > 0) {
      this.showValidationError('No puedes continuar', errors);
      return false;
    }

    return true;
  }

  /**
   * Muestra un modal de error de validación con detalle
   */
  showValidationError(title, errors) {
    // Remover modal anterior si existe
    const existingModal = document.querySelector('.validation-error-modal');
    if (existingModal) existingModal.remove();

    const errorContent = errors.map(err => {
      if (typeof err === 'string') {
        return `<li>${err}</li>`;
      }
      return `
        <li>
          <strong>${err.title}:</strong>
          <ul class="validation-error-subitems">
            ${err.items.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </li>
      `;
    }).join('');

    const modal = document.createElement('div');
    modal.className = 'validation-error-modal';
    modal.innerHTML = `
      <div class="validation-error-content">
        <div class="validation-error-header">
          <span class="validation-error-icon">⚠️</span>
          <h3>${title}</h3>
        </div>
        <div class="validation-error-body">
          <p>Completa los siguientes requisitos antes de continuar:</p>
          <ul class="validation-error-list">
            ${errorContent}
          </ul>
        </div>
        <button class="validation-error-btn" onclick="this.closest('.validation-error-modal').remove()">
          Entendido
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Valida paso 8: Revisión
   */
  validateStep8_Revision() {
    const termsAccepted = document.getElementById('terms-acceptance').checked;

    if (!termsAccepted) {
      showToast('Debe aceptar la declaración de veracidad', 'error');
      return false;
    }

    return true;
  }

  /**
   * Guarda los datos del paso actual
   */
  async saveCurrentStep() {
    switch (this.currentStep) {
      case 1:
        this.saveStep1();
        break;
      case 2:
        // Los miembros se guardan en tiempo real
        break;
      case 3:
        // Config Estatutos - ya guardado en validación
        break;
      case 4:
        // Estatutos
        await this.saveStep4_Estatutos();
        break;
      case 5:
        // Comisión Electoral - guardar fecha de elección
        this.saveStep5_Comision();
        break;
      case 6:
        // Documentos - se guardan en tiempo real
        break;
    }
  }

  /**
   * Guarda datos del paso 1
   */
  saveStep1() {
    const form = document.getElementById('form-step-1');
    const formData = new FormData(form);

    const street = formData.get('street') || '';
    const streetNumber = formData.get('streetNumber') || '';
    const postalCode = formData.get('postalCode') || '';
    const composedAddress = `${street} ${streetNumber}`.trim();

    this.formData.organization = {
      type: formData.get('type'),
      name: formData.get('name'),
      description: formData.get('description'),
      objectives: formData.get('objectives'),
      address: composedAddress,
      street,
      streetNumber,
      postalCode,
      // FORZAR REGIÓN Y COMUNA PARA MUNICIPALIDAD DE RENCA
      region: 'Región Metropolitana de Santiago',
      regionId: '13',
      commune: 'Renca',
      neighborhood: formData.get('neighborhood') || null,
      email: formData.get('email'),
      phone: formData.get('phone'),
      contactPreference: formData.get('contactPreference') || 'phone'
    };
  }

  /**
   * Guarda datos del paso 5: Directorio Provisorio y Comisión Electoral
   */
  saveStep5_Comision() {
    // Llamar al nuevo método de guardado
    this.saveStep5Data();
  }

  /**
   * Guarda datos del paso 4: Estatutos
   */
  async saveStep4_Estatutos() {
    try {
      const statutesOption = document.querySelector('input[name="statutes-option"]:checked')?.value || 'template';

      if (statutesOption === 'template') {
        // Guardar el contenido editado del editor
        const editor = document.getElementById('statutes-editor');
        const editedContent = editor ? editor.value : this.generateEstatutosForEditor();

        this.formData.statutes = {
          type: 'template',
          editedContent: editedContent,
          content: this.generateStatutesFromTemplate()
        };

        // Guardar también en IndexedDB para recovery/sync
        if (editedContent) {
          indexedDBService.init().then(() => {
            indexedDBService.saveWizardEstatutos(editedContent);
          }).catch(() => {});
        }
      } else {
        const fileInput = document.getElementById('custom-statutes-file');
        if (fileInput?.files?.length || this.formData.statutes?.customFile) {
          const file = fileInput.files[0] || this.formData.statutes.customFile;
          const savedFile = await indexedDBService.saveFile(file);

          this.formData.statutes = {
            type: 'custom',
            content: savedFile,
            customFile: file
          };
        }
      }
    } catch (error) {
      console.error('Error en saveStep4_Estatutos:', error);
    }
  }

  /**
   * Genera estatutos desde la plantilla
   */
  generateStatutesFromTemplate() {
    const org = this.formData.organization;

    return {
      title: `ESTATUTOS - ${org.name.toUpperCase()}`,
      articles: [
        {
          title: 'TÍTULO I: NOMBRE, DOMICILIO Y DURACIÓN',
          content: `La organización se denominará "${org.name}" y tendrá su domicilio en ${org.address}, comuna de ${org.commune}.`
        },
        {
          title: 'TÍTULO II: OBJETIVOS',
          content: org.objectives || org.description
        },
        // ... más artículos
      ]
    };
  }

  /**
   * Inicializa el paso actual
   */
  async initializeCurrentStep() {
    switch (this.currentStep) {
      case 1:
        this.initializeStep1();
        break;
      case 2:
        this.initializeStep2();
        break;
      case 3:
        this.initializeStep3_ConfigEstatutos(); // Config Estatutos es paso 3
        break;
      case 4:
        this.initializeStep4_Estatutos(); // Estatutos es paso 4
        break;
      case 5:
        await this.initializeStep5_Comision(); // Comisión es paso 5 (async para cargar config)
        break;
      case 6:
        await this.initializeStep6_Documentos(); // Documentos es paso 6
        break;
    }
  }

  /**
   * Inicializa paso 2: Miembros
   */
  initializeStep2() {
    this.updateMembersCount();
    this.renderMembersList();

    // Botón agregar miembro
    const btnAddMember = document.getElementById('btn-add-member');
    if (btnAddMember) {
      btnAddMember.onclick = () => {
        this.showAddMemberModal();
      };
    }

    // Botón cargar 15 miembros de prueba
    const btnLoadTest15 = document.getElementById('btn-load-test-members-15');
    if (btnLoadTest15) {
      btnLoadTest15.onclick = () => {
        this.loadTestMembers(15, 2); // 15 miembros, 2 menores
      };
    }

    // Botón cargar 200 miembros de prueba (Juntas de Vecinos Renca)
    const btnLoadTest200 = document.getElementById('btn-load-test-members-200');
    if (btnLoadTest200) {
      btnLoadTest200.onclick = () => {
        this.loadTestMembers(200, 30); // 200 miembros, 30 menores
      };
    }
  }

  /**
   * Carga miembros de prueba con cantidad configurable de menores de edad
   * @param {number} cantidad - Cantidad total de miembros a generar
   * @param {number} cantidadMenores - Cantidad de miembros menores de edad (14-17 años)
   */
  loadTestMembers(cantidad = 15, cantidadMenores = 2) {
    if (this.formData.members.length > 0) {
      if (!confirm('Esto reemplazará los miembros actuales. ¿Continuar?')) {
        return;
      }
    }

    const nombres = ['Juan', 'María', 'Pedro', 'Ana', 'Carlos', 'Sofía', 'Luis', 'Carmen', 'José', 'Laura', 'Miguel', 'Patricia', 'Francisco', 'Rosa', 'Antonio', 'Isabel', 'Manuel', 'Teresa', 'Jorge', 'Claudia', 'Ricardo', 'Marta', 'Fernando', 'Andrea', 'Roberto', 'Daniela', 'Eduardo', 'Cecilia', 'Pablo', 'Gloria', 'Sergio', 'Beatriz', 'Andrés', 'Lorena', 'Felipe', 'Mónica', 'Diego', 'Silvia', 'Alejandro', 'Pamela', 'Javier', 'Verónica', 'Rodrigo', 'Carolina', 'Mauricio', 'Francisca', 'Cristián', 'Valentina', 'Gonzalo'];
    const segundosNombres = ['Carlos', 'José', 'Luis', 'Antonio', 'Manuel', 'Alejandro', 'María', 'Isabel', 'Patricia', 'Alejandra', 'Francisca', 'Paz', 'Angélica', 'Elena', 'Ignacio', 'Alberto', 'Andrés', 'Enrique', 'Felipe', 'Cristóbal'];
    const apellidos = ['González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'García', 'Garrido', 'Bravo', 'Reyes', 'Núñez', 'Jara', 'Vera', 'Torres', 'Araya', 'Figueroa', 'Espinoza', 'Sandoval', 'Tapia', 'Castro', 'Vargas'];

    this.formData.members = [];

    // Función para generar fecha de nacimiento según si es menor o mayor de edad
    const generateBirthDate = (isMinor) => {
      const today = new Date();
      let year, month, day;

      if (isMinor) {
        // Menor de edad: entre 14 y 17 años
        const age = 14 + Math.floor(Math.random() * 4); // 14, 15, 16 o 17
        year = today.getFullYear() - age;
      } else {
        // Mayor de edad: entre 18 y 65 años
        const age = 18 + Math.floor(Math.random() * 48); // 18-65
        year = today.getFullYear() - age;
      }

      month = Math.floor(Math.random() * 12) + 1;
      day = Math.floor(Math.random() * 28) + 1;

      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    for (let i = 0; i < cantidad; i++) {
      const primerNombre = nombres[i % nombres.length];
      const segundoNombre = Math.random() > 0.5 ? segundosNombres[Math.floor(Math.random() * segundosNombres.length)] : '';
      const apellidoPaterno = apellidos[Math.floor(Math.random() * apellidos.length)];
      const apellidoMaterno = apellidos[Math.floor(Math.random() * apellidos.length)];
      const rutNum = 10000000 + Math.floor(Math.random() * 15000000);
      const rutDv = this.calculateRutDv(rutNum);

      // Los primeros 'cantidadMenores' serán menores de edad
      const isMinor = i < cantidadMenores;

      this.formData.members.push({
        id: `member-${Date.now()}-${i}`,
        rut: `${rutNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${rutDv}`,
        primerNombre: primerNombre,
        segundoNombre: segundoNombre,
        apellidoPaterno: apellidoPaterno,
        apellidoMaterno: apellidoMaterno,
        // Mantener compatibilidad con código legacy
        firstName: primerNombre + (segundoNombre ? ' ' + segundoNombre : ''),
        lastName: apellidoPaterno + ' ' + apellidoMaterno,
        email: `${primerNombre.toLowerCase()}.${apellidoPaterno.toLowerCase()}${i}@email.com`,
        phone: `+569${(10000000 + Math.floor(Math.random() * 90000000)).toString().substring(0, 8)}`,
        address: `Calle ${Math.floor(Math.random() * 1000) + 1}, Renca`,
        birthDate: generateBirthDate(isMinor),
        isFoundingMember: true,
        joinDate: new Date().toISOString()
      });
    }

    this.updateMembersCount();
    this.renderMembersList();
    showToast(`${cantidad} miembros de prueba cargados (${cantidadMenores} menores de edad).`, 'success');

    // Guardar progreso
    this.saveProgress();
  }

  /**
   * Calcula dígito verificador del RUT
   */
  calculateRutDv(rut) {
    let sum = 0;
    let multiplier = 2;
    const rutStr = rut.toString();

    for (let i = rutStr.length - 1; i >= 0; i--) {
      sum += parseInt(rutStr[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = sum % 11;
    const dv = 11 - remainder;

    if (dv === 11) return '0';
    if (dv === 10) return 'K';
    return dv.toString();
  }

  /**
   * Actualiza contador de miembros
   */
  updateMembersCount() {
    const countElement = document.getElementById('members-count');
    if (countElement) {
      countElement.textContent = this.formData.members.length;

      // Determinar mínimo según tipo de organización
      const orgType = this.formData.organization?.type;
      const minRequired = orgType === 'JUNTA_VECINOS' ? 200 : 15;

      if (this.formData.members.length >= minRequired) {
        countElement.style.color = 'var(--success-color, #10b981)';
      } else {
        countElement.style.color = 'var(--error-color, #ef4444)';
      }
    }
  }

  /**
   * Calcula la edad a partir de una fecha de nacimiento
   */
  calculateAge(birthDate) {
    if (!birthDate) return null;

    const today = new Date();
    const birth = new Date(birthDate);

    if (isNaN(birth.getTime())) return null;

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Renderiza lista de miembros
   */
  renderMembersList() {
    const listContainer = document.getElementById('members-list');

    if (this.formData.members.length === 0) {
      listContainer.innerHTML = '<p class="text-muted">No hay miembros agregados aún.</p>';
      return;
    }

    listContainer.innerHTML = this.formData.members.map((member, index) => {
      // SEGURIDAD: Sanitizar todos los datos del usuario para prevenir XSS
      const rawFullName = `${member.primerNombre || member.firstName || ''} ${member.segundoNombre || ''} ${member.apellidoPaterno || member.lastName?.split(' ')[0] || ''} ${member.apellidoMaterno || member.lastName?.split(' ')[1] || ''}`.replace(/\s+/g, ' ').trim();
      const fullName = escapeHtml(rawFullName);
      const safeRut = escapeHtml(member.rut || '');
      const safeEmail = escapeHtml(member.email || '');
      const safePhone = escapeHtml(member.phone || '');

      // Calcular edad
      const age = this.calculateAge(member.birthDate);
      const ageDisplay = age !== null ? `${age} años` : '';
      const isMinor = age !== null && age < 18;

      return `
      <div class="member-card ${isMinor ? 'member-minor' : ''}">
        <div class="member-number">${index + 1}</div>
        <div class="member-info">
          <div class="member-name">
            ${fullName}
            ${age !== null ? `<span class="member-age ${isMinor ? 'age-minor' : ''}">${ageDisplay}${isMinor ? ' (menor)' : ''}</span>` : ''}
          </div>
          <div class="member-details">
            <span class="member-detail-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              ${safeRut}
            </span>
            <span class="member-detail-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              ${safeEmail}
            </span>
            <span class="member-detail-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              ${safePhone}
            </span>
          </div>
        </div>
        <div class="member-actions">
          <button class="btn-icon btn-edit-member" data-index="${index}" title="Editar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon btn-remove-member" data-index="${index}" title="Eliminar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    }).join('');

    // Eventos de editar
    listContainer.querySelectorAll('.btn-edit-member').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(btn.dataset.index);
        this.showEditMemberModal(index);
      });
    });

    // Eventos de eliminar
    listContainer.querySelectorAll('.btn-remove-member').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(btn.dataset.index);
        this.removeMember(index);
      });
    });
  }

  /**
   * Muestra modal para editar miembro
   */
  showEditMemberModal(index) {
    const member = this.formData.members[index];
    if (!member) return;

    const memberNumber = index + 1;
    const fullName = `${member.primerNombre || member.firstName || ''} ${member.segundoNombre || ''} ${member.apellidoPaterno || member.lastName?.split(' ')[0] || ''} ${member.apellidoMaterno || member.lastName?.split(' ')[1] || ''}`.trim();

    const modalHTML = `
      <div class="modal-overlay modal-edit-member-overlay" id="edit-member-modal">
        <div class="modal-content modal-edit-member-modern">
          <div class="modal-edit-header">
            <div class="modal-edit-title-section">
              <div class="member-avatar-large">
                ${(member.primerNombre?.[0] || member.firstName?.[0] || 'M').toUpperCase()}
              </div>
              <div class="modal-edit-title-info">
                <h3>Editar Miembro #${memberNumber}</h3>
                <p class="member-current-name">${fullName}</p>
              </div>
            </div>
            <button class="modal-close-modern" id="close-edit-modal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <form id="edit-member-form" class="modal-edit-form">
            <div class="form-section">
              <h4 class="form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Información Personal
              </h4>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label>RUT <span class="required">*</span></label>
                  <input type="text" name="rut" required value="${member.rut}" placeholder="12.345.678-9">
                </div>
                <div class="form-group">
                  <label>Fecha de Nacimiento <span class="required">*</span></label>
                  <input type="date" name="birthDate" required value="${member.birthDate || ''}">
                </div>
              </div>
            </div>

            <div class="form-section">
              <h4 class="form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Nombre Completo
              </h4>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label>Primer Nombre <span class="required">*</span></label>
                  <input type="text" name="primerNombre" required value="${member.primerNombre || member.firstName || ''}" placeholder="Juan">
                </div>
                <div class="form-group">
                  <label>Segundo Nombre</label>
                  <input type="text" name="segundoNombre" value="${member.segundoNombre || ''}" placeholder="Carlos">
                </div>
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label>Apellido Paterno <span class="required">*</span></label>
                  <input type="text" name="apellidoPaterno" required value="${member.apellidoPaterno || member.lastName?.split(' ')[0] || ''}" placeholder="Pérez">
                </div>
                <div class="form-group">
                  <label>Apellido Materno <span class="required">*</span></label>
                  <input type="text" name="apellidoMaterno" required value="${member.apellidoMaterno || member.lastName?.split(' ')[1] || ''}" placeholder="González">
                </div>
              </div>
            </div>

            <div class="form-section">
              <h4 class="form-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                Datos de Contacto
              </h4>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label>Email <span class="required">*</span></label>
                  <input type="email" name="email" required value="${member.email}">
                </div>
                <div class="form-group">
                  <label>Teléfono <span class="required">*</span></label>
                  <input type="tel" name="phone" required value="${member.phone}">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Dirección <span class="required">*</span></label>
                  <input type="text" name="address" required value="${member.address}">
                </div>
              </div>
            </div>

            <div class="modal-edit-actions">
              <div class="actions-left">
                <button type="button" class="btn-danger-outline" id="delete-member-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Eliminar Miembro
                </button>
              </div>
              <div class="actions-right">
                <button type="button" class="btn-secondary" id="cancel-edit">Cancelar</button>
                <button type="submit" class="btn-primary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Guardar Cambios
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Eventos
    document.getElementById('close-edit-modal').addEventListener('click', () => {
      document.getElementById('edit-member-modal').remove();
    });

    document.getElementById('cancel-edit').addEventListener('click', () => {
      document.getElementById('edit-member-modal').remove();
    });

    document.getElementById('delete-member-btn').addEventListener('click', () => {
      document.getElementById('edit-member-modal').remove();
      this.removeMember(index);
    });

    document.getElementById('edit-member-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.updateMember(index, new FormData(e.target));
      document.getElementById('edit-member-modal').remove();
    });

    // Click outside to close
    document.getElementById('edit-member-modal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        document.getElementById('edit-member-modal').remove();
      }
    });
  }

  /**
   * Actualiza un miembro
   */
  updateMember(index, formData) {
    const primerNombre = formData.get('primerNombre');
    const segundoNombre = formData.get('segundoNombre');
    const apellidoPaterno = formData.get('apellidoPaterno');
    const apellidoMaterno = formData.get('apellidoMaterno');

    this.formData.members[index] = {
      ...this.formData.members[index],
      rut: formData.get('rut'),
      primerNombre,
      segundoNombre,
      apellidoPaterno,
      apellidoMaterno,
      // Mantener compatibilidad con código legacy
      firstName: primerNombre + (segundoNombre ? ' ' + segundoNombre : ''),
      lastName: apellidoPaterno + ' ' + apellidoMaterno,
      email: formData.get('email'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      birthDate: formData.get('birthDate')
    };

    this.renderMembersList();
    showToast('Miembro actualizado correctamente', 'success');
  }

  /**
   * Muestra modal para agregar miembro
   */
  showAddMemberModal() {
    const modalHTML = `
      <div class="modal-overlay" id="add-member-modal">
        <div class="modal-content modal-member-styled">
          <button class="modal-close-btn" id="close-member-modal">&times;</button>

          <div class="modal-member-header">
            <div class="modal-member-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
            </div>
            <h3>Agregar Miembro Fundador</h3>
            <p>Complete los datos del nuevo integrante</p>
          </div>

          <form id="add-member-form" class="modal-member-form">
            <div class="form-section">
              <div class="form-section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Identificación
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label>RUT <span class="required">*</span></label>
                  <input type="text" name="rut" required placeholder="12.345.678-9" class="input-styled">
                </div>
                <div class="form-group">
                  <label>Fecha de Nacimiento <span class="required">*</span></label>
                  <input type="date" name="birthDate" required max="${new Date().toISOString().split('T')[0]}" class="input-styled">
                  <small class="form-help">Mínimo 14 años según Ley 19.418</small>
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Nombre Completo
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label>Primer Nombre <span class="required">*</span></label>
                  <input type="text" name="primerNombre" required placeholder="Juan" class="input-styled">
                </div>
                <div class="form-group">
                  <label>Segundo Nombre</label>
                  <input type="text" name="segundoNombre" placeholder="Carlos" class="input-styled">
                </div>
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label>Apellido Paterno <span class="required">*</span></label>
                  <input type="text" name="apellidoPaterno" required placeholder="Pérez" class="input-styled">
                </div>
                <div class="form-group">
                  <label>Apellido Materno <span class="required">*</span></label>
                  <input type="text" name="apellidoMaterno" required placeholder="González" class="input-styled">
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                Contacto
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label>Email <span class="required">*</span></label>
                  <input type="email" name="email" required placeholder="correo@ejemplo.com" class="input-styled">
                </div>
                <div class="form-group">
                  <label>Teléfono <span class="required">*</span></label>
                  <input type="tel" name="phone" required placeholder="+56912345678" class="input-styled">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Dirección <span class="required">*</span></label>
                  <input type="text" name="address" required placeholder="Calle, número, depto (opcional)" class="input-styled">
                </div>
              </div>
            </div>

            <div class="modal-member-actions">
              <button type="button" class="btn-cancel" id="cancel-member">Cancelar</button>
              <button type="submit" class="btn-submit">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                Agregar Miembro
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Eventos
    document.getElementById('close-member-modal').addEventListener('click', () => {
      document.getElementById('add-member-modal').remove();
    });

    document.getElementById('cancel-member').addEventListener('click', () => {
      document.getElementById('add-member-modal').remove();
    });

    document.getElementById('add-member-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addMember(new FormData(e.target));
      document.getElementById('add-member-modal').remove();
    });
  }

  /**
   * Agrega un miembro
   */
  addMember(formData) {
    const birthDate = formData.get('birthDate');

    // Validar edad mínima (14 años)
    if (birthDate) {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      if (age < 14) {
        showToast('El miembro debe tener al menos 14 años según la Ley 19.418', 'error');
        return;
      }
    }

    const primerNombre = formData.get('primerNombre');
    const segundoNombre = formData.get('segundoNombre') || '';
    const apellidoPaterno = formData.get('apellidoPaterno');
    const apellidoMaterno = formData.get('apellidoMaterno');

    const member = {
      id: `member-${Date.now()}`,
      rut: formData.get('rut'),
      primerNombre,
      segundoNombre,
      apellidoPaterno,
      apellidoMaterno,
      // Mantener compatibilidad con código legacy
      firstName: primerNombre + (segundoNombre ? ' ' + segundoNombre : ''),
      lastName: apellidoPaterno + ' ' + apellidoMaterno,
      email: formData.get('email'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      birthDate: birthDate,
      isFoundingMember: true,
      joinDate: new Date().toISOString()
    };

    this.formData.members.push(member);
    this.updateMembersCount();
    this.renderMembersList();
    showToast('Miembro agregado correctamente', 'success');
  }

  /**
   * Elimina un miembro
   */
  removeMember(index) {
    const member = this.formData.members[index];
    if (!member) return;

    const memberName = `${member.primerNombre || member.firstName || ''} ${member.apellidoPaterno || member.lastName || ''}`.trim();

    const modalHTML = `
      <div class="modal-overlay modal-confirm-overlay" id="confirm-delete-modal">
        <div class="modal-content modal-confirm-delete">
          <div class="modal-confirm-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3 class="modal-confirm-title">¿Eliminar Miembro?</h3>
          <p class="modal-confirm-message">
            ¿Estás seguro de que deseas eliminar a <strong>${memberName}</strong> de la lista de miembros fundadores?
          </p>
          <p class="modal-confirm-warning">
            Esta acción no se puede deshacer.
          </p>
          <div class="modal-confirm-actions">
            <button type="button" class="btn-secondary" id="cancel-delete">Cancelar</button>
            <button type="button" class="btn-danger" id="confirm-delete">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Sí, Eliminar
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Eventos
    document.getElementById('cancel-delete').addEventListener('click', () => {
      document.getElementById('confirm-delete-modal').remove();
    });

    document.getElementById('confirm-delete').addEventListener('click', () => {
      this.formData.members.splice(index, 1);
      this.updateMembersCount();
      this.renderMembersList();
      showToast('Miembro eliminado correctamente', 'success');
      document.getElementById('confirm-delete-modal').remove();
    });

    // Click outside to cancel
    document.getElementById('confirm-delete-modal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        document.getElementById('confirm-delete-modal').remove();
      }
    });
  }

  /**
   * Inicializa paso 3: Configuración de Estatutos
   */
  initializeStep3_ConfigEstatutos() {
    // Si ya hay datos guardados, cargarlos en el formulario
    const config = this.formData.configEstatutos;
    if (config) {
      const fields = [
        { id: 'config-mes-asamblea-1', value: config.mesAsamblea1 },
        { id: 'config-mes-asamblea-2', value: config.mesAsamblea2 },
        { id: 'config-mes-informe', value: config.mesInforme },
        { id: 'config-mes-eleccion', value: config.mesEleccion },
        { id: 'config-cuota-inc-min', value: config.cuotaIncMin },
        { id: 'config-cuota-inc-max', value: config.cuotaIncMax },
        { id: 'config-cuota-ord-min', value: config.cuotaOrdMin },
        { id: 'config-cuota-ord-max', value: config.cuotaOrdMax },
        { id: 'config-entidad-disolucion', value: config.entidadDisolucion }
      ];

      fields.forEach(field => {
        const el = document.getElementById(field.id);
        if (el && field.value) {
          el.value = field.value;
        }
      });
    }
  }

  /**
   * Inicializa paso 5: Directorio Provisorio y Comisión Electoral
   */
  async initializeStep5_Comision() {
    // Obtener el tipo de organización seleccionada
    const orgType = this.formData.organization?.type || 'DEFAULT';

    // Obtener configuración desde API (async) con fallback a local
    const directorioConfig = await fetchDirectorioConfig(orgType);

    // Guardar la configuración actual para uso en otras funciones
    this.currentDirectorioConfig = directorioConfig;

    // Renderizar los cargos del directorio dinámicamente
    this.renderDirectorioCargos(directorioConfig);

    // Renderizar los badges de certificados
    this.renderCertificateBadges(directorioConfig);

    // Actualizar el texto de información
    this.updateDirectorioInfoText(directorioConfig, orgType);

    // Poblar los selects con los miembros fundadores
    this.populateMemberSelects();

    // Configurar eventos para los selects
    this.setupDirectorioSelects();

    // Configurar eventos para los inputs de certificados
    this.setupCertificateInputs();

    // Restaurar datos guardados si existen
    this.restoreStep5Data();

    // Actualizar opciones deshabilitadas según selecciones previas
    this.updateDisabledOptions();

    // Restaurar la UI de los botones de certificados ya cargados
    this.restoreCertificateButtonsUI();

    // Actualizar el estado de los badges de certificados
    this.updateCertificateBadges();
  }

  /**
   * Renderiza los cargos del directorio dinámicamente según el tipo de organización
   */
  renderDirectorioCargos(config) {
    const container = document.getElementById('directorio-cargos-container');
    if (!container) return;

    let html = '';
    config.cargos.forEach((cargo, index) => {
      const isLast = index === config.cargos.length - 1;
      html += generateCargoHTML(cargo, isLast);
    });

    container.innerHTML = html;
  }

  /**
   * Renderiza los badges de certificados dinámicamente
   */
  renderCertificateBadges(config) {
    const container = document.getElementById('cert-progress');
    if (!container) return;

    container.innerHTML = generateCertBadgesHTML(config);

    // Actualizar el texto de certificados requeridos
    const totalCerts = config.cargos.length + 3; // Directorio + 3 comisión electoral
    const textEl = document.getElementById('cert-required-text');
    if (textEl) {
      textEl.innerHTML = `
        Debe subir el <strong>certificado de antecedentes</strong> de cada miembro del Directorio Provisorio
        y la Comisión Electoral (<strong>${totalCerts} certificados</strong> en total). Puede obtenerlos en <a href="https://www.registrocivil.cl" target="_blank" style="color: #dc2626;">www.registrocivil.cl</a>
      `;
    }
  }

  /**
   * Actualiza el texto informativo del directorio
   */
  updateDirectorioInfoText(config, orgType) {
    const countEl = document.getElementById('directorio-required-count');
    if (countEl) {
      const orgName = getOrgTypeName(orgType);
      countEl.innerHTML = `📋 Según los estatutos de ${orgName}: <strong>${config.totalRequerido} miembros</strong> requeridos para el Directorio`;
    }
  }

  /**
   * Pobla los selects de miembros con los miembros fundadores MAYORES DE 18 AÑOS
   * Según la ley, solo mayores de edad pueden ser parte del Directorio y Comisión Electoral
   */
  populateMemberSelects() {
    const members = this.formData.members || [];
    const selects = document.querySelectorAll('.member-select');
    const config = this.currentDirectorioConfig || getDirectorioConfig('DEFAULT');

    // Calcular el total de miembros requeridos (directorio + 3 comisión electoral)
    const totalRequired = config.totalRequerido + 3;

    // Filtrar solo miembros mayores de 18 años
    const adultMembers = members.filter((member, index) => {
      const age = this.calculateAge(member.birthDate);
      return age !== null && age >= 18;
    });

    // Mostrar advertencia si no hay suficientes mayores de edad
    if (adultMembers.length < totalRequired) {
      const warningEl = document.querySelector('.certificates-summary');
      if (warningEl) {
        const existingWarning = document.getElementById('no-adults-warning');
        if (!existingWarning) {
          const warning = document.createElement('div');
          warning.id = 'no-adults-warning';
          warning.style.cssText = 'background: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 12px; margin-bottom: 16px;';
          warning.innerHTML = '<strong style="color: #991b1b;">⚠️ Atención:</strong> <span style="color: #991b1b;">Solo hay ' + adultMembers.length + ' miembros mayores de 18 años. Se requieren al menos ' + totalRequired + ' para completar el Directorio Provisorio (' + config.totalRequerido + ') y la Comisión Electoral (3).</span>';
          warningEl.parentNode.insertBefore(warning, warningEl);
        }
      }
    }

    selects.forEach(select => {
      // Limpiar opciones existentes excepto la primera
      while (select.options.length > 1) {
        select.remove(1);
      }

      // Agregar solo miembros mayores de 18 años
      members.forEach((member, index) => {
        const age = this.calculateAge(member.birthDate);
        if (age !== null && age >= 18) {
          const option = document.createElement('option');
          option.value = index.toString();
          const fullName = (member.firstName || member.primerNombre || '') + ' ' + (member.lastName || ((member.apellidoPaterno || '') + ' ' + (member.apellidoMaterno || '')).trim());
          option.textContent = fullName.trim() + ' (' + (member.rut || 'Sin RUT') + ') - ' + age + ' años';
          select.appendChild(option);
        }
      });
    });
  }

  /**
   * Obtiene los IDs de todos los selects (directorio + comisión electoral)
   */
  getAllSelectIds() {
    const config = this.currentDirectorioConfig || getDirectorioConfig('DEFAULT');
    const directorioIds = config.cargos.map(cargo => `dir-${cargo.id}`);
    const comisionIds = ['com-miembro1', 'com-miembro2', 'com-miembro3'];
    return [...directorioIds, ...comisionIds];
  }

  /**
   * Configura eventos para los selects del directorio y comisión
   */
  setupDirectorioSelects() {
    const allSelects = this.getAllSelectIds();

    allSelects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select) {
        select.addEventListener('change', () => {
          this.updateDisabledOptions();
          this.saveStep5Data();
        });
      }
    });
  }

  /**
   * Actualiza las opciones deshabilitadas en todos los selects
   * Los miembros ya seleccionados en un cargo quedan deshabilitados en los demás
   */
  updateDisabledOptions() {
    const allSelectIds = this.getAllSelectIds();

    // Obtener todos los valores seleccionados actualmente
    const selectedValues = {};
    allSelectIds.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select && select.value) {
        selectedValues[selectId] = select.value;
      }
    });

    // Actualizar cada select
    allSelectIds.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (!select) return;

      const currentValue = select.value;

      // Para cada opción en este select
      Array.from(select.options).forEach(option => {
        if (option.value === '') return; // Saltar la opción vacía

        // Verificar si este valor está seleccionado en OTRO select
        let isSelectedElsewhere = false;
        for (const [otherSelectId, otherValue] of Object.entries(selectedValues)) {
          if (otherSelectId !== selectId && otherValue === option.value) {
            isSelectedElsewhere = true;
            break;
          }
        }

        // Deshabilitar si está seleccionado en otro lugar
        option.disabled = isSelectedElsewhere;

        // Agregar estilo visual para opciones deshabilitadas
        if (isSelectedElsewhere) {
          option.style.color = '#9ca3af';
          option.style.fontStyle = 'italic';
        } else {
          option.style.color = '';
          option.style.fontStyle = '';
        }
      });
    });
  }

  /**
   * Valida que no se repitan miembros entre directorio y comisión
   */
  validateUniqueSelections() {
    const allSelects = this.getAllSelectIds();

    const selectedValues = [];
    let hasDuplicates = false;

    allSelects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select && select.value) {
        if (selectedValues.includes(select.value)) {
          hasDuplicates = true;
        } else {
          selectedValues.push(select.value);
        }
      }
    });

    return !hasDuplicates;
  }

  /**
   * Obtiene la configuración de certificados dinámicamente basado en el tipo de organización
   */
  getCertificateConfig() {
    const config = this.currentDirectorioConfig || getDirectorioConfig('DEFAULT');

    // Certificados del directorio (dinámico)
    const directorioConfig = config.cargos.map(cargo => ({
      id: `cert-${cargo.id}`,
      badge: `cert-badge-${cargo.id}`,
      name: `cert-${cargo.id}-name`,
      key: cargo.id,
      label: cargo.nombre
    }));

    // Certificados de la comisión electoral (siempre 3)
    const comisionConfig = [
      { id: 'cert-com1', badge: 'cert-badge-com1', name: 'cert-com1-name', key: 'comision1', label: 'Com. 1' },
      { id: 'cert-com2', badge: 'cert-badge-com2', name: 'cert-com2-name', key: 'comision2', label: 'Com. 2' },
      { id: 'cert-com3', badge: 'cert-badge-com3', name: 'cert-com3-name', key: 'comision3', label: 'Com. 3' }
    ];

    return [...directorioConfig, ...comisionConfig];
  }

  /**
   * Configura eventos para los inputs de certificados
   */
  setupCertificateInputs() {
    const certInputs = this.getCertificateConfig();

    // Límite de tamaño por certificado: 2MB
    const MAX_CERT_SIZE = 2 * 1024 * 1024;

    certInputs.forEach(certInfo => {
      const input = document.getElementById(certInfo.id);
      if (input) {
        input.addEventListener('change', async (e) => {
          if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Validar tamaño del archivo
            if (file.size > MAX_CERT_SIZE) {
              const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
              showToast(`El archivo "${file.name}" pesa ${sizeMB}MB. El máximo es 2MB. Usa un PDF más liviano o comprime la imagen.`, 'error');
              e.target.value = '';
              return;
            }

            // Comprimir imágenes antes de convertir a base64
            let base64Data;
            if (file.type.startsWith('image/')) {
              base64Data = await this.compressImage(file, 1200, 0.7);
            } else {
              base64Data = await this.fileToBase64(file);
            }

            // Guardar el archivo (con base64 en lugar de File object)
            if (!this.formData.certificatesStep5) {
              this.formData.certificatesStep5 = {};
            }
            const certData = {
              name: file.name,
              size: file.size,
              type: file.type,
              base64: base64Data // Guardar como base64 en lugar de File object
            };
            this.formData.certificatesStep5[certInfo.key] = certData;

            // Guardar también en IndexedDB para persistencia (localStorage tiene límite de ~5MB)
            try {
              await indexedDBService.init(); // Asegurar que esté inicializada
              await indexedDBService.saveWizardCertificate(certInfo.key, certData);
              console.log('✅ Certificado guardado en IndexedDB:', certInfo.key, certData.name);
            } catch (e) {
              console.error('❌ Error guardando certificado en IndexedDB:', e);
            }

            // Actualizar UI
            const nameDisplay = document.getElementById(certInfo.name);
            if (nameDisplay) {
              nameDisplay.textContent = file.name;
              nameDisplay.style.color = '#22c55e';
            }

            // Cambiar el botón
            const button = input.previousElementSibling || input.parentElement.querySelector('.btn-upload-cert');
            if (button && button.tagName === 'BUTTON') {
              button.textContent = '✅ ' + file.name.substring(0, 15) + (file.name.length > 15 ? '...' : '');
              button.style.background = '#dcfce7';
              button.style.borderColor = '#22c55e';
              button.style.color = '#166534';
            }

            // Actualizar badge
            this.updateCertificateBadges();

            // Guardar progreso
            this.saveProgress();
          }
        });
      }
    });
  }

  /**
   * Convierte un archivo a base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  /**
   * Comprime una imagen redimensionándola y reduciendo calidad
   * @param {File} file - Archivo de imagen
   * @param {number} maxWidth - Ancho máximo en px
   * @param {number} quality - Calidad JPEG 0-1
   * @returns {Promise<string>} Base64 de la imagen comprimida
   */
  compressImage(file, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round(h * maxWidth / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Restaura la UI de los botones de certificados ya cargados
   * Se llama después de restaurar el HTML del paso 5
   */
  restoreCertificateButtonsUI() {
    const certs = this.formData.certificatesStep5 || {};
    const certConfig = this.getCertificateConfig();

    certConfig.forEach(certInfo => {
      const cert = certs[certInfo.key];
      if (cert && cert.base64) {
        const input = document.getElementById(certInfo.id);
        if (input) {
          const wrapper = input.closest('.file-upload-wrapper');
          const button = wrapper ? wrapper.querySelector('.btn-upload-cert') : null;

          if (button) {
            const displayName = cert.name.length > 15
              ? cert.name.substring(0, 15) + '...'
              : cert.name;
            button.textContent = '✅ ' + displayName;
            button.style.background = '#dcfce7';
            button.style.borderColor = '#22c55e';
            button.style.color = '#166534';
          }
        }
      }
    });
  }

  /**
   * Actualiza los badges de estado de certificados
   */
  updateCertificateBadges() {
    const certs = this.formData.certificatesStep5 || {};
    const certConfig = this.getCertificateConfig();

    certConfig.forEach(certInfo => {
      const badge = document.getElementById(certInfo.badge);
      if (badge) {
        const hasCert = certs[certInfo.key] && certs[certInfo.key].base64;
        const shortLabel = certInfo.label.length > 10 ? certInfo.label.substring(0, 10) + '.' : certInfo.label;

        if (hasCert) {
          badge.textContent = '✅ ' + shortLabel;
          badge.style.background = '#dcfce7';
          badge.style.color = '#166534';
          badge.style.border = '1px solid #22c55e';
        } else {
          badge.textContent = '❌ ' + shortLabel;
          badge.style.background = '#fef2f2';
          badge.style.color = '#991b1b';
          badge.style.border = '1px solid #fecaca';
        }
        badge.style.padding = '4px 8px';
        badge.style.borderRadius = '12px';
        badge.style.fontSize = '12px';
        badge.style.fontWeight = '500';
      }
    });
  }

  /**
   * Guarda los datos del paso 5
   */
  saveStep5Data() {
    if (!this.formData.directorioProvisorio) {
      this.formData.directorioProvisorio = {};
    }
    if (!this.formData.comisionElectoral) {
      this.formData.comisionElectoral = {};
    }

    const members = this.formData.members || [];
    const config = this.currentDirectorioConfig || getDirectorioConfig('DEFAULT');

    console.log('🔍 [saveStep5Data] members disponibles:', members.length);
    console.log('🔍 [saveStep5Data] cargos del directorio:', config.cargos.map(c => c.id));

    // Guardar directorio dinámicamente según los cargos configurados
    config.cargos.forEach(cargo => {
      const selectEl = document.getElementById(`dir-${cargo.id}`);
      const idx = selectEl?.value;

      if (idx) {
        this.formData.directorioProvisorio[cargo.id] = members[parseInt(idx)];
        console.log(`✅ [saveStep5Data] ${cargo.nombre} guardado:`, this.formData.directorioProvisorio[cargo.id]);
      }
    });

    console.log('📦 [saveStep5Data] directorioProvisorio final:', this.formData.directorioProvisorio);

    // Guardar comisión electoral
    const com1Idx = document.getElementById('com-miembro1')?.value;
    const com2Idx = document.getElementById('com-miembro2')?.value;
    const com3Idx = document.getElementById('com-miembro3')?.value;

    const comisionMembers = [];
    if (com1Idx) comisionMembers.push(members[parseInt(com1Idx)]);
    if (com2Idx) comisionMembers.push(members[parseInt(com2Idx)]);
    if (com3Idx) comisionMembers.push(members[parseInt(com3Idx)]);

    this.formData.commission.members = comisionMembers;
    console.log('📦 [saveStep5Data] commission.members final:', this.formData.commission.members);

    // Guardar progreso
    this.saveProgress();
  }

  /**
   * Restaura los datos guardados del paso 5
   */
  restoreStep5Data() {
    const members = this.formData.members || [];
    const dir = this.formData.directorioProvisorio || {};
    const com = this.formData.commission?.members || [];
    const config = this.currentDirectorioConfig || getDirectorioConfig('DEFAULT');

    // Restaurar selects del directorio dinámicamente
    config.cargos.forEach(cargo => {
      if (dir[cargo.id]) {
        const idx = members.findIndex(m => m.rut === dir[cargo.id].rut);
        if (idx >= 0) {
          const select = document.getElementById(`dir-${cargo.id}`);
          if (select) select.value = idx.toString();
        }
      }
    });

    // Restaurar selects de la comisión
    com.forEach((member, i) => {
      const idx = members.findIndex(m => m.rut === member.rut);
      if (idx >= 0) {
        const selectId = 'com-miembro' + (i + 1);
        const select = document.getElementById(selectId);
        if (select) select.value = idx.toString();
      }
    });

    // Restaurar nombres de archivos de certificados usando configuración dinámica
    const certs = this.formData.certificatesStep5 || {};
    const certConfigList = this.getCertificateConfig();

    certConfigList.forEach(certInfo => {
      if (certs[certInfo.key] && certs[certInfo.key].name) {
        const hasBase64 = certs[certInfo.key].base64;
        const nameEl = document.getElementById(certInfo.name);
        const input = document.getElementById(certInfo.id);
        const button = input?.parentElement?.querySelector('.btn-upload-cert');

        if (hasBase64) {
          if (nameEl) {
            nameEl.textContent = certs[certInfo.key].name;
            nameEl.style.color = '#22c55e';
          }
          if (button) {
            const shortName = certs[certInfo.key].name.length > 15
              ? certs[certInfo.key].name.substring(0, 15) + '...'
              : certs[certInfo.key].name;
            button.textContent = '✅ ' + shortName;
            button.style.background = '#dcfce7';
            button.style.borderColor = '#22c55e';
            button.style.color = '#166534';
          }
        } else {
          if (nameEl) {
            nameEl.textContent = '⚠️ Re-subir: ' + certs[certInfo.key].name;
            nameEl.style.color = '#f59e0b';
          }
          if (button) {
            button.textContent = '⚠️ Re-subir archivo';
            button.style.background = '#fef3c7';
            button.style.borderColor = '#f59e0b';
            button.style.color = '#92400e';
          }
          delete certs[certInfo.key];
        }
      }
    });
  }

  /**
   * Renderiza lista de comisión electoral (modo lectura)
   */
  renderCommissionListReadOnly() {
    const listContainer = document.getElementById('commission-list');
    const commission = this.formData.commission.members;

    if (!commission || commission.length === 0) {
      listContainer.innerHTML = `
        <div class="no-commission-warning">
          <div class="warning-icon">⚠️</div>
          <p>No se ha registrado la Comisión Electoral.</p>
          <p class="text-muted small">Esta información debió ser definida en la Asamblea Constitutiva.</p>
        </div>
      `;
      return;
    }

    const roles = ['Presidente', 'Secretario', 'Vocal'];
    const roleIcons = ['👤', '📝', '🗳️'];

    // SEGURIDAD: Sanitizar datos de miembros para prevenir XSS
    listContainer.innerHTML = commission.map((member, index) => {
      const safeFirstName = escapeHtml(member.firstName || '');
      const safeLastName = escapeHtml(member.lastName || '');
      const safeRut = escapeHtml(member.rut || 'RUT no registrado');

      return `
        <div class="commission-member-display-card">
          <div class="member-role-icon">${roleIcons[index]}</div>
          <div class="member-display-info">
            <div class="member-role-badge ${index === 0 ? 'president' : index === 1 ? 'secretary' : 'vocal'}">${roles[index]}</div>
            <div class="member-name">${safeFirstName} ${safeLastName}</div>
            <div class="member-rut">${safeRut}</div>
          </div>
          <div class="member-verified-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Renderiza la fecha de elección en modo lectura
   */
  renderElectionDateDisplay() {
    const dateContainer = document.getElementById('election-date-display');
    const electionDate = this.formData.commission.electionDate;

    if (!dateContainer) return;

    if (!electionDate) {
      dateContainer.innerHTML = `
        <div class="election-date-info">
          <div class="date-icon">📅</div>
          <div class="date-details">
            <span class="date-label">Fecha de Elección</span>
            <span class="date-value text-muted">Pendiente de definir</span>
          </div>
        </div>
      `;
      return;
    }

    const date = new Date(electionDate);
    const formattedDate = date.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    dateContainer.innerHTML = `
      <div class="election-date-info confirmed">
        <div class="date-icon">📅</div>
        <div class="date-details">
          <span class="date-label">Fecha de Elección Programada</span>
          <span class="date-value">${formattedDate}</span>
        </div>
        <div class="date-confirmed-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Confirmada
        </div>
      </div>
    `;
  }

  /**
   * Renderiza lista de comisión electoral (modo edición - legacy)
   */
  renderCommissionList() {
    const listContainer = document.getElementById('commission-list');

    if (this.formData.commission.members.length === 0) {
      listContainer.innerHTML = '<p class="text-muted">Seleccione 3 miembros de la lista de socios.</p>';
      return;
    }

    // SEGURIDAD: Sanitizar datos de miembros para prevenir XSS
    listContainer.innerHTML = this.formData.commission.members.map((member, index) => {
      const safeFirstName = escapeHtml(member.firstName || '');
      const safeLastName = escapeHtml(member.lastName || '');

      return `
        <div class="commission-member-card">
          <div class="member-info">
            <div class="member-name">${safeFirstName} ${safeLastName}</div>
            <div class="member-role">${index === 0 ? 'Presidente' : index === 1 ? 'Secretario' : 'Vocal'}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Muestra modal para seleccionar miembros de comisión
   */
  showSelectCommissionModal() {
    if (this.formData.members.length < 3) {
      showToast('Necesitas al menos 3 miembros registrados', 'error');
      return;
    }

    const modalHTML = `
      <div class="modal-overlay" id="select-commission-modal">
        <div class="modal-content modal-commission-styled">
          <button class="modal-close-btn" id="close-commission-modal">&times;</button>

          <div class="modal-commission-header">
            <div class="modal-commission-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h3>Comisión Electoral</h3>
            <p>Seleccione exactamente 3 miembros para conformar la comisión</p>
          </div>

          <div class="modal-commission-body">
            <div class="commission-counter">
              <span class="counter-label">Miembros seleccionados:</span>
              <span class="counter-value" id="commission-counter">0</span>
              <span class="counter-total">/ 3</span>
            </div>

            <div class="commission-roles-info">
              <div class="role-badge role-president">1° Presidente</div>
              <div class="role-badge role-secretary">2° Secretario</div>
              <div class="role-badge role-vocal">3° Vocal</div>
            </div>

            <div class="members-selection-list">
              ${this.formData.members.map((member, index) => `
                <label class="member-select-card ${this.formData.commission.members.find(m => m.id === member.id) ? 'selected' : ''}">
                  <input type="checkbox" name="commission-member" value="${member.id}" ${this.formData.commission.members.find(m => m.id === member.id) ? 'checked' : ''}>
                  <div class="member-select-number">${index + 1}</div>
                  <div class="member-select-info">
                    <div class="member-select-name">${member.firstName} ${member.lastName}</div>
                    <div class="member-select-rut">${member.rut}</div>
                  </div>
                  <div class="member-select-check">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="modal-commission-actions">
            <button type="button" class="btn-cancel" id="cancel-commission">Cancelar</button>
            <button type="button" class="btn-submit" id="save-commission">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Confirmar Selección
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Eventos
    document.getElementById('close-commission-modal').addEventListener('click', () => {
      document.getElementById('select-commission-modal').remove();
    });

    document.getElementById('cancel-commission').addEventListener('click', () => {
      document.getElementById('select-commission-modal').remove();
    });

    // Función para actualizar contador y estilos
    const updateCounter = () => {
      const checked = document.querySelectorAll('input[name="commission-member"]:checked');
      const counter = document.getElementById('commission-counter');
      counter.textContent = checked.length;

      if (checked.length === 3) {
        counter.style.color = '#10b981';
      } else {
        counter.style.color = '#ef4444';
      }

      // Actualizar clases de selección
      document.querySelectorAll('.member-select-card').forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox.checked) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      });
    };

    // Actualizar contador inicial
    updateCounter();

    // Limitar selección a 3
    const checkboxes = document.querySelectorAll('input[name="commission-member"]');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = document.querySelectorAll('input[name="commission-member"]:checked');
        if (checked.length > 3) {
          cb.checked = false;
          showToast('Solo puede seleccionar 3 miembros', 'error');
        }
        updateCounter();
      });
    });

    document.getElementById('save-commission').addEventListener('click', () => {
      const checked = document.querySelectorAll('input[name="commission-member"]:checked');

      if (checked.length !== 3) {
        showToast('Debe seleccionar exactamente 3 miembros', 'error');
        return;
      }

      const selectedIds = Array.from(checked).map(cb => cb.value);
      this.formData.commission.members = this.formData.members.filter(m => selectedIds.includes(m.id));

      this.renderCommissionList();
      document.getElementById('select-commission-modal').remove();
      showToast('Comisión Electoral configurada', 'success');
    });
  }

  /**
   * Inicializa paso 4: Estatutos (antes de solicitar Ministro de Fe)
   */
  initializeStep4_Estatutos() {
    // Alternar entre plantilla y custom
    const radioButtons = document.querySelectorAll('input[name="statutes-option"]');

    radioButtons.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'template') {
          document.getElementById('statutes-template').style.display = 'block';
          document.getElementById('statutes-custom').style.display = 'none';
        } else {
          document.getElementById('statutes-template').style.display = 'none';
          document.getElementById('statutes-custom').style.display = 'block';
        }
      });
    });

    // Generar estatutos y cargar en el editor
    this.loadStatutesEditor();

    // Botón restaurar plantilla
    const btnReset = document.getElementById('btn-reset-statutes');
    if (btnReset) {
      const newBtn = btnReset.cloneNode(true);
      btnReset.parentNode.replaceChild(newBtn, btnReset);
      newBtn.addEventListener('click', () => {
        if (confirm('¿Está seguro de restaurar la plantilla original? Se perderán los cambios realizados.')) {
          this.resetStatutesToTemplate();
        }
      });
    }

    // Contador de caracteres
    const editor = document.getElementById('statutes-editor');
    if (editor) {
      editor.addEventListener('input', () => {
        this.updateStatutesCharCount();
      });
    }

    // Área de upload personalizado
    const uploadArea = document.getElementById('custom-statutes-upload-area');
    const fileInput = document.getElementById('custom-statutes-file');

    if (uploadArea && fileInput) {
      uploadArea.addEventListener('click', () => fileInput.click());
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });
      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
      });
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
          this.handleCustomStatutesFile(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
          this.handleCustomStatutesFile(e.target.files[0]);
        }
      });
    }

    // Botón eliminar archivo
    const btnRemove = document.getElementById('btn-remove-custom-statutes');
    if (btnRemove) {
      btnRemove.addEventListener('click', () => {
        this.removeCustomStatutesFile();
      });
    }
  }

  /**
   * Carga el editor de estatutos con el contenido generado o guardado
   */
  loadStatutesEditor() {
    const editor = document.getElementById('statutes-editor');
    if (!editor) return;

    // Si ya hay estatutos editados guardados, usarlos
    if (this.formData.statutes?.editedContent) {
      editor.value = this.formData.statutes.editedContent;
    } else {
      // Generar estatutos desde la plantilla
      const content = this.generateEstatutosForEditor();
      editor.value = content;
    }

    this.updateStatutesCharCount();
  }

  /**
   * Genera los estatutos completos para el editor según el tipo de organización
   */
  generateEstatutosForEditor() {
    const org = this.formData.organization;
    const orgType = org.type || 'OTRA_FUNCIONAL';

    // Mapear tipo de organización a plantilla de estatutos
    switch (orgType) {
      case 'COMITE_VIVIENDA':
        return this.generateEstatutosComiteVivienda();
      case 'CENTRO_PADRES':
        return this.generateEstatutosCentroPadres();
      case 'JUNTA_VECINOS':
      case 'COMITE_VECINOS':
        return this.generateEstatutosTerritorial();
      case 'COMITE_CONVIVENCIA':
        return this.generateEstatutosCVPCC();
      default:
        // Resto de organizaciones funcionales
        return this.generateEstatutosFuncionales();
    }
  }

  /**
   * Estatutos para Comité de Vivienda
   */
  generateEstatutosComiteVivienda() {
    const org = this.formData.organization;
    const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
    const descripcionTexto = org.description ? `\nDescripción: ${org.description}\n` : '';

    return `ESTATUTOS TIPO
COMITÉ DE VIVIENDA
"${(org.name || '[NOMBRE DEL COMITÉ]').toUpperCase()}"
${descripcionTexto}
TÍTULO PRIMERO
DENOMINACIÓN, DOMICILIO, DURACIÓN Y OBJETIVOS

Artículo 1°: Constitúyese un Comité de Vivienda denominado "${org.name || '[NOMBRE]'}", en adelante también "el Comité", con domicilio en ${org.address || '[DIRECCIÓN]'}, comuna de ${org.commune || 'Renca'}, Región ${org.region || 'Metropolitana'}.

Artículo 2°: La duración del Comité será indefinida o hasta que se haya cumplido el objetivo de obtención de viviendas para todos sus socios.

Artículo 3°: Los objetivos del Comité son:
a) Gestionar la obtención de viviendas para sus socios, a través de los programas habitacionales vigentes;
b) Representar a los socios ante organismos públicos y privados relacionados con la vivienda;
c) Fomentar el ahorro habitacional de los socios;
d) Postular en forma colectiva a subsidios y programas de vivienda social;
e) Administrar los recursos destinados al proyecto habitacional;
f) Realizar todas las gestiones necesarias para lograr el objetivo habitacional común.


TÍTULO SEGUNDO
DE LOS SOCIOS

Artículo 4°: Podrán ser socios del Comité las personas naturales mayores de 18 años que:
a) Carezcan de vivienda propia o tengan déficit habitacional;
b) Residan en la comuna de ${org.commune || 'Renca'} o aledañas;
c) Cumplan con los requisitos de los programas habitacionales a los que se postule;
d) Se comprometan a cumplir estos estatutos y los acuerdos de la asamblea.

Artículo 5°: Son derechos de los socios:
a) Participar con derecho a voz y voto en las Asambleas;
b) Elegir y ser elegidos para cargos directivos;
c) Acceder a los beneficios que el Comité gestione;
d) Ser informados sobre el estado de los proyectos y recursos;
e) Solicitar rendición de cuentas al Directorio.

Artículo 6°: Son obligaciones de los socios:
a) Cumplir estos estatutos y los acuerdos de la Asamblea;
b) Asistir a las reuniones y asambleas convocadas;
c) Pagar las cuotas ordinarias y extraordinarias establecidas;
d) Mantener al día el ahorro habitacional requerido;
e) Entregar oportunamente la documentación solicitada;
f) Comunicar cualquier cambio en su situación personal o familiar.


TÍTULO TERCERO
DEL DIRECTORIO

Artículo 7°: El Comité será dirigido por un Directorio compuesto por:
- Presidente/a
- Secretario/a
- Tesorero/a
- Dos Directores

Artículo 8°: El Directorio durará 2 años en sus funciones y sus miembros podrán ser reelegidos por un período consecutivo.

Artículo 9°: Son funciones del Presidente:
a) Representar legal, judicial y extrajudicialmente al Comité;
b) Presidir las reuniones del Directorio y las Asambleas;
c) Firmar la correspondencia y documentos oficiales;
d) Velar por el cumplimiento de los estatutos y acuerdos.

Artículo 10°: Son funciones del Secretario:
a) Llevar los libros de actas del Directorio y Asambleas;
b) Mantener actualizado el registro de socios;
c) Redactar la correspondencia del Comité;
d) Notificar las citaciones a reuniones.

Artículo 11°: Son funciones del Tesorero:
a) Custodiar los fondos del Comité;
b) Llevar la contabilidad al día;
c) Efectuar los pagos autorizados;
d) Presentar estados financieros a la Asamblea.


TÍTULO CUARTO
DE LAS ASAMBLEAS

Artículo 12°: La Asamblea General es la máxima autoridad del Comité. Las asambleas serán ordinarias y extraordinarias.

Artículo 13°: La Asamblea Ordinaria se celebrará al menos una vez al año para:
a) Conocer la memoria y balance del período;
b) Aprobar el plan de trabajo;
c) Elegir Directorio cuando corresponda;
d) Conocer el estado de los proyectos habitacionales.

Artículo 14°: La Asamblea Extraordinaria se convocará cuando lo solicite el Directorio o al menos el 25% de los socios.


TÍTULO QUINTO
DEL PATRIMONIO

Artículo 15°: El patrimonio del Comité estará formado por:
a) Las cuotas ordinarias y extraordinarias de los socios;
b) Los aportes de instituciones públicas o privadas;
c) Las donaciones que reciba;
d) Los bienes que adquiera a cualquier título.

Artículo 16°: Los fondos del Comité se depositarán en cuenta bancaria y solo podrán ser retirados con la firma conjunta del Presidente y Tesorero.


TÍTULO SEXTO
DISPOSICIONES GENERALES

Artículo 17°: La reforma de estos estatutos requerirá la aprobación de 2/3 de los socios presentes en Asamblea Extraordinaria.

Artículo 18°: La disolución del Comité podrá acordarse por 2/3 de los socios en Asamblea Extraordinaria. Los bienes remanentes pasarán a otra organización comunitaria de la comuna.


═══════════════════════════════════════════════════════════════════════════════
DOCUMENTO PRELIMINAR - Proyecto de estatutos generado el ${today}.
Estos estatutos serán sometidos a votación y aprobación en la Asamblea Constitutiva.
Una vez aprobados en Asamblea, se emitirá el documento definitivo con la fecha de aprobación.
═══════════════════════════════════════════════════════════════════════════════`;
  }

  /**
   * Estatutos para Centro de Padres y Apoderados
   * USA ESTATUTOS TIPO OFICIALES de la Municipalidad de Renca
   */
  generateEstatutosCentroPadres() {
    const org = this.formData.organization;

    // Extraer dirección y número
    let direccion = org.address || '';
    let numero = '';

    // Intentar separar número de la dirección
    const addressMatch = direccion.match(/(.+?)\s*[Nn]°?\s*(\d+)/);
    if (addressMatch) {
      direccion = addressMatch[1].trim();
      numero = addressMatch[2];
    }

    // Obtener configuración de estatutos del paso 3
    const config = this.formData.configEstatutos || {};

    // Preparar datos para los estatutos oficiales
    const datosEstatutos = {
      // Campos que se llenan con datos del paso 1 y 2
      direccion: direccion,
      numero: numero,
      nombreEstablecimiento: org.name || '',
      domicilio: org.address || '',
      // Campos que se dejan en blanco para ser completados en la asamblea
      fechaDia: null,
      fechaMes: null,
      fechaAnio: null,
      hora: null,
      presidenteReunion: null,
      secretarioReunion: null,
      depositante: null,
      // Campos del paso 3: Configuración de Estatutos
      mesAsamblea1: config.mesAsamblea1 || null,
      mesAsamblea2: config.mesAsamblea2 || null,
      mesInforme: config.mesInforme || null,
      mesEleccion: config.mesEleccion || null,
      cuotaIncMin: config.cuotaIncMin || null,
      cuotaIncMax: config.cuotaIncMax || null,
      cuotaOrdMin: config.cuotaOrdMin || null,
      cuotaOrdMax: config.cuotaOrdMax || null,
      entidadDisolucion: config.entidadDisolucion || null
    };

    // Usar estatutos oficiales
    try {
      return generarEstatutos('CENTRO_PADRES', datosEstatutos);
    } catch (error) {
      console.error('Error generando estatutos oficiales:', error);
      // Fallback: retornar mensaje de error
      return `ERROR: No se pudieron generar los estatutos oficiales.\n\nPor favor contacte al administrador del sistema.`;
    }
  }

  /**
   * Estatutos para Organizaciones Territoriales (Junta de Vecinos)
   */
  generateEstatutosTerritorial() {
    const org = this.formData.organization;
    const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
    const tipoOrg = org.type === 'JUNTA_VECINOS' ? 'Junta de Vecinos' : 'Comité de Vecinos';
    const descripcionTexto = org.description ? `\nDescripción: ${org.description}\n` : '';

    return `ESTATUTOS TIPO
${tipoOrg.toUpperCase()}
"${(org.name || '[NOMBRE]').toUpperCase()}"
${descripcionTexto}
TÍTULO PRIMERO
DENOMINACIÓN, NATURALEZA JURÍDICA, DOMICILIO Y DURACIÓN

Artículo 1°: Constitúyese la ${tipoOrg} denominada "${org.name || '[NOMBRE]'}", de acuerdo con la Ley N° 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias.

Artículo 2°: El domicilio de la Organización será en la Unidad Vecinal ${org.neighborhood || '[N° UNIDAD VECINAL]'}, ${org.address || '[DIRECCIÓN]'}, comuna de ${org.commune || 'Renca'}, Región ${org.region || 'Metropolitana'}.

Artículo 3°: La duración de la Organización será indefinida.


TÍTULO SEGUNDO
FINES Y OBJETIVOS

Artículo 4°: La ${tipoOrg} tiene por finalidad:
a) Promover la integración, participación y desarrollo de los habitantes de la unidad vecinal;
b) Representar a los vecinos ante las autoridades para lograr mejoras en la comunidad;
c) Gestionar la solución de problemas comunes;
d) Velar por la conservación del medioambiente y espacios públicos;
e) Colaborar con las autoridades en la seguridad ciudadana;
f) Promover actividades culturales, deportivas y recreativas.

Artículo 5°: Para el cumplimiento de sus fines, la Organización podrá:
a) Celebrar convenios con instituciones públicas y privadas;
b) Ejecutar proyectos de desarrollo comunitario;
c) Administrar bienes de uso público;
d) Participar en programas de desarrollo local.


TÍTULO TERCERO
DE LOS VECINOS Y AFILIADOS

Artículo 6°: Son vecinos las personas naturales, mayores de 14 años, que residan en la unidad vecinal.

Artículo 7°: Los vecinos pueden afiliarse libremente a la ${tipoOrg}. Cada persona podrá afiliarse a una sola Junta de Vecinos.

Artículo 8°: Son derechos de los afiliados:
a) Participar con derecho a voz y voto en las Asambleas;
b) Elegir y ser elegidos para cargos directivos;
c) Acceder a los beneficios de la organización;
d) Ser informado de las actividades y finanzas.

Artículo 9°: Son deberes de los afiliados:
a) Cumplir estos estatutos y acuerdos de asamblea;
b) Asistir a las reuniones convocadas;
c) Pagar las cuotas establecidas;
d) Colaborar en las actividades de la organización.


TÍTULO CUARTO
DE LOS ÓRGANOS

Artículo 10°: Son órganos de la ${tipoOrg}:
a) La Asamblea
b) El Directorio
c) La Comisión Electoral
d) La Comisión Fiscalizadora de Finanzas

Artículo 11°: El Directorio estará compuesto por:
- Presidente/a
- Vicepresidente/a
- Secretario/a
- Tesorero/a
- Al menos un Director/a

Artículo 12°: El Directorio durará 3 años en sus funciones. Sus miembros podrán ser reelegidos por una vez en forma consecutiva.

Artículo 13°: Son atribuciones del Directorio:
a) Dirigir la organización conforme a estos estatutos;
b) Administrar los bienes de la organización;
c) Cumplir los acuerdos de la Asamblea;
d) Representar a la organización ante terceros;
e) Convocar a Asambleas ordinarias y extraordinarias.


TÍTULO QUINTO
DE LAS ASAMBLEAS

Artículo 14°: La Asamblea es la máxima autoridad de la organización. Habrá Asambleas Ordinarias y Extraordinarias.

Artículo 15°: La Asamblea Ordinaria se realizará a lo menos una vez al año para:
a) Aprobar la memoria, balance y cuenta de ingresos y egresos;
b) Aprobar el presupuesto y plan de actividades;
c) Elegir Directorio y comisiones cuando corresponda.

Artículo 16°: La Asamblea Extraordinaria se convocará cuando lo requiera el Directorio o al menos el 15% de los afiliados.

Artículo 17°: El quórum para sesionar será de un tercio de los afiliados en primera citación. En segunda citación, se sesionará con los que asistan.


TÍTULO SEXTO
DEL PATRIMONIO

Artículo 18°: El patrimonio estará constituido por:
a) Las cuotas ordinarias y extraordinarias;
b) Los bienes muebles e inmuebles que adquiera;
c) Las subvenciones, donaciones y aportes;
d) Los frutos y productos de sus bienes;
e) Los ingresos provenientes de sus actividades.

Artículo 19°: Los fondos se mantendrán en cuenta bancaria y serán girados con firma del Presidente y Tesorero.


TÍTULO SÉPTIMO
DE LA COMISIÓN ELECTORAL

Artículo 20°: La Comisión Electoral estará integrada por 3 miembros elegidos por la Asamblea, con al menos un año de antigüedad en la organización.

Artículo 21°: La Comisión Electoral supervigilará los procesos electorales y se constituirá 2 meses antes de cada elección.


TÍTULO OCTAVO
DISPOSICIONES GENERALES

Artículo 22°: La reforma de estos estatutos requerirá la aprobación de 2/3 de los asistentes a Asamblea Extraordinaria.

Artículo 23°: La disolución requerirá acuerdo de 2/3 de los afiliados en Asamblea Extraordinaria. Los bienes se traspasarán a otra organización comunitaria de la comuna.


═══════════════════════════════════════════════════════════════════════════════
DOCUMENTO PRELIMINAR - Proyecto de estatutos generado el ${today}.
Estos estatutos serán sometidos a votación y aprobación en la Asamblea Constitutiva.
Una vez aprobados en Asamblea, se emitirá el documento definitivo con la fecha de aprobación.
═══════════════════════════════════════════════════════════════════════════════`;
  }

  /**
   * Estatutos para CVPCC (Comité Vecinal de Prevención y Convivencia Comunitaria)
   */
  generateEstatutosCVPCC() {
    const org = this.formData.organization;
    const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
    const descripcionTexto = org.description ? `\nDescripción: ${org.description}\n` : '';

    return `ESTATUTOS TIPO
COMITÉ VECINAL DE PREVENCIÓN Y CONVIVENCIA COMUNITARIA
"${(org.name || '[NOMBRE DEL CVPCC]').toUpperCase()}"
${descripcionTexto}
TÍTULO PRIMERO
DENOMINACIÓN, DOMICILIO Y DURACIÓN

Artículo 1°: Constitúyese el Comité Vecinal de Prevención y Convivencia Comunitaria denominado "${org.name || '[NOMBRE]'}", en adelante "el Comité" o "CVPCC", con domicilio en ${org.address || '[DIRECCIÓN]'}, comuna de ${org.commune || 'Renca'}, Región ${org.region || 'Metropolitana'}.

Artículo 2°: El CVPCC es una organización comunitaria funcional, regida por la Ley N° 19.418 y las normas del Programa de Prevención Comunitaria.

Artículo 3°: La duración del Comité será indefinida.


TÍTULO SEGUNDO
OBJETIVOS Y FUNCIONES

Artículo 4°: El Comité tiene por finalidad:
a) Contribuir a la prevención de la delincuencia y la violencia en el barrio;
b) Promover la convivencia pacífica entre los vecinos;
c) Fortalecer los lazos comunitarios y la participación ciudadana;
d) Colaborar con las autoridades en materias de seguridad ciudadana;
e) Implementar estrategias de prevención situacional y social;
f) Fomentar la recuperación de espacios públicos.

Artículo 5°: Para el cumplimiento de sus objetivos, el Comité podrá:
a) Desarrollar acciones de prevención comunitaria;
b) Organizar actividades de integración barrial;
c) Gestionar recursos para proyectos de seguridad;
d) Coordinarse con Carabineros, PDI y otras instituciones;
e) Participar en mesas de seguridad y consejos comunales;
f) Ejecutar proyectos con fondos públicos o privados.


TÍTULO TERCERO
DE LOS SOCIOS

Artículo 6°: Podrán ser socios del Comité las personas naturales mayores de 14 años que residan en el sector territorial definido.

Artículo 7°: Son derechos de los socios:
a) Participar con derecho a voz y voto en las Asambleas;
b) Elegir y ser elegidos para cargos directivos;
c) Proponer iniciativas y proyectos;
d) Ser informado de las actividades y gestiones;
e) Acceder a los beneficios del Comité.

Artículo 8°: Son deberes de los socios:
a) Cumplir estos estatutos y acuerdos de la Asamblea;
b) Asistir a las reuniones y asambleas convocadas;
c) Participar en las actividades de prevención;
d) Mantener una conducta respetuosa y solidaria;
e) Contribuir con las cuotas establecidas.


TÍTULO CUARTO
DEL DIRECTORIO

Artículo 9°: El Comité será dirigido por un Directorio compuesto por:
- Presidente/a
- Vicepresidente/a
- Secretario/a
- Tesorero/a
- Un Director/a de Prevención
- Un Director/a de Convivencia

Artículo 10°: El Directorio durará 2 años en sus funciones, pudiendo ser reelegido por un período.

Artículo 11°: Son funciones del Presidente:
a) Representar al Comité ante autoridades y organismos;
b) Presidir las reuniones del Directorio y Asambleas;
c) Coordinar las acciones con instituciones de seguridad;
d) Firmar documentos y convenios autorizados.

Artículo 12°: Son funciones del Director de Prevención:
a) Coordinar las acciones de prevención situacional;
b) Gestionar la relación con Carabineros y PDI;
c) Liderar las estrategias de recuperación de espacios.

Artículo 13°: Son funciones del Director de Convivencia:
a) Promover actividades de integración comunitaria;
b) Mediar en conflictos vecinales;
c) Coordinar iniciativas de cultura de paz.


TÍTULO QUINTO
DE LAS ASAMBLEAS

Artículo 14°: La Asamblea General es la máxima autoridad del Comité. Se realizarán Asambleas Ordinarias y Extraordinarias.

Artículo 15°: La Asamblea Ordinaria se realizará al menos 2 veces al año para:
a) Conocer la memoria y balance del período;
b) Aprobar el plan de actividades de prevención;
c) Evaluar las estrategias implementadas;
d) Elegir Directorio cuando corresponda.

Artículo 16°: La Asamblea Extraordinaria se convocará cuando lo solicite el Directorio o el 20% de los socios.


TÍTULO SEXTO
DEL PATRIMONIO

Artículo 17°: El patrimonio del Comité estará formado por:
a) Las cuotas ordinarias y extraordinarias;
b) Los recursos de proyectos de seguridad ciudadana;
c) Los aportes municipales y gubernamentales;
d) Las donaciones y subvenciones;
e) Los bienes que adquiera.

Artículo 18°: Los fondos se mantendrán en cuenta bancaria y serán operados con firma conjunta del Presidente y Tesorero.


TÍTULO SÉPTIMO
DISPOSICIONES GENERALES

Artículo 19°: El Comité mantendrá coordinación permanente con el Municipio, Carabineros y organismos de seguridad.

Artículo 20°: La reforma de estatutos requerirá aprobación de 2/3 de los asistentes a Asamblea Extraordinaria.

Artículo 21°: La disolución requerirá acuerdo de 2/3 de los socios. Los bienes pasarán a otra organización comunitaria de la comuna.


═══════════════════════════════════════════════════════════════════════════════
DOCUMENTO PRELIMINAR - Proyecto de estatutos generado el ${today}.
Estos estatutos serán sometidos a votación y aprobación en la Asamblea Constitutiva.
Una vez aprobados en Asamblea, se emitirá el documento definitivo con la fecha de aprobación.
═══════════════════════════════════════════════════════════════════════════════`;
  }

  /**
   * Estatutos para Organizaciones Comunitarias Funcionales (genérico)
   */
  generateEstatutosFuncionales() {
    const org = this.formData.organization;
    const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

    // Obtener nombre legible del tipo de organización
    const tiposOrganizacion = {
      'CLUB_ADULTO_MAYOR': 'Club de Adulto Mayor',
      'COMITE_ADELANTO': 'Comité de Adelanto',
      'ORG_CULTURAL': 'Organización Cultural',
      'CLUB_DEPORTIVO': 'Club Deportivo',
      'AGRUPACION_EMPRENDEDORES': 'Agrupación de Emprendedores',
      'AGRUPACION_FOLCLORICA': 'Agrupación Folclórica',
      'ORG_INDIGENA': 'Organización Indígena',
      'COMITE_MEJORAMIENTO': 'Comité de Mejoramiento',
      'ORG_MUJERES': 'Organización de Mujeres',
      'ORG_SALUD': 'Organización de Salud',
      'ORG_SOCIAL': 'Organización Social',
      'OTRA_FUNCIONAL': 'Organización Comunitaria Funcional'
    };
    const tipoNombre = tiposOrganizacion[org.type] || 'Organización Comunitaria Funcional';

    // Construir descripción completa si existe
    const descripcionTexto = org.description ? `\nDescripción: ${org.description}\n` : '';

    // Solo mostrar el subtipo si es diferente al genérico para evitar duplicación
    const subtipoLinea = (tipoNombre !== 'Organización Comunitaria Funcional')
      ? `\n${tipoNombre.toUpperCase()}`
      : '';

    return `ESTATUTOS TIPO
ORGANIZACIÓN COMUNITARIA FUNCIONAL${subtipoLinea}
"${(org.name || '[NOMBRE DE LA ORGANIZACIÓN]').toUpperCase()}"
${descripcionTexto}
TÍTULO PRIMERO
DENOMINACIÓN, DOMICILIO Y DURACIÓN

Artículo 1°: Constitúyese una Organización Comunitaria Funcional del tipo "${tipoNombre}" denominada "${org.name || '[NOMBRE]'}", en adelante "la Organización", regida por la Ley N° 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias.

Artículo 2°: El domicilio de la Organización será en ${org.address || '[DIRECCIÓN]'}, comuna de ${org.commune || 'Renca'}, Región ${org.region || 'Metropolitana'}, sin perjuicio de las actividades que pueda desarrollar en otras localidades.

Artículo 3°: La duración de la Organización será indefinida.


TÍTULO SEGUNDO
OBJETIVOS Y FUNCIONES

Artículo 4°: Los objetivos de la Organización son:
${org.objectives || `a) Promover el desarrollo comunitario en el ámbito de su especialidad;
b) Representar a sus socios ante autoridades y organismos;
c) Fomentar la participación ciudadana y el trabajo colaborativo;
d) Gestionar recursos para proyectos de beneficio común.`}

Artículo 5°: Para el cumplimiento de sus objetivos, la Organización podrá:
a) Representar a sus miembros ante autoridades públicas y privadas;
b) Gestionar y ejecutar proyectos de desarrollo comunitario;
c) Celebrar convenios con instituciones públicas y privadas;
d) Adquirir, administrar y enajenar bienes;
e) Organizar actividades culturales, sociales, deportivas o recreativas;
f) Realizar todas las actividades lícitas conducentes al logro de sus fines.


TÍTULO TERCERO
DE LOS SOCIOS

Artículo 6°: Podrán ser socios de la Organización todas las personas naturales, mayores de 14 años, que residan en la comuna de ${org.commune || 'Renca'} y que compartan los objetivos de la Organización.

Artículo 7°: Son derechos de los socios:
a) Participar con derecho a voz y voto en las Asambleas;
b) Elegir y ser elegidos para los cargos directivos;
c) Presentar proyectos e iniciativas;
d) Acceder a los beneficios que la Organización gestione;
e) Ser informado de las actividades y finanzas de la Organización.

Artículo 8°: Son obligaciones de los socios:
a) Respetar estos estatutos y acuerdos de la Asamblea;
b) Asistir a las reuniones y asambleas convocadas;
c) Pagar las cuotas ordinarias y extraordinarias establecidas;
d) Contribuir al cumplimiento de los objetivos de la Organización;
e) Mantener una conducta respetuosa con los demás socios.


TÍTULO CUARTO
DEL DIRECTORIO

Artículo 9°: El Directorio estará compuesto por un mínimo de 5 miembros titulares:
- Presidente/a
- Vicepresidente/a
- Secretario/a
- Tesorero/a
- Un Director/a

Podrán existir además directores suplentes.

Artículo 10°: El Directorio durará 2 años en sus funciones y sus miembros podrán ser reelegidos por un período consecutivo.

Artículo 11°: Son funciones del Directorio:
a) Dirigir la Organización de acuerdo a estos estatutos;
b) Administrar los bienes de la Organización;
c) Cumplir los acuerdos de la Asamblea;
d) Convocar a Asambleas ordinarias y extraordinarias;
e) Representar a la Organización ante terceros;
f) Designar comisiones de trabajo.


TÍTULO QUINTO
DE LAS ASAMBLEAS

Artículo 12°: La Asamblea General es la autoridad máxima de la Organización. Habrá Asambleas Ordinarias y Extraordinarias.

Artículo 13°: La Asamblea Ordinaria se realizará al menos una vez al año para:
a) Aprobar la memoria y balance del período anterior;
b) Aprobar el plan de trabajo y presupuesto;
c) Elegir al Directorio cuando corresponda;
d) Tratar otros asuntos incluidos en la citación.

Artículo 14°: La Asamblea Extraordinaria se convocará cuando lo solicite el Directorio o al menos un 20% de los socios.

Artículo 15°: El quórum para sesionar será de un tercio de los socios en primera citación. En segunda citación, se sesionará con los que asistan.


TÍTULO SEXTO
DEL PATRIMONIO

Artículo 16°: El patrimonio de la Organización estará constituido por:
a) Las cuotas ordinarias y extraordinarias de los socios;
b) Las donaciones, herencias y legados que reciba;
c) Los bienes muebles e inmuebles que adquiera;
d) Las subvenciones y aportes fiscales o municipales;
e) El producto de sus actividades y servicios.

Artículo 17°: Los fondos de la Organización se mantendrán en cuenta bancaria y solo podrán ser retirados con la firma conjunta del Presidente y Tesorero.


TÍTULO SÉPTIMO
DISPOSICIONES GENERALES

Artículo 18°: La Organización podrá modificar estos estatutos en Asamblea Extraordinaria, con la asistencia de al menos el 50% de los socios y la aprobación de 2/3 de los asistentes.

Artículo 19°: La Organización podrá disolverse por acuerdo de 2/3 de los socios en Asamblea Extraordinaria especialmente convocada al efecto. En caso de disolución, los bienes pasarán a otra organización comunitaria de la misma comuna.


═══════════════════════════════════════════════════════════════════════════════
DOCUMENTO PRELIMINAR - Proyecto de estatutos generado el ${today}.
Estos estatutos serán sometidos a votación y aprobación en la Asamblea Constitutiva.
Una vez aprobados en Asamblea, se emitirá el documento definitivo con la fecha de aprobación.
═══════════════════════════════════════════════════════════════════════════════`;
  }

  /**
   * Restaura los estatutos a la plantilla original
   */
  resetStatutesToTemplate() {
    const editor = document.getElementById('statutes-editor');
    if (editor) {
      const content = this.generateEstatutosForEditor();
      editor.value = content;
      this.formData.statutes.editedContent = null;
      this.updateStatutesCharCount();
      showToast('Estatutos restaurados a la plantilla original', 'success');
    }
  }

  /**
   * Actualiza el contador de caracteres
   */
  updateStatutesCharCount() {
    const editor = document.getElementById('statutes-editor');
    const counter = document.getElementById('statutes-char-count');
    if (editor && counter) {
      counter.textContent = editor.value.length.toLocaleString('es-CL');
    }
  }

  /**
   * Maneja el archivo de estatutos personalizados
   */
  handleCustomStatutesFile(file) {
    // Validar tipo
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      showToast('Formato no válido. Use PDF, DOC o DOCX', 'error');
      return;
    }

    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('El archivo no debe superar los 10MB', 'error');
      return;
    }

    // Mostrar preview
    document.getElementById('custom-statutes-upload-area').style.display = 'none';
    document.getElementById('custom-statutes-preview').style.display = 'block';
    document.getElementById('custom-file-name').textContent = file.name;
    document.getElementById('custom-file-size').textContent = this.formatFileSize(file.size);

    // Guardar referencia al archivo
    this.formData.statutes.customFile = file;
  }

  /**
   * Elimina el archivo de estatutos personalizados
   */
  removeCustomStatutesFile() {
    document.getElementById('custom-statutes-upload-area').style.display = 'flex';
    document.getElementById('custom-statutes-preview').style.display = 'none';
    document.getElementById('custom-statutes-file').value = '';
    this.formData.statutes.customFile = null;
  }

  /**
   * Formatea el tamaño del archivo
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * Inicializa paso 6: Firmas (solo visualización)
   */
  initializeStep6_Firmas() {
    // Renderizar lista de firmas en modo lectura
    this.renderSignaturesListReadOnly();
  }

  /**
   * Renderiza la lista de firmas en modo lectura (ya completadas)
   */
  renderSignaturesListReadOnly() {
    const container = document.getElementById('members-signatures-list');
    const commission = this.formData.commission.members;

    if (!commission || commission.length === 0) {
      container.innerHTML = `
        <div class="no-signatures-warning">
          <div class="warning-icon">⚠️</div>
          <p>No se han registrado firmas de la Comisión Electoral.</p>
          <p class="text-muted small">Esta información debió ser recolectada en la Asamblea Constitutiva.</p>
        </div>
      `;
      return;
    }

    const roles = ['Presidente', 'Secretario', 'Vocal'];
    const roleIcons = ['👤', '📝', '🗳️'];
    const signatures = this.formData.signatures || {};

    // SEGURIDAD: Sanitizar datos de miembros y validar firmas para prevenir XSS
    container.innerHTML = commission.map((member, index) => {
      const signatureData = signatures[member.id];
      const safeFirstName = escapeHtml(member.firstName || '');
      const safeLastName = escapeHtml(member.lastName || '');
      const safeRut = escapeHtml(member.rut || 'RUT no registrado');

      // Validar que la firma sea un data URL válido (base64 image)
      let signatureImgSrc = '';
      if (signatureData && signatureData.type === 'drawn' && signatureData.data) {
        // Solo permitir data URLs de imágenes
        if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(signatureData.data)) {
          signatureImgSrc = signatureData.data;
        }
      }

      return `
        <div class="signature-member-display-card signed">
          <div class="signature-member-icon">${roleIcons[index]}</div>
          <div class="signature-member-display-info">
            <div class="member-role-badge ${index === 0 ? 'president' : index === 1 ? 'secretary' : 'vocal'}">${roles[index]}</div>
            <div class="member-name">${safeFirstName} ${safeLastName}</div>
            <div class="member-rut">${safeRut}</div>
          </div>
          <div class="signature-preview-display">
            ${signatureImgSrc ? `
              <img src="${signatureImgSrc}" alt="Firma" class="signature-preview-img">
            ` : `
              <div class="signature-placeholder-display">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                </svg>
              </div>
            `}
          </div>
          <div class="signature-verified-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Verificada</span>
          </div>
        </div>
      `;
    }).join('');

    // Actualizar el estado de firmas
    const statusEl = document.getElementById('signature-status');
    if (statusEl) {
      statusEl.innerHTML = `<span class="status-complete">${commission.length}/${commission.length} firmas verificadas</span>`;
    }
  }

  /**
   * Renderiza la lista de firmas por miembro
   */
  renderSignaturesList() {
    const container = document.getElementById('members-signatures-list');
    const commission = this.formData.commission.members;

    if (!commission || commission.length === 0) {
      container.innerHTML = `
        <div class="no-commission-message">
          <p class="text-muted">No hay miembros de comisión seleccionados.</p>
          <p class="text-muted small">Vuelva al Paso 3 para seleccionar la Comisión Electoral.</p>
        </div>
      `;
      this.updateSignatureStatus();
      return;
    }

    const roles = ['Presidente', 'Secretario', 'Vocal'];
    const signatures = this.formData.signatures || {};

    // SEGURIDAD: Sanitizar datos de miembros y validar firmas para prevenir XSS
    container.innerHTML = commission.map((member, index) => {
      const hasSigned = signatures[member.id];
      const signatureData = hasSigned ? signatures[member.id] : null;

      // Sanitizar datos del miembro
      const safeFirstName = escapeHtml(member.firstName || '');
      const safeLastName = escapeHtml(member.lastName || '');
      const safeRut = escapeHtml(member.rut || '');
      const safeMemberId = escapeHtml(member.id || '');
      const safeFullName = `${safeFirstName} ${safeLastName}`;

      // Validar firma como data URL de imagen
      let signatureImgSrc = '';
      if (signatureData && signatureData.type === 'drawn' && signatureData.data) {
        if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(signatureData.data)) {
          signatureImgSrc = signatureData.data;
        }
      }

      return `
        <div class="signature-member-card ${hasSigned ? 'signed' : ''}" data-member-id="${safeMemberId}">
          <div class="signature-member-info">
            <span class="member-role-badge">${roles[index]}</span>
            <div class="member-details">
              <span class="member-name">${safeFullName}</span>
              <span class="member-rut">${safeRut}</span>
            </div>
          </div>

          ${hasSigned ? `
            <div class="signature-member-preview">
              ${signatureData.type === 'drawn' && signatureImgSrc ? `
                <img src="${signatureImgSrc}" alt="Firma de ${safeFirstName}" class="signature-thumb">
              ` : signatureData.type === 'digital' ? `
                <div class="signature-digital-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  Clave Única
                </div>
              ` : `
                <div class="signature-manual-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Firmado manual
                </div>
              `}
              <button class="btn-change-signature" data-member-id="${safeMemberId}">Cambiar</button>
            </div>
          ` : `
            <button class="btn-sign-member" data-member-id="${safeMemberId}" data-member-name="${safeFullName}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              </svg>
              Firmar
            </button>
          `}
        </div>
      `;
    }).join('');

    // Eventos de firmar
    container.querySelectorAll('.btn-sign-member').forEach(btn => {
      btn.addEventListener('click', () => {
        const memberId = btn.dataset.memberId;
        const memberName = btn.dataset.memberName;
        this.signMember(memberId, memberName);
      });
    });

    // Eventos de cambiar firma
    container.querySelectorAll('.btn-change-signature').forEach(btn => {
      btn.addEventListener('click', () => {
        const memberId = btn.dataset.memberId;
        delete this.formData.signatures[memberId];
        this.saveProgress();
        this.renderSignaturesList();
        this.updateDocumentsWithSignatures();
        showToast('Firma eliminada', 'info');
      });
    });

    this.updateSignatureStatus();
  }

  /**
   * Actualiza el estado de firmas
   */
  updateSignatureStatus() {
    const statusEl = document.getElementById('signature-status');
    const commission = this.formData.commission.members || [];
    const signatures = this.formData.signatures || {};
    const signedCount = commission.filter(m => signatures[m.id]).length;

    if (signedCount === commission.length && commission.length > 0) {
      statusEl.innerHTML = `<span class="status-signed">✓ ${signedCount}/${commission.length} firmas completadas</span>`;
    } else {
      statusEl.innerHTML = `<span class="status-pending">${signedCount}/${commission.length} firmas completadas</span>`;
    }
  }

  /**
   * Inicia el proceso de firma para un miembro
   */
  signMember(memberId, memberName) {
    switch (this.currentSignatureMethod) {
      case 'draw':
        this.showDrawSignatureModal(memberId, memberName);
        break;
      case 'digital':
        this.showDigitalSignatureModal(memberId, memberName);
        break;
      case 'manual':
        this.showManualSignatureModal(memberId, memberName);
        break;
    }
  }

  /**
   * Renderiza lista de certificados de antecedentes
   */
  renderCertificatesList() {
    const container = document.getElementById('certificates-list');
    const commission = this.formData.commission.members;

    if (!commission || commission.length === 0) {
      container.innerHTML = `
        <div class="no-commission-message">
          <p class="text-muted">No hay miembros de comisión seleccionados en el paso anterior.</p>
          <p class="text-muted small">Vuelva al Paso 3 para seleccionar la Comisión Electoral.</p>
        </div>
      `;
      return;
    }

    const roles = ['Presidente', 'Secretario', 'Vocal'];

    let html = `
      <div class="certificates-warning-box" style="background: #fff4e6; border: 2px solid #ff9800; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: start;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2" style="flex-shrink: 0;">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div>
            <strong style="color: #e65100; font-size: 16px; display: block; margin-bottom: 8px;">⚠️ IMPORTANTE: Vigencia del Certificado</strong>
            <p style="margin: 0 0 8px 0; color: #424242; font-size: 14px;">
              Los <strong>Certificados de Antecedentes</strong> NO deben tener más de <strong style="color: #d84315;">30 días de antigüedad</strong>.
            </p>
            <p style="margin: 0; color: #616161; font-size: 13px;">
              Certificados con fecha de emisión superior a 30 días serán <strong>automáticamente rechazados</strong> por la municipalidad.
            </p>
          </div>
        </div>
      </div>

      <div class="certificates-link-info">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>Puede obtener el Certificado de Antecedentes en: </span>
        <a href="https://www.registrocivil.cl/principal/servicios-en-linea/certificado-de-antecedentes" target="_blank" rel="noopener noreferrer">
          www.registrocivil.cl
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    `;

    // SEGURIDAD: Sanitizar datos de miembros y certificados para prevenir XSS
    html += commission.map((member, index) => {
      const safeMemberId = escapeHtml(member.id || '');
      const safeFirstName = escapeHtml(member.firstName || '');
      const safeLastName = escapeHtml(member.lastName || '');
      const safeRut = escapeHtml(member.rut || '');
      const cert = this.formData.certificates[member.id];
      const safeFileName = cert ? escapeHtml(cert.fileName || '') : '';

      return `
        <div class="certificate-item ${cert ? 'completed' : ''}" data-member-id="${safeMemberId}">
          <div class="certificate-info">
            <div class="certificate-member">
              <span class="member-role-badge">${roles[index]}</span>
              <span class="member-name">${safeFirstName} ${safeLastName}</span>
              <span class="badge-required">Requerido</span>
            </div>
            <span class="member-rut">${safeRut}</span>
            <div class="certificate-status ${cert ? 'uploaded' : ''}">
              ${cert
                ? `<span class="status-uploaded">✓ ${safeFileName}</span>`
                : '<span class="status-pending-cert">⚠ Pendiente de subir</span>'}
            </div>
          </div>
          <div class="certificate-actions">
            <input type="file" class="certificate-file-input" data-member-id="${safeMemberId}" accept=".pdf" style="display: none;">
            <button class="btn-upload-cert" data-member-id="${safeMemberId}" ${cert ? 'style="display:none;"' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Subir PDF
            </button>
            <button class="btn-remove-cert" data-member-id="${safeMemberId}" ${cert ? '' : 'style="display:none;"'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;

    // Eventos
    container.querySelectorAll('.btn-upload-cert').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = container.querySelector(`input[data-member-id="${btn.dataset.memberId}"]`);
        input.click();
      });
    });

    container.querySelectorAll('.certificate-file-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
          await this.uploadCertificate(e.target.dataset.memberId, e.target.files[0]);
        }
      });
    });

    container.querySelectorAll('.btn-remove-cert').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeCertificate(btn.dataset.memberId);
      });
    });
  }

  /**
   * Sube un certificado de antecedentes
   */
  async uploadCertificate(memberId, file) {
    if (file.type !== 'application/pdf') {
      showToast('Solo se permiten archivos PDF', 'error');
      return;
    }

    try {
      // Convertir archivo a base64
      const reader = new FileReader();
      reader.onload = () => {
        this.formData.certificates[memberId] = {
          fileName: file.name,
          fileSize: file.size,
          data: reader.result,
          uploadedAt: new Date().toISOString()
        };

        this.renderCertificatesList();
        this.saveProgress();
        showToast('Certificado subido correctamente', 'success');
      };
      reader.onerror = () => {
        showToast('Error al leer el archivo', 'error');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      showToast('Error al subir el certificado', 'error');
    }
  }

  /**
   * Elimina un certificado
   */
  removeCertificate(memberId) {
    delete this.formData.certificates[memberId];
    this.renderCertificatesList();
    this.saveProgress();
    showToast('Certificado eliminado', 'info');
  }

  /**
   * Renderiza lista de fotos de carnet
   */
  renderIdPhotosList() {
    const container = document.getElementById('id-photos-list');
    const commission = this.formData.commission.members;

    if (!commission || commission.length === 0) {
      container.innerHTML = `
        <div class="no-commission-message">
          <p class="text-muted">No hay miembros de comisión seleccionados en el paso anterior.</p>
        </div>
      `;
      return;
    }

    // Inicializar idPhotos si no existe
    if (!this.formData.idPhotos) {
      this.formData.idPhotos = {};
    }

    const roles = ['Presidente', 'Secretario', 'Vocal'];

    let html = commission.map((member, index) => {
      const memberPhotos = this.formData.idPhotos[member.id] || {};
      const hasFront = memberPhotos.front;
      const hasBack = memberPhotos.back;
      const isComplete = hasFront && hasBack;

      return `
        <div class="id-photo-member-card" style="
          background: white;
          border: 2px solid ${isComplete ? '#10b981' : '#e5e7eb'};
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
          transition: all 0.2s;
        ">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
            <div>
              <h5 style="margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #1f2937;">
                ${member.name} ${member.lastName}
              </h5>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                ${roles[index]} • RUT: ${member.rut}
              </p>
            </div>
            ${isComplete ? `
              <div style="
                padding: 6px 12px;
                background: #d1fae5;
                color: #065f46;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 6px;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Completo
              </div>
            ` : `
              <div style="
                padding: 6px 12px;
                background: #fef3c7;
                color: #92400e;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
              ">
                Pendiente
              </div>
            `}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Foto Frontal -->
            <div style="border: 2px dashed ${hasFront ? '#10b981' : '#d1d5db'}; border-radius: 8px; padding: 16px; text-align: center; background: ${hasFront ? '#f0fdf4' : '#f9fafb'};">
              <div style="margin-bottom: 12px; color: #6b7280; font-weight: 600; font-size: 14px;">
                📷 Carnet Frontal
              </div>

              ${hasFront ? `
                <div style="margin-bottom: 12px;">
                  <img src="${memberPhotos.front.data}" alt="Frontal" style="max-width: 100%; max-height: 150px; border-radius: 8px; border: 2px solid #10b981;">
                </div>
                <div style="display: flex; gap: 8px; justify-content: center;">
                  <button class="btn-secondary-sm btn-view-photo" data-member-id="${member.id}" data-side="front" style="font-size: 12px; padding: 6px 12px;">
                    Ver
                  </button>
                  <button class="btn-secondary-sm btn-remove-photo" data-member-id="${member.id}" data-side="front" style="font-size: 12px; padding: 6px 12px; background: #fee2e2; color: #991b1b;">
                    Eliminar
                  </button>
                </div>
              ` : `
                <input type="file" id="id-photo-front-${member.id}" accept="image/*" style="display: none;" data-member-id="${member.id}" data-side="front">
                <button class="btn-secondary btn-upload-photo" data-input-id="id-photo-front-${member.id}" style="width: 100%; padding: 10px; font-size: 13px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Subir Foto
                </button>
              `}
            </div>

            <!-- Foto Trasera -->
            <div style="border: 2px dashed ${hasBack ? '#10b981' : '#d1d5db'}; border-radius: 8px; padding: 16px; text-align: center; background: ${hasBack ? '#f0fdf4' : '#f9fafb'};">
              <div style="margin-bottom: 12px; color: #6b7280; font-weight: 600; font-size: 14px;">
                📷 Carnet Trasero
              </div>

              ${hasBack ? `
                <div style="margin-bottom: 12px;">
                  <img src="${memberPhotos.back.data}" alt="Trasero" style="max-width: 100%; max-height: 150px; border-radius: 8px; border: 2px solid #10b981;">
                </div>
                <div style="display: flex; gap: 8px; justify-content: center;">
                  <button class="btn-secondary-sm btn-view-photo" data-member-id="${member.id}" data-side="back" style="font-size: 12px; padding: 6px 12px;">
                    Ver
                  </button>
                  <button class="btn-secondary-sm btn-remove-photo" data-member-id="${member.id}" data-side="back" style="font-size: 12px; padding: 6px 12px; background: #fee2e2; color: #991b1b;">
                    Eliminar
                  </button>
                </div>
              ` : `
                <input type="file" id="id-photo-back-${member.id}" accept="image/*" style="display: none;" data-member-id="${member.id}" data-side="back">
                <button class="btn-secondary btn-upload-photo" data-input-id="id-photo-back-${member.id}" style="width: 100%; padding: 10px; font-size: 13px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Subir Foto
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;

    // Agregar event listeners
    container.querySelectorAll('.btn-upload-photo').forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.dataset.inputId;
        document.getElementById(inputId).click();
      });
    });

    container.querySelectorAll('input[type="file"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const memberId = input.dataset.memberId;
          const side = input.dataset.side;
          this.uploadIdPhoto(memberId, side, file);
        }
      });
    });

    container.querySelectorAll('.btn-view-photo').forEach(btn => {
      btn.addEventListener('click', () => {
        this.viewIdPhoto(btn.dataset.memberId, btn.dataset.side);
      });
    });

    container.querySelectorAll('.btn-remove-photo').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeIdPhoto(btn.dataset.memberId, btn.dataset.side);
      });
    });
  }

  /**
   * Sube una foto de carnet
   */
  async uploadIdPhoto(memberId, side, file) {
    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      showToast('Solo se permiten archivos de imagen', 'error');
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('La imagen no debe superar los 5MB', 'error');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (!this.formData.idPhotos[memberId]) {
          this.formData.idPhotos[memberId] = {};
        }

        this.formData.idPhotos[memberId][side] = {
          fileName: file.name,
          fileSize: file.size,
          data: reader.result,
          uploadedAt: new Date().toISOString()
        };

        this.renderIdPhotosList();
        this.saveProgress();
        showToast(`Foto ${side === 'front' ? 'frontal' : 'trasera'} subida correctamente`, 'success');
      };
      reader.onerror = () => {
        showToast('Error al leer el archivo', 'error');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      showToast('Error al subir la foto', 'error');
    }
  }

  /**
   * Visualiza una foto de carnet
   */
  viewIdPhoto(memberId, side) {
    const photo = this.formData.idPhotos[memberId]?.[side];
    if (!photo) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px;">
        <div class="modal-header">
          <h3>Vista Previa - Carnet ${side === 'front' ? 'Frontal' : 'Trasero'}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body" style="text-align: center; padding: 24px;">
          <img src="${photo.data}" alt="Carnet ${side}" style="max-width: 100%; max-height: 70vh; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
          <div style="margin-top: 16px; color: #6b7280; font-size: 14px;">
            ${photo.fileName} • ${(photo.fileSize / 1024).toFixed(1)} KB
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  /**
   * Elimina una foto de carnet
   */
  removeIdPhoto(memberId, side) {
    if (!confirm(`¿Eliminar foto ${side === 'front' ? 'frontal' : 'trasera'} del carnet?`)) return;

    if (this.formData.idPhotos[memberId]) {
      delete this.formData.idPhotos[memberId][side];

      // Si no quedan fotos, eliminar el objeto del miembro
      if (!this.formData.idPhotos[memberId].front && !this.formData.idPhotos[memberId].back) {
        delete this.formData.idPhotos[memberId];
      }
    }

    this.renderIdPhotosList();
    this.saveProgress();
    showToast('Foto eliminada', 'info');
  }

  /**
   * Renderiza lista de otros documentos
   */
  renderOtherDocumentsList() {
    const container = document.getElementById('other-documents-list');
    if (!container) return; // El elemento puede no existir en algunas vistas

    if (this.formData.otherDocuments.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this.formData.otherDocuments.map((doc, index) => `
      <div class="other-document-item" data-index="${index}">
        <div class="other-document-info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="other-document-name">${doc.fileName}</span>
          <span class="other-document-size">(${(doc.fileSize / 1024).toFixed(1)} KB)</span>
        </div>
        <button class="btn-remove-other" data-index="${index}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-remove-other').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeOtherDocument(parseInt(btn.dataset.index));
      });
    });
  }

  /**
   * Agrega un slot para otro documento
   */
  addOtherDocumentSlot() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        await this.uploadOtherDocument(e.target.files[0]);
      }
      document.body.removeChild(input);
    });

    input.click();
  }

  /**
   * Sube otro documento
   */
  async uploadOtherDocument(file) {
    try {
      // Convertir archivo a base64
      const reader = new FileReader();
      reader.onload = () => {
        this.formData.otherDocuments.push({
          id: `other-${Date.now()}`,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          data: reader.result,
          uploadedAt: new Date().toISOString()
        });

        this.renderOtherDocumentsList();
        this.saveProgress();
        showToast('Documento agregado', 'success');
      };
      reader.onerror = () => {
        showToast('Error al leer el archivo', 'error');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      showToast('Error al subir el documento', 'error');
    }
  }

  /**
   * Elimina otro documento
   */
  removeOtherDocument(index) {
    this.formData.otherDocuments.splice(index, 1);
    this.renderOtherDocumentsList();
    this.saveProgress();
    showToast('Documento eliminado', 'info');
  }

  /**
   * Muestra modal para dibujar firma
   */
  showDrawSignatureModal(memberId, memberName) {
    const modalHTML = `
      <div class="modal-overlay" id="draw-signature-modal">
        <div class="modal-content modal-signature">
          <div class="modal-signature-header">
            <h3>Firma de ${memberName}</h3>
            <button class="modal-close-btn" id="close-signature-modal">&times;</button>
          </div>
          <div class="modal-signature-body">
            <p class="signature-instructions">Use el ratón o su dedo para dibujar la firma en el área de abajo.</p>
            <div class="signature-canvas-container">
              <canvas id="signature-canvas" width="500" height="200"></canvas>
            </div>
            <div class="signature-canvas-actions">
              <button class="btn-secondary" id="btn-clear-canvas">Limpiar</button>
            </div>
          </div>
          <div class="modal-signature-actions">
            <button type="button" class="btn-secondary" id="cancel-signature">Cancelar</button>
            <button type="button" class="btn-primary" id="save-signature">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Guardar Firma
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const canvas = document.getElementById('signature-canvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Configurar canvas
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    const startDrawing = (e) => {
      e.preventDefault();
      isDrawing = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
    };

    const draw = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    };

    const stopDrawing = () => {
      isDrawing = false;
    };

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    document.getElementById('btn-clear-canvas').addEventListener('click', () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    document.getElementById('close-signature-modal').addEventListener('click', () => {
      document.getElementById('draw-signature-modal').remove();
    });

    document.getElementById('cancel-signature').addEventListener('click', () => {
      document.getElementById('draw-signature-modal').remove();
    });

    document.getElementById('save-signature').addEventListener('click', () => {
      const dataURL = canvas.toDataURL('image/png');
      this.formData.signatures[memberId] = {
        type: 'drawn',
        data: dataURL,
        memberName: memberName,
        createdAt: new Date().toISOString()
      };
      this.saveProgress();
      this.renderSignaturesList();
      this.updateDocumentsWithSignatures();
      document.getElementById('draw-signature-modal').remove();
      showToast(`Firma de ${memberName} guardada`, 'success');
    });
  }

  /**
   * Muestra modal para firma digital
   */
  showDigitalSignatureModal(memberId, memberName) {
    const modalHTML = `
      <div class="modal-overlay" id="digital-signature-modal">
        <div class="modal-content modal-digital-signature">
          <div class="modal-signature-header">
            <h3>Firma Digital - ${memberName}</h3>
            <button class="modal-close-btn" id="close-digital-modal">&times;</button>
          </div>
          <div class="modal-signature-body">
            <div class="digital-signature-info">
              <div class="info-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h4>Autenticación con Clave Única</h4>
              <p>${memberName} debe autenticarse con su Clave Única del Registro Civil para firmar digitalmente los documentos.</p>
              <div class="digital-signature-steps">
                <div class="step-item">
                  <span class="step-num">1</span>
                  <span>Será redirigido al portal de Clave Única</span>
                </div>
                <div class="step-item">
                  <span class="step-num">2</span>
                  <span>Ingrese RUT y contraseña del firmante</span>
                </div>
                <div class="step-item">
                  <span class="step-num">3</span>
                  <span>Confirme la firma de los documentos</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-signature-actions">
            <button type="button" class="btn-secondary" id="cancel-digital">Cancelar</button>
            <button type="button" class="btn-primary btn-clave-unica" id="start-digital-signature">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Ir a Clave Única
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('close-digital-modal').addEventListener('click', () => {
      document.getElementById('digital-signature-modal').remove();
    });

    document.getElementById('cancel-digital').addEventListener('click', () => {
      document.getElementById('digital-signature-modal').remove();
    });

    document.getElementById('start-digital-signature').addEventListener('click', () => {
      // Simular proceso de firma digital (en producción sería integración real)
      showToast('Redirigiendo a Clave Única...', 'info');

      setTimeout(() => {
        this.formData.signatures[memberId] = {
          type: 'digital',
          provider: 'ClaveUnica',
          memberName: memberName,
          timestamp: new Date().toISOString(),
          verified: true
        };
        this.saveProgress();
        this.renderSignaturesList();
        this.updateDocumentsWithSignatures();
        document.getElementById('digital-signature-modal').remove();
        showToast(`Firma digital de ${memberName} completada`, 'success');
      }, 2000);
    });
  }

  /**
   * Muestra modal para firma manual
   */
  showManualSignatureModal(memberId, memberName) {
    const modalHTML = `
      <div class="modal-overlay" id="manual-signature-modal">
        <div class="modal-content modal-manual-signature">
          <div class="modal-signature-header">
            <h3>Firma Manual - ${memberName}</h3>
            <button class="modal-close-btn" id="close-manual-modal">&times;</button>
          </div>
          <div class="modal-signature-body">
            <div class="manual-signature-steps">
              <div class="manual-step">
                <div class="manual-step-number">1</div>
                <div class="manual-step-content">
                  <h4>Descargar Documentos</h4>
                  <p>Descargue los documentos para que ${memberName} los firme.</p>
                  <button class="btn-secondary" id="btn-download-all-docs">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Descargar Documentos
                  </button>
                </div>
              </div>

              <div class="manual-step">
                <div class="manual-step-number">2</div>
                <div class="manual-step-content">
                  <h4>Firmar</h4>
                  <p>${memberName} debe firmar los documentos impresos.</p>
                </div>
              </div>

              <div class="manual-step">
                <div class="manual-step-number">3</div>
                <div class="manual-step-content">
                  <h4>Subir Documento Firmado</h4>
                  <p>Suba el documento escaneado con la firma de ${memberName}.</p>
                  <input type="file" id="signed-docs-input" accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
                  <button class="btn-primary" id="btn-upload-signed-docs">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Subir Documento Firmado
                  </button>
                </div>
              </div>
            </div>

            <div class="uploaded-signed-docs" id="uploaded-signed-docs" style="display: none;">
              <h4>Documento Firmado:</h4>
              <div id="signed-docs-list"></div>
            </div>
          </div>
          <div class="modal-signature-actions">
            <button type="button" class="btn-secondary" id="cancel-manual">Cancelar</button>
            <button type="button" class="btn-primary" id="confirm-manual-signature" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Confirmar Firma
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    let signedDoc = null;

    document.getElementById('close-manual-modal').addEventListener('click', () => {
      document.getElementById('manual-signature-modal').remove();
    });

    document.getElementById('cancel-manual').addEventListener('click', () => {
      document.getElementById('manual-signature-modal').remove();
    });

    document.getElementById('btn-download-all-docs').addEventListener('click', () => {
      this.downloadAllDocuments();
    });

    document.getElementById('btn-upload-signed-docs').addEventListener('click', () => {
      document.getElementById('signed-docs-input').click();
    });

    document.getElementById('signed-docs-input').addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        signedDoc = {
          fileName: e.target.files[0].name,
          fileSize: e.target.files[0].size
        };

        const listContainer = document.getElementById('signed-docs-list');
        listContainer.innerHTML = `
          <div class="signed-doc-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            ${signedDoc.fileName}
          </div>
        `;

        document.getElementById('uploaded-signed-docs').style.display = 'block';
        document.getElementById('confirm-manual-signature').disabled = false;
      }
    });

    document.getElementById('confirm-manual-signature').addEventListener('click', () => {
      this.formData.signatures[memberId] = {
        type: 'manual',
        memberName: memberName,
        documentUploaded: signedDoc.fileName,
        uploadedAt: new Date().toISOString()
      };
      this.saveProgress();
      this.renderSignaturesList();
      this.updateDocumentsWithSignatures();
      document.getElementById('manual-signature-modal').remove();
      showToast(`Firma manual de ${memberName} confirmada`, 'success');
    });
  }

  /**
   * Descarga todos los documentos
   */
  downloadAllDocuments() {
    const documents = this.formData.documents || {};
    const docKeys = Object.keys(documents);

    if (docKeys.length === 0) {
      showToast('No hay documentos para descargar', 'warning');
      return;
    }

    let delay = 0;
    docKeys.forEach(docType => {
      setTimeout(() => this.downloadDocument(docType), delay);
      delay += 500; // Espaciar las descargas
    });
    showToast(`Descargando ${docKeys.length} documentos...`, 'info');
  }

  /**
   * Actualiza la UI de firma
   */
  updateSignatureUI() {
    const statusEl = document.getElementById('signature-status');
    const previewEl = document.getElementById('signature-preview');
    const optionsEl = document.querySelector('.signature-options');

    if (this.formData.signature) {
      statusEl.innerHTML = '<span class="status-signed">✓ Documentos firmados</span>';

      if (this.formData.signature.type === 'drawn') {
        previewEl.style.display = 'block';
        document.getElementById('signature-image').src = this.formData.signature.data;
        optionsEl.style.display = 'none';
      } else if (this.formData.signature.type === 'digital') {
        previewEl.style.display = 'block';
        document.getElementById('signature-image').parentElement.innerHTML = `
          <div class="digital-signature-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Firmado con Clave Única</span>
          </div>
        `;
        optionsEl.style.display = 'none';
      } else if (this.formData.signature.type === 'manual') {
        previewEl.style.display = 'block';
        document.getElementById('signature-image').parentElement.innerHTML = `
          <div class="manual-signature-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <polyline points="9 15 11 17 15 13"></polyline>
            </svg>
            <span>Documentos firmados manualmente (${this.formData.signature.documentsUploaded} archivos)</span>
          </div>
        `;
        optionsEl.style.display = 'none';
      }
    }
  }

  /**
   * Limpia la firma
   */
  clearSignature() {
    this.formData.signature = null;
    this.saveProgress();

    const statusEl = document.getElementById('signature-status');
    const previewEl = document.getElementById('signature-preview');
    const optionsEl = document.querySelector('.signature-options');

    statusEl.innerHTML = '<span class="status-pending">Pendiente de firma</span>';
    previewEl.style.display = 'none';

    // Restaurar imagen container
    const imageContainer = document.querySelector('.signature-image-container');
    if (imageContainer) {
      imageContainer.innerHTML = '<img id="signature-image" src="" alt="Tu firma">';
    }

    optionsEl.style.display = 'flex';
    showToast('Firma eliminada', 'info');
  }

  /**
   * Genera todos los documentos automáticamente
   */
  async generateAllDocuments() {
    const org = this.formData.organization;
    const members = this.formData.members;
    const commission = this.formData.commission;
    const directorio = this.formData.directorioProvisorio || {};
    const dirConfig = await fetchDirectorioConfig(org.type);
    const today = new Date().toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Buscar unidad vecinal automáticamente si no está definida
    if (!org.neighborhood && org.address) {
      try {
        const uvResult = await unidadesVecinalesService.buscarPorDireccion(org.address);
        if (uvResult.encontrada && uvResult.unidadVecinal) {
          org.neighborhood = uvResult.unidadVecinal.numero;
          this.formData.organization.neighborhood = uvResult.unidadVecinal.numero;
          console.log('Unidad Vecinal detectada automáticamente:', uvResult.unidadVecinal.numero);
        }
      } catch (error) {
        console.warn('No se pudo determinar la unidad vecinal:', error);
      }
    }

    // 1. Acta Constitutiva
    this.formData.documents['ACTA_CONSTITUTIVA'] = {
      id: 'doc-acta-constitutiva',
      type: 'ACTA_CONSTITUTIVA',
      isGenerated: true,
      content: this.generateActaConstitutiva(org, members, commission, today),
      generatedAt: new Date().toISOString()
    };

    // 2. Estatutos - Usar contenido editado si existe
    const estatutosContent = this.formData.statutes?.editedContent || this.generateEstatutos(org, today);
    this.formData.documents['ESTATUTOS'] = {
      id: 'doc-estatutos',
      type: 'ESTATUTOS',
      isGenerated: true,
      content: estatutosContent,
      generatedAt: new Date().toISOString()
    };

    // 3. Registro de Socios
    this.formData.documents['REGISTRO_SOCIOS'] = {
      id: 'doc-registro-socios',
      type: 'REGISTRO_SOCIOS',
      isGenerated: true,
      content: this.generateRegistroSocios(org, members, today),
      generatedAt: new Date().toISOString()
    };

    // 4. Declaraciones Juradas - Una por cada miembro del directorio
    dirConfig.cargos.forEach(cargo => {
      const miembro = directorio[cargo.id];
      if (miembro) {
        const docKey = `DECLARACION_JURADA_${cargo.id.toUpperCase()}`;
        this.formData.documents[docKey] = {
          id: `doc-declaracion-${cargo.id}`,
          type: docKey,
          isGenerated: true,
          content: this.generateDeclaracionJuradaDirector(org, miembro, cargo, today),
          generatedAt: new Date().toISOString(),
          cargoId: cargo.id,
          cargoNombre: cargo.nombre
        };
      }
    });

    // 5. Certificado del Ministro de Fe
    this.formData.documents['CERTIFICADO_MINISTRO_FE'] = {
      id: 'doc-certificado-ministro',
      type: 'CERTIFICADO_MINISTRO_FE',
      isGenerated: true,
      content: this.generateCertificadoMinistroFe(org, directorio, today),
      generatedAt: new Date().toISOString()
    };

    // 6. Certificación de Secretaría Municipal
    this.formData.documents['CERTIFICACION_MUNICIPAL'] = {
      id: 'doc-certificacion-municipal',
      type: 'CERTIFICACION_MUNICIPAL',
      isGenerated: true,
      content: this.generateCertificacionMunicipal(org, directorio, commission, today),
      generatedAt: new Date().toISOString()
    };

    // 7. Depósito de Antecedentes
    this.formData.documents['DEPOSITO_ANTECEDENTES'] = {
      id: 'doc-deposito-antecedentes',
      type: 'DEPOSITO_ANTECEDENTES',
      isGenerated: true,
      content: this.generateDepositoAntecedentes(org, today),
      generatedAt: new Date().toISOString()
    };

    // Mostrar previews
    this.updateDocumentPreviews();
  }

  /**
   * Genera el Acta Constitutiva - Documento Oficial Municipalidad de Renca
   * Formato base del documento legal con campos dinámicos
   */
  generateActaConstitutiva(org, members, commission, today) {
    // Formatear tipo de organización (usa tipos dinámicos desde API)
    const tipoOrg = getOrganizationTypeLabel(org.type) || org.type;

    // Obtener datos del directorio provisorio
    const directorio = this.formData.directorioProvisorio || {};
    const comisionMembers = commission?.members || [];
    const totalSocios = members?.length || 0;

    // Obtener configuración del directorio según tipo de organización
    const dirConfig = getDirectorioConfig(org.type);

    // Función para formatear nombre completo de un miembro
    const formatNombre = (member) => {
      if (!member) return '[Se completará en la Asamblea]';
      const nombre = member.primerNombre + (member.segundoNombre ? ' ' + member.segundoNombre : '');
      return `${nombre} ${member.apellidoPaterno} ${member.apellidoMaterno}`;
    };

    // Función para formatear RUT
    const formatRut = (member) => {
      if (!member) return '____________';
      return member.rut || '____________';
    };

    // Generar líneas dinámicas para la directiva provisional (formato alineado)
    // Usar ancho fijo total de 80 caracteres para alinear todos los RUTs
    let directivaLines = 'DIRECTIVA PROVISIONAL                                                  CED. IDENTIDAD\n';
    directivaLines +=    '─────────────────────────────────────────────────────────────────────────────────────\n';
    dirConfig.cargos.forEach(cargo => {
      const member = directorio[cargo.id];
      const cargoNombre = cargo.nombre.toUpperCase().replace('/A', ' (A)');
      const nombreCompleto = formatNombre(member);
      const rut = formatRut(member);
      // Usar ancho fijo: cargo 20 chars, nombre 40 chars con guiones, RUT alineado
      const cargoFixed = cargoNombre.padEnd(20, ' ');
      const nombreFixed = nombreCompleto.substring(0, 40).padEnd(40, '_');
      directivaLines += `${cargoFixed}${nombreFixed} ${rut}\n`;
    });

    // Generar líneas dinámicas para la comisión electoral
    let comisionLines = 'COMISION ELECTORAL                                                 CED. IDENTIDAD\n';
    for (let i = 0; i < 3; i++) {
      const member = comisionMembers[i];
      const nombreCompleto = formatNombre(member);
      const rut = formatRut(member);
      comisionLines += `\nDON (ÑA)            ${nombreCompleto.padEnd(45, '_')} ${rut}`;
    }

    // Datos del presidente para la delegación
    const presidente = directorio.presidente;
    const nombrePresidente = formatNombre(presidente);
    const domicilioOrg = org.address || '[Se completará en la Asamblea]';

    // Generar líneas de firmas dinámicas con nombres del directorio
    let firmasLines = 'Firmas:\n';
    const cargosParaFirma = dirConfig.cargos.filter(c =>
      ['presidente', 'secretario', 'tesorero', 'vicepresidente'].includes(c.id)
    );

    // Generar firmas con nombre y cargo
    cargosParaFirma.forEach(cargo => {
      const member = directorio[cargo.id];
      const nombreMiembro = formatNombre(member);
      const cargoLabel = cargo.nombre.toUpperCase().replace('/A', ' (A)');
      firmasLines += `\n\n________________________\n${nombreMiembro}\n${cargoLabel}`;
    });
    firmasLines += '\n\n________________________\n[Se asignará el día de la Asamblea]\nMINISTRO DE FE';

    return `REPUBLICA DE CHILE
ILUSTRE MUNICIPALIDAD DE RENCA
SECRETARÍA MUNICIPAL
"Departamento de Registro y Certificación"

ACTA DE ASAMBLEA GENERAL CONSTITUTIVA DE ESTATUTO
Y ELECCION DE DIRECTIVA PROVISIONAL

TIPO DE ORGANIZACIÓN ${tipoOrg}

NOMBRE INSTITUCIÓN ${org.name}
____________________________________________________________________________

ACTA DE ASAMBLEA

En Renca, a ________ de _______________________ del 20______, siendo las ________ horas, en
el local ubicado en ___________________________________________________, ante la presencia
del funcionario municipal Sr. (a) ______________________________________________________
como Ministro de Fe y la concurrencia de los futuros miembros de la Organización que en el listado
adjunto se individualizan y firman, tuvo lugar la Asamblea General destinar a aprobar el Estatuto
por el que se regirá la Organización y la elección del Directorio Provisional, todo conforme a lo que
establece la Ley Nº 19.418 del 09 de octubre de 1995.

Antes de iniciar la sesión, se verifico que existen a lo menos ${totalSocios > 0 ? totalSocios : '__________'} socios, los cuales cumplen
con los requisitos establecidos en la referida Ley y cuyo listado e individualización adjunto, forma
parte integrante de la presente Acta de Constitución para todos los efectos legales. Además, se dio
lectura al Proyecto de Estatuto propuesto por los Organizadores, el cual, sometido a la
consideración de la Asamblea, fue aprobado en la forma de que da cuenta el texto que se inserta al
final de la presente Acta y que forma parte integrante para todos los efectos legales. A continuación,
se procedió a elegir a la Directiva Provisional mediante voto nominativo, resultando elegido (a)
Presidente (a) quien obtuvo la más alta mayoría y como directores, aquellos que obtuvieron las
siguientes más altas mayorías de votos.

También, se procedió a elegir a las tres (3) personas que integraran la Comisión Electoral.

Producida la votación, resultaron elegidos como miembros del Directorio Provisional, los siguientes
socios:

${directivaLines}

${comisionLines}

La Comisión Organizadora delega la facultad de tramitar la aprobación de los presentes Estatutos y
acepta a nombre de los socios constituyentes, las modificaciones que el Secretario Municipal pueda
hacer a tales Estatutos, de acuerdo con el Articulo 7º, inciso final, de la Ley Nº 19.418, a Don
(ña) ${nombrePresidente},
Presidente (a) de la Organización, quien para estos efectos y para cualquier notificación a la
Organización señala el siguiente domicilio: ${domicilioOrg}

Suscriben la presente Acta en señal de ratificación de lo contenido en ella, la Directiva Provisional
electa y el Ministro de fe que asistió a la asamblea.

${firmasLines}`;
  }

  /**
   * Genera los Estatutos (BORRADOR)
   */
  generateEstatutos(org, today) {
    return `════════════════════════════════════════════════════════════════════
                    BORRADOR - PROYECTO DE ESTATUTOS
      Serán sometidos a votación en la Asamblea Constitutiva
════════════════════════════════════════════════════════════════════

ESTATUTOS
${org.name.toUpperCase()}

TÍTULO I
NOMBRE, DOMICILIO Y DURACIÓN

Artículo 1°: Constitúyese una ${org.type === 'JUNTA_VECINOS' ? 'Junta de Vecinos' : 'Organización Comunitaria Funcional'} que se denominará "${org.name}", en adelante también "la Organización".

Artículo 2°: El domicilio de la Organización será en ${org.address}, comuna de ${org.commune}, Región ${org.region}, sin perjuicio de las actividades que pueda desarrollar en otras localidades.

Artículo 3°: La duración de la Organización será indefinida.


TÍTULO II
OBJETIVOS

Artículo 4°: Los objetivos de la Organización son:
${org.objectives || org.description}

Artículo 5°: Para el cumplimiento de sus objetivos, la Organización podrá:
a) Representar a sus miembros ante las autoridades y organismos públicos y privados;
b) Gestionar y ejecutar proyectos de desarrollo comunitario;
c) Celebrar convenios con instituciones públicas y privadas;
d) Adquirir, administrar y enajenar bienes;
e) Realizar todas las actividades lícitas conducentes al logro de sus fines.


TÍTULO III
DE LOS SOCIOS

Artículo 6°: Podrán ser socios de la Organización todas las personas naturales, mayores de 14 años, que residan en la ${org.type === 'JUNTA_VECINOS' ? 'unidad vecinal ' + (org.neighborhood || '') : 'comuna de ' + org.commune}.

Artículo 7°: Son derechos de los socios:
a) Participar con derecho a voz y voto en las Asambleas;
b) Elegir y ser elegido para cargos directivos;
c) Presentar proyectos e iniciativas;
d) Acceder a la información de la Organización.

Artículo 8°: Son deberes de los socios:
a) Respetar los estatutos y reglamentos;
b) Cumplir los acuerdos de la Asamblea y Directorio;
c) Pagar las cuotas que se establezcan;
d) Participar activamente en las actividades de la Organización.


TÍTULO IV
DEL DIRECTORIO

Artículo 9°: La Organización será dirigida y administrada por un Directorio compuesto por:
a) Presidente/a
b) Vicepresidente/a
c) Secretario/a
d) Tesorero/a
e) Un Director/a

Artículo 10°: El Directorio durará dos años en sus funciones y sus miembros podrán ser reelegidos.

Artículo 11°: Son atribuciones del Directorio:
a) Dirigir la Organización y velar por el cumplimiento de sus objetivos;
b) Administrar los bienes de la Organización;
c) Convocar a Asambleas;
d) Ejecutar los acuerdos de la Asamblea;
e) Representar judicial y extrajudicialmente a la Organización.


TÍTULO V
DE LAS ASAMBLEAS

Artículo 12°: La Asamblea General es el órgano superior de la Organización. Se constituirá con la asistencia de la mayoría absoluta de los socios.

Artículo 13°: Las Asambleas serán ordinarias y extraordinarias. Las ordinarias se realizarán al menos una vez al año.


TÍTULO VI
DEL PATRIMONIO

Artículo 14°: El patrimonio de la Organización estará constituido por:
a) Las cuotas de los socios;
b) Donaciones y legados;
c) Bienes que adquiera a cualquier título;
d) Subvenciones y aportes públicos.


TÍTULO VII
DISPOSICIONES FINALES

Artículo 15°: La Organización podrá disolverse por acuerdo de los dos tercios de los socios en Asamblea especialmente convocada para tal efecto.

Artículo 16°: En caso de disolución, los bienes de la Organización pasarán a la entidad de beneficencia que determine la Asamblea.


[Pendiente de aprobación en Asamblea Constitutiva]

════════════════════════════════════════════════════════════════════
NOTA: Este proyecto de estatutos será sometido a votación y
aprobación por los miembros fundadores el día de la Asamblea.
════════════════════════════════════════════════════════════════════`;
  }

  /**
   * Genera el Registro de Socios (BORRADOR)
   */
  generateRegistroSocios(org, members, today) {
    let registro = `════════════════════════════════════════════════════════════════════════════════
                    BORRADOR - LISTADO PRELIMINAR DE SOCIOS
           Los asistentes firmarán el registro el día de la Asamblea
════════════════════════════════════════════════════════════════════════════════

REGISTRO DE SOCIOS FUNDADORES
${org.name.toUpperCase()}

Fecha de elaboración: Borrador previo a la Asamblea
Total de Socios Fundadores Registrados: ${members.length}

════════════════════════════════════════════════════════════════════════════════
`;

    members.forEach((member, index) => {
      const num = index + 1;
      const rut = member.rut || '';
      const nombre = `${member.firstName} ${member.lastName}`;
      const direccion = member.address || '';
      const telefono = member.phone || '';

      registro += `
SOCIO N° ${num}
────────────────────────────────────────
    RUT:        ${rut}
    Nombre:     ${nombre}
    Domicilio:  ${direccion}
    Teléfono:   ${telefono}
`;
    });

    registro += `
════════════════════════════════════════════════════════════════════════════════`;

    // Obtener secretario del directorio
    const directorio = this.formData.directorioProvisorio || {};
    const secretario = directorio.secretario;
    const nombreSecretario = secretario
      ? `${secretario.primerNombre}${secretario.segundoNombre ? ' ' + secretario.segundoNombre : ''} ${secretario.apellidoPaterno} ${secretario.apellidoMaterno}`
      : '[Se asignará en la Asamblea]';

    registro += `${'='.repeat(100)}

[CERTIFICACIÓN PENDIENTE - SE COMPLETARÁ EN LA ASAMBLEA]

El día de la Asamblea Constitutiva, el Secretario del Directorio Provisorio
certificará la participación de los ${members.length} socios fundadores.


[ESPACIO PARA FIRMA - SE REALIZARÁ EN LA ASAMBLEA]
________________________
${nombreSecretario}
Secretario/a del Directorio Provisorio

════════════════════════════════════════════════════════════════════
NOTA: Este listado será verificado y firmado el día de la Asamblea
Constitutiva. Los asistentes deberán acreditar su identidad.
════════════════════════════════════════════════════════════════════`;

    return registro;
  }

  /**
   * Genera la Declaración Jurada (BORRADOR)
   * La Declaración Jurada la firma el PRESIDENTE DEL DIRECTORIO, no la Comisión Electoral
   */
  generateDeclaracionJurada(org, commission, today) {
    // Obtener presidente del directorio (NO de la comisión electoral)
    const directorio = this.formData.directorioProvisorio || {};
    const presidente = directorio.presidente;

    // Formatear nombre del presidente
    const nombrePresidente = presidente
      ? `${presidente.primerNombre}${presidente.segundoNombre ? ' ' + presidente.segundoNombre : ''} ${presidente.apellidoPaterno} ${presidente.apellidoMaterno}`
      : '[Nombre del Presidente]';
    const rutPresidente = presidente?.rut || '[RUT]';
    const direccionPresidente = presidente?.address || org.address || '[Dirección]';

    return `════════════════════════════════════════════════════════════════════
                    BORRADOR - MODELO DE DECLARACIÓN JURADA
         El Presidente firmará este documento el día de la Asamblea
════════════════════════════════════════════════════════════════════

DECLARACIÓN JURADA SIMPLE

Yo, ${nombrePresidente}, RUT ${rutPresidente}, domiciliado/a en ${direccionPresidente}, en mi calidad de Presidente del Directorio Provisorio de ${org.name}, DECLARARÉ bajo juramento lo siguiente el día de la Asamblea Constitutiva:

1. Que la Asamblea Constitutiva de ${org.name} se realizará con la asistencia de los ${this.formData.members.length} miembros fundadores registrados, quienes cumplen con los requisitos legales para ser miembros de la organización.

2. Que los estatutos serán sometidos a votación y aprobación de los asistentes.

3. Que la Comisión Electoral fue designada para supervisar el proceso eleccionario del primer Directorio definitivo.

4. Que la fecha para la elección del Directorio será programada por la Comisión Electoral.

5. Que toda la información proporcionada en la solicitud de constitución es verídica.

6. Que conozco y acepto las responsabilidades que me corresponden según la Ley N° 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias.

Asumiré la responsabilidad legal por la veracidad de esta declaración, en conformidad con el artículo 212 del Código Penal.

${org.commune}, [FECHA DE LA ASAMBLEA]


[ESPACIO PARA FIRMA - SE REALIZARÁ EN LA ASAMBLEA]
________________________
${nombrePresidente}
RUT: ${rutPresidente}
Presidente/a del Directorio Provisorio
${org.name}

════════════════════════════════════════════════════════════════════
NOTA: Esta declaración será firmada por el Presidente del Directorio
Provisorio el día de la Asamblea Constitutiva, ante el Ministro de Fe.
════════════════════════════════════════════════════════════════════`;
  }

  /**
   * Genera el Acta de la Comisión Electoral (BORRADOR)
   */
  generateActaComisionElectoral(org, commission, today) {
    return `════════════════════════════════════════════════════════════════════
                    BORRADOR - PROYECTO DE ACTA
       La Comisión Electoral firmará el día de la Asamblea
════════════════════════════════════════════════════════════════════

ACTA DE ESTABLECIMIENTO DE COMISIÓN ELECTORAL

${org.name.toUpperCase()}

En ${org.commune}, Región ${org.region}, a [FECHA DE LA ASAMBLEA], en el marco de la Asamblea Constitutiva de ${org.name}, se procederá a establecer la Comisión Electoral que supervisará el proceso de elección del primer Directorio de la organización.

De acuerdo con lo establecido en la Ley N° 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias, la Comisión Electoral quedará integrada por los siguientes miembros propuestos:


1. PRESIDENTE DE LA COMISIÓN ELECTORAL
   Nombre: ${commission.members[0]?.firstName || ''} ${commission.members[0]?.lastName || ''}
   RUT: ${commission.members[0]?.rut || ''}
   Domicilio: ${commission.members[0]?.address || ''}
   Teléfono: ${commission.members[0]?.phone || ''}
   Email: ${commission.members[0]?.email || ''}

2. SECRETARIO DE LA COMISIÓN ELECTORAL
   Nombre: ${commission.members[1]?.firstName || ''} ${commission.members[1]?.lastName || ''}
   RUT: ${commission.members[1]?.rut || ''}
   Domicilio: ${commission.members[1]?.address || ''}
   Teléfono: ${commission.members[1]?.phone || ''}
   Email: ${commission.members[1]?.email || ''}

3. VOCAL DE LA COMISIÓN ELECTORAL
   Nombre: ${commission.members[2]?.firstName || ''} ${commission.members[2]?.lastName || ''}
   RUT: ${commission.members[2]?.rut || ''}
   Domicilio: ${commission.members[2]?.address || ''}
   Teléfono: ${commission.members[2]?.phone || ''}
   Email: ${commission.members[2]?.email || ''}


FUNCIONES DE LA COMISIÓN ELECTORAL:

1. Convocar a elecciones del Directorio dentro del plazo establecido.
2. Inscribir las candidaturas que se presenten.
3. Verificar que los candidatos cumplan los requisitos legales.
4. Organizar y supervisar el acto eleccionario.
5. Realizar el escrutinio de la votación.
6. Proclamar a los candidatos electos.
7. Resolver las reclamaciones que se presenten.


FECHA DE ELECCIÓN PROGRAMADA: [A DEFINIR POR LA COMISIÓN ELECTORAL]

LUGAR DE VOTACIÓN: [A DEFINIR]


Los integrantes de la Comisión Electoral aceptarán el cargo y se comprometerán a cumplir fielmente sus funciones de acuerdo con la ley y los estatutos de la organización.

Para constancia, firmarán el día de la Asamblea:


[ESPACIO PARA FIRMA - SE REALIZARÁ EN LA ASAMBLEA]
________________________
${commission.members[0]?.firstName || ''} ${commission.members[0]?.lastName || ''}
RUT: ${commission.members[0]?.rut || ''}
Presidente


[ESPACIO PARA FIRMA - SE REALIZARÁ EN LA ASAMBLEA]
________________________
${commission.members[1]?.firstName || ''} ${commission.members[1]?.lastName || ''}
RUT: ${commission.members[1]?.rut || ''}
Secretario


[ESPACIO PARA FIRMA - SE REALIZARÁ EN LA ASAMBLEA]
________________________
${commission.members[2]?.firstName || ''} ${commission.members[2]?.lastName || ''}
RUT: ${commission.members[2]?.rut || ''}
Vocal

════════════════════════════════════════════════════════════════════
NOTA: Este documento será firmado por los integrantes de la Comisión
Electoral el día de la Asamblea Constitutiva, ante el Ministro de Fe.
════════════════════════════════════════════════════════════════════`;
  }

  /**
   * Genera una Declaración Jurada individual por cada miembro del Directorio
   */
  generateDeclaracionJuradaDirector(org, miembro, cargo, today) {
    // Formatear nombre completo
    const nombreCompleto = miembro
      ? `${miembro.primerNombre}${miembro.segundoNombre ? ' ' + miembro.segundoNombre : ''} ${miembro.apellidoPaterno} ${miembro.apellidoMaterno}`
      : '________________________________________________________________';
    const rut = miembro?.rut || '______________________________________________';
    const direccion = miembro?.address || org.address || '__________________________________________________';
    const email = miembro?.email || '_____________________________________________________';

    return `DECLARACION JURADA SIMPLE

YO, ${nombreCompleto}

CEDULA DE IDENTIDAD:
${rut}

CON DOMICILIO EN:
${direccion}

• Declaro bajo juramento:

• Estar afiliado a la Organización Comunitaria.

• No tener menos de 18 años.

• Ser Chileno.

• No ser procesado o cumpliendo condena por delito que merezca pena aflictiva.

• No ser miembro de la Comisión Electoral de la Organización.

• No tener ninguna incompatibilidad o inhabilidad para pertenecer a una
Organización Comunitaria, conforme a la Ley N° 19.418.

Formulo la presente declaración para acreditar que cumplo con los requisitos
Establecidos en el artículo 20° de la Ley N° 19.418, para ser Director de la Organización
denominada:

${org.name}

Correo electrónico:
${email}


_________________
FIRMA`;
  }

  /**
   * Genera el Certificado del Ministro de Fe
   */
  generateCertificadoMinistroFe(org, directorio, today) {
    // Formatear nombre del presidente
    const presidente = directorio.presidente;
    const nombrePresidente = presidente
      ? `${presidente.primerNombre}${presidente.segundoNombre ? ' ' + presidente.segundoNombre : ''} ${presidente.apellidoPaterno} ${presidente.apellidoMaterno}`
      : '________________________________________________________________________';
    const domicilioPresidente = presidente?.address || org.address || '______________________________________________________________';
    const telefonoPresidente = presidente?.phone || '__________________________';

    return `════════════════════════════════════════════════════════════════════
                              BORRADOR
        Este documento será completado el día de la Asamblea
════════════════════════════════════════════════════════════════════


                        C E R T I F I C A D O


__________________________________________________________, funcionario (a)
municipal que suscribe en calidad de Ministro de Fe, certifica que asistió a la
Asamblea Constitutiva de la Organización Comunitaria denominada:

${org.name || '_________________________________________________________________________'}
_________________________________________________________________________

que precede, la que se celebró en el lugar, día y hora indicados en ella.

• Que, asistieron a la Asamblea los socios que se señalan en el Acta que se adjunta.

• Que, todas las proposiciones de acuerdo que se contienen en el Acta precedente, fueron
  leídas, puestas en discusión y aprobadas en la forma expresa en el Acta.

• Que, para todos los efectos legales, el (la) Presidente (a) de la institución es Don (ña)
  ${nombrePresidente}
  y su domicilio es ${domicilioPresidente}
  teléfono ${telefonoPresidente}


Se adjunta el presente:

    • Depósito de Antecedentes.
    • Certificación.
    • Acta de Asamblea General Constitutiva.
    • Certificado.
    • Declaración Jurada Simple de los Directores Provisionales.
    • Estatutos
    • Listado de Socios asistentes.



                    ___________________________________
                                 FIRMA


Renca, ______________________


════════════════════════════════════════════════════════════════════
NOTA: Este certificado será completado y firmado por el Ministro de Fe
designado por la Municipalidad el día de la Asamblea Constitutiva.
════════════════════════════════════════════════════════════════════`;
  }

  /**
   * Genera la Certificación de Secretaría Municipal
   */
  generateCertificacionMunicipal(org, directorio, commission, today) {
    const dirConfig = getDirectorioConfig(org.type);
    const unidadVecinal = org.neighborhood || '___________';

    // Formatear miembro para nombre y RUT
    const formatNombre = (member) => {
      if (!member) return '_________________________________________';
      return `${member.primerNombre}${member.segundoNombre ? ' ' + member.segundoNombre : ''} ${member.apellidoPaterno} ${member.apellidoMaterno}`;
    };
    const formatRut = (member) => {
      if (!member) return '____________________';
      return member.rut || '____________________';
    };

    // Generar líneas dinámicas del directorio - según cantidad de cargos
    // Usar formato alineado: cargo 20 chars, nombre 35 chars con guiones, CI alineado
    let directivaLines = '';
    dirConfig.cargos.forEach(cargo => {
      const miembro = directorio[cargo.id];
      const cargoLabel = cargo.nombre.toUpperCase().replace('/A', '');
      const nombre = formatNombre(miembro);
      const rut = formatRut(miembro);
      // Cargo fijo 20 chars, nombre fijo 35 chars con guiones
      const cargoFixed = cargoLabel.padEnd(20, ' ');
      const nombreFixed = nombre.substring(0, 35).padEnd(35, '_');
      directivaLines += `${cargoFixed}${nombreFixed} C.I. Nº ${rut}\n`;
    });

    // Generar líneas de comisión electoral (siempre 3)
    const comisionMembers = commission?.members || [];
    let comisionLines = '';
    for (let i = 0; i < 3; i++) {
      const member = comisionMembers[i];
      const nombre = member ? `${member.firstName} ${member.lastName}`.substring(0, 35).padEnd(35, '_') : '_'.repeat(35);
      const rut = member?.rut || '____________________';
      // Mismo formato: prefijo 20 chars, nombre 35 chars
      comisionLines += `${'DON (ÑA)'.padEnd(20, ' ')}${nombre} C.I. Nº ${rut}\n`;
    }

    // Datos del presidente
    const presidente = directorio.presidente;
    const nombrePresidente = formatNombre(presidente);

    return `════════════════════════════════════════════════════════════════════
                              BORRADOR
        Este documento será completado el día de la Asamblea
════════════════════════════════════════════════════════════════════


                    CERTIFICACION N.º ________________/


En Renca, a ________________________, en cumplimiento a lo que establece el
Artículo 8º de la Ley Nº 19.418 de 1995, el Secretario Municipal que suscribe
certifica que, la Organización Denominada:

${org.name || '_____________________________________________________________________________'}

de la Unidad Vecinal Nº ${unidadVecinal} depósito en esta Secretaría Municipal, copia
autorizada del de Asamblea Constitutiva.

La citada Asamblea Constitutiva se efectuó el día ________ de ___________ del
año ___________________ ante el Ministro de Fe Don (ña):

_______________________________________________________________

Funcionario (a) municipal, en el local ubicado en:

_________________________________________________

En dicha sesión, se aprobaron los Estatutos de la Organización y fueron elegidos
como integrantes de la Directiva Provisoria y Comisión Electoral, los siguientes socios.


DIRECTIVA PROVISORIA
─────────────────────────────────────────────────────────────────────
${directivaLines}

COMISION ELECTORAL
─────────────────────────────────────────────────────────────────────
${comisionLines}

Dicha Organización gozara de Personalidad Jurídica conforme a la Ley Nº 19.418
de 1995, a contar de la fecha del depósito del Acta de Asamblea Constitutiva,
la cual fue depositada en la Secretaria Municipal por:

Don (ña) ${nombrePresidente}
presidenta (e) de la organización y Don (ña) ___________________
en su calidad de Ministro de Fe, con domicilio en Blanco Encalada Nº 1335.

Se entrega este certificado al (a la) Presidente (a) de la Organización para todos
los efectos legales derivados de la Ley Nº 19.418. En ausencia del Titular, en el
acto de retiro, envíese la presente certificación, por cedula al domicilio fijado
por el (la) Presidente (a), en la Asamblea Constitutiva.



                                        Secretaria Municipal


════════════════════════════════════════════════════════════════════
NOTA: Esta certificación será emitida por la Secretaría Municipal
una vez completado el proceso de constitución el día de la Asamblea.
════════════════════════════════════════════════════════════════════`;
  }

  /**
   * Genera el Depósito de Antecedentes
   */
  generateDepositoAntecedentes(org, today) {
    // Usar tipos dinámicos desde API
    const tipoOrg = getOrganizationTypeLabel(org.type) || '___________________________________________';
    const unidadVecinal = org.neighborhood || '___________';

    return `DEPOSITO DE ANTECEDENTES N° __________/

TIPO DE ORGANIZACIÓN: ${tipoOrg}

NOMBRE DE LA ORGANIZACIÓN:
${org.name || '_____________________________________'}

UNIDAD VECINAL: ${unidadVecinal}/

En Renca, a ______________________ de conformidad a lo que establece la Ley Nº
19.418 del 09 de octubre de 1995, procedo a inscribir en el presente Libro de Registro a la
Organización Comunitaria antes señalada.

Los documentos relativos al Acta de Constitución, Aprobación de Estatutos, Listado
de Socios, Asistentes y Elección de Directorio Provisional, se encuentran archivados
en Carpeta Digital en el Departamento de Registro y Certificación.


Secretaria Municipal`;
  }

  /**
   * Actualiza los previews de documentos (deshabilitado - ya no se muestran previews)
   */
  updateDocumentPreviews() {
    // No hacer nada - los previews fueron eliminados del diseño
  }

  /**
   * Muestra preview de un documento con diseño institucional
   */
  showDocumentPreview(docType) {
    const doc = this.formData.documents[docType];
    if (!doc) {
      showToast('Documento no encontrado', 'error');
      return;
    }

    const docNames = {
      'ACTA_CONSTITUTIVA': 'Acta Constitutiva',
      'ESTATUTOS': 'Estatutos',
      'REGISTRO_SOCIOS': 'Registro de Socios',
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada - Presidente/a',
      'DECLARACION_JURADA_SECRETARIO': 'Declaración Jurada - Secretario/a',
      'DECLARACION_JURADA_TESORERO': 'Declaración Jurada - Tesorero/a',
      'DECLARACION_JURADA_DIRECTOR1': 'Declaración Jurada - Director/a 1',
      'DECLARACION_JURADA_DIRECTOR2': 'Declaración Jurada - Director/a 2',
      'DECLARACION_JURADA_DIRECTOR3': 'Declaración Jurada - Director/a 3',
      'CERTIFICADO_MINISTRO_FE': 'Certificado del Ministro de Fe',
      'CERTIFICACION_MUNICIPAL': 'Certificación Municipal',
      'DEPOSITO_ANTECEDENTES': 'Depósito de Antecedentes'
    };

    // Configuración de qué firmas adicionales requiere cada documento
    const docSignatureConfig = {};
    const requiredSigners = docSignatureConfig[docType] || [];
    const signaturesHTML = requiredSigners.length > 0 ? this.generateSignaturesHTML(requiredSigners) : '';

    // Formatear contenido del documento para mejor visualización
    const formattedContent = this.formatDocumentForPreview(doc.content.split('========== FIRMAS ==========')[0]);

    const modalHTML = `
      <div class="modal-overlay" id="preview-document-modal" style="z-index: 10001;">
        <div class="modal-content modal-document-preview" style="max-width: 900px; width: 95%; max-height: 95vh; display: flex; flex-direction: column;">
          <div class="modal-document-header" style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: white; padding: 16px 20px; border-radius: 16px 16px 0 0;">
            <h3 style="margin: 0; font-size: 18px;">${docNames[docType] || docType}</h3>
            <button class="modal-close-btn" id="close-preview-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 20px;">&times;</button>
          </div>

          <div class="modal-document-body" style="flex: 1; overflow-y: auto; padding: 0; background: #f8fafc;">
            <!-- Documento con diseño de página -->
            <div class="document-page" style="max-width: 816px; margin: 20px auto; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 4px; overflow: hidden;">
              <!-- Header institucional -->
              <div class="doc-header" style="width: 100%; height: auto;">
                <img src="/doc-header.png" alt="Municipalidad de Renca" style="width: 100%; height: auto; display: block;">
              </div>

              <!-- Contenido del documento -->
              <div class="doc-content" style="padding: 30px 40px; min-height: 600px; font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a;">
                ${formattedContent}
                ${signaturesHTML}
              </div>

              <!-- Footer institucional -->
              <div class="doc-footer" style="width: 100%; height: auto; margin-top: auto;">
                <img src="/doc-footer.png" alt="Contacto Municipalidad" style="width: 100%; height: auto; display: block;">
              </div>
            </div>
          </div>

          <div class="modal-document-actions" style="padding: 16px 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 12px; background: white; border-radius: 0 0 16px 16px;">
            <button type="button" class="btn-secondary" id="close-preview" style="padding: 10px 20px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; font-weight: 600; cursor: pointer;">Cerrar</button>
            <button type="button" class="btn-primary" id="download-from-preview" data-doc-type="${docType}" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Descargar PDF
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('close-preview-modal').addEventListener('click', () => {
      document.getElementById('preview-document-modal').remove();
    });

    document.getElementById('close-preview').addEventListener('click', () => {
      document.getElementById('preview-document-modal').remove();
    });

    document.getElementById('download-from-preview').addEventListener('click', () => {
      this.downloadDocument(docType);
    });
  }

  /**
   * Formatea el contenido del documento para la vista previa HTML
   * @param {boolean} highlightAutoData - Si true, resalta datos auto-generados
   */
  formatDocumentForPreview(content, highlightAutoData = true) {
    if (!content) return '';

    // Escapar HTML primero
    let html = this.escapeHtml(content);

    // Si se debe resaltar datos automáticos, aplicar highlighting
    if (highlightAutoData) {
      html = this.highlightAutoData(html);
    }

    // Convertir líneas a párrafos con estilos apropiados
    const lines = html.split('\n');
    let formattedLines = [];

    lines.forEach(line => {
      const trimmedLine = line.trim();

      // Detectar separadores
      if (/^[═─━═─\-=]+$/.test(trimmedLine) && trimmedLine.length > 3) {
        formattedLines.push('<hr style="border: none; border-top: 1px solid #cbd5e1; margin: 15px 0;">');
        return;
      }

      // Detectar BORRADOR
      if (trimmedLine.includes('BORRADOR') || trimmedLine.includes('*** BORRADOR ***')) {
        formattedLines.push(`<p style="text-align: center; color: #dc2626; font-weight: bold; font-size: 14pt; margin: 10px 0; padding: 8px; background: #fef2f2; border: 1px dashed #dc2626; border-radius: 4px;">${trimmedLine}</p>`);
        return;
      }

      // Detectar títulos principales (todo mayúsculas y más de 3 chars)
      if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && /[A-ZÁÉÍÓÚÑ]/.test(trimmedLine)) {
        // Es un título si tiene letras mayúsculas y no es una línea de datos
        if (!trimmedLine.includes(':') || trimmedLine.split(':')[0].length > 30) {
          formattedLines.push(`<p style="font-weight: bold; font-size: 13pt; text-align: center; margin: 20px 0 10px 0; text-transform: uppercase;">${trimmedLine}</p>`);
          return;
        }
      }

      // Líneas vacías
      if (trimmedLine === '') {
        formattedLines.push('<br>');
        return;
      }

      // Líneas normales - preservar espacios al inicio para indentación
      const leadingSpaces = line.match(/^\s*/)[0].length;
      const indent = leadingSpaces > 0 ? `padding-left: ${leadingSpaces * 8}px;` : '';
      formattedLines.push(`<p style="margin: 4px 0; ${indent}">${trimmedLine}</p>`);
    });

    // Agregar leyenda de datos auto-generados si está habilitado
    if (highlightAutoData) {
      const legend = this.getAutoDataLegend();
      return legend + formattedLines.join('');
    }

    return formattedLines.join('');
  }

  /**
   * Aplica resaltado a datos auto-generados en el contenido
   */
  highlightAutoData(text) {
    // Resaltar RUTs (formato: XX.XXX.XXX-X o XXXXXXXX-X)
    text = text.replace(/(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/gi, '<span class="auto-data auto-data-rut" title="RUT auto-generado">$1</span>');

    // Resaltar fechas en formato español (ej: 15 de enero del 2025)
    const meses = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';
    const dateRegex = new RegExp(`(\\d{1,2}\\s+de\\s+(${meses})\\s+(de|del)\\s+\\d{4})`, 'gi');
    text = text.replace(dateRegex, '<span class="auto-data auto-data-date" title="Fecha auto-generada">$1</span>');

    // Resaltar horas (ej: 10:30 horas, 15:00 hrs)
    text = text.replace(/(\d{1,2}:\d{2}\s*(horas?|hrs?))/gi, '<span class="auto-data auto-data-date" title="Hora auto-generada">$1</span>');

    // Resaltar cantidades de socios (ej: "45 socios")
    text = text.replace(/(\d+)\s+(socios?|miembros?|asistentes?)/gi, '<span class="auto-data" title="Cantidad auto-generada">$1</span> $2');

    return text;
  }

  /**
   * Genera la leyenda explicativa de datos auto-generados
   */
  getAutoDataLegend() {
    return `
      <div class="auto-data-legend" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #0ea5e9; border-radius: 12px; padding: 16px 20px; margin: 16px 0;">
        <div class="auto-data-legend-title" style="font-weight: 700; color: #0369a1; font-size: 14px; display: flex; align-items: center; gap: 8px; width: 100%; margin-bottom: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Datos Auto-Generados
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; color: #475569;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="auto-data-rut" style="background: linear-gradient(120deg, #d1fae5 0%, #a7f3d0 100%); padding: 2px 8px; border-radius: 4px; border-bottom: 2px solid #10b981; font-family: monospace;">12.345.678-9</span>
            <span>RUT</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="auto-data-date" style="background: linear-gradient(120deg, #ede9fe 0%, #ddd6fe 100%); padding: 2px 8px; border-radius: 4px; border-bottom: 2px solid #8b5cf6;">15 de enero</span>
            <span>Fecha</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="auto-data" style="background: linear-gradient(120deg, #fef9c3 0%, #fef08a 100%); padding: 2px 8px; border-radius: 4px; border-bottom: 2px solid #eab308;">45</span>
            <span>Cantidad</span>
          </div>
        </div>
        <p style="margin: 10px 0 0; font-size: 11px; color: #64748b; font-style: italic;">
          Los datos resaltados fueron completados automáticamente con la información ingresada.
        </p>
      </div>
    `;
  }

  /**
   * Escapa HTML para evitar inyección
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Genera el HTML visual de las firmas para el preview
   * @param {Array} signerIndices - Índices de los firmantes a incluir (0=Presidente, 1=Secretario, 2=Vocal)
   */
  generateSignaturesHTML(signerIndices = [0, 1, 2]) {
    const signatures = this.formData.signatures || {};
    const commission = this.formData.commission.members || [];
    // La Comisión Electoral NO tiene cargos - solo 3 miembros
    if (commission.length === 0) return '';

    // Filtrar solo los miembros que deben firmar este documento
    const signers = signerIndices
      .filter(idx => idx < commission.length)
      .map(idx => ({ member: commission[idx], index: idx }));

    if (signers.length === 0) return '';

    // Ajustar grid según cantidad de firmantes
    const gridClass = signers.length === 1 ? 'signatures-grid-single' :
                      signers.length === 2 ? 'signatures-grid-double' : 'signatures-grid';

    let html = `
      <div class="document-signatures-section">
        <h4 class="signatures-title">FIRMA${signers.length > 1 ? 'S' : ''}</h4>
        <div class="${gridClass}">
    `;

    signers.forEach(({ member, index }) => {
      const signature = signatures[member.id];

      html += `
        <div class="signature-block">
          <div class="signature-area">
      `;

      if (signature) {
        if (signature.type === 'drawn' && signature.data) {
          html += `<img src="${signature.data}" alt="Firma de ${member.firstName}" class="signature-image">`;
        } else if (signature.type === 'digital') {
          html += `
            <div class="digital-signature-stamp">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>FIRMA ELECTRÓNICA</span>
              <small>Clave Única - ${new Date(signature.timestamp).toLocaleDateString('es-CL')}</small>
            </div>
          `;
        } else if (signature.type === 'manual') {
          html += `
            <div class="manual-signature-stamp">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <polyline points="9 15 11 17 15 13"></polyline>
              </svg>
              <span>FIRMA MANUAL</span>
              <small>Documento adjunto - ${new Date(signature.uploadedAt).toLocaleDateString('es-CL')}</small>
            </div>
          `;
        }
      } else {
        html += `<div class="pending-signature">[Pendiente de firma]</div>`;
      }

      html += `
          </div>
          <div class="signature-line"></div>
          <div class="signature-info">
            <strong>Miembro de la Comisión Electoral</strong>
            <span>${member.firstName} ${member.lastName}</span>
            <span>RUT: ${member.rut}</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Muestra modal para editar documento con diseño institucional
   */
  showEditDocumentModal(docType) {
    const doc = this.formData.documents[docType];
    if (!doc) {
      showToast('Documento no encontrado', 'error');
      return;
    }

    const docNames = {
      'ACTA_CONSTITUTIVA': 'Acta Constitutiva',
      'ESTATUTOS': 'Estatutos',
      'REGISTRO_SOCIOS': 'Registro de Socios',
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada - Presidente/a',
      'DECLARACION_JURADA_SECRETARIO': 'Declaración Jurada - Secretario/a',
      'DECLARACION_JURADA_TESORERO': 'Declaración Jurada - Tesorero/a',
      'DECLARACION_JURADA_DIRECTOR1': 'Declaración Jurada - Director/a 1',
      'DECLARACION_JURADA_DIRECTOR2': 'Declaración Jurada - Director/a 2',
      'DECLARACION_JURADA_DIRECTOR3': 'Declaración Jurada - Director/a 3',
      'CERTIFICADO_MINISTRO_FE': 'Certificado del Ministro de Fe',
      'CERTIFICACION_MUNICIPAL': 'Certificación Municipal',
      'DEPOSITO_ANTECEDENTES': 'Depósito de Antecedentes'
    };

    const modalHTML = `
      <div class="modal-overlay" id="edit-document-modal">
        <div class="modal-content modal-document-edit" style="max-width: 900px; width: 95%; max-height: 95vh; display: flex; flex-direction: column;">
          <div class="modal-document-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 20px; border-radius: 16px 16px 0 0; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <h3 style="margin: 0; font-size: 18px;">Editar: ${docNames[docType] || docType}</h3>
            </div>
            <button class="modal-close-btn" id="close-edit-doc-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 20px;">&times;</button>
          </div>

          <div class="modal-document-body" style="flex: 1; overflow-y: auto; padding: 0; background: #f8fafc;">
            <!-- Documento con diseño de página -->
            <div class="document-page" style="max-width: 816px; margin: 20px auto; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 4px; overflow: hidden;">
              <!-- Header institucional -->
              <div class="doc-header" style="width: 100%; height: auto;">
                <img src="/doc-header.png" alt="Municipalidad de Renca" style="width: 100%; height: auto; display: block;">
              </div>

              <!-- Área de edición del documento -->
              <div class="doc-content" style="padding: 20px;">
                <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span style="color: #92400e; font-size: 13px;">Edite el contenido del documento. Los cambios se reflejarán en la vista previa y en el PDF descargado.</span>
                </div>
                <textarea class="document-content-edit" id="edit-doc-content" style="width: 100%; min-height: 500px; padding: 20px; border: 2px solid #e5e7eb; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.6; resize: vertical; box-sizing: border-box;">${doc.content}</textarea>
              </div>

              <!-- Footer institucional -->
              <div class="doc-footer" style="width: 100%; height: auto;">
                <img src="/doc-footer.png" alt="Contacto Municipalidad" style="width: 100%; height: auto; display: block;">
              </div>
            </div>
          </div>

          <div class="modal-document-actions" style="padding: 16px 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 12px; background: white; border-radius: 0 0 16px 16px;">
            <button type="button" class="btn-secondary" id="cancel-edit-doc" style="padding: 10px 20px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; font-weight: 600; cursor: pointer;">Cancelar</button>
            <button type="button" class="btn-primary" id="save-edit-doc" data-doc-type="${docType}" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('close-edit-doc-modal').addEventListener('click', () => {
      document.getElementById('edit-document-modal').remove();
    });

    document.getElementById('cancel-edit-doc').addEventListener('click', () => {
      document.getElementById('edit-document-modal').remove();
    });

    document.getElementById('save-edit-doc').addEventListener('click', () => {
      const newContent = document.getElementById('edit-doc-content').value;
      this.formData.documents[docType].content = newContent;
      this.formData.documents[docType].editedAt = new Date().toISOString();
      this.updateDocumentPreviews();
      document.getElementById('edit-document-modal').remove();
      showToast('Documento actualizado correctamente', 'success');
    });
  }

  /**
   * Descarga un documento en formato PDF con diseño institucional
   */
  async downloadDocument(docType) {
    const doc = this.formData.documents[docType];
    if (!doc) {
      showToast('Documento no encontrado', 'error');
      return;
    }

    const docNames = {
      'ACTA_CONSTITUTIVA': 'Acta_Constitutiva',
      'ESTATUTOS': 'Estatutos',
      'REGISTRO_SOCIOS': 'Registro_Socios',
      'DECLARACION_JURADA_PRESIDENTE': 'Declaracion_Jurada',
      'ACTA_COMISION_ELECTORAL': 'Acta_Comision_Electoral',
      'CERTIFICACION_MUNICIPAL': 'Certificacion_Municipal',
      'CERTIFICADO_MINISTRO_FE': 'Certificado_Ministro_Fe',
      'DEPOSITO_ANTECEDENTES': 'Deposito_Antecedentes'
    };

    const orgName = this.formData.organization.name?.replace(/\s+/g, '_') || 'Organizacion';
    const fileName = `${docNames[docType] || docType}_${orgName}.pdf`;

    try {
      showToast('Generando PDF...', 'info');

      // Cargar imágenes de header y footer
      const [headerImg, footerImg] = await Promise.all([
        this.loadImageAsBase64('/doc-header.png'),
        this.loadImageAsBase64('/doc-footer.png')
      ]);

      // Crear PDF con jsPDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Dimensiones del header y footer
      const headerHeight = 15; // mm aproximado
      const footerHeight = 18; // mm aproximado
      const marginLeft = 20;
      const marginRight = 20;
      const maxWidth = pageWidth - marginLeft - marginRight;
      const lineHeight = 5;
      const contentStartY = headerHeight + 10;
      const contentEndY = pageHeight - footerHeight - 10;

      // Función para agregar header y footer a una página
      const addHeaderFooter = () => {
        // Header
        if (headerImg) {
          pdf.addImage(headerImg, 'PNG', 0, 0, pageWidth, headerHeight);
        }
        // Footer
        if (footerImg) {
          pdf.addImage(footerImg, 'PNG', 0, pageHeight - footerHeight, pageWidth, footerHeight);
        }
      };

      // Agregar header y footer a la primera página
      addHeaderFooter();

      // Configurar fuente
      pdf.setFont('helvetica', 'normal');

      // Procesar el contenido del documento
      const content = doc.content || '';
      const lines = content.split('\n');

      let y = contentStartY;
      let currentPage = 1;

      // Función para verificar si necesitamos nueva página
      const checkNewPage = (neededSpace = lineHeight) => {
        if (y + neededSpace > contentEndY) {
          pdf.addPage();
          currentPage++;
          addHeaderFooter();
          y = contentStartY;
        }
      };

      lines.forEach(line => {
        const trimmedLine = line.trim();

        // Detectar líneas especiales
        const isSeparator = /^[═─━═─\-=]+$/.test(trimmedLine) && trimmedLine.length > 3;
        const isBorrador = trimmedLine.includes('BORRADOR') || trimmedLine.includes('*** BORRADOR ***');
        const isTitle = trimmedLine === trimmedLine.toUpperCase() &&
                       trimmedLine.length > 3 &&
                       /[A-ZÁÉÍÓÚÑ]/.test(trimmedLine) &&
                       !isSeparator &&
                       (!trimmedLine.includes(':') || trimmedLine.split(':')[0].length > 30);

        if (isSeparator) {
          checkNewPage();
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.3);
          pdf.line(marginLeft, y, pageWidth - marginRight, y);
          y += lineHeight;
        } else if (isBorrador) {
          checkNewPage(lineHeight * 2);
          // Fondo rojo claro para BORRADOR
          pdf.setFillColor(254, 242, 242);
          pdf.rect(marginLeft - 2, y - 4, maxWidth + 4, 8, 'F');
          pdf.setDrawColor(220, 50, 50);
          pdf.setLineWidth(0.5);
          pdf.rect(marginLeft - 2, y - 4, maxWidth + 4, 8, 'S');

          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(220, 50, 50);
          pdf.text(trimmedLine, pageWidth / 2, y, { align: 'center' });
          pdf.setTextColor(0, 0, 0);
          y += lineHeight + 3;
        } else if (isTitle) {
          checkNewPage(lineHeight * 1.5);
          y += 3; // Espacio antes del título
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          const splitText = pdf.splitTextToSize(trimmedLine, maxWidth);
          splitText.forEach(textLine => {
            checkNewPage();
            pdf.text(textLine, pageWidth / 2, y, { align: 'center' });
            y += lineHeight;
          });
          pdf.setFont('helvetica', 'normal');
          y += 2; // Espacio después del título
        } else if (trimmedLine === '') {
          y += lineHeight * 0.4;
        } else {
          // Texto normal
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');

          // Preservar indentación
          const leadingSpaces = line.match(/^\s*/)[0].length;
          const indent = Math.min(leadingSpaces * 2, 30);

          const splitText = pdf.splitTextToSize(trimmedLine, maxWidth - indent);
          splitText.forEach(textLine => {
            checkNewPage();
            pdf.text(textLine, marginLeft + indent, y);
            y += lineHeight;
          });
        }
      });

      // Agregar número de página en cada página
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - footerHeight - 3, { align: 'center' });
      }

      // Descargar el PDF
      pdf.save(fileName);
      showToast('Documento PDF descargado', 'success');

    } catch (error) {
      console.error('Error al generar PDF:', error);
      showToast('Error al generar PDF. Intentando sin imágenes...', 'warning');
      // Fallback sin imágenes
      this.downloadDocumentSimple(docType, fileName, doc);
    }
  }

  /**
   * Carga una imagen y la convierte a base64
   */
  async loadImageAsBase64(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('No se pudo cargar imagen:', url, error);
      return null;
    }
  }

  /**
   * Descarga PDF simple sin imágenes (fallback)
   */
  downloadDocumentSimple(docType, fileName, doc) {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginLeft = 20;
      const marginRight = 20;
      const maxWidth = pageWidth - marginLeft - marginRight;
      const lineHeight = 5;
      let y = 25;

      // Header simple con texto
      pdf.setFillColor(30, 64, 175);
      pdf.rect(0, 0, pageWidth, 18, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('MUNICIPALIDAD DE RENCA', pageWidth / 2, 12, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');

      const content = doc.content || '';
      const lines = content.split('\n');

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine === '') {
          y += lineHeight * 0.4;
          return;
        }

        pdf.setFontSize(10);
        const splitText = pdf.splitTextToSize(trimmedLine, maxWidth);
        splitText.forEach(textLine => {
          if (y > pageHeight - 30) {
            pdf.addPage();
            y = 20;
          }
          pdf.text(textLine, marginLeft, y);
          y += lineHeight;
        });
      });

      pdf.save(fileName);
      showToast('PDF descargado (versión simple)', 'success');
    } catch (error) {
      console.error('Error en fallback PDF:', error);
      showToast('Error al generar PDF', 'error');
    }
  }

  /**
   * Sube un documento
   */
  async uploadDocument(docType, file) {
    try {
      // Validar tamaño (10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast('El archivo no debe superar los 10MB', 'error');
        return;
      }

      showToast('Subiendo archivo...', 'info');

      // Guardar archivo en IndexedDB
      const savedFile = await indexedDBService.saveFile(file);

      this.formData.documents[docType] = {
        id: `doc-${Date.now()}`,
        type: docType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        data: savedFile.data,
        uploadedAt: new Date().toISOString()
      };

      // Actualizar UI
      this.updateDocumentUI(docType, file.name);
      showToast('Archivo subido correctamente', 'success');

    } catch (error) {
      console.error('Error al subir documento:', error);
      showToast('Error al subir el archivo', 'error');
    }
  }

  /**
   * Actualiza UI del documento
   */
  updateDocumentUI(docType, fileName) {
    const docItem = document.querySelector(`.document-item[data-doc-type="${docType}"]`);
    const fileNameDisplay = docItem.querySelector('.document-file-name');
    const uploadBtn = docItem.querySelector('.btn-upload');
    const removeBtn = docItem.querySelector('.btn-remove');

    fileNameDisplay.textContent = `📎 ${fileName}`;
    fileNameDisplay.style.display = 'block';
    uploadBtn.style.display = 'none';
    removeBtn.style.display = 'inline-block';
  }

  /**
   * Elimina un documento
   */
  removeDocument(docType) {
    if (confirm('¿Estás seguro de eliminar este documento?')) {
      delete this.formData.documents[docType];

      const docItem = document.querySelector(`.document-item[data-doc-type="${docType}"]`);
      const fileNameDisplay = docItem.querySelector('.document-file-name');
      const uploadBtn = docItem.querySelector('.btn-upload');
      const removeBtn = docItem.querySelector('.btn-remove');

      fileNameDisplay.style.display = 'none';
      uploadBtn.style.display = 'inline-block';
      removeBtn.style.display = 'none';

      // Limpiar input
      const fileInput = document.querySelector(`input[data-doc-type="${docType}"]`);
      fileInput.value = '';

      showToast('Documento eliminado', 'info');
    }
  }

  /**
   * Renderiza la lista de documentos dinámicamente
   */
  renderDocumentsList() {
    const container = document.getElementById('documents-list');
    const badge = document.getElementById('documents-count-badge');
    if (!container) return;

    // Obtener todos los documentos generados
    const documents = this.formData.documents || {};
    const docKeys = Object.keys(documents);

    // Mapeo de tipos a nombres legibles y descripciones
    const docInfo = {
      'ACTA_CONSTITUTIVA': { name: 'Acta Constitutiva', desc: 'Proyecto del acta de la asamblea constitutiva' },
      'ESTATUTOS': { name: 'Estatutos', desc: 'Proyecto de estatutos para votación' },
      'REGISTRO_SOCIOS': { name: 'Registro de Socios', desc: 'Listado preliminar de socios fundadores' },
      'DECLARACION_JURADA_PRESIDENTE': { name: 'Declaración Jurada - Presidente/a', desc: 'Declaración del presidente del directorio' },
      'DECLARACION_JURADA_SECRETARIO': { name: 'Declaración Jurada - Secretario/a', desc: 'Declaración del secretario del directorio' },
      'DECLARACION_JURADA_TESORERO': { name: 'Declaración Jurada - Tesorero/a', desc: 'Declaración del tesorero del directorio' },
      'DECLARACION_JURADA_DIRECTOR1': { name: 'Declaración Jurada - Director/a 1', desc: 'Declaración del director 1' },
      'DECLARACION_JURADA_DIRECTOR2': { name: 'Declaración Jurada - Director/a 2', desc: 'Declaración del director 2' },
      'DECLARACION_JURADA_DIRECTOR3': { name: 'Declaración Jurada - Director/a 3', desc: 'Declaración del director 3' },
      'CERTIFICADO_MINISTRO_FE': { name: 'Certificado del Ministro de Fe', desc: 'Certificado de la asamblea constitutiva' },
      'CERTIFICACION_MUNICIPAL': { name: 'Certificación Municipal', desc: 'Certificación de la Secretaría Municipal' },
      'DEPOSITO_ANTECEDENTES': { name: 'Depósito de Antecedentes', desc: 'Formulario de depósito de documentos' }
    };

    // Generar HTML para cada documento
    let html = '';
    docKeys.forEach(docType => {
      const info = docInfo[docType] || { name: docType, desc: '' };
      html += this.getDocumentItemHTML(docType, info.name, info.desc);
    });

    container.innerHTML = html;

    // Actualizar badge con cantidad de documentos
    if (badge) {
      badge.textContent = `${docKeys.length} documentos`;
    }
  }

  /**
   * Genera el HTML para un item de documento
   */
  getDocumentItemHTML(type, name, description) {
    return `
      <div class="document-row" data-doc-type="${type}" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        margin-bottom: 8px;
        gap: 12px;
        flex-wrap: wrap;
      ">
        <!-- Nombre del documento con badge -->
        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 200px;">
          <span style="font-size: 15px; font-weight: 600; color: #1f2937;">${name}</span>
          <span style="
            background: #10b981;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
          ">Generado</span>
        </div>

        <!-- Botones de acción compactos -->
        <div style="display: flex; gap: 8px; flex-shrink: 0;">
          <button type="button" class="btn-preview" data-doc-type="${type}" style="
            padding: 8px 14px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Ver
          </button>
          <button type="button" class="btn-edit-doc" data-doc-type="${type}" style="
            padding: 8px 14px;
            background: white;
            color: #374151;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Editar
          </button>
          <button type="button" class="btn-download" data-doc-type="${type}" style="
            padding: 8px 14px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Descargar
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Inicializa paso 6: Documentos
   * Si los documentos ya están generados, solo configura event listeners
   * Si no, muestra overlay de carga y genera los documentos
   */
  async initializeStep6_Documentos() {
    // Verificar si los documentos principales ya están generados
    const validation = this.validateGeneratedDocuments();

    if (!validation.success) {
      // Los documentos no están generados, usar flujo con overlay
      this.showDocumentLoadingOverlay();

      try {
        this.updateLoadingProgress('Generando documentos...', 20);
        await this.generateAllDocuments();

        this.updateLoadingProgress('Verificando documentos...', 70);
        const retryValidation = this.validateGeneratedDocuments();

        if (!retryValidation.success) {
          // Reintentar una vez
          this.updateLoadingProgress('Reintentando...', 80);
          await this.generateAllDocuments();
        }

        this.updateLoadingProgress('Aplicando firmas...', 90);
        this.updateDocumentsWithSignatures();

        this.updateLoadingProgress('Finalizando...', 100);
        await new Promise(resolve => setTimeout(resolve, 300));

        this.hideDocumentLoadingOverlay();
      } catch (error) {
        console.error('Error generando documentos:', error);
        this.hideDocumentLoadingOverlay();
        showToast('Error al generar documentos: ' + error.message, 'error');
        return;
      }
    }

    // Renderizar lista de documentos dinámicamente
    this.renderDocumentsList();

    // Generar lista inicial de otros documentos
    this.renderOtherDocumentsList();

    // Configurar event listeners
    this.setupStep6EventListeners();
  }

  /**
   * Inicializa paso 8: Revisión
   */
  initializeStep8_Revision() {
    this.renderReview();
  }

  /**
   * Renderiza la revisión final
   */
  renderReview() {
    // Organización
    const org = this.formData.organization;
    document.getElementById('review-organization').innerHTML = `
      <p><strong>Tipo:</strong> ${getOrgTypeName(org.type)}</p>
      <p><strong>Nombre:</strong> ${org.name}</p>
      <p><strong>Región:</strong> ${org.region}</p>
      <p><strong>Comuna:</strong> ${org.commune}</p>
      <p><strong>Dirección:</strong> ${org.address}${org.postalCode ? ` (CP: ${org.postalCode})` : ''}</p>
      ${org.neighborhood ? `<p><strong>Unidad Vecinal:</strong> ${org.neighborhood}</p>` : ''}
      <p><strong>Email:</strong> ${org.email}</p>
      <p><strong>Teléfono:</strong> ${org.phone}</p>
      <p><strong>Descripción:</strong> ${org.description || '-'}</p>
      <p><strong>Objetivos:</strong> ${org.objectives || '-'}</p>
      <div class="review-actions">
        <button type="button" class="btn-review-edit" data-goto-step="1">✏️ Editar</button>
      </div>
    `;

    // Miembros
    document.getElementById('review-members').innerHTML = `
      <p><strong>Total de miembros:</strong> ${this.formData.members.length}</p>
      <p class="text-muted">Lista completa de ${this.formData.members.length} miembros fundadores registrados.</p>
      <div class="review-actions">
        <button type="button" class="btn-review-view" data-action="view-members">👁️ Ver lista</button>
        <button type="button" class="btn-review-edit" data-goto-step="2">✏️ Editar</button>
      </div>
    `;

    // Comisión
    document.getElementById('review-commission').innerHTML = `
      <p><strong>Fecha de elección:</strong> ${new Date(this.formData.commission.electionDate).toLocaleDateString('es-CL')}</p>
      <p><strong>Integrantes:</strong></p>
      <ul>
        ${this.formData.commission.members.map((m, i) => `
          <li>${m.firstName} ${m.lastName} - ${i === 0 ? 'Presidente' : i === 1 ? 'Secretario' : 'Vocal'}</li>
        `).join('')}
      </ul>
      <div class="review-actions">
        <button type="button" class="btn-review-edit" data-goto-step="3">✏️ Editar</button>
      </div>
    `;

    // Firmas
    const signatures = this.formData.signatures || {};
    const roles = ['Presidente', 'Secretario', 'Vocal'];
    const reviewSignaturesEl = document.getElementById('review-signatures');
    if (reviewSignaturesEl) {
      reviewSignaturesEl.innerHTML = `
        <p><strong>Estado:</strong> ${Object.keys(signatures).length}/${this.formData.commission.members.length} firmas completadas</p>
        <ul>
          ${this.formData.commission.members.map((m, i) => {
            const sig = signatures[m.id];
            const sigType = sig ? (sig.type === 'drawn' ? 'Firma digital dibujada' : sig.type === 'digital' ? 'Clave Única' : 'Firma manual') : 'Pendiente';
            return `<li>${roles[i]}: ${m.firstName} ${m.lastName} - ${sig ? `✓ ${sigType}` : '⚠️ Pendiente'}</li>`;
          }).join('')}
        </ul>
        <div class="review-actions">
          <button type="button" class="btn-review-view" data-action="view-signatures">👁️ Ver firmas</button>
          <button type="button" class="btn-review-edit" data-goto-step="5">✏️ Editar</button>
        </div>
      `;
    }

    // Estatutos
    document.getElementById('review-statutes').innerHTML = `
      <p><strong>Tipo:</strong> ${this.formData.statutes.type === 'template' ? 'Plantilla predefinida' : 'Estatutos personalizados'}</p>
      <div class="review-actions">
        <button type="button" class="btn-review-view" data-action="view-statutes">👁️ Ver estatutos</button>
        <button type="button" class="btn-review-edit" data-goto-step="4">✏️ Editar</button>
      </div>
    `;

    // Documentos
    const docsCount = Object.keys(this.formData.documents).length;
    const docNames = {
      'ACTA_CONSTITUTIVA': 'Acta Constitutiva',
      'ESTATUTOS': 'Estatutos',
      'REGISTRO_SOCIOS': 'Registro de Socios',
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada - Presidente/a',
      'DECLARACION_JURADA_SECRETARIO': 'Declaración Jurada - Secretario/a',
      'DECLARACION_JURADA_TESORERO': 'Declaración Jurada - Tesorero/a',
      'DECLARACION_JURADA_DIRECTOR1': 'Declaración Jurada - Director/a 1',
      'DECLARACION_JURADA_DIRECTOR2': 'Declaración Jurada - Director/a 2',
      'DECLARACION_JURADA_DIRECTOR3': 'Declaración Jurada - Director/a 3',
      'CERTIFICADO_MINISTRO_FE': 'Certificado del Ministro de Fe',
      'CERTIFICACION_MUNICIPAL': 'Certificación Municipal',
      'DEPOSITO_ANTECEDENTES': 'Depósito de Antecedentes'
    };
    document.getElementById('review-documents').innerHTML = `
      <p><strong>Documentos generados:</strong> ${docsCount}</p>
      <ul>
        ${Object.entries(this.formData.documents).map(([type, doc]) => `
          <li>✓ ${docNames[type] || type} ${doc.signaturesApplied ? `(${doc.signaturesApplied} firmas)` : ''}</li>
        `).join('')}
      </ul>
      <div class="review-actions">
        <button type="button" class="btn-review-view" data-action="view-documents">👁️ Ver documentos</button>
        <button type="button" class="btn-review-edit" data-goto-step="6">✏️ Editar</button>
      </div>
    `;

    // Agregar event listeners para los botones
    this.setupReviewButtons();
  }

  /**
   * Configura los botones de la revisión
   */
  setupReviewButtons() {
    // Botones de editar (ir a paso)
    document.querySelectorAll('.btn-review-edit[data-goto-step]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const step = parseInt(e.target.dataset.gotoStep);
        this.goToStep(step);
      });
    });

    // Botones de ver
    document.querySelectorAll('.btn-review-view[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        switch (action) {
          case 'view-members':
            this.showMembersModal();
            break;
          case 'view-signatures':
            this.showSignaturesModal();
            break;
          case 'view-statutes':
            this.showStatutesModal();
            break;
          case 'view-documents':
            this.showDocumentsModal();
            break;
        }
      });
    });
  }

  /**
   * Muestra modal con lista de miembros
   */
  showMembersModal() {
    const modal = document.createElement('div');
    modal.className = 'review-modal-overlay';
    modal.innerHTML = `
      <div class="review-modal">
        <div class="review-modal-header">
          <h3>👥 Miembros Fundadores (${this.formData.members.length})</h3>
          <button type="button" class="review-modal-close">&times;</button>
        </div>
        <div class="review-modal-body">
          <div class="members-list-review">
            ${this.formData.members.map((m, i) => `
              <div class="member-item-review">
                <span class="member-number">${i + 1}</span>
                <div class="member-info">
                  <strong>${m.firstName} ${m.lastName}</strong>
                  <span class="member-rut">${m.rut}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.review-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  /**
   * Muestra modal con firmas
   */
  showSignaturesModal() {
    const signatures = this.formData.signatures || {};
    const roles = ['Presidente', 'Secretario', 'Vocal'];

    const modal = document.createElement('div');
    modal.className = 'review-modal-overlay';
    modal.innerHTML = `
      <div class="review-modal">
        <div class="review-modal-header">
          <h3>✍️ Firmas de la Comisión Electoral</h3>
          <button type="button" class="review-modal-close">&times;</button>
        </div>
        <div class="review-modal-body">
          <div class="signatures-review-grid">
            ${this.formData.commission.members.map((m, i) => {
              const sig = signatures[m.id];
              return `
                <div class="signature-review-item">
                  <div class="signature-review-role">${roles[i]}</div>
                  <div class="signature-review-name">${m.firstName} ${m.lastName}</div>
                  <div class="signature-review-content">
                    ${sig ? (
                      sig.type === 'drawn' && sig.data
                        ? `<img src="${sig.data}" class="signature-review-image" alt="Firma">`
                        : sig.type === 'digital'
                          ? `<div class="signature-review-digital">✓ Clave Única</div>`
                          : `<div class="signature-review-manual">📄 Firma manual</div>`
                    ) : '<div class="signature-review-pending">⚠️ Pendiente</div>'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.review-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  /**
   * Muestra modal con estatutos
   */
  showStatutesModal() {
    const statutes = this.formData.statutes;
    const modal = document.createElement('div');
    modal.className = 'review-modal-overlay';
    modal.innerHTML = `
      <div class="review-modal review-modal-large">
        <div class="review-modal-header">
          <h3>📜 Estatutos</h3>
          <button type="button" class="review-modal-close">&times;</button>
        </div>
        <div class="review-modal-body">
          <div class="statutes-preview-content">
            ${statutes.type === 'template'
              ? '<p><em>Estatutos generados según plantilla predefinida de la Ley 19.418</em></p>'
              : ''}
            <pre class="statutes-text">${this.formData.documents['ESTATUTOS']?.content || 'Estatutos no generados aún'}</pre>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.review-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  /**
   * Muestra modal con documentos
   */
  showDocumentsModal() {
    const docNames = {
      'ACTA_CONSTITUTIVA': 'Acta Constitutiva',
      'ESTATUTOS': 'Estatutos',
      'REGISTRO_SOCIOS': 'Registro de Socios',
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada - Presidente/a',
      'DECLARACION_JURADA_SECRETARIO': 'Declaración Jurada - Secretario/a',
      'DECLARACION_JURADA_TESORERO': 'Declaración Jurada - Tesorero/a',
      'DECLARACION_JURADA_DIRECTOR1': 'Declaración Jurada - Director/a 1',
      'DECLARACION_JURADA_DIRECTOR2': 'Declaración Jurada - Director/a 2',
      'DECLARACION_JURADA_DIRECTOR3': 'Declaración Jurada - Director/a 3',
      'CERTIFICADO_MINISTRO_FE': 'Certificado del Ministro de Fe',
      'CERTIFICACION_MUNICIPAL': 'Certificación Municipal',
      'DEPOSITO_ANTECEDENTES': 'Depósito de Antecedentes'
    };

    const modal = document.createElement('div');
    modal.className = 'review-modal-overlay';
    modal.innerHTML = `
      <div class="review-modal">
        <div class="review-modal-header">
          <h3>📄 Documentos Generados</h3>
          <button type="button" class="review-modal-close">&times;</button>
        </div>
        <div class="review-modal-body">
          <div class="documents-list-review">
            ${Object.entries(this.formData.documents).map(([type, doc]) => `
              <div class="document-item-review">
                <div class="document-info">
                  <strong>${docNames[type] || type}</strong>
                  ${doc.signaturesApplied ? `<span class="doc-signatures">${doc.signaturesApplied} firmas</span>` : ''}
                </div>
                <button type="button" class="btn-view-doc" data-doc-type="${type}">👁️ Ver</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.review-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Agregar eventos para ver cada documento
    modal.querySelectorAll('.btn-view-doc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docType = e.target.dataset.docType;
        modal.remove();
        this.showDocumentPreview(docType);
      });
    });
  }

  /**
   * Actualiza los documentos con las firmas recolectadas
   */
  updateDocumentsWithSignatures() {
    const signatures = this.formData.signatures || {};
    const commission = this.formData.commission.members || [];
    const signatureCount = Object.keys(signatures).length;

    if (signatureCount === 0) return;

    // Generar bloque de firmas para los documentos
    const signaturesBlock = this.generateSignaturesBlock(signatures, commission);

    // Actualizar documentos que requieren firmas (solo Acta Constitutiva)
    const docsToUpdate = ['ACTA_CONSTITUTIVA'];

    docsToUpdate.forEach(docType => {
      if (this.formData.documents[docType]) {
        let content = this.formData.documents[docType].content;

        // Remover sección de firmas anterior si existe
        const signatureMarker = '\n\n========== FIRMAS ==========';
        const markerIndex = content.indexOf(signatureMarker);
        if (markerIndex !== -1) {
          content = content.substring(0, markerIndex);
        }

        // Agregar nuevas firmas
        content += signaturesBlock;

        this.formData.documents[docType].content = content;
        this.formData.documents[docType].signedAt = new Date().toISOString();
        this.formData.documents[docType].signaturesApplied = signatureCount;
      }
    });

    // Actualizar previews
    this.updateDocumentPreviews();
    this.saveProgress();
  }

  /**
   * Genera el bloque de firmas para los documentos
   * La Comisión Electoral NO tiene cargos - solo 3 miembros
   */
  generateSignaturesBlock(signatures, commission) {
    let block = '\n\n========== FIRMAS ==========\n\n';

    commission.forEach((member, index) => {
      const signature = signatures[member.id];

      block += `Miembro ${index + 1} de la Comisión Electoral:\n`;
      block += `${member.firstName} ${member.lastName}\n`;
      block += `RUT: ${member.rut}\n`;

      if (signature) {
        if (signature.type === 'drawn') {
          block += `[FIRMA DIGITAL - Dibujada el ${new Date(signature.createdAt).toLocaleDateString('es-CL')}]\n`;
        } else if (signature.type === 'digital') {
          block += `[FIRMA ELECTRÓNICA AVANZADA - Clave Única]\n`;
          block += `Verificado: ${new Date(signature.timestamp).toLocaleDateString('es-CL')}\n`;
        } else if (signature.type === 'manual') {
          block += `[FIRMA MANUAL ADJUNTA]\n`;
          block += `Documento subido: ${new Date(signature.uploadedAt).toLocaleDateString('es-CL')}\n`;
        }
      } else {
        block += `[PENDIENTE DE FIRMA]\n`;
      }

      block += '\n________________________\n\n';
    });

    return block;
  }

  /**
   * FASE 2: Muestra pantalla de solicitud de Ministro de Fe
   */
  async showMinistroRequestScreen() {
    const stepContent = document.querySelector('#step-6');
    if (!stepContent) return;

    // Marcar que estamos mostrando la pantalla del Ministro para poder restaurarla
    this.formData.showingMinistroScreen = true;
    this.saveProgress();

    // Reemplazar el contenido del paso 6 con el formulario de solicitud de Ministro
    const orgTypeName = getOrgTypeName(this.formData.organization.type);

    stepContent.innerHTML = `
      <div class="ministro-request-screen">
        <!-- Header con checkmark -->
        <div class="ministro-request-header">
          <div class="success-checkmark">
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
              <circle cx="36" cy="36" r="32" stroke="#10b981" stroke-width="4" fill="#f0fdf4"/>
              <path d="M22 36 L32 46 L50 28" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2>Pasos 1 a 6 Completados</h2>
          <p>Has completado exitosamente la información básica, miembros fundadores, configuración, estatutos, comisión electoral y documentos oficiales.</p>
        </div>

        <!-- Info box -->
        <div class="ministro-info-box">
          <h3>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Siguiente Paso: Solicitar Ministro de Fe
          </h3>
          <p>Para continuar, debes <strong>solicitar un Ministro de Fe</strong> de la municipalidad.</p>
          <p>El Ministro de Fe presidirá la asamblea de constitución, designará el <strong>Directorio Provisorio</strong> (Presidente, Secretario y Tesorero) y validará el proceso.</p>
        </div>

        <!-- Formulario con layout de 2 columnas -->
        <form id="ministro-request-form" class="ministro-request-form">
          <div class="ministro-form-grid">
            <!-- Columna izquierda: Resumen + Dirección -->
            <div class="ministro-form-column">
              <!-- Resumen de la Organización -->
              <div class="ministro-form-section">
                <h4>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                  Resumen de la Organización
                </h4>
                <div class="org-summary-card">
                  <div class="summary-item">
                    <span class="summary-label">Nombre</span>
                    <span class="summary-value">${this.formData.organization.name || 'N/A'}</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">Tipo</span>
                    <span class="summary-value">${orgTypeName}</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">Miembros Fundadores</span>
                    <span class="summary-value">${this.formData.members.length} personas</span>
                  </div>
                </div>
              </div>

              <!-- Dirección de la Asamblea -->
              <div class="ministro-form-section">
                <h4>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  Dirección de la Asamblea <span class="required">*</span>
                </h4>
                <div class="address-options-list">
                  <label class="address-option-card" data-option="org">
                    <input type="radio" name="assembly-address-type" value="org">
                    <div class="option-content">
                      <strong>Dirección de la Organización</strong>
                      <span id="org-address-preview">${this.formData.organization?.address || 'No especificada'}</span>
                    </div>
                  </label>
                  <label class="address-option-card" data-option="muni">
                    <input type="radio" name="assembly-address-type" value="muni">
                    <div class="option-content">
                      <strong>Municipalidad de Renca</strong>
                      <span>Blanco Encalada 1335, Renca</span>
                    </div>
                  </label>
                  <label class="address-option-card" data-option="custom">
                    <input type="radio" name="assembly-address-type" value="custom">
                    <div class="option-content" style="flex: 1;">
                      <strong>Otra dirección</strong>
                      <input type="text" id="custom-assembly-address" placeholder="Escriba la dirección completa..." disabled>
                    </div>
                  </label>
                </div>
                <input type="hidden" id="assembly-address" name="assemblyAddress">
              </div>
            </div>

            <!-- Columna derecha: Calendario -->
            <div class="ministro-form-section" style="height: fit-content;">
              <h4>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Fecha y Hora de Preferencia <span class="required">*</span>
              </h4>
              <div style="background: #dbeafe; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 16px;">
                <p style="margin: 0; color: #1e40af; font-size: 13px; line-height: 1.5;">
                  <strong>📌 Nota:</strong> La fecha y hora es una preferencia. La Municipalidad confirmará según disponibilidad.
                </p>
              </div>
              <div id="schedule-calendar-container" class="schedule-calendar-container" style="margin-top: 0; border: none; padding: 0;">
                <div class="calendar-header">
                  <button type="button" id="prev-month-btn" class="calendar-nav-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                  <h3 id="current-month-year" class="calendar-month-title"></h3>
                  <button type="button" id="next-month-btn" class="calendar-nav-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
                <div class="calendar-weekdays">
                  <div class="calendar-weekday">Dom</div>
                  <div class="calendar-weekday">Lun</div>
                  <div class="calendar-weekday">Mar</div>
                  <div class="calendar-weekday">Mié</div>
                  <div class="calendar-weekday">Jue</div>
                  <div class="calendar-weekday">Vie</div>
                  <div class="calendar-weekday">Sáb</div>
                </div>
                <div id="calendar-days" class="calendar-days"></div>
                <div id="time-slots-container" class="time-slots-container" style="display: none;">
                  <h4 class="time-slots-title">Horarios Disponibles</h4>
                  <p class="time-slots-date" id="selected-date-display"></p>
                  <div id="time-slots-grid" class="time-slots-grid"></div>
                </div>
                <div id="selected-appointment" class="selected-appointment" style="display: none;">
                  <div class="appointment-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                  <div class="appointment-details">
                    <p class="appointment-label">Cita Agendada:</p>
                    <p class="appointment-datetime" id="appointment-datetime"></p>
                  </div>
                  <button type="button" id="change-appointment-btn" class="change-appointment-btn">Cambiar</button>
                </div>
              </div>
              <input type="hidden" id="selected-date" name="selectedDate">
              <input type="hidden" id="selected-time" name="selectedTime">
              <small style="color: #6b7280; display: block; margin-top: 12px;">
                <strong style="color: #10b981;">●</strong> Días disponibles
                <strong style="color: #ef4444; margin-left: 16px;">●</strong> Días sin horarios
              </small>
            </div>
          </div>

          <!-- Checklist de Libros - Ancho completo -->
          <div class="books-checklist-container">
            <h4>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              Libros Requeridos para la Asamblea
            </h4>
            <p><strong>Importante:</strong> El Ministro de Fe solicitará estos 3 libros durante la Asamblea Constitutiva. Es tu responsabilidad adquirirlos antes de la fecha. Puedes comprarlos en cualquier librería.</p>

            <div class="books-list">
              <label class="book-item">
                <input type="checkbox" id="book-actas" name="bookActas" required>
                <div class="book-info">
                  <strong>📘 Libro de Actas</strong>
                  <span>Para registrar las actas de asambleas y reuniones</span>
                </div>
              </label>

              <label class="book-item">
                <input type="checkbox" id="book-cuentas" name="bookCuentas" required>
                <div class="book-info">
                  <strong>📗 Libro de Cuentas</strong>
                  <span>Para el registro contable y financiero</span>
                </div>
              </label>

              <label class="book-item">
                <input type="checkbox" id="book-socios" name="bookSocios" required>
                <div class="book-info">
                  <strong>📕 Libro de Socios</strong>
                  <span>Para registrar ingreso y retiro de miembros</span>
                </div>
              </label>
            </div>

            <p class="books-checklist-note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Debes confirmar que cuentas con estos 3 libros para continuar
            </p>
          </div>

          <!-- Comentarios adicionales -->
          <div class="comments-section">
            <label>Comentarios Adicionales (Opcional)</label>
            <textarea id="ministro-comments" name="comments" rows="3" placeholder="Información adicional que desees compartir con la municipalidad..."></textarea>
          </div>

          <!-- Botones de acción -->
          <div class="ministro-form-actions">
            <button type="button" id="ministro-back-btn" class="btn btn-secondary">
              ← Volver
            </button>
            <button type="submit" id="ministro-submit-btn" class="btn btn-primary" disabled>
              📤 Enviar Solicitud de Ministro de Fe
            </button>
          </div>
        </form>
      </div>
    `;

    // Actualizar botones de navegación (ocultarlos)
    const prevBtn = document.getElementById('wizard-prev');
    const nextBtn = document.getElementById('wizard-next');
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';

    // Event listeners
    const form = document.getElementById('ministro-request-form');
    const backBtn = document.getElementById('ministro-back-btn');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedDate = document.getElementById('selected-date').value;
        const selectedTime = document.getElementById('selected-time').value;
        const assemblyAddress = document.getElementById('assembly-address').value;
        const comments = document.getElementById('ministro-comments').value;

        if (!selectedDate || !selectedTime) {
          showToast('Por favor selecciona una fecha y hora para la asamblea', 'error');
          return;
        }

        if (!assemblyAddress) {
          showToast('Por favor selecciona la dirección donde se realizará la asamblea', 'error');
          return;
        }

        await this.submitMinistroRequest(selectedDate, selectedTime, comments, assemblyAddress);
      });
    }

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        // Restaurar el HTML original del paso 6 (Documentos)
        this.restoreStep6HTML();
        // Volver a mostrar el paso 6 normal
        this.updateUI();
        this.initializeCurrentStep();
      });
    }

    // Inicializar calendario interactivo
    try {
      await this.initializeScheduleCalendar();
    } catch (error) {
      console.error('Error inicializando calendario:', error);
    }

    // Inicializar selector de dirección de asamblea
    this.initializeAssemblyAddressSelector();

    // Inicializar checkboxes de libros requeridos
    this.initializeBooksChecklist();
  }

  /**
   * Inicializa el checklist de libros requeridos
   */
  initializeBooksChecklist() {
    const bookActas = document.getElementById('book-actas');
    const bookCuentas = document.getElementById('book-cuentas');
    const bookSocios = document.getElementById('book-socios');
    const submitBtn = document.getElementById('ministro-submit-btn');

    if (!bookActas || !bookCuentas || !bookSocios || !submitBtn) return;

    const checkAllBooks = () => {
      const allChecked = bookActas.checked && bookCuentas.checked && bookSocios.checked;
      submitBtn.disabled = !allChecked;

      if (allChecked) {
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      } else {
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
      }
    };

    // Estilizar checkboxes cuando se marcan
    const styleCheckbox = (checkbox) => {
      const label = checkbox.closest('.book-checkbox-item');
      if (label) {
        if (checkbox.checked) {
          label.style.borderColor = '#10b981';
          label.style.background = '#f0fdf4';
        } else {
          label.style.borderColor = '#e5e7eb';
          label.style.background = 'white';
        }
      }
    };

    [bookActas, bookCuentas, bookSocios].forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        styleCheckbox(checkbox);
        checkAllBooks();
      });
    });

    // Estado inicial
    checkAllBooks();
  }

  /**
   * Inicializa el calendario de agendamiento interactivo
   */
  async initializeScheduleCalendar() {
    // Importar servicio de horarios
    const { scheduleService } = await import('../../../services/ScheduleService.js');

    // Cargar ministros activos y sincronizar reservas del backend
    // Forzar recarga para asegurar datos actualizados al mostrar el calendario
    console.log('📅 [Wizard] Inicializando calendario, cargando datos frescos...');
    await scheduleService.loadActiveMinistros(true); // forceRefresh = true
    await scheduleService.syncBackendBookings(true); // forceRefresh = true
    console.log('📅 [Wizard] Ministros activos:', scheduleService.getActiveMinistrosCount());

    let currentDate = new Date();
    let selectedDateKey = null;
    let selectedTime = null;

    // Función auxiliar para parsear dateKey correctamente sin problemas de zona horaria
    const parseDateKey = (dateKey) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const renderCalendar = async (year, month) => {
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

      document.getElementById('current-month-year').textContent = `${monthNames[month]} ${year}`;

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const availability = await scheduleService.getMonthAvailability(year, month + 1);
      const calendarDays = document.getElementById('calendar-days');
      calendarDays.innerHTML = '';

      // Días vacíos antes del primer día
      for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day calendar-day-empty';
        calendarDays.appendChild(emptyDay);
      }

      // Días del mes
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateKey = scheduleService.getDateKey(date);
        const isPast = date < today;

        const dayElement = document.createElement('button');
        dayElement.type = 'button';
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;

        if (isPast) {
          dayElement.classList.add('calendar-day-disabled');
          dayElement.disabled = true;
        } else if (availability.available.includes(dateKey)) {
          dayElement.classList.add('calendar-day-available');
          dayElement.addEventListener('click', () => selectDate(dateKey));
        } else if (availability.partial.includes(dateKey)) {
          dayElement.classList.add('calendar-day-partial');
          dayElement.addEventListener('click', () => selectDate(dateKey));
        } else {
          dayElement.classList.add('calendar-day-unavailable');
          dayElement.disabled = true;
        }

        if (dateKey === selectedDateKey) {
          dayElement.classList.add('calendar-day-selected');
        }

        calendarDays.appendChild(dayElement);
      }
    };

    const selectDate = async (dateKey) => {
      selectedDateKey = dateKey;
      selectedTime = null;

      // Actualizar visualización del calendario
      document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('calendar-day-selected');
      });
      event.target.classList.add('calendar-day-selected');

      // Obtener y mostrar horarios disponibles
      const date = parseDateKey(dateKey);
      const availableSlots = await scheduleService.getAvailableSlots(date);

      const timeSlotsContainer = document.getElementById('time-slots-container');
      const timeSlotsGrid = document.getElementById('time-slots-grid');
      const selectedDateDisplay = document.getElementById('selected-date-display');

      if (availableSlots.length === 0) {
        timeSlotsGrid.innerHTML = '<p style="text-align: center; color: #6b7280;">No hay horarios disponibles para este día</p>';
      } else {
        selectedDateDisplay.textContent = date.toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        timeSlotsGrid.innerHTML = availableSlots.map(time => `
          <button type="button" class="time-slot-btn" data-time="${time}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${time}
          </button>
        `).join('');

        // Event listeners para los slots de tiempo
        timeSlotsGrid.querySelectorAll('.time-slot-btn').forEach(btn => {
          btn.addEventListener('click', () => selectTime(btn.dataset.time));
        });
      }

      timeSlotsContainer.style.display = 'block';
      document.getElementById('selected-appointment').style.display = 'none';
    };

    const selectTime = (time) => {
      selectedTime = time;

      // Actualizar inputs ocultos
      document.getElementById('selected-date').value = selectedDateKey;
      document.getElementById('selected-time').value = selectedTime;

      // Mostrar confirmación de cita
      const date = parseDateKey(selectedDateKey);
      const dateStr = date.toLocaleDateString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      document.getElementById('appointment-datetime').innerHTML = `
        <strong>${dateStr}</strong><br>
        a las <strong>${selectedTime}</strong>
      `;

      document.getElementById('time-slots-container').style.display = 'none';
      document.getElementById('selected-appointment').style.display = 'flex';
    };

    // Navegación de meses
    document.getElementById('prev-month-btn').addEventListener('click', async () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });

    document.getElementById('next-month-btn').addEventListener('click', async () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });

    // Botón de cambiar cita
    document.getElementById('change-appointment-btn').addEventListener('click', () => {
      document.getElementById('selected-appointment').style.display = 'none';
      document.getElementById('time-slots-container').style.display = 'block';
    });

    // Renderizar calendario inicial
    await renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  }

  /**
   * FASE 2: Envía la solicitud de Ministro de Fe
   */
  async submitMinistroRequest(electionDate, electionTime, comments = '', assemblyAddress = '') {
    // Crear overlay de carga visual prominente
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'submit-loading-overlay';
    loadingOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); z-index: 999999; display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
    loadingOverlay.innerHTML = `
      <div style="background: white; border-radius: 20px; padding: 40px 50px; text-align: center; box-shadow: 0 25px 60px rgba(0,0,0,0.3); max-width: 420px; width: 90%;">
        <div style="width: 56px; height: 56px; border: 4px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spinLoader 0.8s linear infinite; margin: 0 auto 20px;"></div>
        <h3 id="loading-title" style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #1e293b;">Enviando solicitud...</h3>
        <p id="loading-detail" style="margin: 0 0 16px; font-size: 14px; color: #64748b;">Preparando datos de la organización</p>
        <div style="background: #f1f5f9; border-radius: 8px; height: 6px; overflow: hidden;">
          <div id="loading-progress-bar" style="height: 100%; width: 10%; background: linear-gradient(90deg, #2563eb, #7c3aed); border-radius: 8px; transition: width 0.5s ease;"></div>
        </div>
      </div>
      <style>@keyframes spinLoader { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(loadingOverlay);

    const updateProgress = (title, detail, pct) => {
      const t = document.getElementById('loading-title');
      const d = document.getElementById('loading-detail');
      const b = document.getElementById('loading-progress-bar');
      if (t) t.textContent = title;
      if (d) d.textContent = detail;
      if (b) b.style.width = pct + '%';
    };

    try {

      // Importar servicios
      const { organizationsService } = await import('../../../services/OrganizationsService.js');
      const { scheduleService } = await import('../../../services/ScheduleService.js');

      // Crear reserva en el servicio de horarios
      const booking = scheduleService.createBooking({
        date: electionDate,
        time: electionTime,
        organizationId: `temp-${Date.now()}`, // Temporal hasta que se cree la organización
        organizationName: this.formData.organization.name,
        organizationType: this.formData.organization.type,
        userId: this.userProfile?.id || 'unknown',
        userName: `${this.userProfile?.firstName || ''} ${this.userProfile?.lastName || ''}`.trim(),
        userEmail: this.userEmail || '',
        userPhone: this.userProfile?.phone || '',
        comments: comments,
        assemblyAddress: assemblyAddress
      });

      // Crear la solicitud con los datos de pasos 1-5
      console.log('🔍 [WizardController] formData.directorioProvisorio:', this.formData.directorioProvisorio);
      console.log('🔍 [WizardController] formData.commission:', this.formData.commission);

      // Extraer todos los miembros del directorio provisorio
      const dirProv = this.formData.directorioProvisorio || {};
      const directorioCompleto = {
        presidente: dirProv.presidente || null,
        secretario: dirProv.secretario || null,
        tesorero: dirProv.tesorero || null
      };

      // Agregar miembros adicionales (vicepresidente, directores, etc.)
      const miembrosAdicionales = [];
      Object.keys(dirProv).forEach(key => {
        if (!['presidente', 'secretario', 'tesorero'].includes(key) && dirProv[key]) {
          miembrosAdicionales.push({
            cargo: key,
            ...dirProv[key]
          });
        }
      });

      if (miembrosAdicionales.length > 0) {
        directorioCompleto.miembrosAdicionales = miembrosAdicionales;
      }

      // Limpiar emails inválidos de miembros guardados
      const cleanMembers = (this.formData.members || []).map(m => ({
        ...m,
        email: (m.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email.trim())) ? m.email.trim() : ''
      }));

      const requestData = {
        organizationData: {
          organization: this.formData.organization,
          members: cleanMembers
        },
        // Datos del paso 5: Directorio Provisorio (ahora incluye todos los miembros)
        directorioProvisorio: directorioCompleto,
        // Datos del paso 5: Comisión Electoral
        comisionElectoral: this.formData.commission?.members || [],
        // Datos del paso 5: Certificados de Antecedentes
        certificatesStep5: this.formData.certificatesStep5 || {},
        // Datos del paso 6: Estatutos (fallback entre ambas fuentes de datos)
        estatutos: this.formData.estatutos?.contenido || this.formData.statutes?.editedContent || this.formData.statutes?.content || '',
        electionDate: electionDate,
        electionTime: electionTime,
        assemblyAddress: assemblyAddress,
        bookingId: booking.id,
        comments: comments,
        // Documentos generados del wizard (Acta, Estatutos, Registro, Declaraciones, Certificados, etc.)
        generatedDocuments: this.formData.documents || {}
      };

      console.log('📤 [WizardController] requestData a enviar:', requestData);

      // Guardar en el servicio de organizaciones con estado WAITING_MINISTRO_REQUEST
      updateProgress('Creando organización...', 'Conectando con el servidor', 20);
      try {
        const org = await organizationsService.requestMinistro(requestData, (title, detail, pct) => {
          updateProgress(title, detail, pct);
        });
        console.log('✅ Organización creada:', org);

        // Limpiar progreso del wizard
        this.clearProgress();

        // Remover overlay de carga
        if (loadingOverlay.parentNode) loadingOverlay.remove();

        showToast('¡Solicitud de Ministro de Fe enviada correctamente!', 'success');
      } catch (error) {
        console.error('❌ Error al crear organización:', error);
        // Remover overlay de carga
        if (loadingOverlay.parentNode) loadingOverlay.remove();

        if (error.details && Array.isArray(error.details) && error.details.length > 0) {
          console.error('📋 Detalles de validación:', error.details);
          const firstError = error.details[0];
          showToast(`Error: ${firstError.field || 'validación'} - ${firstError.message || 'dato inválido'}`, 'error');
        } else {
          showToast('Error al enviar la solicitud: ' + (error.message || 'Error desconocido'), 'error');
        }
        return;
      }

      // Mostrar mensaje de confirmación
      const stepContent = document.querySelector('#step-6');
      if (stepContent) {
        stepContent.innerHTML = `
          <div style="text-align: center; padding: 60px 20px;">
            <div class="success-checkmark">
              <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="45" stroke="#10b981" stroke-width="5" fill="#f0fdf4"/>
                <path d="M30 50 L45 65 L70 35" stroke="#10b981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>

            <h2 style="color: #1f2937; margin: 24px 0 12px;">¡Solicitud Enviada!</h2>

            <p style="color: #6b7280; margin-bottom: 16px;">
              Tu solicitud de Ministro de Fe ha sido enviada a la municipalidad.
            </p>

            <div style="background: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; max-width: 500px; margin: 24px auto;">
              <h3 style="color: #1e40af; margin: 0 0 12px 0;">¿Qué sigue?</h3>
              <ol style="text-align: left; color: #2563eb; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">La municipalidad revisará tu solicitud</li>
                <li style="margin-bottom: 8px;">Te asignarán un Ministro de Fe y confirmarán la fecha</li>
                <li style="margin-bottom: 8px;">El Ministro de Fe presidirá la asamblea y designará el Directorio Provisorio</li>
                <li>Una vez aprobado, podrás continuar con los siguientes pasos del wizard</li>
              </ol>
            </div>

            <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 16px; max-width: 500px; margin: 24px auto;">
              <p style="color: #047857; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">📅 Cita Agendada:</p>
              <p style="color: #065f46; margin: 0; font-size: 16px;">
                <strong>${(() => {
                  const [year, month, day] = electionDate.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  return date.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                })()}</strong><br>
                a las <strong>${electionTime}</strong>
              </p>
              <p style="color: #047857; margin: 12px 0 4px 0; font-size: 14px; font-weight: 600;">📍 Lugar:</p>
              <p style="color: #065f46; margin: 0; font-size: 15px;">
                ${assemblyAddress}
              </p>
            </div>

            <button id="close-wizard-btn" class="btn btn-primary" style="margin-top: 24px;">
              Volver al Dashboard
            </button>
          </div>
        `;

        // Función para cerrar y refrescar
        const closeAndRefresh = () => {
          this.close();
          if (window.refreshOrganizations) {
            window.refreshOrganizations();
          }
        };

        // Botón "Volver al Dashboard"
        const closeBtn = document.getElementById('close-wizard-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', closeAndRefresh);
        }

        // Cambiar comportamiento del botón X para cerrar directamente (sin confirmación)
        const wizardCloseBtn = document.getElementById('wizard-close');
        if (wizardCloseBtn) {
          // Clonar para remover event listeners anteriores
          const newCloseBtn = wizardCloseBtn.cloneNode(true);
          wizardCloseBtn.parentNode.replaceChild(newCloseBtn, wizardCloseBtn);
          newCloseBtn.addEventListener('click', closeAndRefresh);
        }

        // También cambiar el click fuera del wizard
        const overlay = document.getElementById('wizard-overlay');
        if (overlay) {
          overlay.addEventListener('click', (e) => {
            if (e.target.id === 'wizard-overlay') {
              closeAndRefresh();
            }
          }, { once: true });
        }
      }

    } catch (error) {
      console.error('Error al enviar solicitud de Ministro de Fe:', error);
      if (loadingOverlay.parentNode) loadingOverlay.remove();
      showToast('Error al enviar la solicitud', 'error');
    }
  }

  /**
   * Envía la solicitud
   */
  async submitApplication() {
    try {
      showToast('Enviando solicitud...', 'info');

      // Simular envío (aquí integrarías con el repositorio real)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Guardar en IndexedDB
      const application = {
        id: `app-${Date.now()}`,
        userId: 'user-1', // Cambiar por usuario actual
        organizationData: this.formData.organization,
        members: this.formData.members,
        commission: this.formData.commission,
        statutes: this.formData.statutes,
        documents: this.formData.documents,
        status: 'SUBMITTED',
        currentStep: 7,
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await indexedDBService.add('applications', application);

      // Guardar en el servicio de organizaciones para mostrar en home
      if (window.organizationsService) {
        // Si es una organización existente (continuando después de Ministro de Fe), actualizar
        if (this.existingOrganizationId) {
          window.organizationsService.update(this.existingOrganizationId, {
            organization: this.formData.organization,
            members: this.formData.members,
            commission: this.formData.commission,
            statutes: this.formData.statutes,
            documents: this.formData.documents,
            signatures: this.formData.signatures,
            certificates: this.formData.certificates
          });
          // Actualizar el estado a PENDING_REVIEW
          window.organizationsService.updateStatus(
            this.existingOrganizationId,
            'pending_review',
            'Usuario completó el proceso después de aprobación del Ministro de Fe'
          );
        } else {
          // Crear nueva organización
          window.organizationsService.create({
            organization: this.formData.organization,
            members: this.formData.members,
            commission: this.formData.commission,
            statutes: this.formData.statutes,
            documents: this.formData.documents,
            signatures: this.formData.signatures,
            certificates: this.formData.certificates
          });
        }
      }

      // Limpiar progreso guardado
      this.clearProgress();
      // Limpiar referencia a organización existente
      this.existingOrganizationId = null;

      showToast('¡Solicitud enviada correctamente!', 'success');

      setTimeout(() => {
        this.close();
        // Refrescar la lista de organizaciones en el home
        if (window.refreshOrganizations) {
          window.refreshOrganizations();
        }
      }, 1500);

    } catch (error) {
      console.error('Error al enviar solicitud:', error);
      showToast('Error al enviar la solicitud', 'error');
    }
  }

  /**
   * Inicializa el selector de dirección para la asamblea
   */
  initializeAssemblyAddressSelector() {
    const addressRadios = document.querySelectorAll('input[name="assembly-address-type"]');
    const customAddressInput = document.getElementById('custom-assembly-address');
    const assemblyAddressHidden = document.getElementById('assembly-address');
    const addressOptions = document.querySelectorAll('.address-option');

    const updateAssemblyAddress = () => {
      const selectedRadio = document.querySelector('input[name="assembly-address-type"]:checked');
      if (!selectedRadio) {
        assemblyAddressHidden.value = '';
        return;
      }

      // Actualizar estilos visuales
      addressOptions.forEach(option => {
        option.style.borderColor = '#d1d5db';
        option.style.background = 'white';
      });
      const selectedOption = selectedRadio.closest('.address-option');
      if (selectedOption) {
        selectedOption.style.borderColor = '#2563eb';
        selectedOption.style.background = '#eff6ff';
      }

      switch (selectedRadio.value) {
        case 'org':
          assemblyAddressHidden.value = this.formData.organization?.address || '';
          if (customAddressInput) {
            customAddressInput.style.display = 'none';
            customAddressInput.disabled = true;
          }
          break;
        case 'muni':
          assemblyAddressHidden.value = 'Blanco Encalada 1335, Renca';
          if (customAddressInput) {
            customAddressInput.style.display = 'none';
            customAddressInput.disabled = true;
          }
          break;
        case 'custom':
          if (customAddressInput) {
            customAddressInput.style.display = 'block';
            customAddressInput.disabled = false;
            customAddressInput.focus();
            assemblyAddressHidden.value = customAddressInput.value;
          }
          break;
      }
    };

    addressRadios.forEach(radio => {
      radio.addEventListener('change', updateAssemblyAddress);
    });

    if (customAddressInput) {
      customAddressInput.addEventListener('input', () => {
        if (assemblyAddressHidden) {
          assemblyAddressHidden.value = customAddressInput.value;
        }
      });
    }
  }

  /**
   * Restaura el HTML original del paso 2 después de mostrar la pantalla de Ministro de Fe
   */
  restoreStep2HTML() {
    const stepContent = document.querySelector('#step-2');
    if (!stepContent) return;

    // Obtener el mínimo de miembros requerido según el tipo de organización
    const orgType = this.formData.organization?.type;
    const minMembers = orgType === 'JUNTA_VECINOS' ? 50 : 15;

    stepContent.innerHTML = `
      <h3>Paso 2: Miembros Fundadores</h3>
      <p class="step-description" id="step2-description">Registre a los miembros fundadores de la organización (mínimo ${minMembers} personas).</p>

      <div class="members-summary">
        <div class="summary-stat">
          <span class="stat-label">Total de miembros:</span>
          <span class="stat-value" id="members-count">0</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Mínimo requerido:</span>
          <span class="stat-value" id="min-members-required">${minMembers}</span>
        </div>
      </div>

      <div class="members-actions">
        <button class="btn-primary" id="btn-add-member">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
          Agregar Miembro
        </button>
        <button class="btn-outline" id="btn-load-test-members-15">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Cargar 15 de Prueba
        </button>
        <button class="btn-outline" id="btn-load-test-members-50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Cargar 50 de Prueba
        </button>
      </div>

      <div id="members-list" class="members-list">
        <p class="text-muted">No hay miembros agregados aún.</p>
      </div>
    `;
  }

  /**
   * Restaura el HTML original del paso 6 (Documentos) después de mostrar la pantalla de Ministro de Fe
   */
  restoreStep6HTML() {
    const stepContent = document.querySelector('#step-6');
    if (!stepContent) return;

    // Usar el HTML del paso 6 desde WizardHTML
    const step6HTML = getStep6HTML_Documentos();
    // Extraer solo el contenido interno (sin el div contenedor)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = step6HTML;
    stepContent.innerHTML = tempDiv.firstElementChild.innerHTML;
  }
}
