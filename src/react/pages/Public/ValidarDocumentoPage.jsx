import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ValidarDocumentoPage() {
  const { folio: folioParam } = useParams();
  const navigate = useNavigate();
  const [folio, setFolio] = useState(folioParam || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (folioParam) {
      verify(folioParam);
    }
  }, [folioParam]);

  async function verify(folioToVerify) {
    const f = (folioToVerify || folio).trim();
    if (!f) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/document-registry/verify/${encodeURIComponent(f)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Documento no encontrado');
        return;
      }

      setResult(data);
    } catch {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const f = folio.trim();
    if (f) {
      navigate(`/validar/${f}`, { replace: true });
      verify(f);
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${d.getDate()} de ${months[d.getMonth()]} del ${d.getFullYear()}`;
  };

  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.shield}>&#128274;</div>
          <h1 style={styles.title}>Verificacion de Documentos</h1>
          <p style={styles.subtitle}>
            Sistema de validacion publica de documentos emitidos por ComunidadSocial
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} style={styles.searchBox}>
          <label style={styles.label}>Ingrese el folio del documento</label>
          <div style={styles.inputRow}>
            <input
              type="text"
              value={folio}
              onChange={e => setFolio(e.target.value)}
              placeholder="Ej: V1StGXR8_Z5j"
              style={styles.input}
              autoFocus={!folioParam}
            />
            <button type="submit" disabled={loading || !folio.trim()} style={{
              ...styles.button,
              opacity: loading || !folio.trim() ? 0.6 : 1,
              cursor: loading || !folio.trim() ? 'not-allowed' : 'pointer'
            }}>
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
          </div>
        </form>

        {/* Loading */}
        {loading && (
          <div style={styles.loadingBox}>
            <div style={styles.spinner} />
            <span style={{ color: '#64748b' }}>Consultando registro...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={styles.errorCard}>
            <div style={styles.errorIcon}>&#10060;</div>
            <h2 style={styles.errorTitle}>Documento no encontrado o invalido</h2>
            <p style={styles.errorText}>{error}</p>
            <p style={styles.errorHint}>
              Verifique que el folio sea correcto. Si el problema persiste, contacte a la organizacion emisora.
            </p>
          </div>
        )}

        {/* Revoked */}
        {result && result.status === 'REVOKED' && !loading && (
          <div style={styles.revokedCard}>
            <div style={styles.revokedIcon}>&#9888;&#65039;</div>
            <h2 style={styles.revokedTitle}>Documento Revocado</h2>
            <p style={styles.revokedText}>
              Este documento fue revocado y <strong>ya no tiene validez legal</strong>.
            </p>
            {result.revokedAt && (
              <p style={styles.revokedMeta}>
                Fecha de revocacion: {formatDate(result.revokedAt)}
              </p>
            )}
            {result.revokedReason && (
              <p style={styles.revokedMeta}>
                Motivo: {result.revokedReason}
              </p>
            )}
          </div>
        )}

        {/* Valid */}
        {result && result.valid && !loading && (
          <div style={styles.validCard}>
            <div style={styles.validBadge}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={styles.validTitle}>Documento Valido</h2>
            <p style={styles.validSubtitle}>Emitido por el Sistema ComunidadSocial</p>

            <div style={styles.dataGrid}>
              <DataRow label="Folio" value={result.folio} mono />
              <DataRow label="Tipo de Documento" value={result.documentTypeLabel} />
              {result.documentTitle && <DataRow label="Titulo" value={result.documentTitle} />}
              {result.organization && (
                <>
                  <DataRow label="Organizacion" value={result.organization.name} highlight />
                  {result.organization.type && (
                    <DataRow label="Tipo de Organizacion" value={result.organization.type.replace(/_/g, ' ')} />
                  )}
                  {result.organization.comuna && (
                    <DataRow label="Comuna" value={result.organization.comuna} />
                  )}
                </>
              )}
              <DataRow label="Fecha de Emision" value={formatDate(result.issueDate)} />
              {result.fileHash && (
                <DataRow label="Hash SHA-256" value={result.fileHash.substring(0, 16) + '...'} mono small />
              )}
            </div>

            <div style={styles.legalNote}>
              Este documento fue generado electronicamente y registrado en el sistema de ComunidadSocial.
              Su autenticidad puede verificarse en cualquier momento mediante este folio.
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <p>ComunidadSocial &middot; Plataforma de Gestion Comunitaria</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>
            Ley 19.418 sobre Juntas de Vecinos y Organizaciones Comunitarias
          </p>
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value, mono, highlight, small }) {
  return (
    <div style={styles.dataRow}>
      <span style={styles.dataLabel}>{label}</span>
      <span style={{
        ...styles.dataValue,
        ...(mono ? { fontFamily: 'monospace', letterSpacing: '0.5px' } : {}),
        ...(highlight ? { color: '#1e40af', fontWeight: 700 } : {}),
        ...(small ? { fontSize: 11 } : {})
      }}>{value}</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #f0f0ff 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px'
  },
  container: {
    maxWidth: 560,
    width: '100%'
  },
  header: {
    textAlign: 'center',
    marginBottom: 32
  },
  shield: {
    fontSize: 48,
    marginBottom: 12
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    margin: '8px 0 0',
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.5
  },
  searchBox: {
    background: 'white',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    marginBottom: 24
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 8
  },
  inputRow: {
    display: 'flex',
    gap: 10
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    border: '1.5px solid #d1d5db',
    borderRadius: 10,
    fontSize: 15,
    fontFamily: 'monospace',
    outline: 'none',
    transition: 'border-color 0.2s',
    letterSpacing: '0.5px'
  },
  button: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: 10,
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: 'white',
    fontSize: 14,
    fontWeight: 700,
    boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
    flexShrink: 0
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32
  },
  spinner: {
    width: 24,
    height: 24,
    border: '3px solid #e2e8f0',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  errorCard: {
    background: 'white',
    borderRadius: 16,
    padding: 32,
    textAlign: 'center',
    border: '2px solid #fecaca',
    boxShadow: '0 4px 24px rgba(220,38,38,0.08)'
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12
  },
  errorTitle: {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 700,
    color: '#dc2626'
  },
  errorText: {
    margin: '0 0 12px',
    fontSize: 14,
    color: '#6b7280'
  },
  errorHint: {
    margin: 0,
    fontSize: 12,
    color: '#9ca3af'
  },
  revokedCard: {
    background: 'white',
    borderRadius: 16,
    padding: 32,
    textAlign: 'center',
    border: '2px solid #fed7aa',
    boxShadow: '0 4px 24px rgba(234,88,12,0.08)'
  },
  revokedIcon: {
    fontSize: 48,
    marginBottom: 12
  },
  revokedTitle: {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 700,
    color: '#ea580c'
  },
  revokedText: {
    margin: '0 0 12px',
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 1.5
  },
  revokedMeta: {
    margin: '4px 0',
    fontSize: 13,
    color: '#9ca3af'
  },
  validCard: {
    background: 'white',
    borderRadius: 16,
    padding: 32,
    textAlign: 'center',
    border: '2px solid #bbf7d0',
    boxShadow: '0 4px 24px rgba(22,163,74,0.1)'
  },
  validBadge: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 4px 16px rgba(22,163,74,0.3)'
  },
  validTitle: {
    margin: '0 0 4px',
    fontSize: 22,
    fontWeight: 800,
    color: '#15803d'
  },
  validSubtitle: {
    margin: '0 0 24px',
    fontSize: 13,
    color: '#6b7280'
  },
  dataGrid: {
    textAlign: 'left',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    marginBottom: 20
  },
  dataRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    gap: 12
  },
  dataLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 500,
    flexShrink: 0
  },
  dataValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: 600,
    textAlign: 'right',
    wordBreak: 'break-all'
  },
  legalNote: {
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 1.5,
    padding: '12px 16px',
    background: '#f8fafc',
    borderRadius: 8,
    textAlign: 'left'
  },
  footer: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 12,
    color: '#94a3b8'
  }
};
