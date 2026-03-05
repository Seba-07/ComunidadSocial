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

En {{COMUNA}}, a {{FECHA_ASAMBLEA}}, siendo las {{HORA_INICIO_ASAMBLEA}} horas, en el local ubicado en {{UBICACION_ASAMBLEA}}, ante la presencia del funcionario municipal Sr.(a) {{MINISTRO_FE}} como Ministro de Fe y la concurrencia de los futuros miembros de la Organización que en el listado adjunto se individualizan y firman, tuvo lugar la Asamblea General destinada a aprobar el Estatuto por el que se regirá la Organización y la elección del Directorio Provisional, todo conforme a lo que establece la Ley Nº 19.418 del 09 de octubre de 1995.

Antes de iniciar la sesión, se verificó que existen a lo menos {{TOTAL_SOCIOS}} socios, los cuales cumplen con los requisitos establecidos en la referida Ley y cuyo listado e individualización adjunto, forma parte integrante de la presente Acta de Constitución para todos los efectos legales. Además, se dio lectura al Proyecto de Estatuto propuesto por los Organizadores, el cual, sometido a la consideración de la Asamblea, fue aprobado por {{VOTOS_FAVOR}} votos a favor, {{VOTOS_CONTRA}} en contra y {{ABSTENCIONES}} abstenciones, en la forma de que da cuenta el texto que se inserta al final de la presente Acta y que forma parte integrante para todos los efectos legales.

A continuación, se procedió a elegir a la Directiva Provisional mediante voto nominativo, resultando elegido(a) Presidente(a) quien obtuvo la más alta mayoría y como directores, aquellos que obtuvieron las dos (2) siguientes más altas mayorías de votos, quienes desempeñarán los cargos de Secretario y Tesorero. También, se procedió a elegir a las tres (3) personas que integrarán la Comisión Electoral.

Producida la votación, resultaron elegidos como miembros del Directorio Provisional y Comisión Electoral, los siguientes socios:

DIRECTIVA PROVISIONAL
PRESIDENTE(A): {{PRESIDENTE}} — RUT: {{RUT_PRESIDENTE}}
SECRETARIO(A): {{SECRETARIO}} — RUT: {{RUT_SECRETARIO}}
TESORERO(A): {{TESORERO}} — RUT: {{RUT_TESORERO}}
{{DIRECTORES}}

COMISIÓN ELECTORAL
{{COMISION_ELECTORAL}}

La Comisión Organizadora delega la facultad de tramitar la aprobación de los presentes Estatutos y acepta a nombre de los socios constituyentes, las modificaciones que el Secretario Municipal pueda hacer a tales Estatutos, de acuerdo con el Artículo 7º, inciso final, de la Ley Nº 19.418, a Don(ña) {{PRESIDENTE}}, Presidente(a) de la Organización, quien para estos efectos y para cualquier notificación a la Organización señala el siguiente domicilio: {{DIRECCION}}.

Se levanta la sesión siendo las {{HORA_TERMINO_ASAMBLEA}} horas. Suscriben la presente Acta en señal de ratificación de lo contenido en ella, la Directiva Provisional electa y el Ministro de fe que asistió a la asamblea.

[COLS:2]
{{FIRMA_PRESIDENTE}}
[COL]
{{FIRMA_SECRETARIO}}
[/COLS]

[COLS:2]
{{FIRMA_TESORERO}}
[COL]
{{FIRMA_MINISTRO_FE}}
[/COLS]`;

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

[COLS:2]
{{FIRMA_PRESIDENTE}}
[COL]
{{FIRMA_SECRETARIO}}
[/COLS]

[COLS:2]
{{FIRMA_TESORERO}}
[COL]
{{FIRMA_MINISTRO_FE}}
[/COLS]`;

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

[COLS:2]
{{FIRMA_PRESIDENTE}}
[COL]
{{FIRMA_SECRETARIO}}
[/COLS]

[COLS:2]
{{FIRMA_TESORERO}}
[COL]
{{FIRMA_MINISTRO_FE}}
[/COLS]`;

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

[COLS:2]
{{FIRMA_PRESIDENTE}}
[COL]
{{FIRMA_SECRETARIO}}
[/COLS]

[COLS:2]
{{FIRMA_TESORERO}}
[COL]
{{FIRMA_MINISTRO_FE}}
[/COLS]`;

// ============================================
// Lista de Socios
// ============================================

const LISTA_SOCIOS_ESTANDAR = `LISTADO DE SOCIOS ASISTENTES A LA CONSTITUCIÓN DE LA ORGANIZACIÓN

NOMBRE ORGANIZACIÓN: {{NOMBRE_ORG}}
TIPO DE ORGANIZACIÓN: {{TIPO_ORG}}
COMUNA: {{COMUNA}}
UNIDAD VECINAL: {{UNIDAD_VECINAL}}

SOCIOS FUNDADORES ({{TOTAL_SOCIOS}} miembros):

{{LISTA_SOCIOS}}

FECHA CONSTITUCIÓN: {{FECHA_ASAMBLEA}}
NOMBRE DE LA ORGANIZACIÓN: {{NOMBRE_ORG}}

Los socios arriba individualizados declaran cumplir con los requisitos establecidos en la Ley Nº 19.418 para integrar una Organización Comunitaria, y suscriben el presente listado en la Asamblea General Constitutiva celebrada en {{UBICACION_ASAMBLEA}}, ante la presencia del Ministro de Fe Sr. (a) {{MINISTRO_FE}}.`;

