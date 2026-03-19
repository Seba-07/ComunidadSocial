import { useState, useEffect } from 'react';
import { useAssignmentsStore } from '../../stores/assignmentsStore';
import { useUiStore } from '../../stores/uiStore';
import { apiService } from '@services/ApiService.js';
import ProgressBar from '../../components/ui/ProgressBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ValidateDirectorio from './steps/ValidateDirectorio';
import AttendeeCheckin from './steps/AttendeeCheckin';
import ValidateCommission from './steps/ValidateCommission';
import SignatureCapture from './steps/SignatureCapture';
import ValidationReview from './steps/ValidationReview';

const STEPS = ['Asistencia', 'Directorio', 'Comision', 'Firmas', 'Certificar'];

export default function ValidationWizard({ assignment, org: preloadedOrg, onClose }) {
  const { validateSignatures } = useAssignmentsStore();
  const addToast = useUiStore(s => s.addToast);
  const [currentStep, setCurrentStep] = useState(0);
  const [org, setOrg] = useState(preloadedOrg || null);
  const [isLoading, setIsLoading] = useState(!preloadedOrg);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [wizardData, setWizardData] = useState({
    directorio: {},
    comisionElectoral: [],
    attendees: [],
    signatures: {},
    ministroSignature: null,
    notes: '',
    groupPhoto: null,
    quorumRequired: 15,
    quorumAchieved: false,
    attendanceCount: 0,
  });

  useEffect(() => {
    if (preloadedOrg) {
      initFromOrg(preloadedOrg);
      return;
    }
    async function loadOrg() {
      try {
        const orgId = assignment.organizationId?._id || assignment.organizationId || assignment.organization?._id;
        if (orgId) {
          const data = await apiService.getOrganization(orgId);
          const orgData = data.organization || data;
          setOrg(orgData);
          initFromOrg(orgData);
        }
      } catch (err) {
        addToast('Error cargando datos de organizacion', 'error');
      } finally {
        setIsLoading(false);
      }
    }
    loadOrg();
  }, [assignment]);

  function initFromOrg(orgData) {
    const dir = orgData.provisionalDirectorio || {};
    const com = orgData.comisionElectoral?.members || orgData.comisionElectoral || [];
    const members = orgData.members || [];

    setWizardData(d => ({
      ...d,
      directorio: dir,
      comisionElectoral: Array.isArray(com) ? com : [],
      attendees: members.map(m => ({
        ...m,
        present: false,
        name: `${m.firstName || ''} ${m.lastName || ''}`.trim()
      }))
    }));
    setIsLoading(false);
  }

  function updateWizardData(updates) {
    setWizardData(d => ({ ...d, ...updates }));
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1);
  }

  function prevStep() {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  }

  async function handleSubmit(extraData = {}) {
    setIsSubmitting(true);
    try {
      const fullWizardData = {
        ...wizardData,
        actaScannedUrl: extraData.actaScanned || null,
        attendanceScannedUrl: extraData.attendanceScanned || null,
      };
      await validateSignatures(assignment._id, wizardData.signatures, fullWizardData);
      addToast('Asamblea certificada exitosamente', 'success');
      onClose();
    } catch (err) {
      addToast(err.message || 'Error al certificar', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRejectAssembly(reason, attendanceCount, quorumRequired) {
    setIsSubmitting(true);
    try {
      await apiService.rejectAssembly(assignment._id, reason, attendanceCount, quorumRequired);
      addToast('Asamblea rechazada', 'success');
      onClose();
    } catch (err) {
      addToast(err.message || 'Error al rechazar', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <LoadingSpinner text="Cargando datos..." />;

  const stepProps = {
    wizardData, updateWizardData, org, assignment,
    onNext: nextStep, onPrev: prevStep
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        color: 'white', padding: 'clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8
      }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(15px, 3.5vw, 18px)', fontWeight: 700 }}>
          Asamblea: {org?.organizationName || org?.name || 'Organizacion'}
        </h1>
        <button onClick={onClose} style={{
          padding: '6px 14px', border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 8, background: 'transparent', color: 'white',
          fontSize: 13, cursor: 'pointer'
        }}>Salir</button>
      </div>

      <div style={{ background: 'white', padding: 'clamp(10px, 2vw, 16px) clamp(16px, 4vw, 24px)', borderBottom: '1px solid #e5e7eb' }}>
        <ProgressBar steps={STEPS} currentStep={currentStep} />
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)' }}>
        <div style={{
          background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: 'clamp(14px, 3vw, 28px)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          {/* Step order: Asistencia → Directorio → Comision → Firmas → Certificar */}
          {currentStep === 0 && <AttendeeCheckin {...stepProps} />}
          {currentStep === 1 && <ValidateDirectorio {...stepProps} />}
          {currentStep === 2 && <ValidateCommission {...stepProps} />}
          {currentStep === 3 && <SignatureCapture {...stepProps} />}
          {currentStep === 4 && (
            <ValidationReview
              {...stepProps}
              onSubmit={handleSubmit}
              onRejectAssembly={handleRejectAssembly}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
