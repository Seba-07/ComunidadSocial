/**
 * Script de migración: actualizar artículos 3, 4, 6, 10 de templates de estatutos
 * Ejecutar con: node --experimental-modules server/scripts/reseed-estatutos-v15.js
 *
 * Cambios:
 * - Art. 3: Dirección completa (calle + número + UV)
 * - Art. 4: Cuota mejorada "entre [Min] y [Max] [Moneda]"
 * - Art. 6: "año"/"años" condicional via {{DURACION_MANDATO}}
 * - Art. 10: "año"/"años" + {{MES_INFORME}} en letra e)
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

// Articles to update (by numero)
const ARTICLE_UPDATES = {
  3: {
    titulo: 'Domicilio',
    contenido: 'El domicilio de la organización será en {{DIRECCION}}, comuna de {{COMUNA}}, {{REGION}}. Su duración será indefinida y el número de sus socios ilimitado, sin perjuicio de los mínimos que exija la ley para su constitución y funcionamiento.'
  },
  4: {
    titulo: 'Socios (Derechos y Obligaciones)',
    contenido: 'Podrán ser socios todas las personas que cumplan los requisitos establecidos por la Ley N° 19.418 y que sean aceptados por el Directorio.\n\nSon derechos de los socios:\na) Participar con derecho a voz y voto en las Asambleas Generales;\nb) Elegir y ser elegidos para cargos directivos, de la Comisión Electoral y de la Comisión Revisora de Cuentas;\nc) Presentar cualquier proyecto o proposición al estudio del Directorio o de la Asamblea;\nd) Tener acceso a los libros de actas, de contabilidad y de registro de socios.\n\nSon obligaciones de los socios:\na) Respetar y cumplir las disposiciones de la ley, del presente estatuto y de los acuerdos de las Asambleas y del Directorio;\nb) Asistir a las Asambleas Generales;\nc) Pagar las cuotas sociales, con un monto mensual de {{CUOTA_MENSUAL}};\nd) Desempeñar las comisiones y tareas que les encomiende la Asamblea o el Directorio.'
  },
  6: {
    titulo: 'Directorio (Composición)',
    contenido: 'La dirección y administración de la organización corresponde a un Directorio compuesto por los cargos establecidos según el tipo de organización, elegidos en votación directa y secreta por la Asamblea General.\n\nLos directores durarán {{DURACION_MANDATO}} en sus cargos y podrán ser reelegidos hasta por dos períodos consecutivos, conforme a la Ley N° 19.418. En caso de vacancia, el cargo será provisto por el Directorio, eligiendo entre los socios, por el tiempo que falte para completar el período.'
  },
  10: {
    titulo: 'Comisión Revisora de Cuentas',
    contenido: 'La Comisión Revisora de Cuentas estará integrada por tres socios activos que no pertenezcan al Directorio, elegidos por la Asamblea General Ordinaria. Durarán {{DURACION_MANDATO}} en sus cargos.\n\nCorresponderá a la Comisión Revisora de Cuentas:\na) Inspeccionar las cuentas bancarias y de ahorro de la organización;\nb) Revisar trimestralmente los libros de contabilidad y comprobantes de ingresos y egresos;\nc) Informar a las Asambleas Ordinarias sobre el estado financiero de la organización;\nd) Comprobar la exactitud del inventario de bienes;\ne) Informar por escrito a la Asamblea General Ordinaria en el mes de {{MES_INFORME}} sobre el balance anual, sugiriendo su aprobación o rechazo;\nf) Comunicar al Directorio cualquier irregularidad que detecte en el manejo de los recursos.'
  }
};

async function reseedV15() {
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
          // Create version snapshot before first change
          if (!changed) {
            const oldVersion = template.version || 1;
            template.historialVersiones = template.historialVersiones || [];
            template.historialVersiones.push({
              version: oldVersion,
              fecha: new Date(),
              descripcionCambio: 'Migración v15: Art. 3 dirección completa, Art. 4 cuota mejorada, Art. 6/10 año/años + mes informe'
            });
            template.version = oldVersion + 1;
          }
          art.titulo = update.titulo;
          art.contenido = update.contenido;
          changed = true;
        }
      }

      // Add {{MES_INFORME}} placeholder if not present
      const hasMesInforme = template.placeholders.some(p => p.key === '{{MES_INFORME}}');
      if (!hasMesInforme) {
        template.placeholders.push({
          key: '{{MES_INFORME}}',
          label: 'Mes de balance anual (Comisión Revisora)',
          tipo: 'month',
          required: false,
          defaultValue: 'Marzo'
        });
        changed = true;
      }

      if (changed) {
        // Regenerate full document
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

reseedV15();
