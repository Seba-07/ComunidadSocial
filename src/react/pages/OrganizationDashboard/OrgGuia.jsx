import { useState, useEffect } from 'react';
import { apiService } from '../../../services/ApiService';
import { sanitizeRichText } from '@shared/utils/sanitize';

const cardStyle = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: 24,
  marginBottom: 20
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 16,
  fontSize: 18,
  fontWeight: 600,
  color: '#1e293b'
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 12
};

const reqCardStyle = {
  background: '#f8fafc',
  borderRadius: 10,
  padding: 16,
  textAlign: 'center',
  border: '1px solid #e2e8f0'
};

const roleItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '12px 0',
  borderBottom: '1px solid #f1f5f9'
};

const badgeColors = {
  P: '#2563eb',
  S: '#7c3aed',
  T: '#059669',
  D: '#d97706'
};

const REQUIREMENTS = [
  { number: '200', title: 'Personas mínimo', desc: 'Para Juntas de Vecinos' },
  { number: '15', title: 'Personas mínimo', desc: 'Para otras organizaciones' },
  { number: '14+', title: 'Años de edad', desc: 'Para ser miembro' },
  { number: '18+', title: 'Años de edad', desc: 'Para Directorio y Comisión' },
];

const ROLES = [
  { badge: 'P', name: 'Presidente', desc: 'Representa legalmente a la organización ante terceros' },
  { badge: 'S', name: 'Secretario', desc: 'Maneja toda la documentación y redacta las actas' },
  { badge: 'T', name: 'Tesorero', desc: 'Administra los recursos y finanzas de la organización' },
  { badge: 'D', name: '2 Directores', desc: 'Apoyan la gestión y toman decisiones en conjunto' },
];

const COMMISSION_RULES = [
  'No pueden ser parte del directorio',
  'Organizan las futuras elecciones',
  'Velan por la transparencia del proceso',
  'Son designados en la asamblea constitutiva',
];

const DOCUMENTS = [
  { icon: '📋', name: 'Acta de Asamblea Constitutiva' },
  { icon: '👥', name: 'Lista de Socios Fundadores' },
  { icon: '✍️', name: 'Certificado del Ministro de Fe' },
  { icon: '📝', name: 'Declaraciones Juradas del Directorio' },
];

export default function OrgGuia() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiService.get('/guia-constitucion')
      .then(data => setContent(data.contentHTML || ''))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Guía de Constitución</h2>
        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>
          Todo lo que necesitas saber para crear tu organización comunitaria según la Ley 19.418
        </p>
      </div>

      {/* Requisitos Mínimos */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}><span>👥</span> Requisitos Mínimos</div>
        <div style={gridStyle}>
          {REQUIREMENTS.map((r, i) => (
            <div key={i} style={reqCardStyle}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb', marginBottom: 4 }}>{r.number}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>{r.title}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{r.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1e40af' }}>
          <span>ℹ️</span>
          Todos los miembros deben ser residentes de la comuna y presentar cédula de identidad vigente
        </div>
      </div>

      {/* Directorio Provisorio */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}><span>📝</span> Directorio Provisorio</div>
        {ROLES.map((r, i) => (
          <div key={i} style={{ ...roleItemStyle, borderBottom: i < ROLES.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: badgeColors[r.badge], color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0
            }}>{r.badge}</div>
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{r.name}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{r.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Comisión Electoral */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}><span>✅</span> Comisión Electoral</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: '#2563eb' }}>3</span>
          <span style={{ fontSize: 14, color: '#475569' }}>miembros independientes</span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {COMMISSION_RULES.map((rule, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
              <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 16 }}>✓</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      {/* Documentos que se Generan */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}><span>📄</span> Documentos que se Generan</div>
        <div style={gridStyle}>
          {DOCUMENTS.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 20 }}>{d.icon}</span>
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{d.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Información Adicional (desde API) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Cargando información adicional...</div>
      ) : content ? (
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}><span>📚</span> Información Adicional</div>
          <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }} style={{ fontSize: 14, lineHeight: 1.7, color: '#334155' }} />
        </div>
      ) : null}
    </div>
  );
}
