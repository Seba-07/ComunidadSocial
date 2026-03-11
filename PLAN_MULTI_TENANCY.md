# Plan: Aislamiento de Bases de Datos + Multi-Tenancy por Municipalidad

> **Archivo de seguimiento** — Claude debe leer esto al inicio de cada sesion para saber donde quedo.
> Ultima actualizacion: 2026-03-11

---

## Decision Arquitectonica: Opcion A — Deploys Separados

**Un solo repositorio, un solo `develop`, un solo `main`.** Cada municipalidad obtiene su propio Railway + Vercel + MongoDB, todos leyendo del mismo codigo. Lo unico que cambia entre municipalidades son **variables de entorno**.

```
                    UN SOLO REPO
                        |
                    develop (trabajo diario)
                        |
                    main (produccion estable)
                        |
            +-----------+-----------+
            |           |           |
        Deploy Renca  Deploy Maipu  Deploy Pudahuel
        (Railway)     (Railway)     (Railway)
        (Atlas DB)    (Atlas DB)    (Atlas DB)
        (Vercel)      (Vercel)      (Vercel)
```

**Por que Opcion A:**
- Aislamiento total por infraestructura (imposible que una muni acceda a otra)
- Desarrollo centralizado: codeas UNA vez, se despliega a todas
- Cada deploy solo tiene diferentes env vars (nombre, logo, colores, DB)
- Costo proporcional al uso real de cada municipalidad
- Si algun dia se quiere migrar a Opcion B (backend centralizado), el trabajo no se pierde

---

## PROGRESO

| Fase | Estado | Detalle |
|------|--------|---------|
| Fase 1 | EN PROGRESO | 1B hecho (codigo). 1A pendiente (Atlas manual — usuario debe crear users) |
| Fase 2 | COMPLETADA | tenant.js backend + frontend + API endpoint + .env.example |
| Fase 3 | COMPLETADA | 30+ refs reemplazadas. Build OK. Quedan solo seeds/tests/datos geograficos |
| Fase 4 | PENDIENTE | Templates de deploy + seeds |
| Fase 5 | PENDIENTE | Documentacion |

---

## Fase 1: Seguridad Inmediata — Aislar Dev/Prod

### 1A. Crear usuarios Atlas separados (MANUAL — guiar al usuario)
- [ ] Crear usuario `cs_dev_user` con acceso SOLO a `comunidad_social_dev`
- [ ] Crear usuario `cs_prod_user` con acceso SOLO a `comunidad_social`
- [ ] Restringir o eliminar `comunidad_admin` (tiene acceso a ambas DBs)
- [ ] Actualizar MONGODB_URI en Railway Production con `cs_prod_user`
- [ ] Actualizar MONGODB_URI en Railway Development con `cs_dev_user`

### 1B. Proteger conexion en codigo
- [ ] `server/index.js:147` — Crashear si falta MONGODB_URI en produccion, fallback a `comunidad_social_dev` solo en local
- [ ] Verificar `.gitignore` incluye `server/.env` — **YA VERIFICADO: SI**

### 1C. Actualizar `.env` local
- [ ] Cambiar credenciales en `server/.env` al nuevo usuario `cs_dev_user`

---

## Fase 2: Sistema de Configuracion Tenant

### 2A. Backend config
- [ ] Crear `server/config/tenant.js` — lee de env vars `TENANT_*`
  - communeName, municipalityName, regionName
  - address, phone, website, adminEmail
  - platformName, platformShortName
  - pdfHeaderText (derivado de communeName)
  - Validacion: CRASH si `TENANT_COMMUNE_NAME` no existe en produccion

### 2B. Frontend config
- [ ] Crear `src/config/tenant.js` — lee de env vars `VITE_TENANT_*`
  - communeName, municipalityName, platformName, platformShortName
  - adminEmail, website, address, logoPath
  - colorPrimary, colorSecondary

### 2C. API endpoint
- [ ] Crear `server/routes/tenant.js` — GET /api/tenant (publico, sin auth)
- [ ] Montar en `server/index.js`: `app.use('/api/tenant', tenantRoutes)`

### 2D. Env examples
- [ ] Actualizar `server/.env.example` con variables TENANT_*
- [ ] Actualizar `.env.example` (raiz) con variables VITE_TENANT_*

---

## Fase 3: Reemplazar Valores Hardcodeados de Renca

### 3A. Backend — Modelos y Rutas
- [ ] `server/models/Organization.js:176` — Quitar `default: 'Renca'` del campo comuna
- [ ] `server/routes/documents.js` (8 refs) — Import tenant, reemplazar 'Renca'
- [ ] `server/routes/unidadesVecinales.js` (2 refs) — Geocoding hardcodeado
- [ ] `server/scripts/reseed-estatutos-v14.js` (2 refs) — Defaults de tenant

### 3B. Frontend — Servicios PDF/Legal
- [ ] `src/services/PDFService.js` (9+ refs) — Headers, footers, direcciones, firmas
- [ ] `src/services/LegalReportService.js` (7 refs) — Mismo patron
- [ ] `src/services/OrganizationsService.js:501` — Fallback a tenant.communeName

### 3C. Frontend — React
- [ ] `src/react/components/layout/SharedHeader.jsx:36` — tenant.platformName
- [ ] `src/react/pages/Auth/ForgotPasswordModal.jsx:20` — tenant.adminEmail
- [ ] `src/react/pages/Legal/TermsPage.jsx` (3 refs) — tenant.platformName
- [ ] `src/react/pages/Legal/PrivacyPage.jsx` (2 refs) — tenant vals
- [ ] `src/react/stores/wizardStore.js:11` — commune: tenant.communeName

