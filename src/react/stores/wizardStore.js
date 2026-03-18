import { create } from 'zustand';
import { apiService } from '@services/ApiService.js';
import tenant from '../../config/tenant.js';

const STORAGE_KEY = 'wizard_progress';
const EXPIRY_DAYS = 7;
let _saveTimer = null;

const initialFormData = {
  organization: {
    type: '', name: '', description: '', objectives: '', address: '', street: '',
    streetNumber: '', postalCode: '', region: 'Región Metropolitana',
    commune: tenant.communeName, neighborhood: '', email: '', phone: '', contactPreference: 'email'
  },
  members: [],
  config: {
    asambleas: ['Marzo', 'Noviembre'],
    monedaCuota: 'UTM',
    cuotaMin: 0.1,
    cuotaMax: 0.5,
    tipoEntidadDisolucion: '',
    beneficiarioDisolucion: '',
    duracionMandato: 2,
    metodoCitacion: 'carta_certificada',
    diasAnticipacion: 10,
    cuotaIncorporacion: 0.5,
    accountReviewMonth: 'Marzo',
    rutDisolucion: ''
  },
  estatutos: { type: 'template', content: null, customFile: null, editedArticles: null },
  directorioProvisorio: {},
  comisionElectoral: { members: [], electionDate: null },
  certificates: {},
  inhabilityCertificates: {},
  documents: {},
  assemblySchedule: { date: null, time: null, address: '' }
};

