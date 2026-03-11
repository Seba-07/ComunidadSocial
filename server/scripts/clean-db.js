/**
 * Script para limpiar la base de datos
 * Mantiene solo el usuario MUNICIPALIDAD
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Assignment from '../models/Assignment.js';
import Notification from '../models/Notification.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social_dev';

async function cleanDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    console.log('');

    // Contar registros antes de limpiar
    const countsBefore = {
      users: await User.countDocuments(),
      ministros: await User.countDocuments({ role: 'MINISTRO_FE' }),
      organizadores: await User.countDocuments({ role: 'ORGANIZADOR' }),
      miembros: await User.countDocuments({ role: 'MIEMBRO' }),
      organizations: await Organization.countDocuments(),
      assignments: await Assignment.countDocuments(),
      notifications: await Notification.countDocuments()
    };

    console.log('📊 ESTADO ACTUAL DE LA BASE DE DATOS:');
    console.log('─'.repeat(40));
    console.log(`  Usuarios totales: ${countsBefore.users}`);
    console.log(`    - Ministros de Fe: ${countsBefore.ministros}`);
    console.log(`    - Organizadores: ${countsBefore.organizadores}`);
    console.log(`    - Miembros: ${countsBefore.miembros}`);
    console.log(`  Organizaciones: ${countsBefore.organizations}`);
    console.log(`  Asignaciones: ${countsBefore.assignments}`);
    console.log(`  Notificaciones: ${countsBefore.notifications}`);
    console.log('');

    // Buscar usuario municipalidad o admin existente
    let municipalidadUser = await User.findOne({ role: 'MUNICIPALIDAD' });

    // Si no hay usuario MUNICIPALIDAD, buscar cualquier usuario admin o con email admin@renca.cl
    if (!municipalidadUser) {
      municipalidadUser = await User.findOne({
        $or: [
          { email: 'admin@renca.cl' },
          { role: 'ADMIN' },
          { rut: '11.111.111-1' }
        ]
      });

      if (municipalidadUser) {
        // Actualizar el rol a MUNICIPALIDAD
        console.log(`⚠️  Encontrado usuario existente: ${municipalidadUser.email}`);
        console.log('   Actualizando rol a MUNICIPALIDAD...');
        municipalidadUser.role = 'MUNICIPALIDAD';
        await municipalidadUser.save();
        console.log('✅ Usuario actualizado a MUNICIPALIDAD');
      }
    }

    // Si aún no hay usuario, crear uno nuevo
    if (!municipalidadUser) {
      console.log('⚠️  No se encontró usuario admin, creando uno nuevo...');

      municipalidadUser = new User({
        rut: '11.111.111-1',
        firstName: 'Administrador',
        lastName: 'Municipalidad',
        email: 'admin@renca.cl',
        password: 'admin123',
        phone: '+56 2 2345 6789',
        address: process.env.TENANT_ADDRESS || 'Municipalidad',
        role: 'MUNICIPALIDAD',
        active: true
      });
      await municipalidadUser.save();
      console.log('✅ Usuario MUNICIPALIDAD creado');
    } else {
      console.log(`✅ Usuario MUNICIPALIDAD: ${municipalidadUser.email}`);
    }

    const municipalidadId = municipalidadUser._id;

    console.log('');
    console.log('🗑️  LIMPIANDO BASE DE DATOS...');
    console.log('─'.repeat(40));

    // Eliminar todas las organizaciones
    const deletedOrgs = await Organization.deleteMany({});
    console.log(`  ✅ Organizaciones eliminadas: ${deletedOrgs.deletedCount}`);

    // Eliminar todas las asignaciones
    const deletedAssignments = await Assignment.deleteMany({});
    console.log(`  ✅ Asignaciones eliminadas: ${deletedAssignments.deletedCount}`);

    // Eliminar todas las notificaciones
    const deletedNotifications = await Notification.deleteMany({});
    console.log(`  ✅ Notificaciones eliminadas: ${deletedNotifications.deletedCount}`);

    // Eliminar todos los usuarios EXCEPTO el usuario municipalidad guardado
    const deletedUsers = await User.deleteMany({ _id: { $ne: municipalidadId } });
    console.log(`  ✅ Usuarios eliminados: ${deletedUsers.deletedCount}`);
    console.log(`     (Ministros, Organizadores, Miembros, otros)`);

    // Verificar estado final
    const countsAfter = {
      users: await User.countDocuments(),
      organizations: await Organization.countDocuments(),
      assignments: await Assignment.countDocuments(),
      notifications: await Notification.countDocuments()
    };

    // Obtener credenciales del usuario municipalidad
    const adminUser = await User.findOne({ role: 'MUNICIPALIDAD' });

    console.log('');
    console.log('='.repeat(50));
    console.log('🎉 LIMPIEZA COMPLETADA');
    console.log('='.repeat(50));
    console.log('');
    console.log('📊 ESTADO FINAL:');
    console.log('─'.repeat(40));
    console.log(`  Usuarios: ${countsAfter.users}`);
    console.log(`  Organizaciones: ${countsAfter.organizations}`);
    console.log(`  Asignaciones: ${countsAfter.assignments}`);
    console.log(`  Notificaciones: ${countsAfter.notifications}`);
    console.log('');
    console.log('🔑 CREDENCIALES USUARIO MUNICIPALIDAD:');
    console.log('─'.repeat(40));
    console.log(`  📧 Email: ${adminUser.email}`);
    console.log(`  🔒 Password: admin123`);
    console.log(`  👤 Rol: ${adminUser.role}`);
    console.log(`  📛 Nombre: ${adminUser.firstName} ${adminUser.lastName}`);
    console.log('─'.repeat(40));
    console.log('');
    console.log('💡 PRÓXIMOS PASOS:');
    console.log('   1. Inicia sesión en /auth.html con las credenciales');
    console.log('   2. Crea un Ministro de Fe desde Panel Admin → Ministros');
    console.log('   3. Registra usuarios organizadores para crear organizaciones');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanDatabase();
