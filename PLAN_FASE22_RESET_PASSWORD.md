# FASE 22: Implementacion de Recuperacion de Contraseña (Forgot/Reset)

> **Archivo de seguimiento** — Claude debe leer esto al inicio de cada sesion relacionada.
> Ultima actualizacion: 2026-03-16

---

## Objetivo

Implementar el flujo completo de recuperacion de contraseña (forgot/reset) para todos los usuarios, y corregir el bug del reset de Ministros de Fe.

---

## Tarea 2: Backend - Modelo y Servicios

### Estado: COMPLETADO

| Archivo | Cambio |
|---|---|
| `server/models/User.js` | Agregados campos `resetPasswordToken` (String) y `resetPasswordExpires` (Date) |
| `server/services/emailService.js` | Nuevo metodo `sendPasswordResetEmail({ email, userName, resetUrl })` con template HTML branded y boton CTA. Expiracion de 1 hora indicada en el correo. |
| `server/services/emailService.js` | Nuevo metodo `sendPasswordResetNotification({ email, userName, tempPassword })` para Ministros — corrige el bug de metodo inexistente. |

**URL del enlace:** Se construye dinamicamente con `process.env.FRONTEND_URL` via helper `getFrontendUrl()` (fallback a `localhost:5173`). Funciona en Vercel y localhost.

---

## Tarea 3: Backend - Endpoints de Auth

### Estado: COMPLETADO

| Endpoint | Metodo | Descripcion |
|---|---|---|
| `POST /api/auth/forgot-password` | sensitiveLimiter (3/hora) | Recibe email, genera token `crypto.randomBytes(32)`, guarda en User, envia correo. Siempre retorna mismo mensaje (anti-enumeracion). |
| `POST /api/auth/reset-password` | sensitiveLimiter (3/hora) | Recibe token + newPassword. Valida fortaleza (8+ chars, mayuscula, minuscula, numero). Verifica token no expirado. Hashea password (bcrypt via pre-save), limpia token, incrementa tokenVersion (invalida sesiones). |

**Seguridad implementada:**
- Token: `crypto.randomBytes(32).toString('hex')` — 64 chars hex
- Expiracion: 1 hora (`Date.now() + 60 * 60 * 1000`)
- Rate limiting: 3 intentos por hora por IP (sensitiveLimiter)
- Anti-enumeracion: respuesta identica si el email existe o no
- Password hashing: bcrypt con salt 12 rounds (via pre-save hook)
- Invalidacion de sesiones: `tokenVersion++` al resetear
- Token de un solo uso: se borra de la DB al usar

---

## Tarea 4: Backend - Bug Ministros

### Estado: COMPLETADO

**Problema:** `server/routes/ministros.js:188` llamaba a `emailService.sendPasswordResetNotification()` que no existia — crasheaba en runtime.

**Solucion:** Creado metodo `sendPasswordResetNotification({ email, userName, tempPassword })` en emailService.js con template HTML que muestra la contraseña temporal y avisa que debe cambiarla al primer login.

---

## Tarea 5: Frontend - Vistas y Conexion

### Estado: COMPLETADO

| Archivo | Cambio |
|---|---|
| `src/react/pages/Auth/ForgotPasswordModal.jsx` | Reescrito: ahora tiene input de email, boton "Enviar enlace de recuperacion", estados de envio/error/exito, y mensaje de confirmacion con instrucciones. |
| `src/react/pages/Auth/ResetPasswordPage.jsx` | Nueva pagina: captura token de URL, formulario con nueva contraseña + confirmacion, indicadores de fortaleza en tiempo real, manejo de errores (token expirado, invalido). |
| `src/react/App.jsx` | Nueva ruta `/reset-password/:token` con lazy loading. |
| `src/services/ApiService.js` | Nuevos metodos `forgotPassword(email)` y `resetPassword(token, newPassword)`. |

**Manejo de errores en frontend:**
- Token expirado/invalido: mensaje claro con instruccion de solicitar nuevo enlace
- Contraseña debil: validacion en tiempo real con checklist visual
- Contraseñas no coinciden: feedback inline
- Error de red: mensaje generico
- Rate limit: mensaje del backend

---

## Flujo Completo

### Forgot Password
1. Usuario en login click "¿Olvidaste tu contraseña?"
2. Modal pide email
3. Backend genera token, guarda en User, envia correo
4. Usuario ve "Revisa tu correo" (sin revelar si el email existe)

### Reset Password
1. Usuario click enlace en email → `/app/reset-password/{token}`
2. ResetPasswordPage muestra formulario con nueva contraseña + confirmacion
3. Indicadores de fortaleza en tiempo real
4. Backend valida token (no expirado), hashea password, limpia token
5. Invalida todas las sesiones existentes (tokenVersion++)
6. Usuario ve "Contraseña actualizada" y boton "Iniciar sesion"

---

## Variables de Entorno

| Variable | Uso | Ejemplo |
|---|---|---|
| `FRONTEND_URL` | Base URL para construir enlaces en emails | `https://cs-renca.vercel.app/app` |

**Nota:** Si `FRONTEND_URL` no esta configurado, se usa `http://localhost:5173` como fallback (desarrollo).

---

## Archivos Modificados

### Backend
- `server/models/User.js` — +2 campos
- `server/services/emailService.js` — +2 metodos
- `server/routes/auth.js` — +2 endpoints

### Frontend
- `src/react/pages/Auth/ForgotPasswordModal.jsx` — reescrito
- `src/react/pages/Auth/ResetPasswordPage.jsx` — nuevo
- `src/react/App.jsx` — +1 ruta
- `src/services/ApiService.js` — +2 metodos
