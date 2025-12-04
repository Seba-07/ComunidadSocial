# 🚀 Deploy en Netlify - Comunidad Renca

## Opción 1: Deploy con Netlify CLI (Recomendado)

### 1. Instalar Netlify CLI
```bash
npm install -g netlify-cli
```

### 2. Login en Netlify
```bash
netlify login
```

### 3. Deploy
```bash
# Desde el directorio del proyecto
cd /Users/sebastianaranguizrivera/Desktop/Claude/ComunidadSocial

# Deploy de prueba
netlify deploy

# Cuando te pregunte por el directorio, ingresa: dist

# Deploy a producción
netlify deploy --prod
```

---

## Opción 2: Deploy Drag & Drop (Más Fácil)

### 1. Ir a Netlify
Abre tu navegador y ve a: https://app.netlify.com/drop

### 2. Arrastra la carpeta dist
Arrastra la carpeta `dist` completa desde:
```
/Users/sebastianaranguizrivera/Desktop/Claude/ComunidadSocial/dist
```

### 3. ¡Listo!
Netlify te dará una URL automáticamente.

---

## Opción 3: Deploy desde GitHub

### 1. Crear repositorio en GitHub
```bash
cd /Users/sebastianaranguizrivera/Desktop/Claude/ComunidadSocial
git init
git add .
git commit -m "Initial commit - Comunidad Renca PWA"
git branch -M main
git remote add origin <tu-repo-url>
git push -u origin main
```

### 2. Conectar con Netlify
1. Ve a https://app.netlify.com
2. Click en "Add new site" → "Import an existing project"
3. Selecciona GitHub
4. Busca tu repositorio
5. Configura:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Click en "Deploy site"

---

## ✅ Verificar el Deploy

Una vez deployado, verifica:
- ✅ La página carga correctamente
- ✅ Las imágenes se ven
- ✅ El buscador funciona
- ✅ El carrusel se mueve
- ✅ Los eventos muestran imágenes
- ✅ La PWA se puede instalar (icono en la barra de direcciones)

---

## 🔧 Configuración Incluida

El proyecto incluye:
- ✅ `netlify.toml` - Configuración de build y redirects
- ✅ `dist/_redirects` - Redirecciones para SPA
- ✅ Service Worker para funcionalidad offline
- ✅ Manifest.json para PWA
- ✅ Iconos en todos los tamaños

---

## 📱 Instalar como PWA

Una vez deployado en Netlify:
1. Abre la URL en Chrome/Edge
2. Busca el icono de "Instalar" en la barra de direcciones
3. Click en "Instalar"
4. ¡La app ahora funciona como una app nativa!

---

## 🎨 URL Custom (Opcional)

Para cambiar el nombre del sitio:
1. Ve a Netlify Dashboard
2. Click en tu sitio
3. Site settings → Change site name
4. Ingresa: `comunidad-renca` o el nombre que prefieras
5. Tu URL será: `https://comunidad-renca.netlify.app`
