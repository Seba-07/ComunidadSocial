/**
 * Script de migración: actualizar artículos con nuevos placeholders dinámicos
 * Ejecutar con: node --experimental-modules server/scripts/reseed-estatutos-placeholders.js
 *
 * Cambios:
 * - Art 4°: Agrega {{EDAD_MINIMA}} al primer párrafo, $ {{CUOTA_MENSUAL}} en letra c)
 * - Art 6°: Reemplaza texto genérico por {{N_MIEMBROS}} miembros titulares
 * - Art 11°: Agrega {{MIEMBROS_COMISION_ELECTORAL}} al primer párrafo
 * - Art 12°: Cambia {{CUOTA_INC}} por {{CUOTA_INCORPORACION}}
 * - Placeholders: Agrega EDAD_MINIMA, N_MIEMBROS, MIEMBROS_COMISION_ELECTORAL, CUOTA_INCORPORACION; elimina CUOTA_INC
 * - Preserva todas las demás configuraciones
 * - Crea entrada en historialVersiones antes de modificar
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

// Nuevos textos para los artículos que cambian
const ARTICLE_UPDATES = {
  4: {
    titulo: 'Socios (Derechos y Obligaciones)',
    contenido: 'Podrán ser socios todas las personas mayores de {{EDAD_MINIMA}} años que cumplan los requisitos establecidos por la Ley N° 19.418 y que sean aceptados por el Directorio.\n\nSon derechos de los socios:\na) Participar con derecho a voz y voto en las Asambleas Generales;\nb) Elegir y ser elegidos para cargos directivos, de la Comisión Electoral y de la Comisión Revisora de Cuentas;\nc) Presentar cualquier proyecto o proposición al estudio del Directorio o de la Asamblea;\nd) Tener acceso a los libros de actas, de contabilidad y de registro de socios.\n\nSon obligaciones de los socios:\na) Respetar y cumplir las disposiciones de la ley, del presente estatuto y de los acuerdos de las Asambleas y del Directorio;\nb) Asistir a las Asambleas Generales;\nc) Pagar las cuotas sociales, con un monto mensual de $ {{CUOTA_MENSUAL}};\nd) Desempeñar las comisiones y tareas que les encomiende la Asamblea o el Directorio.'
  },
  6: {
    titulo: 'Directorio (Composición)',
    contenido: 'La dirección y administración de la organización corresponde a un Directorio compuesto por {{N_MIEMBROS}} miembros titulares, elegidos en votación directa y secreta por la Asamblea General.\n\nLos directores durarán {{DURACION_MANDATO}} años en sus cargos y podrán ser reelegidos hasta por dos períodos consecutivos, conforme a la Ley N° 19.418. En caso de vacancia, el cargo será provisto por el Directorio, eligiendo entre los socios, por el tiempo que falte para completar el período.'
  },
  11: {
    titulo: 'Comisión Electoral',
    contenido: 'La Comisión Electoral estará integrada por {{MIEMBROS_COMISION_ELECTORAL}} miembros que no pertenezcan al Directorio, elegidos por la Asamblea General Ordinaria. Tendrá a su cargo la organización, supervigilancia y calificación de todos los procesos eleccionarios de la organización, conforme a la Ley N° 19.418.\n\nLe corresponderá especialmente:\na) Recibir las inscripciones de candidatos y verificar el cumplimiento de requisitos;\nb) Preparar las cédulas de votación;\nc) Constituir la mesa receptora de sufragios;\nd) Efectuar el escrutinio y proclamar a los elegidos;\ne) Resolver las reclamaciones que se formulen durante el proceso electoral.'
  },
  12: {
    titulo: 'Patrimonio',
    contenido: 'El patrimonio de la organización estará formado por:\na) Las cuotas de incorporación, fijadas en {{CUOTA_INCORPORACION}};\nb) Las cuotas ordinarias y extraordinarias que acuerde la Asamblea;\nc) Los bienes muebles e inmuebles que adquiera a cualquier título;\nd) Las donaciones, herencias y legados que reciba;\ne) La renta obtenida de su patrimonio;\nf) El producto de actividades y beneficios realizados.\n\nLos fondos de la organización solo podrán destinarse a los fines establecidos en estos estatutos. El Tesorero rendirá cuenta de la gestión financiera en cada Asamblea General Ordinaria.'
  }
};

// Nuevos placeholders a agregar
const NEW_PLACEHOLDERS = [
  { key: '{{EDAD_MINIMA}}', label: 'Edad mínima para ser socio', tipo: 'number', required: true, defaultValue: '14' },
  { key: '{{N_MIEMBROS}}', label: 'Cantidad de miembros del Directorio', tipo: 'number', required: true, defaultValue: '5' },
  { key: '{{MIEMBROS_COMISION_ELECTORAL}}', label: 'Miembros de la Comisión Electoral', tipo: 'number', required: true, defaultValue: '3' },
  { key: '{{CUOTA_INCORPORACION}}', label: 'Cuota de incorporación', tipo: 'text', required: false }
];

function needsMigration(template) {
  // Check if any article still has old text patterns
  const art4 = template.articulos.find(a => Number(a.numero) === 4);
  const art6 = template.articulos.find(a => Number(a.numero) === 6);
  const art11 = template.articulos.find(a => Number(a.numero) === 11);
  const art12 = template.articulos.find(a => Number(a.numero) === 12);

  if (art4 && !art4.contenido.includes('{{EDAD_MINIMA}}')) return true;
  if (art6 && !art6.contenido.includes('{{N_MIEMBROS}}')) return true;
  if (art11 && !art11.contenido.includes('{{MIEMBROS_COMISION_ELECTORAL}}')) return true;
  if (art12 && art12.contenido.includes('{{CUOTA_INC}}')) return true;

  // Check if placeholders list is missing new ones
  const keys = (template.placeholders || []).map(p => p.key);
  if (!keys.includes('{{EDAD_MINIMA}}')) return true;
  if (!keys.includes('{{N_MIEMBROS}}')) return true;
  if (!keys.includes('{{MIEMBROS_COMISION_ELECTORAL}}')) return true;
  if (!keys.includes('{{CUOTA_INCORPORACION}}')) return true;

  return false;
}

async function reseedPlaceholders() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB\n');

    const templates = await EstatutoTemplate.find({ activo: true });
    console.log(`Encontradas ${templates.length} plantillas activas\n`);

    let updated = 0;
    let skipped = 0;

    for (const template of templates) {
      if (!needsMigration(template)) {
        console.log(`⏭️  Ya actualizada: ${template.tipoOrganizacion}`);
        skipped++;
        continue;
      }

      // Create version snapshot before modifying
      const oldVersion = template.version || 1;
      template.historialVersiones = template.historialVersiones || [];
      template.historialVersiones.push({
        version: oldVersion,
        fecha: new Date(),
        descripcionCambio: 'Migración: placeholders dinámicos (EDAD_MINIMA, N_MIEMBROS, MIEMBROS_COMISION_ELECTORAL, CUOTA_INCORPORACION)'
      });

      // Update specific articles (preserve any admin edits to other articles)
      for (const [numStr, newContent] of Object.entries(ARTICLE_UPDATES)) {
        const num = Number(numStr);
        const idx = template.articulos.findIndex(a => Number(a.numero) === num);
        if (idx !== -1) {
          template.articulos[idx].contenido = newContent.contenido;
          // Only update titulo if it matches expected value (don't override admin customizations)
          if (template.articulos[idx].titulo === newContent.titulo ||
              template.articulos[idx].titulo === ARTICLE_UPDATES[num].titulo) {
            template.articulos[idx].titulo = newContent.titulo;
          }
        }
      }

      // Update placeholders: remove CUOTA_INC, add new ones
      let placeholders = template.placeholders || [];
      placeholders = placeholders.filter(p => p.key !== '{{CUOTA_INC}}');

      for (const newP of NEW_PLACEHOLDERS) {
        if (!placeholders.find(p => p.key === newP.key)) {
          placeholders.push(newP);
        }
      }
      template.placeholders = placeholders;

      template.version = oldVersion + 1;

      // Regenerate full document
      if (typeof template.generarDocumentoCompleto === 'function') {
        template.documentoCompleto = template.generarDocumentoCompleto();
      }

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

reseedPlaceholders();
