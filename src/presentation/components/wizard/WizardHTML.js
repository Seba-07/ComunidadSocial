/**
 * WizardHTML
 * Genera el HTML del wizard de creación de organizaciones
 */

export function getWizardHTML() {
  return `
    <div class="wizard-overlay" id="wizard-overlay">
      <div class="wizard-container">
        <!-- Header del Wizard -->
        <div class="wizard-header">
          <h2>Crear Organización Comunitaria</h2>
          <div class="wizard-header-actions">
            <button class="btn-save-progress" id="wizard-save" title="Guardar progreso">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Guardar y Salir
            </button>
            <button class="wizard-close" id="wizard-close">&times;</button>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="wizard-progress">
          <div class="wizard-progress-bar" id="wizard-progress-bar"></div>
          <div class="wizard-steps">
            <div class="wizard-step active" data-step="1">
              <div class="step-number">1</div>
              <div class="step-label">Datos</div>
            </div>
            <div class="wizard-step" data-step="2">
              <div class="step-number">2</div>
              <div class="step-label">Miembros</div>
            </div>
            <div class="wizard-step" data-step="3">
              <div class="step-number">3</div>
              <div class="step-label">Config.</div>
            </div>
            <div class="wizard-step" data-step="4">
              <div class="step-number">4</div>
              <div class="step-label">Estatutos</div>
            </div>
            <div class="wizard-step" data-step="5">
              <div class="step-number">5</div>
              <div class="step-label">Comisión</div>
            </div>
            <div class="wizard-step" data-step="6">
              <div class="step-number">6</div>
              <div class="step-label">Firmas</div>
            </div>
            <div class="wizard-step" data-step="7">
              <div class="step-number">7</div>
              <div class="step-label">Documentos</div>
            </div>
            <div class="wizard-step" data-step="8">
              <div class="step-number">8</div>
              <div class="step-label">Revisión</div>
            </div>
          </div>
        </div>

        <!-- Wizard Content -->
        <div class="wizard-content">
          ${getStep1HTML()}
          ${getStep2HTML()}
          ${getStep3HTML_ConfigEstatutos()}
          ${getStep4HTML_Estatutos()}
          ${getStep5HTML_Comision()}
          ${getStep6HTML_Firmas()}
          ${getStep7HTML_Documentos()}
          ${getStep8HTML_Revision()}
        </div>

        <!-- Wizard Actions -->
        <div class="wizard-actions">
          <div class="wizard-nav-buttons">
            <button class="btn-secondary" id="wizard-prev" style="display: none;">
              ← Anterior
            </button>
            <button class="btn-primary" id="wizard-next">
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getStep1HTML() {
  return `
    <div class="wizard-step-content active" id="step-1">
      <h3>Paso 1: Datos Básicos de la Organización</h3>
      <p class="step-description">Complete la información fundamental de su organización comunitaria.</p>

      <form class="wizard-form" id="form-step-1">
        <div class="form-row">
          <div class="form-group">
            <label for="org-category">Categoría de Organización <span class="required">*</span></label>
            <select id="org-category" name="category" required>
              <option value="">Seleccione...</option>
              <option value="TERRITORIAL">Organización Comunitaria Territorial</option>
              <option value="FUNCIONAL">Organización Comunitaria Funcional</option>
            </select>
            <small class="form-help">Según Ley 19.418</small>
          </div>
        </div>

        <div class="form-row" id="org-type-row" style="display: none;">
          <div class="form-group">
            <label for="org-type">Tipo Específico <span class="required">*</span></label>
            <select id="org-type" name="type" required>
              <option value="">Seleccione...</option>
            </select>
            <small class="form-help" id="org-type-help"></small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="org-name">Nombre de la Organización <span class="required">*</span></label>
            <input
              type="text"
              id="org-name"
              name="name"
              required
              placeholder="Ej: Junta de Vecinos Villa Esperanza"
              minlength="5"
            >
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="org-description">Descripción y Objetivos <span class="required">*</span></label>
            <textarea
              id="org-description"
              name="description"
              required
              rows="4"
              placeholder="Describa los objetivos principales de su organización..."
            ></textarea>
          </div>
        </div>

        <div class="form-row form-row-2">
          <div class="form-group">
            <label for="org-region">Región</label>
            <input
              type="text"
              id="org-region"
              name="region"
              readonly
              class="input-readonly"
              placeholder="Región Metropolitana de Santiago"
            >
            <input type="hidden" id="org-region-id" name="regionId">
            <small class="form-help">Todas las organizaciones deben ser de la Región Metropolitana</small>
          </div>
          <div class="form-group">
            <label for="org-commune">Comuna</label>
            <input
              type="text"
              id="org-commune"
              name="commune"
              readonly
              class="input-readonly"
              placeholder="Renca"
            >
            <small class="form-help">Todas las organizaciones deben ser de la comuna de Renca</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="org-address">Dirección de la Organización <span class="required">*</span></label>
            <input
              type="text"
              id="org-address"
              name="address"
              required
              placeholder="Calle, número (dirección de la sede de la organización)"
            >
            <small class="form-help">Dirección donde funcionará la organización comunitaria</small>
          </div>
        </div>

        <div class="form-row form-row-2" id="neighborhood-row" style="display: none;">
          <div class="form-group">
            <label for="org-neighborhood">Unidad Vecinal <span class="required">*</span></label>
            <input
              type="text"
              id="org-neighborhood"
              name="neighborhood"
              placeholder="Nombre de la unidad vecinal"
            >
            <small class="form-help">Requerido para Juntas de Vecinos</small>
          </div>
        </div>

        <div class="form-row form-row-2">
          <div class="form-group">
            <label for="org-email">Email de Contacto</label>
            <input
              type="email"
              id="org-email"
              name="email"
              readonly
              class="input-readonly"
              placeholder="Se carga desde tu perfil"
            >
            <small class="form-help">Dato obtenido de tu perfil de usuario</small>
          </div>
          <div class="form-group">
            <label for="org-phone">Teléfono</label>
            <input
              type="tel"
              id="org-phone"
              name="phone"
              readonly
              class="input-readonly"
              placeholder="Se carga desde tu perfil"
            >
            <small class="form-help">Dato obtenido de tu perfil de usuario</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Forma de Contacto Preferida <span class="required">*</span></label>
            <div style="display: flex; gap: 24px; margin-top: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="radio" name="contactPreference" value="phone" checked required>
                <span>📞 Teléfono</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="radio" name="contactPreference" value="email" required>
                <span>📧 Correo Electrónico</span>
              </label>
            </div>
            <small class="form-help">Seleccione cómo prefiere ser contactado por la Municipalidad</small>
          </div>
        </div>

        <div class="info-box">
          <strong>📋 Requisitos mínimos:</strong>
          <ul id="org-requirements-list">
            <li>Todos los miembros deben tener mínimo 14 años</li>
            <li>Deben residir en la unidad vecinal correspondiente</li>
          </ul>
        </div>
      </form>
    </div>
  `;
}

function getStep2HTML() {
  return `
    <div class="wizard-step-content" id="step-2">
      <h3>Paso 2: Miembros Fundadores</h3>
      <p class="step-description" id="step2-description">Registre a los miembros fundadores de la organización.</p>

      <div class="members-summary">
        <div class="summary-stat">
          <span class="stat-label">Total de miembros:</span>
          <span class="stat-value" id="members-count">0</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Mínimo requerido:</span>
          <span class="stat-value" id="min-members-required">15</span>
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
        <button class="btn-outline" id="btn-load-test-members-200">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Cargar 200 de Prueba
        </button>
      </div>

      <div id="members-list" class="members-list">
        <p class="text-muted">No hay miembros agregados aún.</p>
      </div>

      <!-- Modal agregar miembro (se genera dinámicamente) -->
    </div>
  `;
}

function getStep3HTML_ConfigEstatutos() {
  return `
    <div class="wizard-step-content" id="step-3">
      <h3>Paso 3: Configuración de Estatutos</h3>
      <p class="step-description">Complete los datos que serán incluidos en los estatutos de su organización. Estos valores son preliminares y serán confirmados en la Asamblea Constitutiva con el Ministro de Fe.</p>

      <form class="wizard-form" id="form-step-3-config">
        <!-- Sección: Asambleas -->
        <div class="config-section">
          <h4 class="config-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Asambleas Ordinarias
          </h4>
          <p class="config-section-desc">Defina los meses en que se realizarán las asambleas ordinarias anuales.</p>

          <div class="form-row form-row-2">
            <div class="form-group">
              <label for="config-mes-asamblea-1">Primer mes de Asamblea <span class="required">*</span></label>
              <select id="config-mes-asamblea-1" name="mesAsamblea1" required>
                <option value="">Seleccione...</option>
                <option value="Enero">Enero</option>
                <option value="Febrero">Febrero</option>
                <option value="Marzo" selected>Marzo</option>
                <option value="Abril">Abril</option>
                <option value="Mayo">Mayo</option>
                <option value="Junio">Junio</option>
                <option value="Julio">Julio</option>
                <option value="Agosto">Agosto</option>
                <option value="Septiembre">Septiembre</option>
                <option value="Octubre">Octubre</option>
                <option value="Noviembre">Noviembre</option>
                <option value="Diciembre">Diciembre</option>
              </select>
            </div>
            <div class="form-group">
              <label for="config-mes-asamblea-2">Segundo mes de Asamblea <span class="required">*</span></label>
              <select id="config-mes-asamblea-2" name="mesAsamblea2" required>
                <option value="">Seleccione...</option>
                <option value="Enero">Enero</option>
                <option value="Febrero">Febrero</option>
                <option value="Marzo">Marzo</option>
                <option value="Abril">Abril</option>
                <option value="Mayo">Mayo</option>
                <option value="Junio">Junio</option>
                <option value="Julio">Julio</option>
                <option value="Agosto">Agosto</option>
                <option value="Septiembre">Septiembre</option>
                <option value="Octubre">Octubre</option>
                <option value="Noviembre" selected>Noviembre</option>
                <option value="Diciembre">Diciembre</option>
              </select>
            </div>
          </div>

          <div class="form-row form-row-2">
            <div class="form-group">
              <label for="config-mes-informe">Mes para Informe de Comisión <span class="required">*</span></label>
              <select id="config-mes-informe" name="mesInforme" required>
                <option value="">Seleccione...</option>
                <option value="Enero">Enero</option>
                <option value="Febrero">Febrero</option>
                <option value="Marzo" selected>Marzo</option>
                <option value="Abril">Abril</option>
                <option value="Mayo">Mayo</option>
                <option value="Junio">Junio</option>
                <option value="Julio">Julio</option>
                <option value="Agosto">Agosto</option>
                <option value="Septiembre">Septiembre</option>
                <option value="Octubre">Octubre</option>
                <option value="Noviembre">Noviembre</option>
                <option value="Diciembre">Diciembre</option>
              </select>
              <small class="form-help">Mes en que se presenta el informe anual</small>
            </div>
            <div class="form-group">
              <label for="config-mes-eleccion">Mes de Elección del Directorio <span class="required">*</span></label>
              <select id="config-mes-eleccion" name="mesEleccion" required>
                <option value="">Seleccione...</option>
                <option value="Enero">Enero</option>
                <option value="Febrero">Febrero</option>
                <option value="Marzo" selected>Marzo</option>
                <option value="Abril">Abril</option>
                <option value="Mayo">Mayo</option>
                <option value="Junio">Junio</option>
                <option value="Julio">Julio</option>
                <option value="Agosto">Agosto</option>
                <option value="Septiembre">Septiembre</option>
                <option value="Octubre">Octubre</option>
                <option value="Noviembre">Noviembre</option>
                <option value="Diciembre">Diciembre</option>
              </select>
              <small class="form-help">Mes en que se elige el Directorio</small>
            </div>
          </div>
        </div>

        <!-- Sección: Cuotas -->
        <div class="config-section">
          <h4 class="config-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Cuotas Sociales (en UTM)
          </h4>
          <p class="config-section-desc">Defina los rangos de cuotas. Para establecimientos subvencionados, la cuota ordinaria máxima es 0.5 UTM anual.</p>

          <div class="form-row">
            <label class="config-subsection-label">Cuota de Incorporación</label>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group">
              <label for="config-cuota-inc-min">Mínimo (UTM)</label>
              <input type="text" id="config-cuota-inc-min" name="cuotaIncMin" placeholder="Ej: 0.1" value="0.1">
            </div>
            <div class="form-group">
              <label for="config-cuota-inc-max">Máximo (UTM)</label>
              <input type="text" id="config-cuota-inc-max" name="cuotaIncMax" placeholder="Ej: 0.5" value="0.5">
            </div>
          </div>

          <div class="form-row">
            <label class="config-subsection-label">Cuota Ordinaria (mensual o anual)</label>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group">
              <label for="config-cuota-ord-min">Mínimo (UTM)</label>
              <input type="text" id="config-cuota-ord-min" name="cuotaOrdMin" placeholder="Ej: 0.25" value="0.25">
            </div>
            <div class="form-group">
              <label for="config-cuota-ord-max">Máximo (UTM)</label>
              <input type="text" id="config-cuota-ord-max" name="cuotaOrdMax" placeholder="Ej: 0.5" value="0.5">
            </div>
          </div>
        </div>

        <!-- Sección: Disolución -->
        <div class="config-section">
          <h4 class="config-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            En caso de Disolución
          </h4>
          <p class="config-section-desc">Indique la entidad que recibirá los bienes en caso de disolución de la organización.</p>

          <div class="form-row">
            <div class="form-group">
              <label for="config-entidad-disolucion">Entidad destinataria de bienes</label>
              <input
                type="text"
                id="config-entidad-disolucion"
                name="entidadDisolucion"
                placeholder="Ej: Corporación Municipal de Renca"
                value="Corporación Municipal de Renca"
              >
              <small class="form-help">Corporación o Fundación con personalidad jurídica vigente</small>
            </div>
          </div>
        </div>
      </form>

      <div class="info-box info-box-warning mt-4">
        <strong>⚠️ Valores Preliminares</strong>
        <p class="mb-0">Estos datos serán confirmados y validados durante la Asamblea Constitutiva con presencia del Ministro de Fe.</p>
      </div>
    </div>
  `;
}

function getStep5HTML_Comision() {
  return `
    <div class="wizard-step-content" id="step-5">
      <h3>Paso 5: Comisión Electoral</h3>
      <p class="step-description">Verificación de la Comisión Electoral designada en la Asamblea Constitutiva.</p>

      <div class="info-box info-box-success mb-4">
        <strong>✅ Comisión Electoral Designada</strong>
        <p class="mb-2">La Comisión Electoral fue designada durante la Asamblea Constitutiva con presencia del Ministro de Fe.</p>
        <small class="text-muted">Según Ley 19.418, la comisión debe tener 3 integrantes con al menos 1 año de antigüedad.</small>
      </div>

      <div class="commission-display-section">
        <div class="commission-header-display">
          <div class="commission-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="commission-header-info">
            <h4>Miembros de la Comisión Electoral</h4>
            <p class="text-muted">Designados en la Asamblea Constitutiva</p>
          </div>
        </div>

        <div class="commission-members-display" id="commission-list">
          <!-- Se renderiza dinámicamente -->
        </div>

        <div class="election-date-display mt-4" id="election-date-display">
          <!-- Se renderiza dinámicamente -->
        </div>
      </div>
    </div>
  `;
}

function getStep4HTML_Estatutos() {
  return `
    <div class="wizard-step-content" id="step-4">
      <h3>Paso 4: Estatutos de la Organización</h3>
      <p class="step-description">Revise los estatutos tipo con los datos ingresados. Estos estatutos serán presentados al Ministro de Fe en la Asamblea Constitutiva para su validación final.</p>

      <div class="statutes-options-row">
        <div class="form-group">
          <label class="radio-option">
            <input type="radio" name="statutes-option" value="template" checked>
            <span class="radio-label">Usar plantilla predefinida</span>
            <span class="radio-badge recommended">Recomendado</span>
          </label>
        </div>

        <div class="form-group">
          <label class="radio-option">
            <input type="radio" name="statutes-option" value="custom">
            <span class="radio-label">Cargar archivo propio</span>
          </label>
        </div>
      </div>

      <div id="statutes-template" class="statutes-content">
        <div class="statutes-editor-header">
          <h4>📜 Estatutos de la Organización</h4>
          <div class="statutes-editor-actions">
            <button type="button" class="btn-statutes-action" id="btn-reset-statutes" title="Restaurar plantilla original">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
              Restaurar
            </button>
          </div>
        </div>
        <div class="statutes-editor-container">
          <textarea id="statutes-editor" class="statutes-editor" placeholder="Los estatutos se generarán automáticamente con los datos de su organización..."></textarea>
        </div>
        <div class="statutes-editor-footer">
          <span class="statutes-char-count">
            <span id="statutes-char-count">0</span> caracteres
          </span>
          <span class="statutes-hint">Puede editar el texto para personalizar los estatutos según sus necesidades</span>
        </div>
      </div>

      <div id="statutes-custom" class="statutes-content" style="display: none;">
        <div class="custom-statutes-upload">
          <div class="upload-area" id="custom-statutes-upload-area">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <p>Arrastre su archivo aquí o haga clic para seleccionar</p>
            <span class="upload-hint">PDF, DOC, DOCX (máx. 10MB)</span>
            <input type="file" id="custom-statutes-file" accept=".pdf,.doc,.docx" class="file-input-hidden">
          </div>
          <div id="custom-statutes-preview" class="custom-statutes-preview" style="display: none;">
            <div class="uploaded-file-info">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <div class="file-details">
                <span id="custom-file-name">archivo.pdf</span>
                <span id="custom-file-size">0 KB</span>
              </div>
              <button type="button" class="btn-remove-file" id="btn-remove-custom-statutes">&times;</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getStep6HTML_Firmas() {
  return `
    <div class="wizard-step-content" id="step-6">
      <h3>Paso 6: Firmas de la Comisión Electoral</h3>
      <p class="step-description">Verificación de las firmas recolectadas durante la Asamblea Constitutiva.</p>

      <div class="info-box info-box-success mb-4">
        <strong>✅ Firmas Recolectadas en Asamblea</strong>
        <p class="mb-2">Las firmas de los miembros de la Comisión Electoral fueron recolectadas durante la Asamblea Constitutiva con presencia del Ministro de Fe.</p>
        <small class="text-muted">Las firmas se incorporarán automáticamente a los documentos oficiales.</small>
      </div>

      <!-- Sección de Firmas Verificadas -->
      <div class="signatures-display-section" id="signature-section">
        <div class="signatures-header-display">
          <div class="signatures-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
          </div>
          <div class="signatures-header-info">
            <h4>Firmas de la Comisión Electoral</h4>
            <p class="text-muted">Recolectadas en la Asamblea Constitutiva</p>
          </div>
          <div class="signatures-status-badge" id="signature-status">
            <span class="status-complete">3/3 firmas verificadas</span>
          </div>
        </div>

        <div class="signatures-members-display" id="members-signatures-list">
          <!-- Se genera dinámicamente -->
        </div>
      </div>
    </div>
  `;
}

function getAutoDocumentItemHTML(type, name, description, required) {
  return `
    <div class="document-item document-auto" data-doc-type="${type}">
      <div class="document-status-indicator">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="document-info">
        <div class="document-header">
          <span class="document-name">${name}</span>
          <span class="badge-auto">Auto-generado</span>
        </div>
        <p class="document-description">${description}</p>
        <div class="document-preview-text" id="preview-${type}"></div>
      </div>
      <div class="document-actions-auto">
        <button class="btn-preview" data-doc-type="${type}" title="Ver documento">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Ver
        </button>
        <button class="btn-edit-doc" data-doc-type="${type}" title="Editar documento">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Editar
        </button>
        <button class="btn-download" data-doc-type="${type}" title="Descargar documento">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function getDocumentItemHTML(type, name, description, required) {
  return `
    <div class="document-item" data-doc-type="${type}">
      <div class="document-info">
        <div class="document-header">
          <span class="document-name">${name}</span>
          ${required ? '<span class="badge-required">Requerido</span>' : '<span class="badge-optional">Opcional</span>'}
        </div>
        <p class="document-description">${description}</p>
        <div class="document-file-name" style="display: none;"></div>
      </div>
      <div class="document-actions">
        <input
          type="file"
          class="document-file-input"
          data-doc-type="${type}"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          style="display: none;"
        >
        <button class="btn-upload" data-doc-type="${type}">
          📎 Subir Archivo
        </button>
        <button class="btn-remove" data-doc-type="${type}" style="display: none;">
          🗑️ Eliminar
        </button>
      </div>
    </div>
  `;
}

function getStep7HTML_Documentos() {
  return `
    <div class="wizard-step-content" id="step-7">
      <h3>Paso 7: Documentos Oficiales</h3>
      <p class="step-description">Los documentos han sido generados con las firmas de la Comisión Electoral. Revise, edite si es necesario y adjunte los documentos adicionales.</p>

      <div class="info-box info-box-success mb-4">
        <strong>✅ Documentos Generados con Firmas</strong>
        <p>Todos los documentos incluyen las firmas digitales de los miembros de la Comisión Electoral.</p>
      </div>

      <div class="documents-list" id="documents-list">
        ${getAutoDocumentItemHTML('ACTA_CONSTITUTIVA', 'Acta Constitutiva', 'Acta de la asamblea constitutiva con firmas', true)}
        ${getAutoDocumentItemHTML('ESTATUTOS', 'Estatutos', 'Estatutos de la organización', true)}
        ${getAutoDocumentItemHTML('REGISTRO_SOCIOS', 'Registro de Socios', 'Listado completo de socios fundadores', true)}
        ${getAutoDocumentItemHTML('DECLARACION_JURADA_PRESIDENTE', 'Declaración Jurada', 'Declaración jurada del presidente de la comisión', true)}
        ${getAutoDocumentItemHTML('ACTA_COMISION_ELECTORAL', 'Acta Comisión Electoral', 'Acta de establecimiento de la comisión con firmas', true)}
      </div>

      <!-- Certificados de Antecedentes por Director -->
      <div class="documents-manual-section mt-4">
        <h4>Certificados de Antecedentes</h4>
        <p class="text-muted mb-3">Suba el certificado de antecedentes de cada miembro de la Comisión Electoral.</p>
        <div id="certificates-list" class="certificates-list">
          <!-- Se genera dinámicamente -->
        </div>
      </div>

      <!-- Fotos de Carnet de Identidad -->
      <div class="documents-manual-section mt-4">
        <h4>📸 Fotos de Carnet de Identidad</h4>
        <p class="text-muted mb-3">Suba las fotos frontales y traseras del carnet de identidad de cada miembro de la Comisión Electoral para validación de firmas.</p>

        <div class="info-box info-box-info mb-3" style="background: #e3f2fd; border-color: #2196f3;">
          <strong style="color: #1565c0;">ℹ️ Información</strong>
          <p style="margin: 8px 0 0; color: #1565c0; font-size: 13px;">
            Las fotos del carnet serán utilizadas por el Ministro de Fe o el administrador para validar las firmas de los directivos.
            Las imágenes deben ser claras y legibles.
          </p>
        </div>

        <div id="id-photos-list" class="id-photos-list">
          <!-- Se genera dinámicamente -->
        </div>
      </div>

      <!-- Otros Documentos -->
      <div class="documents-manual-section mt-4">
        <h4>Otros Documentos (Opcionales)</h4>
        <p class="text-muted mb-3">Puede adjuntar documentos adicionales si lo requiere.</p>
        <div id="other-documents-list" class="other-documents-list">
          <!-- Se genera dinámicamente -->
        </div>
        <button class="btn-add-document" id="btn-add-other-document">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Agregar otro documento
        </button>
      </div>
    </div>
  `;
}

function getStep8HTML_Revision() {
  return `
    <div class="wizard-step-content" id="step-8">
      <h3>Paso 8: Revisión y Envío</h3>
      <p class="step-description">Revise toda la información antes de enviar su solicitud.</p>

      <div class="review-section">
        <h4>📋 Datos de la Organización</h4>
        <div id="review-organization" class="review-content"></div>
      </div>

      <div class="review-section">
        <h4>👥 Miembros Fundadores</h4>
        <div id="review-members" class="review-content"></div>
      </div>

      <div class="review-section">
        <h4>⚖️ Comisión Electoral</h4>
        <div id="review-commission" class="review-content"></div>
      </div>

      <div class="review-section">
        <h4>✍️ Firmas</h4>
        <div id="review-signatures" class="review-content"></div>
      </div>

      <div class="review-section">
        <h4>📜 Estatutos</h4>
        <div id="review-statutes" class="review-content"></div>
      </div>

      <div class="review-section">
        <h4>📄 Documentos</h4>
        <div id="review-documents" class="review-content"></div>
      </div>

      <div class="form-group mt-4">
        <label class="checkbox-label">
          <input type="checkbox" id="terms-acceptance" required>
          <span>Declaro que toda la información proporcionada es verídica y que cumplo con los requisitos establecidos en la Ley 19.418</span>
        </label>
      </div>

      <div class="alert-info mt-4">
        <strong>ℹ️ ¿Qué sigue después?</strong>
        <p>Una vez enviada tu solicitud:</p>
        <ol>
          <li>La municipalidad revisará los documentos (máximo 30 días)</li>
          <li>Recibirás notificaciones sobre el estado de tu solicitud</li>
          <li>Si es aprobada, se enviará al Registro Civil</li>
          <li>Obtendrás tu certificado de vigencia</li>
        </ol>
      </div>
    </div>
  `;
}
