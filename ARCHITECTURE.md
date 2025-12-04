# Arquitectura del Sistema - Comunidad Renca

## 📋 Descripción General

Sistema digital para la gestión de formación de **Juntas de Vecinos y Organizaciones Comunitarias** según la **Ley 19.418** de Chile. La aplicación facilita el proceso de constitución de organizaciones comunitarias, permitiendo a los ciudadanos completar solicitudes de forma digital y a la municipalidad revisar y aprobar las postulaciones de manera eficiente.

## 🏗️ Arquitectura Limpia (Clean Architecture)

El proyecto sigue los principios de Clean Architecture propuestos por Robert C. Martin, separando las preocupaciones en capas con dependencias unidireccionales hacia el dominio.

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation                          │
│              (UI, Components, Controllers)               │
└────────────────────┬────────────────────────────────────┘
                     │ Depends on
┌────────────────────▼────────────────────────────────────┐
│                   Infrastructure                         │
│        (Repositories, Services, External APIs)           │
└────────────────────┬────────────────────────────────────┘
                     │ Depends on
┌────────────────────▼────────────────────────────────────┐
│                      Domain                              │
│         (Entities, Use Cases, Repositories)              │
│              *** NO DEPENDE DE NADIE ***                 │
└─────────────────────────────────────────────────────────┘
```

### Principios Aplicados

1. **Independencia de Frameworks**: El dominio no depende de ningún framework
2. **Testeable**: La lógica de negocio puede ser testeada sin UI, DB o servicios externos
3. **Independencia de UI**: La UI puede cambiar sin afectar el dominio
4. **Independencia de Base de Datos**: Podemos cambiar de Firebase a otro servicio sin tocar el dominio
5. **Independencia de Agentes Externos**: Las reglas de negocio no conocen nada del mundo exterior

## 📁 Estructura de Carpetas

```
src/
├── domain/                           # CAPA DE DOMINIO (Núcleo del sistema)
│   ├── entities/                     # Entidades de negocio
│   │   ├── User.js                   # Usuario (ciudadano/admin)
│   │   ├── Organization.js           # Organización comunitaria
│   │   ├── Application.js            # Solicitud/postulación
│   │   ├── Document.js               # Documento adjunto
│   │   └── ElectoralCommission.js    # Comisión electoral
│   │
│   ├── use-cases/                    # Casos de uso (lógica de aplicación)
│   │   ├── auth/
│   │   │   ├── LoginUser.js
│   │   │   ├── RegisterUser.js
│   │   │   └── LogoutUser.js
│   │   ├── organization/
│   │   │   ├── CreateOrganization.js
│   │   │   ├── UpdateOrganization.js
│   │   │   ├── GetOrganizationById.js
│   │   │   └── ChangeOrganizationStatus.js
│   │   └── application/
│   │       ├── CreateApplication.js
│   │       ├── SubmitApplication.js
│   │       ├── ReviewApplication.js
│   │       ├── UploadDocument.js
│   │       └── UpdateApplicationStep.js
│   │
│   └── repositories/                 # Interfaces (contratos)
│       ├── IUserRepository.js
│       ├── IOrganizationRepository.js
│       ├── IApplicationRepository.js
│       └── IDocumentRepository.js
│
├── infrastructure/                   # CAPA DE INFRAESTRUCTURA
│   ├── repositories/                 # Implementaciones de repositorios
│   │   ├── FirebaseUserRepository.js
│   │   ├── FirebaseOrganizationRepository.js
│   │   ├── FirebaseApplicationRepository.js
│   │   └── FirebaseDocumentRepository.js
│   │
│   ├── services/                     # Servicios externos
│   │   ├── AuthService.js            # Firebase Authentication
│   │   ├── StorageService.js         # Firebase Storage
│   │   ├── NotificationService.js    # Push notifications
│   │   └── EmailService.js           # Envío de emails
│   │
│   └── config/                       # Configuración
│       ├── firebase.config.js        # Config Firebase
│       └── constants.js              # Constantes globales
│
└── presentation/                     # CAPA DE PRESENTACIÓN
    ├── components/                   # Componentes UI
    │   ├── auth/
    │   │   ├── LoginForm.js
    │   │   └── RegisterForm.js
    │   ├── wizard/                   # Wizard de creación
    │   │   ├── WizardContainer.js
    │   │   ├── Step1BasicInfo.js
    │   │   ├── Step2Members.js
    │   │   ├── Step3ElectoralCommission.js
    │   │   ├── Step4Statutes.js
    │   │   ├── Step5Documents.js
    │   │   └── Step6Review.js
    │   ├── dashboard/
    │   │   ├── UserDashboard.js
    │   │   └── ApplicationCard.js
    │   └── admin/
    │       ├── AdminDashboard.js
    │       ├── ApplicationList.js
    │       └── ApplicationReview.js
    │
    ├── pages/                        # Páginas de la aplicación
    │   ├── HomePage.js
    │   ├── LoginPage.js
    │   ├── DashboardPage.js
    │   ├── ApplicationPage.js
    │   └── AdminPage.js
    │
    ├── controllers/                  # Controladores (lógica de presentación)
    │   ├── AuthController.js
    │   ├── ApplicationController.js
    │   └── AdminController.js
    │
    └── routes/                       # Rutas de la aplicación
        └── router.js
