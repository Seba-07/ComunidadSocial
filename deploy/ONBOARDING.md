# Onboarding: Nueva Municipalidad

Checklist completo para agregar una nueva municipalidad al sistema.

---

## Prerequisitos

- Acceso a MongoDB Atlas (cloud.mongodb.com)
- Acceso a Railway (railway.app)
- Acceso a Vercel (vercel.com)
- Datos de la municipalidad (nombre, direccion, logo, unidades vecinales)

---

## Paso 1: Base de datos (MongoDB Atlas)

1. Ir a **Database Access** en Atlas
2. Click **"+ ADD NEW DATABASE USER"**
   - Username: `cs_<comuna>_user` (ej: `cs_maipu_user`)
   - Password: generar una segura (copiar)
   - Privileges: **Specific Privileges**
   - Add privilege: database `cs_<comuna>`, role `readWrite`
3. La base de datos se crea automaticamente al conectarse por primera vez

## Paso 2: Backend (Railway)

1. Ir a Railway > **New Project** > **Deploy from GitHub repo**
2. Seleccionar el repo `ComunidadSocial`, rama `main`
3. Nombre del servicio: `cs-<comuna>-api`
4. En **Variables**, copiar de `deploy/template.env.server` y completar:
   - `MONGODB_URI` con el usuario creado en Paso 1
   - `JWT_SECRET` generar string aleatorio (64+ chars)
   - `FRONTEND_URL` con la URL de Vercel (Paso 3)
   - Todas las variables `TENANT_*`
5. Verificar que el deploy fue exitoso: `https://cs-<comuna>-api-production.up.railway.app/api/health`

## Paso 3: Frontend (Vercel)

1. Ir a Vercel > **Add New Project** > importar el mismo repo
2. Nombre del proyecto: `cs-<comuna>`
3. Framework: Vite
4. En **Environment Variables**, copiar de `deploy/template.env.frontend` y completar:
   - `VITE_API_URL` con la URL de Railway del Paso 2
   - Todas las variables `VITE_TENANT_*`
5. Deploy branch: `main`
6. Verificar que la app carga: `https://cs-<comuna>.vercel.app`

## Paso 4: Logo y branding

1. Preparar el logo de la municipalidad (PNG, fondo transparente, min 192x192px)
2. Opciones:
   - **Simple**: reemplazar `public/icons/logo.png` en el deploy (via Vercel env o override)
   - **S3**: subir a S3 y setear `VITE_TENANT_LOGO_PATH` con la URL
3. Colores: setear `VITE_TENANT_COLOR_PRIMARY` y `VITE_TENANT_COLOR_SECONDARY` en Vercel

## Paso 5: Seed data

1. Crear carpeta `deploy/seeds/<comuna>/`
2. Agregar `unidadesVecinales.json` con las UVs de la comuna (ver `_template/README.md`)
3. Ejecutar:
   ```bash
   cd server
   MONGODB_URI=mongodb+srv://cs_<comuna>_user:...@cluster/cs_<comuna> \
   TENANT_COMMUNE_NAME=<NombreComuna> \
   npm run seed
   ```
4. Ejecutar seed de estatutos:
   ```bash
   MONGODB_URI=mongodb+srv://cs_<comuna>_user:...@cluster/cs_<comuna> \
   TENANT_COMMUNE_NAME=<NombreComuna> \
   node server/scripts/seed-estatutos.js
   ```
5. Ejecutar seed de unidades vecinales:
   ```bash
   MONGODB_URI=mongodb+srv://cs_<comuna>_user:...@cluster/cs_<comuna> \
   node server/scripts/seedUnidadesVecinales.js
   ```

## Paso 6: Crear admin inicial

1. Acceder a la app: `https://cs-<comuna>.vercel.app/app/login`
2. Registrar usuario con el email definido en `TENANT_ADMIN_EMAIL`
3. En MongoDB Atlas (o via script), cambiar el role del usuario a `MUNICIPALIDAD`

## Paso 7: Verificacion

- [ ] App carga sin errores en la URL de Vercel
- [ ] Health check responde OK: `/api/health`
- [ ] Login funciona (cookie auth cross-origin)
- [ ] El nombre de la municipalidad aparece en header, PDFs, emails
- [ ] Logo correcto
- [ ] Datos no se cruzan con otras municipalidades

---

## Convencion de nombres

| Recurso | Patron | Ejemplo |
|---------|--------|---------|
| MongoDB DB | `cs_<comuna>` | `cs_maipu` |
| Atlas user | `cs_<comuna>_user` | `cs_maipu_user` |
| Railway service | `cs-<comuna>-api` | `cs-maipu-api` |
| Vercel project | `cs-<comuna>` | `cs-maipu` |

## Costos estimados por municipalidad

| Recurso | Costo mensual |
|---------|--------------|
| Railway (bajo trafico) | ~$3-5 USD |
| Railway (alto trafico) | ~$15-25 USD |
| Vercel | Gratis (Hobby plan) |
| MongoDB Atlas M0 | Gratis (512MB) |
| MongoDB Atlas M10 | $57 USD (si necesita mas) |
