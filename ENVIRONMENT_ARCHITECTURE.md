# Arquitectura de Ambientes - ComunidadSocial

> Documento de referencia para la separacion de ambientes Dev/Prod.
> Ultima actualizacion: 2026-03-10

---

## 1. Flujo de Git (GitFlow Simplificado)

```
main  ─────●────────●────────●──────  (produccion, clientes reales)
            \      /          \
develop ─────●────●────●───●───●────  (desarrollo, pruebas internas)
              \       /
feature/* ─────●─────●                (ramas temporales por tarea)
```

### Reglas

| Regla | Detalle |
|-------|---------|
| **Rama de trabajo** | Siempre `develop`. Se crea ramas `feature/*` o `fix/*` desde `develop` si es necesario |
| **Merge a main** | Solo cuando una version esta probada y lista para clientes. Se hace via PR o merge directo |
| **Hotfix** | Si hay un bug critico en produccion, se crea `hotfix/*` desde `main`, se corrige, se mergea a `main` Y a `develop` |
| **Nunca** | Push directo a `main` desde una terminal de desarrollo sin verificar |

---

## 2. Mapeo de Infraestructura

### Produccion

```
Usuario final
    |
    v
Vercel (Production)          <-- auto-deploy desde rama: main
    |                             Dominio: comunidadsocial.vercel.app
    |  HTTPS (cross-origin)
    v
Railway (Production)         <-- auto-deploy desde rama: main
    |                             URL: comunidadsocial-production.up.railway.app
    v
MongoDB Atlas
    DB: comunidad_social     <-- base de datos principal con datos reales
```

**Variables de entorno en Vercel (Production):**
```
VITE_API_URL = https://comunidadsocial-production.up.railway.app/api
```

**Variables de entorno en Railway (Production):**
```
MONGODB_URI    = mongodb+srv://...@cluster/comunidad_social?...
FRONTEND_URL   = https://comunidadsocial.vercel.app
JWT_SECRET     = <secret-produccion>
NODE_ENV       = production
```

### Desarrollo / Staging

```
Desarrollador (preview)
    |
    v
Vercel (Preview)             <-- auto-deploy desde rama: develop
    |                             Dominio: comunidadsocial-git-develop-*.vercel.app
    |  HTTPS (cross-origin)
    v
Railway (Development)        <-- auto-deploy desde rama: develop
    |                             URL: comunidadsocial-dev-production.up.railway.app
    v
MongoDB Atlas
    DB: comunidad_social_dev <-- base de datos aislada para pruebas
```

**Variables de entorno en Vercel (Preview/develop):**
```
VITE_API_URL = https://comunidadsocial-dev-production.up.railway.app/api
```

**Variables de entorno en Railway (Development):**
```
MONGODB_URI    = mongodb+srv://...@cluster/comunidad_social_dev?...
FRONTEND_URL   = https://comunidadsocial-git-develop-<hash>.vercel.app
JWT_SECRET     = <secret-desarrollo>
NODE_ENV       = production
```

### Local

```
Navegador (localhost:3000)
    |
    v
Vite Dev Server (port 3000)  <-- npm run dev (raiz)
    |  Proxy /api/* y /uploads/*
    v
Node Express (port 3001)     <-- npm run dev (server/)
    |
    v
MongoDB Atlas
    DB: comunidad_social_dev <-- misma DB de desarrollo
```

**Variables locales:**
- Frontend: sin `.env` necesario (Vite proxy usa `/api` en localhost)
- Backend: `server/.env` con `MONGODB_URI` apuntando a `comunidad_social_dev`

---

## 3. Manejo de CORS y Cookies (Cross-Origin)

### El problema

Vercel (frontend) y Railway (backend) estan en dominios distintos:
- Frontend: `comunidadsocial.vercel.app`
- Backend: `comunidadsocial-production.up.railway.app`

Los navegadores bloquean cookies entre dominios distintos a menos que se cumplan 3 condiciones simultaneas.

### La solucion

| Requisito | Donde se configura | Valor |
|-----------|--------------------|-------|
| `credentials: 'include'` | Frontend (`ApiService.js`) en cada `fetch()` | Envia cookies con peticiones cross-origin |
| `credentials: true` | Backend (`server/index.js`) en CORS config | Permite recibir cookies cross-origin |
| `sameSite: 'none'` | Backend (`server/middleware/auth.js`) en cookie options | Permite enviar cookie a otro dominio |
| `secure: true` | Backend (`server/middleware/auth.js`) en cookie options | Obligatorio cuando `sameSite: 'none'` (solo HTTPS) |
| `Access-Control-Allow-Origin` exacto | Backend CORS | No puede ser `*` cuando hay credentials |

### En desarrollo local

Como `localhost` no usa HTTPS, las cookies usan `sameSite: 'lax'` y `secure: false`.
Ademas, Vite proxy reenvía `/api/*` al backend en el mismo origen, por lo que las cookies funcionan como first-party.

```javascript
// server/middleware/auth.js - Configuracion condicional
sameSite: isDeployed ? 'none' : 'lax',
secure: isDeployed,  // true en Railway, false en localhost
```

---

## 4. Variables de Entorno - Referencia Rapida

### Frontend (.env.example en raiz)

| Variable | Requerida | Ejemplo |
|----------|-----------|---------|
| `VITE_API_URL` | En produccion si | `https://tu-backend.up.railway.app/api` |
| `VITE_ENABLE_STRICT_LOCAL_NETWORK_BLOCK` | No | `true` (activa proteccion Anti-SSRF) |

### Backend (server/.env.example)