```

## 🎯 Entidades del Dominio

### 1. User (Usuario)
Representa a un usuario del sistema (Ciudadano o Administrador Municipal).

**Atributos:**
- `id`: Identificador único
- `email`: Email del usuario
- `password`: Contraseña (hasheada)
- `role`: Rol ('USER' | 'ADMIN')
- `profile`: Información personal (UserProfile)

**Métodos:**
- `validate()`: Valida los datos del usuario
- `isAdmin()`: Verifica si es administrador
- `toJSON()`: Serializa a objeto plano

### 2. Organization (Organización)
Representa una Junta de Vecinos u Organización Comunitaria según Ley 19.418.

**Atributos:**
- `id`: Identificador único
- `name`: Nombre de la organización
- `type`: Tipo ('JUNTA_VECINOS' | 'ORGANIZACION_FUNCIONAL')
- `address`: Dirección
- `commune`: Comuna
- `neighborhood`: Unidad vecinal
- `members`: Lista de miembros
- `status`: Estado ('DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE')

**Métodos:**
- `validate()`: Valida requisitos mínimos
- `hasMinimumMembers()`: Verifica cantidad mínima de miembros
- `addMember()`: Agrega un miembro
- `removeMember()`: Remueve un miembro
- `changeStatus()`: Cambia el estado

### 3. Application (Solicitud)
Representa una solicitud/postulación para formar una organización comunitaria.

**Atributos:**
- `id`: Identificador único
- `userId`: ID del usuario solicitante
- `organizationId`: ID de la organización
- `status`: Estado ('DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED')
- `currentStep`: Paso actual del wizard (1-6)
- `documents`: Lista de documentos adjuntos
- `reviewComments`: Comentarios de revisión

**Métodos:**
- `nextStep()`: Avanza al siguiente paso
- `previousStep()`: Retrocede al paso anterior
- `isComplete()`: Verifica si está completa
- `canBeSubmitted()`: Verifica si puede ser enviada
- `changeStatus()`: Cambia el estado

### 4. Document (Documento)
Representa un documento adjunto a una solicitud.

**Atributos:**
- `id`: Identificador único
- `applicationId`: ID de la solicitud
- `type`: Tipo de documento
- `fileName`: Nombre del archivo
- `fileURL`: URL del archivo
- `status`: Estado ('PENDING' | 'APPROVED' | 'REJECTED')

**Tipos de documentos requeridos:**
- ACTA_CONSTITUTIVA
- ESTATUTOS
- REGISTRO_SOCIOS
- DECLARACION_JURADA_PRESIDENTE
- CERTIFICADO_ANTECEDENTES

### 5. ElectoralCommission (Comisión Electoral)
Representa la Comisión Electoral de una organización (3 miembros con 1+ año de antigüedad).

**Atributos:**
- `id`: Identificador único
- `organizationId`: ID de la organización
- `members`: 3 miembros (exactamente)
- `electionDate`: Fecha de la elección
- `status`: Estado ('DRAFT' | 'ACTIVE' | 'COMPLETED')

## 🔄 Flujo de Trabajo

### Flujo del Usuario (Ciudadano)

```
1. Registro → 2. Login → 3. Crear Solicitud (Wizard 6 pasos) → 4. Enviar → 5. Seguimiento
```

**Wizard de Creación (6 pasos):**

1. **Datos Básicos**: Nombre, tipo, dirección, comuna
2. **Miembros Fundadores**: Listado de socios (mín. 50-200 según comuna)
3. **Comisión Electoral**: 3 miembros con 1+ año antigüedad
4. **Estatutos**: Plantilla pre-llenada o personalizada
5. **Documentos**: Subir archivos requeridos (PDF, DOC, JPG)
6. **Revisión**: Resumen completo antes de enviar

### Flujo del Administrador (Municipalidad)

```
1. Login → 2. Ver Postulaciones → 3. Revisar Documentación → 4. Aprobar/Rechazar/Solicitar Cambios
```

## 🔐 Roles y Permisos

### Usuario (USER)
- Ver sus propias solicitudes
- Crear nuevas solicitudes
- Editar solicitudes en estado DRAFT o REQUIRES_CHANGES
- Subir/eliminar documentos
- Ver estado de postulación

### Administrador (ADMIN)
- Ver todas las solicitudes
- Revisar documentación
- Aprobar/Rechazar solicitudes
- Solicitar correcciones
- Cambiar estado de organizaciones
- Generar reportes

## 🗄️ Base de Datos (Firestore)

### Colecciones

```
users/                          # Usuarios
  {userId}/
    - email
    - role
    - profile
    - createdAt

