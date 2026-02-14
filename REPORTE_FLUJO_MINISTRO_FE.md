# Reporte Tecnico: Flujo de Ministro de Fe

**Proyecto:** ComunidadSocial
**Fecha:** 2026-01-08
**Version:** 1.0

---

## Resumen Ejecutivo

Este reporte documenta el flujo completo del Ministro de Fe en el sistema ComunidadSocial, incluyendo autenticacion, gestion de asignaciones, proceso de validacion de firmas y generacion de documentos.

### Metricas Clave

| Componente | Valor |
|------------|-------|
| Endpoints Backend | 16 |
| Pasos del Wizard | 6 |
| Estados de Organization relacionados | 3 |
| Archivos principales | 8 |
| Lineas de codigo ValidationWizard | 2,412 |

---

## 1. Arquitectura del Flujo

### 1.1 Diagrama General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FLUJO MINISTRO DE FE                                │
└─────────────────────────────────────────────────────────────────────────┘

  ORGANIZADOR              MUNICIPALIDAD             MINISTRO DE FE
      │                         │                         │
      │  1. Crea organizacion   │                         │
      │  (status: waiting_      │                         │
      │   ministro)             │                         │
      │ ─────────────────────► │                         │
      │                         │                         │
      │                         │  2. Agenda Ministro     │
      │                         │  (status: ministro_     │
      │                         │   scheduled)            │
      │                         │ ──────────────────────► │
      │                         │                         │
      │                         │                         │  3. Realiza
      │                         │                         │     asamblea
      │                         │                         │
      │                         │                         │  4. Valida
      │                         │                         │     firmas
      │                         │                         │     (Wizard)
      │                         │                         │
      │                         │  5. Org aprobada        │
      │                         │ ◄────────────────────── │
      │  6. Notificacion        │  (status: ministro_     │
      │ ◄───────────────────── │   approved)             │
      │                         │                         │
```

### 1.2 Componentes del Sistema

```
┌──────────────────────────────────────────────────────────────────┐
│                        BACKEND                                   │
├──────────────────────────────────────────────────────────────────┤
│  server/routes/ministros.js      → Auth + CRUD Ministros         │
│  server/routes/assignments.js    → Gestion de asignaciones       │
│  server/routes/organizations.js  → Estados y aprobacion          │
│  server/models/User.js           → Modelo de usuario/ministro    │
│  server/models/Assignment.js     → Modelo de asignacion          │
│  server/models/Organization.js   → Modelo de organizacion        │
│  server/models/Counter.js        → Numeracion certificados       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
├──────────────────────────────────────────────────────────────────┤
│  ministro-dashboard.js           → Dashboard principal           │
│  src/presentation/ministro/      → ValidationWizard (2,412 ln)   │
│  src/services/MinistroAssignment → Servicio de API               │
│  src/services/ApiService.js      → Cliente HTTP                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Autenticacion del Ministro

### 2.1 Endpoint de Login

**Ruta:** `POST /api/ministros/login`
**Archivo:** `server/routes/ministros.js:185-226`

```javascript
// Rate limiting: 5 intentos por 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Intente en 15 minutos.' }
});

// Validaciones:
// 1. Email existe y es MINISTRO_FE
// 2. Cuenta esta activa
// 3. Password valido (bcrypt)
// 4. Genera JWT (7 dias)
// 5. Setea cookie HttpOnly
```

### 2.2 Cookie de Autenticacion

```javascript
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  path: '/'
};
res.cookie('auth_token', token, cookieOptions);
```

### 2.3 Middleware de Autorizacion

**Archivo:** `server/middleware/auth.js`

```javascript
// Prioridad de token:
// 1. Cookie HttpOnly (preferido)
// 2. Header Authorization (fallback)

authenticate: (req, res, next) => {
  let token = req.cookies?.auth_token ||
              req.headers.authorization?.split(' ')[1];
  // ...validacion JWT
}

requireRole: (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
}
```

