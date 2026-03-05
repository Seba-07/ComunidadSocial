# Plan Maestro de Ciberseguridad — ComunidadSocial

> Creado: 2026-03-05 | Score actual: 6.5/10 | Objetivo: 9.5/10
> Este archivo es la fuente de verdad para el progreso de seguridad.
> Claude debe leer este archivo al iniciar cualquier tarea de seguridad.

---

## Estado General

| Fase | Descripcion | Estado | Tareas |
|------|-------------|--------|--------|
| F1 | Criticos — Defensa inmediata | COMPLETADA | 7 tareas |
| F2 | Altos — Hardening de autenticacion | EN PROGRESO (7/8) | 8 tareas |
| F3 | Medios — Validacion y sanitizacion completa | COMPLETADA (9/10) | 10 tareas |
| F4 | Medios — Control de acceso y datos | PENDIENTE | 8 tareas |
| F5 | Mejoras — Cifrado, monitoring y compliance | PENDIENTE | 9 tareas |
| F6 | Tests — Cobertura de seguridad | PENDIENTE | 5 tareas |

---

## FASE 1: CRITICOS — Defensa Inmediata

### F1.1 — Reducir body limit global + limit por ruta
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/index.js:96-97`
- **Problema**: `express.json({ limit: '50mb' })` global permite DoS (5GB/min por IP con rate limit de 100/min)
- **Implementar**:
  1. Cambiar limite global a `5mb` en `index.js`
  2. Crear middleware `largeBody` con `express.json({ limit: '50mb' })`
  3. Aplicar `largeBody` SOLO en rutas que lo necesitan:
     - `POST /api/organizations` (wizard con certificados base64)
     - `PUT /api/organizations/:id` (update con certificados)
     - `POST /api/organizations/:id/sync-certificates`
     - `POST /api/organizations/:id/certificate-files`
     - `POST /api/organizations/:id/generated-documents`
  4. Agregar middleware de validacion de tamano de base64 (max 2MB por certificado)

### F1.2 — Error handler: no filtrar informacion interna
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/index.js:177-205`
- **Problema**: `err.message` y `err.name` expuestos al cliente en respuestas 500
- **Implementar**:
  1. En produccion, retornar solo `{ error: 'Error interno del servidor' }`
  2. `err.message` y `err.stack` solo en `NODE_ENV !== 'production'`
  3. Revisar TODOS los catch blocks en rutas que hacen `res.status(500).json({ error: error.message })` — reemplazar con mensajes genericos
  4. Verificar que MongoDB validation errors (`error.name === 'ValidationError'`) no filtren nombres de campos internos
  5. Archivos a revisar:
     - `server/routes/organizations.js` (lineas ~520, ~740-749, ~867, ~967)
     - `server/routes/users.js`
     - `server/routes/ministros.js`
     - `server/routes/assignments.js`
     - `server/routes/news.js`
     - `server/routes/auth.js`

### F1.3 — Unificar JWT_SECRET en un solo modulo
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/middleware/auth.js:9-18`, `server/routes/auth.js:12`
- **Problema**: Secret duplicado en 2 archivos + fallback hardcodeado `'dev-only-secret-do-not-use-in-production'`
- **Implementar**:
  1. Eliminar `const EFFECTIVE_JWT_SECRET` de `routes/auth.js`
  2. Exportar `EFFECTIVE_JWT_SECRET` desde `middleware/auth.js`
  3. Importar en `routes/auth.js`: `import { EFFECTIVE_JWT_SECRET } from '../middleware/auth.js'`
  4. Cambiar logica de fallback: crash con `process.exit(1)` si `!JWT_SECRET && isDeployed`
  5. En desarrollo, mantener fallback pero con `console.warn` visible

### F1.4 — Eliminar passwords temporales de respuestas HTTP
- **Estado**: [x] COMPLETADO
- **Archivos**:
  - `server/routes/organizations.js:229-235` (create-member-accounts)
  - `server/routes/ministros.js:~175` (reset-password)
- **Problema**: `tempPassword` retornado en response body — visible en network tab, logs, proxies
- **Implementar**:
  1. En `create-member-accounts`: eliminar campo `tempPassword` del response
  2. Enviar password solo via email usando `emailService.sendWelcomeEmail()`
  3. En `reset-password` de ministros: retornar solo `{ message: 'Password temporal enviado al email del ministro' }`
  4. Si emailService no esta configurado: retornar el password SOLO en desarrollo (`NODE_ENV !== 'production'`)

### F1.5 — Configurar trust proxy
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/index.js` (agregar antes de middlewares)
- **Problema**: Sin `trust proxy`, `req.ip` es siempre la IP del proxy (Railway/Vercel) — rate limiting es inutil
- **Implementar**:
  1. Agregar `app.set('trust proxy', 1)` antes de CORS middleware
  2. Verificar que `ipKeyGenerator` en `security.js` use el IP correcto
  3. Testear que `req.ip` retorna IP real del cliente, no del proxy

