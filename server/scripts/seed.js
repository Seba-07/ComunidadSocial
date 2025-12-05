import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Assignment from '../models/Assignment.js';
import Notification from '../models/Notification.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social';

// Datos de miembros de prueba (15 miembros)
const testMembers = [
  {
    rut: '15.234.567-8',
    firstName: 'Juan',
    lastName: 'Pérez González',
    email: 'juan.perez@email.cl',
    phone: '+56 9 1111 2222',
    address: 'Av. Dorsal 1234, Renca',
    birthDate: '1985-03-15'
  },
  {
    rut: '16.345.678-9',
    firstName: 'María',
    lastName: 'Rodríguez Silva',
    email: 'maria.rodriguez@email.cl',
    phone: '+56 9 2222 3333',
    address: 'Calle Los Olivos 567, Renca',
    birthDate: '1990-07-22'
  },
  {
    rut: '14.456.789-0',
    firstName: 'Carlos',
    lastName: 'Muñoz Soto',
    email: 'carlos.munoz@email.cl',
    phone: '+56 9 3333 4444',
    address: 'Pasaje Las Rosas 89, Renca',
    birthDate: '1978-11-08'
  },
  {
    rut: '17.567.890-1',
    firstName: 'Ana',
    lastName: 'López Fernández',
    email: 'ana.lopez@email.cl',
    phone: '+56 9 4444 5555',
    address: 'Av. Condell 2345, Renca',
    birthDate: '1992-01-30'
  },
  {
    rut: '13.678.901-2',
    firstName: 'Pedro',
    lastName: 'Hernández Díaz',
    email: 'pedro.hernandez@email.cl',
    phone: '+56 9 5555 6666',
    address: 'Calle Nueva 456, Renca',
    birthDate: '1975-05-12'
  },
  {
    rut: '18.789.012-3',
    firstName: 'Sofía',
    lastName: 'Torres Vargas',
    email: 'sofia.torres@email.cl',
    phone: '+56 9 6666 7777',
    address: 'Pasaje Central 123, Renca',
    birthDate: '1995-09-18'
  },
  {
    rut: '12.890.123-4',
    firstName: 'Roberto',
    lastName: 'Sánchez Morales',
    email: 'roberto.sanchez@email.cl',
    phone: '+56 9 7777 8888',
    address: 'Av. Einstein 789, Renca',
    birthDate: '1970-12-25'
  },
  {
    rut: '19.901.234-5',
    firstName: 'Camila',
    lastName: 'Contreras Reyes',
    email: 'camila.contreras@email.cl',
    phone: '+56 9 8888 9999',
    address: 'Calle Libertad 321, Renca',
    birthDate: '1998-04-07'
  },
  {
    rut: '11.012.345-6',
    firstName: 'Francisco',
    lastName: 'Vega Castillo',
    email: 'francisco.vega@email.cl',
    phone: '+56 9 9999 0000',
    address: 'Pasaje Norte 654, Renca',
    birthDate: '1968-08-14'
  },
  {
    rut: '20.123.456-7',
    firstName: 'Valentina',
    lastName: 'Rojas Fuentes',
    email: 'valentina.rojas@email.cl',
    phone: '+56 9 1234 5678',
    address: 'Av. Sur 987, Renca',
    birthDate: '2000-02-28'
  },
  {
    rut: '10.234.567-8',
    firstName: 'Miguel',
    lastName: 'Espinoza Bravo',
    email: 'miguel.espinoza@email.cl',
    phone: '+56 9 2345 6789',
    address: 'Calle Oriente 147, Renca',
    birthDate: '1965-06-03'
  },
  {
    rut: '21.345.678-9',
    firstName: 'Isabella',
    lastName: 'Araya Núñez',
    email: 'isabella.araya@email.cl',
    phone: '+56 9 3456 7890',
    address: 'Pasaje Poniente 258, Renca',
    birthDate: '2001-10-11'
  },
  {
    rut: '9.456.789-0',
    firstName: 'Jorge',
    lastName: 'Figueroa Lagos',
    email: 'jorge.figueroa@email.cl',
    phone: '+56 9 4567 8901',
    address: 'Av. Central 369, Renca',
    birthDate: '1960-03-20'
  },
  {
    rut: '22.567.890-1',
    firstName: 'Martina',
    lastName: 'Guzmán Pizarro',
    email: 'martina.guzman@email.cl',
    phone: '+56 9 5678 9012',
    address: 'Calle Principal 741, Renca',
    birthDate: '2008-07-16' // 16 años - menor de edad
  },
  {
    rut: '23.678.901-2',
    firstName: 'Tomás',
    lastName: 'Ortiz Valenzuela',
    email: 'tomas.ortiz@email.cl',
    phone: '+56 9 6789 0123',
    address: 'Pasaje Sur 852, Renca',
    birthDate: '2010-03-15' // 14 años - menor de edad
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Limpiar base de datos
    console.log('\n🗑️  Limpiando base de datos...');
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Assignment.deleteMany({});
    await Notification.deleteMany({});
    console.log('Base de datos limpiada');

    // Crear administrador
    console.log('\n👤 Creando administrador...');
    const admin = new User({
      rut: '11.111.111-1',
      firstName: 'Administrador',
      lastName: 'Sistema',
      email: 'admin@renca.cl',
      password: 'admin123',
      phone: '+56 2 2345 6789',
      address: 'Municipalidad de Renca, Blanco Encalada 1335',
      role: 'ADMIN',
      active: true
    });
    await admin.save();
    console.log('✅ Admin creado: admin@renca.cl / admin123');

    // Crear ministro de fe
    console.log('\n⚖️  Creando ministro de fe...');
    const ministro = new User({
      rut: '12.345.678-9',
      firstName: 'María',
      lastName: 'González López',
      email: 'maria.gonzalez@renca.cl',
      password: 'ministro123',
      phone: '+56 9 8765 4321',
      address: 'Av. Dorsal 2000, Renca',
      role: 'MINISTRO',
      active: true,
      mustChangePassword: false
    });
    await ministro.save();
    console.log('✅ Ministro creado: maria.gonzalez@renca.cl / ministro123');

    // Crear usuarios de prueba (15 miembros)
    console.log('\n👥 Creando 15 usuarios de prueba...');
    const createdUsers = [];
    for (let i = 0; i < testMembers.length; i++) {
      const member = testMembers[i];
      const user = new User({
        rut: member.rut,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        password: 'user123',
        phone: member.phone,
        address: member.address,
        role: 'USER',
        active: true
      });
      await user.save();
      createdUsers.push({ ...member, _id: user._id });
      console.log(`  ✅ Usuario ${i + 1}/15: ${member.firstName} ${member.lastName}`);
    }


    console.log('\n' + '='.repeat(50));
    console.log('🎉 SEED COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(50));
    console.log('\n📋 CREDENCIALES DE ACCESO:');
    console.log('─'.repeat(50));
    console.log('ADMINISTRADOR:');
    console.log('  Email: admin@renca.cl');
    console.log('  Password: admin123');
    console.log('');
    console.log('MINISTRO DE FE:');
    console.log('  Email: maria.gonzalez@renca.cl');
    console.log('  Password: ministro123');
    console.log('');
    console.log('USUARIOS DE PRUEBA (15):');
    console.log('  Password común: user123');
    console.log('  Ejemplo: juan.perez@email.cl / user123');
    console.log('─'.repeat(50));
    console.log('\n📊 DATOS CREADOS:');
    console.log(`  - 1 Administrador`);
    console.log(`  - 1 Ministro de Fe`);
    console.log(`  - 15 Usuarios de prueba`);
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  }
}

seed();
