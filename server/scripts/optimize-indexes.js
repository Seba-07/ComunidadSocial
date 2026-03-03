/**
 * Script para optimizar índices de la base de datos.
 * Elimina índices redundantes y verifica los necesarios.
 * Ejecutar: node server/scripts/optimize-indexes.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social';

// Índices redundantes a eliminar:
// Si existe {A: 1, B: 1}, entonces {A: 1} solo es redundante (MongoDB usa el compuesto como prefijo)
const REDUNDANT_INDEXES = [
  // organizations: {status: 1} es prefijo de {status: 1, createdAt: -1}
  { collection: 'organizations', indexName: 'status_1' },
  // organizations: {organizationType: 1} es prefijo de {organizationType: 1, status: 1, createdAt: -1}
  { collection: 'organizations', indexName: 'organizationType_1' },
  // users: {role: 1} es prefijo de {role: 1, active: 1}
  { collection: 'users', indexName: 'role_1' },
  // users: {organizationId: 1} - campo legacy, ahora es organizationIds (array)
  { collection: 'users', indexName: 'organizationId_1' },
];

async function optimizeIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');
    const db = mongoose.connection.db;

    console.log('=== BEFORE: Index Count ===');
    let totalBefore = 0;
    const collections = await db.listCollections().toArray();
    for (const col of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      const indexes = await db.collection(col.name).indexes();
      if (indexes.length > 1) {
        console.log(`  ${col.name}: ${indexes.length} indexes`);
        totalBefore += indexes.length;
      }
    }
    console.log(`  TOTAL: ${totalBefore}\n`);

    console.log('=== DROPPING REDUNDANT INDEXES ===');
    let dropped = 0;
    for (const { collection, indexName } of REDUNDANT_INDEXES) {
      try {
        const indexes = await db.collection(collection).indexes();
        const exists = indexes.find(i => i.name === indexName);
        if (exists) {
          await db.collection(collection).dropIndex(indexName);
          console.log(`  DROPPED: ${collection}.${indexName}`);
          dropped++;
        } else {
          console.log(`  SKIP (not found): ${collection}.${indexName}`);
        }
      } catch (err) {
        console.log(`  ERROR: ${collection}.${indexName} - ${err.message}`);
      }
    }

    console.log(`\n=== AFTER: Index Count ===`);
    let totalAfter = 0;
    for (const col of collections) {
      const indexes = await db.collection(col.name).indexes();
      if (indexes.length > 1) {
        console.log(`  ${col.name}: ${indexes.length} indexes`);
        totalAfter += indexes.length;
      }
    }
    console.log(`  TOTAL: ${totalAfter}`);
    console.log(`\n  Dropped: ${dropped} redundant indexes`);
    console.log(`  Saved: ~${dropped * 36}KB index memory`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

optimizeIndexes();
