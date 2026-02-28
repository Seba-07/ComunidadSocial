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

const STEPS = ['Directorio', 'Asistentes', 'Comisión', 'Firmas', 'Confirmar'];

export default function ValidationWizard({ assignment, onClose }) {
  const { validateSignatures } = useAssignmentsStore();
  const addToast = useUiStore(s => s.addToast);
  const [currentStep, setCurrentStep] = useState(0);
  const [org, setOrg] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [wizardData, setWizardData] = useState({
    directorio: {},
    comisionElectoral: [],
    attendees: [],
    signatures: {},
    ministroSignature: null,
    notes: '',
    groupPhoto: null
  });

  useEffect(() => {
    async function loadOrg() {
      try {
        const orgId = assignment.organizationId?._id || assignment.organizationId || assignment.organization?._id;
        if (orgId) {
          const data = await apiService.getOrganization(orgId);
          const orgData = data.organization || data;
          setOrg(orgData);

          // Pre-populate from org data
          const dir = orgData.provisionalDirectorio || {};
          const com = orgData.comisionElectoral?.members || [];
          const members = orgData.members || [];

          setWizardData(d => ({
            ...d,
            directorio: dir,
            comisionElectoral: com,
            attendees: members.map(m => ({
              ...m,
              present: false,
              name: `${m.firstName || m.primerNombre || ''} ${m.lastName || m.apellidoPaterno || ''}`.trim()
            }))
          }));
        }
      } catch (err) {
        addToast('Error cargando datos de organización', 'error');
      } finally {
        setIsLoading(false);
      }
    }
    loadOrg();
  }, [assignment]);

  function updateWizardData(updates) {
    setWizardData(d => ({ ...d, ...updates }));
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1);
  }

  function prevStep() {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await validateSignatures(assignment._id, wizardData.signatures, wizardData);
      addToast('Validación completada exitosamente', 'success');
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
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
        color: 'white', padding: '16px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          Validación: {org?.name || 'Organización'}
        </h1>
        <button onClick={onClose} style={{
          padding: '6px 14px', border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 8, background: 'transparent', color: 'white',
          fontSize: 13, cursor: 'pointer'
        }}>Salir</button>
      </div>

      <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
        <ProgressBar steps={STEPS} currentStep={currentStep} />
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <div style={{
          background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          {currentStep === 0 && <ValidateDirectorio {...stepProps} />}
          {currentStep === 1 && <AttendeeCheckin {...stepProps} />}
          {currentStep === 2 && <ValidateCommission {...stepProps} />}
          {currentStep === 3 && <SignatureCapture {...stepProps} />}
          {currentStep === 4 && (
            <ValidationReview
              {...stepProps}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
