/**
 * Seed script: Creates multiple demo organizations at different statuses
 * Run: cd server && node scripts/seed-demo-orgs.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Notification from '../models/Notification.js';
import tenant from '../config/tenant.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social_dev';

// ============ HELPERS ============

function calcDV(num) {
  const s = num.toString();
  let sum = 0, mul = 2;
  for (let i = s.length - 1; i >= 0; i--) {
    sum += parseInt(s[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (sum % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : r.toString();
}

function makeRut(base) {
  return `${String(base).slice(0,2)}.${String(base).slice(2,5)}.${String(base).slice(5,8)}-${calcDV(base)}`;
}

function birthDate(age) {
  const y = new Date().getFullYear() - age;
  const m = 1 + Math.floor(Math.random() * 12);
  const d = 1 + Math.floor(Math.random() * 28);
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

const FIRST_M = ['Carlos','Pedro','Miguel','Juan','Roberto','Andrés','Luis','Jorge','Fernando','Ricardo','Manuel','Héctor','Sergio','Raúl','Pablo'];
const FIRST_F = ['María','Carmen','Rosa','Ana','Patricia','Claudia','Francisca','Daniela','Carolina','Valentina','Marta','Gloria','Isabel','Teresa','Lucía'];
const LAST = ['González','Muñoz','Rojas','Díaz','Pérez','Soto','Contreras','Silva','Martínez','Sepúlveda','Morales','López','Rodríguez','Torres','Vargas','Araya','Flores','Espinoza','Valenzuela','Castillo'];

function randomName(i) {
  const isFemale = i % 2 === 0;
  const first = isFemale ? FIRST_F[i % FIRST_F.length] : FIRST_M[i % FIRST_M.length];
  const last = LAST[i % LAST.length];
  const last2 = LAST[(i + 7) % LAST.length];
  return { firstName: first, lastName: last, apellidoMaterno: last2, genero: isFemale ? 'femenino' : 'masculino' };
}

function generateMembers(count, rutBase) {
  const members = [];
  for (let i = 0; i < count; i++) {
    const { firstName, lastName, apellidoMaterno, genero } = randomName(i);
    const age = 18 + Math.floor(Math.random() * 50);
    members.push({
      firstName,
      lastName,
      apellidoMaterno,
      rut: makeRut(rutBase + i * 11111),
      email: `${firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}${i}@test.cl`,
      phone: `+56 9 ${String(10000000 + Math.floor(Math.random() * 89999999))}`,
      birthDate: birthDate(age),
      genero,
      address: `Calle ${LAST[i % LAST.length]} ${100 + i * 10}, Renca`,
    });
  }
  return members;
}

const comuna = tenant.communeName || 'Renca';

// ============ ORGANIZATIONS DATA ============

const ORGS = [
  {
    name: 'Club Deportivo Los Halcones',
    type: 'CLUB_DEPORTIVO',
    status: 'approved',
    description: 'Club deportivo dedicado al futbol amateur y la vida sana en la comuna.',
    objectives: 'Fomentar la practica deportiva\nOrganizar campeonatos locales\nPromover la vida sana entre jovenes y adultos',
    street: 'Av. Dorsal', streetNumber: '2450',
    rutBase: 10100000,
    memberCount: 18,
  },
  {
    name: 'Centro de Madres Esperanza',
    type: 'CENTRO_MADRES',
    status: 'approved',
    description: 'Organizacion de mujeres enfocada en talleres de capacitacion y emprendimiento.',
    objectives: 'Promover el desarrollo personal y laboral de las socias\nOrganizar talleres de capacitacion\nFomentar el emprendimiento femenino',
    street: 'Psje. Las Rosas', streetNumber: '78',
    rutBase: 11200000,
    memberCount: 20,
  },
  {
    name: 'Club Adulto Mayor Atardecer',
    type: 'CLUB_ADULTO_MAYOR',
    status: 'ministro_scheduled',
    description: 'Club dedicado al bienestar y recreacion de personas mayores.',
    objectives: 'Promover el bienestar fisico y mental\nOrganizar actividades recreativas\nFacilitar acceso a programas de salud',
    street: 'Av. Condell', streetNumber: '1890',
    rutBase: 12300000,
    memberCount: 22,
  },
  {
    name: 'Comite de Vivienda Nueva Esperanza',
    type: 'COMITE_VIVIENDA',
    status: 'waiting_ministro',
    description: 'Comite de familias postulantes a subsidio habitacional.',
    objectives: 'Gestionar soluciones habitacionales\nRepresentar ante SERVIU y MINVU\nOrganizar postulaciones a subsidios',
    street: 'Calle Marte', streetNumber: '567',
    rutBase: 13400000,
    memberCount: 25,
  },
  {
    name: 'Agrupacion Cultural Raices',
    type: 'AGRUPACION_CULTURAL',
    status: 'approved',
    description: 'Agrupacion dedicada al rescate del patrimonio cultural local.',
    objectives: 'Rescatar y difundir el patrimonio cultural\nOrganizar talleres y exposiciones\nFomentar la creacion artistica',
    street: 'Av. Blanco Encalada', streetNumber: '1200',
    rutBase: 14500000,
    memberCount: 16,
  },
  {
    name: 'Comite de Seguridad Villa Esperanza',
    type: 'COMITE_SEGURIDAD',
    status: 'corrections_requested',
    description: 'Comite vecinal de seguridad ciudadana.',
    objectives: 'Promover la seguridad ciudadana\nOrganizar vigilancia vecinal\nCoordinar con Carabineros',
    street: 'Calle Neptuno', streetNumber: '345',
    rutBase: 15600000,
    memberCount: 17,
  },
  {
    name: 'Club Juvenil Futuro',
    type: 'CLUB_JUVENIL',
    status: 'draft',
    description: 'Club de jovenes enfocado en liderazgo y voluntariado.',
    objectives: 'Desarrollar liderazgo juvenil\nOrganizar voluntariados comunitarios\nPromover la participacion ciudadana juvenil',
    street: 'Av. Jose Miguel Infante', streetNumber: '890',
    rutBase: 16700000,
    memberCount: 15,
  },
];

// ============ MAIN ============

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  // Find or create an ORGANIZADOR user to own the orgs
  let owner = await User.findOne({ role: 'ORGANIZADOR' });
  if (!owner) {
    console.log('No ORGANIZADOR found, creating one...');
    owner = await User.create({
      rut: '11.111.111-1',
      firstName: 'Sebastian',
      lastName: 'Demo',
      email: 'demo@test.cl',
      password: 'demo1234',
      phone: '+56 9 1234 5678',
      address: 'Av. Dorsal 1000, Renca',
      role: 'ORGANIZADOR',
      active: true,
      emailVerified: true,
    });
  }
  console.log(`Owner: ${owner.firstName} ${owner.lastName} (${owner._id})`);

  // Find ministro for scheduled orgs
  const ministro = await User.findOne({ role: 'MINISTRO_FE', active: true });

  let created = 0;
  for (const orgData of ORGS) {
    // Check if already exists
    const existing = await Organization.findOne({ organizationName: orgData.name });
    if (existing) {
      console.log(`  SKIP: "${orgData.name}" already exists`);
      continue;
    }

    const members = generateMembers(orgData.memberCount, orgData.rutBase);
    const president = members[0];
    const secretary = members[1];
    const treasurer = members[2];
    const vicePresident = members[3];
    const director1 = members[4];

    const config = {
      monedaCuota: 'UTM',
      cuotaMin: 0.1,
      cuotaMax: 0.5,
      cuotaIncorporacion: 0.5,
      duracionMandato: 3,
      metodoCitacion: 'correo_electronico',
      diasAnticipacion: 10,
      asambleas: ['Marzo', 'Junio', 'Septiembre', 'Diciembre'],
      accountReviewMonth: 'Marzo',
      beneficiarioDisolucion: `Municipalidad de ${comuna}`,
      rutDisolucion: '69.070.300-7',
    };

    const provisionalDirectorio = {
      president: { ...president, cargo: 'presidente' },
      vicePresident: { ...vicePresident, cargo: 'vicepresidente' },
      secretary: { ...secretary, cargo: 'secretario' },
      treasurer: { ...treasurer, cargo: 'tesorero' },
      additionalMembers: [{ ...director1, cargo: 'director1', cargoNombre: 'Director/a' }],
    };

    const electoralCommission = [members[5], members[6], members[7]].filter(Boolean);

    const statusHistory = [{ status: 'draft', date: new Date(Date.now() - 30*24*60*60*1000), comment: 'Solicitud creada' }];
    if (orgData.status !== 'draft') {
      statusHistory.push({ status: 'waiting_ministro', date: new Date(Date.now() - 25*24*60*60*1000), comment: 'Solicitud enviada' });
    }
    if (['ministro_scheduled','approved','corrections_requested'].includes(orgData.status)) {
      statusHistory.push({ status: orgData.status, date: new Date(Date.now() - 10*24*60*60*1000), comment: `Estado: ${orgData.status}` });
    }

    const orgDoc = {
      organizationName: orgData.name,
      organizationType: orgData.type,
      description: orgData.description,
      objectives: orgData.objectives,
      address: `${orgData.street} ${orgData.streetNumber}`,
      street: orgData.street,
      streetNumber: orgData.streetNumber,
      comuna,
      region: 'Region Metropolitana',
      contactEmail: owner.email,
      contactPhone: owner.phone,
      userId: owner._id,
      status: orgData.status,
      members,
      provisionalDirectorio,
      electoralCommission,
      config,
      statusHistory,
      createdAt: new Date(Date.now() - 30*24*60*60*1000),
    };

    // Add ministro data for scheduled/approved
    if (orgData.status === 'ministro_scheduled' && ministro) {
      orgDoc.ministroData = {
        ministroId: ministro._id,
        name: `${ministro.firstName} ${ministro.lastName}`,
        rut: ministro.rut,
        scheduledDate: new Date(Date.now() + 5*24*60*60*1000),
        scheduledTime: '10:00',
        location: `${orgData.street} ${orgData.streetNumber}, ${comuna}`,
        assignedAt: new Date(),
      };
    }

    // Add corrections for corrections_requested
    if (orgData.status === 'corrections_requested') {
      orgDoc.corrections = {
        version: 2,
        items: [
          { category: 'datos_generales', field: 'contactPhone', label: 'Telefono de contacto', message: 'Numero incorrecto, verificar', currentValue: owner.phone },
        ],
        generalComment: 'Por favor corregir el telefono de contacto de la organizacion.',
        fromStatus: 'waiting_ministro',
        createdAt: new Date(),
        resolved: false,
      };
    }

    const org = await Organization.create(orgDoc);
    console.log(`  CREATED: "${orgData.name}" [${orgData.status}] — ${members.length} miembros`);
    created++;

    // Create assignment for ministro_scheduled
    if (orgData.status === 'ministro_scheduled' && ministro) {
      const Assignment = (await import('../models/Assignment.js')).default;
      await Assignment.create({
        ministroId: ministro._id,
        ministroName: `${ministro.firstName} ${ministro.lastName}`,
        ministroRut: ministro.rut || '',
        organizationId: org._id,
        organizationName: org.organizationName,
        scheduledDate: orgDoc.ministroData.scheduledDate,
        scheduledTime: orgDoc.ministroData.scheduledTime,
        location: orgDoc.ministroData.location,
        status: 'pending',
      });
      console.log(`    + Assignment created for ministro ${ministro.firstName}`);
    }
  }

  console.log(`\nDone: ${created} organizations created.`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
