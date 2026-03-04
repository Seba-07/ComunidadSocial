/**
 * Script para poblar objetivosSugeridos en plantillas de estatutos existentes.
 * Idempotente: no sobreescribe plantillas que ya tengan objetivos.
 * Ejecutar con: node --experimental-modules server/scripts/seed-objetivos.js
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

const OBJETIVOS_POR_TIPO = {
  JUNTA_VECINOS: [
    'Promover el desarrollo de la comunidad territorial y la participación ciudadana',
    'Representar a los vecinos ante autoridades municipales y otros organismos',
    'Gestionar el mejoramiento de espacios públicos, áreas verdes e infraestructura del barrio',
    'Organizar actividades de integración social, cultural y recreativa para los vecinos',
    'Velar por la seguridad y convivencia pacífica en la unidad vecinal'
  ],
  CLUB_DEPORTIVO: [
    'Fomentar la práctica deportiva y la vida sana entre sus socios y la comunidad',
    'Organizar competencias, campeonatos y actividades deportivas periódicas',
    'Gestionar espacios e implementación deportiva para el desarrollo de las actividades',
    'Promover la formación deportiva de niños, jóvenes y adultos de la comuna',
    'Representar a la comunidad en campeonatos y torneos a nivel local y regional'
  ],
  CLUB_ADULTO_MAYOR: [
    'Promover el bienestar físico, mental y social de las personas mayores',
    'Organizar actividades recreativas, culturales y de esparcimiento',
    'Facilitar el acceso a programas de salud, talleres y capacitaciones',
    'Fomentar la participación activa y la integración social de los adultos mayores',
    'Gestionar beneficios y convenios para mejorar la calidad de vida de los socios'
  ],
  CENTRO_MADRES: [
    'Promover el desarrollo personal, laboral y social de las socias',
    'Organizar talleres de capacitación y emprendimiento',
    'Fomentar la participación comunitaria y el apoyo mutuo entre mujeres',
    'Gestionar redes de apoyo y acceso a programas sociales',
    'Difundir los derechos de la mujer y la igualdad de género'
  ],
  ORG_MUJERES: [
    'Promover el desarrollo personal, laboral y social de las socias',
    'Organizar talleres de capacitación y emprendimiento',
    'Fomentar la participación comunitaria y el apoyo mutuo entre mujeres',
    'Gestionar redes de apoyo y acceso a programas sociales',
    'Difundir los derechos de la mujer y la igualdad de género'
  ],
  COMITE_VIVIENDA: [
    'Gestionar soluciones habitacionales para las familias socias',
    'Representar a los socios ante organismos públicos vinculados a la vivienda (SERVIU, MINVU)',
    'Organizar y administrar proyectos de postulación a subsidios habitacionales',
    'Promover la participación activa de las familias en el proceso de obtención de vivienda',
    'Realizar actividades de recaudación de fondos para el proyecto habitacional'
  ],
  COMITE_ALLEGADOS: [
    'Gestionar soluciones habitacionales para las familias socias',
    'Representar a los socios ante organismos públicos vinculados a la vivienda (SERVIU, MINVU)',
    'Organizar y administrar proyectos de postulación a subsidios habitacionales',
    'Promover la participación activa de las familias en el proceso de obtención de vivienda',
    'Realizar actividades de recaudación de fondos para el proyecto habitacional'
  ],
  CENTRO_PADRES: [
    'Fomentar la formación y desarrollo integral de los hijos',
    'Integrar a los padres y apoderados en la comunidad educativa',
    'Establecer vínculos entre el hogar y la escuela',
    'Proponer iniciativas de formación integral para los estudiantes',
    'Participar en programas de desarrollo educativo de la institución'
  ],
  CLUB_CULTURAL: [
    'Promover actividades artísticas y culturales en la comunidad',
    'Organizar talleres, exposiciones y eventos culturales',
    'Rescatar y difundir el patrimonio cultural local',
    'Fomentar la creación artística entre los socios',
    'Gestionar espacios para la realización de actividades culturales'
  ],
  CENTRO_CULTURAL: [
    'Promover actividades artísticas y culturales en la comunidad',
    'Organizar talleres, exposiciones y eventos culturales',
    'Rescatar y difundir el patrimonio cultural local',
    'Fomentar la creación artística entre los socios',
    'Gestionar espacios para la realización de actividades culturales'
  ],
  AGRUPACION_CULTURAL: [
    'Promover actividades artísticas y culturales en la comunidad',
    'Organizar talleres, exposiciones y eventos culturales',
    'Rescatar y difundir el patrimonio cultural local',
    'Fomentar la creación artística entre los socios',
    'Gestionar espacios para la realización de actividades culturales'
  ],
  COMITE_SEGURIDAD: [
    'Promover la seguridad ciudadana en el barrio',
    'Organizar sistemas de vigilancia vecinal',
    'Coordinar con Carabineros y autoridades locales en prevención del delito',
    'Fomentar la prevención del delito y la convivencia pacífica',
    'Gestionar iluminación y mejoras de infraestructura de seguridad'
  ]
};

const DEFAULT_OBJECTIVES = [
  'Promover la integración, participación y desarrollo de la comunidad',
  'Canalizar las aptitudes, intereses y capacidades de sus miembros',
  'Organizar actividades que contribuyan al cumplimiento de sus fines',
  'Gestionar recursos para el desarrollo de las actividades de la organización',
  'Representar a los socios ante las autoridades e instituciones pertinentes'
];

async function seedObjetivos() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado.\n');

    const templates = await EstatutoTemplate.find({ activo: true });
    console.log(`Encontradas ${templates.length} plantillas activas.\n`);

    let updated = 0;
    let skipped = 0;

    for (const template of templates) {
      if (template.objetivosSugeridos && template.objetivosSugeridos.length > 0) {
        console.log(`SKIP (ya tiene objetivos): ${template.tipoOrganizacion}`);
        skipped++;
        continue;
      }

      const objectives = OBJETIVOS_POR_TIPO[template.tipoOrganizacion] || DEFAULT_OBJECTIVES;
      template.objetivosSugeridos = objectives;
      await template.save();
      console.log(`ACTUALIZADO: ${template.tipoOrganizacion} (${objectives.length} objetivos)`);
      updated++;
    }

    console.log(`\n================================`);
    console.log(`Actualizados: ${updated}`);
    console.log(`Omitidos: ${skipped}`);
    console.log(`================================\n`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado.');
  }
}

seedObjetivos();
