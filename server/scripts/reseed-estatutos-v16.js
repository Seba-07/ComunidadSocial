/**
 * Script de migración v16: recuperar variables perdidas en artículos 4 y 6
 * Ejecutar con: node --experimental-modules server/scripts/reseed-estatutos-v16.js
 *
 * Cambios:
 * - Art. 4: Reinyectar {{EDAD_MINIMA}} → 'mayores de X años'
 * - Art. 6: Reinyectar {{N_MIEMBROS}} → 'compuesto por N miembros titulares'
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

const ARTICLE_UPDATES = {
  4: {
    titulo: 'Socios (Derechos y Obligaciones)',
    contenido: 'Podrán ser socios todas las personas mayores de {{EDAD_MINIMA}} años que cumplan los requisitos establecidos por la Ley N° 19.418 y que sean aceptados por el Directorio.\n\nSon derechos de los socios:\na) Participar con derecho a voz y voto en las Asambleas Generales;\nb) Elegir y ser elegidos para cargos directivos, de la Comisión Electoral y de la Comisión Revisora de Cuentas;\nc) Presentar cualquier proyecto o proposición al estudio del Directorio o de la Asamblea;\nd) Tener acceso a los libros de actas, de contabilidad y de registro de socios.\n\nSon obligaciones de los socios:\na) Respetar y cumplir las disposiciones de la ley, del presente estatuto y de los acuerdos de las Asambleas y del Directorio;\nb) Asistir a las Asambleas Generales;\nc) Pagar las cuotas sociales, con un monto mensual de {{CUOTA_MENSUAL}};\nd) Desempeñar las comisiones y tareas que les encomiende la Asamblea o el Directorio.'
  },
  6: {
    titulo: 'Directorio (Composición)',
    contenido: 'La dirección y administración de la organización corresponde a un Directorio compuesto por {{N_MIEMBROS}} miembros titulares, elegidos en votación directa y secreta por la Asamblea General.\n\nLos directores durarán {{DURACION_MANDATO}} en sus cargos y podrán ser reelegidos hasta por dos períodos consecutivos, conforme a la Ley N° 19.418. En caso de vacancia, el cargo será provisto por el Directorio, eligiendo entre los socios, por el tiempo que falte para completar el período.'
  }
};

async function reseedV16() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB\n');

    const templates = await EstatutoTemplate.find({ activo: true });
    console.log(`Encontradas ${templates.length} plantillas activas\n`);

    let updated = 0;

    for (const template of templates) {
      let changed = false;

      for (const art of template.articulos) {
        const update = ARTICLE_UPDATES[art.numero];
        if (update && art.contenido !== update.contenido) {
          if (!changed) {
            const oldVersion = template.version || 1;
            template.historialVersiones = template.historialVersiones || [];
            template.historialVersiones.push({
              version: oldVersion,
              fecha: new Date(),
              descripcionCambio: 'Migración v16: Art. 4 {{EDAD_MINIMA}}, Art. 6 {{N_MIEMBROS}} miembros titulares'
            });
            template.version = oldVersion + 1;
          }
          art.titulo = update.titulo;
          art.contenido = update.contenido;
          changed = true;
        }
      }

      if (changed) {
        template.documentoCompleto = template.generarDocumentoCompleto();
        await template.save();
        console.log(`✅ Actualizado: ${template.nombreTipo} (${template.tipoOrganizacion}) → v${template.version}`);
        updated++;
      } else {
        console.log(`⏭️  Sin cambios: ${template.tipoOrganizacion}`);
      }
    }

    console.log(`\n========================================`);
    console.log(`Plantillas actualizadas: ${updated}`);
    console.log(`Total: ${templates.length}`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
}

reseedV16();
