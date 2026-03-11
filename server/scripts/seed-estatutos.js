/**
 * Script para crear plantillas de estatutos base para todos los tipos de organización
 * Ejecutar con: node --experimental-modules server/scripts/seed-estatutos.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import EstatutoTemplate from '../models/EstatutoTemplate.js';

// Cargar .env desde server/
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social_dev';

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

  // Centro de Padres y Apoderados - edad mínima 18, 5 directores
  'CENTRO_PADRES': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario General', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15,
    edadConfig: { permiteMenores: false, edadMinima: 18, menoresEnDirectorio: false, menoresEnComisionElectoral: false }
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

  // Club Juvenil - edad mínima 15, directorio permite menores (Art. 20 Ley 19.418)
  'CLUB_JUVENIL': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15,
    edadConfig: { permiteMenores: true, edadMinima: 15, menoresEnDirectorio: true, menoresEnComisionElectoral: false }
  },

  // Agrupación Juvenil - edad mínima 15, directorio permite menores (Art. 20 Ley 19.418)
  'AGRUPACION_JUVENIL': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15,
    edadConfig: { permiteMenores: true, edadMinima: 15, menoresEnDirectorio: true, menoresEnComisionElectoral: false }
  },

  // Organización Scout - edad mínima 15, directorio permite menores (Art. 20 Ley 19.418)
  'ORG_SCOUT': {
    cargos: [
      { id: 'presidente', nombre: 'Jefe/a de Grupo', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Subjefe/a de Grupo', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15,
    edadConfig: { permiteMenores: true, edadMinima: 15, menoresEnDirectorio: true, menoresEnComisionElectoral: false }
  },

  // Organización Indígena - Ley 19.253 (CONADI), validación no municipal
  'ORG_INDIGENA': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 25,
    edadConfig: { permiteMenores: false, edadMinima: 18, menoresEnDirectorio: false, menoresEnComisionElectoral: false }
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

  // Club Adulto Mayor - edad mínima sugerida 60 años
  'CLUB_ADULTO_MAYOR': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a de Bienestar', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15,
    edadConfig: { permiteMenores: false, edadMinima: 60, menoresEnDirectorio: false, menoresEnComisionElectoral: false }
  },

  // Centro de Estudiantes - sin edad mínima, directorio puede ser menor
  'CENTRO_ESTUDIANTES': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a General', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Delegado/a de Cultura', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15,
    edadConfig: { permiteMenores: true, edadMinima: 10, menoresEnDirectorio: true, menoresEnComisionElectoral: true }
  },

  // Consejo Escolar - caso especial: comité institucional con representantes
  'CONSEJO_ESCOLAR': {
    cargos: [
      { id: 'director_establecimiento', nombre: 'Director/a del Establecimiento', color: '#3b82f6', required: true, orden: 1 },
      { id: 'rep_sostenedor', nombre: 'Representante del Sostenedor', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'rep_profesores', nombre: 'Representante Profesores', color: '#10b981', required: true, orden: 3 },
      { id: 'rep_apoderados', nombre: 'Representante Apoderados', color: '#f59e0b', required: true, orden: 4 },
      { id: 'rep_alumnos', nombre: 'Representante Alumnos', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 5,
    edadConfig: { permiteMenores: true, edadMinima: 14, menoresEnDirectorio: true, menoresEnComisionElectoral: false }
  },

  // Comité de Seguridad Ciudadana - funcional estándar Ley 19.418
  'COMITE_SEGURIDAD': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 2 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 3 }
    ],
    totalRequerido: 3,
    miembrosMinimos: 15,
    edadConfig: { permiteMenores: true, edadMinima: 15, menoresEnDirectorio: false, menoresEnComisionElectoral: false }
  },

  // Unión Comunal de Juntas de Vecinos - socios son organizaciones (JV), no personas
  'UNION_COMUNAL_JV': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 3,
    edadConfig: { permiteMenores: false, edadMinima: 18, menoresEnDirectorio: false, menoresEnComisionElectoral: false }
  },

  // Agrupación de Inclusión / Discapacidad - funcional estándar
  'AGRUPACION_INCLUSION': {
    cargos: [
      { id: 'presidente', nombre: 'Presidente/a', color: '#3b82f6', required: true, orden: 1 },
      { id: 'vicepresidente', nombre: 'Vicepresidente/a', color: '#8b5cf6', required: true, orden: 2 },
      { id: 'secretario', nombre: 'Secretario/a', color: '#10b981', required: true, orden: 3 },
      { id: 'tesorero', nombre: 'Tesorero/a', color: '#f59e0b', required: true, orden: 4 },
      { id: 'director1', nombre: 'Director/a', color: '#6366f1', required: true, orden: 5 }
    ],
    totalRequerido: 5,
    miembrosMinimos: 15,
    edadConfig: { permiteMenores: true, edadMinima: 14, menoresEnDirectorio: false, menoresEnComisionElectoral: false }
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

// Artículos base — 14 artículos según Ley 19.418 (v2, ampliados)
const ARTICULOS_BASE = [
  {
    numero: 1,
    titulo: 'Constitución y Nombre',
    contenido: 'Constitúyese una organización comunitaria de tipo {{TIPO_ORGANIZACION}} denominada "{{NOMBRE_ORGANIZACION}}", que se regirá por las disposiciones de la Ley N° 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias, su reglamento, y por las normas del presente estatuto.',
    esEditable: true,
    orden: 1
  },
  {
    numero: 2,
    titulo: 'Objetos',
    contenido: 'La organización tendrá por objeto:\n\n{{OBJETIVOS}}\n\nPara el cumplimiento de estos fines, la organización podrá celebrar actos y contratos, y ejecutar todas las acciones que sean necesarias y conducentes a la consecución de sus objetivos, dentro del marco legal vigente.',
    esEditable: true,
    orden: 2
  },
  {
    numero: 3,
    titulo: 'Domicilio',
    contenido: 'El domicilio de la organización será en {{DIRECCION}}, comuna de {{COMUNA}}, {{REGION}}. Su duración será indefinida y el número de sus socios ilimitado, sin perjuicio de los mínimos que exija la ley para su constitución y funcionamiento.',
    esEditable: true,
    orden: 3
  },
  {
    numero: 4,
    titulo: 'Socios (Derechos y Obligaciones)',
    contenido: 'Podrán ser socios todas las personas mayores de {{EDAD_MINIMA}} años que cumplan los requisitos establecidos por la Ley N° 19.418 y que sean aceptados por el Directorio.\n\nSon derechos de los socios:\na) Participar con derecho a voz y voto en las Asambleas Generales;\nb) Elegir y ser elegidos para cargos directivos, de la Comisión Electoral y de la Comisión Revisora de Cuentas;\nc) Presentar cualquier proyecto o proposición al estudio del Directorio o de la Asamblea;\nd) Tener acceso a los libros de actas, de contabilidad y de registro de socios.\n\nSon obligaciones de los socios:\na) Respetar y cumplir las disposiciones de la ley, del presente estatuto y de los acuerdos de las Asambleas y del Directorio;\nb) Asistir a las Asambleas Generales;\nc) Pagar las cuotas sociales, con un monto mensual de $ {{CUOTA_MENSUAL}};\nd) Desempeñar las comisiones y tareas que les encomiende la Asamblea o el Directorio.',
    esEditable: true,
    orden: 4
  },
  {
    numero: 5,
    titulo: 'Pérdida de Calidad de Socio',
    contenido: 'La calidad de socio se pierde por las siguientes causales:\n\na) Por renuncia voluntaria, presentada por escrito al Directorio;\nb) Por fallecimiento;\nc) Por exclusión, acordada por el Directorio con el voto conforme de los dos tercios de sus integrantes, fundada en conducta incompatible con los fines de la organización o incumplimiento grave de las obligaciones estatutarias;\nd) Por no pago de cuotas sociales durante un período de seis meses consecutivos, previa notificación por escrito del Tesorero.\n\nEl socio excluido podrá apelar ante la Asamblea General Extraordinaria dentro de los treinta días siguientes a la notificación de la medida. La Asamblea resolverá en definitiva, por mayoría absoluta de los socios presentes con derecho a voto.',
    esEditable: true,
    orden: 5
  },
  {
    numero: 6,
    titulo: 'Directorio (Composición)',
    contenido: 'La dirección y administración de la organización corresponde a un Directorio compuesto por {{N_MIEMBROS}} miembros titulares, elegidos en votación directa y secreta por la Asamblea General.\n\nLos directores durarán {{DURACION_MANDATO}} años en sus cargos y podrán ser reelegidos hasta por dos períodos consecutivos, conforme a la Ley N° 19.418. En caso de vacancia, el cargo será provisto por el Directorio, eligiendo entre los socios, por el tiempo que falte para completar el período.',
    esEditable: true,
    orden: 6
  },
  {
    numero: 7,
    titulo: 'Funciones de Directivos',
    contenido: 'Corresponderá al Presidente/a:\na) Representar judicial y extrajudicialmente a la organización;\nb) Presidir las reuniones del Directorio y de la Asamblea General;\nc) Ejecutar los acuerdos del Directorio y de la Asamblea;\nd) Firmar la documentación propia de su cargo y aquella en que deba representar a la organización;\ne) Dar cuenta anual en la Asamblea General Ordinaria de la marcha de la organización y del estado financiero.\n\nCorresponderá al Secretario/a:\na) Llevar el Libro de Actas de las sesiones del Directorio y de las Asambleas;\nb) Despachar las citaciones a asambleas conforme a estos estatutos;\nc) Mantener actualizado el registro de socios;\nd) Certificar la autenticidad de los acuerdos y resoluciones.\n\nCorresponderá al Tesorero/a:\na) Custodiar los bienes y valores de la organización;\nb) Llevar los libros de contabilidad;\nc) Efectuar conjuntamente con el Presidente los pagos acordados y firmar los instrumentos bancarios;\nd) Organizar la cobranza de cuotas y recursos;\ne) Presentar el balance general del movimiento contable de cada período;\nf) Mantener actualizado el inventario de bienes de la organización.\n\nEn caso de ausencia o impedimento del Presidente, lo subrogará el Vicepresidente, y en defecto de éste, el director que designe el propio Directorio.',
    esEditable: true,
    orden: 7
  },
  {
    numero: 8,
    titulo: 'Asambleas',
    contenido: 'Las Asambleas Generales serán Ordinarias o Extraordinarias. Las Ordinarias se celebrarán en los meses de {{MESES_ASAMBLEA}} de cada año, y en ellas se tratarán las materias señaladas en la Ley N° 19.418.\n\nLas Asambleas Extraordinarias se celebrarán cuando lo acuerde el Directorio o cuando lo solicite, por escrito, a lo menos un tercio de los socios con derecho a voto, indicando el objeto de la reunión.',
    esEditable: true,
    orden: 8
  },
  {
    numero: 9,
    titulo: 'Citaciones y Quórum',
    contenido: 'Las citaciones a Asambleas Ordinarias y Extraordinarias se realizarán mediante {{METODO_CITACION}}, con una anticipación mínima de {{DIAS_ANTICIPACION}} días a la fecha de la reunión, debiendo indicar lugar, día, hora y tabla de materias a tratar.\n\nNo podrá citarse en una misma comunicación para una segunda reunión cuando por falta de quórum no se lleve a efecto la primera.\n\nLas Asambleas Generales se entenderán legalmente constituidas con la asistencia de, a lo menos, la mitad más uno de los socios con derecho a voto. Si no se reuniere dicho quórum, se dejará constancia en acta y deberá citarse a una nueva asamblea dentro de los quince días siguientes, la cual se celebrará con los socios que asistan.\n\nLos acuerdos se adoptarán por mayoría absoluta de los socios presentes con derecho a voto, salvo que la ley o estos estatutos exijan un quórum especial.',
    esEditable: true,
    orden: 9
  },
  {
    numero: 10,
    titulo: 'Comisión Revisora de Cuentas',
    contenido: 'La Comisión Revisora de Cuentas estará integrada por tres socios activos que no pertenezcan al Directorio, elegidos por la Asamblea General Ordinaria. Durarán {{DURACION_MANDATO}} años en sus cargos.\n\nCorresponderá a la Comisión Revisora de Cuentas:\na) Inspeccionar las cuentas bancarias y de ahorro de la organización;\nb) Revisar trimestralmente los libros de contabilidad y comprobantes de ingresos y egresos;\nc) Informar a las Asambleas Ordinarias sobre el estado financiero de la organización;\nd) Comprobar la exactitud del inventario de bienes;\ne) Informar por escrito a la Asamblea General Ordinaria sobre el balance anual, sugiriendo su aprobación o rechazo;\nf) Comunicar al Directorio cualquier irregularidad que detecte en el manejo de los recursos.',
    esEditable: true,
    orden: 10
  },
  {
    numero: 11,
    titulo: 'Comisión Electoral',
    contenido: 'La Comisión Electoral estará integrada por {{MIEMBROS_COMISION_ELECTORAL}} miembros que no pertenezcan al Directorio, elegidos por la Asamblea General Ordinaria. Tendrá a su cargo la organización, supervigilancia y calificación de todos los procesos eleccionarios de la organización, conforme a la Ley N° 19.418.\n\nLe corresponderá especialmente:\na) Recibir las inscripciones de candidatos y verificar el cumplimiento de requisitos;\nb) Preparar las cédulas de votación;\nc) Constituir la mesa receptora de sufragios;\nd) Efectuar el escrutinio y proclamar a los elegidos;\ne) Resolver las reclamaciones que se formulen durante el proceso electoral.',
    esEditable: true,
    orden: 11
  },
  {
    numero: 12,
    titulo: 'Patrimonio',
    contenido: 'El patrimonio de la organización estará formado por:\na) Las cuotas de incorporación, fijadas en {{CUOTA_INCORPORACION}};\nb) Las cuotas ordinarias y extraordinarias que acuerde la Asamblea;\nc) Los bienes muebles e inmuebles que adquiera a cualquier título;\nd) Las donaciones, herencias y legados que reciba;\ne) La renta obtenida de su patrimonio;\nf) El producto de actividades y beneficios realizados.\n\nLos fondos de la organización solo podrán destinarse a los fines establecidos en estos estatutos. El Tesorero rendirá cuenta de la gestión financiera en cada Asamblea General Ordinaria.',
    esEditable: true,
    orden: 12
  },
  {
    numero: 13,
    titulo: 'Reforma de Estatutos',
    contenido: 'La reforma del presente estatuto solo podrá efectuarse en una Asamblea General Extraordinaria especialmente convocada para ello, con el voto conforme de la mayoría absoluta de los socios con derecho a voto. El acta de la asamblea que apruebe la reforma deberá reducirse a escritura pública o protocolizarse ante notario y depositarse en la Secretaría Municipal respectiva.',
    esEditable: true,
    orden: 13
  },
  {
    numero: 14,
    titulo: 'Disolución',
    contenido: 'La organización podrá disolverse por acuerdo de la Asamblea General Extraordinaria, adoptado con el voto conforme de, a lo menos, los dos tercios de los socios con derecho a voto, y cuando concurran las causales previstas en la Ley N° 19.418.\n\nEn caso de disolución, los bienes de la organización pasarán a {{ENTIDAD_DISOLUCION}}, RUT {{RUT_DISOLUCION}}, o en su defecto a la institución de beneficencia de la comuna que determine la Asamblea.',
    esEditable: true,
    orden: 14
  }
];

// Placeholders — 19 campos para sustitución en artículos
const PLACEHOLDERS_BASE = [
  { key: '{{NOMBRE_ORGANIZACION}}', label: 'Nombre de la Organización', tipo: 'text', required: true },
  { key: '{{TIPO_ORGANIZACION}}', label: 'Tipo de Organización', tipo: 'text', required: true },
  { key: '{{OBJETIVOS}}', label: 'Objetivos de la organización', tipo: 'text', required: false },
  { key: '{{COMUNA}}', label: 'Comuna', tipo: 'text', required: true, defaultValue: 'Renca' },
  { key: '{{REGION}}', label: 'Región', tipo: 'text', required: true, defaultValue: 'Región Metropolitana' },
  { key: '{{DIRECCION}}', label: 'Dirección', tipo: 'text', required: true },
  { key: '{{EDAD_MINIMA}}', label: 'Edad mínima para ser socio', tipo: 'number', required: true, defaultValue: '14' },
  { key: '{{N_MIEMBROS}}', label: 'Cantidad de miembros del Directorio', tipo: 'number', required: true, defaultValue: '5' },
  { key: '{{MIEMBROS_COMISION_ELECTORAL}}', label: 'Miembros de la Comisión Electoral', tipo: 'number', required: true, defaultValue: '3' },
  { key: '{{CUOTA_MENSUAL}}', label: 'Cuota mensual de socios', tipo: 'text', required: false },
  { key: '{{CUOTA_INCORPORACION}}', label: 'Cuota de incorporación', tipo: 'text', required: false },
  { key: '{{DURACION_MANDATO}}', label: 'Duración del mandato (años)', tipo: 'number', required: true, defaultValue: '2' },
  { key: '{{MESES_ASAMBLEA}}', label: 'Meses de asambleas ordinarias', tipo: 'text', required: true },
  { key: '{{METODO_CITACION}}', label: 'Método de citación', tipo: 'select', required: true, defaultValue: 'carta certificada al domicilio registrado', opciones: [{ value: 'carta_certificada', label: 'Carta certificada al domicilio registrado' }, { value: 'correo_electronico', label: 'Correo electrónico al correo registrado' }, { value: 'aviso_sede', label: 'Aviso publicado en la sede de la organización' }, { value: 'comunicacion_directa', label: 'Comunicación directa a cada socio' }] },
  { key: '{{DIAS_ANTICIPACION}}', label: 'Días de anticipación para citación', tipo: 'number', required: true, defaultValue: '10' },
  { key: '{{ENTIDAD_DISOLUCION}}', label: 'Entidad beneficiaria en disolución', tipo: 'text', required: false, defaultValue: 'Corporación Municipal de Renca' },
  { key: '{{RUT_DISOLUCION}}', label: 'RUT entidad beneficiaria', tipo: 'text', required: false },
  { key: '{{MIEMBROS_MINIMOS}}', label: 'Mínimo de socios', tipo: 'number', required: true, defaultValue: '15' },
  { key: '{{NUM_MIEMBROS}}', label: 'Número de miembros actual', tipo: 'number', required: false },
  { key: '{{FECHA_DIA}}', label: 'Día de constitución', tipo: 'text', required: false },
  { key: '{{FECHA_MES}}', label: 'Mes de constitución', tipo: 'text', required: false },
  { key: '{{FECHA_ANIO}}', label: 'Año de constitución', tipo: 'text', required: false }
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

      const templateData = {
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
        publicado: false,
        activo: true
      };

      // Apply edadConfig if specified for this type
      if (configDirectorio.edadConfig) {
        templateData.edadConfig = configDirectorio.edadConfig;
      }

      const template = new EstatutoTemplate(templateData);

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