export const useWizardStore = create((set, get) => ({
  currentStep: 0,
  formData: { ...initialFormData },
  organizationTypes: [],
  isSubmitting: false,
  existingOrgId: null,
  error: null,
  templateConfig: null,

  setStep(step) {
    set({ currentStep: step });
    get().saveProgress();
  },

  updateFormData(section, data) {
    set(state => ({
      formData: {
        ...state.formData,
        [section]: typeof data === 'function'
          ? data(state.formData[section])
          : { ...(typeof state.formData[section] === 'object' && !Array.isArray(state.formData[section]) ? state.formData[section] : {}), ...data }
      }
    }));
    get()._debouncedSave();
  },

  setFormDataField(section, value) {
    set(state => ({
      formData: { ...state.formData, [section]: value }
    }));
    get()._debouncedSave();
  },

  _debouncedSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => get().saveProgress(), 1000);
  },

  addMember(member) {
    set(state => ({
      formData: {
        ...state.formData,
        members: [...state.formData.members, member]
      }
    }));
  },

  removeMember(index) {
    set(state => ({
      formData: {
        ...state.formData,
        members: state.formData.members.filter((_, i) => i !== index)
      }
    }));
  },

  updateMember(index, data) {
    set(state => ({
      formData: {
        ...state.formData,
        members: state.formData.members.map((m, i) => i === index ? { ...m, ...data } : m)
      }
    }));
  },

  saveProgress() {
    try {
      const { currentStep, formData, existingOrgId, templateConfig } = get();
      const saved = {
        currentStep, formData, existingOrgId, templateConfig,
        savedAt: new Date().toISOString()
      };
      // Try saving with full cert data first
      const json = JSON.stringify(saved);
      try {
        localStorage.setItem(STORAGE_KEY, json);
      } catch {
        // localStorage quota exceeded — retry without base64 cert data
        const lightCerts = {};
        for (const [k, v] of Object.entries(formData.certificates || {})) {
          lightCerts[k] = { name: v?.name || 'certificado.pdf', _hasData: true };
        }
        const lightInhCerts = {};
        for (const [k, v] of Object.entries(formData.inhabilityCertificates || {})) {
          lightInhCerts[k] = { name: v?.name || 'certificado.pdf', _hasData: true };
        }
        saved.formData = { ...formData, certificates: lightCerts, inhabilityCertificates: lightInhCerts };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      }
    } catch { /* localStorage unavailable */ }
  },

  loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);

      // Check expiry
      const savedDate = new Date(saved.savedAt);
      const now = new Date();
      const daysDiff = (now - savedDate) / (1000 * 60 * 60 * 24);
      if (daysDiff > EXPIRY_DAYS) {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }

      const restoredOrg = {
        ...initialFormData.organization,
        ...(saved.formData?.organization || {}),
        commune: tenant.communeName || initialFormData.organization.commune,
        region: initialFormData.organization.region
      };
      set({
        currentStep: saved.currentStep || 0,
        formData: {
          ...initialFormData,
          ...saved.formData,
          organization: restoredOrg,
          config: { ...initialFormData.config, ...(saved.formData?.config || {}) }
        },
        existingOrgId: saved.existingOrgId || null,
        templateConfig: saved.templateConfig || null
      });
      return true;
    } catch {
      return false;
    }
  },

  clearProgress() {
    localStorage.removeItem(STORAGE_KEY);
    set({ currentStep: 0, formData: { ...initialFormData }, existingOrgId: null, templateConfig: null });
  },

  async loadFromOrganization(orgId) {
    try {
      const data = await apiService.getOrganization(orgId);
      const org = data.organization || data;
      const dir = org.provisionalDirectorio || {};
      const config = org.config || {};
      const ce = org.electoralCommission || org.comisionElectoral || [];

      // Map server English keys → wizard Spanish cargo IDs
      const FIELD_TO_CARGO = {
        president: 'presidente', secretary: 'secretario',
        treasurer: 'tesorero', vicePresident: 'vicepresidente'
      };
      const mappedDir = {};
      console.log('[loadFromOrg] provisionalDirectorio keys:', Object.keys(dir));
      console.log('[loadFromOrg] provisionalDirectorio:', JSON.stringify(dir, (k, v) => typeof v === 'string' && v.length > 80 ? v.slice(0, 40) + '...' : v, 2));
      for (const [key, val] of Object.entries(dir)) {
        if (!val || typeof val !== 'object') { console.log('[loadFromOrg] skip (not object):', key, typeof val); continue; }
        if (['additionalMembers', 'designatedAt', 'type', 'expiresAt', '_id', '__v'].includes(key)) { console.log('[loadFromOrg] skip (meta):', key); continue; }
        const cargoId = FIELD_TO_CARGO[key] || key;
        mappedDir[cargoId] = { ...val, cargo: cargoId };
        console.log('[loadFromOrg] mapped:', key, '→', cargoId, '| rut:', val.rut, '| name:', val.firstName);
      }
      // Also map additionalMembers back to their cargo keys
      if (Array.isArray(dir.additionalMembers)) {
        for (const m of dir.additionalMembers) {
          if (m && m.cargo) {
            mappedDir[m.cargo] = { ...m };
          }
        }
      }

      // Restore certificates from server's certificatesStep5
      // cert.memberId can be a RUT (new format) or a cargo key (old format like 'presidente')
      const FIELD_TO_CARGO_REV = { president: 'presidente', secretary: 'secretario', treasurer: 'tesorero', vicePresident: 'vicepresidente' };
      const restoredCerts = {};
      // Restore inhability certificates from directorio members' inhabilityCertificate field
      const restoredInhCerts = {};
      for (const [cargoId, person] of Object.entries(mappedDir)) {
        if (person.inhabilityCertificate) {
          restoredInhCerts[cargoId] = {
            name: 'certificado_inhabilidad.pdf',
            data: person.inhabilityCertificate.startsWith('data:') ? person.inhabilityCertificate : `data:application/pdf;base64,${person.inhabilityCertificate}`
          };
          console.log('[loadFromOrg] restored inhCert for:', cargoId);
        }
      }

      console.log('[loadFromOrg] mappedDir result:', Object.keys(mappedDir));
      console.log('[loadFromOrg] certificatesStep5 count:', (org.certificatesStep5 || []).length);
      console.log('[loadFromOrg] inhCerts restored:', Object.keys(restoredInhCerts));
      if (Array.isArray(org.certificatesStep5)) {
        for (const cert of org.certificatesStep5) {
          const mid = cert.memberId || '';
          let matchedCargo = null;

          // 1) Direct cargo key match (old format: memberId = 'presidente')
          if (mappedDir[mid]) {
            matchedCargo = mid;
          }
          // 2) English key match (memberId = 'president')
          if (!matchedCargo && FIELD_TO_CARGO_REV[mid]) {
            const spanishKey = FIELD_TO_CARGO_REV[mid];
            if (mappedDir[spanishKey]) matchedCargo = spanishKey;
          }
          // 3) RUT match (new format: memberId = '10.234.567-3')
          if (!matchedCargo) {
            const certRut = mid.replace(/\./g, '').replace(/-/g, '');
            for (const [cargoId, person] of Object.entries(mappedDir)) {
              const personRut = (person.rut || '').replace(/\./g, '').replace(/-/g, '');
              if (personRut && personRut === certRut) { matchedCargo = cargoId; break; }
            }
          }

          console.log('[loadFromOrg] cert match:', cert.memberId, '→ cargo:', matchedCargo, '| hasCert:', !!cert.certificate);
          if (matchedCargo && cert.certificate) {
            restoredCerts[matchedCargo] = {
              name: cert.memberName || 'certificado.pdf',
              data: cert.certificate.startsWith('data:') ? cert.certificate : `data:application/pdf;base64,${cert.certificate}`
            };
          }
        }
      }

      set({
        currentStep: 0,
        existingOrgId: orgId,
        formData: {
          ...initialFormData,
          organization: {
            type: org.organizationType || '',
            name: org.organizationName || '',
            description: org.description || '',
            objectives: org.objectives || '',
            address: org.address || '',
            street: org.street || '',
            streetNumber: org.streetNumber || '',
            postalCode: org.postalCode || '',
            region: initialFormData.organization.region,
            commune: tenant.communeName || initialFormData.organization.commune,
            neighborhood: org.unidadVecinal || '',
            email: org.contactEmail || '',
            phone: org.contactPhone || '',
            contactPreference: org.contactPreference || 'email',
          },
          members: (org.members || []).map(m => ({
            firstName: m.firstName || '',
            segundoNombre: m.segundoNombre || '',
            lastName: m.lastName || '',
            apellidoMaterno: m.apellidoMaterno || '',
            rut: m.rut || '',
            birthDate: m.birthDate || '',
            address: m.address || '',
            email: m.email || '',
            phone: m.phone || '',
          })),
          config: {
            ...initialFormData.config,
            ...config,
          },
          estatutos: org.estatutos
            ? { type: typeof org.estatutos === 'string' ? org.estatutos : 'template', content: null, customFile: null }
            : { type: 'template', content: null, customFile: null },
          directorioProvisorio: mappedDir,
          comisionElectoral: { members: ce, electionDate: null },
          certificates: restoredCerts,
          inhabilityCertificates: restoredInhCerts,
          documents: {},
          assemblySchedule: {
            date: org.electionDate || null,
            time: org.electionTime || null,
            address: org.assemblyAddress || '',
          },
        },
      });

      // Also fetch template config if org type is set
      if (org.organizationType) {
        get().fetchTemplateConfig(org.organizationType).catch(() => {});
      }

      get().saveProgress();
      return true;
    } catch (error) {
      console.error('Error loading org into wizard:', error);
      return false;
    }
  },

  async fetchOrganizationTypes() {
    try {
      const data = await apiService.getOrganizationTypesGrouped();
      set({ organizationTypes: data.types || data || [] });
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  async fetchTemplateConfig(tipo) {
    try {
      const config = await apiService.getEstatutoTemplateConfig(tipo);
      set({ templateConfig: config });
      return config;
    } catch (error) {
      console.error('Error fetching template config:', error);
      return null;
    }
  },

  async submitOrganization() {
    set({ isSubmitting: true, error: null });
    try {
      const { formData, existingOrgId, templateConfig } = get();
      const org = formData.organization;
      const orgData = {
        organizationName: org.name,
        organizationType: org.type,
        description: org.description,
        objectives: org.objectives,
        address: org.address || [org.street, org.streetNumber].filter(Boolean).join(' '),
        street: org.street || '',
        streetNumber: org.streetNumber || '',
        comuna: org.commune,
        region: org.region,
        unidadVecinal: org.neighborhood,
        contactEmail: org.email,
        contactPhone: org.phone,
        contactPreference: org.contactPreference,
        members: formData.members,
        provisionalDirectorio: formData.directorioProvisorio,
        electoralCommission: formData.comisionElectoral?.members || [],
        estatutos: typeof formData.estatutos === 'string' ? formData.estatutos : formData.estatutos?.type || '',
        estatutosEditados: formData.estatutos?.type === 'edit_template' ? formData.estatutos.editedArticles : null,
        config: formData.config,
        electionDate: formData.assemblySchedule?.date || null,
        electionTime: formData.assemblySchedule?.time || null,
        assemblyAddress: formData.assemblySchedule?.address || '',
        edadConfig: templateConfig?.edadConfig || null,
        certificatesStep5: formData.certificates || {}
      };

      let data;
      let orgId;

      if (existingOrgId) {
        // Update existing draft org then resubmit
        await apiService.updateOrganization(existingOrgId, orgData);
        // Submit the draft to transition status to waiting_ministro
        data = await apiService.submitDraftOrganization(existingOrgId, {
          electionDate: formData.assemblySchedule?.date || null,
          electionTime: formData.assemblySchedule?.time || null,
          assemblyAddress: formData.assemblySchedule?.address || ''
        });
        orgId = existingOrgId;
      } else {
        data = await apiService.createOrganization(orgData);
        orgId = data.organization?._id || data._id;
      }

      // Sync certificates if any
      if (Object.keys(formData.certificates).length > 0) {
        await apiService.syncCertificates(orgId, formData.certificates, formData.estatutos?.customFile);
      }

      // Clear saved progress
      localStorage.removeItem(STORAGE_KEY);
      set({ isSubmitting: false, existingOrgId: orgId });
      return data;
    } catch (error) {
      set({ isSubmitting: false, error: error.message });
      throw error;
    }
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    set({
      currentStep: 0,
      formData: { ...initialFormData },
      organizationTypes: [],
      isSubmitting: false,
      existingOrgId: null,
      error: null,
      templateConfig: null
    });
  }
}));