// ============================================
// Nómina del Directorio (Certificación)
// ============================================

const NOMINA_DIRECTORIO_ESTANDAR = `CERTIFICACIÓN

En {{COMUNA}}, a {{FECHA_HOY}}, en cumplimiento a lo que establece el Artículo 8º de la Ley Nº 19.418 de 1995, el Secretario Municipal que suscribe certifica que, la Organización Denominada {{NOMBRE_ORG}} de la Unidad Vecinal Nº {{UNIDAD_VECINAL}} depositó en esta Secretaría Municipal, copia autorizada del Acta de Asamblea Constitutiva.

La citada Asamblea Constitutiva se efectuó el día {{FECHA_ASAMBLEA}} ante el Ministro de Fe Don (ña) {{MINISTRO_FE}} Funcionario (a) municipal, en el local ubicado en {{UBICACION_ASAMBLEA}}.

En dicha sesión, se aprobaron los Estatutos de la Organización y fueron elegidos como integrantes de la Directiva Provisoria y Comisión Electoral, los siguientes socios:

DIRECTIVA PROVISORIA
PRESIDENTE (A): {{PRESIDENTE}} — C.I. Nº {{RUT_PRESIDENTE}}
SECRETARIO (A): {{SECRETARIO}} — C.I. Nº {{RUT_SECRETARIO}}
TESORERO (A): {{TESORERO}} — C.I. Nº {{RUT_TESORERO}}
{{DIRECTORES}}

COMISIÓN ELECTORAL
{{COMISION_ELECTORAL}}

Dicha Organización gozará de Personalidad Jurídica conforme a la Ley Nº 19.418 de 1995, a contar de la fecha del depósito del Acta de Asamblea Constitutiva, la cual fue depositada en la Secretaría Municipal por Don (ña) {{PRESIDENTE}} presidenta (e) de la organización y Don (ña) {{MINISTRO_FE}} en su calidad de Ministro de Fe, con domicilio en Blanco Encalada Nº 1335.

Se entrega este certificado al (a la) Presidente (a) de la Organización para todos los efectos legales derivados de la Ley Nº 19.418. En ausencia del Titular, en el acto de retiro, envíese la presente certificación, por cédula al domicilio fijado por el (la) Presidente (a), en la Asamblea Constitutiva.`;

// ============================================
// Carta de Solicitud (Depósito de Antecedentes)
// ============================================

const CARTA_SOLICITUD_ESTANDAR = `DEPÓSITO DE ANTECEDENTES

TIPO DE ORGANIZACIÓN: {{TIPO_ORG}}
NOMBRE DE LA ORGANIZACIÓN: {{NOMBRE_ORG}}
UNIDAD VECINAL: {{UNIDAD_VECINAL}}

En {{COMUNA}}, a {{FECHA_HOY}} de conformidad a lo que establece la Ley Nº 19.418 del 09 de octubre de 1995, procedo a inscribir en el presente Libro de Registro a la Organización Comunitaria antes señalada.

Los documentos relativos al Acta de Constitución, Aprobación de Estatutos, Listado de Socios, Asistentes y Elección de Directorio Provisional, se encuentran archivados en Carpeta Digital en el Departamento de Registro y Certificación.

DATOS DE LA ORGANIZACIÓN:
Dirección: {{DIRECCION}}
Comuna: {{COMUNA}}, Región {{REGION}}
Email: {{EMAIL}}
Teléfono: {{TELEFONO}}

DIRECTIVA PROVISIONAL:
PRESIDENTE (A): {{PRESIDENTE}} — RUT: {{RUT_PRESIDENTE}}
SECRETARIO (A): {{SECRETARIO}} — RUT: {{RUT_SECRETARIO}}
TESORERO (A): {{TESORERO}} — RUT: {{RUT_TESORERO}}
{{DIRECTORES}}

Duración del mandato: {{DURACION_MANDATO}} año(s)

Objetivos:
{{OBJETIVOS}}`;

// ============================================
// Plantillas a crear
// ============================================

const TEMPLATES = [
  // Acta Constitutiva (4 variantes)
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
  },
  // Lista de Socios
  {
    name: 'Lista de Socios — Estándar',
    documentType: 'lista_socios',
    content: LISTA_SOCIOS_ESTANDAR,
    isDefault: true
  },
  // Nómina Directorio (Certificación)
  {
    name: 'Certificación Municipal — Estándar',
    documentType: 'nomina_directorio',
    content: NOMINA_DIRECTORIO_ESTANDAR,
    isDefault: true
  },
  // Carta de Solicitud (Depósito de Antecedentes)
  {
    name: 'Depósito de Antecedentes — Estándar',
    documentType: 'carta_solicitud',
    content: CARTA_SOLICITUD_ESTANDAR,
    isDefault: true
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
