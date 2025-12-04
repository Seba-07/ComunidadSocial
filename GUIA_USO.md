# 🎉 Guía de Uso - Comunidad Renca

## ✅ Sistema de Autenticación Completo

La aplicación ahora funciona como un **programa completo** con pantalla de login/registro antes de acceder.

---

## 🚀 Cómo usar la aplicación

### 1. **Servidor corriendo**
La aplicación está corriendo en:
- **Local**: http://localhost:3001/
- **Red**: http://192.168.4.35:3001/

### 2. **Pantalla de Autenticación**

Al visitar la aplicación, serás redirigido automáticamente a `/auth.html` donde puedes:

#### **Opción A: Iniciar Sesión**

**Usuario de Prueba:**
- Email: `usuario@example.cl`
- Contraseña: `user123`

**Administrador Municipal (creado por el sistema):**
- Email: `admin@renca.cl`
- Contraseña: `admin123`

#### **Opción B: Registrarse**

Los usuarios nuevos pueden crear su cuenta completando:
- Nombre
- Apellido
- RUT (con validación chilena)
- Email
- Contraseña (mínimo 6 caracteres)
- Confirmar contraseña

**Nota:** Solo los usuarios normales pueden registrarse. El administrador está pre-creado en el sistema.

### 3. **Acceso a la Aplicación**

Una vez autenticado:
- Serás redirigido a la aplicación principal
- Tu sesión se mantiene en localStorage
- Puedes cerrar sesión con el botón "Salir" en el header

---

## 📋 Crear una Organización Comunitaria

### Paso a paso:

1. **Inicia sesión** con cualquier usuario
2. En la página de inicio, haz clic en el botón **"Comenzar ahora"**
3. Se abrirá el **Wizard de 6 pasos**:

#### **PASO 1: Datos Básicos** ⚙️
- Tipo de organización (Junta de Vecinos / Organización Funcional)
- Nombre de la organización
- Descripción y objetivos
- Dirección, comuna, unidad vecinal
- Email y teléfono de contacto

#### **PASO 2: Miembros Fundadores** 👥
- Agregar mínimo **50 miembros fundadores**
- Cada miembro requiere: RUT, nombre, apellido, email, teléfono, dirección
- Puedes eliminar miembros antes de continuar
- El contador muestra cuántos miembros llevas

#### **PASO 3: Comisión Electoral** ⚖️
- Seleccionar **exactamente 3 miembros** de la lista de socios
- Definir fecha de elección programada
- Los 3 miembros seleccionados formarán la Comisión Electoral
- Requisitos según **Ley 19.418**

#### **PASO 4: Estatutos** 📜
- Opción 1: Usar **plantilla predefinida** (recomendado)
  - Se genera automáticamente con tus datos
- Opción 2: Cargar **estatutos personalizados** (PDF, DOC, DOCX)

#### **PASO 5: Documentos** 📄
Subir los siguientes documentos (máximo 10MB por archivo):

**Documentos Requeridos:**
- ✅ Acta Constitutiva
- ✅ Estatutos
- ✅ Registro de Socios
- ✅ Declaración Jurada del Presidente
- ✅ Certificado de Antecedentes

**Documentos Opcionales:**
- Acta Comisión Electoral

**Formatos permitidos:** PDF, DOC, DOCX, JPG, PNG

#### **PASO 6: Revisión y Envío** ✓
- Revisa toda la información
- Acepta la declaración de veracidad
- Envía la solicitud

---

## 💾 Base de Datos Local (IndexedDB)

### Datos guardados localmente:

La aplicación usa **IndexedDB** para guardar:
- ✅ Usuarios
- ✅ Organizaciones
- ✅ Solicitudes/Aplicaciones
- ✅ Documentos (como archivos en base64)

### Ver la base de datos:

1. Abre **DevTools** (F12)
2. Ve a la pestaña **"Application"** (Chrome) o **"Storage"** (Firefox)
3. En el panel izquierdo, busca **"IndexedDB"**
4. Expande **"ComunidadRencaDB"**
5. Podrás ver las 4 colecciones:
   - `users`
   - `organizations`
   - `applications`
   - `documents`

---

## 🎯 Funcionalidades Implementadas

### ✅ Sistema de Autenticación
- Login/Logout funcional
- Persistencia de sesión (localStorage)
- Roles: USER y ADMIN
- Protección de rutas

### ✅ Wizard Completo de 6 Pasos
- Navegación entre pasos (siguiente/anterior)
- Validación en cada paso
- Barra de progreso visual
- Indicadores de pasos completados