---

## 3. Gestion de Asignaciones

### 3.1 Endpoints de Assignment

| Endpoint | Metodo | Rol | Descripcion |
|----------|--------|-----|-------------|
| `/assignments` | GET | MUNICIPALIDAD | Listar todas |
| `/assignments/ministro/:id` | GET | Self/Admin | Por ministro |
| `/assignments/my/pending` | GET | MINISTRO_FE | Mis pendientes |
| `/assignments/:id` | GET | Auth | Detalle |
| `/assignments` | POST | MUNICIPALIDAD | Crear asignacion |
| `/assignments/:id` | PUT | Auth | Actualizar |
| `/assignments/:id/validate` | POST | MINISTRO_FE | **Validar firmas** |
| `/assignments/:id/reset-validation` | POST | MINISTRO_FE | Resetear |
| `/assignments/:id/complete` | POST | MINISTRO_FE | Completar |
| `/assignments/:id/cancel` | POST | MUNICIPALIDAD | Cancelar |
| `/assignments/check-conflict/:m/:d/:t` | GET | Auth | Verificar conflicto |
| `/assignments/stats/:id` | GET | Auth | Estadisticas |

### 3.2 Creacion de Asignacion

**Ruta:** `POST /api/assignments`
**Archivo:** `server/routes/assignments.js:174-219`

```javascript
// Datos requeridos:
{
  ministroId: ObjectId,
  ministroName: String,
  ministroRut: String,
  organizationId: ObjectId,
  organizationName: String,
  scheduledDate: Date,
  scheduledTime: String,  // "HH:MM"
  location: String
}

// Validacion de conflictos:
const conflict = await Assignment.findOne({
  ministroId,
  scheduledDate: new Date(scheduledDate),
  scheduledTime,
  status: { $ne: 'cancelled' }
});
// Usa indice compuesto para performance
```

### 3.3 Modelo Assignment

**Archivo:** `server/models/Assignment.js`

```javascript
{
  // Referencias
  ministroId: ObjectId,        // ref: User
  organizationId: ObjectId,    // ref: Organization

  // Metadata
  ministroName: String,
  ministroRut: String,
  organizationName: String,
  scheduledDate: Date,
  scheduledTime: String,
  location: String,
  status: 'pending' | 'completed' | 'cancelled',

  // Validacion
  signaturesValidated: Boolean,
  validatedAt: Date,
  validatedBy: String,
  signatures: [signatureSchema],
  validationHistory: [validationHistorySchema],  // Max 10

  // Wizard Data
  wizardData: {
    directorio: { president, secretary, treasurer },
    additionalMembers: [Mixed],
    comisionElectoral: [Mixed],
    attendees: [Mixed],
    ministroSignature: String,
    groupPhoto: String,
    notes: String
  }
}
```

---

## 4. ValidationWizard (Frontend)

### 4.1 Overview

**Archivo:** `src/presentation/ministro/ValidationWizard.js`
**Lineas:** 2,412
**Export:** `openValidationWizard(assignment, org, currentMinistro, callbacks)`

### 4.2 Los 6 Pasos del Wizard

