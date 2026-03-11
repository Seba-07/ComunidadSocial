# CLAUDE.md — ComunidadSocial

## Stack
Híbrido Vanilla JS + React coexistiendo:
- `index.html` + `main.js` → app vanilla JS (org dashboard, member dashboard, biblioteca, noticias)
- `react-app.html` + `src/react/main.jsx` → app React (login, wizard, admin, org pages)

Backend: Express + MongoDB (Mongoose). JWT en HttpOnly cookies + Bearer header como fallback.
Roles: ORGANIZADOR, MIEMBRO, MIEMBRO_DIRECTIVO, MUNICIPALIDAD, MINISTRO_FE.

## Navegación
- Vanilla: `appState.navigateTo('pagename')` → muestra/oculta divs `#page-pagename`
- React: React Router con rutas `/app/login`, `/app/wizard`, `/app/org/:id`
- Puente entre ambos: `localStorage` (keys: `currentUser`, `isAuthenticated`,
  `user_organizations`, `wizard_progress`, `sidebar-collapsed`)

## Path aliases (usar siempre, no rutas relativas)
- `@services/` → `src/services/`
- `@react/` → `src/react/`
- `@shared/` → `src/shared/`

## Archivos PELIGROSOS — no tocar sin avisar
| Archivo | Por qué |
|---|---|
| `src/services/ApiService.js` | Todo HTTP pasa por acá. Si falla, nada funciona |
| `src/app.js` | Singleton appState: navegación, auth, UI vanilla |
| `main.js` | Entry point vanilla (~5,400 líneas) |
| `src/presentation/organization/OrganizationDashboard.js` | Monolito de ~5,900 líneas |
| `server/routes/organizations.js` | CRUD orgs, quórum, miembros (~2,885 líneas) |
| `server/models/Organization.js` | Schema core usado por 9+ rutas |
| `server/middleware/auth.js` | Si falla, nadie entra |
| `src/shared/utils/index.js` | Formateo RUT, fechas, tipos — usado en todas partes |
| `styles.css` | CSS global sin scope (~13,000 líneas) |
| `server/middleware/validation.js` | Schemas Zod — si falla, datos corruptos entran a MongoDB |

## Convenciones obligatorias
- Servicios exportan instancia, no clase: `export const organizationsService = new OrganizationsService()`
- Validación en rutas nuevas: siempre usar `validate(schema)` como middleware
- RUT: pipeline `cleanRut() → validateRut() → formatRut()`. Retorna `{ valid, message, formatted }`, no booleano
- Respuestas del server: siempre `{ message, data }` o `{ error }`. Nunca ambos
- CSS: no crear módulos CSS. Seguir BEM-ish en styles.css. Estado con `.show`, `.active`, `.open`
- Modals en React: inline styles, no CSS classes. Click-outside con `e.target === e.currentTarget`
- Commits: verbo imperativo + objeto, sin prefijos `feat:/fix:`. Incluir refs legales si aplica
- **Al terminar una tarea**: siempre hacer commit. Reglas de push:
  - **Push por defecto**: siempre a `develop`. Nunca a `main`.
  - **PROHIBIDO pushear a `main`** (producción) a menos que el usuario lo pida **explícitamente** en ese momento. No asumir permisos previos, no inferir intención. Si hay duda, preguntar.
  - Si el usuario pide deploy a producción, confirmar antes: "¿Confirmo push a main (producción)?"

## Errores comunes a evitar
1. Crear componente React con clases CSS nuevas sin revisar conflictos con styles.css
2. Modificar ApiService asumiendo que solo afecta React (lo usan vanilla + React)
3. Cambiar un campo en Organization model sin actualizar las 9+ rutas que lo consumen
4. Duplicar lógica de RUT: ya existe en `rutValidator.js` (server) y `formatRut` (shared/utils)
5. Usar imports relativos en vez de los aliases `@services/`, `@react/`, `@shared/`
6. Crear rutas nuevas sin `validate(schema)` → datos sin validar llegan a MongoDB
7. Asumir que solo React maneja auth: `main.js` también lee localStorage

## Comandos
```bash
# Frontend (raíz)
npm run dev        # Vite en localhost:5173
npm run build      # Build producción → /dist
npm test           # Vitest
npm run lint       # ESLint

# Backend (desde server/)
cd server
npm run dev        # Node --watch en localhost:3001
npm test           # Vitest + supertest
npm run seed       # Seed datos iniciales
npm run optimize-indexes  # Optimizar índices MongoDB
```

## Estado de features
| Feature | Estado | Detalle |
|---|---|---|
| Objetivos Sugeridos | Completado | Pestaña admin + wizard dinámico (commit 93647d0) |
| TTL Notificaciones | Completado | Index TTL 90 días en `Notification.js` + 365 días en `AuditLog.js` |
| Auditoría de índices | Completado | Script `optimize-indexes.js` reduce 89→83 índices |
| Ley 21.719 compliance | Completado | 10 fases implementadas (ARCOP, masking, consent, incidents, retention) |
| Migración Base64 → S3 | Infra lista, NO activada | `s3Service.js` + `storageService.js` + script migración listos. Falta configurar credenciales AWS en Railway |
| Limpieza Organization model | Parcial (~70%) | Schema refactoreado con campos `DEPRECATED`. Falta ejecutar `migrate-to-normalized.js` en DB |
| `.env` con credenciales AWS | Activo | Necesitan rotación — NUNCA commitear |

## Modo paralelo con worktrees
Para trabajar en múltiples tareas simultáneas:
```bash
# Crear worktrees desde la raíz
git worktree add ../comunidad-tarea1 -b fix/nombre-tarea1
git worktree add ../comunidad-tarea2 -b fix/nombre-tarea2

# Cada terminal trabaja en su carpeta
cd ../comunidad-tarea1 && claude --dangerously-skip-permissions
cd ../comunidad-tarea2 && claude --dangerously-skip-permissions

# Al terminar, mergear y limpiar
git merge fix/nombre-tarea1
git worktree remove ../comunidad-tarea1
```

### Reglas para --dangerously-skip-permissions
- ✅ Usarlo solo cuando el proyecto está commiteado en Git (podés revertir cualquier cosa)
- ✅ Más seguro usarlo en worktrees que en la rama principal
- ❌ No usarlo en carpetas con archivos importantes fuera del proyecto (ej: Desktop general)
