import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Assignment from '../models/Assignment.js';
import Notification from '../models/Notification.js';
import tenant from '../config/tenant.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social_dev';

// Configuración: cambiar a 50 para cargar 50 miembros
const TOTAL_MEMBERS = 15; // Opciones: 15 o 50

// Función para generar fecha de nacimiento entre 14-17 años
function generateBirthDate(minAge = 14, maxAge = 17) {
  const today = new Date();
  const age = minAge + Math.floor(Math.random() * (maxAge - minAge + 1));
  const year = today.getFullYear() - age;
  const month = Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Función para generar RUT chileno aleatorio
function generateRut(index) {
  const num = 20000000 + index * 111111 + Math.floor(Math.random() * 100000);
  const numStr = num.toString();
  // Calcular dígito verificador
  let sum = 0;
  let mul = 2;
  for (let i = numStr.length - 1; i >= 0; i--) {
    sum += parseInt(numStr[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const dv = 11 - (sum % 11);
  const dvStr = dv === 11 ? '0' : dv === 10 ? 'K' : dv.toString();
  return `${numStr.slice(0, 2)}.${numStr.slice(2, 5)}.${numStr.slice(5, 8)}-${dvStr}`;
}

// Nombres y apellidos chilenos para generar miembros
const firstNames = [
  'Sofía', 'Martina', 'Florencia', 'Valentina', 'Isidora', 'Agustina', 'Catalina', 'Emilia',
  'Antonella', 'Fernanda', 'Josefa', 'Amanda', 'Trinidad', 'Antonia', 'Constanza', 'Javiera',
  'Matías', 'Benjamín', 'Vicente', 'Martín', 'Agustín', 'Joaquín', 'Tomás', 'Lucas',
  'Sebastián', 'Nicolás', 'Maximiliano', 'Felipe', 'Diego', 'Gabriel', 'Daniel', 'Francisco',
  'Camila', 'Isabella', 'Renata', 'Maite', 'Paz', 'Ignacia', 'Pascuala', 'Magdalena',
  'Alonso', 'Cristóbal', 'Gaspar', 'León', 'Simón', 'Emiliano', 'Santiago', 'Facundo'
];

const lastNames = [
  'González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva',
  'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'García',
  'Vargas', 'Castillo', 'Torres', 'Araya', 'Reyes', 'Núñez', 'Espinoza', 'Bravo',
  'Valenzuela', 'Tapia', 'Figueroa', 'Cortés', 'Castro', 'Carrasco', 'Vera', 'Vega',
  'Flores', 'Pizarro', 'Guzmán', 'Ortiz', 'Lagos', 'Campos', 'Sandoval', 'Herrera'
];

const streets = [
  'Av. Dorsal', 'Calle Los Olivos', 'Pasaje Las Rosas', 'Av. Condell', 'Calle Nueva',
  'Pasaje Central', 'Av. Einstein', 'Calle Libertad', 'Pasaje Norte', 'Av. Sur',
  'Calle Oriente', 'Pasaje Poniente', 'Av. Central', 'Calle Principal', 'Pasaje Sur',
  'Av. Los Aromos', 'Calle San Martín', 'Pasaje Esperanza', 'Av. Pedro Fontova', 'Calle Mapocho'
];

// Generar miembros de prueba (todos menores de edad 14-17)
function generateTestMembers(count) {
  const members = [];
  const usedNames = new Set();

  for (let i = 0; i < count; i++) {
    let firstName, lastName, fullName;

    // Asegurar nombres únicos
    do {
      firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      lastName = lastNames[Math.floor(Math.random() * lastNames.length)] + ' ' +
                 lastNames[Math.floor(Math.random() * lastNames.length)];
      fullName = `${firstName} ${lastName}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const streetNum = 100 + Math.floor(Math.random() * 9000);
    const street = streets[Math.floor(Math.random() * streets.length)];

    members.push({
      rut: generateRut(i),
      firstName,
      lastName,
      email: `${firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${lastName.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}${i}@email.cl`,
      phone: `+56 9 ${String(1000 + i).padStart(4, '0')} ${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      address: `${street} ${streetNum}, ${tenant.communeName}`,
      birthDate: generateBirthDate(14, 17) // Todos entre 14-17 años
    });
  }

  return members;
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Limpiar TODA la base de datos
    console.log('\n🗑️  Limpiando TODA la base de datos...');
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Assignment.deleteMany({});
    await Notification.deleteMany({});
    console.log('✅ Base de datos completamente limpiada');

    // Crear administrador
    console.log('\n👤 Creando administrador...');
    const admin = new User({
      rut: '11.111.111-1',
      firstName: 'Administrador',
      lastName: 'Sistema',
      email: tenant.adminEmail || 'admin@comunidadsocial.cl',
      password: 'admin123',
      phone: tenant.phone || '+56 2 2345 6789',
      address: tenant.address || 'Municipalidad',
      role: 'MUNICIPALIDAD',
      active: true
    });
    await admin.save();
    console.log(`✅ Admin creado: ${tenant.adminEmail || 'admin@comunidadsocial.cl'} / admin123`);

    // Generar y crear usuarios de prueba (todos menores de edad)
    console.log(`\n👥 Creando ${TOTAL_MEMBERS} usuarios de prueba (14-17 años)...`);
    const testMembers = generateTestMembers(TOTAL_MEMBERS);
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
        role: 'ORGANIZADOR',
        active: true
      });
      await user.save();

      // Calcular edad para mostrar
      const birthDate = new Date(member.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      createdUsers.push({ ...member, _id: user._id, age });
      console.log(`  ✅ Usuario ${i + 1}/${TOTAL_MEMBERS}: ${member.firstName} ${member.lastName} (${age} años)`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 SEED COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(50));
    console.log('\n📋 CREDENCIALES DE ACCESO:');
    console.log('─'.repeat(50));
    console.log('ADMINISTRADOR:');
    console.log(`  Email: ${tenant.adminEmail || 'admin@comunidadsocial.cl'}`);
    console.log('  Password: admin123');
    console.log('');
    console.log(`USUARIOS DE PRUEBA (${TOTAL_MEMBERS} menores de edad 14-17 años):`);
    console.log('  Password común: user123');
    console.log('  Ejemplo: ' + testMembers[0].email + ' / user123');
    console.log('─'.repeat(50));
    console.log('\n📊 DATOS CREADOS:');
    console.log(`  - 1 Administrador`);
    console.log(`  - ${TOTAL_MEMBERS} Usuarios de prueba (todos 14-17 años)`);
    console.log('');
    console.log('⚠️  NOTA: No se creó Ministro de Fe.');
    console.log('    Créalo manualmente desde el panel de admin.');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  }
}

seed();
