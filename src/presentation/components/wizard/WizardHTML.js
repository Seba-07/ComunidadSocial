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
              <div class="step-label">Documentos</div>
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
          ${getStep6HTML_Documentos()}
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

      <!-- Info Box explicativo -->
      <div class="info-box info-box-primary mb-4" style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #3b82f6; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <span style="font-size: 24px;">📋</span>
          <div>
            <strong style="color: #1e40af; font-size: 14px;">¿Qué es este paso?</strong>
            <p style="margin: 6px 0 0; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
              Aquí ingresará los datos básicos de su organización: nombre, tipo, dirección y contacto.
              Esta información será usada en todos los documentos oficiales y en la solicitud al Registro Civil.
            </p>
            <p style="margin: 8px 0 0; color: #3b82f6; font-size: 12px;">
              💡 <strong>Tip:</strong> El nombre debe ser único y representar claramente a su comunidad.
            </p>
          </div>
        </div>
      </div>

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
            <div class="contact-preference-options">
              <label class="contact-option">
                <input type="radio" name="contactPreference" value="phone" checked required>
                <span class="contact-option-content">
                  <span class="contact-icon">📞</span>
                  <span class="contact-text">Teléfono</span>
                </span>
              </label>
              <label class="contact-option">
                <input type="radio" name="contactPreference" value="email" required>
                <span class="contact-option-content">
                  <span class="contact-icon">📧</span>
                  <span class="contact-text">Correo Electrónico</span>
                </span>
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

      <!-- Info Box explicativo -->
      <div class="info-box info-box-primary mb-4" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #22c55e; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <span style="font-size: 24px;">👥</span>
          <div>
            <strong style="color: #166534; font-size: 14px;">¿Qué son los Miembros Fundadores?</strong>
            <p style="margin: 6px 0 0; color: #166534; font-size: 13px; line-height: 1.5;">
              Son las personas que serán los <strong>primeros socios oficiales</strong> de su organización y quedarán registrados en el acta constitutiva.
            </p>
            <p style="margin: 8px 0 0; color: #15803d; font-size: 12px;">
              📌 <strong>Requisitos según Ley 19.418:</strong> Mínimo 15 personas mayores de 14 años que residan en la unidad vecinal.
            </p>
            <p style="margin: 4px 0 0; color: #15803d; font-size: 12px;">
              ⚠️ <strong>Importante:</strong> Para el Directorio y Comisión Electoral se requieren al menos 6 miembros <strong>mayores de 18 años</strong>.
            </p>
          </div>
        </div>
      </div>

      <!-- Info Box ASISTENCIA -->
      <div class="info-box info-box-warning mb-4" style="background: linear-gradient(135deg, #fefce8 0%, #fef08a 100%); border: 2px solid #eab308; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <span style="font-size: 24px;">📢</span>
          <div>
            <strong style="color: #854d0e; font-size: 14px;">¿Quién debe asistir a la Asamblea Constitutiva?</strong>
            <p style="margin: 6px 0 0; color: #854d0e; font-size: 13px; line-height: 1.5;">
              <strong style="color: #dc2626;">❌ Los miembros fundadores NO están obligados a asistir</strong> a la Asamblea Constitutiva con el Ministro de Fe.
            </p>
            <p style="margin: 6px 0 0; color: #854d0e; font-size: 13px; line-height: 1.5;">
              <strong style="color: #16a34a;">✅ SÍ deben asistir OBLIGATORIAMENTE:</strong> El Directorio Provisorio (Presidente, Secretario, Tesorero) y los 3 miembros de la Comisión Electoral.
            </p>
          </div>
        </div>
      </div>

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

      <!-- Info Box explicativo -->
      <div class="info-box info-box-primary mb-4" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #f59e0b; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <span style="font-size: 24px;">⚙️</span>
          <div>
            <strong style="color: #92400e; font-size: 14px;">¿Qué es la Configuración de Estatutos?</strong>
            <p style="margin: 6px 0 0; color: #92400e; font-size: 13px; line-height: 1.5;">
              Aquí definirá las reglas internas de su organización: cuándo se realizarán las asambleas,
              las cuotas de los socios y qué pasará con los bienes en caso de disolución.
            </p>
            <p style="margin: 8px 0 0; color: #b45309; font-size: 12px;">
              💡 <strong>Importante:</strong> Estos valores serán presentados en la Asamblea Constitutiva y pueden ser modificados allí si los socios lo deciden.
            </p>
          </div>
        </div>
      </div>

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