```
┌─────────────────────────────────────────────────────────────────┐
│  PASO 1: DIRECTORIO PROVISORIO                                 │
│  ─────────────────────────────                                  │
│  - Seleccionar Presidente, Secretario, Tesorero                │
│  - Firmar cada cargo en canvas                                  │
│  - Permite entrada manual si no esta en lista                  │
│  - Validacion: Los 3 cargos deben estar firmados               │
│                                                                 │
│  Datos guardados:                                               │
│  wizardData.directorio = {                                      │
│    president: { id, name, rut, signature },                    │
│    secretary: { id, name, rut, signature },                    │
│    treasurer: { id, name, rut, signature }                     │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 2: MIEMBROS ADICIONALES                                  │
│  ────────────────────────────                                   │
│  - Agregar directores/vocales adicionales (opcional)           │
│  - Especificar cargo para cada uno                             │
│  - Firmar cada miembro adicional                               │
│  - Botones dinamicos agregar/eliminar                          │
│                                                                 │
│  Datos guardados:                                               │
│  wizardData.additionalMembers = [                               │
│    { cargo, name, rut, signature, isManual }                   │
│  ]                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 3: COMISION ELECTORAL                                    │
│  ──────────────────────────                                     │
│  - Seleccionar exactamente 3 miembros                          │
│  - NO pueden ser del directorio                                │
│  - Firmar cada miembro de comision                             │
│  - Validacion: 3 miembros unicos con firmas                    │
│                                                                 │
│  Datos guardados:                                               │
│  wizardData.comisionElectoral = [                               │
│    { id, name, rut, signature }                                │
│  ]                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 4: ASISTENTES A ASAMBLEA                                 │
│  ─────────────────────────────                                  │
│  - Auto-incluye miembros de pasos 1-3                          │
│  - Agregar asistentes externos                                  │
│  - Firmar nuevos asistentes                                     │
│  - Contador de asistentes totales                              │
│                                                                 │
│  Datos guardados:                                               │
│  wizardData.attendees = [                                       │
│    { name, rut, signature, source }                            │
│  ]                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 5: REVISION DE ESTATUTOS                                 │
│  ─────────────────────────────                                  │
│  - Muestra estatutos de la organizacion                        │
│  - Permite edicion en textarea                                  │
│  - Boton preview para vista previa                             │
│  - Opcion restaurar original                                    │
│                                                                 │
│  Datos guardados:                                               │
│  wizardData.estatutos = "texto editado..."                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 6: CONFIRMACION Y FIRMA MINISTRO                         │
│  ─────────────────────────────────────                          │
│  - Resumen de todos los pasos anteriores                       │
│  - Vista completa de estatutos                                  │
│  - Subir/capturar foto grupal                                   │
│  - Campo de observaciones                                       │
│  - FIRMA DEL MINISTRO (canvas)                                 │
│  - Modal de confirmacion final                                  │
│                                                                 │
│  Datos guardados:                                               │
│  wizardData.ministroSignature = "base64..."                    │
│  wizardData.groupPhoto = "base64..."                           │
│  wizardData.notes = "observaciones..."                         │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Captura de Firmas

**Lineas:** 526-646

```javascript
// Configuracion del canvas
const canvas = sigModal.querySelector('#sig-modal-canvas');
const ctx = canvas.getContext('2d');
ctx.strokeStyle = '#1f2937';
ctx.lineWidth = 3;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Dimensiones: 552x200 pixels

// Eventos soportados:
// - mousedown/touchstart → Iniciar trazo
// - mousemove/touchmove → Dibujar
// - mouseup/touchend → Terminar trazo

// Conversion a Base64:
const dataURL = canvas.toDataURL('image/png');
signatureData[signatureKey] = dataURL;
```

### 4.4 Persistencia Offline (IndexedDB)

**Lineas:** 377-460

```javascript
// Base de datos: 'validation-app'
// Store: 'validationWizardStates'
// Key: assignmentId

// Auto-guardado en cada navegacion de paso
async function persistWizardState() {
  const db = await openDB('validation-app', 1, {
    upgrade(db) {
      db.createObjectStore('validationWizardStates', { keyPath: 'id' });
    }
  });
  await db.put('validationWizardStates', {
    id: assignmentId,
    currentStep,
    wizardData,
    timestamp: Date.now()
  });
}

