/**
 * Seed de Unidades Vecinales de Renca
 * Datos extraídos del shapefile oficial del Ministerio de Desarrollo Social (Agosto 2024)
 * Complementado con información de la Municipalidad de Renca y fuentes públicas
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import UnidadVecinal from '../models/UnidadVecinal.js';

dotenv.config();

// Datos de las 45 Unidades Vecinales de Renca
// Organizadas por Macrozona según información oficial
const unidadesVecinales = [
  // ========================================
  // MACROZONA 1 - Sector Norte/Cerro Renca
  // ========================================
  {
    numero: '001',
    idOficial: '131286255',
    nombre: 'Unidad Vecinal 1',
    macrozona: 1,
    poblaciones: ['Población Cerro Colorado', 'Villa El Esfuerzo'],
    calles: ['Av. El Cerro', 'Los Boldos', 'Los Cipreses'],
    limites: {
      norte: 'Límite comunal con Quilicura',
      sur: 'Av. El Cerro',
      oriente: 'Cerro Renca',
      poniente: 'Av. Lo Boza'
    },
    palabrasClave: ['cerro colorado', 'el esfuerzo', 'cerro renca', 'boldos']
  },
  {
    numero: '002',
    idOficial: '131286265',
    nombre: 'Unidad Vecinal 2',
    macrozona: 1,
    poblaciones: ['Población Recabarren', 'Pedro Aguirre Cerda'],
    calles: ['Av. Lo Boza', 'Recabarren'],
    limites: {
      norte: 'Límite comunal',
      sur: 'Av. El Cerro',
      oriente: 'Av. Lo Boza',
      poniente: 'Límite comunal con Quilicura'
    },
    palabrasClave: ['recabarren', 'pedro aguirre cerda', 'lo boza']
  },
  {
    numero: '003',
    idOficial: '131286267',
    nombre: 'Unidad Vecinal 3',
    macrozona: 1,
    poblaciones: ['Lo Boza Norte', 'Villa Padre Hurtado'],
    calles: ['Av. Lo Boza', 'Santa Teresa'],
    limites: {
      norte: 'Límite comunal',
      sur: 'Av. El Cerro',
      oriente: 'Cerro Renca',
      poniente: 'Av. Lo Boza'
    },
    palabrasClave: ['lo boza', 'padre hurtado', 'santa teresa']
  },
  {
    numero: '004',
    idOficial: '131286264',
    nombre: 'Unidad Vecinal 4',
    macrozona: 1,
    poblaciones: ['Villa El Álamo', 'Cooperativa El Cortijo'],
    calles: ['El Álamo', 'El Cortijo'],
    limites: {
      norte: 'Cerro Renca',
      sur: 'Av. El Cerro',
      oriente: 'Panamericana Norte',
      poniente: 'Cerro Renca'
    },
    palabrasClave: ['el alamo', 'cortijo', 'carlos marx']
  },
  {
    numero: '005',
    idOficial: '131286272',
    nombre: 'Unidad Vecinal 5',
    macrozona: 1,
    poblaciones: ['El Damascal', 'Campamento El Mirador'],
    calles: ['Angamos', 'El Damascal'],
    limites: {
      norte: 'Cerro Renca',
      sur: 'Av. El Cerro',
      oriente: 'Panamericana Norte',
      poniente: 'Cerro Renca'
    },
    palabrasClave: ['damascal', 'mirador', 'angamos', 'fidel castro']
  },

  // ========================================
  // MACROZONA 2 - Sector Huamachuco/Lo Ruiz
  // ========================================
  {
    numero: '006',
    idOficial: '131286254',
    nombre: 'Unidad Vecinal 6',
    macrozona: 2,
    poblaciones: ['Huamachuco I', 'Huamachuco II'],
    calles: ['Lo Ruiz', 'Huamachuco', 'Américo Vespucio'],
    limites: {
      norte: 'Av. El Cerro',
      sur: 'Américo Vespucio',
      oriente: 'Panamericana Norte',
      poniente: 'Lo Ruiz'
    },
    palabrasClave: ['huamachuco', 'primero de mayo', 'lo ruiz', 'vespucio']
  },
  {
    numero: '007',
    idOficial: '131286269',
    nombre: 'Unidad Vecinal 7',
    macrozona: 2,
    poblaciones: ['Huamachuco III', 'Villa Américo Vespucio'],
    calles: ['Américo Vespucio', 'Lo Ruiz'],
    limites: {
      norte: 'Lo Ruiz',
      sur: 'Américo Vespucio',
      oriente: 'Panamericana Norte',
      poniente: 'Av. Lo Boza'
    },
    palabrasClave: ['huamachuco 3', 'americo vespucio', 'vespucio']
  },
  {
    numero: '008',
    idOficial: '131286236',
    nombre: 'Unidad Vecinal 8',
    macrozona: 2,
    poblaciones: ['J.A. Ríos I', 'J.A. Ríos II'],
    calles: ['Av. José Antonio Ríos', 'Lo Ruiz'],
    limites: {
      norte: 'Av. El Cerro',
      sur: 'Américo Vespucio',
      oriente: 'Lo Ruiz',
      poniente: 'Av. Lo Boza'
    },
    palabrasClave: ['ja rios', 'jose antonio rios', 'santa juana']
  },
  {
    numero: '009',
    idOficial: '131286270',
    nombre: 'Unidad Vecinal 9',
    macrozona: 2,
    poblaciones: ['Villa La Viñita', 'Villa Los Naranjos'],
    calles: ['Los Naranjos', 'La Viñita'],
    limites: {
      norte: 'Av. El Cerro',
      sur: 'Lo Ruiz',
      oriente: 'Av. Lo Boza',
      poniente: 'Límite comunal'
    },
    palabrasClave: ['viñita', 'naranjos', 'lo boza']
  },
  {
    numero: '010',
    idOficial: '131286268',
    nombre: 'Unidad Vecinal 10',
    macrozona: 2,
    poblaciones: ['Lo Boza Sur', 'Villa Santa Teresa'],
    calles: ['Av. Lo Boza', 'Santa Teresa'],
    limites: {
      norte: 'Lo Ruiz',
      sur: 'Américo Vespucio',
      oriente: 'Av. Lo Boza',
      poniente: 'Límite comunal'
    },
    palabrasClave: ['lo boza sur', 'santa teresa']
  },
  {
    numero: '011',
    idOficial: '131286271',
    nombre: 'Unidad Vecinal 11',
    macrozona: 2,
    poblaciones: ['Villa El Cobre', 'Villa Las Cuncunas'],
    calles: ['El Cobre', 'Las Cuncunas'],
    limites: {
      norte: 'Américo Vespucio',
      sur: 'Dorsal',
      oriente: 'Panamericana Norte',
      poniente: 'Av. Lo Boza'
    },
    palabrasClave: ['el cobre', 'cuncunas', 'cobre chileno']
  },

  // ========================================
  // MACROZONA 3 - Sector Central/Plaza Renca
  // ========================================
  {
    numero: '012',
    idOficial: '131286238',
    nombre: 'Unidad Vecinal 12',
    macrozona: 3,
    poblaciones: ['Plaza de Renca', 'Centro Histórico'],
    calles: ['Blanco Encalada', 'José Manuel Balmaceda', 'Domingo Santa María'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Panamericana Norte',
      poniente: 'José Manuel Balmaceda'
    },
    palabrasClave: ['plaza renca', 'centro', 'blanco encalada', 'municipalidad']
  },
  {
    numero: '013',
    idOficial: '131286239',
    nombre: 'Unidad Vecinal 13',
    macrozona: 3,
    poblaciones: ['Villa José Manuel Balmaceda', 'Condominio Parque Balmaceda'],
    calles: ['José Manuel Balmaceda', 'Parque Balmaceda'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'José Manuel Balmaceda',
      poniente: 'Brasil'
    },
    palabrasClave: ['balmaceda', 'parque balmaceda', 'vladimir lenin', 'las palmeras']
  },
  {
    numero: '014',
    idOficial: '131286240',
    nombre: 'Unidad Vecinal 14',
    macrozona: 3,
    poblaciones: ['Villa Renca Limitada', 'Población Lo Benito'],
    calles: ['Brasil', 'Lo Benito'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Brasil',
      poniente: 'José Miguel Infante'
    },
    palabrasClave: ['renca limitada', 'lo benito', 'brasil']
  },
  {
    numero: '14B',
    idOficial: '131286235',
    nombre: 'Unidad Vecinal 14B',
    macrozona: 3,
    poblaciones: ['Condominio Las Mercedes', 'Villa Santa Bárbara'],
    calles: ['Las Mercedes', 'Santa Bárbara'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'José Miguel Infante',
      poniente: 'Av. Lo Boza'
    },
    palabrasClave: ['las mercedes', 'santa barbara']
  },
  {
    numero: '015',
    idOficial: '131286241',
    nombre: 'Unidad Vecinal 15',
    macrozona: 3,
    poblaciones: ['Villa El Nogal', 'Villa Tranviarios'],
    calles: ['El Nogal', 'Tranviarios'],
    limites: {
      norte: 'Américo Vespucio',
      sur: 'Dorsal',
      oriente: 'Av. Lo Boza',
      poniente: 'Límite comunal'
    },
    palabrasClave: ['el nogal', 'tranviarios']
  },
  {
    numero: '016',
    idOficial: '131286244',
    nombre: 'Unidad Vecinal 16',
    macrozona: 3,
    poblaciones: ['Población John Kennedy', 'Villa Piamonte'],
    calles: ['John Kennedy', 'Piamonte'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Av. Lo Boza',
      poniente: 'Límite comunal'
    },
    palabrasClave: ['john kennedy', 'piamonte', 'kennedy']
  },
  {
    numero: '017',
    idOficial: '131286243',
    nombre: 'Unidad Vecinal 17',
    macrozona: 3,
    poblaciones: ['Villa La Ponderosa', 'Villa El Teniente'],
    calles: ['La Ponderosa', 'El Teniente'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Brasil',
      poniente: 'José Miguel Infante'
    },
    palabrasClave: ['la ponderosa', 'el teniente']
  },
  {
    numero: '018',
    idOficial: '131286252',
    nombre: 'Unidad Vecinal 18',
    macrozona: 3,
    poblaciones: ['Condominio Santa María', 'Población Astra'],
    calles: ['Domingo Santa María', 'Astra'],
    limites: {
      norte: 'Domingo Santa María',
      sur: 'Mapocho',
      oriente: 'Panamericana Norte',
      poniente: 'José Manuel Balmaceda'
    },
    palabrasClave: ['santa maria', 'astra', 'mapocho']
  },

  // ========================================
  // MACROZONA 4 - Sector Sur/Mapocho
  // ========================================
  {
    numero: '19A',
    idOficial: '131286251',
    nombre: 'Unidad Vecinal 19A',
    macrozona: 4,
    poblaciones: ['Villa Los Jardines de Don Aníbal', 'Condominio Quilacanta'],
    calles: ['Los Jardines', 'Quilacanta'],
    limites: {
      norte: 'Domingo Santa María',
      sur: 'Río Mapocho',
      oriente: 'José Manuel Balmaceda',
      poniente: 'Brasil'
    },
    palabrasClave: ['jardines', 'don anibal', 'quilacanta']
  },
  {
    numero: '19B',
    idOficial: '131286250',
    nombre: 'Unidad Vecinal 19B',
    macrozona: 4,
    poblaciones: ['Población Francisco Infante', 'Villa Arturo Prat'],
    calles: ['Francisco Infante', 'Arturo Prat'],
    limites: {
      norte: 'Domingo Santa María',
      sur: 'Río Mapocho',
      oriente: 'Brasil',
      poniente: 'José Miguel Infante'
    },
    palabrasClave: ['francisco infante', 'arturo prat', 'santiago de cuba']
  },
  {
    numero: '020',
    idOficial: '131286242',
    nombre: 'Unidad Vecinal 20',
    macrozona: 4,
    poblaciones: ['Villa Manuel Rodríguez', 'Robinson Rojas'],
    calles: ['Manuel Rodríguez', 'Mapocho'],
    limites: {
      norte: 'Domingo Santa María',
      sur: 'Río Mapocho',
      oriente: 'José Miguel Infante',
      poniente: 'Av. Lo Boza'
    },
    palabrasClave: ['manuel rodriguez', 'robinson rojas', '11 de julio', 'camilo torres']
  },
  {
    numero: '021',
    idOficial: '131286249',
    nombre: 'Unidad Vecinal 21',
    macrozona: 4,
    poblaciones: ['Población Las Jabas', 'Población Calvo Mackenna'],
    calles: ['Las Jabas', 'Calvo Mackenna'],
    limites: {
      norte: 'Domingo Santa María',
      sur: 'Río Mapocho',
      oriente: 'Av. Lo Boza',
      poniente: 'Límite comunal'
    },
    palabrasClave: ['las jabas', 'calvo mackenna']
  },
  {
    numero: '022',
    idOficial: '131286277',
    nombre: 'Unidad Vecinal 22',
    macrozona: 4,
    poblaciones: ['Barrio Ernesto Illanes Beytía', 'Barrio Bulnes'],
    calles: ['Ernesto Illanes', 'General Bulnes'],
    limites: {
      norte: 'Río Mapocho',
      sur: 'Límite comunal',
      oriente: 'Panamericana Norte',
      poniente: 'José Manuel Balmaceda'
    },
    palabrasClave: ['illanes beytia', 'bulnes', 'ernesto illanes']
  },
  {
    numero: '23A',
    idOficial: '131286274',
    nombre: 'Unidad Vecinal 23A',
    macrozona: 4,
    poblaciones: ['Villa España', 'Barrio Hirmas'],
    calles: ['España', 'Hirmas'],
    limites: {
      norte: 'Río Mapocho',
      sur: 'Límite comunal',
      oriente: 'José Manuel Balmaceda',
      poniente: 'Brasil'
    },
    palabrasClave: ['españa', 'hirmas', 'barrio industrial']
  },
  {
    numero: '23B',
    idOficial: '131286273',
    nombre: 'Unidad Vecinal 23B',
    macrozona: 4,
    poblaciones: ['Barrio Industrial Hirmas', 'Villa Inés de Suárez'],
    calles: ['Hirmas', 'Inés de Suárez'],
    limites: {
      norte: 'Río Mapocho',
      sur: 'Límite comunal',
      oriente: 'Brasil',
      poniente: 'José Miguel Infante'
    },
    palabrasClave: ['industrial hirmas', 'ines de suarez']
  },
  {
    numero: '024',
    idOficial: '131286278',
    nombre: 'Unidad Vecinal 24',
    macrozona: 4,
    poblaciones: ['Villa Miraflores Maya', 'Villa San Luis', 'Valle Alegre', 'Valle Central', 'Isla de Chiloé', 'Villa Austral', 'Villa Oscar Castro', 'Villa Japón'],
    calles: ['Miraflores', 'San Luis', 'Valle Alegre', 'Japón'],
    limites: {
      norte: 'Río Mapocho',
      sur: 'Límite comunal',
      oriente: 'José Miguel Infante',
      poniente: 'Av. Lo Boza'
    },
    palabrasClave: ['miraflores', 'maya', 'san luis', 'valle alegre', 'chiloe', 'austral', 'oscar castro', 'japon']
  },
  {
    numero: '025',
    idOficial: '131286275',
    nombre: 'Unidad Vecinal 25',
    macrozona: 4,
    poblaciones: ['El Perejil', 'San Benildo', 'Unidad y Progreso', 'Santa Emilia'],
    calles: ['El Perejil', 'San Benildo', 'Santa Emilia'],
    limites: {
      norte: 'Río Mapocho',
      sur: 'Límite comunal con Cerro Navia',
      oriente: 'Av. Lo Boza',
      poniente: 'Límite comunal'
    },
    palabrasClave: ['perejil', 'benildo', 'unidad', 'progreso', 'santa emilia']
  },

  // ========================================
  // MACROZONA 5 - Sector Lo Velásquez
  // ========================================
  {
    numero: '029',
    idOficial: '131286276',
    nombre: 'Unidad Vecinal 29',
    macrozona: 5,
    poblaciones: ['Lo Velásquez I', 'Lo Velásquez II'],
    calles: ['Av. José Miguel Infante', 'Brasil', 'Lo Velásquez'],
    limites: {
      norte: 'Dorsal',
      sur: 'Américo Vespucio',
      oriente: 'José Miguel Infante',
      poniente: 'Brasil'
    },
    palabrasClave: ['lo velasquez', 'infante', 'brasil']
  },
  {
    numero: '033',
    idOficial: '131286246',
    nombre: 'Unidad Vecinal 33',
    macrozona: 5,
    poblaciones: ['Villa Tucapel Jiménez I', 'Villa Tucapel Jiménez II'],
    calles: ['Tucapel Jiménez', 'José Miguel Infante', 'Brasil'],
    limites: {
      norte: 'Américo Vespucio',
      sur: 'Dorsal',
      oriente: 'José Miguel Infante',
      poniente: 'Brasil'
    },
    palabrasClave: ['tucapel jimenez', 'tucapel']
  },
  {
    numero: '034',
    idOficial: '131286245',
    nombre: 'Unidad Vecinal 34',
    macrozona: 5,
    poblaciones: ['Lo Velásquez III', 'Villa Pedro de Oña'],
    calles: ['Lo Velásquez', 'Pedro de Oña', 'Brasil'],
    limites: {
      norte: 'Américo Vespucio',
      sur: 'Dorsal',
      oriente: 'Brasil',
      poniente: 'Límite comunal'
    },
    palabrasClave: ['lo velasquez 3', 'pedro de oña']
  },
  {
    numero: '035',
    idOficial: '131286248',
    nombre: 'Unidad Vecinal 35',
    macrozona: 5,
    poblaciones: ['Lo Velásquez IV', 'Lo Velásquez V', 'Lo Velásquez VI'],
    calles: ['Lo Velásquez', 'Brasil'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Brasil',
      poniente: 'Límite comunal'
    },
    palabrasClave: ['lo velasquez 4', 'lo velasquez 5', 'lo velasquez 6']
  },

  // ========================================
  // MACROZONA 6 - Sector Oriente/Panamericana
  // ========================================
  {
    numero: '036',
    idOficial: '131286263',
    nombre: 'Unidad Vecinal 36',
    macrozona: 6,
    poblaciones: ['Población José Miguel Infante', 'Villa Norte Unido'],
    calles: ['José Miguel Infante', 'Panamericana Norte'],
    limites: {
      norte: 'Américo Vespucio',
      sur: 'Dorsal',
      oriente: 'Panamericana Norte',
      poniente: 'Av. Lo Boza'
    },
    palabrasClave: ['jose miguel infante', 'norte unido']
  },
  {
    numero: '037',
    idOficial: '131286262',
    nombre: 'Unidad Vecinal 37',
    macrozona: 6,
    poblaciones: ['Villa General Vergara', 'Población 1° de Mayo'],
    calles: ['General Vergara', 'Primero de Mayo'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Panamericana Norte',
      poniente: 'José Manuel Balmaceda'
    },
    palabrasClave: ['general vergara', 'primero mayo', 'comite sin casa']
  },
  {
    numero: '038',
    idOficial: '131286260',
    nombre: 'Unidad Vecinal 38',
    macrozona: 6,
    poblaciones: ['Población Matucana', 'Renca Central'],
    calles: ['Matucana', 'Central'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Panamericana Norte',
      poniente: 'Brasil'
    },
    palabrasClave: ['matucana', 'renca central']
  },
  {
    numero: '039',
    idOficial: '131286261',
    nombre: 'Unidad Vecinal 39',
    macrozona: 6,
    poblaciones: ['Villa Esperanza', 'Campamento Villa Esperanza'],
    calles: ['Villa Esperanza', 'Rafael Freud'],
    limites: {
      norte: 'Américo Vespucio',
      sur: 'Dorsal',
      oriente: 'Panamericana Norte',
      poniente: 'Brasil'
    },
    palabrasClave: ['villa esperanza', 'rafael freud', 'esperanza']
  },
  {
    numero: '040',
    idOficial: '131286257',
    nombre: 'Unidad Vecinal 40',
    macrozona: 6,
    poblaciones: ['Conjunto Habitacional Renca Blanco Encalada', 'Casa Varas'],
    calles: ['Blanco Encalada', 'Casa Varas'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Panamericana Norte',
      poniente: 'José Manuel Balmaceda'
    },
    palabrasClave: ['blanco encalada', 'casa varas', 'conjunto habitacional']
  },
  {
    numero: '041',
    idOficial: '131286258',
    nombre: 'Unidad Vecinal 41',
    macrozona: 6,
    poblaciones: ['La Quebrada', 'Villa El Salvador'],
    calles: ['La Quebrada', 'El Salvador'],
    limites: {
      norte: 'Américo Vespucio',
      sur: 'Dorsal',
      oriente: 'Panamericana Norte',
      poniente: 'José Manuel Balmaceda'
    },
    palabrasClave: ['la quebrada', 'el salvador', 'salvador allende']
  },

  // ========================================
  // MACROZONA 7 - Sector Sur-Poniente
  // ========================================
  {
    numero: '042',
    idOficial: '131286259',
    nombre: 'Unidad Vecinal 42',
    macrozona: 7,
    poblaciones: ['Población Victoria', 'Campamento Villarrica'],
    calles: ['Victoria', 'Villarrica', 'Ignacio Carrera Pinto'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Panamericana Norte',
      poniente: 'Ignacio Carrera Pinto'
    },
    palabrasClave: ['victoria', 'villarrica', 'pueblo hundido', 'tencha bussi', 'dorsal', 'panamericana']
  },
  {
    numero: '043',
    idOficial: '131286256',
    nombre: 'Unidad Vecinal 43',
    macrozona: 7,
    poblaciones: ['Paz y Esfuerzo', 'Blanca Vergara'],
    calles: ['Paz y Esfuerzo', 'Blanca Vergara'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'José Manuel Balmaceda',
      poniente: 'Brasil'
    },
    palabrasClave: ['paz y esfuerzo', 'blanca vergara']
  },
  {
    numero: '044',
    idOficial: '131286253',
    nombre: 'Unidad Vecinal 44',
    macrozona: 7,
    poblaciones: ['Domingo Santa María', 'Santa Rosa y Cooperativas'],
    calles: ['Domingo Santa María', 'Santa Rosa'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'Brasil',
      poniente: 'José Miguel Infante'
    },
    palabrasClave: ['domingo santa maria', 'santa rosa', 'cooperativas']
  },
  {
    numero: '045',
    idOficial: '131286266',
    nombre: 'Unidad Vecinal 45',
    macrozona: 3,
    poblaciones: ['Población Aníbal Pinto', 'Juventud Renca'],
    calles: ['Aníbal Pinto', 'Juventud'],
    limites: {
      norte: 'Dorsal',
      sur: 'Domingo Santa María',
      oriente: 'José Manuel Balmaceda',
      poniente: 'Brasil'
    },
    palabrasClave: ['anibal pinto', 'juventud renca', 'martin luther king'],
    notas: 'Unidad Vecinal con altos niveles de vulnerabilidad socio-delictual según estudios de la Macrozona 3'
  },
  {
    numero: '046',
    idOficial: '131286237',
    nombre: 'Unidad Vecinal 46',
    macrozona: 7,
    poblaciones: ['Alfredo Calvo', 'General Oscar Bonilla'],
    calles: ['Alfredo Calvo', 'Oscar Bonilla'],
    limites: {
      norte: 'Domingo Santa María',
      sur: 'Río Mapocho',
      oriente: 'José Miguel Infante',
      poniente: 'Límite comunal'
    },
    palabrasClave: ['alfredo calvo', 'oscar bonilla']
  },
  {
    numero: '047',
    idOficial: '131286247',
    nombre: 'Unidad Vecinal 47',
    macrozona: 7,
    poblaciones: ['Condominio Antumalal', 'Sector Renca Nuevo', 'Villa Las Lilas I', 'Villa Las Lilas II'],
    calles: ['Antumalal', 'Las Lilas', 'Renca Nuevo'],
    limites: {
      norte: 'Domingo Santa María',
      sur: 'Río Mapocho',
      oriente: 'Límite comunal',
      poniente: 'Av. Lo Boza'
    },
    palabrasClave: ['antumalal', 'renca nuevo', 'las lilas']
  }
];

// Lista completa de poblaciones de Renca para referencia
const poblacionesRenca = [
  // Nombres originales y actuales de poblaciones (cambios durante dictadura)
  { actual: 'Robinson Rojas', original: 'Camilo Torres', uv: '020' },
  { actual: 'Villa El Cobre', original: 'Cobre Chileno', uv: '011' },
  { actual: 'Villa Manuel Rodríguez', original: '11 de Julio', uv: '020' },
  { actual: 'Huamachuco I', original: 'Primero de Mayo', uv: '006' },
  { actual: 'Huamachuco II', original: '', uv: '006' },
  { actual: 'Huamachuco III', original: '', uv: '007' },
  { actual: 'Villa Balmaceda', original: 'Vladimir Lenin/Las Palmeras', uv: '013' },
  { actual: 'Villa El Álamo', original: 'Carlos Marx', uv: '004' },
  { actual: 'Villa Arturo Prat', original: 'Santiago de Cuba', uv: '19B' },
  { actual: 'El Damascal', original: 'Fidel Castro', uv: '005' },
  { actual: 'Campamento El Mirador', original: '26 de Julio', uv: '005' },
  { actual: 'Villa El Esfuerzo', original: 'Puro Chile', uv: '001' },
  { actual: 'Cooperativa El Cortijo', original: 'Laura Allende', uv: '004' },
  { actual: 'Campamento Villarrica', original: 'Tencha Bussi', uv: '042' },
  { actual: 'Villa El Salvador', original: 'Salvador Allende', uv: '041' },
  { actual: 'Pedro Aguirre Cerda', original: 'Luis Emilio Recabarren', uv: '002' },
  { actual: 'Población Aníbal Pinto', original: 'Martin Luther King', uv: '045' },
  { actual: 'Población Victoria', original: 'Pueblo Hundido', uv: '042' },
  { actual: 'Villa Esperanza', original: 'Rafael Freud', uv: '039' },
  // Poblaciones sin cambio de nombre
  { actual: 'Villa La Viñita', original: '', uv: '009' },
  { actual: 'Villa Los Naranjos', original: '', uv: '009' },
  { actual: 'Plaza de Renca', original: '', uv: '012' },
  { actual: 'Villa Renca Limitada', original: '', uv: '014' },
  { actual: 'Población Lo Benito', original: '', uv: '014' },
  { actual: 'Condominio Las Mercedes', original: '', uv: '14B' },
  { actual: 'Villa Santa Bárbara', original: '', uv: '14B' },
  { actual: 'Villa Las Cuncunas', original: '', uv: '011' },
  { actual: 'Condominio Parque Balmaceda', original: '', uv: '013' },
  { actual: 'Villa José Manuel Balmaceda', original: '', uv: '013' },
  { actual: 'Villa El Nogal', original: '', uv: '015' },
  { actual: 'Villa Tranviarios', original: '', uv: '015' },
  { actual: 'Población John Kennedy', original: '', uv: '016' },
  { actual: 'Villa Piamonte', original: '', uv: '016' },
  { actual: 'Villa La Ponderosa', original: '', uv: '017' },
  { actual: 'Condominio Santa María', original: '', uv: '018' },
  { actual: 'Población Astra', original: '', uv: '018' },
  { actual: 'Villa El Teniente', original: '', uv: '017' },
  { actual: 'Villa Los Jardines de Don Aníbal', original: '', uv: '19A' },
  { actual: 'Condominio Quilacanta', original: '', uv: '19A' },
  { actual: 'Población Francisco Infante', original: '', uv: '19B' },
  { actual: 'Población Las Jabas', original: '', uv: '021' },
  { actual: 'Población Calvo Mackenna', original: '', uv: '021' },
  { actual: 'Barrio Ernesto Illanes Beytía', original: '', uv: '022' },
  { actual: 'Barrio Bulnes', original: '', uv: '022' },
  { actual: 'Villa España', original: '', uv: '23A' },
  { actual: 'Barrio Hirmas', original: '', uv: '23A' },
  { actual: 'Barrio Industrial Hirmas', original: '', uv: '23B' },
  { actual: 'Villa Inés de Suárez', original: '', uv: '23B' },
  { actual: 'Población Cerro Colorado', original: '', uv: '001' },
  { actual: 'J.A. Ríos I', original: '', uv: '008' },
  { actual: 'J.A. Ríos II', original: '', uv: '008' },
  { actual: 'Lo Velásquez I', original: '', uv: '029' },
  { actual: 'Lo Velásquez II', original: '', uv: '029' },
  { actual: 'Lo Velásquez III', original: '', uv: '034' },
  { actual: 'Lo Velásquez IV', original: '', uv: '035' },
  { actual: 'Lo Velásquez V', original: '', uv: '035' },
  { actual: 'Lo Velásquez VI', original: '', uv: '035' },
  { actual: 'Villa Tucapel Jiménez I', original: '', uv: '033' },
  { actual: 'Villa Tucapel Jiménez II', original: '', uv: '033' },
  { actual: 'Villa Pedro de Oña', original: '', uv: '034' },
  { actual: 'Población José Miguel Infante', original: '', uv: '036' },
  { actual: 'Villa Norte Unido', original: '', uv: '036' },
  { actual: 'Villa General Vergara', original: '', uv: '037' },
  { actual: 'Población Matucana', original: '', uv: '038' },
  { actual: 'Renca Central', original: '', uv: '038' },
  { actual: 'Conjunto Habitacional Renca Blanco Encalada', original: '', uv: '040' },
  { actual: 'Casa Varas', original: '', uv: '040' },
  { actual: 'La Quebrada', original: '', uv: '041' },
  { actual: 'Paz y Esfuerzo', original: '', uv: '043' },
  { actual: 'Blanca Vergara', original: '', uv: '043' },
  { actual: 'Santa Rosa y Cooperativas', original: '', uv: '044' },
  { actual: 'Juventud Renca', original: '', uv: '045' },
  { actual: 'Alfredo Calvo', original: '', uv: '046' },
  { actual: 'General Oscar Bonilla', original: '', uv: '046' },
  { actual: 'Condominio Antumalal', original: '', uv: '047' },
  { actual: 'Sector Renca Nuevo', original: '', uv: '047' },
  { actual: 'Villa Las Lilas I', original: '', uv: '047' },
  { actual: 'Villa Las Lilas II', original: '', uv: '047' },
  { actual: 'El Perejil', original: '', uv: '025' },
  { actual: 'San Benildo', original: '', uv: '025' },
  { actual: 'Villa Miraflores Maya', original: '', uv: '024' },
  { actual: 'Villa San Luis', original: '', uv: '024' },
  { actual: 'Valle Alegre', original: '', uv: '024' },
  { actual: 'Valle Central', original: '', uv: '024' },
  { actual: 'Isla de Chiloé', original: '', uv: '024' },
  { actual: 'Villa Austral', original: '', uv: '024' },
  { actual: 'Villa Oscar Castro', original: '', uv: '024' },
  { actual: 'Villa Japón', original: '', uv: '024' }
];

// Calles principales de Renca para búsqueda
const callesPrincipales = [
  { calle: 'Av. José Miguel Infante', uvs: ['029', '033', '034', '036'] },
  { calle: 'Av. Lo Boza', uvs: ['002', '003', '009', '010', '011', '015', '020', '021', '025', '047'] },
  { calle: 'José Manuel Balmaceda', uvs: ['012', '013', '018', '19A', '022', '037', '040', '041', '043'] },
  { calle: 'Brasil', uvs: ['014', '029', '033', '034', '035', '038', '039', '23A', '23B', '043', '044', '045'] },
  { calle: 'Domingo Santa María', uvs: ['012', '013', '014', '14B', '016', '017', '018', '042', '043', '044', '045', '046', '047'] },
  { calle: 'Dorsal', uvs: ['011', '012', '013', '014', '14B', '015', '016', '017', '029', '033', '034', '035', '036', '037', '038', '039', '040', '041', '042', '043', '044', '045'] },
  { calle: 'Américo Vespucio', uvs: ['006', '007', '008', '009', '010', '015', '033', '034', '036', '039', '041'] },
  { calle: 'Panamericana Norte', uvs: ['004', '005', '006', '007', '011', '012', '018', '022', '036', '037', '038', '039', '040', '041', '042'] },
  { calle: 'Av. El Cerro', uvs: ['001', '002', '003', '004', '005', '006', '008', '009'] },
  { calle: 'Lo Ruiz', uvs: ['006', '007', '008', '009', '010'] },
  { calle: 'Blanco Encalada', uvs: ['012', '040'] },
  { calle: 'Ignacio Carrera Pinto', uvs: ['042'] }
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
    for (const [mz, count] of Object.entries(porMacrozona).sort((a,b) => a[0] - b[0])) {
      console.log(`  Macrozona ${mz}: ${count} unidades vecinales`);
    }

    // Contar poblaciones totales
    let totalPoblaciones = 0;
    for (const uv of unidadesVecinales) {
      totalPoblaciones += uv.poblaciones.length;
    }
    console.log(`\n✓ ${totalPoblaciones} poblaciones asociadas a UVs`);

    console.log('\n✓ Seed completado exitosamente');
    console.log('\nEl sistema ahora puede identificar la UV basándose en:');
    console.log('  - Nombre de población');
    console.log('  - Nombre de calle');
    console.log('  - Palabras clave');
    console.log('\nNOTA: El administrador puede refinar los datos desde el panel de administración.');

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

export { seedUnidadesVecinales, unidadesVecinales, poblacionesRenca, callesPrincipales };
