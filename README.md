# Comunidad Renca - PWA de Participación Ciudadana

Aplicación web progresiva (PWA) para la gestión de participación ciudadana y formación educativa de la Municipalidad de Renca.

## Características

- ✅ **PWA** - Funciona como app nativa en dispositivos móviles
- 📱 **Responsive** - Diseño adaptable a todos los dispositivos
- 🔔 **Notificaciones Push** - Sistema de notificaciones en tiempo real
- 📴 **Modo Offline** - Funciona sin conexión a internet
- 🎨 **Diseño Moderno** - Interfaz intuitiva y profesional
- 📚 **Gestión de Recursos** - Documentos, guías y materiales de apoyo

## Secciones Principales

1. **Inicio** - Dashboard con acceso rápido y publicaciones recientes
2. **Consejos Escolares** - Documentos, roles y material de apoyo
3. **Centro de Padres** - Recursos para centros de padres y apoderados
4. **Centro de Estudiantes** - Información y guías para organizaciones estudiantiles
5. **Comunidad** - Espacio de participación e información comunitaria
6. **Proyectos y Leyes** - Fondos concursables, donaciones y marco legal
7. **Recursos** - Biblioteca completa de documentos y materiales

## Instalación y Desarrollo

### Requisitos Previos

- Node.js (versión 16 o superior)
- npm o yarn

### Instalación

```bash
# Instalar dependencias
npm install
```

### Desarrollo Local

```bash
# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

### Build para Producción

```bash
# Generar build optimizado
npm run build

# Preview del build
npm run preview
```

## Configuración de Iconos

Para que la PWA funcione correctamente, necesitas agregar los iconos en la carpeta `public/icons/`:

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

Puedes generar estos iconos automáticamente usando:
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)

## Instalación en Dispositivos Móviles

### Android
1. Abre la aplicación en Chrome
2. Toca el menú (⋮) > "Agregar a pantalla de inicio"
3. Sigue las instrucciones

### iOS
1. Abre la aplicación en Safari
2. Toca el botón de compartir
3. Selecciona "Agregar a pantalla de inicio"

## Tecnologías Utilizadas

- **Vite** - Build tool y dev server
- **Vanilla JavaScript** - Sin frameworks pesados
- **CSS3** - Estilos modernos y responsive
- **Service Workers** - Funcionalidad offline
- **Web App Manifest** - Configuración PWA

## Estructura del Proyecto

```
ComunidadSocial/
├── index.html          # HTML principal
├── styles.css          # Estilos CSS
├── main.js            # JavaScript principal
├── sw.js              # Service Worker
├── manifest.json      # Web App Manifest
├── vite.config.js     # Configuración de Vite
├── package.json       # Dependencias
└── public/            # Archivos públicos
    ├── icons/         # Iconos de la PWA
    └── screenshots/   # Capturas de pantalla
```

## Roadmap

### Fase 1 - Completada ✅
- [x] Estructura base de la PWA
- [x] Diseño responsive
- [x] Navegación funcional
- [x] Service Worker
- [x] Manifest de PWA

### Fase 2 - Próximamente
- [ ] Sistema de autenticación
- [ ] Base de datos (Firebase/Supabase)
- [ ] CRUD de publicaciones
- [ ] Sistema de comentarios
- [ ] Reserva de espacios comunitarios
- [ ] Calendario de eventos
- [ ] Formularios de consultas
- [ ] Panel de administración

### Fase 3 - Futuro
- [ ] Notificaciones push reales
- [ ] Chat en tiempo real
- [ ] Sistema de votaciones
- [ ] Integración con redes sociales
- [ ] Analytics y reportes
- [ ] Multi-idioma

## Licencia

MIT

## Contacto

Para consultas y soporte: Municipalidad de Renca
