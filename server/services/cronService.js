import cron from 'node-cron';
import mongoose from 'mongoose';
import Organization from '../models/Organization.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';

/**
 * Servicio de tareas programadas para gestión automática
 * del ciclo de vida de directorios (Ley 19.418).
 */

// Marcar directorios vencidos (boardExpirationDate < hoy)
async function expireBoards() {
  const now = new Date();
  const expired = await Organization.find({
    boardStatus: 'VIGENTE',
    boardExpirationDate: { $lt: now }
  }).select('_id organizationName userId boardExpirationDate');

  if (expired.length === 0) return;

  console.log(`[CRON] Marcando ${expired.length} directorio(s) como VENCIDA`);

  for (const org of expired) {
    await Organization.updateOne(
      { _id: org._id },
      { $set: { boardStatus: 'VENCIDA' } }
    );

    // Audit log
    AuditLog.logAction({
      action: 'STATUS_CHANGE',
      resource: 'ORGANIZATION',
      resourceId: org._id,
      resourceName: org.organizationName,
      detail: 'El mandato del directorio ha caducado automáticamente',
      details: { previousStatus: 'VIGENTE', newStatus: 'VENCIDA', boardExpirationDate: org.boardExpirationDate }
    }).catch(() => {});

    // Notificar al dueño de la organización
    if (org.userId) {
      new Notification({
        userId: org.userId,
        type: 'board_expired',
        title: 'Directorio Vencido',
        message: `El mandato del directorio de "${org.organizationName}" ha caducado. Debe iniciar un proceso de renovación.`,
        organizationId: org._id
      }).save().catch(() => {});
    }
  }

  console.log(`[CRON] ${expired.length} directorio(s) marcado(s) como VENCIDA`);
}

// Alertar directorios que vencen en 30 días o menos
async function alertExpiringBoards() {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiring = await Organization.find({
    boardStatus: 'VIGENTE',
    boardExpirationDate: { $gt: now, $lte: thirtyDaysFromNow }
  }).select('_id organizationName userId boardExpirationDate');

  if (expiring.length === 0) return;

  console.log(`[CRON] ${expiring.length} directorio(s) vence(n) en los próximos 30 días`);

  // Solo alertar una vez cada 7 días para no saturar
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const org of expiring) {
    // Verificar si ya se envió alerta reciente para esta org
    const recentAlert = await Notification.findOne({
      organizationId: org._id,
      type: 'board_expiring',
      createdAt: { $gte: sevenDaysAgo }
    });

    if (recentAlert) continue;

    const daysLeft = Math.ceil((new Date(org.boardExpirationDate) - now) / (1000 * 60 * 60 * 24));
    const expirationFormatted = new Date(org.boardExpirationDate).toLocaleDateString('es-CL', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    // Audit log
    AuditLog.logAction({
      action: 'SYSTEM_ALERT',
      resource: 'ORGANIZATION',
      resourceId: org._id,
      resourceName: org.organizationName,
      detail: `La directiva vence en ${daysLeft} días (${expirationFormatted}). Se requiere renovación.`,
      details: { daysLeft, boardExpirationDate: org.boardExpirationDate }
    }).catch(() => {});

    // Notificar al dueño
    if (org.userId) {
      new Notification({
        userId: org.userId,
        type: 'board_expiring',
        title: 'Directiva por Vencer',
        message: `El mandato del directorio de "${org.organizationName}" vence el ${expirationFormatted} (${daysLeft} días). Inicie el proceso de renovación a la brevedad.`,
        organizationId: org._id
      }).save().catch(() => {});
    }

    console.log(`[CRON] Alerta: "${org.organizationName}" vence en ${daysLeft} días`);
  }
}

// Tarea diaria principal
async function dailyBoardCheck() {
  console.log(`[CRON] Ejecutando revisión diaria de directorios — ${new Date().toISOString()}`);
  try {
    await expireBoards();
    await alertExpiringBoards();
    console.log('[CRON] Revisión diaria completada');
  } catch (error) {
    console.error('[CRON] Error en revisión diaria:', error.message);
  }
}

/**
 * Inicializar el servicio de tareas programadas.
 * Ejecuta a medianoche todos los días ('0 0 * * *').
 */
export function initCronJobs() {
  // Solo iniciar si MongoDB está conectado
  if (mongoose.connection.readyState !== 1) {
    console.log('[CRON] Esperando conexión MongoDB para iniciar cron jobs...');
    mongoose.connection.once('connected', () => {
      startCronJobs();
    });
  } else {
    startCronJobs();
  }
}

function startCronJobs() {
  // Ejecutar a medianoche todos los días
  cron.schedule('0 0 * * *', dailyBoardCheck, {
    timezone: 'America/Santiago'
  });

  console.log('[CRON] Tareas programadas iniciadas (medianoche Chile)');

  // Ejecutar una vez al arrancar (con delay para que DB se estabilice)
  setTimeout(dailyBoardCheck, 5000);
}
