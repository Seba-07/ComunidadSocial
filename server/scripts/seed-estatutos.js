/**
 * Script para crear plantillas de estatutos base para todos los tipos de organización
 * Ejecutar con: node --experimental-modules server/scripts/seed-estatutos.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import EstatutoTemplate from '../models/EstatutoTemplate.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad-social';

// Configuración específica de directorio por tipo de organización
const DIRECTORIO_CONFIG = {
  // Juntas de Vecinos - 5 miembros, 50 personas mínimo
  'JUNTA_VECINOS': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 50
  },

  // Comité de Vecinos - similar a Junta
  'COMITE_VECINOS': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15
  },

  // Centro de Padres - 4 miembros (sin vicepresidente)
  'CENTRO_PADRES': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'secretario', nombre: 'Secretario General', color: '#10b981', required: true, orden: 2 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 3 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 4 }
    ],
    totalRequerido: 4,
    miembrosMinimos: 15
  },

  // Comité de Vivienda - 5 miembros con 2 directores
  'COMITE_VIVIENDA': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 2 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 3 },
      { id: 'director1', nombre: 'Director/a 1', color: '#6366f1', required: true, orden: 4 },
      { id: 'director2', nombre: 'Director/a 2', color: '#ec4899', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15
  },

  // Comité de Convivencia Vecinal - 6 miembros con cargos especiales
  'COMITE_CONVIVENCIA': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director_prevencion', nombre: 'Director/a de Prevención', color: '#ef4444', required: true, orden: 5 },
      { id: 'director_convivencia', nombre: 'Director/a de Convivencia', color: '#14b8a6', required: true, orden: 6 }
    ],
    totalRequerido: 6,
    miembrosMinimos: 15
  },

  // Club Deportivo - 5 miembros estándar
  'CLUB_DEPORTIVO': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15
  },

  // Club Adulto Mayor - 5 miembros
  'CLUB_ADULTO_MAYOR': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a de Bienestar', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15
  },

  // Centro de Estudiantes - 5 miembros con cargos estudiantiles
  'CENTRO_ESTUDIANTES': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a General', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Delegado/a de Cultura', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15
  },

  // Consejo Escolar - 4 miembros representativos
  'CONSEJO_ESCOLAR': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 2 },
      { id: 'rep_profesores', nombre: 'Representante Profesores', color: '#f59e0b', required: true, orden: 3 },
      { id: 'rep_apoderados', nombre: 'Representante Apoderados', color: '#6366f1', required: true, orden: 4 }
    ],
    totalRequerido: 4,
    miembrosMinimos: 15
  }
};

// Configuración por defecto para tipos sin configuración específica
const DEFAULT_CONFIG = {
  cargos: [
    { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
    { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
    { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
    { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
    { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
  ],
  totalRequerido: 5,
  miembrosMinimos: 15
};

// Artículos base comunes (simplificados para seed inicial)
const ARTICULOS_BASE = [
  {
    numero: 1,
    titulo: 'Constitución y Denominación',
    contenido: 'Constitúyese una Organización Comunitaria que se regirá por la Ley N° 19.418 y por las disposiciones del presente estatuto.',
    esEditable: true,
    orden: 1
  },
  {
    numero: 2,
    titulo: 'Objeto',
    contenido: 'La organización tendrá por objeto promover la integración, participación y desarrollo de la comunidad, canalizando las aptitudes, intereses y capacidades personales de sus miembros.',
    esEditable: true,
    orden: 2
  },
  {
    numero: 3,
    titulo: 'Domicilio',
    contenido: 'El domicilio de esta organización será en la comuna de Renca, Región Metropolitana. La duración será indefinida y el número de sus socios ilimitado.',
    esEditable: true,
    orden: 3
  },
  {
    numero: 4,
    titulo: 'De los Socios',
    contenido: 'Podrán ser socios todas las personas mayores de 14 años, residentes de la comuna, que así lo soliciten y sean aceptados por el Directorio.',
    esEditable: true,
    orden: 4
  },
  {
    numero: 5,
    titulo: 'Del Directorio',
    contenido: 'La dirección y administración corresponde a un Directorio elegido por la Asamblea General. Los directores permanecerán en su cargo por el plazo establecido en estos estatutos.',
    esEditable: true,
    orden: 5
  },
  {
    numero: 6,
    titulo: 'De las Asambleas',
    contenido: 'Las Asambleas Generales serán Ordinarias o Extraordinarias. Las ordinarias se celebrarán en los meses establecidos en estos estatutos.',
    esEditable: true,
    orden: 6
  },
  {
    numero: 7,
    titulo: 'Del Patrimonio',
    contenido: 'El patrimonio de la Organización estará formado por las cuotas de incorporación, cuotas ordinarias, bienes que adquiera a cualquier título, y producto de sus actividades.',
    esEditable: true,
    orden: 7
  },
  {
    numero: 8,
    titulo: 'De la Comisión Electoral',
    contenido: 'La Comisión Electoral estará integrada por miembros que no pertenezcan al Directorio y velará por el correcto desarrollo de los procesos eleccionarios.',
    esEditable: true,
    orden: 8
  },
  {
    numero: 9,
    titulo: 'Reforma de Estatutos',
    contenido: 'La reforma del presente estatuto sólo podrá efectuarse en una Asamblea General Extraordinaria convocada para ello, con el voto conforme de la mayoría absoluta de los afiliados.',
    esEditable: true,
    orden: 9
  },
  {
    numero: 10,
    titulo: 'Disolución',
    contenido: 'La disolución voluntaria podrá ser propuesta por el Directorio y aprobada en Asamblea General Extraordinaria. Los bienes pasarán a la entidad designada en estos estatutos.',
    esEditable: true,
    orden: 10
  }
];

// Placeholders comunes
const PLACEHOLDERS_BASE = [
  { key: '{{NOMBRE_ORGANIZACION}}', label: 'Nombre de la Organización', tipo: 'text', required: true },
  { key: '{{FECHA_DIA}}', label: 'Día de constitución', tipo: 'text', required: false },
  { key: '{{FECHA_MES}}', label: 'Mes de constitución', tipo: 'text', required: false },
  { key: '{{FECHA_ANIO}}', label: 'Año de constitución', tipo: 'text', required: false },
  { key: '{{DIRECCION}}', label: 'Dirección', tipo: 'text', required: true },
  { key: '{{MES_ASAMBLEA_1}}', label: 'Primer mes de asamblea ordinaria', tipo: 'month', required: false },
  { key: '{{MES_ASAMBLEA_2}}', label: 'Segundo mes de asamblea ordinaria', tipo: 'month', required: false },
  { key: '{{ENTIDAD_DISOLUCION}}', label: 'Entidad que recibe bienes en disolución', tipo: 'text', required: false, defaultValue: 'Corporación Municipal de Renca' }
];

async function seedEstatutos() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB');

    // Obtener todos los tipos con nombres
    const tiposConNombres = EstatutoTemplate.getTiposConNombres();
    const tipos = Object.keys(tiposConNombres);

    console.log(`\nCreando plantillas para ${tipos.length} tipos de organización...\n`);

    let creados = 0;
    let existentes = 0;

    for (const tipo of tipos) {
      // Verificar si ya existe
      const existing = await EstatutoTemplate.findOne({ tipoOrganizacion: tipo });
      if (existing) {
        console.log(`⏭️  Ya existe: ${tipo}`);
        existentes++;
        continue;
      }

      const tipoInfo = tiposConNombres[tipo];
      const configDirectorio = DIRECTORIO_CONFIG[tipo] || DEFAULT_CONFIG;

      const template = new EstatutoTemplate({
        tipoOrganizacion: tipo,
        nombreTipo: tipoInfo.nombre,
        descripcion: `Estatutos oficiales para ${tipoInfo.nombre} según Ley 19.418`,
        categoria: tipoInfo.categoria,
        articulos: ARTICULOS_BASE,
        directorio: {
          cargos: configDirectorio.cargos,
          totalRequerido: configDirectorio.totalRequerido,
          duracionMandato: 2,
          puedeReelegirse: true,
          maxReelecciones: 2
        },
        miembrosMinimos: configDirectorio.miembrosMinimos,
        comisionElectoral: {
          cantidad: 3,
          descripcion: 'Miembros que organizan las elecciones'
        },
        placeholders: PLACEHOLDERS_BASE,
        publicado: false, // Se publican manualmente después de revisión
        activo: true
      });

      // Generar documento completo
      template.documentoCompleto = template.generarDocumentoCompleto();

      await template.save();
      console.log(`✅ Creado: ${tipoInfo.nombre} (${tipo})`);
      creados++;
    }

    console.log(`\n========================================`);
    console.log(`Plantillas creadas: ${creados}`);
    console.log(`Plantillas existentes (no modificadas): ${existentes}`);
    console.log(`Total tipos: ${tipos.length}`);
    console.log(`========================================\n`);

    console.log('NOTA: Las plantillas se crean como NO PUBLICADAS.');
    console.log('Debe publicarlas desde el panel de administración después de revisarlas.\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
}

seedEstatutos();
