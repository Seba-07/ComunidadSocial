/**
 * Configuración de la aplicación
 * Define si usar mocks (desarrollo local) o servicios reales (producción)
 */

export const APP_CONFIG = {
  // Modo de desarrollo (true = usa mocks, false = usa Firebase)
  USE_MOCKS: true,

  // Configuración de Firebase (para cuando USE_MOCKS = false)
  FIREBASE: {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
  },

  // Configuración de la aplicación
  APP: {
    name: 'Comunidad Renca',
    version: '2.0.0',
    environment: 'development' // 'development' | 'production'
  },

  // Requisitos según Ley 19.418
  ORGANIZATION_RULES: {
    MINIMUM_MEMBERS: {
      SMALL_COMMUNE: 50,
      MEDIUM_COMMUNE: 100,
      LARGE_COMMUNE: 200
    },
    MINIMUM_AGE: 14,
    ELECTORAL_COMMISSION_SIZE: 3,
    ELECTORAL_COMMISSION_SENIORITY: 1 // años
  },

  // Tipos de documentos requeridos
  REQUIRED_DOCUMENTS: [
    'ACTA_CONSTITUTIVA',
    'ESTATUTOS',
    'REGISTRO_SOCIOS',
    'DECLARACION_JURADA_PRESIDENTE',
    'CERTIFICADO_ANTECEDENTES'
  ],

  // Estados de las entidades
  STATUSES: {
    APPLICATION: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REQUIRES_CHANGES'],
    ORGANIZATION: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE'],
    DOCUMENT: ['PENDING', 'APPROVED', 'REJECTED']
  },

  // Roles de usuario
  ROLES: {
    ORGANIZADOR: 'ORGANIZADOR',      // Crea y administra organizaciones
    MUNICIPALIDAD: 'MUNICIPALIDAD',  // Administrador del sistema
    MIEMBRO: 'MIEMBRO',              // Miembro de una organización (solo lectura)
    MINISTRO_FE: 'MINISTRO_FE'       // Ministro de Fe para certificar asambleas
  }
};