| Variable | Requerida | Ejemplo |
|----------|-----------|---------|
| `MONGODB_URI` | Si | `mongodb+srv://...@cluster/comunidad_social` |
| `JWT_SECRET` | Si (prod) | String aleatorio largo |
| `FRONTEND_URL` | Si (prod) | `https://comunidadsocial.vercel.app` |
| `FRONTEND_URL_ALT` | No | URL alternativa para CORS |
| `BACKEND_URL` | No | URL publica del backend (CSP header) |
| `PORT` | No | `3001` (Railway lo asigna automaticamente) |
| `NODE_ENV` | Si (prod) | `production` |

---

## 5. Protocolo de Pruebas - Checklist de Verificacion

### Despues de cada deploy a Desarrollo

- [ ] Abrir la URL de Vercel Preview (rama `develop`)
- [ ] Verificar en consola del navegador que `API URL` apunta al Railway de **Development**
- [ ] Registrar un usuario de prueba (ej: `test-dev@example.com`)
- [ ] Verificar en MongoDB Atlas que el usuario aparece en `comunidad_social_dev` y **NO** en `comunidad_social`
- [ ] Hacer login y verificar que la cookie `auth_token` se recibe correctamente (DevTools > Application > Cookies)
- [ ] Crear una organizacion de prueba via el Wizard
- [ ] Verificar que los documentos PDF se generan correctamente
- [ ] Verificar que el logout limpia la cookie

### Despues de cada deploy a Produccion

- [ ] Abrir `https://comunidadsocial.vercel.app`
- [ ] Verificar en consola que `API URL` apunta al Railway de **Production**
- [ ] Hacer login con una cuenta existente
- [ ] Verificar que los datos de produccion estan intactos (organizaciones, usuarios)
- [ ] Verificar que los datos de prueba de Dev **NO** aparecen en produccion
- [ ] Probar al menos 1 flujo completo (ej: ver organizacion, descargar PDF)

### Verificacion de aislamiento (una sola vez)

- [ ] Crear un usuario en Dev con un nombre identificable (ej: `PRUEBA-DEV`)
- [ ] Conectar a MongoDB Atlas y verificar que `comunidad_social.users` NO contiene `PRUEBA-DEV`
- [ ] Verificar que `comunidad_social_dev.users` SI lo contiene
- [ ] Eliminar el usuario de prueba

---

## 6. Troubleshooting

### Cookies no se envian (401 en todas las peticiones)

1. Verificar que el backend tiene `sameSite: 'none'` y `secure: true`
2. Verificar que CORS tiene `credentials: true` y `origin` no es `*`
3. Verificar que `FRONTEND_URL` en Railway coincide exactamente con el dominio de Vercel
4. Verificar que el frontend usa `credentials: 'include'` en fetch

### CORS bloqueado

1. Revisar la consola del navegador para ver el origen rechazado
2. Verificar que `FRONTEND_URL` en Railway incluye el protocolo (`https://`)
3. Para Vercel Preview: el backend Dev acepta `*.vercel.app` automaticamente

### Base de datos equivocada

1. Verificar `MONGODB_URI` en Railway — debe terminar en `/cs_<comuna>` (prod) o `/comunidad_social_dev` (dev)
2. En local, verificar `server/.env`
3. En MongoDB Atlas, comparar las colecciones de ambas bases para confirmar aislamiento

---

## 7. Multi-Municipalidad (Multi-Tenancy)

> Implementado 2026-03-15. Ver `PLAN_MULTI_TENANCY.md` para detalles completos.

### Arquitectura

Un solo repositorio, multiples deploys. Cada municipalidad tiene su propia infraestructura:

```
                    Repositorio Git (unico)
                            |
                    main (produccion estable)
                            |
            +---------------+---------------+
            |               |               |
    Railway: cs-renca-api   cs-maipu-api    cs-pudahuel-api
    Vercel:  cs-renca       cs-maipu        cs-pudahuel
    Atlas:   cs_renca       cs_maipu        cs_pudahuel
    User:    cs_renca_user  cs_maipu_user   cs_pudahuel_user
```

### Configuracion por municipalidad

Cada deploy lee su identidad desde variables de entorno:

| Variable (Backend) | Variable (Frontend) | Ejemplo |
|---------------------|---------------------|---------|
| `TENANT_COMMUNE_NAME` | `VITE_TENANT_COMMUNE_NAME` | `Renca` |
| `TENANT_MUNICIPALITY_NAME` | `VITE_TENANT_MUNICIPALITY_NAME` | `Municipalidad de Renca` |
| `TENANT_ADDRESS` | `VITE_TENANT_ADDRESS` | `Blanco Encalada 1335, Renca` |
| `TENANT_WEBSITE` | `VITE_TENANT_WEBSITE` | `www.renca.cl` |
| `TENANT_ADMIN_EMAIL` | `VITE_TENANT_ADMIN_EMAIL` | `admin@renca.cl` |
| `TENANT_PLATFORM_NAME` | `VITE_TENANT_PLATFORM_NAME` | `Comunidad Social Renca` |

Ver `deploy/template.env.server` y `deploy/template.env.frontend` para la lista completa.

### Aislamiento de datos

- Cada municipalidad tiene su **propio usuario Atlas** con acceso solo a su base de datos
- Un usuario de una municipalidad **no puede** acceder a la base de otra
- Si falta `MONGODB_URI` en produccion, el servidor **no inicia** (crash con error FATAL)
- En desarrollo local, el fallback siempre apunta a `comunidad_social_dev`

### Agregar nueva municipalidad

Seguir el checklist completo en `deploy/ONBOARDING.md`
