# FASE 21: Correccion de Ciberseguridad y Expansion de Soporte Tecnico

> **Archivo de seguimiento** — Claude debe leer esto al inicio de cada sesion relacionada.
> Ultima actualizacion: 2026-03-16

---

## Objetivo

Corregir el gap de notificaciones en el modulo de Ciberseguridad (SecurityIncident) y crear un canal de soporte tecnico real para usuarios del dia a dia.

---

## Tarea 2: Parche al Modulo de Ciberseguridad (Backend)

### Estado: COMPLETADO

**Problema:** Cuando se creaba un incidente de seguridad, no se enviaba ningun correo. Gap de compliance con Ley 21.719 (72h para notificar).

**Solucion implementada:**

| Archivo | Cambio |
|---|---|
| `server/routes/securityIncidents.js` | Importa `emailService`. Envia alerta por email al crear incidente con severidad `high`/`critical`. Tambien envia alerta cuando se escala la severidad a `high`/`critical` en un PUT. |
| `server/services/emailService.js` | Nuevo metodo `sendSecurityIncidentAlert()` con template HTML branded. Incluye advertencia Ley 21.719. |
| `server/middleware/validation.js` | `updateSecurityIncidentSchema` ahora acepta `severity` para permitir escalacion. |

**Destino del correo:** `SUPPORT_EMAIL_DESTINATION` env var (fallback a `TENANT_ADMIN_EMAIL`).

**Logica de disparo:**
- POST `/api/security-incidents` con severity `high` o `critical` → envia email
- PUT `/api/security-incidents/:id` cambiando severity a `high` o `critical` (y era diferente) → envia email
- Severidades `low`/`medium` NO disparan email (solo quedan en DB + AuditLog)

---

## Tarea 3: Expansion del Modulo de Soporte (Frontend & Backend)

### Estado: COMPLETADO

**Problema:** No existia ningun canal de soporte tecnico para usuarios. Solo habia info de contacto en el modal de "Olvide mi contrasena".

**Solucion implementada:**

### Backend

| Archivo | Descripcion |
|---|---|
| `server/models/SupportTicket.js` | Nuevo modelo Mongoose: userId, name, rut, email, role, description, status (open/in_progress/resolved/closed), ipAddress, userAgent. Indices en status, createdAt, userId. |
| `server/routes/support.js` | POST `/api/support/ticket` con `optionalAuth` middleware. Si JWT presente, lee datos del token (name, rut, email, role). Si anonimo, requiere name + email en body. Crea ticket + envia email a soporte. |
| `server/middleware/validation.js` | `createSupportTicketSchema` (Zod): description requerido, name/rut/email opcionales para usuarios autenticados. |
| `server/services/emailService.js` | Nuevo metodo `sendSupportTicketNotification()` con template HTML branded. Incluye datos del usuario, rol, descripcion del problema, y link mailto para responder. |
| `server/index.js` | Monta `supportRoutes` en `/api/support`. |

### Frontend

| Archivo | Descripcion |
|---|---|
| `src/react/components/ui/SupportModal.jsx` | Modal con formulario. Autocompleta nombre, RUT y correo del usuario logueado (campos disabled). Solo pide descripcion del problema. Muestra confirmacion al enviar. |
| `src/react/App.jsx` | `SupportFAB` componente: boton flotante circular azul (icono ?) en esquina inferior derecha. Visible para TODOS los usuarios autenticados (Organizador, Ministro de Fe, Municipalidad, Miembro). Abre SupportModal al hacer click. |
| `src/services/ApiService.js` | Nuevo metodo `createSupportTicket(data)` → POST `/support/ticket`. |

---

## Variables de Entorno Requeridas

| Variable | Proposito | Ejemplo |
|---|---|---|
| `SUPPORT_EMAIL_DESTINATION` | Correo destino de alertas de seguridad y tickets de soporte | `soporte@coryn.cl` |
| `TENANT_ADMIN_EMAIL` | Fallback si SUPPORT_EMAIL_DESTINATION no esta configurado | `admin@renca.cl` |

---

## Flujo del Usuario (Soporte)

1. Usuario logueado ve boton flotante "?" en esquina inferior derecha
2. Click → se abre SupportModal
3. Nombre, RUT y correo aparecen autocompletados (readonly)
4. Usuario escribe descripcion del problema
5. Click "Enviar Ticket de Soporte"
6. Backend crea registro en SupportTicket
7. Backend envia email a SUPPORT_EMAIL_DESTINATION con todos los datos
8. Usuario ve confirmacion de envio exitoso

## Flujo de Ciberseguridad (Email)

1. Admin (MUNICIPALIDAD) reporta incidente de seguridad
2. Si severidad es `high` o `critical`:
   - Se crea en DB + AuditLog (como antes)
   - NUEVO: Se envia email de alerta a SUPPORT_EMAIL_DESTINATION
3. Si severidad es `low` o `medium`: solo DB + AuditLog (sin email)
4. Si se actualiza la severidad de un incidente existente a `high`/`critical`: se envia email

---

## Pendientes Futuros (no en esta fase)

- [ ] Panel admin para gestionar tickets de soporte (CRUD, cambio de estado, responder)
- [ ] Historial de tickets para el usuario que los creo
- [ ] Webhook a Slack/Discord cuando se crea un ticket
- [ ] Rate limiting especifico para POST /api/support/ticket
- [ ] Email de confirmacion al usuario que crea el ticket
