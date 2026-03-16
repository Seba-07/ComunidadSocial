# FASE 24: Flujo de Renuncias y Sucesion de Directorio

> Ultima actualizacion: 2026-03-16

---

## Tarea 1: Plan de Trabajo

### Estado: COMPLETADO

---

## Tarea 2: Backend - Endpoint de Renuncia

### Estado: COMPLETADO

**Endpoint:** `POST /api/organizations/:id/directorio/renuncia`

**Proteccion:** `authenticate + requireRole('MUNICIPALIDAD')` (solo admin municipal)

**Payload:**
```json
{
  "rutOut": "12.345.678-9",
  "reason": "RENUNCIA | FALLECIMIENTO | EXCLUSION",
  "exitDate": "2026-03-16",
  "documentUrl": "https://...",
  "rutIn": "98.765.432-1"
}
```

**Logica:**
1. Busca a `rutOut` en `provisionalDirectorio` (fixed fields + additionalMembers)
2. Guarda registro historico en nuevo array `directorioHistorico[]`
3. Si `rutIn` viene y es un suplente en `additionalMembers`, lo promueve al cargo vacante
4. Remueve a `rutOut` del directorio activo (set null o filter)
5. Sincroniza roles de miembros con `syncMemberRolesFromDirectorio()`
6. Registra en AuditLog

**Nuevo campo en Organization model:**
```javascript
directorioHistorico: [{
  rut: String,
  firstName: String,
  lastName: String,
  cargo: String,
  cargoKey: String,
  reason: String,          // RENUNCIA, FALLECIMIENTO, EXCLUSION
  exitDate: Date,
  documentUrl: String,
  replacedBy: { rut: String, firstName: String, lastName: String },
  registeredAt: Date,
  registeredBy: { userId: ObjectId, name: String }
}]
```

---

## Tarea 3: Frontend - UI en OrgDirectorio

### Estado: COMPLETADO

| Archivo | Cambio |
|---|---|
| `OrgDirectorio.jsx` | Boton "Registrar Salida" en cada DirectorCard (solo visible para MUNICIPALIDAD/owner) |
| `OrgDirectorio.jsx` | Recibe props `onRefresh` y pasa datos del miembro seleccionado al modal |

---

## Tarea 4: Frontend - ResignationModal

### Estado: COMPLETADO

| Archivo | Cambio |
|---|---|
| `OrgDirectorio.jsx` | Nuevo componente ResignationModal inline |
| Campos | Motivo (select), Fecha salida, URL documento, Sucesor (select suplentes + "Vacante") |
| API | `apiService.registerDirectorioResignation(orgId, data)` |

---

## Archivos Modificados

- `server/models/Organization.js` — +1 campo `directorioHistorico`
- `server/routes/organizations.js` — +1 endpoint POST renuncia
- `server/middleware/validation.js` — +1 schema Zod
- `server/middleware/security.js` — +1 allowed field
- `src/react/pages/OrganizationDashboard/OrgDirectorio.jsx` — UI + modal
- `src/react/pages/OrganizationDashboard/OrgDashboardPage.jsx` — onRefresh prop
- `src/services/ApiService.js` — +1 metodo
