/**
 * Script de Migración: Normalización de Base de Datos
 *
 * Este script migra las organizaciones del formato embebido (v1)
 * al formato normalizado (v2) donde miembros y documentos se almacenan
 * en colecciones separadas.
 *
 * IMPORTANTE:
 * - Hacer backup completo de MongoDB Atlas ANTES de ejecutar
 * - Ejecutar en horario de bajo tráfico
 * - Monitorear logs durante la ejecución
 *
 * Uso:
 *   node scripts/migrate-to-normalized.js [--dry-run] [--batch-size=10] [--org-id=xxx]
 *
 * Opciones:
 *   --dry-run      Simula la migración sin guardar cambios
 *   --batch-size   Número de organizaciones por lote (default: 10)
 *   --org-id       Migrar solo una organización específica
 *   --rollback     Revertir organizaciones migradas
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Importar modelos
import Organization from '../models/Organization.js';
import Member from '../models/Member.js';
import Document from '../models/Document.js';

// Configuración
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social';
const DEFAULT_BATCH_SIZE = 10;

// Parsear argumentos
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : DEFAULT_BATCH_SIZE;
const orgIdArg = args.find(a => a.startsWith('--org-id='));
const SPECIFIC_ORG_ID = orgIdArg ? orgIdArg.split('=')[1] : null;
const isRollback = args.includes('--rollback');

// Estadísticas
const stats = {
  processed: 0,
  migrated: 0,
  skipped: 0,
  errors: 0,
  membersCreated: 0,
  documentsCreated: 0,
  rollbackCount: 0
};

/**
 * Conectar a MongoDB
 */
async function connectDB() {
  console.log('🔌 Conectando a MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Conectado a MongoDB');
}

/**
 * Migra una organización individual
 */
