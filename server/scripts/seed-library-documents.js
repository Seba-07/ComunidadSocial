/**
 * Script para poblar la Biblioteca de Documentos con documentos iniciales
 * Ejecutar con: node --experimental-modules server/scripts/seed-library-documents.js
 * O desde la raíz: npm run seed:library
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LibraryDocument from '../models/LibraryDocument.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad-social';

const initialDocuments = [
  // === LEYES Y NORMATIVAS ===
  {
    name: 'Ley 19.418 - Juntas de Vecinos y Organizaciones Comunitarias',
    description: 'Ley que establece normas sobre Juntas de Vecinos y demás Organizaciones Comunitarias. Marco legal fundamental para la constitución de organizaciones.',
    category: 'LEYES',
    isPublished: true,
    isPlaceholder: true,
    externalUrl: 'https://www.bcn.cl/leychile/navegar?idNorma=29504'
  },
  {
    name: 'Ley 20.500 - Participación Ciudadana',
    description: 'Ley sobre asociaciones y participación ciudadana en la gestión pública. Establece mecanismos de participación.',
    category: 'LEYES',
    isPublished: true,
    isPlaceholder: true,
    externalUrl: 'https://www.bcn.cl/leychile/navegar?idNorma=1023143'
  },
  {
    name: 'Ley 21.146 - Fortalecimiento de Participación Ciudadana',
    description: 'Modifica la ley 19.418 para fortalecer la participación ciudadana y las organizaciones comunitarias.',
    category: 'LEYES',
    isPublished: true,
    isPlaceholder: true,
    externalUrl: 'https://www.bcn.cl/leychile/navegar?idNorma=1129503'
  },
  {
    name: 'Ley 21.040 - Nueva Educación Pública',
    description: 'Crea el Sistema de Educación Pública. Relevante para Consejos Escolares y organizaciones educativas.',
    category: 'LEYES',
    isPublished: true,
    isPlaceholder: true,
    externalUrl: 'https://www.bcn.cl/leychile/navegar?idNorma=1111237'
  },

  // === GUÍAS Y MANUALES ===
  {
    name: 'Guía de Buenas Prácticas para Consejos Escolares',
    description: 'Recomendaciones para una gestión efectiva de Consejos Escolares. Incluye metodologías y casos de éxito.',
    category: 'GUIAS',
    isPublished: true,
    isPlaceholder: true
  },
  {
    name: 'Manual de Organización para Centro de Padres',
    description: 'Guía completa para organizar actividades, gestionar recursos y fortalecer la participación de padres y apoderados.',
    category: 'GUIAS',
    isPublished: true,
    isPlaceholder: true
  },
  {
    name: 'Guía de Liderazgo Estudiantil',
    description: 'Desarrollo de habilidades de liderazgo para Centros de Estudiantes. Incluye dinámicas y herramientas prácticas.',
    category: 'GUIAS',
    isPublished: true,
    isPlaceholder: true
  },
  {
    name: 'Manual de Constitución de Organizaciones Comunitarias',
    description: 'Guía paso a paso para constituir una organización comunitaria según la Ley 19.418.',
    category: 'GUIAS',
    isPublished: true,
    isPlaceholder: true
  },

  // === FORMULARIOS ===
  {
    name: 'Reglamento Interno para Consejos Escolares',
    description: 'Documento oficial con normativas y procedimientos para Consejos Escolares.',
    category: 'FORMULARIOS',
    isPublished: true,
    isPlaceholder: true
  },
  {
    name: 'Acta de Constitución de Consejo Escolar',
    description: 'Modelo de acta para la constitución formal de un Consejo Escolar.',
    category: 'FORMULARIOS',
    isPublished: true,
    isPlaceholder: true
  },
  {
    name: 'Estatutos Centro de Padres y Apoderados',
    description: 'Marco legal y organizativo modelo para Centros de Padres.',
    category: 'FORMULARIOS',
    isPublished: true,
    isPlaceholder: true
  },
  {
    name: 'Reglamento Centro de Estudiantes',
    description: 'Normativa modelo para la organización estudiantil.',
    category: 'FORMULARIOS',
    isPublished: true,
    isPlaceholder: true
  },

  // === PLANTILLAS ===
  {
    name: 'Plantilla de Acta de Reunión',
    description: 'Formato editable para documentar reuniones de directiva u organizaciones.',
    category: 'PLANTILLAS',
    isPublished: true,
    isPlaceholder: true
  },
  {
    name: 'Plantilla de Libro de Socios',
    description: 'Formato para llevar registro de socios de la organización.',
    category: 'PLANTILLAS',
    isPublished: true,
    isPlaceholder: true
  },
  {
    name: 'Plantilla de Informe de Actividades',
    description: 'Formato para reportar actividades realizadas por la organización.',
    category: 'PLANTILLAS',
    isPublished: true,
    isPlaceholder: true
  },

  // === OTROS ===
  {
    name: 'Información sobre Fondos Concursables 2024',
    description: 'Información sobre fondos disponibles para proyectos comunitarios y educativos.',
    category: 'OTROS',
    isPublished: true,
    isPlaceholder: true
  },
  {
    name: 'Programa de Donaciones Municipales',
    description: 'Información sobre cómo realizar y gestionar donaciones a organizaciones comunitarias.',
    category: 'OTROS',
    isPublished: true,
    isPlaceholder: true
  }
];

async function seedDocuments() {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Verificar cuántos documentos ya existen
    const existingCount = await LibraryDocument.countDocuments();
    console.log(`📚 Documentos existentes: ${existingCount}`);

    if (existingCount > 0) {
      console.log('⚠️  Ya existen documentos. Se agregarán solo los nuevos (sin duplicar).');
    }

    console.log(`📝 Agregando ${initialDocuments.length} documentos...`);

    for (const doc of initialDocuments) {
      // Verificar si ya existe un documento con el mismo nombre
      const exists = await LibraryDocument.findOne({ name: doc.name });
      if (exists) {
        console.log(`⏭️  Saltando (ya existe): ${doc.name}`);
        continue;
      }

      await LibraryDocument.create(doc);
      console.log(`✅ Creado: ${doc.name}`);
    }

    const finalCount = await LibraryDocument.countDocuments();
    console.log(`\n🎉 ¡Completado! Total de documentos en la biblioteca: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

seedDocuments();
