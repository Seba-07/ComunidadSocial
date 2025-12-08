import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../models/Organization.js';
import Assignment from '../models/Assignment.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social';

async function clearOrganizations() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Contar organizaciones antes de eliminar
    const countBefore = await Organization.countDocuments();
    const assignmentsBefore = await Assignment.countDocuments();
    console.log(`\n📊 Organizaciones encontradas: ${countBefore}`);
    console.log(`📊 Asignaciones encontradas: ${assignmentsBefore}`);

    // Eliminar todas las organizaciones
    console.log('\n🗑️  Eliminando todas las organizaciones...');
    await Organization.deleteMany({});

    // Eliminar todas las asignaciones de ministro
    console.log('🗑️  Eliminando todas las asignaciones de ministro...');
    await Assignment.deleteMany({});

    console.log('\n✅ Todas las organizaciones han sido eliminadas');
    console.log('✅ Todas las asignaciones han sido eliminadas');
    console.log('\n🎉 Base de datos lista para nuevas pruebas');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearOrganizations();