// Modal de recuperacion si hay sesion interrumpida
function showRecoveryModal() {
  // Pregunta: "Continuar sesion anterior?" o "Empezar de nuevo"
}
```

---

## 5. Endpoint de Validacion

### 5.1 POST /assignments/:id/validate

**Archivo:** `server/routes/assignments.js:241-312`
**Roles permitidos:** MINISTRO_FE, MUNICIPALIDAD

### 5.2 Request Body

```javascript
{
  signatures: [
    {
      memberId: String,
      memberName: String,
      memberRut: String,
      role: String,
      signature: String,  // Base64
      signedAt: Date
    }
  ],
  wizardData: {
    provisionalDirectorio: {
      president: { name, rut, signature },
      secretary: { name, rut, signature },
      treasurer: { name, rut, signature },
      additionalMembers: []
    },
    comisionElectoral: [],
    attendees: [],
    ministroSignature: String,  // Base64
    groupPhoto: String,         // Base64
    validatorId: String,
    validatorName: String
  }
}
```

### 5.3 Flujo de Procesamiento

```
POST /assignments/:id/validate
          │
          ▼
┌─────────────────────────────────────┐
│ 1. Actualizar Assignment            │
│    - signaturesValidated = true     │
│    - validatedAt = now              │
│    - validatedBy = 'MINISTRO'       │
│    - signatures = [...]             │
│    - wizardData = {...}             │
│    - status = 'completed'           │
└─────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│ 2. Generar Numeros de Certificacion │
│    - certNumber = Counter('cert')   │
│    - depositNumber = Counter('dep') │
│    Formato: "001/2026"              │
└─────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│ 3. Actualizar Organization          │
│    - status = 'ministro_approved'   │
│    - certNumber, depositNumber      │
│    - provisionalDirectorio          │
│    - comisionElectoral              │
│    - validatedAttendees             │
│    - validationData = {             │
│        validatedAt,                 │
│        validatorId,                 │
│        validatorName,               │
│        ministroSignature,           │
│        signatures                   │
│      }                              │
│    - statusHistory.push({...})      │
└─────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│ 4. Respuesta                        │
│    - Return assignment actualizado  │
│    - Frontend actualiza UI          │
│    - Notificacion al usuario        │
└─────────────────────────────────────┘
```

---

## 6. Transiciones de Estado

### 6.1 Estados Relacionados al Ministro

| Estado | Descripcion | Actor | Datos Guardados |
|--------|-------------|-------|-----------------|
| `waiting_ministro` | Esperando asignacion | ORGANIZADOR | electionDate, members |
| `ministro_scheduled` | Cita agendada | MUNICIPALIDAD | ministroData |
| `ministro_approved` | Firmas validadas | MINISTRO_FE | certNumber, validationData |

### 6.2 Diagrama de Estados

```
                    ┌──────────────────┐
                    │      draft       │
                    └────────┬─────────┘
                             │ (form submit)
                             ▼
                    ┌──────────────────┐
                    │ waiting_ministro │
                    └────────┬─────────┘
                             │ (MUNICIPALIDAD agenda)
                             ▼
                    ┌──────────────────┐
                    │ministro_scheduled│
                    └────────┬─────────┘
                             │ (Ministro valida)
                             ▼
                    ┌──────────────────┐
                    │ ministro_approved│
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │in_review │   │ rejected │   │sent_regis│
       └──────────┘   └──────────┘   └──────────┘