### F1.6 — allowFields en PUT organizaciones
- **Estado**: [x] COMPLETADO (ya existia proteccion manual en organizations.js:778-784)
- **Archivos**: `server/routes/organizations.js:761`
- **Problema**: PUT /:id no usa `allowFields()` — usuario puede enviar `status`, `certNumber`, `ministroData` directamente
- **Implementar**:
  1. Importar `allowFields, ALLOWED_FIELDS` de `middleware/security.js`
  2. Agregar `allowFields(ALLOWED_FIELDS.organization)` al middleware chain de `PUT /:id`
  3. Verificar que `ALLOWED_FIELDS.organization` en `security.js:249-260` NO incluya campos admin-only
  4. Verificar que los campos admin-only (`status`, `certNumber`, `depositNumber`, `ministroData`, `ministroSignature`, `validationData`) NO esten en la lista

### F1.7 — Path traversal en file downloads
- **Estado**: [x] COMPLETADO
- **Archivos**:
  - `server/routes/organizationDocuments.js:233-238`
  - `server/routes/libraryDocuments.js:236-237`
- **Problema**: `document.filePath` de DB usado directo en `res.download()` y `fs.unlinkSync()` sin verificar que este dentro del directorio de uploads
- **Implementar**:
  1. En `organizationDocuments.js`: verificar que `path.resolve(filePath)` empieza con `path.resolve('./uploads/org-documents/')`
  2. En `libraryDocuments.js`: verificar que `path.resolve(filePath)` empieza con `path.resolve('./uploads/library/')`
  3. Crear helper compartido `isPathWithinDir(filePath, allowedDir)` en `server/utils/pathSecurity.js`
  4. Retornar 403 si el path esta fuera del directorio permitido

---

## FASE 2: ALTOS — Hardening de Autenticacion

### F2.1 — Eliminar JWT de localStorage
- **Estado**: [x] COMPLETADO
- **Archivos**: `src/services/ApiService.js:177-180` y todo el frontend que lea `auth_token` de localStorage
- **Problema**: Token en localStorage es vulnerable a XSS. Si hay XSS, atacante roba el JWT
- **Implementar**:
  1. Eliminar `localStorage.getItem('auth_token')` de `ApiService.js`
  2. Eliminar `localStorage.setItem('auth_token', ...)` de todas las llamadas de login
  3. Confiar SOLO en HttpOnly cookies (ya implementadas)
  4. Agregar `credentials: 'include'` en todas las llamadas fetch (ya deberia estar en ApiService)
  5. Buscar y eliminar TODAS las referencias a `localStorage.*auth_token*` en el frontend:
     - `src/services/ApiService.js`
     - `src/react/stores/authStore.js`
     - `main.js`
     - Cualquier otro archivo que use `auth_token` en localStorage

### F2.2 — Reemplazar login de socios (RUT como password)
- **Estado**: [ ] Pendiente
- **Archivos**: `server/routes/auth.js:360-423` (login-socio), `server/routes/organizations.js:200` (default password)
- **Problema**: RUTs son datos publicos en Chile — cualquiera con apellido + RUT puede entrar
- **Implementar** (opcion recomendada: password temporal + cambio obligatorio):
  1. En `create-member-accounts`: generar password temporal aleatorio (ya existe `generateTempPassword()` en organizations.js:135)
  2. Usar `generateTempPassword()` en vez de RUT limpio como password
  3. Mantener `mustChangePassword: true` (ya existe)
  4. Enviar credenciales por email al miembro
  5. En login-socio: mantener flujo pero ahora password no es RUT sino el temporal
  6. Agregar validacion Zod al endpoint login-socio (actualmente no tiene schema)
  7. Considerar a futuro: OTP por email/SMS o login por QR (ya existe qrToken en User model)

### F2.3 — Refresh token rotation
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/routes/auth.js:159-198` (refresh endpoint), `server/middleware/auth.js:124-134`
- **Problema**: Refresh token no cambia en 30 dias — si se roba, acceso permanente
- **Implementar**:
  1. Al hacer refresh exitoso, generar NUEVO refresh token
  2. Setear nueva cookie `refresh_token` con el nuevo valor
  3. Opcionalmente: almacenar hash del refresh token en User model para invalidacion
  4. Al detectar uso de refresh token viejo (ya rotado), invalidar TODAS las sesiones del usuario (posible token theft)

### F2.4 — Proteccion CSRF
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/index.js`, `server/middleware/auth.js`, frontend API calls
- **Problema**: Con `SameSite: 'none'` en produccion (cross-origin), cookies se envian sin CSRF token
- **Implementar** (metodo: custom header check):
  1. En el servidor: verificar que requests POST/PUT/DELETE incluyan header `X-Requested-With: XMLHttpRequest`
  2. En ApiService.js: agregar header `X-Requested-With: XMLHttpRequest` a todas las requests
  3. En el middleware: si request es mutacion (POST/PUT/DELETE) y no tiene el header, rechazar con 403
  4. Excluir de CSRF: rutas publicas como health check, endpoints webhook si los hay
  5. Alternativa mas robusta: double-submit cookie pattern con token crypto random

