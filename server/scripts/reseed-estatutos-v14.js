/**
 * Script de migración: actualizar templates existentes de 10 a 14 artículos
 * Ejecutar con: node --experimental-modules server/scripts/reseed-estatutos-v14.js
 *
 * - Actualiza ARTICULOS a la versión 14 artículos (Ley 19.418)
 * - Actualiza PLACEHOLDERS a 19 campos
 * - Preserva directorio, edadConfig, comisionElectoral y demás configs
 * - Crea entrada en historialVersiones antes de modificar
 * - NO cambia estado publicado
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import EstatutoTemplate from '../models/EstatutoTemplate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad-social';

// 14 artículos v2
const ARTICULOS_V14 = [
  { numero: 1, titulo: 'Constitución y Nombre', contenido: 'Constitúyese una organización comunitaria de tipo {{TIPO_ORGANIZACION}} denominada "{{NOMBRE_ORGANIZACION}}", que se regirá por las disposiciones de la Ley N° 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias, su reglamento, y por las normas del presente estatuto.', esEditable: true, orden: 1 },
  { numero: 2, titulo: 'Objetos', contenido: 'La organización tendrá por objeto:\n\n{{OBJETIVOS}}\n\nPara el cumplimiento de estos fines, la organización podrá celebrar actos y contratos, y ejecutar todas las acciones que sean necesarias y conducentes a la consecución de sus objetivos, dentro del marco legal vigente.', esEditable: true, orden: 2 },
  { numero: 3, titulo: 'Domicilio', contenido: 'El domicilio de la organización será en {{DIRECCION}}, comuna de {{COMUNA}}, {{REGION}}. Su duración será indefinida y el número de sus socios ilimitado, sin perjuicio de los mínimos que exija la ley para su constitución y funcionamiento.', esEditable: true, orden: 3 },
  { numero: 4, titulo: 'Socios (Derechos y Obligaciones)', contenido: 'Podrán ser socios todas las personas que cumplan los requisitos establecidos por la Ley N° 19.418 y que sean aceptados por el Directorio.\n\nSon derechos de los socios:\na) Participar con derecho a voz y voto en las Asambleas Generales;\nb) Elegir y ser elegidos para cargos directivos, de la Comisión Electoral y de la Comisión Revisora de Cuentas;\nc) Presentar cualquier proyecto o proposición al estudio del Directorio o de la Asamblea;\nd) Tener acceso a los libros de actas, de contabilidad y de registro de socios.\n\nSon obligaciones de los socios:\na) Respetar y cumplir las disposiciones de la ley, del presente estatuto y de los acuerdos de las Asambleas y del Directorio;\nb) Asistir a las Asambleas Generales;\nc) Pagar las cuotas sociales, con un monto mensual de {{CUOTA_MENSUAL}};\nd) Desempeñar las comisiones y tareas que les encomiende la Asamblea o el Directorio.', esEditable: true, orden: 4 },
  { numero: 5, titulo: 'Pérdida de Calidad de Socio', contenido: 'La calidad de socio se pierde por las siguientes causales:\n\na) Por renuncia voluntaria, presentada por escrito al Directorio;\nb) Por fallecimiento;\nc) Por exclusión, acordada por el Directorio con el voto conforme de los dos tercios de sus integrantes, fundada en conducta incompatible con los fines de la organización o incumplimiento grave de las obligaciones estatutarias;\nd) Por no pago de cuotas sociales durante un período de seis meses consecutivos, previa notificación por escrito del Tesorero.\n\nEl socio excluido podrá apelar ante la Asamblea General Extraordinaria dentro de los treinta días siguientes a la notificación de la medida. La Asamblea resolverá en definitiva, por mayoría absoluta de los socios presentes con derecho a voto.', esEditable: true, orden: 5 },
  { numero: 6, titulo: 'Directorio (Composición)', contenido: 'La dirección y administración de la organización corresponde a un Directorio compuesto por los cargos establecidos según el tipo de organización, elegidos en votación directa y secreta por la Asamblea General.\n\nLos directores durarán {{DURACION_MANDATO}} años en sus cargos y podrán ser reelegidos hasta por dos períodos consecutivos, conforme a la Ley N° 19.418. En caso de vacancia, el cargo será provisto por el Directorio, eligiendo entre los socios, por el tiempo que falte para completar el período.', esEditable: true, orden: 6 },
  { numero: 7, titulo: 'Funciones de Directivos', contenido: 'Corresponderá al Presidente/a:\na) Representar judicial y extrajudicialmente a la organización;\nb) Presidir las reuniones del Directorio y de la Asamblea General;\nc) Ejecutar los acuerdos del Directorio y de la Asamblea;\nd) Firmar la documentación propia de su cargo y aquella en que deba representar a la organización;\ne) Dar cuenta anual en la Asamblea General Ordinaria de la marcha de la organización y del estado financiero.\n\nCorresponderá al Secretario/a:\na) Llevar el Libro de Actas de las sesiones del Directorio y de las Asambleas;\nb) Despachar las citaciones a asambleas conforme a estos estatutos;\nc) Mantener actualizado el registro de socios;\nd) Certificar la autenticidad de los acuerdos y resoluciones.\n\nCorresponderá al Tesorero/a:\na) Custodiar los bienes y valores de la organización;\nb) Llevar los libros de contabilidad;\nc) Efectuar conjuntamente con el Presidente los pagos acordados y firmar los instrumentos bancarios;\nd) Organizar la cobranza de cuotas y recursos;\ne) Presentar el balance general del movimiento contable de cada período;\nf) Mantener actualizado el inventario de bienes de la organización.\n\nEn caso de ausencia o impedimento del Presidente, lo subrogará el Vicepresidente, y en defecto de éste, el director que designe el propio Directorio.', esEditable: true, orden: 7 },
  { numero: 8, titulo: 'Asambleas', contenido: 'Las Asambleas Generales serán Ordinarias o Extraordinarias. Las Ordinarias se celebrarán en los meses de {{MESES_ASAMBLEA}} de cada año, y en ellas se tratarán las materias señaladas en la Ley N° 19.418.\n\nLas Asambleas Extraordinarias se celebrarán cuando lo acuerde el Directorio o cuando lo solicite, por escrito, a lo menos un tercio de los socios con derecho a voto, indicando el objeto de la reunión.', esEditable: true, orden: 8 },
  { numero: 9, titulo: 'Citaciones y Quórum', contenido: 'Las citaciones a Asambleas Ordinarias y Extraordinarias se realizarán mediante {{METODO_CITACION}}, con una anticipación mínima de {{DIAS_ANTICIPACION}} días a la fecha de la reunión, debiendo indicar lugar, día, hora y tabla de materias a tratar.\n\nNo podrá citarse en una misma comunicación para una segunda reunión cuando por falta de quórum no se lleve a efecto la primera.\n\nLas Asambleas Generales se entenderán legalmente constituidas con la asistencia de, a lo menos, la mitad más uno de los socios con derecho a voto. Si no se reuniere dicho quórum, se dejará constancia en acta y deberá citarse a una nueva asamblea dentro de los quince días siguientes, la cual se celebrará con los socios que asistan.\n\nLos acuerdos se adoptarán por mayoría absoluta de los socios presentes con derecho a voto, salvo que la ley o estos estatutos exijan un quórum especial.', esEditable: true, orden: 9 },
  { numero: 10, titulo: 'Comisión Revisora de Cuentas', contenido: 'La Comisión Revisora de Cuentas estará integrada por tres socios activos que no pertenezcan al Directorio, elegidos por la Asamblea General Ordinaria. Durarán {{DURACION_MANDATO}} años en sus cargos.\n\nCorresponderá a la Comisión Revisora de Cuentas:\na) Inspeccionar las cuentas bancarias y de ahorro de la organización;\nb) Revisar trimestralmente los libros de contabilidad y comprobantes de ingresos y egresos;\nc) Informar a las Asambleas Ordinarias sobre el estado financiero de la organización;\nd) Comprobar la exactitud del inventario de bienes;\ne) Informar por escrito a la Asamblea General Ordinaria sobre el balance anual, sugiriendo su aprobación o rechazo;\nf) Comunicar al Directorio cualquier irregularidad que detecte en el manejo de los recursos.', esEditable: true, orden: 10 },
  { numero: 11, titulo: 'Comisión Electoral', contenido: 'La Comisión Electoral estará integrada por miembros que no pertenezcan al Directorio, elegidos por la Asamblea General Ordinaria. Tendrá a su cargo la organización, supervigilancia y calificación de todos los procesos eleccionarios de la organización, conforme a la Ley N° 19.418.\n\nLe corresponderá especialmente:\na) Recibir las inscripciones de candidatos y verificar el cumplimiento de requisitos;\nb) Preparar las cédulas de votación;\nc) Constituir la mesa receptora de sufragios;\nd) Efectuar el escrutinio y proclamar a los elegidos;\ne) Resolver las reclamaciones que se formulen durante el proceso electoral.', esEditable: true, orden: 11 },
  { numero: 12, titulo: 'Patrimonio', contenido: 'El patrimonio de la organización estará formado por:\na) Las cuotas de incorporación, fijadas en {{CUOTA_INC}};\nb) Las cuotas ordinarias y extraordinarias que acuerde la Asamblea;\nc) Los bienes muebles e inmuebles que adquiera a cualquier título;\nd) Las donaciones, herencias y legados que reciba;\ne) La renta obtenida de su patrimonio;\nf) El producto de actividades y beneficios realizados.\n\nLos fondos de la organización solo podrán destinarse a los fines establecidos en estos estatutos. El Tesorero rendirá cuenta de la gestión financiera en cada Asamblea General Ordinaria.', esEditable: true, orden: 12 },
  { numero: 13, titulo: 'Reforma de Estatutos', contenido: 'La reforma del presente estatuto solo podrá efectuarse en una Asamblea General Extraordinaria especialmente convocada para ello, con el voto conforme de la mayoría absoluta de los socios con derecho a voto. El acta de la asamblea que apruebe la reforma deberá reducirse a escritura pública o protocolizarse ante notario y depositarse en la Secretaría Municipal respectiva.', esEditable: true, orden: 13 },
  { numero: 14, titulo: 'Disolución', contenido: 'La organización podrá disolverse por acuerdo de la Asamblea General Extraordinaria, adoptado con el voto conforme de, a lo menos, los dos tercios de los socios con derecho a voto, y cuando concurran las causales previstas en la Ley N° 19.418.\n\nEn caso de disolución, los bienes de la organización pasarán a {{ENTIDAD_DISOLUCION}}, RUT {{RUT_DISOLUCION}}, o en su defecto a la institución de beneficencia de la comuna que determine la Asamblea.', esEditable: true, orden: 14 }
];

const PLACEHOLDERS_V14 = [
  { key: '{{NOMBRE_ORGANIZACION}}', label: 'Nombre de la Organización', tipo: 'text', required: true },
  { key: '{{TIPO_ORGANIZACION}}', label: 'Tipo de Organización', tipo: 'text', required: true },
  { key: '{{OBJETIVOS}}', label: 'Objetivos de la organización', tipo: 'text', required: false },
  { key: '{{COMUNA}}', label: 'Comuna', tipo: 'text', required: true, defaultValue: 'Renca' },
  { key: '{{REGION}}', label: 'Región', tipo: 'text', required: true, defaultValue: 'Región Metropolitana' },
  { key: '{{DIRECCION}}', label: 'Dirección', tipo: 'text', required: true },
  { key: '{{CUOTA_MENSUAL}}', label: 'Cuota mensual de socios', tipo: 'text', required: false },
  { key: '{{DURACION_MANDATO}}', label: 'Duración del mandato (años)', tipo: 'number', required: true, defaultValue: '2' },
  { key: '{{MESES_ASAMBLEA}}', label: 'Meses de asambleas ordinarias', tipo: 'text', required: true },
  { key: '{{METODO_CITACION}}', label: 'Método de citación', tipo: 'select', required: true, defaultValue: 'carta certificada al domicilio registrado', opciones: [{ value: 'carta_certificada', label: 'Carta certificada al domicilio registrado' }, { value: 'correo_electronico', label: 'Correo electrónico al correo registrado' }, { value: 'aviso_sede', label: 'Aviso publicado en la sede de la organización' }, { value: 'comunicacion_directa', label: 'Comunicación directa a cada socio' }] },
  { key: '{{DIAS_ANTICIPACION}}', label: 'Días de anticipación para citación', tipo: 'number', required: true, defaultValue: '10' },
  { key: '{{CUOTA_INC}}', label: 'Cuota de incorporación (UTM)', tipo: 'text', required: false },
  { key: '{{ENTIDAD_DISOLUCION}}', label: 'Entidad beneficiaria en disolución', tipo: 'text', required: false, defaultValue: 'Corporación Municipal de Renca' },
  { key: '{{RUT_DISOLUCION}}', label: 'RUT entidad beneficiaria', tipo: 'text', required: false },
  { key: '{{MIEMBROS_MINIMOS}}', label: 'Mínimo de socios', tipo: 'number', required: true, defaultValue: '15' },
  { key: '{{NUM_MIEMBROS}}', label: 'Número de miembros actual', tipo: 'number', required: false },
  { key: '{{FECHA_DIA}}', label: 'Día de constitución', tipo: 'text', required: false },
  { key: '{{FECHA_MES}}', label: 'Mes de constitución', tipo: 'text', required: false },
  { key: '{{FECHA_ANIO}}', label: 'Año de constitución', tipo: 'text', required: false }
];

async function reseedV14() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB\n');

    const templates = await EstatutoTemplate.find({ activo: true });
    console.log(`Encontradas ${templates.length} plantillas activas\n`);

    let updated = 0;
    let skipped = 0;

    for (const template of templates) {
      // Skip if already has 14 articles
      if (template.articulos.length === 14 && template.articulos[4]?.titulo === 'Pérdida de Calidad de Socio') {
        console.log(`⏭️  Ya tiene 14 arts: ${template.tipoOrganizacion}`);
        skipped++;
        continue;
      }

      // Create version snapshot before modifying
      const oldVersion = template.version || 1;
      template.historialVersiones = template.historialVersiones || [];
      template.historialVersiones.push({
        version: oldVersion,
        fecha: new Date(),
        descripcionCambio: `Migración automática: 10 → 14 artículos (Ley 19.418 v2)`
      });

      // Update articles and placeholders
      template.articulos = ARTICULOS_V14;
      template.placeholders = PLACEHOLDERS_V14;
      template.version = oldVersion + 1;

      // Regenerate full document
      template.documentoCompleto = template.generarDocumentoCompleto();

      await template.save();
      console.log(`✅ Migrado: ${template.nombreTipo} (${template.tipoOrganizacion}) → v${template.version}`);
      updated++;
    }

    console.log(`\n========================================`);
    console.log(`Plantillas migradas: ${updated}`);
    console.log(`Ya actualizadas (omitidas): ${skipped}`);
    console.log(`Total: ${templates.length}`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
}

reseedV14();