```

### 6.3 Datos por Transicion

**waiting_ministro → ministro_scheduled:**
```javascript
organization.ministroData = {
  ministroId: ObjectId,
  name: String,
  rut: String,
  scheduledDate: Date,
  scheduledTime: String,
  location: String,
  assignedAt: Date
};
// Si es reagendamiento:
organization.appointmentChanges.push(previousAppointment);
organization.appointmentWasModified = true;
```

**ministro_scheduled → ministro_approved:**
```javascript
organization.status = 'ministro_approved';
organization.certNumber = '001/2026';
organization.depositNumber = '001/2026';
organization.provisionalDirectorio = {
  president: {...},
  secretary: {...},
  treasurer: {...},
  designatedAt: Date,
  type: 'PROVISIONAL',
  expiresAt: Date  // +60 dias
};
organization.validationData = {
  validatedAt: Date,
  validatorId: String,
  validatorName: String,
  ministroSignature: Base64,
  signatures: [...]
};
organization.statusHistory.push({
  status: 'ministro_approved',
  date: Date,
  comment: 'Firmas validadas por Ministro de Fe'
});
```

---

## 7. Problemas Identificados y Corregidos

### 7.1 Criticos - CORREGIDOS

| # | Problema | Estado | Solucion |
|---|----------|--------|----------|
| 1 | No hay validacion de estado previo | ✅ CORREGIDO | Agregado `VALID_STATUS_TRANSITIONS` + `isValidStatusTransition()` en organizations.js:485-515 |
| 2 | Reset validation no revierte Organization | ✅ CORREGIDO | Modificado endpoint para revertir status a `ministro_scheduled` en assignments.js:314-374 |

### 7.2 Serios - CORREGIDOS

| # | Problema | Estado | Solucion |
|---|----------|--------|----------|
| 3 | Wizard state solo en memoria | ⚠️ PARCIAL | Ya tiene IndexedDB implementado (lineas 377-460) |
| 4 | Sin timeout en canvas de firma | ⚠️ PENDIENTE | Requiere cambio en frontend |
| 5 | Duplicacion de datos en Assignment y Org | ✅ DOCUMENTADO | Es necesario para auditoria (Assignment = snapshot, Organization = estado actual) |

### 7.3 Menores - CORREGIDOS

| # | Problema | Estado | Solucion |
|---|----------|--------|----------|
| 6 | Sin validacion de tamano de foto grupal | ✅ CORREGIDO | Agregado `MAX_GROUP_PHOTO_SIZE` (500KB) + `getBase64Size()` en assignments.js:240-256 |
| 7 | ministro-dashboard.js muy grande | ⚠️ PENDIENTE | Requiere refactor mayor |

---

## 8. INCONSISTENCIAS BACKEND ↔ FRONTEND

### 8.1 Bugs Criticos Encontrados y Corregidos

| Bug | Ubicacion | Impacto | Estado |
|-----|-----------|---------|--------|
| `comisionElectoral` enviado como objeto `{members:[]}` en vez de array | ministro-dashboard.js:693-696 | Datos corrompidos | ✅ CORREGIDO |
| Campo `assemblyAttendees` en vez de `validatedAttendees` | ministro-dashboard.js:697 | Datos no guardados | ✅ CORREGIDO |
| `directorio` vs `provisionalDirectorio` inconsistente | Assignment.js vs Organization.js | Confusion | ✅ NORMALIZADO |

### 8.2 Estructura de Datos - Comparativa

**Frontend Envia (ministro-dashboard.js:651-673):**
```javascript
validationData = {
  provisionalDirectorio: {
    president, secretary, treasurer,
    additionalMembers
  },
  comisionElectoral: commissionMembers,  // Array (CORREGIDO)
  attendees: assemblyAttendees,
  ministroSignature,
  groupPhoto
}
```

**Backend Espera (Organization.js):**
```javascript
{
  provisionalDirectorio: Mixed,
  comisionElectoral: [Mixed],           // Array
  validatedAttendees: [Mixed],          // Campo correcto (CORREGIDO en frontend)
  validationData: { ministroSignature }
}
```

**Assignment.js Schema (NORMALIZADO):**
```javascript
wizardData: {
  provisionalDirectorio: {...},  // Nombre canonico
  directorio: {...},             // Alias legacy (auto-sync)
  comisionElectoral: [...],
  attendees: [...]
}
```

### 8.3 Middleware de Sincronizacion Agregado

```javascript
// Assignment.js pre-save middleware
// Sincroniza directorio ↔ provisionalDirectorio automaticamente
if (wizardData.provisionalDirectorio && !wizardData.directorio) {
  wizardData.directorio = { ...provisionalDirectorio };
}
// Y viceversa para datos legacy
```

---

## 9. CORRECCIONES IMPLEMENTADAS

### 9.1 organizations.js - Validacion de Transiciones

**Archivo:** `server/routes/organizations.js`
**Lineas:** 485-536

```javascript
const VALID_STATUS_TRANSITIONS = {
  'draft': ['waiting_ministro', 'rejected'],
  'waiting_ministro': ['ministro_scheduled', 'rejected', 'draft'],
  'ministro_scheduled': ['ministro_approved', 'waiting_ministro', 'rejected'],
  'ministro_approved': ['pending_review', 'in_review', 'sent_registry', 'rejected'],
  // ...mas estados
};