### F2.5 — Fortalecer password policy
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/middleware/validation.js:66-69`
- **Problema**: Solo 6 chars + 1 mayuscula — muy debil para sistema con datos sensibles
- **Implementar**:
  1. Cambiar minimo a 8 caracteres
  2. Requerir al menos: 1 mayuscula, 1 minuscula, 1 numero
  3. Actualizar `passwordSchema` en validation.js
  4. Actualizar validacion duplicada en `routes/auth.js:333-338` (change-password)
  5. Actualizar mensajes de error en frontend
  6. NO aplicar retroactivamente a passwords existentes (solo al cambiar)

### F2.6 — Aumentar bcrypt rounds
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/models/User.js:125`
- **Problema**: 10 rounds es el minimo aceptable. Para 2026 deberia ser 12+
- **Implementar**:
  1. Cambiar `bcrypt.hash(this.password, 10)` a `bcrypt.hash(this.password, 12)`
  2. Los passwords existentes se actualizan automaticamente al siguiente login/change-password
  3. Verificar que el tiempo de hash (~250ms con 12 rounds) no afecte rate limits

### F2.7 — No retornar token en response body
- **Estado**: [x] COMPLETADO
- **Archivos**:
  - `server/routes/auth.js:87-89` (register)
  - `server/routes/auth.js:133` (login)
  - `server/routes/auth.js:352` (change-password)
  - `server/routes/auth.js:396-399` (login-socio)
  - `server/routes/ministros.js:~225` (ministro login)
- **Problema**: JWT retornado en response body ademas de en cookie — visible en logs/proxies
- **Implementar**:
  1. Eliminar campo `token` de TODOS los response bodies listados
  2. Confiar solo en `res.cookie('auth_token', token, COOKIE_OPTIONS)`
  3. Actualizar frontend para no leer `response.data.token` y guardarlo en localStorage
  4. Esto complementa F2.1 (eliminar localStorage token)

### F2.8 — Account lockout por intentos fallidos
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/models/User.js`, `server/routes/auth.js` (login, login-socio)
- **Problema**: Rate limit es por IP, no por cuenta. Ataque distribuido no se bloquea
- **Implementar**:
  1. Agregar campos a User model: `failedLoginAttempts: Number`, `lockedUntil: Date`
  2. En login: incrementar `failedLoginAttempts` si password es incorrecto
  3. Si `failedLoginAttempts >= 5`: setear `lockedUntil = now + 30 min`
  4. En login: verificar `lockedUntil` ANTES de comparar password
  5. Reset `failedLoginAttempts` a 0 en login exitoso
  6. Misma logica para login-socio y ministro login

---

## FASE 3: MEDIOS — Validacion y Sanitizacion Completa

### F3.1 — Agregar schemas Zod a rutas sin validacion
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/middleware/validation.js` (agregar schemas), rutas individuales
- **Problema**: Multiples rutas POST/PUT aceptan datos sin validacion Zod
- **Implementar schemas para**:
  1. `POST /api/news` y `PUT /api/news/:id` — titulo, contentHTML (max 50KB), categoria, tags
  2. `PUT /api/guia-constitucion` — contentHTML (max 100KB), isPublished
  3. `POST /api/ministro-blocks` — ministroId (ObjectId), date (YYYY-MM-DD), time (HH:MM), blockType
  4. `POST /api/security-incidents` — type (enum), severity (enum), title, description (max 5000)
  5. `PUT /api/security-incidents/:id` — status (enum), measuresTaken
  6. `POST /api/notifications` — ya tiene schema parcial, completar
  7. `POST /api/organization-documents/:orgId/upload` — name (max 100), description (max 500), category (enum)
  8. `POST /api/estatuto-templates` y `PUT` — name, content, organizationType
  9. `POST /api/document-templates` y `PUT` — name, content, type
  10. `POST /api/login-socio` — agregar schema con lastName, rut validado