organizations/                  # Organizaciones
  {orgId}/
    - name
    - type
    - address
    - commune
    - members[]
    - status
    - createdBy
    - createdAt

applications/                   # Solicitudes
  {appId}/
    - userId
    - organizationId
    - status
    - currentStep
    - reviewComments[]
    - submittedAt
    - reviewedAt

documents/                      # Documentos
  {docId}/
    - applicationId
    - type
    - fileName
    - fileURL
    - status
    - uploadedAt
```

## 🔧 Tecnologías

- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Build Tool**: Vite
- **Backend**: Firebase (Firestore + Auth + Storage)
- **PWA**: Service Workers, Web App Manifest
- **Arquitectura**: Clean Architecture

## 📝 Casos de Uso Principales

### Autenticación
- **LoginUser**: Autenticar usuario
- **RegisterUser**: Registrar nuevo usuario
- **LogoutUser**: Cerrar sesión

### Organizaciones
- **CreateOrganization**: Crear organización
- **UpdateOrganization**: Actualizar organización
- **GetOrganizationById**: Obtener organización por ID
- **ChangeOrganizationStatus**: Cambiar estado

### Solicitudes
- **CreateApplication**: Crear solicitud
- **SubmitApplication**: Enviar solicitud
- **ReviewApplication**: Revisar solicitud (admin)
- **UploadDocument**: Subir documento
- **UpdateApplicationStep**: Actualizar paso del wizard

## 🚀 Próximos Pasos

1. ✅ Definir entidades de dominio
2. ✅ Definir interfaces de repositorios
3. ⏳ Implementar casos de uso
4. ⏳ Implementar repositorios Firebase
5. ⏳ Implementar servicios de infraestructura
6. ⏳ Implementar componentes UI
7. ⏳ Implementar wizard de creación
8. ⏳ Implementar dashboard de usuario
9. ⏳ Implementar panel de administración
10. ⏳ Testing y deployment

## 📚 Referencias

- [Ley 19.418 - Juntas de Vecinos](https://www.bcn.cl/leychile/navegar?idNorma=30786)
- [Clean Architecture - Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Firebase Documentation](https://firebase.google.com/docs)
