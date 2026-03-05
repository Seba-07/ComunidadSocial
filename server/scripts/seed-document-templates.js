/**
 * Seeder: Plantillas de Documentos PDF
 * Crea 4 plantillas base de acta_constitutiva con texto basado en Ley 19.418
 *
 * Uso: node server/scripts/seed-document-templates.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import DocumentTemplate from '../models/DocumentTemplate.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidadsocial';

// ============================================
// Contenido base del Acta Constitutiva (texto actual de PDFService convertido a plantilla)
// ============================================

const ACTA_ESTANDAR = `ACTA DE ASAMBLEA GENERAL CONSTITUTIVA DE ESTATUTO
Y ELECCIÓN DE DIRECTIVA PROVISIONAL

TIPO DE ORGANIZACIÓN: {{TIPO_ORG}}
NOMBRE INSTITUCIÓN: {{NOMBRE_ORG}}

ACTA DE ASAMBLEA

En {{COMUNA}}, a {{FECHA_ASAMBLEA}}, siendo las {{HORA_ASAMBLEA}} horas, en el local ubicado en {{UBICACION_ASAMBLEA}}, ante la presencia del funcionario municipal Sr. (a) {{MINISTRO_FE}} como Ministro de Fe y la concurrencia de los futuros miembros de la Organización que en el listado adjunto se individualizan y firman, tuvo lugar la Asamblea General destinar a aprobar el Estatuto por el que se regirá la Organización y la elección del Directorio Provisional, todo conforme a lo que establece la Ley Nº 19.418 del 09 de octubre de 1995.

Antes de iniciar la sesión, se verificó que existen a lo menos {{TOTAL_SOCIOS}} socios, los cuales cumplen con los requisitos establecidos en la referida Ley y cuyo listado e individualización adjunto, forma parte integrante de la presente Acta de Constitución para todos los efectos legales. Además, se dio lectura al Proyecto de Estatuto propuesto por los Organizadores, el cual, sometido a la consideración de la Asamblea, fue aprobado en la forma de que da cuenta el texto que se inserta al final de la presente Acta y que forma parte integrante para todos los efectos legales. A continuación, se procedió a elegir a la Directiva Provisional mediante voto nominativo, resultando elegido (a) Presidente (a) quien obtuvo la más alta mayoría y como directores, aquellos que obtuvieron las dos (2) siguientes más altas mayorías de votos, quienes desempeñarán los cargos de Secretario y Tesorero.

También, se procedió a elegir a las tres (3) personas que integrarán la Comisión Electoral.

Producida la votación, resultaron elegidos como miembros del Directorio Provisional, los siguientes socios:

DIRECTIVA PROVISIONAL
PRESIDENTE (A): {{PRESIDENTE}} — RUT: {{RUT_PRESIDENTE}}
SECRETARIO (A): {{SECRETARIO}} — RUT: {{RUT_SECRETARIO}}
TESORERO (A): {{TESORERO}} — RUT: {{RUT_TESORERO}}
{{DIRECTORES}}

COMISIÓN ELECTORAL
{{COMISION_ELECTORAL}}

La Comisión Organizadora delega la facultad de tramitar la aprobación de los presentes Estatutos y acepta a nombre de los socios constituyentes, las modificaciones que el Secretario Municipal pueda hacer a tales Estatutos, de acuerdo con el Artículo 7º, inciso final, de la Ley Nº 19.418, a Don (ña) {{PRESIDENTE}} Presidente (a) de la Organización, quien para estos efectos y para cualquier notificación a la Organización señala el siguiente domicilio: {{DIRECCION}}

Suscriben la presente Acta en señal de ratificación de lo contenido en ella, la Directiva Provisional electa y el Ministro de fe que asistió a la asamblea.`;

const ACTA_UNION_COMUNAL = `ACTA DE ASAMBLEA GENERAL CONSTITUTIVA
UNIÓN COMUNAL DE ORGANIZACIONES COMUNITARIAS

TIPO DE ORGANIZACIÓN: {{TIPO_ORG}}
NOMBRE INSTITUCIÓN: {{NOMBRE_ORG}}

ACTA DE ASAMBLEA CONSTITUTIVA

En {{COMUNA}}, Región {{REGION}}, a {{FECHA_ASAMBLEA}}, siendo las {{HORA_ASAMBLEA}} horas, en el local ubicado en {{UBICACION_ASAMBLEA}}, ante la presencia del funcionario municipal Sr. (a) {{MINISTRO_FE}} como Ministro de Fe, se reunieron los representantes de las organizaciones comunitarias que en el listado adjunto se individualizan, con el objeto de constituir la Unión Comunal conforme a lo establecido en el Título V de la Ley Nº 19.418.

Se verificó la asistencia de {{TOTAL_SOCIOS}} organizaciones afiliadas, cumpliendo con el quórum mínimo establecido por ley. Se procedió a dar lectura y aprobar los Estatutos que regirán la Unión Comunal.

Acto seguido, se eligió la Directiva Provisional:

DIRECTIVA PROVISIONAL
PRESIDENTE (A): {{PRESIDENTE}} — RUT: {{RUT_PRESIDENTE}}
SECRETARIO (A): {{SECRETARIO}} — RUT: {{RUT_SECRETARIO}}
TESORERO (A): {{TESORERO}} — RUT: {{RUT_TESORERO}}
{{DIRECTORES}}

COMISIÓN ELECTORAL
{{COMISION_ELECTORAL}}

Se delega en {{PRESIDENTE}}, Presidente(a) de la Unión Comunal, la facultad de tramitar ante la Secretaría Municipal la aprobación de los presentes Estatutos, fijando como domicilio: {{DIRECCION}}

Firman los presentes en señal de conformidad.`;

const ACTA_ESCOLAR = `ACTA DE ASAMBLEA CONSTITUTIVA
ORGANIZACIÓN ESTUDIANTIL / CENTRO DE PADRES

TIPO DE ORGANIZACIÓN: {{TIPO_ORG}}
NOMBRE INSTITUCIÓN: {{NOMBRE_ORG}}

ACTA DE ASAMBLEA CONSTITUTIVA

En {{COMUNA}}, a {{FECHA_ASAMBLEA}}, siendo las {{HORA_ASAMBLEA}} horas, en las dependencias del establecimiento educacional ubicado en {{UBICACION_ASAMBLEA}}, ante la presencia del funcionario municipal Sr. (a) {{MINISTRO_FE}} como Ministro de Fe, se reunieron los {{TOTAL_SOCIOS}} miembros que suscriben la presente acta, con el propósito de constituir la organización estudiantil denominada "{{NOMBRE_ORG}}", de conformidad con la Ley Nº 19.418 y la normativa educacional vigente.

Se procedió a la lectura y aprobación de los Estatutos, y a la elección de la Directiva con mandato de {{DURACION_MANDATO}} año(s):

DIRECTIVA
PRESIDENTE (A): {{PRESIDENTE}} — RUT: {{RUT_PRESIDENTE}}
SECRETARIO (A): {{SECRETARIO}} — RUT: {{RUT_SECRETARIO}}
TESORERO (A): {{TESORERO}} — RUT: {{RUT_TESORERO}}
{{DIRECTORES}}

COMISIÓN ELECTORAL
{{COMISION_ELECTORAL}}

Se faculta a {{PRESIDENTE}} para tramitar la aprobación de los Estatutos, con domicilio en: {{DIRECCION}}

Suscriben la presente Acta los miembros de la Directiva y el Ministro de Fe.`;

const ACTA_INDIGENA = `ACTA DE ASAMBLEA GENERAL CONSTITUTIVA
ORGANIZACIÓN INDÍGENA

TIPO DE ORGANIZACIÓN: {{TIPO_ORG}}
NOMBRE INSTITUCIÓN: {{NOMBRE_ORG}}

ACTA DE ASAMBLEA CONSTITUTIVA

En {{COMUNA}}, Región {{REGION}}, a {{FECHA_ASAMBLEA}}, siendo las {{HORA_ASAMBLEA}} horas, en el local ubicado en {{UBICACION_ASAMBLEA}}, ante la presencia del funcionario municipal Sr. (a) {{MINISTRO_FE}} como Ministro de Fe, se reunieron los {{TOTAL_SOCIOS}} miembros que suscriben la presente acta, pertenecientes a pueblos originarios, con el propósito de constituir la organización indígena denominada "{{NOMBRE_ORG}}", de conformidad con la Ley Nº 19.418 y la Ley Nº 19.253 (Ley Indígena).

Se procedió a la lectura y aprobación de los Estatutos que regirán la organización, respetando las costumbres y tradiciones propias de los pueblos originarios, y a la elección de la Directiva con mandato de {{DURACION_MANDATO}} año(s):

DIRECTIVA
PRESIDENTE (A): {{PRESIDENTE}} — RUT: {{RUT_PRESIDENTE}}
SECRETARIO (A): {{SECRETARIO}} — RUT: {{RUT_SECRETARIO}}
TESORERO (A): {{TESORERO}} — RUT: {{RUT_TESORERO}}
{{DIRECTORES}}

COMISIÓN ELECTORAL
{{COMISION_ELECTORAL}}

Se delega en {{PRESIDENTE}}, Presidente(a) de la organización, la facultad de tramitar ante la Secretaría Municipal la aprobación de los presentes Estatutos, con domicilio en: {{DIRECCION}}

Objetivos de la organización:
{{OBJETIVOS}}

Suscriben la presente Acta los miembros de la Directiva y el Ministro de Fe.`;

// ============================================
// Plantillas a crear
// ============================================

const TEMPLATES = [
  {
    name: 'Estándar Ley 19.418',
    documentType: 'acta_constitutiva',
    content: ACTA_ESTANDAR,
    isDefault: true
  },
  {
    name: 'Unión Comunal',
    documentType: 'acta_constitutiva',
    content: ACTA_UNION_COMUNAL,
    isDefault: false
  },
  {
    name: 'Escolar',
    documentType: 'acta_constitutiva',
    content: ACTA_ESCOLAR,
    isDefault: false
  },
  {
    name: 'Indígena',
    documentType: 'acta_constitutiva',
    content: ACTA_INDIGENA,
    isDefault: false
  }
];

// ============================================
// Ejecución
// ============================================

async function seed() {
  console.log('🌱 Conectando a MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Conectado');

  let created = 0;
  let skipped = 0;

  for (const tmpl of TEMPLATES) {
    const existing = await DocumentTemplate.findOne({
      name: tmpl.name,
      documentType: tmpl.documentType
    });

    if (existing) {
      console.log(`⏭️  Ya existe: "${tmpl.name}" (${tmpl.documentType})`);
      skipped++;
      continue;
    }

    await DocumentTemplate.create(tmpl);
    console.log(`✅ Creada: "${tmpl.name}" (${tmpl.documentType})${tmpl.isDefault ? ' [DEFAULT]' : ''}`);
    created++;
  }

  console.log(`\n📊 Resumen: ${created} creadas, ${skipped} omitidas (ya existían)`);
  console.log(`📋 Total en BD: ${await DocumentTemplate.countDocuments()}`);

  await mongoose.disconnect();
  console.log('🔌 Desconectado');
}

seed().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
