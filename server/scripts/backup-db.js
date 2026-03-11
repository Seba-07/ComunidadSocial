/**
 * Script de backup de la base de datos.
 * Exporta las colecciones principales a JSON.
 * Ejecutar: node server/scripts/backup-db.js
 *
 * Genera un directorio backup-YYYY-MM-DD/ con un JSON por colección.
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social_dev';

// Collections to backup (exclude heavy base64 fields where possible)
const COLLECTIONS = [
  { name: 'users', exclude: ['password', 'timbreVirtual.imagen', 'firmaDigital.imagen'] },
  { name: 'organizations', exclude: ['members', 'electoralCommission', 'comisionElectoral', 'certificatesStep5', 'assemblies', 'estatutos', 'ministroSignature'] },
  { name: 'members' },
  { name: 'assemblies' },
  { name: 'assignments', exclude: ['signatures', 'wizardData.groupPhoto', 'wizardData.ministroSignature'] },
  { name: 'notifications' },
  { name: 'estatutotemplates' },
  { name: 'unidadvecinals' },
  { name: 'news' },
  { name: 'counters' },
  { name: 'guiaconstitucions' },
];

async function backup() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');
    const db = mongoose.connection.db;

    const date = new Date().toISOString().split('T')[0];
    const backupDir = path.join(process.cwd(), `backup-${date}`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`Backup directory: ${backupDir}\n`);

    let totalDocs = 0;
    for (const col of COLLECTIONS) {
      try {
        const projection = {};
        if (col.exclude) {
          col.exclude.forEach(f => { projection[f] = 0; });
        }

        const docs = await db.collection(col.name).find({}, { projection }).toArray();
        const filePath = path.join(backupDir, `${col.name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
        console.log(`  ${col.name}: ${docs.length} docs -> ${col.name}.json`);
        totalDocs += docs.length;
      } catch (err) {
        console.log(`  ${col.name}: SKIP (${err.message})`);
      }
    }

    // Save metadata
    const meta = {
      date: new Date().toISOString(),
      database: MONGODB_URI.split('/').pop()?.split('?')[0] || 'comunidad_social_dev',
      totalCollections: COLLECTIONS.length,
      totalDocuments: totalDocs,
      note: 'Base64/binary fields excluded. Use S3 for document recovery.'
    };
    fs.writeFileSync(path.join(backupDir, '_metadata.json'), JSON.stringify(meta, null, 2));

    console.log(`\nBackup complete: ${totalDocs} documents in ${COLLECTIONS.length} collections`);
    console.log(`Location: ${backupDir}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Backup error:', error);
    process.exit(1);
  }
}

backup();
