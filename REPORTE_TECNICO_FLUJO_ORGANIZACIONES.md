# REPORTE TÉCNICO COMPLETO: Flujo de Organizaciones Comunitarias

## Sistema ComunidadSocial - Análisis de Arquitectura y Flujo

**Fecha:** Enero 2026
**Versión:** 1.0
**Alcance:** Flujo completo desde creación hasta validación por Registro Civil

---

# ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Diagrama de Estados](#2-diagrama-de-estados)
3. [Flujo Detallado por Etapa](#3-flujo-detallado-por-etapa)
4. [Comparativa Backend vs Frontend](#4-comparativa-backend-vs-frontend)
5. [Análisis de Discrepancias](#5-análisis-de-discrepancias)
6. [Problemas Identificados](#6-problemas-identificados)
7. [Recomendaciones](#7-recomendaciones)

---

# 1. RESUMEN EJECUTIVO

## 1.1 Actores del Sistema

| Actor | Rol | Acciones Principales |
|-------|-----|---------------------|
| **ORGANIZADOR** | Usuario solicitante | Crea organización, completa wizard, responde correcciones |
| **MUNICIPALIDAD** | Administrador | Agenda ministros, revisa solicitudes, aprueba/rechaza, envía a RC |
| **MINISTRO_FE** | Validador externo | Valida asamblea constitutiva, captura firmas, aprueba |
| **MIEMBRO** | Usuario final | Accede a su organización después de aprobación |

## 1.2 Estados del Ciclo de Vida

```
draft → waiting_ministro → ministro_scheduled → ministro_approved
     → pending_review → in_review → [rejected ↔ pending_review]
     → sent_registry → approved → [dissolved]
```

## 1.3 Archivos Principales

| Componente | Frontend | Backend |
|------------|----------|---------|
| Wizard Creación | `WizardController.js` (7,875 líneas) | `POST /api/organizations` |
| Validación Ministro | `ValidationWizard.js` | `POST /api/assignments/:id/validate` |
| Panel Admin | `AdminDashboard.js` | `organizations.js`, `assignments.js` |
| Servicios | `OrganizationsService.js`, `ApiService.js` | Express routes + Mongoose |

---

# 2. DIAGRAMA DE ESTADOS

```
                                    ┌─────────────┐
                                    │    DRAFT    │ (No usado en prod)
                                    └──────┬──────┘
                                           │
                          Usuario completa Wizard (Pasos 1-6)
                                           │
                                    ┌──────▼──────────────┐
                                    │  WAITING_MINISTRO   │
                                    │ "Esperando Ministro"│
                                    └──────┬──────────────┘
                                           │
                          Admin agenda ministro de fe
                                           │
                                    ┌──────▼──────────────┐
                                    │ MINISTRO_SCHEDULED  │
                                    │  "Ministro Agendado"│
                                    └──────┬──────────────┘
                                           │
                          Ministro valida asamblea (Wizard 6 pasos)
                                           │
                                    ┌──────▼──────────────┐
                                    │  MINISTRO_APPROVED  │
                                    │ "Aprobado Ministro" │
                                    └──────┬──────────────┘
                                           │
                          Admin inicia revisión de documentos
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
       ┌─────────────┐            ┌────────────────┐           ┌──────────────┐
       │  REJECTED   │◄───────────│ PENDING_REVIEW │──────────►│   APPROVED   │
       │"Con Correc."│            │   (o IN_REVIEW)│           │              │
       └──────┬──────┘            └────────────────┘           └──────┬───────┘
              │                           ▲                           │
              │     Usuario corrige       │                           │
              │     y reenvía             │                           │
              └───────────────────────────┘                           │
                                                                      │
                                          Admin envía a Registro Civil
                                                                      │
                                                              ┌───────▼────────┐
                                                              │ SENT_REGISTRY  │
                                                              │"Enviado a RC"  │
                                                              └───────┬────────┘
                                                                      │
                                          Admin confirma inscripción RC
                                                                      │
                                                              ┌───────▼────────┐
                                                              │    APPROVED    │
                                                              │  "Inscrita"    │
                                                              └───────┬────────┘
                                                                      │
                                                              (Disolución)
                                                                      │
                                                              ┌───────▼────────┐
                                                              │   DISSOLVED    │
                                                              └────────────────┘
```

---

# 3. FLUJO DETALLADO POR ETAPA

## 3.1 ETAPA 1: Creación de Organización (Usuario - Wizard)

### Frontend: WizardController.js

**6 Pasos del Wizard:**

| Paso | Nombre | Campos Principales | Validaciones |
|------|--------|-------------------|--------------|
| 1 | Datos Básicos | tipo, nombre, dirección, comuna, contacto | HTML5 + Unidad Vecinal si JUNTA_VECINOS |
| 2 | Miembros Fundadores | Array de miembros con RUT, nombre, dirección | Mín 15 (o 200 para Juntas) |
| 3 | Config. Estatutos | meses de asamblea, cuotas | Sin validación estricta |
| 4 | Estatutos | Plantilla o archivo custom | Solo guardado |
| 5 | Directorio + Comisión | 3-6 cargos + 3 miembros comisión + certificados | Sin duplicados, certificados completos |
| 6 | Solicitud Ministro | fecha, hora, dirección asamblea | Fecha/hora requeridas |

**Estructura de Datos Enviada:**
```javascript
{
  organizationName: String,
  organizationType: String,  // Enum: 35 tipos
  address: String,
  comuna: "Renca",
  region: "Metropolitana",
  unidadVecinal: String,
  contactEmail: String,
  contactPhone: String,
  contactPreference: "phone" | "email",

  members: [{
    rut, firstName, lastName, address, phone, email,
    birthDate, occupation, role, signature, certificate
  }],

  provisionalDirectorio: {
    president: { rut, firstName, lastName },
    secretary: {...},
    treasurer: {...},
    additionalMembers: [...]
  },

  electoralCommission: [{
    rut, firstName, lastName, role: "electoral_commission"
  }],

  estatutos: String,  // HTML
  electionDate: "YYYY-MM-DD",
  electionTime: "HH:MM",
  assemblyAddress: String
}
```

### Backend: POST /api/organizations

**Procesamiento:**
1. Extrae campos válidos (whitelist)
2. Limpia certificados de miembros (remove base64 grandes)
3. Asigna `userId` del token
4. Status inicial: `waiting_ministro`
5. Crea entrada en `statusHistory`

**Respuesta Simplificada:**
```javascript
{
  _id: ObjectId,
  organizationName: String,
  organizationType: String,
  status: "waiting_ministro",
  electionDate: Date,
  electionTime: String,
  createdAt: Date
}
```

---

## 3.2 ETAPA 2: Asignación de Ministro (Admin)

### Frontend: AdminDashboard.js

**Acciones:**
1. Admin ve solicitudes en estado `waiting_ministro`
2. Abre modal de asignación
3. Selecciona ministro de lista
4. Define fecha, hora y ubicación

### Backend: POST /api/organizations/:id/schedule-ministro

**Payload:**
```javascript
{
  ministroId: ObjectId,
  ministroName: String,
  ministroRut: String,
  scheduledDate: Date,
  scheduledTime: String,
  location: String
}
```

**Efectos:**
- Status → `ministro_scheduled`
- Crea/actualiza `ministroData` en organización
- Si es reagendamiento: guarda en `appointmentChanges`
- Crea Assignment para el ministro
- Notificación al usuario: "Ministro de Fe asignado"

---

## 3.3 ETAPA 3: Validación del Ministro de Fe

### Frontend: ValidationWizard.js (6 pasos)

| Paso | Acción | Datos Capturados |
|------|--------|------------------|
| 1 | Directorio Provisorio | presidente, secretario, tesorero + firmas digitales |
| 2 | Miembros Adicionales | directores, vocales + firmas (opcional) |
| 3 | Comisión Electoral | 3 miembros + firmas |
| 4 | Asistentes | Lista de presentes + firmas |
| 5 | Estatutos + Foto | Revisión estatutos + foto grupal |
| 6 | Confirmación | Firma del ministro + notas |

**Persistencia:** IndexedDB para recuperación offline

### Backend: POST /api/assignments/:id/validate

**Payload:**
```javascript
{
  signatures: [{
    memberId, memberName, memberRut, role, signature, signedAt
  }],
  wizardData: {
    provisionalDirectorio: { president, secretary, treasurer, additionalMembers },
    comisionElectoral: [...],
    attendees: [...],
    ministroSignature: String,
    groupPhoto: String,
    validatorId, validatorName
  }
}
```

**Efectos:**
1. Assignment.status → `completed`
2. Assignment.signaturesValidated → true
3. Genera números únicos: `certNumber`, `depositNumber`
4. Organization.status → `ministro_approved`
5. Copia `provisionalDirectorio`, `comisionElectoral`, `validatedAttendees`
6. Guarda `validationData` con firma del ministro

---

## 3.4 ETAPA 4: Revisión Municipal

### Frontend: AdminDashboard.js

**Tabs de Revisión:**
1. Información General
2. Miembros Fundadores
3. Directorio + Comisión
4. Documentos Oficiales
5. Registro Civil (cuando aplica)
6. Historial

**Sistema de Marcado de Errores:**
```javascript
markedCorrections = {
  fields: { "organizationName": "Nombre incorrecto" },
  documents: { "estatutos": "Falta firma" },
  certificates: { "presidente": "Documento ilegible" },
  members: { "12345678-9": "RUT inválido" },
  commission: { "miembro1": "No cumple requisitos" }
}
```

### Backend: Endpoints de Revisión

**Aprobar:** `POST /api/organizations/:id/status`
```javascript
{ status: "approved", comment: "Documentación completa" }
```

**Rechazar:** `POST /api/organizations/:id/reject`
```javascript
{
  corrections: { fields, documents, certificates },
  generalComment: "Revisar documentación"
}
```

**Notificación:** "Correcciones requeridas" con detalles

---

## 3.5 ETAPA 5: Reenvío tras Correcciones

### Frontend: Usuario ve correcciones y responde

**Flujo:**
1. Usuario recibe notificación de rechazo
2. Ve lista de correcciones por campo
3. Corrige y agrega respuesta por campo
4. Reenvía solicitud

### Backend: POST /api/organizations/:id/resubmit

**Payload:**
```javascript
{
  userComment: "He corregido los documentos",
  fieldResponses: {
    "estatutos": "Actualizado con firma",
    "organizationName": "Corregido"
  }
}
```

**Efectos:**
- Status → `pending_review`
- corrections.resolved → true
- corrections.userResponse → comentario
- Agrega entrada en statusHistory

---

## 3.6 ETAPA 6: Envío a Registro Civil

### Frontend: AdminDashboard.js

**Generación de Paquete ZIP:**
```
Registro_Civil_{OrgName}_{Date}.zip
├── 01_Documentos_Oficiales/
│   ├── Acta_Asamblea_Constitutiva.pdf
│   ├── Lista_Socios.pdf
│   ├── Certificado_Ministro_Fe.pdf
│   ├── Certificacion_Municipal.pdf
│   └── Deposito_Antecedentes.pdf
├── 02_Declaraciones_Juradas/
│   └── Declaracion_{Cargo}_{Nombre}.pdf (por cada directivo)
└── 03_Certificados_Antecedentes/
    └── Certificado_{Cargo}_{Nombre}.{ext}
```

**Modal de Envío:**
- Número de Oficio/Referencia
- Notas adicionales
- Confirmación

### Backend: POST /api/organizations/:id/status

```javascript
{ status: "sent_registry", comment: "Enviado - Ref: OF-2024-001" }
```

---

## 3.7 ETAPA 7: Confirmación de Inscripción

### Frontend: Modal de Confirmación RC

**Campos:**
- Número de Inscripción del RC
- Fecha de Inscripción
- Observaciones

### Backend: POST /api/organizations/:id/status

```javascript
{
  status: "approved",
  comment: "Inscripción confirmada - N° RC-2024-12345 - Fecha: 15/01/2024"
}
```

**Efecto adicional:** Se pueden crear cuentas de miembros:
`POST /api/organizations/:id/create-member-accounts`

---

# 4. COMPARATIVA BACKEND VS FRONTEND

## 4.1 Campos del Modelo Organization

| Campo | Backend (Mongoose) | Frontend (Enviado) | Discrepancia |
|-------|-------------------|-------------------|--------------|
| `organizationName` | ✅ String, required | ✅ String | - |
| `organizationType` | ✅ Enum (35 tipos) | ✅ Enum | ⚠️ Frontend tiene 17, Backend 35 |
| `address` | ✅ String, required | ✅ String | - |
| `comuna` | ✅ String, default "Renca" | ✅ Forzado "Renca" | - |
| `region` | ✅ String, default "Metropolitana" | ✅ Forzado | - |
| `unidadVecinal` | ✅ String | ✅ Solo si JUNTA_VECINOS | - |
| `territory` | ✅ String | ❌ No enviado | ⚠️ Campo no usado |
| `contactEmail` | ✅ String | ✅ Desde perfil | - |
| `contactPhone` | ✅ String | ✅ Desde perfil | - |
| `contactPreference` | ✅ Enum ["phone","email"] | ✅ Radio buttons | - |
| `members` | ✅ Array embebido | ✅ Array | ⚠️ Estructura diferente |
| `minMembers` | ✅ Number, default 15 | ❌ Calculado en frontend | - |
| `electoralCommission` | ✅ Array | ✅ Array | - |
| `provisionalDirectorio` | ✅ Mixed schema | ✅ Objeto | ⚠️ Estructura flexible |
| `status` | ✅ Enum (10 estados) | ⚠️ 11 estados en frontend | ⚠️ REGISTRY_OBSERVATIONS extra |
| `electionDate` | ✅ Date | ✅ String "YYYY-MM-DD" | - |
| `electionTime` | ✅ String | ✅ String "HH:MM" | - |
| `assemblyAddress` | ✅ String | ✅ String | - |
| `estatutos` | ✅ String | ✅ String (HTML) | - |
| `certNumber` | ✅ String | ❌ Generado en backend | - |
| `depositNumber` | ✅ String | ❌ Generado en backend | - |

## 4.2 Estructura de Miembros

**Backend (memberSchema):**
```javascript
{
  rut: String,
  firstName: String,
  lastName: String,
  address: String,
  phone: String,
  email: String,
  birthDate: String,
  occupation: String,
  role: Enum ["president","secretary","treasurer","director","member","electoral_commission"],
  signature: String,
  certificate: String
}
```

**Frontend (formData.members):**
```javascript
{
  rut: String,
  primerNombre: String,      // ⚠️ Diferente nombre
  segundoNombre: String,     // ⚠️ Campo extra
  apellidoPaterno: String,   // ⚠️ Diferente nombre
  apellidoMaterno: String,   // ⚠️ Campo extra
  fechaNacimiento: String,
  direccion: String,         // ⚠️ Diferente nombre
  telefono: String,          // ⚠️ Diferente nombre
  email: String,
  profesion: String,         // ⚠️ Diferente nombre
  genero: String             // ⚠️ Campo extra no en backend
}
```

**Mapeo en OrganizationsService.js:**
```javascript
// Línea ~400: Se mapean campos
firstName: member.primerNombre,
lastName: `${member.apellidoPaterno} ${member.apellidoMaterno}`,
address: member.direccion,
phone: member.telefono,
occupation: member.profesion
```

## 4.3 Estados de Organización

| Estado | Backend | Frontend | Descripción |
|--------|---------|----------|-------------|
| `draft` | ✅ | ✅ | Borrador (no usado) |
| `waiting_ministro` | ✅ | ✅ | Esperando asignación |
| `ministro_scheduled` | ✅ | ✅ | Ministro agendado |
| `ministro_approved` | ✅ | ✅ | Aprobado por ministro |
| `pending_review` | ✅ | ✅ | Pendiente revisión |
| `in_review` | ✅ | ✅ | En revisión |
| `rejected` | ✅ | ✅ | Rechazado |
| `sent_registry` | ✅ | ✅ | Enviado a RC |
| `approved` | ✅ | ✅ | Aprobado final |
| `dissolved` | ✅ | ✅ | Disuelta |
| `registry_observations` | ❌ | ✅ | ⚠️ SOLO EN FRONTEND |

---

# 5. ANÁLISIS DE DISCREPANCIAS

## 5.1 CRÍTICAS (Pueden causar errores)

### D1: Estado `registry_observations` no existe en backend

**Ubicación Frontend:** `OrganizationsService.js` línea ~40
```javascript
REGISTRY_OBSERVATIONS: 'registry_observations'
```

**Problema:** Si el frontend intenta establecer este estado, el backend rechazará por validación de enum.

**Impacto:** Error 400 al intentar marcar observaciones del RC.

---

### D2: Campo `territory` nunca se envía

**Backend:** Campo definido en schema
**Frontend:** No se recopila en ningún paso del wizard

**Impacto:** Campo siempre vacío en DB.

---

### D3: Estructura de miembros diferente

**Problema:** Frontend usa nombres en español (`primerNombre`, `apellidoPaterno`), backend espera inglés (`firstName`, `lastName`).

**Mitigación actual:** OrganizationsService mapea los campos.

**Riesgo:** Si se envía directamente sin mapear, los datos se perderán.

---

### D4: Campo `genero` no existe en backend

**Frontend:** Recopila género del miembro
**Backend:** No tiene campo `genero` en memberSchema

**Impacto:** Dato se pierde en la conversión.

---

### D5: Tipos de organización desincronizados

**Backend:** 35 tipos definidos en enum
**Frontend:** 17 tipos en fallback + carga dinámica

**Riesgo:** Si la API falla, el frontend usa fallback incompleto.

---

## 5.2 MODERADAS (Funcionalidad degradada)

### D6: Certificados se limpian en creación

**Backend:** `organizations.js` línea 247-251
```javascript
const cleanMember = (member) => {
  const { certificado, certificate, ...cleanData } = member;
  return cleanData;
}
```

**Problema:** Los certificados de antecedentes del directorio provisorio se eliminan al crear la organización.

**Ubicación real:** `certificatesStep5` se envía pero no se guarda.

---

### D7: `segundoNombre` y `apellidoMaterno` se concatenan

**Frontend:** Campos separados
**Backend:** Un solo campo `firstName` y `lastName`

**Pérdida:** `segundoNombre` se pierde, `apellidoMaterno` se concatena.

---

### D8: Validación de edad solo en frontend

**Frontend:** Valida que miembros sean mayores de 14 años
**Backend:** No valida edad

**Riesgo:** Si se envía directamente al API, se pueden registrar menores.

---

## 5.3 MENORES (Inconsistencias de datos)

### D9: Campos de contacto read-only pero editables en perfil

El wizard carga email/teléfono del perfil como read-only, pero si el perfil está incompleto, no hay forma de editarlos en el wizard.

---

### D10: `minMembers` calculado diferente

**Frontend:** Dinámico según tipo (200 para JUNTA_VECINOS, 15 otros)
**Backend:** Default 15 fijo en schema

---

# 6. PROBLEMAS IDENTIFICADOS

## 6.1 Bugs Potenciales (CORREGIDOS)

| ID | Severidad | Descripción | Ubicación | Estado |
|----|-----------|-------------|-----------|--------|
| BUG-001 | 🔴 Alta | Estado `registry_observations` no existe en backend | `Organization.js:134` | ✅ CORREGIDO |
| BUG-002 | 🔴 Alta | Certificados de directorio se pierden en creación | `organizations.js:284-293` | ✅ CORREGIDO |
| BUG-003 | 🟡 Media | Campo `genero` se pierde al guardar | `Organization.js:14-18` | ✅ CORREGIDO |
| BUG-004 | 🟡 Media | `segundoNombre` se pierde en mapeo | `OrganizationsService.js:341` | ✅ CORREGIDO |
| BUG-005 | 🟡 Media | `apellidoMaterno` como campo separado | `Organization.js:8` | ✅ CORREGIDO |
| BUG-006 | 🟡 Media | Tipos de organización desincronizados (17 vs 35) | WizardController fallback | ⏳ Pendiente |
| BUG-007 | 🟢 Baja | Campo `territory` nunca se usa | Schema vs Wizard | ⏳ Pendiente |

## 6.2 Problemas de Arquitectura

| ID | Descripción | Impacto |
|----|-------------|---------|
| ARQ-001 | WizardController.js tiene 7,875 líneas | Mantenibilidad difícil |
| ARQ-002 | Duplicación de lógica de estados | Inconsistencias |
| ARQ-003 | Mapeo de campos manual propenso a errores | Bugs de datos |
| ARQ-004 | Certificados en Base64 embebidos | Riesgo de límite 16MB MongoDB |
| ARQ-005 | Sin validación Zod en endpoints críticos | ✅ CORREGIDO - Validación Zod aplicada |

## 6.3 Problemas de Seguridad Resueltos

| ID | Descripción | Estado |
|----|-------------|--------|
| SEC-001 | JWT_SECRET con fallback | ✅ Corregido |
| SEC-002 | CORS permitía cualquier origen | ✅ Corregido |
| SEC-003 | Sin rate limiting en login | ✅ Corregido |
| SEC-004 | Mass assignment vulnerable | ✅ Corregido |
| SEC-005 | XSS en contenido HTML | ✅ Corregido (DOMPurify) |

## 6.4 Gaps Funcionales

| ID | Descripción | Estado Actual |
|----|-------------|---------------|
| GAP-001 | No hay endpoint para `registry_observations` | ✅ CORREGIDO - Estado agregado al enum |
| GAP-002 | No hay validación de RUT en backend | ✅ CORREGIDO - `rutValidator.js` con módulo 11 |
| GAP-003 | No hay validación de edad en backend | Solo frontend |
| GAP-004 | Foto grupal puede no guardarse | Campo `groupPhoto` a veces vacío |
| GAP-005 | Sin recuperación de wizard en backend | Solo IndexedDB local |

---

# 7. RECOMENDACIONES

## 7.1 Correcciones Prioritarias

### P1: Agregar estado `registry_observations` al backend
```javascript
// Organization.js - agregar al enum de status
status: {
  type: String,
  enum: [
    'draft', 'waiting_ministro', 'ministro_scheduled', 'ministro_approved',
    'pending_review', 'in_review', 'rejected', 'sent_registry',
    'registry_observations',  // ← AGREGAR
    'approved', 'dissolved'
  ]
}
```

### P2: Guardar certificados del paso 5
```javascript
// organizations.js - En POST /
if (req.body.certificatesStep5) {
  orgData.certificatesStep5 = req.body.certificatesStep5;
}
```

### P3: Agregar campo `genero` al memberSchema
```javascript
// Organization.js
genero: {
  type: String,
  enum: ['masculino', 'femenino', 'otro', 'no_especifica']
}
```

### P4: Sincronizar tipos de organización
- Crear endpoint `/api/organization-types` ✅ (Ya existe)
- Asegurar que frontend SIEMPRE cargue de API antes de fallback

## 7.2 Mejoras de Arquitectura

### A1: Dividir WizardController.js
```
WizardController.js →
├── WizardStep1_DatosBasicos.js
├── WizardStep2_Miembros.js
├── WizardStep3_Estatutos.js
├── WizardStep4_EstatutosContent.js
├── WizardStep5_Directorio.js
├── WizardStep6_Ministro.js
└── WizardController.js (orquestador)
```

### A2: Crear DTOs compartidos
```javascript
// shared/dto/MemberDTO.js
export class MemberDTO {
  constructor(frontendData) {
    this.rut = frontendData.rut;
    this.firstName = frontendData.primerNombre;
    this.lastName = `${frontendData.apellidoPaterno} ${frontendData.apellidoMaterno || ''}`.trim();
    // ...
  }
}
```

### A3: Validación Zod en endpoint de creación
```javascript
// Ya creado en middleware/validation.js
// Aplicar: router.post('/', validate(createOrganizationSchema), ...)
```

## 7.3 Mejoras de UX

| Mejora | Descripción |
|--------|-------------|
| UX-001 | Mostrar progreso de guardado del wizard |
| UX-002 | Permitir editar contacto en wizard si perfil incompleto |
| UX-003 | Previsualización de documentos antes de enviar a RC |
| UX-004 | Notificación push para cambios de estado |

---

# ANEXOS

## A. Endpoints Completos

### Organizaciones
| Método | Endpoint | Rol | Descripción |
|--------|----------|-----|-------------|
| GET | `/api/organizations` | MUNICIPALIDAD | Lista todas |
| GET | `/api/organizations/my` | Auth | Lista propias |
| GET | `/api/organizations/:id` | Owner/Admin | Detalle |
| POST | `/api/organizations` | Auth | Crear |
| PUT | `/api/organizations/:id` | Owner/Admin | Actualizar |
| POST | `/api/organizations/:id/schedule-ministro` | MUNICIPALIDAD | Agendar ministro |
| POST | `/api/organizations/:id/approve-ministro` | MINISTRO_FE | Aprobar asamblea |
| POST | `/api/organizations/:id/status` | MUNICIPALIDAD | Cambiar estado |
| POST | `/api/organizations/:id/reject` | MUNICIPALIDAD | Rechazar |
| POST | `/api/organizations/:id/resubmit` | Owner | Reenviar |
| POST | `/api/organizations/:id/create-member-accounts` | MUNICIPALIDAD | Crear cuentas |
| GET | `/api/organizations/availability/booked-slots` | Público | Horarios ocupados |

### Asignaciones
| Método | Endpoint | Rol | Descripción |
|--------|----------|-----|-------------|
| GET | `/api/assignments/my/pending` | MINISTRO_FE | Mis asignaciones |
| POST | `/api/assignments/:id/validate` | MINISTRO_FE | Validar asamblea |
| POST | `/api/assignments/:id/reset-validation` | MINISTRO_FE | Resetear validación |

## B. Modelo de Datos Completo

Ver archivo: `/server/models/Organization.js` (262 líneas)

## C. Flujo de Notificaciones

| Evento | Tipo | Destinatario |
|--------|------|--------------|
| Ministro asignado | `ministro_assigned` | Usuario |
| Cita reagendada | `schedule_change` | Usuario |
| Asamblea aprobada | `organization_approved` | Usuario |
| Estado cambiado | `status_change` | Usuario |
| Correcciones requeridas | `correction_required` | Usuario |
| Cuentas creadas | `member_accounts_created` | Usuario |

---

# 8. CORRECCIONES APLICADAS (Enero 2026)

## 8.1 Resumen de Cambios

| Archivo | Cambio | Estado |
|---------|--------|--------|
| `server/models/Organization.js` | Agregado estado `registry_observations` al enum | ✅ |
| `server/models/Organization.js` | Agregado campo `certificatesStep5` al schema | ✅ |
| `server/models/Organization.js` | Agregado campo `genero` a memberSchema | ✅ |
| `server/models/Organization.js` | Agregado campo `segundoNombre` a memberSchema | ✅ |
| `server/models/Organization.js` | Agregado campo `apellidoMaterno` a memberSchema | ✅ |
| `server/routes/organizations.js` | Guardado de `certificatesStep5` en POST | ✅ |
| `server/routes/organizations.js` | Aplicada validación Zod a POST y status | ✅ |
| `server/middleware/validation.js` | Actualizado memberSchema con nuevos campos | ✅ |
| `server/middleware/validation.js` | Actualizado statusChangeSchema con `registry_observations` | ✅ |
| `server/middleware/validation.js` | Validación de RUT con dígito verificador | ✅ |
| `server/utils/rutValidator.js` | **NUEVO** - Validador de RUT chileno (módulo 11) | ✅ |
| `src/services/OrganizationsService.js` | Mapeo de campos actualizado | ✅ |

## 8.2 Detalle de Archivos Modificados

### Backend

**`server/models/Organization.js`**
```javascript
// memberSchema actualizado (líneas 3-26)
const memberSchema = new mongoose.Schema({
  rut: { type: String, required: true },
  firstName: { type: String, required: true },
  segundoNombre: { type: String, default: '' }, // NUEVO
  lastName: { type: String, required: true },
  apellidoMaterno: { type: String, default: '' }, // NUEVO
  // ...
  genero: { // NUEVO
    type: String,
    enum: ['masculino', 'femenino', 'otro', 'no_especifica', ''],
    default: ''
  },
  // ...
});

// status enum actualizado (líneas 122-139)
status: {
  enum: [
    // ...
    'registry_observations', // NUEVO
    // ...
  ]
}

// certificatesStep5 (líneas 167-173)
certificatesStep5: [{ // NUEVO
  memberId: String,
  memberName: String,
  certificate: String,
  uploadedAt: Date
}]
```

**`server/utils/rutValidator.js`** (NUEVO ARCHIVO)
- `cleanRut(rut)` - Limpia formato
- `formatRut(rut)` - Formatea a XX.XXX.XXX-X
- `calculateDV(rutBody)` - Calcula dígito verificador (módulo 11)
- `validateRut(rut)` - Validación completa
- `validateMembersRuts(members)` - Validación de array de miembros

### Frontend

**`src/services/OrganizationsService.js`**
```javascript
// Mapeo actualizado (líneas 338-351)
const mappedMembers = members.map((m, index) => ({
  rut: m.rut,
  firstName: m.primerNombre || m.firstName || ...,
  segundoNombre: m.segundoNombre || '', // NUEVO
  lastName: m.apellidoPaterno || m.lastName || ...,
  apellidoMaterno: m.apellidoMaterno || '', // NUEVO
  // ...
  genero: m.genero || m.sexo || '', // NUEVO
  // ...
}));
```

## 8.3 Compatibilidad

- ✅ Cambios son retrocompatibles (nuevos campos son opcionales)
- ✅ Build de frontend exitoso
- ✅ Sintaxis de backend verificada
- ✅ Validación Zod no rompe solicitudes existentes

## 8.4 Pendientes

| Item | Prioridad |
|------|-----------|
| Sincronizar tipos de organización (17 vs 35) | Media |
| Campo `territory` sin uso | Baja |
| Validación de edad en backend | Baja |

---

**Fin del Reporte Técnico**

*Documento generado y actualizado con correcciones aplicadas - Enero 2026*