async function migrateOrganization(org) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const memberIds = [];
    const documentIds = [];

    // 1. Procesar members[]
    if (org.members && org.members.length > 0) {
      for (let i = 0; i < org.members.length; i++) {
        const m = org.members[i];

        // Crear miembro normalizado
        const memberData = {
          organizationId: org._id,
          rut: m.rut || `temp-${Date.now()}-${i}`,
          firstName: m.firstName || m.primerNombre || 'Sin nombre',
          lastName: m.lastName || m.apellidoPaterno || '',
          primerNombre: m.primerNombre,
          segundoNombre: m.segundoNombre,
          apellidoPaterno: m.apellidoPaterno,
          apellidoMaterno: m.apellidoMaterno,
          address: m.address,
          phone: m.phone,
          email: m.email,
          birthDate: m.birthDate,
          occupation: m.occupation,
          role: m.role || 'member',
          isFoundingMember: true,
          migratedFrom: 'members',
          originalIndex: i
        };

        if (!isDryRun) {
          const member = new Member(memberData);

          // Crear documento de firma si existe
          if (m.signature && m.signature.length > 100) {
            const sigDoc = new Document({
              organizationId: org._id,
              type: 'signature',
              content: m.signature,
              mimeType: m.signature.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
              signerRut: m.rut,
              signerName: memberData.firstName + ' ' + memberData.lastName,
              signerRole: m.role,
              context: 'migration',
              migratedFrom: 'members.signature',
              originalPath: `members[${i}].signature`
            });
            await sigDoc.save({ session });
            member.signatureId = sigDoc._id;
            documentIds.push(sigDoc._id);
            stats.documentsCreated++;
          }

          // Crear documento de certificado si existe
          if (m.certificate && m.certificate.length > 100) {
            const certDoc = new Document({
              organizationId: org._id,
              type: 'certificate',
              content: m.certificate,
              mimeType: 'image/png',
              signerRut: m.rut,
              context: 'migration',
              migratedFrom: 'members.certificate',
              originalPath: `members[${i}].certificate`
            });
            await certDoc.save({ session });
            member.certificateId = certDoc._id;
            documentIds.push(certDoc._id);
            stats.documentsCreated++;
          }

          await member.save({ session });
          memberIds.push(member._id);
          stats.membersCreated++;
        } else {
          console.log(`  [DRY-RUN] Crearía miembro: ${memberData.firstName} ${memberData.lastName}`);
        }
      }
    }

    // 2. Procesar electoralCommission[]
    if (org.electoralCommission && org.electoralCommission.length > 0) {
      for (let i = 0; i < org.electoralCommission.length; i++) {
        const ec = org.electoralCommission[i];

        // Verificar si ya existe el miembro por RUT
        const existingMember = memberIds.length > 0 && !isDryRun
          ? await Member.findOne({ organizationId: org._id, rut: ec.rut }).session(session)
          : null;

        if (existingMember) {
          // Actualizar miembro existente
          existingMember.isElectoralCommission = true;
          if (!isDryRun) await existingMember.save({ session });
        } else {
          // Crear nuevo miembro de comisión electoral
          const memberData = {
            organizationId: org._id,
            rut: ec.rut || `ec-${Date.now()}-${i}`,
            firstName: ec.firstName || ec.primerNombre || 'Sin nombre',
            lastName: ec.lastName || ec.apellidoPaterno || '',
            role: 'electoral_commission',
            isElectoralCommission: true,
            migratedFrom: 'electoralCommission',
            originalIndex: i
          };

          if (!isDryRun) {
            const member = new Member(memberData);

            if (ec.signature && ec.signature.length > 100) {
              const sigDoc = new Document({
                organizationId: org._id,
                type: 'signature',
                content: ec.signature,
                mimeType: 'image/png',
                signerRut: ec.rut,
                context: 'migration',
                migratedFrom: 'electoralCommission.signature'
              });
              await sigDoc.save({ session });
              member.signatureId = sigDoc._id;
              documentIds.push(sigDoc._id);
              stats.documentsCreated++;
            }

            await member.save({ session });
            memberIds.push(member._id);
            stats.membersCreated++;
          }
        }
      }
    }

    // 3. Procesar ministroSignature
    if (org.ministroSignature && org.ministroSignature.length > 100) {
      if (!isDryRun) {
        const ministroDoc = new Document({
          organizationId: org._id,
          type: 'ministro_signature',
          content: org.ministroSignature,
          mimeType: 'image/png',
          signerRole: 'ministro',
          signerName: org.ministroData?.name,
          signerRut: org.ministroData?.rut,
          context: 'migration',
          migratedFrom: 'ministroSignature'
        });
        await ministroDoc.save({ session });
        documentIds.push(ministroDoc._id);
        stats.documentsCreated++;
      }
    }

    // 4. Procesar validationData.signatures
    if (org.validationData?.signatures) {
      const signatures = org.validationData.signatures;
      for (const [key, value] of Object.entries(signatures)) {
        if (value && typeof value === 'string' && value.length > 100) {
          if (!isDryRun) {
            const sigDoc = new Document({
              organizationId: org._id,
              type: 'signature',
              content: value,
              mimeType: 'image/png',
              description: key,
              context: 'migration',
              migratedFrom: 'validationData.signatures',
              originalPath: `validationData.signatures.${key}`
            });
            await sigDoc.save({ session });
            documentIds.push(sigDoc._id);
            stats.documentsCreated++;
          }
        }
      }
    }

    // 5. Actualizar Organization con referencias
    if (!isDryRun) {
      org.memberIds = memberIds;
      org.documentIds = documentIds;
      org.isNormalized = true;
      org.normalizedAt = new Date();
      org.schemaVersion = 2;
      await org.save({ session });
    }

    await session.commitTransaction();
    return true;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Revierte la migración de una organización
 */
async function rollbackOrganization(org) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Eliminar miembros creados
    if (org.memberIds && org.memberIds.length > 0) {
      await Member.deleteMany({ _id: { $in: org.memberIds } }).session(session);
    }

    // Eliminar documentos creados
    if (org.documentIds && org.documentIds.length > 0) {
      await Document.deleteMany({ _id: { $in: org.documentIds } }).session(session);
    }

    // Revertir flags de organización
    org.memberIds = [];
    org.documentIds = [];
    org.isNormalized = false;
    org.normalizedAt = null;
    org.schemaVersion = 1;
    await org.save({ session });

    await session.commitTransaction();
    return true;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Ejecuta la migración en lotes
 */
