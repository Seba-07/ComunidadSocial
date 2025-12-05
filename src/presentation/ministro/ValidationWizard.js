/**
 * Wizard de Validación de Firmas para Ministro de Fe
 * Flujo paso a paso para validar la asamblea constitutiva
 */

export function openValidationWizard(assignment, org, currentMinistro, callbacks) {
  // Extraer datos de la organización (org puede venir populado del servidor)
  const orgData = org?.organization || org || {};
  const orgName = orgData.organizationName || orgData.name || org?.organizationName || assignment.organizationName || 'Organización';
  const orgType = orgData.organizationType || orgData.type || 'FUNCIONAL';
  // El mínimo de asistentes es ahora solo informativo, no obligatorio
  const minAttendees = orgType === 'JUNTA_VECINOS' ? 50 : 15;

  // Función para calcular si es menor de edad
  const isUnderage = (birthDate) => {
    if (!birthDate) return false; // Si no hay fecha, asumimos que es mayor
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age < 18;
  };

  // Extraer miembros y normalizar
  const rawMembers = org?.members || [];
  const members = rawMembers.map((m, index) => ({
    id: m.id || m._id || `member-${index}`,
    name: m.firstName ? `${m.firstName} ${m.lastName || ''}`.trim() : m.name || 'Sin nombre',
    rut: m.rut || 'Sin RUT',
    birthDate: m.birthDate || null,
    isMinor: isUnderage(m.birthDate),
    signature: m.signature || null
  }));

  // Estado del wizard
  let currentStep = 1;
  const totalSteps = 5;

  // Datos recopilados
  const wizardData = {
    directorio: { president: null, secretary: null, treasurer: null },
    additionalMembers: [],
    comisionElectoral: [],
    attendees: [],
    ministroSignature: null,
    notes: ''
  };

  // Almacén de firmas (guarda las imágenes en base64)
  const signatureData = {};

  // IDs seleccionados (para bloquear en otros selects)
  const selectedIds = new Set();

  // Función para abrir modal de firma grande
  const openSignatureModal = (signatureKey, title, onSave) => {
    const sigModal = document.createElement('div');
    sigModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 250000; padding: 20px; box-sizing: border-box;';
    sigModal.innerHTML = `
      <div style="background: white; border-radius: 20px; max-width: 600px; width: 100%; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.4);">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 20px 24px;">
          <h3 style="margin: 0; font-size: 18px; display: flex; align-items: center; gap: 10px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            </svg>
            ${title}
          </h3>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 13px;">Dibuja tu firma en el área de abajo</p>
        </div>
        <div style="padding: 24px;">
          <div style="border: 3px solid #3b82f6; border-radius: 12px; background: #f8fafc; margin-bottom: 16px;">
            <canvas id="sig-modal-canvas" width="552" height="200" style="width: 100%; height: 200px; display: block; cursor: crosshair; touch-action: none;"></canvas>
          </div>
          <div style="display: flex; gap: 12px; justify-content: space-between;">
            <button type="button" id="sig-clear" style="padding: 12px 24px; border: 2px solid #ef4444; background: white; color: #ef4444; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Limpiar
            </button>
            <div style="display: flex; gap: 12px;">
              <button type="button" id="sig-cancel" style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; color: #374151; border-radius: 10px; font-weight: 600; cursor: pointer;">Cancelar</button>
              <button type="button" id="sig-save" style="padding: 12px 24px; border: none; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Guardar Firma
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(sigModal);

    // Configurar el canvas
    const canvas = sigModal.querySelector('#sig-modal-canvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let hasDrawn = false;

    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if (e.touches) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const startDrawing = (e) => {
      e.preventDefault();
      isDrawing = true;
      hasDrawn = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const stopDrawing = () => { isDrawing = false; };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    // Botón limpiar
    sigModal.querySelector('#sig-clear').addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
    });

    // Botón cancelar
    sigModal.querySelector('#sig-cancel').addEventListener('click', () => {
      sigModal.remove();
    });

    // Botón guardar
    sigModal.querySelector('#sig-save').addEventListener('click', () => {
      if (!hasDrawn) {
        showToast('Debes firmar antes de guardar', 'error');
        return;
      }
      const dataURL = canvas.toDataURL('image/png');
      signatureData[signatureKey] = dataURL;
      if (onSave) onSave(dataURL);
      sigModal.remove();
      renderWizard(); // Re-render para mostrar firma guardada
    });
  };

  // Función para renderizar área de firma (preview o botón para firmar)
  const renderSignatureArea = (signatureKey, label = 'Firma') => {
    const hasSig = signatureData[signatureKey];
    if (hasSig) {
      return `
        <div class="signature-area" data-key="${signatureKey}" style="cursor: pointer;">
          <label style="display: block; font-weight: 600; font-size: 12px; color: #374151; margin-bottom: 6px;">${label}</label>
          <div style="border: 2px solid #10b981; border-radius: 8px; background: #f0fdf4; padding: 8px; position: relative;">
            <img src="${hasSig}" alt="Firma" style="max-height: 60px; display: block; margin: 0 auto;">
            <div style="position: absolute; top: 4px; right: 4px; background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">✓ Firmado</div>
          </div>
          <p style="margin: 6px 0 0; font-size: 11px; color: #059669; text-align: center;">Toca para modificar la firma</p>
        </div>
      `;
    }
    return `
      <div class="signature-area" data-key="${signatureKey}" style="cursor: pointer;">
        <label style="display: block; font-weight: 600; font-size: 12px; color: #374151; margin-bottom: 6px;">${label}</label>
        <div style="border: 2px dashed #3b82f6; border-radius: 8px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 20px; text-align: center; transition: all 0.3s;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="margin-bottom: 8px;">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
          </svg>
          <p style="margin: 0; font-size: 13px; font-weight: 600; color: #3b82f6;">Toca aquí para firmar</p>
        </div>
      </div>
    `;
  };

  // Crear modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 150000; padding: 20px; box-sizing: border-box;';

  // Función para renderizar el wizard
  const renderWizard = () => {
    // Guardar datos del paso actual antes de re-renderizar (para preservar selecciones)
    if (modal.innerHTML) {
      saveCurrentStepData();
    }
    // Actualizar IDs seleccionados antes de renderizar
    updateSelectedIds();

    modal.innerHTML = `
      <div class="wizard-container" style="background: white; border-radius: 20px; max-width: 950px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.3); overflow: hidden;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 20px 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; font-size: 20px; display: flex; align-items: center; gap: 10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                </svg>
                Validación de Asamblea Constitutiva
              </h2>
              <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">${orgName}</p>
            </div>
            <button type="button" id="close-wizard-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Progress Steps -->
          <div style="display: flex; justify-content: space-between; margin-top: 20px; position: relative;">
            <div style="position: absolute; top: 14px; left: 20px; right: 20px; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px;"></div>
            <div style="position: absolute; top: 14px; left: 20px; height: 3px; background: white; border-radius: 2px; transition: width 0.3s; width: ${((currentStep - 1) / (totalSteps - 1)) * 100}%;"></div>
            ${[
              { num: 1, label: 'Directorio' },
              { num: 2, label: 'Adicionales' },
              { num: 3, label: 'Comisión' },
              { num: 4, label: 'Asistentes' },
              { num: 5, label: 'Confirmar' }
            ].map(step => `
              <div style="display: flex; flex-direction: column; align-items: center; z-index: 1;">
                <div style="width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; ${
                  currentStep >= step.num
                    ? 'background: white; color: #1e40af;'
                    : 'background: rgba(255,255,255,0.3); color: white;'
                }">
                  ${currentStep > step.num ? '✓' : step.num}
                </div>
                <span style="font-size: 11px; margin-top: 6px; opacity: ${currentStep >= step.num ? 1 : 0.7};">${step.label}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Content -->
        <div style="flex: 1; overflow-y: auto; padding: 24px;" id="wizard-content">
          ${renderStepContent()}
        </div>

        <!-- Footer -->
        <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: #f9fafb;">
          <button type="button" id="prev-step-btn" style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; color: #374151; border-radius: 10px; font-weight: 600; cursor: pointer; display: ${currentStep === 1 ? 'none' : 'flex'}; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Anterior
          </button>
          <div style="flex: 1;"></div>
          <button type="button" id="next-step-btn" style="padding: 12px 24px; border: none; background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            ${currentStep === totalSteps ? `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Confirmar Validación
            ` : `
              Siguiente
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            `}
          </button>
        </div>
      </div>
    `;

    // Agregar event listeners
    setupEventListeners();
  };

  // Renderizar contenido del paso actual
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1_Directorio();
      case 2: return renderStep2_Adicionales();
      case 3: return renderStep3_Comision();
      case 4: return renderStep4_Asistentes();
      case 5: return renderStep5_Confirmar();
      default: return '';
    }
  };

  // PASO 1: Directorio Provisorio
  const renderStep1_Directorio = () => {
    const roles = [
      { key: 'president', label: 'Presidente/a', icon: '👤', color: '#3b82f6', desc: 'Cargo principal del directorio' },
      { key: 'secretary', label: 'Secretario/a', icon: '📝', color: '#8b5cf6', desc: 'Encargado de actas y documentos' },
      { key: 'treasurer', label: 'Tesorero/a', icon: '💰', color: '#f59e0b', desc: 'Encargado de finanzas' }
    ];

    return `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px; color: #1f2937; font-size: 18px;">Paso 1: Directorio Provisorio</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Selecciona los miembros principales del directorio y recoge sus firmas.</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
        ${roles.map(role => {
          const saved = wizardData.directorio[role.key];
          const hasSig = signatureData[`${role.key}-signature`];
          return `
            <div class="role-card" data-role="${role.key}" style="border: 2px solid ${hasSig ? '#10b981' : '#e5e7eb'}; border-radius: 12px; padding: 20px; transition: all 0.3s; background: ${hasSig ? '#f0fdf4' : 'white'};">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, ${role.color} 0%, ${role.color}dd 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 24px;">${role.icon}</span>
                </div>
                <div>
                  <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #1f2937;">${role.label}</h4>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">${role.desc}</p>
                </div>
              </div>

              <select id="${role.key}-select" class="role-select" data-role="${role.key}" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box; margin-bottom: 12px; cursor: pointer;">
                <option value="">Seleccionar miembro...</option>
                ${members.map(m => {
                  const isSelected = saved?.id === m.id;
                  const isAlreadySelected = selectedIds.has(m.id) && !isSelected;
                  const isMinorMember = m.isMinor;
                  const isDisabled = isAlreadySelected || isMinorMember;
                  let label = `${m.name} - ${m.rut}`;
                  if (isMinorMember) label += ' (Menor de edad)';
                  else if (isAlreadySelected) label += ' (Ya asignado)';
                  return `<option value="${m.id}" data-name="${m.name}" data-rut="${m.rut}" ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled style="color: #9ca3af;"' : ''}>${label}</option>`;
                }).join('')}
                <option value="manual">➕ Ingresar manualmente...</option>
              </select>

              <div id="${role.key}-manual-inputs" style="display: none; margin-bottom: 12px;">
                <input type="text" id="${role.key}-manual-name" placeholder="Nombre completo" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px; box-sizing: border-box; margin-bottom: 8px;">
                <input type="text" id="${role.key}-manual-rut" placeholder="RUT (ej: 12.345.678-9)" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
              </div>

              <div id="${role.key}-info" style="display: ${saved ? 'block' : 'none'}; background: #f0fdf4; padding: 10px; border-radius: 6px; margin-bottom: 12px;">
                <p style="margin: 0; font-size: 12px; color: #166534;"><strong>Nombre:</strong> <span id="${role.key}-name-display">${saved?.name || ''}</span></p>
                <p style="margin: 4px 0 0; font-size: 12px; color: #166534;"><strong>RUT:</strong> <span id="${role.key}-rut-display">${saved?.rut || ''}</span></p>
              </div>

              ${renderSignatureArea(`${role.key}-signature`, `Firma del ${role.label}`)}
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  // PASO 2: Miembros Adicionales
  const renderStep2_Adicionales = () => {
    return `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px; color: #1f2937; font-size: 18px;">Paso 2: Miembros Adicionales del Directorio</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Agrega directores, vocales u otros cargos adicionales (opcional).</p>
      </div>

      <div style="border: 2px dashed #9ca3af; border-radius: 16px; padding: 20px; background: #f9fafb;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 20px;">👥</span>
            </div>
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #374151;">Miembros Adicionales</h4>
              <p style="margin: 2px 0 0; font-size: 12px; color: #6b7280;">Directores, vocales u otros cargos</p>
            </div>
          </div>
          <button type="button" id="btn-add-additional" style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Agregar
          </button>
        </div>

        <div id="additional-members-list" style="display: flex; flex-direction: column; gap: 16px;">
          ${wizardData.additionalMembers.length === 0 ? `
            <p id="no-additional-msg" style="text-align: center; color: #9ca3af; font-size: 14px; padding: 30px 0; margin: 0;">
              No hay miembros adicionales. Este paso es opcional.
            </p>
          ` : wizardData.additionalMembers.map((m, i) => renderAdditionalMemberCard(m, i)).join('')}
        </div>
      </div>

      <div style="background: #eff6ff; padding: 12px; border-radius: 8px; margin-top: 16px; border-left: 4px solid #3b82f6;">
        <p style="margin: 0; font-size: 13px; color: #1e40af;">
          ℹ️ Puedes agregar directores adicionales, vocales u otros cargos según los estatutos de la organización. Cada miembro adicional debe firmar y verificar su identidad.
        </p>
      </div>
    `;
  };

  const renderAdditionalMemberCard = (member, index) => {
    const hasSig = signatureData[`additional-sig-${index}`];
    return `
      <div class="additional-card" data-index="${index}" style="border: 2px solid ${hasSig ? '#10b981' : '#e5e7eb'}; border-radius: 12px; padding: 16px; background: ${hasSig ? '#f0fdf4' : 'white'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; background: #6b7280; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 600;">${index + 1}</div>
            <input type="text" class="additional-cargo" data-index="${index}" value="${member.cargo || ''}" placeholder="Cargo (ej: Director, Vocal)" style="padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px; width: 150px;">
          </div>
          <button type="button" class="btn-remove-additional" data-index="${index}" style="background: #fee2e2; color: #dc2626; border: none; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;">✕ Eliminar</button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <select class="additional-select" data-index="${index}" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px; cursor: pointer;">
            <option value="">Seleccionar miembro...</option>
            ${members.map(m => {
              const isSelected = member.id === m.id;
              const isAlreadySelected = selectedIds.has(m.id) && !isSelected;
              const isMinorMember = m.isMinor;
              const isDisabled = isAlreadySelected || isMinorMember;
              let label = m.name;
              if (isMinorMember) label += ' (Menor de edad)';
              else if (isAlreadySelected) label += ' (Ya asignado)';
              return `<option value="${m.id}" data-name="${m.name}" data-rut="${m.rut}" ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled style="color: #9ca3af;"' : ''}>${label}</option>`;
            }).join('')}
            <option value="manual">➕ Otro...</option>
          </select>
          <input type="text" class="additional-rut" data-index="${index}" value="${member.rut || ''}" placeholder="RUT" style="padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px;" ${member.id ? 'readonly' : ''}>
        </div>

        <div class="additional-manual-inputs" data-index="${index}" style="display: ${member.id === 'manual' ? 'block' : 'none'}; margin-bottom: 12px;">
          <input type="text" class="additional-manual-name" data-index="${index}" value="${member.manualName || ''}" placeholder="Nombre completo" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
        </div>

        ${renderSignatureArea(`additional-sig-${index}`, 'Firma')}
      </div>
    `;
  };

  // PASO 3: Comisión Electoral
  const renderStep3_Comision = () => {
    return `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px; color: #1f2937; font-size: 18px;">Paso 3: Comisión Electoral</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Designa los 3 miembros encargados de organizar futuras elecciones.</p>
      </div>

      <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #059669; border-radius: 16px; padding: 20px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #059669 0%, #047857 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 24px;">🗳️</span>
          </div>
          <div>
            <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #065f46;">Comisión Electoral</h4>
            <p style="margin: 4px 0 0; font-size: 13px; color: #047857;">3 miembros (no pueden ser directivos)</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
          ${[1, 2, 3].map(num => {
            const saved = wizardData.comisionElectoral[num - 1];
            const hasSig = signatureData[`commission-${num}-signature`];
            return `
              <div class="commission-card" data-num="${num}" style="border: 2px solid ${hasSig ? '#059669' : '#10b981'}; border-radius: 12px; padding: 16px; background: ${hasSig ? '#ecfdf5' : 'white'};">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                  <div style="width: 32px; height: 32px; background: #10b981; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">${num}</div>
                  <h5 style="margin: 0; font-size: 14px; font-weight: 600; color: #065f46;">Miembro Comisión</h5>
                </div>

                <select id="commission-${num}-select" class="commission-select" data-num="${num}" style="width: 100%; padding: 10px; border: 2px solid #d1fae5; border-radius: 8px; font-size: 13px; box-sizing: border-box; margin-bottom: 10px; cursor: pointer;">
                  <option value="">Seleccionar miembro...</option>
                  ${members.map(m => {
                    const isSelected = saved?.id === m.id;
                    const isAlreadySelected = selectedIds.has(m.id) && !isSelected;
                    const isMinorMember = m.isMinor;
                    const isDisabled = isAlreadySelected || isMinorMember;
                    let label = `${m.name} - ${m.rut}`;
                    if (isMinorMember) label += ' (Menor de edad)';
                    else if (isAlreadySelected) label += ' (Ya asignado)';
                    return `<option value="${m.id}" data-name="${m.name}" data-rut="${m.rut}" ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled style="color: #9ca3af;"' : ''}>${label}</option>`;
                  }).join('')}
                  <option value="manual">➕ Otro...</option>
                </select>

                <div id="commission-${num}-manual" style="display: none; margin-bottom: 10px;">
                  <input type="text" id="commission-${num}-manual-name" placeholder="Nombre completo" style="width: 100%; padding: 8px; border: 2px solid #d1fae5; border-radius: 6px; font-size: 13px; box-sizing: border-box; margin-bottom: 6px;">
                  <input type="text" id="commission-${num}-manual-rut" placeholder="RUT" style="width: 100%; padding: 8px; border: 2px solid #d1fae5; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
                </div>

                ${renderSignatureArea(`commission-${num}-signature`, `Firma Miembro ${num}`)}
              </div>
            `;
          }).join('')}
        </div>

        <div style="background: #d1fae5; padding: 12px; border-radius: 8px; margin-top: 16px;">
          <p style="margin: 0; font-size: 12px; color: #065f46;">
            ⚠️ Los miembros de la Comisión Electoral no pueden pertenecer al Directorio según la Ley Nº 19.418.
          </p>
        </div>
      </div>
    `;
  };

  // PASO 4: Lista de Asistentes
  const renderStep4_Asistentes = () => {
    // Pre-cargar asistentes si está vacío
    if (wizardData.attendees.length === 0) {
      // Agregar directorio
      ['president', 'secretary', 'treasurer'].forEach(role => {
        const member = wizardData.directorio[role];
        if (member && member.name) {
          wizardData.attendees.push({
            ...member,
            source: 'directorio',
            role: role === 'president' ? 'Presidente' : role === 'secretary' ? 'Secretario' : 'Tesorero',
            signatureFromPrevious: true
          });
        }
      });
      // Agregar adicionales
      wizardData.additionalMembers.forEach(m => {
        if (m.name) {
          wizardData.attendees.push({
            ...m,
            source: 'adicional',
            role: m.cargo,
            signatureFromPrevious: true
          });
        }
      });
      // Agregar comisión
      wizardData.comisionElectoral.forEach((m, i) => {
        if (m && m.name) {
          wizardData.attendees.push({
            ...m,
            source: 'comision',
            role: `Comisión Electoral ${i + 1}`,
            signatureFromPrevious: true
          });
        }
      });
    }

    return `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px; color: #1f2937; font-size: 18px;">Paso 4: Lista de Asistentes (Opcional)</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Los miembros del directorio y comisión ya están incluidos. Agrega asistentes adicionales si lo deseas.</p>
      </div>

      <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border: 2px solid #8b5cf6; border-radius: 16px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 24px;">📋</span>
            </div>
            <div>
              <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #5b21b6;">Asistentes Registrados</h4>
              <p style="margin: 4px 0 0; font-size: 13px; color: #7c3aed;">
                <span id="attendee-count">${wizardData.attendees.length}</span> personas registradas
              </p>
            </div>
          </div>
          <button type="button" id="btn-add-attendee" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Agregar
          </button>
        </div>

        <!-- Lista de asistentes -->
        <div id="attendees-list" style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 8px;">
          ${wizardData.attendees.map((a, i) => renderAttendeeRow(a, i)).join('')}
        </div>

        <div style="display: flex; gap: 12px; margin-top: 16px;">
          <button type="button" id="btn-add-from-members" style="flex: 1; background: white; border: 2px solid #8b5cf6; color: #7c3aed; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">
            👥 Agregar desde lista de miembros
          </button>
          <button type="button" id="btn-add-external" style="flex: 1; background: white; border: 2px solid #8b5cf6; color: #7c3aed; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">
            ➕ Agregar persona externa
          </button>
        </div>
      </div>

      <div style="background: #ede9fe; padding: 12px; border-radius: 8px; margin-top: 16px;">
        <p style="margin: 0; font-size: 12px; color: #5b21b6;">
          📝 Los miembros del directorio y comisión electoral ya están incluidos con sus firmas. Solo agrega a los demás asistentes.
        </p>
      </div>
    `;
  };

  const renderAttendeeRow = (attendee, index) => {
    const isFromPrevious = attendee.signatureFromPrevious;
    const sourceLabel = attendee.source === 'directorio' ? '🏛️' : attendee.source === 'comision' ? '🗳️' : attendee.source === 'adicional' ? '👤' : '';
    const hasSig = signatureData[`attendee-sig-${index}`];

    return `
      <div class="attendee-row" data-index="${index}" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border-radius: 10px; border: 2px solid ${isFromPrevious || hasSig ? '#c4b5fd' : '#e5e7eb'};">
        <div style="width: 28px; height: 28px; background: ${isFromPrevious || hasSig ? '#8b5cf6' : '#6b7280'}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;">
          ${index + 1}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px;">
            ${sourceLabel ? `<span style="font-size: 14px;">${sourceLabel}</span>` : ''}
            <span style="font-weight: 600; color: #1f2937; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${attendee.name}</span>
            ${attendee.role ? `<span style="font-size: 11px; background: #ede9fe; color: #7c3aed; padding: 2px 6px; border-radius: 4px;">${attendee.role}</span>` : ''}
          </div>
          <span style="font-size: 12px; color: #6b7280;">${attendee.rut || 'Sin RUT'}</span>
        </div>
        <div style="width: 140px; flex-shrink: 0;">
          ${isFromPrevious ? `
            <div style="background: #d1fae5; color: #065f46; padding: 8px 12px; border-radius: 6px; font-size: 11px; text-align: center; font-weight: 600;">✓ Firmado</div>
          ` : hasSig ? `
            <div class="signature-area" data-key="attendee-sig-${index}" style="cursor: pointer;">
              <div style="background: #d1fae5; color: #065f46; padding: 8px 12px; border-radius: 6px; font-size: 11px; text-align: center; font-weight: 600;">✓ Firmado</div>
            </div>
          ` : `
            <div class="signature-area" data-key="attendee-sig-${index}" style="cursor: pointer;">
              <div style="border: 2px dashed #c4b5fd; border-radius: 6px; background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); padding: 12px 8px; text-align: center;">
                <p style="margin: 0; font-size: 11px; font-weight: 600; color: #7c3aed;">Toca para firmar</p>
              </div>
            </div>
          `}
        </div>
        ${!isFromPrevious ? `
          <button type="button" class="btn-remove-attendee" data-index="${index}" style="background: #fee2e2; color: #dc2626; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        ` : '<div style="width: 32px;"></div>'}
      </div>
    `;
  };

  // PASO 5: Confirmación
  const renderStep5_Confirmar = () => {
    const dir = wizardData.directorio;
    const add = wizardData.additionalMembers;
    const com = wizardData.comisionElectoral;
    const att = wizardData.attendees;

    return `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px; color: #1f2937; font-size: 18px;">Paso 5: Confirmación y Firma del Ministro de Fe</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Revisa el resumen y firma para completar la validación.</p>
      </div>

      <!-- Resumen -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <!-- Directorio -->
        <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 16px;">
          <h4 style="margin: 0 0 12px; color: #1e40af; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            <span>🏛️</span> Directorio Provisorio
          </h4>
          <div style="font-size: 13px; color: #1e40af;">
            <p style="margin: 0 0 6px;"><strong>Presidente:</strong> ${dir.president?.name || '-'}</p>
            <p style="margin: 0 0 6px;"><strong>Secretario:</strong> ${dir.secretary?.name || '-'}</p>
            <p style="margin: 0;"><strong>Tesorero:</strong> ${dir.treasurer?.name || '-'}</p>
            ${add.length > 0 ? `<p style="margin: 8px 0 0; font-size: 12px; color: #3b82f6;">+ ${add.length} miembro(s) adicional(es)</p>` : ''}
          </div>
        </div>

        <!-- Comisión Electoral -->
        <div style="background: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 16px;">
          <h4 style="margin: 0 0 12px; color: #065f46; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            <span>🗳️</span> Comisión Electoral
          </h4>
          <div style="font-size: 13px; color: #065f46;">
            ${com.map((m, i) => `<p style="margin: ${i === 0 ? '0' : '6px'} 0 0;">${i + 1}. ${m?.name || '-'}</p>`).join('')}
          </div>
        </div>

        <!-- Asistentes -->
        <div style="background: #f5f3ff; border: 2px solid #8b5cf6; border-radius: 12px; padding: 16px;">
          <h4 style="margin: 0 0 12px; color: #5b21b6; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            <span>📋</span> Asistentes
          </h4>
          <div style="font-size: 13px; color: #5b21b6;">
            <p style="margin: 0;"><strong>${att.length}</strong> personas registradas</p>
          </div>
        </div>
      </div>

      <!-- Firma del Ministro -->
      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 16px; color: #1e40af; font-size: 16px; display: flex; align-items: center; gap: 10px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
          </svg>
          Firma del Ministro de Fe
        </h4>
        ${renderSignatureArea('ministro-signature', 'Tu firma como Ministro de Fe')}
        <p style="margin: 12px 0 0; font-size: 12px; color: #1e40af;">
          Firma digital que certifica la validación de identidades y firmas.
        </p>
      </div>

      <!-- Observaciones -->
      <div style="margin-bottom: 20px;">
        <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Observaciones (opcional)</label>
        <textarea id="validation-notes" rows="3" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box; resize: vertical;" placeholder="Notas adicionales sobre la validación...">${wizardData.notes}</textarea>
      </div>

      <!-- Advertencia -->
      <div style="background: #fef3c7; padding: 14px; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; font-size: 13px; color: #92400e;">
          ⚠️ Al confirmar, certificas como Ministro de Fe que has verificado la identidad de los firmantes, la autenticidad de sus firmas y designas el Directorio Provisorio y la Comisión Electoral de la organización.
        </p>
      </div>
    `;
  };

  // Configurar event listeners
  const setupEventListeners = () => {
    // Cerrar wizard
    modal.querySelector('#close-wizard-btn')?.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que deseas cerrar? Se perderán los datos no guardados.')) {
        modal.remove();
      }
    });

    // Navegación
    modal.querySelector('#prev-step-btn')?.addEventListener('click', () => {
      if (currentStep > 1) {
        saveCurrentStepData();
        currentStep--;
        renderWizard();
      }
    });

    modal.querySelector('#next-step-btn')?.addEventListener('click', () => {
      if (validateCurrentStep()) {
        saveCurrentStepData();
        if (currentStep < totalSteps) {
          currentStep++;
          renderWizard();
        } else {
          submitValidation();
        }
      }
    });

    // Click en áreas de firma para abrir modal
    modal.querySelectorAll('.signature-area').forEach(area => {
      area.addEventListener('click', () => {
        const key = area.dataset.key;
        let title = 'Firma';

        // Determinar título según el key
        if (key.includes('president')) title = 'Firma del Presidente/a';
        else if (key.includes('secretary')) title = 'Firma del Secretario/a';
        else if (key.includes('treasurer')) title = 'Firma del Tesorero/a';
        else if (key.includes('commission')) title = 'Firma Miembro Comisión Electoral';
        else if (key.includes('additional')) title = 'Firma Miembro Adicional';
        else if (key.includes('ministro')) title = 'Firma del Ministro de Fe';
        else if (key.includes('attendee')) title = 'Firma de Asistente';

        openSignatureModal(key, title);
      });
    });

    // Event listeners específicos por paso
    setupStepSpecificListeners();
  };

  // Event listeners específicos por paso
  const setupStepSpecificListeners = () => {
    if (currentStep === 1) {
      // Selects del directorio
      modal.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', (e) => {
          const role = e.target.dataset.role;
          const manualInputs = modal.querySelector(`#${role}-manual-inputs`);
          const infoDiv = modal.querySelector(`#${role}-info`);

          if (e.target.value === 'manual') {
            if (manualInputs) manualInputs.style.display = 'block';
            if (infoDiv) infoDiv.style.display = 'none';
          } else if (e.target.value) {
            if (manualInputs) manualInputs.style.display = 'none';
            const option = e.target.selectedOptions[0];
            if (infoDiv) {
              infoDiv.style.display = 'block';
              modal.querySelector(`#${role}-name-display`).textContent = option.dataset.name;
              modal.querySelector(`#${role}-rut-display`).textContent = option.dataset.rut;
            }
          } else {
            if (manualInputs) manualInputs.style.display = 'none';
            if (infoDiv) infoDiv.style.display = 'none';
          }
          updateSelectedIds();
        });
      });
    }

    if (currentStep === 2) {
      // Agregar miembro adicional
      modal.querySelector('#btn-add-additional')?.addEventListener('click', () => {
        wizardData.additionalMembers.push({ cargo: '', id: null, name: '', rut: '', validated: false });
        renderWizard();
      });

      // Eliminar miembro adicional
      modal.querySelectorAll('.btn-remove-additional').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.closest('.btn-remove-additional').dataset.index);
          wizardData.additionalMembers.splice(index, 1);
          renderWizard();
        });
      });
    }

    if (currentStep === 3) {
      // Selects de comisión
      modal.querySelectorAll('.commission-select').forEach(select => {
        select.addEventListener('change', (e) => {
          const num = e.target.dataset.num;
          const manualDiv = modal.querySelector(`#commission-${num}-manual`);
          if (e.target.value === 'manual') {
            if (manualDiv) manualDiv.style.display = 'block';
          } else {
            if (manualDiv) manualDiv.style.display = 'none';
          }
          updateSelectedIds();
        });
      });
    }

    if (currentStep === 4) {
      // Agregar desde lista de miembros
      modal.querySelector('#btn-add-from-members')?.addEventListener('click', () => {
        showMemberSelectionModal();
      });

      // Agregar persona externa
      modal.querySelector('#btn-add-external')?.addEventListener('click', () => {
        showExternalPersonModal();
      });

      // Agregar asistente simple
      modal.querySelector('#btn-add-attendee')?.addEventListener('click', () => {
        showMemberSelectionModal();
      });

      // Eliminar asistente
      modal.querySelectorAll('.btn-remove-attendee').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.closest('.btn-remove-attendee').dataset.index);
          wizardData.attendees.splice(index, 1);
          renderWizard();
        });
      });
    }
  };

  // Actualizar IDs seleccionados (incluye datos guardados y DOM actual)
  const updateSelectedIds = () => {
    selectedIds.clear();

    // Incluir datos guardados en wizardData (para cuando navegamos entre pasos)
    // Directorio guardado
    ['president', 'secretary', 'treasurer'].forEach(role => {
      const saved = wizardData.directorio[role];
      if (saved?.id && saved.id !== 'manual') {
        selectedIds.add(saved.id);
      }
    });
    // Adicionales guardados
    wizardData.additionalMembers.forEach(m => {
      if (m?.id && m.id !== 'manual') {
        selectedIds.add(m.id);
      }
    });
    // Comisión guardada
    wizardData.comisionElectoral.forEach(m => {
      if (m?.id && m.id !== 'manual') {
        selectedIds.add(m.id);
      }
    });

    // También revisar el DOM actual (para selecciones en el paso actual)
    // Directorio DOM
    ['president', 'secretary', 'treasurer'].forEach(role => {
      const select = modal.querySelector(`#${role}-select`);
      if (select && select.value && select.value !== 'manual') {
        selectedIds.add(select.value);
      }
    });
    // Adicionales DOM
    modal.querySelectorAll('.additional-select').forEach(select => {
      if (select.value && select.value !== 'manual') {
        selectedIds.add(select.value);
      }
    });
    // Comisión DOM
    modal.querySelectorAll('.commission-select').forEach(select => {
      if (select.value && select.value !== 'manual') {
        selectedIds.add(select.value);
      }
    });
  };

  // Guardar datos del paso actual
  const saveCurrentStepData = () => {
    if (currentStep === 1) {
      ['president', 'secretary', 'treasurer'].forEach(role => {
        const select = modal.querySelector(`#${role}-select`);
        const signature = signatureData[`${role}-signature`];

        if (select?.value === 'manual') {
          const name = modal.querySelector(`#${role}-manual-name`)?.value.trim();
          const rut = modal.querySelector(`#${role}-manual-rut`)?.value.trim();
          wizardData.directorio[role] = { id: null, name, rut, validated: !!signature, signature, isManual: true };
        } else if (select?.value) {
          const option = select.selectedOptions[0];
          wizardData.directorio[role] = {
            id: select.value,
            name: option.dataset.name,
            rut: option.dataset.rut,
            validated: !!signature,
            signature
          };
        }
      });
    }

    if (currentStep === 2) {
      wizardData.additionalMembers = [];
      modal.querySelectorAll('.additional-card').forEach((card, i) => {
        const cargo = card.querySelector('.additional-cargo')?.value.trim();
        const select = card.querySelector('.additional-select');
        const signature = signatureData[`additional-sig-${i}`];

        let data = { cargo, validated: !!signature, signature };

        if (select?.value === 'manual') {
          data.id = null;
          data.name = card.querySelector('.additional-manual-name')?.value.trim() || '';
          data.rut = card.querySelector('.additional-rut')?.value.trim() || '';
          data.isManual = true;
        } else if (select?.value) {
          const option = select.selectedOptions[0];
          data.id = select.value;
          data.name = option.dataset.name;
          data.rut = option.dataset.rut;
        }

        if (data.name) {
          wizardData.additionalMembers.push(data);
        }
      });
    }

    if (currentStep === 3) {
      wizardData.comisionElectoral = [];
      [1, 2, 3].forEach(num => {
        const select = modal.querySelector(`#commission-${num}-select`);
        const signature = signatureData[`commission-${num}-signature`];

        if (select?.value === 'manual') {
          const name = modal.querySelector(`#commission-${num}-manual-name`)?.value.trim();
          const rut = modal.querySelector(`#commission-${num}-manual-rut`)?.value.trim();
          wizardData.comisionElectoral.push({ id: null, name, rut, validated: !!signature, signature, isManual: true });
        } else if (select?.value) {
          const option = select.selectedOptions[0];
          wizardData.comisionElectoral.push({
            id: select.value,
            name: option.dataset.name,
            rut: option.dataset.rut,
            validated: !!signature,
            signature
          });
        } else {
          wizardData.comisionElectoral.push(null);
        }
      });
    }

    if (currentStep === 4) {
      // Guardar firmas de asistentes que no son del paso anterior
      wizardData.attendees.forEach((att, i) => {
        if (!att.signatureFromPrevious) {
          att.signature = signatureData[`attendee-sig-${i}`];
        }
      });
    }

    if (currentStep === 5) {
      wizardData.notes = modal.querySelector('#validation-notes')?.value.trim() || '';
      wizardData.ministroSignature = signatureData['ministro-signature'];
    }
  };

  // Validar paso actual
  const validateCurrentStep = () => {
    if (currentStep === 1) {
      const roles = ['president', 'secretary', 'treasurer'];
      for (const role of roles) {
        const select = modal.querySelector(`#${role}-select`);
        if (!select?.value) {
          showToast(`Debes seleccionar un ${role === 'president' ? 'Presidente' : role === 'secretary' ? 'Secretario' : 'Tesorero'}`, 'error');
          return false;
        }
        if (!signatureData[`${role}-signature`]) {
          showToast(`Falta la firma del ${role === 'president' ? 'Presidente' : role === 'secretary' ? 'Secretario' : 'Tesorero'}`, 'error');
          return false;
        }
      }
    }

    if (currentStep === 2) {
      const cards = modal.querySelectorAll('.additional-card');
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const cargo = card.querySelector('.additional-cargo')?.value.trim();
        const select = card.querySelector('.additional-select');

        if (select?.value && !cargo) {
          showToast('Debes especificar el cargo de cada miembro adicional', 'error');
          return false;
        }
        if (select?.value && !signatureData[`additional-sig-${i}`]) {
          showToast('Falta la firma de un miembro adicional', 'error');
          return false;
        }
      }
    }

    if (currentStep === 3) {
      for (let num = 1; num <= 3; num++) {
        const select = modal.querySelector(`#commission-${num}-select`);
        if (!select?.value) {
          showToast(`Debes seleccionar el miembro ${num} de la Comisión Electoral`, 'error');
          return false;
        }
        if (!signatureData[`commission-${num}-signature`]) {
          showToast(`Falta la firma del miembro ${num} de la Comisión Electoral`, 'error');
          return false;
        }
      }

      // Verificar que no sean del directorio
      saveCurrentStepData();
      const dirIds = [
        wizardData.directorio.president?.id,
        wizardData.directorio.secretary?.id,
        wizardData.directorio.treasurer?.id,
        ...wizardData.additionalMembers.map(m => m.id)
      ].filter(Boolean);

      for (const cm of wizardData.comisionElectoral) {
        if (cm?.id && dirIds.includes(cm.id)) {
          showToast(`${cm.name} no puede ser parte de la Comisión Electoral porque ya es parte del Directorio`, 'error');
          return false;
        }
      }
    }

    if (currentStep === 4) {
      // Los asistentes son opcionales - solo se requiere directorio y comisión electoral
      // Se muestra advertencia si hay pocos asistentes pero no bloquea
      if (wizardData.attendees.length < minAttendees) {
        console.log(`Advertencia: Solo hay ${wizardData.attendees.length} asistentes de ${minAttendees} recomendados`);
      }
    }

    if (currentStep === 5) {
      if (!signatureData['ministro-signature']) {
        showToast('Debes firmar como Ministro de Fe para validar', 'error');
        return false;
      }
    }

    return true;
  };

  // Modal para seleccionar miembros
  const showMemberSelectionModal = () => {
    const existingIds = new Set(wizardData.attendees.map(a => a.id).filter(Boolean));
    const availableMembers = members.filter(m => !existingIds.has(m.id));

    const selModal = document.createElement('div');
    selModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 200000;';
    selModal.innerHTML = `
      <div style="background: white; border-radius: 16px; max-width: 500px; width: 90%; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
        <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0; font-size: 18px; color: #1f2937;">Seleccionar Miembros</h3>
          <p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">Marca los miembros que asistieron a la asamblea</p>
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 16px;">
          ${availableMembers.length === 0 ? `
            <p style="text-align: center; color: #9ca3af; padding: 20px;">Todos los miembros ya están en la lista</p>
          ` : availableMembers.map(m => `
            <label style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;">
              <input type="checkbox" class="member-checkbox" data-id="${m.id}" data-name="${m.name}" data-rut="${m.rut}" style="width: 20px; height: 20px; accent-color: #8b5cf6;">
              <div>
                <p style="margin: 0; font-weight: 600; color: #1f2937;">${m.name}</p>
                <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">${m.rut}</p>
              </div>
            </label>
          `).join('')}
        </div>
        <div style="padding: 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" id="cancel-selection" style="padding: 10px 20px; border: 2px solid #e5e7eb; background: white; color: #374151; border-radius: 8px; font-weight: 600; cursor: pointer;">Cancelar</button>
          <button type="button" id="confirm-selection" style="padding: 10px 20px; border: none; background: #8b5cf6; color: white; border-radius: 8px; font-weight: 600; cursor: pointer;">Agregar Seleccionados</button>
        </div>
      </div>
    `;

    document.body.appendChild(selModal);

    selModal.querySelector('#cancel-selection').addEventListener('click', () => selModal.remove());
    selModal.querySelector('#confirm-selection').addEventListener('click', () => {
      selModal.querySelectorAll('.member-checkbox:checked').forEach(cb => {
        wizardData.attendees.push({
          id: cb.dataset.id,
          name: cb.dataset.name,
          rut: cb.dataset.rut,
          source: 'member',
          signatureFromPrevious: false
        });
      });
      selModal.remove();
      renderWizard();
    });
  };

  // Modal para persona externa
  const showExternalPersonModal = () => {
    const extModal = document.createElement('div');
    extModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 200000;';
    extModal.innerHTML = `
      <div style="background: white; border-radius: 16px; max-width: 400px; width: 90%; padding: 24px;">
        <h3 style="margin: 0 0 16px; font-size: 18px; color: #1f2937;">Agregar Persona Externa</h3>
        <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">Ingresa los datos de una persona que no está en la lista de miembros</p>
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Nombre Completo</label>
          <input type="text" id="external-name" placeholder="Ej: Juan Pérez González" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">RUT</label>
          <input type="text" id="external-rut" placeholder="Ej: 12.345.678-9" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" id="cancel-external" style="padding: 10px 20px; border: 2px solid #e5e7eb; background: white; color: #374151; border-radius: 8px; font-weight: 600; cursor: pointer;">Cancelar</button>
          <button type="button" id="confirm-external" style="padding: 10px 20px; border: none; background: #8b5cf6; color: white; border-radius: 8px; font-weight: 600; cursor: pointer;">Agregar</button>
        </div>
      </div>
    `;

    document.body.appendChild(extModal);

    extModal.querySelector('#cancel-external').addEventListener('click', () => extModal.remove());
    extModal.querySelector('#confirm-external').addEventListener('click', () => {
      const name = extModal.querySelector('#external-name').value.trim();
      const rut = extModal.querySelector('#external-rut').value.trim();

      if (!name) {
        showToast('Debes ingresar el nombre', 'error');
        return;
      }

      wizardData.attendees.push({
        id: null,
        name,
        rut,
        source: 'external',
        signatureFromPrevious: false,
        isExternal: true
      });

      extModal.remove();
      renderWizard();
    });
  };

  // Enviar validación
  const submitValidation = () => {
    saveCurrentStepData();

    // Confirmación final
    const confirmModal = document.createElement('div');
    confirmModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200000;';
    confirmModal.innerHTML = `
      <div style="background: white; border-radius: 20px; max-width: 450px; width: 90%; padding: 32px; text-align: center;">
        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h3 style="margin: 0 0 16px; font-size: 22px; color: #1f2937;">Confirmar Validación</h3>
        <p style="margin: 0 0 24px; color: #6b7280; font-size: 15px; line-height: 1.6;">
          Esta acción quedará registrada oficialmente como Ministro de Fe.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="cancel-submit" style="padding: 14px 28px; border: 2px solid #e5e7eb; background: white; color: #374151; border-radius: 10px; font-weight: 600; cursor: pointer;">Cancelar</button>
          <button id="confirm-submit" style="padding: 14px 28px; border: none; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Confirmar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    confirmModal.querySelector('#cancel-submit').addEventListener('click', () => confirmModal.remove());
    confirmModal.querySelector('#confirm-submit').addEventListener('click', () => {
      confirmModal.remove();

      // Llamar al callback con los datos
      if (callbacks.onComplete) {
        callbacks.onComplete(wizardData, assignment, org, currentMinistro);
      }

      modal.remove();
    });
  };

  // Toast
  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; top: 24px; right: 24px; z-index: 300000;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
      color: white; padding: 16px 24px; border-radius: 12px;
      font-size: 14px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  // Iniciar
  document.body.appendChild(modal);
  renderWizard();

  return modal;
}
