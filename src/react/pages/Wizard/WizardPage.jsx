import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWizardStore } from '../../stores/wizardStore';
import { useUiStore } from '../../stores/uiStore';
import SharedHeader from '../../components/layout/SharedHeader';
import SharedSidebar from '../../components/layout/SharedSidebar';
import ProgressBar from '../../components/ui/ProgressBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import Step1_OrgData from './steps/Step1_OrgData';
import Step2_Members from './steps/Step2_Members';
import Step3_Config from './steps/Step3_Config';
import Step4_Estatutos from './steps/Step4_Estatutos';
import Step5_Directorio from './steps/Step5_Directorio';
import Step6_Review from './steps/Step6_Review';

const STEPS = [
  'Datos', 'Miembros', 'Configuración', 'Estatutos', 'Directorio', 'Revisión'
];

const STEP_COMPONENTS = [
  Step1_OrgData, Step2_Members, Step3_Config, Step4_Estatutos, Step5_Directorio, Step6_Review
];

// Sidebar menu items matching the org dashboard secondary section
const WIZARD_MENU_ITEMS = [
  { key: 'mis-org', label: 'Mis Organizaciones', icon: '🏠' },
  { key: 'guia', label: 'Guía', icon: '📑' },
  { key: 'biblioteca', label: 'Biblioteca', icon: '📚' },
  { key: 'noticias', label: 'Noticias', icon: '📰' },
];

export default function WizardPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const {
    currentStep, setStep, formData, loadProgress, clearProgress,
    saveProgress, fetchOrganizationTypes, isSubmitting
  } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const [showResume, setShowResume] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchOrganizationTypes().catch(() => {});

    // Check for saved progress
    const hasProgress = loadProgress();
    if (hasProgress && !orgId) {
      setShowResume(true);
    }
    setReady(true);
  }, []);

  function handleResumeYes() {
    setShowResume(false);
  }

  function handleResumeNo() {
    clearProgress();
    setShowResume(false);
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) {
      setStep(currentStep + 1);
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      setStep(currentStep - 1);
    }
  }

  function handleExit() {
    saveProgress();
    addToast('Progreso guardado', 'info');
    navigate('/org/auto');
  }

  function handleSidebarClick(key) {
    if (key === 'mis-org') {
      saveProgress();
      navigate('/org/auto');
      return;
    }
    if (key === 'guia') {
      window.location.href = '/?page=guia-constitucion';
      return;
    }
    if (key === 'biblioteca') {
      window.location.href = '/?page=biblioteca';
      return;
    }
    if (key === 'noticias') {
      window.location.href = '/?page=noticias';
      return;
    }
  }

  if (!ready) return <LoadingSpinner text="Cargando wizard..." />;

  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    <>
      <SharedHeader />
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6', paddingTop: 'var(--header-height, 60px)' }}>
        <SharedSidebar
          title="Crear Organización"
          menuItems={WIZARD_MENU_ITEMS}
          activeKey="mis-org"
          onItemClick={handleSidebarClick}
        />
        <main style={{ flex: 1, overflow: 'auto', marginLeft: 'var(--sidebar-width, 260px)', transition: 'margin-left 0.25s ease' }}>
          {/* Wizard header bar */}
          <div style={{
            background: 'white',
            borderBottom: '1px solid #e5e7eb',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
              Crear Organización
            </h2>
            <button onClick={handleExit} style={{
              padding: '8px 16px', border: '1px solid #d1d5db',
              borderRadius: 8, background: 'white', color: '#374151',
              fontSize: 13, cursor: 'pointer', fontWeight: 500,
            }}>
              Guardar y Salir
            </button>
          </div>

          {/* Progress */}
          <div style={{
            background: 'white', padding: '20px 24px', borderBottom: '1px solid #e5e7eb'
          }}>
            <ProgressBar steps={STEPS} currentStep={currentStep} />
          </div>

          {/* Content */}
          <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
            <div style={{
              background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
              padding: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <StepComponent
                formData={formData}
                onNext={nextStep}
                onPrev={prevStep}
                isFirst={currentStep === 0}
                isLast={currentStep === STEPS.length - 1}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Resume modal */}
      <Modal open={showResume} onClose={handleResumeNo} title="Progreso Guardado">
        <p style={{ fontSize: 15, color: '#374151', marginBottom: 20 }}>
          Se encontró un progreso guardado. ¿Deseas continuar donde lo dejaste?
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={handleResumeNo} style={{
            padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 10,
            background: 'white', fontSize: 14, cursor: 'pointer'
          }}>Empezar de Nuevo</button>
          <button onClick={handleResumeYes} style={{
            padding: '10px 20px', border: 'none', borderRadius: 10,
            background: '#2563eb', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}>Continuar</button>
        </div>
      </Modal>
    </>
  );
}
