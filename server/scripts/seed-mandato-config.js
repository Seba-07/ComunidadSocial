/**
 * Migración: configurar mandatoTipo, mandatoOpciones y requiereDirectorioProvisorio
 * por tipo de organización según Ley 19.418 y normativas específicas.
 * Ejecutar: node --experimental-modules server/scripts/seed-mandato-config.js
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

// Excepciones a la regla general
const EXCEPCIONES = {
  // Excepción 1: Centro de Estudiantes y Consejo Escolar
  CENTRO_ESTUDIANTES: { mandatoTipo: 'fijo', mandatoOpciones: [1], requiereDirectorioProvisorio: false },
  CONSEJO_ESCOLAR:    { mandatoTipo: 'fijo', mandatoOpciones: [1], requiereDirectorioProvisorio: false },

  // Excepción 2: Centro de Padres y Apoderados
  CENTRO_PADRES: { mandatoTipo: 'variable', mandatoOpciones: [1, 2], requiereDirectorioProvisorio: false },

  // Excepción 3: Organización Indígena
  ORG_INDIGENA: { mandatoTipo: 'variable', mandatoOpciones: [2, 3, 4], requiereDirectorioProvisorio: false },

  // Excepción 4: Club Deportivo
  CLUB_DEPORTIVO: { mandatoTipo: 'variable', mandatoOpciones: [1, 2, 3, 4], requiereDirectorioProvisorio: true }
};

// Regla general (Ley 19.418)
const REGLA_GENERAL = { mandatoTipo: 'fijo', mandatoOpciones: [3], requiereDirectorioProvisorio: true };

async function seedMandatoConfig() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado.\n');

    const templates = await EstatutoTemplate.find({ activo: true });
    console.log(`Encontradas ${templates.length} plantillas activas.\n`);

    let updated = 0;

    for (const template of templates) {
      const config = EXCEPCIONES[template.tipoOrganizacion] || REGLA_GENERAL;

      template.mandatoTipo = config.mandatoTipo;
      template.mandatoOpciones = config.mandatoOpciones;
      template.requiereDirectorioProvisorio = config.requiereDirectorioProvisorio;

      // Also update duracionMandato in directorio to match first option
      if (template.directorio) {
        template.directorio.duracionMandato = config.mandatoOpciones[0];
      }

      await template.save();

      const isExcepcion = EXCEPCIONES[template.tipoOrganizacion] ? ' (EXCEPCION)' : '';
      console.log(`${template.tipoOrganizacion}: ${config.mandatoTipo} [${config.mandatoOpciones}] provisorio=${config.requiereDirectorioProvisorio}${isExcepcion}`);
      updated++;
    }

    console.log(`\n================================`);
    console.log(`Actualizados: ${updated}`);
    console.log(`================================\n`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado.');
  }
}

seedMandatoConfig();