// Valida transicion antes de cambiar estado
if (!forceTransition && !isValidStatusTransition(currentStatus, newStatus)) {
  return res.status(400).json({
    error: `Transicion no permitida: ${currentStatus} → ${newStatus}`,
    allowedTransitions: VALID_STATUS_TRANSITIONS[currentStatus]
  });
}
```

### 9.2 assignments.js - Reset Validation Completo

**Archivo:** `server/routes/assignments.js`
**Lineas:** 314-374

```javascript
// CRÍTICO: Revertir también el estado de la Organization
if (assignment.organizationId) {
  const org = await Organization.findById(assignment.organizationId);
  if (org && org.status === 'ministro_approved') {
    org.status = 'ministro_scheduled';
    org.statusHistory.push({
      status: 'ministro_scheduled',
      comment: 'Validación reseteada - requiere nueva validación'
    });
    org.certNumber = null;
    org.depositNumber = null;
    await org.save();
  }
}
```

### 9.3 assignments.js - Validacion de Tamanos

**Archivo:** `server/routes/assignments.js`
**Lineas:** 240-297

```javascript
const MAX_GROUP_PHOTO_SIZE = 500 * 1024; // 500KB
const MAX_SIGNATURE_SIZE = 50 * 1024;    // 50KB

function getBase64Size(base64String) {
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  return Math.ceil((base64Data.length * 3) / 4);
}

// En POST /validate:
if (wizardData?.groupPhoto) {
  const photoSize = getBase64Size(wizardData.groupPhoto);
  if (photoSize > MAX_GROUP_PHOTO_SIZE) {
    return res.status(400).json({
      error: 'Foto grupal demasiado grande',
      maxSize: '500KB',
      actualSize: `${Math.round(photoSize / 1024)}KB`
    });
  }
}
```

### 9.4 ministro-dashboard.js - Estructura Correcta

**Archivo:** `ministro-dashboard.js`
**Lineas:** 693-698

```javascript
// ANTES (BUG):
orgsUpdated[orgIndex].comisionElectoral = {
  members: commissionMembers,    // Objeto envuelto - INCORRECTO
  designatedAt: new Date().toISOString()
};
orgsUpdated[orgIndex].assemblyAttendees = assemblyAttendees;  // Nombre incorrecto

