import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import { formatDate } from '../../utils/formatters';

function formatName(p) {
  if (!p) return '—';
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || '—';
}

export default function AssignmentDetail({ assignment, onBack, onStartAssembly }) {
  const addToast = useUiStore(s => s.addToast);
  const [org, setOrg] = useState(null);
  const [generatedDocs, setGeneratedDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  const a = assignment;
  const orgId = a.organizationId?._id || a.organizationId;

  useEffect(() => {
    async function load() {
      try {
        const [orgData, docs] = await Promise.all([
          apiService.getOrganization(orgId),
          apiService.get(`/organizations/${orgId}/generated-documents`).catch(() => []),
        ]);
        setOrg(orgData.organization || orgData);
        if (Array.isArray(docs)) setGeneratedDocs(docs);
      } catch { addToast('Error al cargar datos', 'error'); }
      finally { setLoading(false); }
    }
    load();
  }, [orgId]);

  const DOC_LABELS = {
    acta_constitutiva: 'Acta Constitutiva',
    lista_socios: 'Lista de Socios Fundadores',
    nomina_directorio: 'Nomina del Directorio',
    carta_solicitud: 'Carta de Solicitud',
  };

  function openPdf(content) {
    if (!content) return;
    if (content.startsWith('data:application/pdf')) {
      try {
        const b64 = content.split(',')[1] || content.split('base64,')[1];
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        window.open(URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })), '_blank');
      } catch { window.open(content, '_blank'); }
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Cargando...</div>;

  const dir = org?.provisionalDirectorio || {};
  const members = org?.members || [];
  const isToday = (() => {
    if (!a.scheduledDate) return false;
    return new Date(a.scheduledDate).toDateString() === new Date().toDateString();
  })();
  const isPast = a.scheduledDate && new Date(a.scheduledDate) < new Date(new Date().toDateString());
  const canStart = (isToday || isPast) && a.status === 'pending';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)' }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: '#2563eb', fontSize: 14,
        cursor: 'pointer', padding: 0, marginBottom: 16, fontWeight: 500,
      }}>
        &#8592; Volver a Asignaciones
      </button>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        color: 'white', borderRadius: 12, padding: 'clamp(16px, 4vw, 24px)', marginBottom: 20,
      }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 700 }}>
          {a.organizationName || org?.organizationName || 'Organizacion'}
        </h2>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          {org?.organizationType?.replace(/_/g, ' ') || ''}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: 14 }}>
          <span>&#128197; {a.scheduledDate ? formatDate(a.scheduledDate) : '—'}</span>
          <span>&#128336; {a.scheduledTime || '—'}</span>
          <span>&#128205; {a.location || '—'}</span>
        </div>
      </div>

      {/* Contacto del dirigente */}
      <Section title="Contacto del Dirigente">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Telefono</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#111827' }}>
              {org?.contactPhone ? (
                <a href={`tel:${org.contactPhone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{org.contactPhone}</a>
              ) : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Email</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#111827' }}>
              {org?.contactEmail || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Socios esperados</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#111827' }}>{members.length}</div>
          </div>
        </div>
      </Section>

      {/* Directorio */}
      <Section title="Directorio Provisorio">
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            ['Presidente/a', dir.president || dir.presidente],
            ['Secretario/a', dir.secretary || dir.secretario],
            ['Tesorero/a', dir.treasurer || dir.tesorero],
          ].filter(([, p]) => p).map(([cargo, p]) => (
            <div key={cargo} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{cargo}</span>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{formatName(p)} — {p.rut || '—'}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Documentos para imprimir */}
      <Section title="Documentos para Imprimir">
        {generatedDocs.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {generatedDocs.map((doc, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb',
                flexWrap: 'wrap', gap: 8,
              }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
                  {DOC_LABELS[doc.docType] || doc.docType?.replace(/_/g, ' ')}
                </span>
                <button onClick={() => openPdf(doc.content)} style={{
                  padding: '8px 18px', border: 'none', borderRadius: 8,
                  background: '#2563eb', color: 'white', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', minHeight: 40,
                }}>
                  Ver / Imprimir
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No hay documentos generados</p>
        )}

        {/* Estatutos */}
        {org?.estatutosSnapshot?.articulos?.length > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb',
            marginTop: 8, flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
              Estatutos ({org.estatutosSnapshot.articulos.length} articulos)
            </span>
            <button onClick={() => {
              const arts = [...org.estatutosSnapshot.articulos].sort((a, b) => (a.orden || a.numero) - (b.orden || b.numero));
              const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Georgia,serif;max-width:750px;margin:40px auto;padding:0 20px;line-height:1.7}h1{text-align:center;font-size:20px}
.art{margin-bottom:16px}.art-t{font-weight:700;font-size:13px;margin-bottom:3px}.art-c{font-size:12px;white-space:pre-line}@media print{body{margin:20px}}</style></head><body>
<h1>ESTATUTOS</h1><h2 style="text-align:center;font-size:14px;color:#555">${org.organizationName}</h2><hr>
${arts.map(a => `<div class="art"><div class="art-t">Art. ${a.numero}: ${a.titulo}</div><div class="art-c">${a.contenido}</div></div>`).join('')}</body></html>`;
              const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
              window.open(URL.createObjectURL(blob), '_blank');
            }} style={{
              padding: '8px 18px', border: '1px solid #2563eb', borderRadius: 8,
              background: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', minHeight: 40,
            }}>
              Ver / Imprimir
            </button>
          </div>
        )}
      </Section>

      {/* Boton Iniciar */}
      {canStart && (
        <button onClick={() => onStartAssembly(a, org)} style={{
          width: '100%', padding: 'clamp(14px, 3vw, 18px)', border: 'none', borderRadius: 12,
          background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
          fontSize: 'clamp(16px, 4vw, 18px)', fontWeight: 700, cursor: 'pointer',
          marginTop: 8,
        }}>
          Iniciar Asamblea Constitutiva
        </button>
      )}

      {!canStart && a.status === 'pending' && (
        <div style={{ padding: 16, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, marginTop: 8, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#92400e', fontWeight: 600 }}>
            La asamblea esta programada para {formatDate(a.scheduledDate)}. Podras iniciarla ese dia.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 'clamp(14px, 3vw, 20px)', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</h3>
      {children}
    </div>
  );
}