async function runMigration() {
  console.log('\n' + '='.repeat(60));
  console.log('MIGRACIÓN: Normalización de Base de Datos');
  console.log('='.repeat(60));
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (sin cambios)' : 'PRODUCCIÓN'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  if (SPECIFIC_ORG_ID) console.log(`Org específica: ${SPECIFIC_ORG_ID}`);
  console.log('='.repeat(60) + '\n');

  // Construir query
  const query = { isNormalized: { $ne: true } };
  if (SPECIFIC_ORG_ID) {
    query._id = SPECIFIC_ORG_ID;
  }

  // Contar total
  const total = await Organization.countDocuments(query);
  console.log(`📊 Organizaciones a migrar: ${total}\n`);

  if (total === 0) {
    console.log('✅ No hay organizaciones pendientes de migración');
    return;
  }

  // Procesar en lotes
  let processed = 0;
  while (processed < total) {
    const batch = await Organization.find(query)
      .skip(processed)
      .limit(BATCH_SIZE);

    if (batch.length === 0) break;

    console.log(`\n📦 Procesando lote ${Math.floor(processed / BATCH_SIZE) + 1} (${batch.length} organizaciones)...`);

    for (const org of batch) {
      stats.processed++;
      const orgName = org.organizationName || org._id;

      try {
        // Verificar si ya está migrada
        if (org.isNormalized) {
          console.log(`  ⏭️  ${orgName} - Ya migrada, saltando`);
          stats.skipped++;
          continue;
        }

        console.log(`  🔄 Migrando: ${orgName}`);
        console.log(`     - ${org.members?.length || 0} miembros`);
        console.log(`     - ${org.electoralCommission?.length || 0} comisión electoral`);

        await migrateOrganization(org);

        console.log(`  ✅ ${orgName} - Migrada exitosamente`);
        stats.migrated++;

      } catch (error) {
        console.error(`  ❌ Error migrando ${orgName}:`, error.message);
        stats.errors++;
      }
    }

    processed += batch.length;
    console.log(`\n📈 Progreso: ${processed}/${total} (${Math.round(processed/total*100)}%)`);
  }
}

/**
 * Ejecuta rollback
 */
async function runRollback() {
  console.log('\n' + '='.repeat(60));
  console.log('ROLLBACK: Revertir Normalización');
  console.log('='.repeat(60));

  const query = { isNormalized: true };
  if (SPECIFIC_ORG_ID) {
    query._id = SPECIFIC_ORG_ID;
  }

  const orgs = await Organization.find(query);
  console.log(`📊 Organizaciones a revertir: ${orgs.length}\n`);

  for (const org of orgs) {
    const orgName = org.organizationName || org._id;
    try {
      console.log(`  🔄 Revirtiendo: ${orgName}`);
      await rollbackOrganization(org);
      console.log(`  ✅ ${orgName} - Revertida exitosamente`);
      stats.rollbackCount++;
    } catch (error) {
      console.error(`  ❌ Error revirtiendo ${orgName}:`, error.message);
      stats.errors++;
    }
  }
}

/**
 * Imprime estadísticas finales
 */
function printStats() {
  console.log('\n' + '='.repeat(60));
  console.log('ESTADÍSTICAS FINALES');
  console.log('='.repeat(60));
  console.log(`Organizaciones procesadas: ${stats.processed}`);
  console.log(`Organizaciones migradas:   ${stats.migrated}`);
  console.log(`Organizaciones saltadas:   ${stats.skipped}`);
  console.log(`Errores:                   ${stats.errors}`);
  console.log(`Miembros creados:          ${stats.membersCreated}`);
  console.log(`Documentos creados:        ${stats.documentsCreated}`);
  if (stats.rollbackCount > 0) {
    console.log(`Rollbacks realizados:      ${stats.rollbackCount}`);
  }
  console.log('='.repeat(60) + '\n');
}

/**
 * Main
 */
async function main() {
  try {
    await connectDB();

    if (isRollback) {
      await runRollback();
    } else {
      await runMigration();
    }

    printStats();

    if (isDryRun) {
      console.log('⚠️  Esto fue un DRY-RUN. No se realizaron cambios.');
      console.log('   Ejecuta sin --dry-run para aplicar la migración.\n');
    }

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB\n');
  }
}

main();
