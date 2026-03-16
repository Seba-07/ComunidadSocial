# FASE 23: Parche de Quorum, Enlaces Historicos y Registro Extralegal

> Ultima actualizacion: 2026-03-16

---

## Tarea 2: Correccion Critica de Quorum

### Estado: COMPLETADO

**Bug:** `Step2_Members.jsx:51` usaba fallback de 200 miembros para JUNTA_VECINOS en vez de 50.

**Correccion:** Cambiado `200` → `50` en el fallback del wizard. Ahora coincide con el backend (`seed-estatutos.js: miembrosMinimos: 50`).

**Regla final:**
- Junta de Vecinos: 50 miembros minimo
- Resto de organizaciones: 15 miembros minimo

---

## Tarea 3: Historico Digital (legacyDriveLink)

### Estado: COMPLETADO

| Archivo | Cambio |
|---|---|
| `server/models/Organization.js` | Nuevo campo `legacyDriveLink: String` (opcional, trim) |
| `server/middleware/security.js` | Agregado `legacyDriveLink` a ALLOWED_FIELDS.organization |
| `src/react/pages/OrganizationDashboard/OrgOverview.jsx` | Componente `LegacyDriveSection` con 3 estados: sin link (formulario para agregar), con link (boton "Abrir Carpeta" + "Editar"), editando (formulario inline) |
| `src/react/pages/OrganizationDashboard/OrgDashboardPage.jsx` | Pasado prop `onRefresh` a OrgOverview |

**Permisos:** Solo el owner de la org o MUNICIPALIDAD pueden agregar/editar el link.
**UI:** Boton azul "Abrir Carpeta" con icono de enlace externo + boton "Editar".

---

## Tarea 4: Tipos de Organizacion (Registro Extralegal)

### Estado: COMPLETADO

| Archivo | Cambio |
|---|---|
| `server/models/EstatutoTemplate.js` | Agregados `CONDOMINIO`, `FUNDACION`, `CORPORACION` al array TIPOS_ORGANIZACION |
| `server/models/EstatutoTemplate.js` | Nuevo campo `isLey19418: Boolean` (default true). Los tipos extralegales deben crearse con `isLey19418: false` |
| `src/react/pages/OrganizationDashboard/OrgOverview.jsx` | Agregados labels: Condominio, Fundacion, Corporacion a TYPE_LABELS |

**Flag `isLey19418`:** Cuando se creen templates para estos tipos, se deben marcar con `isLey19418: false` para que el sistema sepa que no aplican plazos ni reglas estrictas de la Ley 19.418.

---

## Archivos Modificados

- `server/models/Organization.js` — +1 campo
- `server/models/EstatutoTemplate.js` — +3 tipos, +1 campo
- `server/middleware/security.js` — +1 allowed field
- `src/react/pages/Wizard/steps/Step2_Members.jsx` — fix quorum
- `src/react/pages/OrganizationDashboard/OrgOverview.jsx` — drive link UI + tipos
- `src/react/pages/OrganizationDashboard/OrgDashboardPage.jsx` — onRefresh prop