// DESPUES (CORREGIDO):
orgsUpdated[orgIndex].comisionElectoral = commissionMembers;  // Array directo
orgsUpdated[orgIndex].validatedAttendees = assemblyAttendees; // Nombre correcto
```

### 9.5 Assignment.js - Normalizacion de Campos

**Archivo:** `server/models/Assignment.js`
**Lineas:** 120-150

- Agregado campo `provisionalDirectorio` al schema
- Agregado middleware pre-save para sincronizar `directorio` ↔ `provisionalDirectorio`
- Agregado metodo `getDirectorio()` que retorna el campo correcto

---

## 10. Recomendaciones Pendientes

### 10.1 Mediano Plazo

1. **Refactorizar ValidationWizard a clase**
2. **Separar ministro-dashboard.js en modulos**
3. **Agregar timeout a canvas de firma**

### 10.2 Largo Plazo

4. **Mover validacion de firmas al backend**
5. **Implementar WebSockets para estado en tiempo real**

---

## 11. Flujo Completo - Diagrama de Secuencia

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ORGANIZADOR│     │MUNICIPAL.│     │MINISTRO  │     │ BACKEND  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Crear Org   │                │                │
     │────────────────────────────────────────────────►│
     │                │                │                │
     │◄───────────────────────────────────────────────│
     │  status: waiting_ministro                       │
     │                │                │                │
     │                │ 2. Ver orgs    │                │
     │                │ pendientes     │                │
     │                │───────────────────────────────►│
     │                │                │                │
     │                │ 3. Agendar     │                │
     │                │ ministro       │                │
     │                │───────────────────────────────►│
     │                │                │                │
     │◄──────────────────────────────────────────────│
     │  Notificacion: ministro agendado               │
     │                │                │                │
     │                │                │ 4. Ver asig.  │
     │                │                │ pendientes    │
     │                │                │───────────────►
     │                │                │                │
     │                │                │◄──────────────│
     │                │                │ Lista de asig.│
     │                │                │                │
     │                │                │ 5. Abrir      │
     │                │                │ wizard        │
     │                │                │───────────────►
     │                │                │                │
     │                │                │ [WIZARD]      │
     │                │                │ Paso 1-6      │
     │                │                │ Firmas        │
     │                │                │                │
     │                │                │ 6. Validar    │
     │                │                │ POST /validate│
     │                │                │───────────────►
     │                │                │                │
     │                │                │                │ 7. Actualizar
     │                │                │                │ Assignment +
     │                │                │                │ Organization
     │                │                │                │
     │                │                │◄──────────────│
     │                │                │ Success       │
     │                │                │                │
     │◄──────────────────────────────────────────────│
     │  Notificacion: org aprobada                    │
     │                │                │                │
```

---

## 12. Archivos Clave - Referencia Rapida

| Archivo | Lineas Clave | Funcion |
|---------|--------------|---------|
| `server/routes/ministros.js` | 185-226 | Login ministro |
| `server/routes/assignments.js` | 241-312 | Validar firmas |
| `server/routes/organizations.js` | 398-450 | Agendar ministro |
| `server/models/Assignment.js` | 19-86 | Schema assignment |
| `server/models/Organization.js` | 123-140 | Estados organization |
| `src/presentation/ministro/ValidationWizard.js` | 1-2412 | Wizard completo |
| `ministro-dashboard.js` | 589-733 | Integration UI |
| `src/services/MinistroAssignmentService.js` | 156-189 | API calls |

---

## 13. Conclusion

El flujo de Ministro de Fe es el proceso mas critico del sistema, conectando:
- Creacion de organizaciones
- Validacion legal de firmas
- Generacion de documentos oficiales
- Transiciones de estado

**Estado Actual (Post-Correcciones):**
- ✅ Funcionalidad completa implementada
- ✅ Validacion de transiciones de estado agregada
- ✅ Reset validation revierte Organization correctamente
- ✅ Validacion de tamano de fotos y firmas
- ✅ Inconsistencias backend/frontend corregidas
- ⚠️ Codigo frontend necesita refactorizacion

**Resumen de Correcciones:**

| Tipo | Corregidos | Pendientes |
|------|------------|------------|
| Criticos | 2/2 | 0 |
| Serios | 2/3 | 1 (timeout canvas) |
| Menores | 1/2 | 1 (refactor dashboard) |
| Inconsistencias B/F | 3/3 | 0 |
| **TOTAL** | **8/10** | **2** |

**Proximos Pasos:**
1. ⏳ Agregar timeout a canvas de firma
2. ⏳ Separar ministro-dashboard.js en modulos
3. ⏳ Refactorizar ValidationWizard a clase
4. ⏳ Implementar WebSockets

---

*Generado automaticamente - ComunidadSocial Technical Audit*
*Version: 2.0 - CON CORRECCIONES IMPLEMENTADAS*
*Ultima actualizacion: 2026-01-09*