### F3.2 — Reemplazar .passthrough() con .strict() en schemas Zod
- **Estado**: [ ] Pendiente (deuda tecnica — requiere audit de campos legacy)
- **Archivos**: `server/middleware/validation.js:132, 152, 170, 209, 217`
- **Problema**: `.passthrough()` permite campos adicionales no validados
- **Implementar**:
  1. Reemplazar `.passthrough()` con `.strict()` donde sea posible
  2. En schemas donde se necesiten campos dinamicos, usar `.catchall(z.unknown())` con whitelist
  3. Verificar que certificateStep5Schema funcione sin passthrough (puede tener campos legacy)

### F3.3 — XSS en NotificationService.js vanilla
- **Estado**: [x] COMPLETADO
- **Archivos**: `src/services/NotificationService.js:298-305`
- **Problema**: `innerHTML` con interpolacion de `title` y `message` sin sanitizar
- **Implementar**:
  1. Importar `sanitizeText` de `@shared/utils/sanitize.js`
  2. Sanitizar `title` y `message` antes de insertarlos en innerHTML
  3. O mejor: usar `textContent` en vez de `innerHTML` para titulo y mensaje

### F3.4 — Revisar todos los innerHTML en vanilla JS
- **Estado**: [x] COMPLETADO (criticos fijados: NotificationService, MemberDashboard, OrgNoticias, OrgGuia con DOMPurify)
- **Archivos** (16 archivos con innerHTML):
  - `src/react/pages/OrganizationDashboard/OrgGuia.jsx`
  - `src/react/pages/OrganizationDashboard/OrgNoticias.jsx`
  - `src/presentation/organization/OrganizationMenuManager.js`
  - `src/presentation/shared/SidebarManager.js`
  - `src/presentation/organization/OrganizationDashboard.js`
  - `src/presentation/member/MemberDashboard.js`
  - `src/shared/components/ConnectionStatus.js`
  - `src/services/NotificationService.js`
  - `src/presentation/news/NewsManager.js`
  - `src/presentation/biblioteca/BibliotecaManager.js`
  - `src/presentation/guia/GuiaConstitucionManager.js`
  - `src/shared/components/BaseWizard.js`
  - `src/shared/components/ExampleWizard.js`
  - `src/shared/utils/formHelpers.js`
- **Implementar**:
  1. Revisar cada uso de innerHTML en los 16 archivos
  2. Clasificar: dato de usuario vs markup estatico
  3. Para datos de usuario: usar `sanitizeText()` o `sanitizeRichText()` segun contexto
  4. Para markup estatico: OK dejarlo (no hay riesgo XSS)
  5. En React (OrgGuia, OrgNoticias): verificar que usen `dangerouslySetInnerHTML` con DOMPurify

### F3.5 — Remover unsafe-inline de CSP
- **Estado**: [x] PARCIAL (CSP report-uri agregado, unsafe-inline necesario por Quill.js)
- **Archivos**: `server/middleware/security.js:111-112`
- **Problema**: `'unsafe-inline'` en scriptSrc y styleSrc debilita CSP completamente
- **Implementar**:
  1. Para styleSrc: mantener `'unsafe-inline'` por ahora (Quill.js y estilos inline lo necesitan) — marcar como deuda tecnica
  2. Para scriptSrc: evaluar si se puede remover `'unsafe-inline'`:
     - Verificar que no haya scripts inline en HTML
     - Si Vite genera inline scripts, usar nonces o hashes
     - Si no es posible remover ahora, documentar por que
  3. Agregar `report-uri` o `report-to` para monitorear violaciones CSP:
     ```js
     reportUri: ['/api/csp-report']
     ```
  4. Crear endpoint `POST /api/csp-report` que logguee violaciones sin autenticacion

