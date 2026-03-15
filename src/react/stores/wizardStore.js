import { create } from 'zustand';
import { apiService } from '@services/ApiService.js';
import tenant from '../../config/tenant.js';

const STORAGE_KEY = 'wizard_progress';
const EXPIRY_DAYS = 7;

const initialFormData = {
  organization: {
    type: '', name: '', description: '', objectives: '', address: '', street: '',
    streetNumber: '', postalCode: '', region: 'Región Metropolitana',
    commune: tenant.communeName, neighborhood: '', email: '', phone: '', contactPreference: 'email'
  },
  members: [],
  config: {
    asambleas: ['Marzo', 'Noviembre'],
    cuotaMin: 0.1,
    cuotaMax: 0.5,
    beneficiarioDisolucion: '',
    duracionMandato: 2,
    metodoCitacion: 'carta_certificada',
    diasAnticipacion: 10,
    cuotaIncorporacion: 0.5,
    rutDisolucion: ''
  },
  estatutos: { type: 'template', content: null, customFile: null },
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
  },

  setFormDataField(section, value) {
    set(state => ({
      formData: { ...state.formData, [section]: value }
    }));
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
        currentStep,
        formData,
        existingOrgId,
        templateConfig,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch { /* localStorage full or unavailable */ }
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

      set({
        currentStep: saved.currentStep || 0,
        formData: {
          ...initialFormData,
          ...saved.formData,
          organization: {
            ...initialFormData.organization,
            ...(saved.formData?.organization || {}),
            commune: saved.formData?.organization?.commune || initialFormData.organization.commune,
            region: saved.formData?.organization?.region || initialFormData.organization.region
          },
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
      const { formData } = get();
      const org = formData.organization;
      const orgData = {
        organizationName: org.name,
        organizationType: org.type,
        description: org.description,
        objectives: org.objectives,
        address: org.address || [org.street, org.streetNumber].filter(Boolean).join(' '),
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
        config: formData.config,
        electionDate: formData.assemblySchedule?.date || null,
        electionTime: formData.assemblySchedule?.time || null,
        assemblyAddress: formData.assemblySchedule?.address || ''
      };

      const data = await apiService.createOrganization(orgData);
      const orgId = data.organization?._id || data._id;

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
