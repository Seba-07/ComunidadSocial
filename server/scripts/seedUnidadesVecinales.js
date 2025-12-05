/**
 * Seed de Unidades Vecinales de Renca
 * Datos extraídos del shapefile oficial del Ministerio de Desarrollo Social (Agosto 2024)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import UnidadVecinal from '../models/UnidadVecinal.js';

dotenv.config();

// Datos de las 45 Unidades Vecinales de Renca
const unidadesVecinales = [
  {
    numero: '001',
    idOficial: '131286255',
    nombre: 'Unidad Vecinal 1',
    macrozona: 1,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '002',
    idOficial: '131286265',
    nombre: 'Unidad Vecinal 2',
    macrozona: 1,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '003',
    idOficial: '131286267',
    nombre: 'Unidad Vecinal 3',
    macrozona: 1,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '004',
    idOficial: '131286264',
    nombre: 'Unidad Vecinal 4',
    macrozona: 1,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '005',
    idOficial: '131286272',
    nombre: 'Unidad Vecinal 5',
    macrozona: 1,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '006',
    idOficial: '131286254',
    nombre: 'Unidad Vecinal 6',
    macrozona: 2,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '007',
    idOficial: '131286269',
    nombre: 'Unidad Vecinal 7',
    macrozona: 2,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '008',
    idOficial: '131286236',
    nombre: 'Unidad Vecinal 8',
    macrozona: 2,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '009',
    idOficial: '131286270',
    nombre: 'Unidad Vecinal 9',
    macrozona: 2,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '010',
    idOficial: '131286268',
    nombre: 'Unidad Vecinal 10',
    macrozona: 2,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '011',
    idOficial: '131286271',
    nombre: 'Unidad Vecinal 11',
    macrozona: 2,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '012',
    idOficial: '131286238',
    nombre: 'Unidad Vecinal 12',
    macrozona: 3,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '013',
    idOficial: '131286239',
    nombre: 'Unidad Vecinal 13',
    macrozona: 3,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '014',
    idOficial: '131286240',
    nombre: 'Unidad Vecinal 14',
    macrozona: 3,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '14B',
    idOficial: '131286235',
    nombre: 'Unidad Vecinal 14B',
    macrozona: 3,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '015',
    idOficial: '131286241',
    nombre: 'Unidad Vecinal 15',
    macrozona: 3,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '016',
    idOficial: '131286244',
    nombre: 'Unidad Vecinal 16',
    macrozona: 3,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '017',
    idOficial: '131286243',
    nombre: 'Unidad Vecinal 17',
    macrozona: 3,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '018',
    idOficial: '131286252',
    nombre: 'Unidad Vecinal 18',
    macrozona: 3,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '19A',
    idOficial: '131286251',
    nombre: 'Unidad Vecinal 19A',
    macrozona: 4,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '19B',
    idOficial: '131286250',
    nombre: 'Unidad Vecinal 19B',
    macrozona: 4,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '020',
    idOficial: '131286242',
    nombre: 'Unidad Vecinal 20',
    macrozona: 4,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '021',
    idOficial: '131286249',
    nombre: 'Unidad Vecinal 21',
    macrozona: 4,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '022',
    idOficial: '131286277',
    nombre: 'Unidad Vecinal 22',
    macrozona: 4,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '23A',
    idOficial: '131286274',
    nombre: 'Unidad Vecinal 23A',
    macrozona: 4,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '23B',
    idOficial: '131286273',
    nombre: 'Unidad Vecinal 23B',
    macrozona: 4,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '024',
    idOficial: '131286278',
    nombre: 'Unidad Vecinal 24',
    macrozona: 4,
    poblaciones: ['Villa Miraflores Maya', 'Villa San Luis', 'Valle Alegre', 'Valle Central', 'Isla de Chiloé', 'Villa Austral', 'Villa Oscar Castro', 'Villa Japón'],
    calles: [],
    palabrasClave: ['miraflores', 'maya', 'san luis', 'valle alegre', 'chiloe', 'austral', 'oscar castro', 'japon']
  },
  {
    numero: '025',
    idOficial: '131286275',
    nombre: 'Unidad Vecinal 25',
    macrozona: 4,
    poblaciones: ['El Perejil', 'San Benildo', 'Unidad y Progreso', 'Santa Emilia'],
    calles: [],
    palabrasClave: ['perejil', 'benildo', 'unidad', 'progreso', 'santa emilia']
  },
  {
    numero: '029',
    idOficial: '131286276',
    nombre: 'Unidad Vecinal 29',
    macrozona: 5,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '033',
    idOficial: '131286246',
    nombre: 'Unidad Vecinal 33',
    macrozona: 5,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '034',
    idOficial: '131286245',
    nombre: 'Unidad Vecinal 34',
    macrozona: 5,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '035',
    idOficial: '131286248',
    nombre: 'Unidad Vecinal 35',
    macrozona: 5,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '036',
    idOficial: '131286263',
    nombre: 'Unidad Vecinal 36',
    macrozona: 6,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '037',
    idOficial: '131286262',
    nombre: 'Unidad Vecinal 37',
    macrozona: 6,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '038',
    idOficial: '131286260',
    nombre: 'Unidad Vecinal 38',
    macrozona: 6,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '039',
    idOficial: '131286261',
    nombre: 'Unidad Vecinal 39',
    macrozona: 6,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '040',
    idOficial: '131286257',
    nombre: 'Unidad Vecinal 40',
    macrozona: 6,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '041',
    idOficial: '131286258',
    nombre: 'Unidad Vecinal 41',
    macrozona: 6,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '042',
    idOficial: '131286259',
    nombre: 'Unidad Vecinal 42',
    macrozona: 7,
    poblaciones: [],
    calles: [],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Panamericana Norte',
      poniente: 'Ignacio Carrera Pinto'
    },
    palabrasClave: ['dorsal', 'panamericana']
  },
  {
    numero: '043',
    idOficial: '131286256',
    nombre: 'Unidad Vecinal 43',
    macrozona: 7,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '044',
    idOficial: '131286253',
    nombre: 'Unidad Vecinal 44',
    macrozona: 7,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '045',
    idOficial: '131286266',
    nombre: 'Unidad Vecinal 45',
    macrozona: 3,
    poblaciones: [],
    calles: [],
    palabrasClave: [],
    notas: 'Unidad Vecinal con altos niveles de vulnerabilidad socio-delictual según estudios de la Macrozona 3'
  },
  {
    numero: '046',
    idOficial: '131286237',
    nombre: 'Unidad Vecinal 46',
    macrozona: 7,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  },
  {
    numero: '047',
    idOficial: '131286247',
    nombre: 'Unidad Vecinal 47',
    macrozona: 7,
    poblaciones: [],
    calles: [],
    palabrasClave: []
  }
];

// Poblaciones conocidas de Renca (para referencia y futura asociación)
const poblacionesRenca = [
  // Nombres originales y actuales de poblaciones
  { actual: 'Robinson Rojas', original: 'Camilo Torres' },
  { actual: 'Villa El Cobre', original: 'Cobre Chileno' },
  { actual: 'Villa Manuel Rodríguez', original: '11 de Julio' },
  { actual: 'Huamachuco I', original: 'Primero de Mayo' },
  { actual: 'Huamachuco II', original: '' },
  { actual: 'Huamachuco III', original: '' },
  { actual: 'Villa Balmaceda', original: 'Vladimir Lenin/Las Palmeras' },
  { actual: 'Villa El Álamo', original: 'Carlos Marx' },
  { actual: 'Villa Arturo Prat', original: 'Santiago de Cuba' },
  { actual: 'El Damascal', original: 'Fidel Castro' },
  { actual: 'Campamento El Mirador', original: '26 de Julio' },
  { actual: 'Villa El Esfuerzo', original: 'Puro Chile' },
  { actual: 'Cooperativa El Cortijo', original: 'Laura Allende' },
  { actual: 'Campamento Villarrica', original: 'Tencha Bussi' },
  { actual: 'Villa El Salvador', original: 'Salvador Allende' },
  { actual: 'Pedro Aguirre Cerda', original: 'Luis Emilio Recabarren' },
  { actual: 'Población Aníbal Pinto', original: 'Martin Luther King' },
  { actual: 'Población Victoria', original: 'Pueblo Hundido' },
  { actual: 'Villa Esperanza', original: 'Rafael Freud' },
  { actual: 'Villa La Viñita', original: '' },
  { actual: 'Villa Los Naranjos', original: '' },
  { actual: 'Plaza de Renca', original: '' },
  { actual: 'Villa Renca Limitada', original: '' },
  { actual: 'Población Lo Benito', original: '' },
  { actual: 'Condominio Las Mercedes', original: '' },
  { actual: 'Villa Santa Bárbara', original: '' },
  { actual: 'Villa Las Cuncunas', original: '' },
  { actual: 'Condominio Parque Balmaceda', original: '' },
  { actual: 'Villa José Manuel Balmaceda', original: '' },
  { actual: 'Villa El Nogal', original: '' },
  { actual: 'Villa Tranviarios', original: '' },
  { actual: 'Población John Kennedy', original: '' },
  { actual: 'Villa Piamonte', original: '' },
  { actual: 'Villa La Ponderosa', original: '' },
  { actual: 'Villa Américo Vespucio', original: '' },
  { actual: 'Condominio Santa María', original: '' },
  { actual: 'Población Astra', original: '' },
  { actual: 'Villa El Teniente', original: '' },
  { actual: 'Villa Los Jardines de Don Aníbal', original: '' },
  { actual: 'Condominio Quilacanta', original: '' },
  { actual: 'Población Francisco Infante', original: '' },
  { actual: 'Población Las Jabas', original: '' },
  { actual: 'Población Calvo Mackenna', original: '' },
  { actual: 'Barrio Ernesto Illanes Beytía', original: '' },
  { actual: 'Barrio Bulnes', original: '' },
  { actual: 'Villa España', original: '' },
  { actual: 'Barrio Hirmas', original: '' },
  { actual: 'Barrio Industrial Hirmas', original: '' },
  { actual: 'Villa Inés de Suárez', original: '' }
];

async function seedUnidadesVecinales() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Conectado a MongoDB');

    // Limpiar colección existente
    await UnidadVecinal.deleteMany({});
    console.log('✓ Colección limpiada');

    // Insertar unidades vecinales
    const result = await UnidadVecinal.insertMany(unidadesVecinales);
    console.log(`✓ ${result.length} unidades vecinales insertadas`);

    // Mostrar resumen por macrozona
    const porMacrozona = {};
    for (const uv of unidadesVecinales) {
      const mz = uv.macrozona || 0;
      porMacrozona[mz] = (porMacrozona[mz] || 0) + 1;
    }

    console.log('\nResumen por Macrozona:');
    for (const [mz, count] of Object.entries(porMacrozona)) {
      console.log(`  Macrozona ${mz}: ${count} unidades vecinales`);
    }

    console.log('\n✓ Seed completado exitosamente');
    console.log('\nNOTA: Las poblaciones, calles y palabras clave deben ser');
    console.log('completadas por el administrador desde el panel de administración.');

  } catch (error) {
    console.error('Error en seed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Ejecutar si se llama directamente
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedUnidadesVecinales();
}

export { seedUnidadesVecinales, unidadesVecinales, poblacionesRenca };