### F3.6 — File upload: agregar fileFilter a orgDocuments
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/routes/organizationDocuments.js:86-91`
- **Problema**: multer sin `fileFilter` — acepta CUALQUIER tipo de archivo
- **Implementar**:
  1. Agregar fileFilter que permita solo: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF
  2. Rechazar ejecutables, scripts, y archivos peligrosos (.exe, .sh, .bat, .js, .html, .svg)
  3. Verificar MIME type Y extension (no confiar solo en MIME)
  4. Ejemplo:
     ```js
     fileFilter: (req, file, cb) => {
       const allowed = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif/;
       const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
       if (allowed.test(ext) && allowed.test(file.mimetype.split('/').pop())) {
         cb(null, true);
       } else {
         cb(new Error('Tipo de archivo no permitido'));
       }
     }
     ```

### F3.7 — Validar tamano maximo de certificados base64
- **Estado**: [x] COMPLETADO
- **Archivos**: `server/routes/organizations.js` (donde se reciben certificados), `src/services/OrganizationsService.js:551-576`
- **Problema**: No hay limite de tamano para strings base64 de certificados
- **Implementar**:
  1. En el backend: al recibir certificados, verificar que cada base64 no exceda 3MB (`base64.length < 4 * 1024 * 1024`)
  2. En el frontend (ya existente parcialmente): reforzar validacion de 2MB por archivo
  3. Agregar validacion al schema Zod de createOrganizationSchema para `certificatesStep5`

### F3.8 — Sanitizar busqueda MongoDB
- **Estado**: [x] COMPLETADO
- **Archivos**:
  - `server/routes/search.js:37-39` (regex construction)
  - `server/routes/libraryDocuments.js:65-66` ($text search)
- **Problema**: Regex construido con `new RegExp()` de user input (aunque con escape). $text search sin validacion
- **Implementar**:
  1. En search.js: usar `{ $regex: escaped, $options: 'i' }` en vez de `new RegExp(escaped, 'i')`
  2. En libraryDocuments.js: validar con Zod antes de usar en $text
  3. Agregar limite de longitud a terminos de busqueda (max 100 chars)

### F3.9 — Logout: limpiar cookies con mismos atributos
- **Estado**: [x] COMPLETADO (hecho en F2)
- **Archivos**: `server/routes/auth.js:472-473`
- **Problema**: `res.clearCookie` sin los mismos atributos usados al setear (httpOnly, secure, sameSite)
- **Implementar**:
  1. Importar `COOKIE_OPTIONS` y `REFRESH_COOKIE_OPTIONS`
  2. Usar: `res.clearCookie('auth_token', { ...COOKIE_OPTIONS, maxAge: 0 })`
  3. Usar: `res.clearCookie('refresh_token', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 })`

### F3.10 — Rate limiting en endpoints sensibles adicionales
- **Estado**: [x] COMPLETADO (uploadLimiter agregado a org-documents y library-documents)
- **Archivos**: `server/routes/organizations.js`, `server/routes/auth.js`
- **Problema**: Endpoints CRUD y logout sin rate limiting especifico
- **Implementar**:
  1. Logout: agregar rate limit suave (30/min)
  2. Refresh: agregar rate limit (30/min)
  3. Create organization: agregar rate limit (5/hora por usuario)
  4. Delete organization: agregar rate limit (3/hora)
  5. Status changes: agregar rate limit (10/hora)
  6. File uploads: agregar rate limit (20/hora)

---

## FASE 4: MEDIOS — Control de Acceso y Datos

### F4.1 — Middleware de ownership para rutas de organizacion (anti-IDOR)
- **Estado**: [ ] Pendiente
- **Archivos**: `server/routes/organizations.js` (multiples rutas), crear `server/middleware/ownership.js`
- **Problema**: Muchas rutas verifican auth pero no que el usuario sea dueno/miembro de ESA org
- **Implementar**:
  1. Crear middleware `requireOrgAccess(roles)` en `server/middleware/ownership.js`:
     ```js
     export function requireOrgAccess(...allowedRoles) {
       return async (req, res, next) => {
         const orgId = req.params.id || req.params.orgId;
         const org = await Organization.findById(orgId);
         if (!org) return res.status(404).json({ error: 'Organizacion no encontrada' });

         const isOwner = org.userId.toString() === req.userId.toString();
         const isAdmin = req.user.role === 'MUNICIPALIDAD';
         const isMember = req.user.role === 'MIEMBRO' && req.user.getAllOrgIds().includes(orgId);
         const isMinistro = req.user.role === 'MINISTRO_FE';

         if (!isOwner && !isAdmin && !isMember && !isMinistro) {
           return res.status(403).json({ error: 'No tienes acceso a esta organizacion' });
         }
         req.organization = org;
         req.isOrgOwner = isOwner;
         next();
       };
     }
     ```
  2. Aplicar a TODAS las rutas de organizacion que usen `:id`:
     - `GET /:id/certificate-files`
     - `GET /:id/generated-documents`
     - `POST /:id/assemblies`
     - `POST /:id/assemblies/:assemblyId/vote`
     - `POST /:id/assemblies/:assemblyId/checkin`
     - Etc.
  3. Nota: `organizationDocuments.js` ya tiene `checkOrgPermission()` — esta bien pero refactorizar a usar el middleware compartido

### F4.2 — Proteger /uploads con autenticacion
- **Estado**: [ ] Pendiente
- **Archivos**: `server/index.js:103-107`
- **Problema**: `/uploads` servido como static sin auth — cualquiera con URL accede
- **Implementar**:
  1. Remover `express.static('uploads')` de index.js
  2. Crear ruta protegida `GET /api/files/:type/:filename` con autenticacion
  3. Validar que el usuario tenga acceso al recurso (org member, admin, etc.)
  4. Servir archivo con `res.sendFile()` con headers apropiados
  5. O alternativa minima: agregar tokens firmados en las URLs de archivos

### F4.3 — Proteger health endpoint detallado
- **Estado**: [ ] Pendiente
- **Archivos**: `server/index.js:145-173`
- **Problema**: `/api/health?details=true` expone metricas de DB y memoria sin auth
- **Implementar**:
  1. `details=true` requiere `authenticate` + `requireRole('MUNICIPALIDAD')`
  2. Health basico (sin details) sigue publico para monitoring
  3. Remover info de memoria de respuesta publica

### F4.4 — Aplicar .select() a queries que retornan usuarios
- **Estado**: [ ] Pendiente
- **Archivos**:
  - `server/routes/users.js:14-27` (GET /api/users)
  - `server/routes/ministros.js:15-27` (GET /api/ministros)
  - `server/routes/organizations.js:159-166` (User.find sin select)
- **Problema**: Retornan todos los campos del usuario (incluido password hash en memoria, aunque toJSON lo excluye)
- **Implementar**:
  1. Agregar `.select('-password -emailVerificationToken -tokenVersion -qrToken')` a TODAS las queries User.find()
  2. En listado de users: `.select('_id firstName lastName email role active createdAt')`
  3. En listado de ministros: `.select('_id firstName lastName email phone specialty active createdAt')`
  4. En busquedas internas: siempre excluir campos sensibles

### F4.5 — Aplicar data masking de forma consistente
- **Estado**: [ ] Pendiente
- **Archivos**: `server/middleware/dataMasking.js` (ya existe), rutas que retornan PII
- **Problema**: dataMasking existe pero NO se aplica en la mayoria de rutas. `auditLog` middleware tampoco
- **Implementar**:
  1. Aplicar `dataMaskingContext` como middleware global en index.js (despues de authenticate)
  2. En rutas que retornan miembros/usuarios: verificar `req.shouldMaskPii` y aplicar `maskPiiFields()`
  3. Rutas prioritarias:
     - `GET /api/organizations/:id` — ya lo aplica parcialmente, verificar completitud
     - `GET /api/ministros` — aplicar masking para no-admin
     - `GET /api/users` — aplicar masking para no-admin
     - `GET /api/search` — enmascarar PII en resultados

### F4.6 — Aplicar auditLog middleware de forma consistente
- **Estado**: [ ] Pendiente
- **Archivos**: `server/middleware/auditMiddleware.js` (ya existe), rutas criticas
- **Problema**: auditLog middleware existe pero NO se aplica en ninguna ruta actualmente
- **Implementar**:
  1. Importar `{ auditLog, setAuditContext }` de `middleware/auditMiddleware.js`
  2. Aplicar en operaciones criticas:
     - `POST /api/organizations` — `auditLog('CREATE', 'ORGANIZATION')`
     - `PUT /api/organizations/:id` — `auditLog('UPDATE', 'ORGANIZATION')`
     - `DELETE /api/organizations/:id` — `auditLog('DELETE', 'ORGANIZATION')`
     - `POST /api/organizations/:id/status` — `auditLog('STATUS_CHANGE', 'ORGANIZATION')`
     - `POST /api/organizations/:id/approve*` — `auditLog('APPROVE', 'ORGANIZATION')`
     - `POST /api/organizations/:id/reject` — `auditLog('REJECT', 'ORGANIZATION')`
     - `POST /api/auth/login` — `auditLog('LOGIN', 'USER')` (loguear exitos Y fallos)
     - `POST /api/auth/logout` — `auditLog('LOGOUT', 'USER')`
     - `POST /api/auth/change-password` — `auditLog('UPDATE', 'USER')`
     - `POST /api/ministros` — `auditLog('CREATE', 'MINISTRO')`
     - `DELETE /api/ministros/:id` — `auditLog('DELETE', 'MINISTRO')`
     - `GET /api/users` — `auditLog('ACCESS_PII', 'USER')`
     - Uploads y downloads de documentos
  3. Para login fallidos: crear version que loguee sin requerir userId

### F4.7 — Acceso a ministros: restringir por rol
- **Estado**: [ ] Pendiente
- **Archivos**: `server/routes/ministros.js:52`
- **Problema**: `GET /api/ministros/:id` permite a cualquier usuario autenticado ver datos de cualquier ministro
- **Implementar**:
  1. Solo MUNICIPALIDAD puede ver todos los ministros
  2. MINISTRO_FE puede ver solo su propio perfil
  3. ORGANIZADOR puede ver datos basicos (nombre, especialidad) de ministros asignados a su org

### F4.8 — Implementar password reset para usuarios regulares
- **Estado**: [ ] Pendiente
- **Archivos**: `server/routes/auth.js` (crear nuevo endpoint)
- **Problema**: No existe flujo de recuperacion de password para ORGANIZADOR/MIEMBRO
- **Implementar**:
  1. `POST /api/auth/forgot-password` — recibe email, genera token crypto, envia email
  2. `POST /api/auth/reset-password` — recibe token + nueva password
  3. Token: `crypto.randomBytes(32).toString('hex')`, expira en 1 hora
  4. Campos en User model: `resetPasswordToken`, `resetPasswordExpires`
  5. Rate limiting estricto: 3 intentos por hora
  6. Invalidar token despues de primer uso

---

## FASE 5: MEJORAS — Cifrado, Monitoring y Compliance

### F5.1 — Habilitar verificacion de email
- **Estado**: [ ] Pendiente
- **Archivos**: `server/middleware/auth.js:106-109`
- **Problema**: `requireVerifiedEmail` siempre hace `next()` — cualquiera registra con email falso
- **Implementar**:
  1. Configurar SMTP (AWS SES, SendGrid, o similar)
  2. Descomentar logica de verificacion en `requireVerifiedEmail`
  3. Dar 7 dias de gracia despues de registro
  4. Despues de 7 dias: requerir email verificado para crear organizaciones
  5. Permitir reenvio de email de verificacion (ya existe endpoint)

### F5.2 — Cifrar documentos sensibles at-rest
- **Estado**: [ ] Pendiente
- **Archivos**: crear `server/utils/encryption.js`
- **Problema**: Certificados base64 en MongoDB sin cifrar — si DB se compromete, todo expuesto
- **Implementar**:
  1. Crear modulo `encryption.js` con AES-256-GCM:
     ```js
     import crypto from 'crypto';
     const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes hex
     export function encrypt(text) { /* AES-256-GCM */ }
     export function decrypt(ciphertext) { /* AES-256-GCM */ }
     ```
  2. Cifrar antes de guardar en MongoDB: certificados, documentos base64, firmas
  3. Descifrar al leer
  4. Agregar `ENCRYPTION_KEY` a variables de entorno (generar con `crypto.randomBytes(32).toString('hex')`)
  5. Migrar datos existentes con script one-time
  6. Prioridad: migrar a S3 primero (ya planificado en CLAUDE.md) y cifrar en S3

### F5.3 — CSP report endpoint
- **Estado**: [ ] Pendiente
- **Archivos**: `server/index.js` (nueva ruta), `server/middleware/security.js`
- **Implementar**:
  1. Crear `POST /api/csp-report` que reciba reportes de violaciones CSP
  2. Parsear `req.body` (CSP reports tienen formato especial)
  3. Loguear en AuditLog o archivo separado
  4. Agregar `report-uri /api/csp-report` al CSP en security.js
  5. No requiere autenticacion (el browser lo envia automaticamente)

### F5.4 — Implementar 2FA para roles admin
- **Estado**: [ ] Pendiente
- **Archivos**: `server/routes/auth.js`, `server/models/User.js`
- **Implementar**:
  1. TOTP (Time-based One-Time Password) para MUNICIPALIDAD
  2. Agregar campos: `twoFactorSecret`, `twoFactorEnabled`
  3. Endpoint para generar QR de TOTP: `POST /api/auth/2fa/setup`
  4. Endpoint para verificar codigo: `POST /api/auth/2fa/verify`
  5. En login: si 2FA habilitado, retornar `requires2FA: true` y pedir codigo
  6. Usar libreria `otplib` o `speakeasy`

### F5.5 — Monitoreo de sesiones activas
- **Estado**: [ ] Pendiente
- **Archivos**: crear modelo `Session.js`, endpoints en auth.js
- **Implementar**:
  1. Modelo Session: userId, ipAddress, userAgent, createdAt, lastActive, isRevoked
  2. Al hacer login: crear sesion
  3. En authenticate middleware: actualizar lastActive
  4. Endpoint: `GET /api/auth/sessions` — ver sesiones activas
  5. Endpoint: `POST /api/auth/sessions/:id/revoke` — revocar sesion especifica
  6. Endpoint: `POST /api/auth/sessions/revoke-all` — revocar todas excepto actual

### F5.6 — CORS: rechazar requests sin origin en produccion
- **Estado**: [ ] Pendiente
- **Archivos**: `server/index.js:57-58`
- **Problema**: `if (!origin) return callback(null, true)` permite requests sin Origin (curl, scripts)
- **Implementar**:
  1. En produccion: rechazar requests sin Origin en rutas que mutan datos
  2. Mantener permitido para: health check, endpoints GET publicos
  3. O: permitir sin Origin SOLO si viene con cookie valida (ya esta autenticado)

### F5.7 — Expirar notificaciones con TTL
- **Estado**: [ ] Pendiente (listado en CLAUDE.md como pendiente)
- **Archivos**: `server/models/Notification.js`
- **Implementar**:
  1. Agregar TTL index: `{ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }` (90 dias)
  2. Verificar que no rompa queries existentes

### F5.8 — Script de rotacion de credenciales
- **Estado**: [ ] Pendiente
- **Archivos**: crear `server/scripts/rotate-secrets.js`
- **Implementar**:
  1. Script que genera nuevos valores para: JWT_SECRET, ENCRYPTION_KEY
  2. Instrucciones para rotar MongoDB password
  3. Instrucciones para rotar AWS credentials (ya mencionado en CLAUDE.md)
  4. Documentar proceso en README de seguridad

### F5.9 — Headers de seguridad adicionales
- **Estado**: [ ] Pendiente
- **Archivos**: `server/middleware/security.js`
- **Implementar**:
  1. `Permissions-Policy: camera=(), microphone=(), geolocation=()` — restringir APIs del browser
  2. `X-Content-Type-Options: nosniff` — ya existe via Helmet
  3. `Cross-Origin-Opener-Policy: same-origin`
  4. `Cross-Origin-Resource-Policy: same-origin`
  5. Verificar que `X-DNS-Prefetch-Control: off` esta seteado

---

## FASE 6: TESTS — Cobertura de Seguridad

### F6.1 — Tests de autenticacion
- **Estado**: [ ] Pendiente
- **Archivos**: crear `server/__tests__/security/auth.test.js`
- **Tests**:
  1. Login con credenciales invalidas retorna 401
  2. Login con cuenta bloqueada retorna 401
  3. Acceso a ruta protegida sin token retorna 401
  4. Acceso a ruta protegida con token expirado retorna 401
  5. Refresh con token viejo (post-rotation) retorna 401
  6. Cambio de password invalida sesiones anteriores
  7. Token version mismatch retorna 401

### F6.2 — Tests de autorizacion (RBAC + IDOR)
- **Estado**: [ ] Pendiente
- **Archivos**: crear `server/__tests__/security/authorization.test.js`
- **Tests**:
  1. ORGANIZADOR no puede acceder a rutas MUNICIPALIDAD
  2. MIEMBRO no puede acceder a org donde no es miembro (IDOR)
  3. ORGANIZADOR no puede cambiar status de org
  4. ORGANIZADOR no puede acceder a datos de org ajena
  5. allowFields bloquea campos admin-only en PUT

### F6.3 — Tests de validacion e inyeccion
- **Estado**: [ ] Pendiente
- **Archivos**: crear `server/__tests__/security/validation.test.js`
- **Tests**:
  1. Body con campos extra es rechazado (.strict())
  2. RUT invalido es rechazado
  3. SQL injection en campos de texto no causa errores
  4. NoSQL injection ($gt, $where) en body es sanitizado
  5. XSS payloads en campos de texto son sanitizados
  6. ObjectId invalido retorna 400
  7. Body size > limit retorna 413

### F6.4 — Tests de rate limiting
- **Estado**: [ ] Pendiente
- **Archivos**: crear `server/__tests__/security/ratelimit.test.js`
- **Tests**:
  1. 6to intento de login en 15 min retorna 429
  2. 4to registro en 1 hora retorna 429
  3. 101 requests en 1 min retorna 429

### F6.5 — Tests de file upload
- **Estado**: [ ] Pendiente
- **Archivos**: crear `server/__tests__/security/uploads.test.js`
- **Tests**:
  1. Upload de .exe es rechazado
  2. Upload de archivo > 20MB es rechazado
  3. Path traversal en filename es prevenido
  4. Download de archivo de org ajena es 403

---

## Registro de Progreso

| Fecha | Fase.Tarea | Estado | Notas |
|-------|------------|--------|-------|
| 2026-03-05 | Plan creado | - | Auditoria completa realizada |
| 2026-03-05 | F1 completa | DONE | 7/7 tareas: body limit 5MB, error handler seguro, JWT unificado, tempPasswords removidos, trust proxy, allowFields verificado, path traversal fix |

---

## Referencia Rapida: Archivos de Seguridad

| Archivo | Proposito |
|---------|-----------|
| `server/middleware/auth.js` | JWT, cookies, authenticate, requireRole |
| `server/middleware/security.js` | Rate limiting, Helmet, sanitizeInput, allowFields |
| `server/middleware/validation.js` | Schemas Zod, validate() middleware |
| `server/middleware/dataMasking.js` | Enmascaramiento PII (RUT, email, phone) |
| `server/middleware/auditMiddleware.js` | Audit logging middleware |
| `server/models/AuditLog.js` | Modelo de audit log con TTL 365 dias |
| `server/models/Consent.js` | Consentimiento de usuario (Ley 21.719) |
| `server/models/SecurityIncident.js` | Registro de incidentes de seguridad |
| `server/scripts/anonymize-expired-data.js` | Anonimizacion de datos expirados |
| `src/shared/utils/sanitize.js` | DOMPurify frontend (XSS prevention) |
