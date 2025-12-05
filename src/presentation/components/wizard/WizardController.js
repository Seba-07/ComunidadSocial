/**
 * WizardController
 * Controla la lógica del wizard de creación de organizaciones
 */

import { getWizardHTML } from './WizardHTML.js';
import { indexedDBService } from '../../../infrastructure/database/IndexedDBService.js';
import { showToast } from '../../../app.js';
import { CHILE_REGIONS } from '../../../data/chile-regions.js';

// Tipos de organizaciones territoriales
const TERRITORIAL_TYPES = {
  'JUNTA_VECINOS': 'Junta de Vecinos',
  'COMITE_VECINOS': 'Comité de Vecinos'
};

// Tipos de organizaciones funcionales (según formulario oficial)
const FUNCIONAL_TYPES = {
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

export class WizardController {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 7;
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
      signatures: {} // Firmas por miembro: { memberId: { type, data, ... } }
    };
    this.otherDocumentCounter = 0;
    this.currentSignatureMethod = 'draw';
    this.existingOrganizationId = null; // Para continuar org existente después de Ministro de Fe
  }

  /**
   * Guarda el progreso en localStorage
   */
  saveProgress() {
    const progress = {
      currentStep: this.currentStep,
      formData: this.formData,
      organizationId: this.existingOrganizationId || null, // Guardar ID si es org existente
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(this.storageKey, JSON.stringify(progress));
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

    document.getElementById('btn-continue').addEventListener('click', () => {
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
        signatures: savedProgress.formData.signatures || {}
      };
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
          this.formData.organization = {
            type: formData.get('type') || '',
            name: formData.get('name') || '',
            description: formData.get('description') || '',
            address: formData.get('address') || '',
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

    categorySelect.addEventListener('change', (e) => {
      const category = e.target.value;

      // Limpiar select de tipo
      typeSelect.innerHTML = '<option value="">Seleccione...</option>';

      if (category === 'TERRITORIAL') {
        // Poblar con tipos territoriales
        Object.entries(TERRITORIAL_TYPES).forEach(([key, label]) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = label;
          typeSelect.appendChild(option);
        });
        typeHelp.textContent = 'Organizaciones basadas en un territorio geográfico específico (unidad vecinal)';
        typeRow.style.display = 'flex';

      } else if (category === 'FUNCIONAL') {
        // Poblar con tipos funcionales
        Object.entries(FUNCIONAL_TYPES).forEach(([key, label]) => {
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
      } else {
        neighborhoodRow.style.display = 'none';
        document.getElementById('org-neighborhood').required = false;
      }

      // Actualizar requisitos de miembros según tipo
      this.updateMemberRequirements(type);
    });
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

    // FASE 2: Interceptar después del paso 3 (Estatutos) para solicitar Ministro de Fe
    // El usuario debe revisar los estatutos antes de agendar la asamblea con el Ministro
    if (this.currentStep === 3 && !this.formData.ministroApproved) {
      await this.showMinistroRequestScreen();
      return;
    }

    // Si es el último paso, enviar solicitud
    if (this.currentStep === this.totalSteps) {
      await this.submitApplication();
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

    if (this.currentStep === 1) {
      prevBtn.style.display = 'none';
    } else {
      prevBtn.style.display = 'block';
    }

    if (this.currentStep === this.totalSteps) {
      nextBtn.textContent = '✓ Enviar Solicitud';
      nextBtn.classList.add('btn-success');
    } else {
      nextBtn.textContent = 'Siguiente →';
      nextBtn.classList.remove('btn-success');
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
        return this.validateStep3_Estatutos(); // Estatutos ahora es paso 3
      case 4:
        return this.validateStep4_Comision(); // Comisión ahora es paso 4
      case 5:
        return this.validateStep5_Firmas(); // Firmas ahora es paso 5
      case 6:
        return this.validateStep6(); // Documentos
      case 7:
        return this.validateStep7(); // Revisión
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
    return true;
  }

  /**
   * Valida paso 4: Comisión Electoral
   */
  validateStep4_Comision() {
    const electionDate = document.getElementById('election-date').value;

    if (!electionDate) {
      showToast('Debe especificar la fecha de elección', 'error');
      return false;
    }

    if (this.formData.commission.members.length !== 3) {
      showToast('La Comisión Electoral debe tener exactamente 3 miembros', 'error');
      return false;
    }

    return true;
  }

  /**
   * Valida paso 5: Firmas
   */
  validateStep5_Firmas() {
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
   * Valida paso 3: Estatutos (antes de solicitar Ministro de Fe)
   */
  validateStep3_Estatutos() {
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
    this.formData.estatutos = {
      tipo: statutesOption || 'template',
      contenido: document.getElementById('statutes-editor')?.value || ''
    };

    return true;
  }

  /**
   * Valida paso 6: Documentos
   */
  validateStep6() {
    const errors = [];

    // Validar documentos auto-generados
    const requiredDocs = [
      'ACTA_CONSTITUTIVA',
      'ESTATUTOS',
      'REGISTRO_SOCIOS',
      'DECLARACION_JURADA_PRESIDENTE',
      'ACTA_COMISION_ELECTORAL'
    ];

    const missingDocs = requiredDocs.filter(doc => !this.formData.documents[doc]);

    if (missingDocs.length > 0) {
      errors.push('Algunos documentos no fueron generados correctamente');
    }

    // Validar certificados de antecedentes de cada miembro de la comisión
    const commission = this.formData.commission.members || [];
    const certificates = this.formData.certificates || {};
    const roles = ['Presidente', 'Secretario', 'Vocal'];

    const missingCertificates = commission.filter(member => !certificates[member.id]);

    if (missingCertificates.length > 0) {
      const details = missingCertificates.map(m => {
        const memberIndex = commission.findIndex(c => c.id === m.id);
        const role = roles[memberIndex] || 'Miembro';
        return `${role}: ${m.firstName} ${m.lastName}`;
      });
      errors.push({
        title: 'Certificados de Antecedentes pendientes',
        items: details
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
   * Valida paso 7: Revisión
   */
  validateStep7() {
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
        this.saveStep3();
        break;
      case 4:
        // FASE 3: Paso 4 ahora es Firmas (se guardan en tiempo real)
        break;
      case 5:
        // FASE 3: Paso 5 ahora es Estatutos
        await this.saveStep5_Estatutos();
        break;
      case 6:
        // Los documentos se guardan en tiempo real
        break;
      case 7:
        // Paso de revisión, no hay nada que guardar
        break;
    }
  }

  /**
   * Guarda datos del paso 1
   */
  saveStep1() {
    const form = document.getElementById('form-step-1');
    const formData = new FormData(form);

    this.formData.organization = {
      type: formData.get('type'),
      name: formData.get('name'),
      description: formData.get('description'),
      address: formData.get('address'),
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
   * Guarda datos del paso 3
   */
  saveStep3() {
    const electionDate = document.getElementById('election-date').value;
    this.formData.commission.electionDate = electionDate;
  }

  /**
   * FASE 3: Guarda datos del paso 5: Estatutos (antes era paso 4)
   */
  async saveStep5_Estatutos() {
    const statutesOption = document.querySelector('input[name="statutes-option"]:checked').value;

    if (statutesOption === 'template') {
      // Guardar el contenido editado del editor
      const editor = document.getElementById('statutes-editor');
      const editedContent = editor ? editor.value : this.generateEstatutosForEditor();

      this.formData.statutes = {
        type: 'template',
        editedContent: editedContent,
        content: this.generateStatutesFromTemplate()
      };
    } else {
      const fileInput = document.getElementById('custom-statutes-file');
      if (fileInput.files.length || this.formData.statutes?.customFile) {
        const file = fileInput.files[0] || this.formData.statutes.customFile;
        const savedFile = await indexedDBService.saveFile(file);

        this.formData.statutes = {
          type: 'custom',
          content: savedFile,
          customFile: file
        };
      }
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
          content: org.description
        },
        // ... más artículos
      ]
    };
  }

  /**
   * Inicializa el paso actual
   */
  initializeCurrentStep() {
    switch (this.currentStep) {
      case 1:
        this.initializeStep1();
        break;
      case 2:
        this.initializeStep2();
        break;
      case 3:
        this.initializeStep3_Estatutos(); // Estatutos ahora es paso 3
        break;
      case 4:
        this.initializeStep4_Comision(); // Comisión ahora es paso 4
        break;
      case 5:
        this.initializeStep5_Firmas(); // Firmas ahora es paso 5
        break;
      case 6:
        this.initializeStep6(); // Documentos
        break;
      case 7:
        this.initializeStep7(); // Revisión
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
      const fullName = `${member.primerNombre || member.firstName || ''} ${member.segundoNombre || ''} ${member.apellidoPaterno || member.lastName?.split(' ')[0] || ''} ${member.apellidoMaterno || member.lastName?.split(' ')[1] || ''}`.replace(/\s+/g, ' ').trim();

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
              ${member.rut}
            </span>
            <span class="member-detail-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              ${member.email}
            </span>
            <span class="member-detail-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              ${member.phone}
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
   * Inicializa paso 4: Comisión Electoral (solo visualización)
   */
  initializeStep4_Comision() {
    this.renderCommissionListReadOnly();
    this.renderElectionDateDisplay();
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

    listContainer.innerHTML = commission.map((member, index) => `
      <div class="commission-member-display-card">
        <div class="member-role-icon">${roleIcons[index]}</div>
        <div class="member-display-info">
          <div class="member-role-badge ${index === 0 ? 'president' : index === 1 ? 'secretary' : 'vocal'}">${roles[index]}</div>
          <div class="member-name">${member.firstName} ${member.lastName}</div>
          <div class="member-rut">${member.rut || 'RUT no registrado'}</div>
        </div>
        <div class="member-verified-badge">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
      </div>
    `).join('');
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

    listContainer.innerHTML = this.formData.commission.members.map((member, index) => `
      <div class="commission-member-card">
        <div class="member-info">
          <div class="member-name">${member.firstName} ${member.lastName}</div>
          <div class="member-role">${index === 0 ? 'Presidente' : index === 1 ? 'Secretario' : 'Vocal'}</div>
        </div>
      </div>
    `).join('');
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
   * Inicializa paso 3: Estatutos (antes de solicitar Ministro de Fe)
   */
  initializeStep3_Estatutos() {
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

    return `ESTATUTOS TIPO
COMITÉ DE VIVIENDA
"${(org.name || '[NOMBRE DEL COMITÉ]').toUpperCase()}"

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


Estatutos aprobados en Asamblea Constitutiva del ${today}.`;
  }

  /**
   * Estatutos para Centro de Padres y Apoderados
   */
  generateEstatutosCentroPadres() {
    const org = this.formData.organization;
    const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

    return `ESTATUTOS TIPO
CENTRO DE PADRES Y APODERADOS
"${(org.name || '[NOMBRE DEL ESTABLECIMIENTO]').toUpperCase()}"

TÍTULO PRIMERO
DENOMINACIÓN, DOMICILIO Y DURACIÓN

Artículo 1°: Constitúyese el Centro de Padres y Apoderados del establecimiento educacional "${org.name || '[NOMBRE ESTABLECIMIENTO]'}", en adelante "el Centro", con domicilio en ${org.address || '[DIRECCIÓN]'}, comuna de ${org.commune || 'Renca'}, Región ${org.region || 'Metropolitana'}.

Artículo 2°: El Centro de Padres y Apoderados es un organismo que comparte y colabora en los propósitos educativos y sociales del establecimiento educacional.

Artículo 3°: La duración del Centro será indefinida.


TÍTULO SEGUNDO
OBJETIVOS Y FUNCIONES

Artículo 4°: Son objetivos del Centro:
a) Promover una estrecha relación entre el hogar y el establecimiento;
b) Apoyar la labor educativa del establecimiento y estimular el desarrollo de los estudiantes;
c) Promover el desarrollo y progreso del conjunto de la comunidad escolar;
d) Representar a los padres y apoderados ante las autoridades del establecimiento;
e) Gestionar recursos para el mejoramiento de la calidad de la educación.

Artículo 5°: Para el cumplimiento de sus objetivos, el Centro podrá:
a) Fomentar la vinculación del establecimiento con la comunidad;
b) Organizar actividades culturales, deportivas y recreativas;
c) Canalizar inquietudes y propuestas de los apoderados;
d) Colaborar en los programas del establecimiento;
e) Administrar los recursos que el Centro genere o reciba.


TÍTULO TERCERO
DE LOS MIEMBROS

Artículo 6°: Serán miembros del Centro los padres, madres y apoderados de los alumnos matriculados en el establecimiento.

Artículo 7°: Son derechos de los miembros:
a) Participar con derecho a voz y voto en las Asambleas;
b) Elegir y ser elegidos para cargos del Centro;
c) Ser informados de las actividades y gestiones del Centro;
d) Proponer iniciativas y proyectos.

Artículo 8°: Son deberes de los miembros:
a) Colaborar con las actividades del Centro;
b) Asistir a las Asambleas y reuniones;
c) Respetar los estatutos y acuerdos;
d) Cumplir con los aportes establecidos.


TÍTULO CUARTO
DE LA ORGANIZACIÓN

Artículo 9°: El Centro estará organizado a través de:
a) La Asamblea General
b) El Directorio
c) Los Subcentros de cada curso
d) El Consejo de Delegados de Curso

Artículo 10°: El Directorio estará compuesto por:
- Presidente/a
- Vicepresidente/a
- Secretario/a
- Tesorero/a
- Un Delegado de Enseñanza Básica
- Un Delegado de Enseñanza Media (si corresponde)

Artículo 11°: El Directorio durará 2 años en funciones, pudiendo ser reelegido por un período.

Artículo 12°: Son atribuciones del Directorio:
a) Dirigir el Centro conforme a estos estatutos;
b) Administrar los bienes del Centro;
c) Representar al Centro ante autoridades;
d) Convocar a Asambleas;
e) Designar comisiones de trabajo.


TÍTULO QUINTO
DE LAS ASAMBLEAS

Artículo 13°: La Asamblea General es la máxima autoridad del Centro. Se reunirá ordinariamente al menos 2 veces al año.

Artículo 14°: Son materias de Asamblea Ordinaria:
a) Aprobar memoria y balance anual;
b) Aprobar plan de trabajo y presupuesto;
c) Elegir Directorio cuando corresponda;
d) Conocer informes de comisiones.

Artículo 15°: La Asamblea Extraordinaria se convocará a solicitud del Directorio o del 20% de los miembros.


TÍTULO SEXTO
DEL PATRIMONIO

Artículo 16°: El patrimonio del Centro estará formado por:
a) Las cuotas de incorporación y ordinarias;
b) El producto de actividades del Centro;
c) Las donaciones y subvenciones;
d) Los bienes que adquiera.

Artículo 17°: Los fondos se depositarán en cuenta bancaria y serán girados con firma conjunta del Presidente y Tesorero.


TÍTULO SÉPTIMO
DISPOSICIONES GENERALES

Artículo 18°: La modificación de estatutos requiere aprobación de 2/3 de los asistentes a Asamblea Extraordinaria.

Artículo 19°: La disolución del Centro requiere acuerdo de 2/3 de los miembros. Los bienes remanentes se destinarán al establecimiento educacional.


Estatutos aprobados en Asamblea Constitutiva del ${today}.`;
  }

  /**
   * Estatutos para Organizaciones Territoriales (Junta de Vecinos)
   */
  generateEstatutosTerritorial() {
    const org = this.formData.organization;
    const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
    const tipoOrg = org.type === 'JUNTA_VECINOS' ? 'Junta de Vecinos' : 'Comité de Vecinos';

    return `ESTATUTOS TIPO
${tipoOrg.toUpperCase()}
"${(org.name || '[NOMBRE]').toUpperCase()}"

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


Estatutos aprobados en Asamblea Constitutiva del ${today}.`;
  }

  /**
   * Estatutos para CVPCC (Comité Vecinal de Prevención y Convivencia Comunitaria)
   */
  generateEstatutosCVPCC() {
    const org = this.formData.organization;
    const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

    return `ESTATUTOS TIPO
COMITÉ VECINAL DE PREVENCIÓN Y CONVIVENCIA COMUNITARIA
"${(org.name || '[NOMBRE DEL CVPCC]').toUpperCase()}"

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


Estatutos aprobados en Asamblea Constitutiva del ${today}.`;
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

    return `ESTATUTOS TIPO
ORGANIZACIÓN COMUNITARIA FUNCIONAL
${tipoNombre.toUpperCase()}
"${(org.name || '[NOMBRE DE LA ORGANIZACIÓN]').toUpperCase()}"

TÍTULO PRIMERO
DENOMINACIÓN, DOMICILIO Y DURACIÓN

Artículo 1°: Constitúyese una Organización Comunitaria Funcional del tipo "${tipoNombre}" denominada "${org.name || '[NOMBRE]'}", en adelante "la Organización", regida por la Ley N° 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias.

Artículo 2°: El domicilio de la Organización será en ${org.address || '[DIRECCIÓN]'}, comuna de ${org.commune || 'Renca'}, Región ${org.region || 'Metropolitana'}, sin perjuicio de las actividades que pueda desarrollar en otras localidades.

Artículo 3°: La duración de la Organización será indefinida.


TÍTULO SEGUNDO
OBJETIVOS Y FUNCIONES

Artículo 4°: Los objetivos de la Organización son:
${org.description || `a) Promover el desarrollo comunitario en el ámbito de su especialidad;
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


Estatutos aprobados en Asamblea Constitutiva del ${today}.`;
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
   * Inicializa paso 5: Firmas (solo visualización)
   */
  initializeStep5_Firmas() {
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

    // Simular que todas las firmas están completadas (fueron hechas en asamblea)
    container.innerHTML = commission.map((member, index) => {
      const signatureData = signatures[member.id];

      return `
        <div class="signature-member-display-card signed">
          <div class="signature-member-icon">${roleIcons[index]}</div>
          <div class="signature-member-display-info">
            <div class="member-role-badge ${index === 0 ? 'president' : index === 1 ? 'secretary' : 'vocal'}">${roles[index]}</div>
            <div class="member-name">${member.firstName} ${member.lastName}</div>
            <div class="member-rut">${member.rut || 'RUT no registrado'}</div>
          </div>
          <div class="signature-preview-display">
            ${signatureData && signatureData.type === 'drawn' && signatureData.data ? `
              <img src="${signatureData.data}" alt="Firma" class="signature-preview-img">
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

    container.innerHTML = commission.map((member, index) => {
      const hasSigned = signatures[member.id];
      const signatureData = hasSigned ? signatures[member.id] : null;

      return `
        <div class="signature-member-card ${hasSigned ? 'signed' : ''}" data-member-id="${member.id}">
          <div class="signature-member-info">
            <span class="member-role-badge">${roles[index]}</span>
            <div class="member-details">
              <span class="member-name">${member.firstName} ${member.lastName}</span>
              <span class="member-rut">${member.rut}</span>
            </div>
          </div>

          ${hasSigned ? `
            <div class="signature-member-preview">
              ${signatureData.type === 'drawn' ? `
                <img src="${signatureData.data}" alt="Firma de ${member.firstName}" class="signature-thumb">
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
              <button class="btn-change-signature" data-member-id="${member.id}">Cambiar</button>
            </div>
          ` : `
            <button class="btn-sign-member" data-member-id="${member.id}" data-member-name="${member.firstName} ${member.lastName}">
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

    html += commission.map((member, index) => `
      <div class="certificate-item ${this.formData.certificates[member.id] ? 'completed' : ''}" data-member-id="${member.id}">
        <div class="certificate-info">
          <div class="certificate-member">
            <span class="member-role-badge">${roles[index]}</span>
            <span class="member-name">${member.firstName} ${member.lastName}</span>
            <span class="badge-required">Requerido</span>
          </div>
          <span class="member-rut">${member.rut}</span>
          <div class="certificate-status ${this.formData.certificates[member.id] ? 'uploaded' : ''}">
            ${this.formData.certificates[member.id]
              ? `<span class="status-uploaded">✓ ${this.formData.certificates[member.id].fileName}</span>`
              : '<span class="status-pending-cert">⚠ Pendiente de subir</span>'}
          </div>
        </div>
        <div class="certificate-actions">
          <input type="file" class="certificate-file-input" data-member-id="${member.id}" accept=".pdf" style="display: none;">
          <button class="btn-upload-cert" data-member-id="${member.id}" ${this.formData.certificates[member.id] ? 'style="display:none;"' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Subir PDF
          </button>
          <button class="btn-remove-cert" data-member-id="${member.id}" ${this.formData.certificates[member.id] ? '' : 'style="display:none;"'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

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
    const docs = ['ACTA_CONSTITUTIVA', 'ESTATUTOS', 'REGISTRO_SOCIOS', 'DECLARACION_JURADA_PRESIDENTE', 'ACTA_COMISION_ELECTORAL'];
    docs.forEach(docType => {
      setTimeout(() => this.downloadDocument(docType), 500);
    });
    showToast('Descargando documentos...', 'info');
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
  generateAllDocuments() {
    const org = this.formData.organization;
    const members = this.formData.members;
    const commission = this.formData.commission;
    const today = new Date().toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

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

    // 4. Declaración Jurada del Presidente
    this.formData.documents['DECLARACION_JURADA_PRESIDENTE'] = {
      id: 'doc-declaracion-jurada',
      type: 'DECLARACION_JURADA_PRESIDENTE',
      isGenerated: true,
      content: this.generateDeclaracionJurada(org, commission, today),
      generatedAt: new Date().toISOString()
    };

    // 5. Acta Comisión Electoral
    this.formData.documents['ACTA_COMISION_ELECTORAL'] = {
      id: 'doc-acta-comision',
      type: 'ACTA_COMISION_ELECTORAL',
      isGenerated: true,
      content: this.generateActaComisionElectoral(org, commission, today),
      generatedAt: new Date().toISOString()
    };

    // Mostrar previews
    this.updateDocumentPreviews();
  }

  /**
   * Genera el Acta Constitutiva
   */
  generateActaConstitutiva(org, members, commission, today) {
    const presidenteComision = commission.members[0];
    return `ACTA DE ASAMBLEA CONSTITUTIVA

${org.name.toUpperCase()}

En ${org.commune}, Región ${org.region}, a ${today}, siendo las 10:00 horas, se reúnen en ${org.address}, las personas que se individualizan al final del presente documento, con el objeto de constituir una ${org.type === 'JUNTA_VECINOS' ? 'Junta de Vecinos' : 'Organización Comunitaria Funcional'}, de conformidad con la Ley N° 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias.

PRIMERO: Preside la asamblea don(a) ${presidenteComision?.firstName || '[Nombre]'} ${presidenteComision?.lastName || '[Apellidos]'}, RUT ${presidenteComision?.rut || '[RUT]'}, en su calidad de Presidente de la Comisión Electoral, actuando como Secretario don(a) ${commission.members[1]?.firstName || '[Nombre]'} ${commission.members[1]?.lastName || '[Apellidos]'}, RUT ${commission.members[1]?.rut || '[RUT]'}.

SEGUNDO: El Presidente declara abierta la sesión y expone los objetivos de la misma, señalando que se procederá a:
a) Constituir legalmente la organización;
b) Aprobar los estatutos que regirán a la organización;
c) Elegir al Directorio provisional.

TERCERO: Los asistentes, por unanimidad, acuerdan constituir la organización que se denominará "${org.name}", con domicilio en ${org.address}, comuna de ${org.commune}, Región ${org.region}.

CUARTO: Se aprueban por unanimidad los estatutos de la organización, cuyo texto se adjunta como documento anexo.

QUINTO: Los objetivos de la organización son:
${org.description}

SEXTO: La organización se constituye con ${members.length} miembros fundadores, cuyos datos se encuentran en el Registro de Socios adjunto.

SÉPTIMO: Se deja constancia que la Comisión Electoral está compuesta por:
- Presidente: ${commission.members[0]?.firstName || ''} ${commission.members[0]?.lastName || ''} - RUT: ${commission.members[0]?.rut || ''}
- Secretario: ${commission.members[1]?.firstName || ''} ${commission.members[1]?.lastName || ''} - RUT: ${commission.members[1]?.rut || ''}
- Vocal: ${commission.members[2]?.firstName || ''} ${commission.members[2]?.lastName || ''} - RUT: ${commission.members[2]?.rut || ''}

OCTAVO: La fecha programada para la elección del directorio definitivo es el ${commission.electionDate ? new Date(commission.electionDate).toLocaleDateString('es-CL') : '[Fecha por definir]'}.

No habiendo otros puntos que tratar, se levanta la sesión siendo las 12:00 horas del mismo día.



________________________
Presidente Comisión Electoral
${presidenteComision?.firstName || ''} ${presidenteComision?.lastName || ''}
RUT: ${presidenteComision?.rut || ''}



________________________
Secretario Comisión Electoral
${commission.members[1]?.firstName || ''} ${commission.members[1]?.lastName || ''}
RUT: ${commission.members[1]?.rut || ''}`;
  }

  /**
   * Genera los Estatutos
   */
  generateEstatutos(org, today) {
    return `ESTATUTOS
${org.name.toUpperCase()}

TÍTULO I
NOMBRE, DOMICILIO Y DURACIÓN

Artículo 1°: Constitúyese una ${org.type === 'JUNTA_VECINOS' ? 'Junta de Vecinos' : 'Organización Comunitaria Funcional'} que se denominará "${org.name}", en adelante también "la Organización".

Artículo 2°: El domicilio de la Organización será en ${org.address}, comuna de ${org.commune}, Región ${org.region}, sin perjuicio de las actividades que pueda desarrollar en otras localidades.

Artículo 3°: La duración de la Organización será indefinida.


TÍTULO II
OBJETIVOS

Artículo 4°: Los objetivos de la Organización son:
${org.description}

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


Aprobados en Asamblea Constitutiva de fecha ${today}.`;
  }

  /**
   * Genera el Registro de Socios
   */
  generateRegistroSocios(org, members, today) {
    let registro = `REGISTRO DE SOCIOS FUNDADORES
${org.name.toUpperCase()}

Fecha: ${today}
Total de Socios Fundadores: ${members.length}

${'='.repeat(100)}
N°   | RUT              | NOMBRE COMPLETO                    | DOMICILIO                    | TELÉFONO
${'='.repeat(100)}
`;

    members.forEach((member, index) => {
      const num = String(index + 1).padStart(3, ' ');
      const rut = member.rut.padEnd(16, ' ');
      const nombre = `${member.firstName} ${member.lastName}`.substring(0, 34).padEnd(34, ' ');
      const direccion = (member.address || '').substring(0, 28).padEnd(28, ' ');
      const telefono = member.phone || '';

      registro += `${num}  | ${rut} | ${nombre} | ${direccion} | ${telefono}\n`;
    });

    registro += `${'='.repeat(100)}

Certifico que las ${members.length} personas antes individualizadas son socios fundadores de ${org.name}, habiendo participado en la Asamblea Constitutiva de fecha ${today}.



________________________
Secretario Comisión Electoral`;

    return registro;
  }

  /**
   * Genera la Declaración Jurada
   */
  generateDeclaracionJurada(org, commission, today) {
    const presidente = commission.members[0];
    return `DECLARACIÓN JURADA SIMPLE

Yo, ${presidente?.firstName || '[Nombre]'} ${presidente?.lastName || '[Apellidos]'}, RUT ${presidente?.rut || '[RUT]'}, domiciliado/a en ${presidente?.address || '[Dirección]'}, en mi calidad de Presidente de la Comisión Electoral de ${org.name}, declaro bajo juramento lo siguiente:

1. Que la Asamblea Constitutiva de ${org.name} se realizó el día ${today}, con la asistencia de ${this.formData.members.length} personas que cumplen con los requisitos legales para ser miembros de la organización.

2. Que los estatutos fueron aprobados por unanimidad de los asistentes.

3. Que la Comisión Electoral fue elegida para supervisar el proceso eleccionario del primer Directorio definitivo.

4. Que la fecha programada para la elección del Directorio es el ${commission.electionDate ? new Date(commission.electionDate).toLocaleDateString('es-CL') : '[Fecha por definir]'}.

5. Que toda la información proporcionada en la solicitud de constitución es verídica y corresponde a los hechos ocurridos.

6. Que conozco y acepto las responsabilidades que me corresponden según la Ley N° 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias.

Asumo la responsabilidad legal por la veracidad de esta declaración, en conformidad con el artículo 212 del Código Penal.

${org.commune}, ${today}



________________________
${presidente?.firstName || ''} ${presidente?.lastName || ''}
RUT: ${presidente?.rut || ''}
Presidente Comisión Electoral
${org.name}`;
  }

  /**
   * Genera el Acta de la Comisión Electoral
   */
  generateActaComisionElectoral(org, commission, today) {
    return `ACTA DE ESTABLECIMIENTO DE COMISIÓN ELECTORAL

${org.name.toUpperCase()}

En ${org.commune}, Región ${org.region}, a ${today}, en el marco de la Asamblea Constitutiva de ${org.name}, se procede a establecer la Comisión Electoral que supervisará el proceso de elección del primer Directorio de la organización.

De acuerdo con lo establecido en la Ley N° 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias, la Comisión Electoral queda integrada por los siguientes miembros:


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


FECHA DE ELECCIÓN PROGRAMADA: ${commission.electionDate ? new Date(commission.electionDate).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '[Por definir]'}

LUGAR DE VOTACIÓN: ${org.address}, ${org.commune}


Los integrantes de la Comisión Electoral aceptan el cargo y se comprometen a cumplir fielmente sus funciones de acuerdo con la ley y los estatutos de la organización.

Para constancia, firman:



________________________
${commission.members[0]?.firstName || ''} ${commission.members[0]?.lastName || ''}
RUT: ${commission.members[0]?.rut || ''}
Presidente



________________________
${commission.members[1]?.firstName || ''} ${commission.members[1]?.lastName || ''}
RUT: ${commission.members[1]?.rut || ''}
Secretario



________________________
${commission.members[2]?.firstName || ''} ${commission.members[2]?.lastName || ''}
RUT: ${commission.members[2]?.rut || ''}
Vocal`;
  }

  /**
   * Actualiza los previews de documentos
   */
  updateDocumentPreviews() {
    Object.keys(this.formData.documents).forEach(docType => {
      const doc = this.formData.documents[docType];
      if (doc && doc.isGenerated) {
        const previewEl = document.getElementById(`preview-${docType}`);
        if (previewEl) {
          // Mostrar las primeras líneas del documento
          const lines = doc.content.split('\n').slice(0, 3).join('\n');
          previewEl.textContent = lines + '...';
        }
      }
    });
  }

  /**
   * Muestra preview de un documento
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
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada',
      'ACTA_COMISION_ELECTORAL': 'Acta Comisión Electoral'
    };

    // Configuración de qué firmas requiere cada documento
    // 0 = Presidente, 1 = Secretario, 2 = Vocal
    const docSignatureConfig = {
      'ACTA_CONSTITUTIVA': [0, 1],           // Presidente y Secretario
      'ESTATUTOS': [0, 1],                    // Presidente y Secretario
      'REGISTRO_SOCIOS': [1],                 // Solo Secretario
      'DECLARACION_JURADA_PRESIDENTE': [0],   // Solo Presidente
      'ACTA_COMISION_ELECTORAL': [0, 1, 2]    // Los 3 miembros
    };

    const requiredSigners = docSignatureConfig[docType] || [];

    // Generar HTML de firmas según los firmantes requeridos
    const signaturesHTML = requiredSigners.length > 0 ? this.generateSignaturesHTML(requiredSigners) : '';

    const modalHTML = `
      <div class="modal-overlay" id="preview-document-modal">
        <div class="modal-content modal-document-preview">
          <div class="modal-document-header">
            <h3>${docNames[docType] || docType}</h3>
            <button class="modal-close-btn" id="close-preview-modal">&times;</button>
          </div>
          <div class="modal-document-body">
            <pre class="document-content-preview">${this.escapeHtml(doc.content.split('========== FIRMAS ==========')[0])}</pre>
            ${signaturesHTML}
          </div>
          <div class="modal-document-actions">
            <button type="button" class="btn-secondary" id="close-preview">Cerrar</button>
            <button type="button" class="btn-primary" id="download-from-preview" data-doc-type="${docType}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Descargar
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
    const roles = ['Presidente', 'Secretario', 'Vocal'];

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
      const role = roles[index] || 'Miembro';

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
            <strong>${role} de la Comisión Electoral</strong>
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
   * Muestra modal para editar documento
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
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada',
      'ACTA_COMISION_ELECTORAL': 'Acta Comisión Electoral'
    };

    const modalHTML = `
      <div class="modal-overlay" id="edit-document-modal">
        <div class="modal-content modal-document-edit">
          <div class="modal-document-header">
            <h3>Editar: ${docNames[docType] || docType}</h3>
            <button class="modal-close-btn" id="close-edit-doc-modal">&times;</button>
          </div>
          <div class="modal-document-body">
            <textarea class="document-content-edit" id="edit-doc-content">${doc.content}</textarea>
          </div>
          <div class="modal-document-actions">
            <button type="button" class="btn-secondary" id="cancel-edit-doc">Cancelar</button>
            <button type="button" class="btn-primary" id="save-edit-doc" data-doc-type="${docType}">
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
   * Descarga un documento
   */
  downloadDocument(docType) {
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
      'ACTA_COMISION_ELECTORAL': 'Acta_Comision_Electoral'
    };

    const orgName = this.formData.organization.name?.replace(/\s+/g, '_') || 'Organizacion';
    const fileName = `${docNames[docType] || docType}_${orgName}.txt`;

    const blob = new Blob([doc.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Documento descargado', 'success');
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
   * Inicializa paso 6: Documentos
   */
  initializeStep6() {
    // Generar documentos automáticamente con las firmas ya incluidas
    this.generateAllDocuments();

    // Aplicar firmas a los documentos
    this.updateDocumentsWithSignatures();

    // Actualizar previews de documentos
    this.updateDocumentPreviews();

    // Generar lista de certificados de antecedentes
    this.renderCertificatesList();

    // Generar lista de fotos de carnet
    this.renderIdPhotosList();

    // Generar lista inicial de otros documentos
    this.renderOtherDocumentsList();

    // Botones de documentos - usar setTimeout para asegurar que el DOM esté listo
    setTimeout(() => {
      const btnAddDoc = document.getElementById('btn-add-other-document');
      if (btnAddDoc) {
        btnAddDoc.addEventListener('click', () => {
          this.addOtherDocumentSlot();
        });
      }

      // Botones de ver documento
      document.querySelectorAll('.btn-preview').forEach(btn => {
        btn.addEventListener('click', () => {
          this.showDocumentPreview(btn.dataset.docType);
        });
      });

      // Botones de editar documento
      document.querySelectorAll('.btn-edit-doc').forEach(btn => {
        btn.addEventListener('click', () => {
          this.showEditDocumentModal(btn.dataset.docType);
        });
      });

      // Botones de descargar documento
      document.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', () => {
          this.downloadDocument(btn.dataset.docType);
        });
      });
    }, 100);
  }

  /**
   * Inicializa paso 7: Revisión
   */
  initializeStep7() {
    this.renderReview();
  }

  /**
   * Renderiza la revisión final
   */
  renderReview() {
    // Organización
    const org = this.formData.organization;
    document.getElementById('review-organization').innerHTML = `
      <p><strong>Tipo:</strong> ${org.type === 'JUNTA_VECINOS' ? 'Junta de Vecinos' : 'Organización Funcional'}</p>
      <p><strong>Nombre:</strong> ${org.name}</p>
      <p><strong>Región:</strong> ${org.region}</p>
      <p><strong>Comuna:</strong> ${org.commune}</p>
      <p><strong>Dirección:</strong> ${org.address}</p>
      ${org.neighborhood ? `<p><strong>Unidad Vecinal:</strong> ${org.neighborhood}</p>` : ''}
      <p><strong>Email:</strong> ${org.email}</p>
      <p><strong>Teléfono:</strong> ${org.phone}</p>
      <p><strong>Objetivos:</strong> ${org.description}</p>
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
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada',
      'ACTA_COMISION_ELECTORAL': 'Acta Comisión Electoral'
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
      'DECLARACION_JURADA_PRESIDENTE': 'Declaración Jurada',
      'ACTA_COMISION_ELECTORAL': 'Acta Comisión Electoral'
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

    // Actualizar cada documento que requiere firmas
    const docsToUpdate = ['ACTA_CONSTITUTIVA', 'ACTA_COMISION_ELECTORAL'];

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
   */
  generateSignaturesBlock(signatures, commission) {
    const roles = ['Presidente', 'Secretario', 'Vocal'];
    let block = '\n\n========== FIRMAS ==========\n\n';

    commission.forEach((member, index) => {
      const signature = signatures[member.id];
      const role = roles[index] || 'Miembro';

      block += `${role} de la Comisión Electoral:\n`;
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
    const stepContent = document.querySelector('#step-2');
    if (!stepContent) return;

    // Reemplazar el contenido del paso 2 con el formulario de solicitud de Ministro
    const orgTypeName = this.formData.organization.type === 'JUNTA_VECINOS' ? 'Junta de Vecinos' :
                        this.formData.organization.type === 'ORG_COMUNITARIA' ? 'Organización Comunitaria Funcional' :
                        this.formData.organization.type || 'N/A';

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
          <h2>Pasos 1 y 2 Completados</h2>
          <p>Has completado exitosamente la información básica y el registro de miembros fundadores.</p>
        </div>

        <!-- Info box -->
        <div class="ministro-info-box">
          <h3>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Siguiente Paso: Solicitar Ministro de Fe
          </h3>
          <p>Antes de continuar con el paso 3, debes <strong>solicitar un Ministro de Fe</strong> de la municipalidad.</p>
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
              <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 16px;">
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
        // Restaurar el HTML original del paso 2
        this.restoreStep2HTML();
        // Volver a mostrar el paso 2 normal
        this.updateUI();
        this.initializeCurrentStep();
      });
    }

    // Inicializar calendario interactivo
    this.initializeScheduleCalendar();

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

    let currentDate = new Date();
    let selectedDateKey = null;
    let selectedTime = null;

    // Función auxiliar para parsear dateKey correctamente sin problemas de zona horaria
    const parseDateKey = (dateKey) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const renderCalendar = (year, month) => {
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

      document.getElementById('current-month-year').textContent = `${monthNames[month]} ${year}`;

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const availability = scheduleService.getMonthAvailability(year, month + 1);
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

    const selectDate = (dateKey) => {
      selectedDateKey = dateKey;
      selectedTime = null;

      // Actualizar visualización del calendario
      document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('calendar-day-selected');
      });
      event.target.classList.add('calendar-day-selected');

      // Obtener y mostrar horarios disponibles
      const date = parseDateKey(dateKey);
      const availableSlots = scheduleService.getAvailableSlots(date);

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
    document.getElementById('prev-month-btn').addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });

    document.getElementById('next-month-btn').addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });

    // Botón de cambiar cita
    document.getElementById('change-appointment-btn').addEventListener('click', () => {
      document.getElementById('selected-appointment').style.display = 'none';
      document.getElementById('time-slots-container').style.display = 'block';
    });

    // Renderizar calendario inicial
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  }

  /**
   * FASE 2: Envía la solicitud de Ministro de Fe
   */
  async submitMinistroRequest(electionDate, electionTime, comments = '', assemblyAddress = '') {
    try {
      showToast('Enviando solicitud de Ministro de Fe...', 'info');

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

      // Crear la solicitud con los datos de pasos 1 y 2
      const requestData = {
        organizationData: {
          organization: this.formData.organization,
          members: this.formData.members
        },
        electionDate: electionDate,
        electionTime: electionTime,
        assemblyAddress: assemblyAddress,
        bookingId: booking.id,
        comments: comments
      };

      // Guardar en el servicio de organizaciones con estado WAITING_MINISTRO_REQUEST
      try {
        const org = await organizationsService.requestMinistro(requestData);
        console.log('✅ Organización creada:', org);

        // Limpiar progreso del wizard
        this.clearProgress();

        showToast('¡Solicitud de Ministro de Fe enviada correctamente!', 'success');
      } catch (error) {
        console.error('❌ Error al crear organización:', error);
        showToast('Error al enviar la solicitud: ' + error.message, 'error');
        return;
      }

      // Mostrar mensaje de confirmación
      const stepContent = document.querySelector('#step-2');
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

            <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; max-width: 500px; margin: 24px auto;">
              <h3 style="color: #1e40af; margin: 0 0 12px 0;">¿Qué sigue?</h3>
              <ol style="text-align: left; color: #3b82f6; margin: 0; padding-left: 20px;">
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

        const closeBtn = document.getElementById('close-wizard-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            this.close();
            if (window.refreshOrganizations) {
              window.refreshOrganizations();
            }
          });
        }
      }

    } catch (error) {
      console.error('Error al enviar solicitud de Ministro de Fe:', error);
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
        selectedOption.style.borderColor = '#3b82f6';
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
}
