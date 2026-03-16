# FASE 25: Filtrado de Interfaz por Roles y Motor de Notificaciones

> Ultima actualizacion: 2026-03-16

---

## Tarea 1: Plan de Trabajo

### Estado: COMPLETADO

---

## Tarea 2: Frontend - Filtrado Inteligente de Pestañas (RBAC UI)

### Estado: COMPLETADO

**Archivo:** `OrgDashboardPage.jsx`

**Logica:** Se calcula `userOrgRole` basado en:
- `user.role === 'MUNICIPALIDAD'` → admin (ve todo)
- `org.userId === user._id` → owner/organizador (ve todo)
- `isDirectivoMember()` check en frontend → directivo (tabs operativos)
- Cualquier otro → socio (solo lectura basica)

**Reglas de tabs:**
| Rol | Tabs visibles |
|---|---|
| MUNICIPALIDAD / Owner | Todos (10 tabs) |
| Directivo | Resumen, Socios, Directorio, Asambleas, Comunicaciones, Finanzas |
| Socio | Resumen, Directorio, Comunicaciones (solo lectura) |

---

## Tarea 3: Backend - Motor de Emails para Comunicaciones

### Estado: COMPLETADO

**Cambios:**
- `emailService.js`: Nuevo metodo `sendCommunicationToMembers()` con soporte BCC
- `emailService.js`: `sendEmail()` ahora acepta parametro `bcc` opcional
- `organizations.js`: Al hacer `addCommunication`, si tipo es `asamblea` o `urgente`, se envian emails automaticamente. Para otros tipos se envian tambien pero sin prioridad
- Nuevo campo `emailsSentCount` en la comunicacion guardada

---

## Tarea 4: Frontend - Feedback de Envio

### Estado: COMPLETADO

**Cambio:** `OrgComunicaciones.jsx` muestra toast con cantidad de emails enviados tras crear comunicacion.

---

## Archivos Modificados

- `src/react/pages/OrganizationDashboard/OrgDashboardPage.jsx` — filtrado tabs por rol
- `server/services/emailService.js` — sendCommunicationToMembers + BCC en sendEmail
- `server/routes/organizations.js` — envio de emails al crear comunicacion
- `src/react/pages/OrganizationDashboard/OrgComunicaciones.jsx` — feedback de envio