### ✅ Gestión de Miembros
- Agregar miembros con modal
- Eliminar miembros
- Contador en tiempo real
- Validación de mínimo 50 miembros

### ✅ Comisión Electoral
- Selección de 3 miembros exactos
- Validación de requisitos legales
- Modal de selección interactivo

### ✅ Sistema de Documentos
- Subir archivos (hasta 10MB)
- Validación de formatos
- Guardar en IndexedDB como base64
- Eliminar documentos
- Indicadores visuales de estado

### ✅ Revisión Final
- Resumen completo de toda la información
- Declaración de veracidad
- Envío de solicitud

### ✅ Persistencia de Datos
- Todo se guarda en IndexedDB
- Los datos persisten al recargar la página
- Funciona 100% offline

---

## 🏗️ Arquitectura Clean

El proyecto sigue **Clean Architecture**:

```
src/
├── domain/              # Reglas de negocio
│   ├── entities/       # 5 entidades
│   ├── use-cases/      # Casos de uso
│   └── repositories/   # Interfaces
├── infrastructure/      # Implementación
│   ├── repositories/   # IndexedDB
│   ├── services/       # Auth, etc.
│   ├── database/       # IndexedDB Service
│   └── config/         # Container DI
└── presentation/        # UI
    └── components/
        └── wizard/     # Wizard completo
```

---

## 📊 Datos de Ejemplo Precargados

Al iniciar la aplicación por primera vez, se crean automáticamente:

- ✅ 2 usuarios (admin y usuario normal)
- IndexedDB se inicializa automáticamente

---

## 🔧 Próximos Pasos (Futuras Mejoras)

### Para desarrollo:
1. **Dashboard de Usuario**
   - Ver mis solicitudes
   - Estado de postulaciones
   - Editar borradores

2. **Panel de Administración**
   - Ver todas las solicitudes
   - Aprobar/Rechazar
   - Agregar comentarios
   - Cambiar estados

3. **Notificaciones**
   - Sistema de notificaciones en tiempo real
   - Alertas de cambios de estado

4. **Exportación de Documentos**
   - Generar PDFs automáticos
   - Descargar actas y certificados

5. **Conexión a Firebase**
   - Migrar de IndexedDB a Firestore
   - Autenticación con Firebase Auth
   - Storage para documentos

---

## 🐛 Solución de Problemas

### El wizard no se abre:
- Verifica que estés autenticado
- Revisa la consola del navegador (F12)
- Recarga la página

### Los documentos no se suben:
- Verifica el tamaño del archivo (máximo 10MB)
- Usa formatos permitidos: PDF, DOC, DOCX, JPG, PNG

### La base de datos no guarda:
- Verifica que IndexedDB esté habilitado en tu navegador
- Revisa en DevTools → Application → IndexedDB

### Error al avanzar de paso:
- Completa todos los campos requeridos (marcados con *)
- Verifica las validaciones específicas de cada paso

---

## 📱 Responsive

La aplicación es completamente **responsive** y se adapta a:
- ✅ Desktop
- ✅ Tablet
- ✅ Mobile

---

## 🎨 Características de UX/UI

- ✅ Animaciones suaves
- ✅ Feedback visual (toasts)
- ✅ Validaciones en tiempo real
- ✅ Progress bar
- ✅ Indicadores de estado
- ✅ Modales interactivos
- ✅ Diseño moderno y limpio

---

## 📄 Ley 19.418

El wizard está **100% basado en la Ley 19.418** de Juntas de Vecinos:
- ✅ Requisitos mínimos de miembros (50-200)
- ✅ Edad mínima de 14 años
- ✅ Comisión Electoral de 3 personas
- ✅ Documentos requeridos
- ✅ Proceso de constitución

---

## 💡 Tips de Uso

1. **Guarda frecuentemente**: La información se guarda automáticamente en cada paso
2. **Completa todos los campos**: Los campos con `*` son obligatorios
3. **Verifica antes de enviar**: En el paso 6 puedes revisar todo antes de enviar
4. **Documentos claros**: Sube documentos legibles y en el formato correcto

---

## 🎉 ¡Listo para usar!

La aplicación está **100% funcional** en entorno local. Puedes:
- ✓ Crear organizaciones comunitarias
- ✓ Gestionar miembros
- ✓ Subir documentos
- ✓ Todo funciona offline con IndexedDB

---

**¿Preguntas o problemas?** Revisa la consola del navegador (F12) para ver logs y errores.
