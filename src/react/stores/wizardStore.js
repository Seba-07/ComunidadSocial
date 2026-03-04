import { create } from 'zustand';
import { apiService } from '@services/ApiService.js';

const STORAGE_KEY = 'wizard_progress';
const EXPIRY_DAYS = 7;

const initialFormData = {
  organization: {
    type: '', name: '', description: '', address: '', street: '',
    streetNumber: '', postalCode: '', region: 'Región Metropolitana',
    commune: 'Renca', neighborhood: '', email: '', phone: '', contactPreference: 'email'
  },
  members: [],
  config: {
    asambleas: ['Marzo', 'Noviembre'],
    cuotaMin: 0.1,
    cuotaMax: 0.5,
    beneficiarioDisolucion: ''
  },
  estatutos: { type: 'template', content: null, customFile: null },
  directorioProvisorio: {},
  comisionElectoral: { members: [], electionDate: null },
  certificates: {},
  documents: {},
  assemblySchedule: { date: null, time: null }
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
        formData: { ...initialFormData, ...saved.formData },
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
      const orgData = {
        ...formData.organization,
        members: formData.members,
        provisionalDirectorio: formData.directorioProvisorio,
        comisionElectoral: formData.comisionElectoral,
        estatutos: formData.estatutos,
        config: formData.config,
        assemblySchedule: formData.assemblySchedule
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