export function getStep5HTML_Comision() {
  return `
    <div class="wizard-step-content" id="step-5">
      <h3>Paso 5: Directorio Provisorio y Comisión Electoral</h3>
      <p class="step-description">Designe a los miembros del Directorio Provisorio y la Comisión Electoral que participarán en la Asamblea Constitutiva.</p>

      <!-- Info Box explicativo principal -->
      <div class="info-box info-box-primary mb-4" style="background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%); border: 1px solid #f97316; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <span style="font-size: 24px;">⚠️</span>
          <div>
            <strong style="color: #c2410c; font-size: 14px;">¿Por qué es "Provisorio"?</strong>
            <p style="margin: 6px 0 0; color: #c2410c; font-size: 13px; line-height: 1.5;">
              Según la <strong>Ley 19.418</strong>, el Directorio Provisorio que se designa ahora solo tiene la función de
              constituir legalmente la organización. <strong>Una vez obtenida la personalidad jurídica</strong>, se debe
              realizar una nueva elección para elegir el Directorio Definitivo.
            </p>
            <p style="margin: 8px 0 0; color: #ea580c; font-size: 12px;">
              📅 <strong>Plazo:</strong> El Directorio Definitivo debe ser elegido dentro de los 90 días siguientes a la obtención de la personalidad jurídica.
            </p>
          </div>
        </div>
      </div>

      <!-- Info Box IMPORTANTE: Asistencia obligatoria -->
      <div class="info-box info-box-danger mb-4" style="background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%); border: 2px solid #ef4444; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <span style="font-size: 24px;">🚨</span>
          <div>
            <strong style="color: #991b1b; font-size: 14px;">ASISTENCIA OBLIGATORIA A LA ASAMBLEA</strong>
            <p style="margin: 6px 0 0; color: #991b1b; font-size: 13px; line-height: 1.5;">
              <strong>Todos los miembros del Directorio Provisorio y la Comisión Electoral DEBEN asistir</strong>
              a la Asamblea Constitutiva con el Ministro de Fe. Sin su presencia, no se podrá realizar la asamblea.
            </p>
            <p style="margin: 8px 0 0; color: #dc2626; font-size: 12px;">
              ✅ <strong>Deben asistir:</strong> Presidente, Secretario, Tesorero + 3 miembros de la Comisión Electoral (6 personas)
            </p>
          </div>
        </div>
      </div>

      <!-- SECCIÓN 1: DIRECTORIO PROVISORIO (Dinámico según tipo de organización) -->
      <div class="commission-section mb-4">
        <div class="commission-section-header" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 1px solid #3b82f6; border-radius: 12px 12px 0 0; padding: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 28px;">👔</span>
            <div>
              <h4 style="margin: 0; color: #1e40af; font-size: 16px;">Directorio Provisorio</h4>
              <p style="margin: 4px 0 0; color: #3b82f6; font-size: 13px;" id="directorio-info-text">
                Estos cargos son solo para constituir la organización. El directorio definitivo se elegirá después.
              </p>
              <p style="margin: 4px 0 0; color: #1e40af; font-size: 12px; font-weight: 600;" id="directorio-required-count">
                <!-- Se actualiza dinámicamente con la cantidad de miembros requeridos -->
              </p>
            </div>
          </div>
        </div>

        <div style="border: 1px solid #3b82f6; border-top: none; border-radius: 0 0 12px 12px; padding: 20px; background: #fff;">
          <form id="form-directorio-provisorio">
            <!-- Los cargos del directorio se generan dinámicamente según el tipo de organización -->
            <div id="directorio-cargos-container">
              <!-- Se renderiza dinámicamente en initializeStep5_Comision() -->
            </div>
          </form>
        </div>
      </div>

      <!-- SECCIÓN 2: COMISIÓN ELECTORAL -->
      <div class="commission-section mb-4">
        <div class="commission-section-header" style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border: 1px solid #22c55e; border-radius: 12px 12px 0 0; padding: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 28px;">🗳️</span>
            <div>
              <h4 style="margin: 0; color: #166534; font-size: 16px;">Comisión Electoral</h4>
              <p style="margin: 4px 0 0; color: #22c55e; font-size: 13px;">
                Esta comisión supervisará la elección del Directorio Definitivo después de obtener la personalidad jurídica.
              </p>
            </div>
          </div>
        </div>

        <div style="border: 1px solid #22c55e; border-top: none; border-radius: 0 0 12px 12px; padding: 20px; background: #fff;">
          <div class="info-box" style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <p style="margin: 0; color: #166534; font-size: 13px;">
              📌 <strong>Requisito Ley 19.418:</strong> La Comisión Electoral debe tener <strong>3 integrantes</strong> que sean socios.
              Sus funciones son: calificar las elecciones, resolver reclamos y proclamar a los elegidos.
            </p>
          </div>

          <form id="form-comision-electoral">
            <!-- Miembro 1 -->
            <div class="comision-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="background: #22c55e; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">MIEMBRO 1</span>
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label for="com-miembro1">Seleccionar Miembro <span class="required">*</span></label>
                  <select id="com-miembro1" name="comisionMiembro1" required class="member-select">
                    <option value="">Seleccione un miembro fundador...</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="cert-com1">Certificado de Antecedentes <span class="required">*</span></label>
                  <div class="file-upload-wrapper">
                    <input type="file" id="cert-com1" name="certComision1" accept=".pdf,.jpg,.jpeg,.png" class="file-input-hidden">
                    <button type="button" class="btn-upload-cert" onclick="document.getElementById('cert-com1').click()">
                      📎 Subir Certificado
                    </button>
                    <span class="file-name-display" id="cert-com1-name"></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Miembro 2 -->
            <div class="comision-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="background: #22c55e; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">MIEMBRO 2</span>
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label for="com-miembro2">Seleccionar Miembro <span class="required">*</span></label>
                  <select id="com-miembro2" name="comisionMiembro2" required class="member-select">
                    <option value="">Seleccione un miembro fundador...</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="cert-com2">Certificado de Antecedentes <span class="required">*</span></label>
                  <div class="file-upload-wrapper">
                    <input type="file" id="cert-com2" name="certComision2" accept=".pdf,.jpg,.jpeg,.png" class="file-input-hidden">
                    <button type="button" class="btn-upload-cert" onclick="document.getElementById('cert-com2').click()">
                      📎 Subir Certificado
                    </button>
                    <span class="file-name-display" id="cert-com2-name"></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Miembro 3 -->
            <div class="comision-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="background: #22c55e; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">MIEMBRO 3</span>
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label for="com-miembro3">Seleccionar Miembro <span class="required">*</span></label>
                  <select id="com-miembro3" name="comisionMiembro3" required class="member-select">
                    <option value="">Seleccione un miembro fundador...</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="cert-com3">Certificado de Antecedentes <span class="required">*</span></label>
                  <div class="file-upload-wrapper">
                    <input type="file" id="cert-com3" name="certComision3" accept=".pdf,.jpg,.jpeg,.png" class="file-input-hidden">
                    <button type="button" class="btn-upload-cert" onclick="document.getElementById('cert-com3').click()">
                      📎 Subir Certificado
                    </button>
                    <span class="file-name-display" id="cert-com3-name"></span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Resumen de certificados (dinámico) -->
      <div class="certificates-summary" style="background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%); border: 1px solid #ef4444; border-radius: 12px; padding: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">📄</span>
          <div>
            <strong style="color: #991b1b; font-size: 14px;">Certificados de Antecedentes Requeridos</strong>
            <p style="margin: 6px 0 0; color: #991b1b; font-size: 13px; line-height: 1.5;" id="cert-required-text">
              Debe subir el <strong>certificado de antecedentes</strong> de cada miembro del Directorio Provisorio
              y la Comisión Electoral. Puede obtenerlos en <a href="https://www.registrocivil.cl" target="_blank" style="color: #dc2626;">www.registrocivil.cl</a>
            </p>
            <div id="cert-progress" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
              <!-- Los badges se generan dinámicamente según el tipo de organización -->
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function getStep4HTML_Estatutos() {
  return `
    <div class="wizard-step-content" id="step-4">
      <h3>Paso 4: Estatutos de la Organización</h3>
      <p class="step-description">Revise los estatutos tipo con los datos ingresados. Estos estatutos serán presentados al Ministro de Fe en la Asamblea Constitutiva para su validación final.</p>

      <!-- Info Box explicativo -->
      <div class="info-box info-box-primary mb-4" style="background: linear-gradient(135deg, #fae8ff 0%, #f5d0fe 100%); border: 1px solid #d946ef; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <span style="font-size: 24px;">📜</span>
          <div>
            <strong style="color: #86198f; font-size: 14px;">¿Qué son los Estatutos?</strong>
            <p style="margin: 6px 0 0; color: #86198f; font-size: 13px; line-height: 1.5;">
              Los estatutos son el <strong>documento legal</strong> que define las reglas, derechos y obligaciones de su organización.
              Este documento será inscrito en el Registro Civil junto con el acta constitutiva.
            </p>
            <p style="margin: 8px 0 0; color: #a21caf; font-size: 12px;">
              📌 <strong>Recomendación:</strong> Use la plantilla predefinida que cumple con todos los requisitos legales. Puede personalizarla según sus necesidades.
            </p>
          </div>
        </div>
      </div>

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
      <h3>Paso 6: Firmas del Directorio Provisorio</h3>
      <p class="step-description">Registre las firmas de los miembros del Directorio Provisorio y la Comisión Electoral.</p>

      <!-- Info Box explicativo -->
      <div class="info-box info-box-primary mb-4" style="background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); border: 1px solid #0ea5e9; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <span style="font-size: 24px;">✍️</span>
          <div>
            <strong style="color: #0369a1; font-size: 14px;">¿Para qué son las firmas?</strong>
            <p style="margin: 6px 0 0; color: #0369a1; font-size: 13px; line-height: 1.5;">
              Las firmas de los directivos se incluirán en el <strong>Acta Constitutiva</strong> y demás documentos oficiales
              que serán presentados al Registro Civil para obtener la personalidad jurídica.
            </p>
            <p style="margin: 8px 0 0; color: #0284c7; font-size: 12px;">
              ✏️ <strong>Tip:</strong> Use un lápiz stylus o el dedo para firmar. Puede borrar y volver a firmar si no queda bien.
            </p>
          </div>
        </div>
      </div>

      <div class="info-box info-box-success mb-4">
        <strong>✅ Firmas Requeridas</strong>
        <p class="mb-2">Las firmas de los miembros del Directorio Provisorio y la Comisión Electoral serán verificadas por el Ministro de Fe en la Asamblea Constitutiva.</p>
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
        ">Listo</span>
      </div>

      <!-- Botones de acción compactos -->
      <div style="display: flex; gap: 8px; flex-shrink: 0;">
        <button class="btn-preview" data-doc-type="${type}" style="
          padding: 8px 14px;
          background: #3b82f6;
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
        <button class="btn-edit-doc" data-doc-type="${type}" style="
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
        <button class="btn-download" data-doc-type="${type}" style="
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

export function getStep6HTML_Documentos() {
  return `
    <div class="wizard-step-content" id="step-6">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        ">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <h3 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #1f2937;">Borradores de Documentos</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Revise los documentos que se oficializarán el día de la Asamblea</p>
      </div>

      <!-- Info Box importante -->
      <div style="
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        border: 2px solid #f59e0b;
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 24px;
      ">
        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="
            width: 44px;
            height: 44px;
            background: white;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          ">
            <span style="font-size: 24px;">📋</span>
          </div>
          <div>
            <h4 style="margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #92400e;">Estos son borradores para su revisión</h4>
            <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
              Los documentos mostrados son <strong>proyectos preliminares</strong> que serán oficializados el día de la Asamblea Constitutiva.
              Las fechas, firmas y otros datos pendientes se completarán en presencia del Ministro de Fe.
            </p>
          </div>
        </div>
      </div>

      <!-- Título de sección -->
      <div style="
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 2px solid #e5e7eb;
      ">
        <span style="font-size: 20px;">📄</span>
        <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #374151;">Documentos Generados</h4>
        <span style="
          background: #3b82f6;
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        ">5 documentos</span>
      </div>

      <!-- Lista de documentos -->
      <div class="documents-list" id="documents-list" style="
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 24px;
      ">
        ${getAutoDocumentItemHTML('ACTA_CONSTITUTIVA', 'Acta Constitutiva', 'Proyecto del acta de la asamblea constitutiva', true)}
        ${getAutoDocumentItemHTML('ESTATUTOS', 'Estatutos', 'Proyecto de estatutos para votación', true)}
        ${getAutoDocumentItemHTML('REGISTRO_SOCIOS', 'Registro de Socios', 'Listado preliminar de socios fundadores', true)}
        ${getAutoDocumentItemHTML('DECLARACION_JURADA_PRESIDENTE', 'Declaración Jurada', 'Modelo de declaración del presidente', true)}
        ${getAutoDocumentItemHTML('ACTA_COMISION_ELECTORAL', 'Acta Comisión Electoral', 'Proyecto del acta de la comisión', true)}
      </div>

      <!-- Otros Documentos -->
      <div style="
        background: #f9fafb;
        border: 2px dashed #d1d5db;
        border-radius: 12px;
        padding: 20px;
      ">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
          <span style="font-size: 18px;">📎</span>
          <h4 style="margin: 0; font-size: 15px; font-weight: 600; color: #374151;">Otros Documentos (Opcionales)</h4>
        </div>
        <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px;">
          Si tiene documentos adicionales que desea incluir, puede adjuntarlos aquí.
        </p>
        <div id="other-documents-list" class="other-documents-list" style="margin-bottom: 12px;">
          <!-- Se genera dinámicamente -->
        </div>
        <button class="btn-add-document" id="btn-add-other-document" style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: white;
          border: 2px solid #d1d5db;
          border-radius: 8px;
          color: #374151;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Agregar documento
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

      <!-- Info Box explicativo -->
      <div class="info-box info-box-primary mb-4" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #f59e0b; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <span style="font-size: 24px;">🔍</span>
          <div>
            <strong style="color: #92400e; font-size: 14px;">Último paso antes de enviar</strong>
            <p style="margin: 6px 0 0; color: #92400e; font-size: 13px; line-height: 1.5;">
              Revise cuidadosamente toda la información ingresada. Al enviar la solicitud, se creará un <strong>borrador</strong>
              que podrá editar hasta que se agende la cita con el Ministro de Fe.
            </p>
            <p style="margin: 8px 0 0; color: #b45309; font-size: 12px;">
              ⚠️ <strong>Importante:</strong> La solicitud del Ministro de Fe se realizará <strong>después</strong> de completar este paso.
              La Municipalidad coordinará la fecha de la Asamblea Constitutiva.
            </p>
          </div>
        </div>
      </div>

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