### 3D. Frontend — Vanilla JS (PELIGROSO — testear bien)
- [ ] `main.js` (6 refs) — Import tenant, reemplazar fallbacks y titulos
- [ ] `src/presentation/organization/OrganizationDashboard.js` (3 refs) — Certificados
- [ ] `src/infrastructure/config/app.config.js:22` — name dinamico
- [ ] `src/shared/utils/index.js:251-252` — Fallback 'Renca'
- [ ] `src/infrastructure/database/IndexedDBService.js:9` — 'ComunidadSocialDB' (generico)

### 3E. Archivos Estaticos
- [ ] `index.html` (5 refs) — Placeholders `__TENANT_*__`
- [ ] `react-app.html` (1 ref) — Placeholder titulo
- [ ] `manifest.json` — Valores dinamicos en build
- [ ] `sw.js` (3 refs) — Cache name generico 'comunidad-social-v4'
- [ ] `package.json` — Nombre generico 'comunidad-social-pwa'

### 3F. Logos e Iconos
- [ ] Renombrar `public/icons/logo_renca.png` a `public/icons/logo.png`
- [ ] Actualizar refs en HTML

### 3G. Plugin Vite para HTML
- [ ] Agregar plugin `tenant-html-transform` en `vite.config.js`

---

## Fase 4: Templates de Deploy + Seeds

### 4A. Estructura deploy/
- [ ] Crear `deploy/ONBOARDING.md`
- [ ] Crear `deploy/template.env.server`
- [ ] Crear `deploy/template.env.frontend`
- [ ] Crear `deploy/seeds/renca/` (extraer data del seed actual)
- [ ] Crear `deploy/seeds/_template/README.md`

### 4B. Refactorizar seeds
- [ ] Mover data Renca a `deploy/seeds/renca/`
- [ ] `server/scripts/seed.js` lee TENANT_COMMUNE_NAME para elegir seed

### 4C. Convencion de nombres (documentar)
| Recurso | Patron | Ejemplo |
|---------|--------|---------|
| MongoDB DB | `cs_<comuna>` | `cs_renca` |
| Atlas user | `cs_<comuna>_user` | `cs_renca_user` |
| Railway | `cs-<comuna>-api` | `cs-renca-api` |
| Vercel | `cs-<comuna>` | `cs-renca` |

---

## Fase 5: Documentacion

- [ ] Actualizar `ENVIRONMENT_ARCHITECTURE.md` — seccion multi-municipalidad
- [ ] Actualizar `CLAUDE.md` — convencion: nunca hardcodear valores de municipalidad
- [ ] Actualizar ambos `.env.example` con todas las variables TENANT_*

---

## Verificacion Final

- [ ] Setear `TENANT_COMMUNE_NAME=TestCommune` y levantar sistema completo
- [ ] Grep por 'Renca' en codebase — solo debe aparecer en seeds y tests
- [ ] Generar PDFs y verificar headers/footers con TestCommune
- [ ] Correr `npm test` en raiz y server/
- [ ] Sin TENANT_COMMUNE_NAME en produccion, server debe crashear con error claro

---

## Variables de Entorno — Referencia Completa

### Backend (Railway / server/.env)
```
TENANT_COMMUNE_NAME=Renca
TENANT_MUNICIPALITY_NAME=Municipalidad de Renca
TENANT_MUNICIPALITY_FULL_NAME=Ilustre Municipalidad de Renca
TENANT_REGION_NAME=Metropolitana
TENANT_ADDRESS=Blanco Encalada 1335, Renca
TENANT_PHONE=+562 2685 6600
TENANT_WEBSITE=www.renca.cl
TENANT_ADMIN_EMAIL=admin@renca.cl
TENANT_PLATFORM_NAME=Comunidad Social Renca
TENANT_PLATFORM_SHORT_NAME=Comunidad Renca
```

### Frontend (Vercel / .env)
```
VITE_TENANT_COMMUNE_NAME=Renca
VITE_TENANT_MUNICIPALITY_NAME=Municipalidad de Renca
VITE_TENANT_PLATFORM_NAME=Comunidad Social Renca
VITE_TENANT_PLATFORM_SHORT_NAME=Comunidad Renca
VITE_TENANT_ADMIN_EMAIL=admin@renca.cl
VITE_TENANT_WEBSITE=www.renca.cl
VITE_TENANT_ADDRESS=Blanco Encalada 1335, Renca
VITE_TENANT_LOGO_PATH=/icons/logo.png
VITE_TENANT_COLOR_PRIMARY=#2563eb
VITE_TENANT_COLOR_SECONDARY=#10b981
```

---

## Archivos Criticos (ordenados por riesgo)

| Archivo | Riesgo | Refs Renca | Nota |
|---------|--------|-----------|------|
| `main.js` | ALTO | 6 | 5400 lineas, entry point vanilla |
| `src/shared/utils/index.js` | ALTO | 2 | Usado en todo el sistema |
| `src/services/PDFService.js` | MEDIO | 9+ | PDFs legales con headers/footers |
| `src/services/LegalReportService.js` | MEDIO | 7 | Reportes legales |
| `server/routes/documents.js` | MEDIO | 8 | HTML templates server-side |
| `src/presentation/organization/OrganizationDashboard.js` | MEDIO | 3 | Monolito 5900 lineas |
| `server/index.js` | BAJO | 1 | Solo fallback DB |
| Resto (React, config, HTML) | BAJO | 1-3 c/u | Cambios simples |
