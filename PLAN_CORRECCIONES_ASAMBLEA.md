# Plan de Correcciones: Asamblea Post-Implementación

## Estado: COMPLETADO
## Fecha inicio: 2026-03-04
## Fecha cierre: 2026-03-04
## Vulnerabilidades totales: 14 (6 críticas, 4 importantes, 4 menores)

> **NOTA DE CONTEXTO**: Si pierdes el contexto de la conversación, lee este archivo completo
> (`PLAN_CORRECCIONES_ASAMBLEA.md` en la raíz del proyecto) para saber exactamente dónde
> quedamos. Las tareas marcadas con `[x]` ya están implementadas. Continúa con la siguiente
> tarea `[ ]` pendiente según el ORDEN DE EJECUCIÓN al final del archivo.

---

## P0 — CORRECCIONES CRÍTICAS (Antes de producción)

### V-01: Correlación por índice en voto secreto (ALTA)
**Problema**: `voterRegistry[i]` y `anonymousVotes[i]` se insertan secuencialmente en la misma request. Si los votos llegan uno a uno, el índice `i` vincula identidad con voto, rompiendo el secreto (Art. 24 Ley 19.418).
**Solución**: Insertar `anonymousVotes` en posición aleatoria dentro del array existente, no siempre al final.

- [x] **V-01a**: Modificar endpoint POST `/vote` en `server/routes/organizations.js`
  - Cambiar `agendaItem.anonymousVotes.push(...)` por inserción en índice aleatorio: `splice(randomIndex, 0, voteObj)`
  - Notas de implementación:
    ```
    Cambiado push() por splice(Math.floor(Math.random()*(length+1)), 0, voteObj).
    Cada voto anónimo se inserta en posición aleatoria dentro del array existente.
    Comentario explícito referenciando Art. 24 Ley 19.418.
    ```

- [x] **V-01b**: Verificar que el orden de `anonymousVotes` no afecta el tally en `finalize`
  - El conteo en finalize usa `.forEach()` sobre anonymousVotes — no depende del orden
  - Notas de implementación:
    ```
    Verificado: líneas 2123-2139 (per_cargo) y 2155-2163 (per_lista) usan forEach
    para contar en objetos map (votesByCargo/votesByLista). Orden del array irrelevante.
    ```

---

### V-03: Export CSV — filtro de tipo roto (CRÍTICO)
**Problema**: `item.type === 'election'` nunca matchea `'eleccion_directorio'` — el export de resultados electorales siempre está vacío.
**Solución**: Corregir el filtro y actualizar el acceso a datos.

- [x] **V-03a**: Corregir filtro en `server/routes/organizations.js` endpoint `/export/election-results`
  - Cambiar `item.type === 'election' || item.type === 'votacion'` → `item.type === 'eleccion_directorio'`
  - Notas de implementación:
    ```
    Endpoint completamente reescrito. Ahora filtra items por item.result (cualquier item con resultado).
    Usa assemblyService.findAssembly() en vez de buscar en org.assemblies embebido.
    Soporta los 3 modos: per_cargo, per_lista, mano_alzada.
    ```

---

### V-04: Export CSV — campo de votos inexistente (CRÍTICO)
**Problema**: Accede a `candidate.votes` (campo por candidato que no existe). El modelo actual usa `anonymousVotes[]` y `result.winners`.
**Solución**: Reescribir la lógica de export para leer de `agendaItem.result` (winners, votesByCargo, votesByLista) y soportar mano_alzada.

- [x] **V-04a**: Reescribir sección de election items en export CSV
  - Leer de `item.result.mode` para determinar formato
  - `per_cargo`: iterar `item.result.winners` y `item.result.votesByCargo`
  - `per_lista`: mostrar `item.result.winningLista`, `item.result.votesByLista`
  - `mano_alzada`: mostrar resolución, votosAFavor, votosEnContra, abstenciones, observaciones
  - Notas de implementación:
    ```
    Reescritura completa del endpoint. Lee de item.result según mode.
    per_cargo: itera votesByCargo con winners para marcar ELECTO.
    per_lista: muestra votesByLista + candidatos de lista ganadora.
    mano_alzada: fila con resolución, votos y observaciones.
    Fallback: si no hay items con resultado, busca eleccion_directorio sin finalizar.
    También corregido: directorio section ahora soporta llaves español/inglés.
    ```

- [x] **V-04b**: Agregar sección de quórum al CSV
  - Incluir: quorumType, quorumValue, attendees.length, quórum cumplido sí/no
  - Notas de implementación:
    ```
    Sección "QUÓRUM" agregada al header del CSV con: tipo, valor configurado,
    miembros totales, asistentes, requeridos, quórum cumplido SÍ/NO.
    Usa checkQuorum() helper.
    ```

---

### V-05: Check-in manual no normaliza RUT (ALTA)
**Problema**: `POST /checkin` compara `a.rut === attendeeRut` sin normalizar (sin strip dots/dashes). Un socio puede aparecer 2 veces si el RUT se envía con formato diferente (ej: `17.405.314-6` vs `17405314-6`).
**Solución**: Aplicar la misma normalización que usa el endpoint QR.

- [x] **V-05a**: Agregar normalización RUT en endpoint `POST /checkin` (`server/routes/organizations.js`)
  - Extraer helper `normalizeRut(rut)` → `rut.replace(/\./g, '').replace(/-/g, '').toUpperCase()`
  - Usar en comparación de duplicados del checkin manual
  - Notas de implementación:
    ```
    Helper normalizeRut() creado en línea 59. Aplicado en checkin manual.
    También refactorizado checkin-qr para usar el helper (DRY): duplicado check + membership check.
    ```

- [x] **V-05b**: Aplicar mismo `normalizeRut()` en el endpoint `/vote` para la verificación de duplicados en voterRegistry
  - Notas de implementación:
    ```
    Aplicado: normaliza tanto voterRegistry como votes legacy antes de comparar.
    ```

---

### V-06: Acta PDF no incluye constancia de quórum (CRÍTICO LEGAL)
**Problema**: Art. 7 Ley 19.418 exige constancia de quórum en el acta. El PDF actual deja el campo de asistencia en blanco.
**Solución**: Modificar `generateActaHTML()` para incluir datos de quórum y asistencia cuando la asamblea está finalizada.

- [x] **V-06a**: Modificar `generateActaHTML(org)` en `server/routes/documents.js`
  - Recibir segundo parámetro opcional `assembly`
  - Si assembly existe: llenar automáticamente total asistentes, quórum requerido, quórum cumplido
  - Si no existe: mantener campos en blanco (para actas pre-asamblea)
  - Notas de implementación:
    ```
    Firma cambiada a generateActaHTML(org, assembly = null).
    Sección PRIMERO: si hay assembly, autocompleta total asistentes en negrita.
    Si no hay assembly, mantiene "______" como antes.
    ```

- [x] **V-06b**: Actualizar endpoint `GET /generate-acta` para buscar asamblea finalizada de la org
  - Buscar `Assembly.findOne({ organizationId, status: 'finalizada' }).sort({ finishedAt: -1 })`
  - Pasar a `generateActaHTML(org, assembly)`
  - Notas de implementación:
    ```
    Agregados imports: Assembly model y assemblyService.
    Endpoint generate-acta: busca asamblea finalizada más reciente con .lean().
    Endpoint preview-acta: misma búsqueda.
    Pasan assembly a generateActaHTML como segundo arg.
    ```

- [x] **V-06c**: Incluir en sección PRIMERO del acta:
  - "Con la asistencia de [N] socios de un total de [M] miembros hábiles"
  - "Verificado el quórum reglamentario de [X]% ([R] socios requeridos), se declara el quórum [cumplido/no cumplido]"
  - Hora de inicio y cierre: `assembly.startedAt`, `assembly.finishedAt`
  - Notas de implementación:
    ```
    Sección PRIMERO renombrada a "PRIMERO: ASISTENCIA Y QUÓRUM".
    Párrafo de quórum con cálculo inline: totalMembers, percentage, required, met CUMPLIDO/NO CUMPLIDO.
    Sección TERCERO: si hay assembly con resultado mano_alzada en estatutos, muestra APROBADO/RECHAZADO + conteos.
    Sección QUINTO: hora de cierre desde assembly.finishedAt con toLocaleTimeString.
    ```

---

### V-07: No existe Acta de Escrutinio PDF (CRÍTICO LEGAL)
**Problema**: No hay documento PDF que detalle los resultados de votación. Art. 24 Ley 19.418 exige acta de escrutinio.
**Solución**: Crear nueva función `generateActaEscrutinioHTML(org, assembly)` y endpoint correspondiente.

- [x] **V-07a**: Crear función `generateActaEscrutinioHTML(org, assembly)` en `server/routes/documents.js`
  - Secciones del documento:
    1. Encabezado: nombre org, tipo asamblea, fecha, lugar
    2. Quórum: asistentes, requerido, método de verificación (manual/QR)
    3. Por cada agendaItem con resultado:
       - `per_cargo`: tabla cargo | candidato | votos | resultado (ELECTO/no electo)
       - `per_lista`: tabla lista | votos | resultado (GANADORA/perdedora), luego detalle de candidatos
       - `mano_alzada`: resolución, votos a favor, en contra, abstenciones, observaciones
    4. Directorio electo (si aplica)
    5. Firmas: Presidente mesa, Secretario, Ministro de Fe
  - Notas de implementación:
    ```
    Función completa creada (~120 líneas HTML). Incluye:
    - Info grid con tipo asamblea, fecha, inicio/cierre
    - Sección quórum con badge CUMPLIDO/NO CUMPLIDO, desglose manual/QR
    - Iteración sobre agendaItems con resultado, switch por mode
    - per_cargo: tabla con todos los candidatos, filas ganadoras en verde
    - per_lista: tabla listas + tabla candidatos ganadores
    - mano_alzada: tabla resolución con fondo verde/rojo + observaciones
    - Directorio resultante con soporte llaves español/inglés
    - Footer con referencia Art. 24 Ley 19.418
    Estilo: Arial, tablas con header azul #1e40af, A4 2cm margins
    ```

- [x] **V-07b**: Crear endpoint `GET /api/documents/:orgId/generate-acta-escrutinio/:assemblyId`
  - Auth: owner, MUNICIPALIDAD, directivo
  - Buscar asamblea por ID, verificar status 'finalizada'
  - Generar HTML, convertir a PDF con Puppeteer
  - Notas de implementación:
    ```
    Endpoint creado. Busca por _id o legacyId. Valida status === 'finalizada'.
    Genera PDF con Puppeteer, filename: Acta_Escrutinio_{org}_{assemblyId}.pdf
    ```

- [x] **V-07c**: Crear endpoint `GET /api/documents/:orgId/preview-acta-escrutinio/:assemblyId`
  - Retorna HTML sin convertir a PDF (para preview en browser)
  - Notas de implementación:
    ```
    Endpoint creado. Misma lógica sin restricción de status (permite preview pre-finalización).
    Retorna Content-Type: text/html.
    ```

---

## P1 — CORRECCIONES IMPORTANTES (Cumplimiento legal)

### V-08: No existe Lista de Asistencia PDF (ALTA LEGAL)
**Problema**: Art. 7 Ley 19.418 exige lista de asistencia adjunta al acta. Actualmente no hay PDF de asistentes.
**Solución**: Crear función de generación y endpoint.

- [x] **V-08a**: Crear función `generateListaAsistenciaHTML(org, assembly)` en `server/routes/documents.js`
  - Tabla con columnas: N° | Nombre Completo | RUT | Hora Check-in | Método (Manual/QR) | Firma
  - Footer: total asistentes, quórum info
  - Notas de implementación:
    ```
    Función completa creada. Tabla con 6 columnas incluyendo método (Manual/QR/Digital).
    Filas alternadas con fondo gris. Summary box con total, quórum requerido, badge CUMPLIDO/NO CUMPLIDO.
    Estilo: Arial 10pt, tablas 9pt para caber más filas en A4.
    ```

- [x] **V-08b**: Crear endpoint `GET /api/documents/:orgId/generate-lista-asistencia/:assemblyId`
  - Notas de implementación:
    ```
    Endpoint PDF + endpoint preview creados.
    Busca por _id o legacyId. Sin restricción de status (permite generar durante asamblea en_curso).
    Filename: Lista_Asistencia_{org}_{assemblyId}.pdf
    ```

---

### V-09: Mismatch de llaves directorio wizard vs server (MEDIA)
**Problema**: Wizard Step5 guarda `{ presidente, secretario, tesorero }` (español). El server documents.js lee `{ president, secretary, treasurer }` (inglés). Actas generadas pre-asamblea pueden tener directorio vacío.
**Solución**: Normalizar en `generateActaHTML` para aceptar ambos formatos.

- [x] **V-09a**: Agregar mapeo bidireccional en `generateActaHTML()` (`server/routes/documents.js`)
  - Si `org.provisionalDirectorio.president` no existe, buscar `org.provisionalDirectorio.presidente`
  - Mapeo: presidente↔president, secretario↔secretary, tesorero↔treasurer, vicepresidente↔vicePresident
  - Notas de implementación:
    ```
    Cambiado acceso directo por variables con fallback:
    const president = directorio.president || directorio.presidente;
    const vicePresident = directorio.vicePresident || directorio.vicepresidente;
    const secretary = directorio.secretary || directorio.secretario;
    const treasurer = directorio.treasurer || directorio.tesorero;
    Aplicado en generateActaHTML, generateActaEscrutinioHTML, y export CSV.
    ```

---

### V-10: No se valida candidateRut en endpoint de voto (MEDIA)
**Problema**: `POST /vote` acepta cualquier `candidateRut` sin verificar que exista en `agendaItem.candidates[]`. Permite votos fantasma.
**Solución**: Validar cada voto contra la lista de candidatos.

- [x] **V-10a**: Agregar validación en endpoint `/vote` (`server/routes/organizations.js`)
  - Para cada voto en `req.body.votes`:
    - Si `vote.candidateRut`: verificar que existe en `agendaItem.candidates.some(c => c.rut === vote.candidateRut)`
    - Si `vote.lista`: verificar que existe en `agendaItem.candidates.some(c => c.lista === vote.lista)`
  - Retornar HTTP 400 si algún candidato no es válido
  - Notas de implementación:
    ```
    Validación agregada antes del registro de voterRegistry.
    Loop sobre votes[]: verifica candidateRut y lista contra agendaItem.candidates.
    HTTP 400 con mensaje específico si candidato o lista no existe.
    ```

---

### V-13: Race condition en toggle-voting (MEDIA)
**Problema**: Sin mutex, 2 requests simultáneas podrían doble-toggle la votación (abrir y cerrar en la misma fracción de segundo).
**Solución**: Guard temporal para prevenir toggles rápidos.

- [x] **V-13a**: Agregar guard temporal en endpoint `toggle-voting`
  - Si votingClosedAt existe y han pasado menos de 2 segundos, rechazar con HTTP 429
  - Notas de implementación:
    ```
    Guard agregado antes del check de quórum. Si agendaItem.votingClosedAt existe
    y elapsed < 2000ms, retorna 429 "Acción demasiado rápida, espere un momento".
    Previene double-toggle por requests concurrentes sin necesidad de mutex.
    ```

---

## P2 — MEJORAS MENORES (Hardening)

### V-02: Sin rate limiting en endpoint QR (MEDIA)
**Problema**: Solo hay cooldown frontend (2s). Sin rate limit server-side, susceptible a enumeración de tokens UUID por fuerza bruta.
**Solución**: Agregar rate limiting al endpoint de check-in QR.

- [x] **V-02a**: Agregar rate limiter al endpoint `/checkin-qr`
  - Notas de implementación:
    ```
    Creado qrCheckinLimiter en server/middleware/security.js:
    - 30 requests por minuto por IP (suficiente para check-in rápido, bloquea brute force)
    - Mensaje en español: "Demasiados escaneos QR. Espere un momento."
    Importado y aplicado como middleware en router.post checkin-qr (antes de authenticate).
    ```

---

### V-11: Resultado mano alzada no aparece en documentos (BAJA)
**Problema**: Los resultados de votación a mano alzada no se reflejan en ningún PDF descargable.
**Solución**: Ya cubierto por V-07 (Acta de Escrutinio incluirá resultados mano_alzada).

- [x] **V-11a**: Cubierto por V-07a — el Acta de Escrutinio incluirá sección para mano_alzada
  - Notas de implementación:
    ```
    Resuelto automáticamente al implementar V-07a que contempla los 3 modos de votación.
    ```

---

### V-12: QR tokens nunca expiran (BAJA)
**Problema**: Si un QR es fotografiado por un tercero, puede ser usado indefinidamente.
**Solución**: Agregar expiración opcional o rotación periódica.

- [x] **V-12a**: Agregar campo `qrTokenGeneratedAt` en User schema
  - Permite política futura de expiración sin cambio breaking
  - Notas de implementación:
    ```
    Campo qrTokenGeneratedAt: { type: Date, default: null } agregado en server/models/User.js.
    Endpoint generate-qr-token en users.js actualizado: guarda fecha y la retorna en response.
    ```

- [x] **V-12b**: Agregar validación de expiración en endpoint `/checkin-qr`
  - Si `qrTokenGeneratedAt + TTL < now` → HTTP 410 "Credencial QR expirada, regenere desde su perfil"
  - TTL: 365 días
  - Notas de implementación:
    ```
    Validación activa en checkin-qr endpoint. TTL = 365 días (1 año).
    Si qrTokenGeneratedAt existe y ha pasado más de 1 año → HTTP 410 Gone.
    Tokens sin qrTokenGeneratedAt (generados antes de este cambio) no expiran (backward compat).
    ```

---

### V-14: Quórum cumplido con 0 miembros (BAJA)
**Problema**: Org con `members.length === 0` y quorumType `percentage` → `ceil(0 * 50/100) = 0` → quórum cumplido con nadie presente.
**Solución**: Agregar guard en `checkQuorum()`.

- [x] **V-14a**: Agregar validación en `checkQuorum()` (`server/routes/organizations.js`)
  - Si `totalMembers === 0` → retornar `{ met: false, message: 'No hay miembros registrados en la organización' }`
  - Si `quorumValue === 0` (configuración inválida) → retornar `{ met: false, message: 'Valor de quórum no configurado' }`
  - Notas de implementación:
    ```
    Guard totalMembers===0 ya existía. Agregados 2 guards para quorumValue<=0:
    - Modo percentage: retorna met:false, required:1
    - Modo number: retorna met:false, required:1
    Ambos con mensaje descriptivo que indica que debe ser mayor a 0.
    ```

---

## RESUMEN DE PROGRESO

| Prioridad | Total tareas | Completadas | Pendientes |
|-----------|-------------|-------------|------------|
| P0 — Críticas | 12 | 12 | 0 |
| P1 — Importantes | 4 | 4 | 0 |
| P2 — Menores | 4 | 4 | 0 |
| **TOTAL** | **20** | **20** | **0** |

---

## ARCHIVOS MODIFICADOS

| Archivo | Vulnerabilidades | Cambios |
|---------|-----------------|---------|
| `server/routes/organizations.js` | V-01, V-03, V-04, V-05, V-10, V-13, V-14 | normalizeRut helper, inserción aleatoria votes, validación candidatos, reescritura CSV export, guard quórum, guard toggle, rate limiter QR, expiración QR |
| `server/routes/documents.js` | V-06, V-07, V-08, V-09 | Imports Assembly+assemblyService, generateActaHTML con assembly param, quórum en PRIMERO, mano_alzada en TERCERO, hora cierre en QUINTO, fallback llaves ES/EN directorio, generateActaEscrutinioHTML (NUEVO), generateListaAsistenciaHTML (NUEVO), 4 endpoints nuevos (generate+preview para escrutinio y asistencia) |
| `server/models/User.js` | V-12 | Campo qrTokenGeneratedAt |
| `server/routes/users.js` | V-12 | Guardar qrTokenGeneratedAt al generar token |
| `server/middleware/security.js` | V-02 | qrCheckinLimiter (30/min) |

---

## FASE 4: Robustecimiento Legal de Estatutos (10 → 14 Artículos)

### Estado: EN PROGRESO
### Fecha inicio: 2026-03-04

> **Objetivo**: Expandir los estatutos de 10 artículos genéricos a 14 artículos con texto legal
> completo basado en Ley 19.418. Agregar 4 artículos nuevos, ampliar placeholders de 8 a 19,
> y mejorar el wizard con objetivos sugeridos y nuevos campos de configuración.

### Artículos NUEVOS: 5 (Pérdida Calidad Socio), 7 (Funciones Directivos), 9 (Citaciones/Quórum), 10 (Comisión Revisora Cuentas)

---

### E1: Plan de Trabajo
- [x] **E1a**: Agregar sección FASE 4 a este archivo con checkboxes

### A — Backend (Seed + Migración)
- [x] **A1**: Actualizar `ARTICULOS_BASE` en `server/scripts/seed-estatutos.js` (10 → 14 artículos con texto legal completo)
- [x] **A2**: Actualizar `PLACEHOLDERS_BASE` en `server/scripts/seed-estatutos.js` (8 → 19 placeholders)
- [x] **A3**: Crear script `server/scripts/reseed-estatutos-v14.js` para migrar 34 templates existentes en BD

### B — WizardStore + Step 3 Config
- [x] **B1**: Actualizar `src/react/stores/wizardStore.js` — agregar 5 campos a config + objectives a organization + fix merge profundo
- [x] **B2**: Actualizar `src/react/pages/Wizard/steps/Step3_Config.jsx` — 5 nuevos inputs (duración mandato, método citación, días anticipación, cuota inc., RUT disolución)

### C — Step 1 Objetivos Sugeridos
- [x] **C1**: Agregar constante `OBJETIVOS_SUGERIDOS` con mapa tipo→objetivos en `Step1_OrgData.jsx`
- [x] **C2**: Agregar UI de checkboxes + textarea personalizado en `Step1_OrgData.jsx`

### D — Step 4 Placeholder Replacement
- [x] **D1**: Expandir `replacePlaceholders()` en `Step4_Estatutos.jsx` de 7 a 19 sustituciones + backward compat doble/simple llave

---

## FASE 5: Lógica Dinámica de Directorios y Mandatos

### Estado: COMPLETADO
### Fecha: 2026-03-04

> **Objetivo**: Configurar duración de mandato y tipo de directorio (provisorio vs definitivo)
> por tipo de organización según Ley 19.418 y normativas específicas. Permitir al admin
> gestionar estos campos y reflejar dinámicamente en el wizard.

### Reglas implementadas

| Tipo de Organización | mandatoTipo | mandatoOpciones | requiereDirectorioProvisorio |
|----------------------|-------------|-----------------|------------------------------|
| Regla general (Ley 19.418) | fijo | [3] | true |
| CENTRO_ESTUDIANTES, CONSEJO_ESCOLAR | fijo | [1] | false |
| CENTRO_PADRES | variable | [1, 2] | false |
| ORG_INDIGENA | variable | [2, 3, 4] | false |
| CLUB_DEPORTIVO | variable | [1, 2, 3, 4] | true |

### Tareas

#### Schema + Rutas
- [x] **F5-01**: Agregar campos `mandatoTipo`, `mandatoOpciones`, `requiereDirectorioProvisorio` al schema `EstatutoTemplate.js`
- [x] **F5-02**: Actualizar `crearVersion()`, `obtenerSnapshot()`, `getDefaultConfig()` con nuevos campos
- [x] **F5-03**: Actualizar rutas GET config, PUT, POST, restore, duplicate en `estatutoTemplates.js`

#### Migración
- [x] **F5-04**: Crear y ejecutar `server/scripts/seed-mandato-config.js` — 37 templates actualizados

#### Admin UI
- [x] **F5-05**: Secciones colapsables por categoría en lista de plantillas (`EstatutosManagerView.jsx`)
- [x] **F5-06**: Controles de mandatoTipo (fijo/variable), mandatoOpciones, y requiereDirectorioProvisorio en pestaña Directorio

#### Wizard
- [x] **F5-07**: Step 3 — Duración de mandato dinámica: input deshabilitado si fijo, dropdown si variable
- [x] **F5-08**: Step 5 — Títulos dinámicos: "Directorio Provisorio" vs "Directorio Definitivo" según `requiereDirectorioProvisorio`

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `server/models/EstatutoTemplate.js` | 3 campos nuevos en schema, snapshot, config |
| `server/routes/estatutoTemplates.js` | Nuevos campos en GET, PUT, POST, restore, duplicate |
| `server/scripts/seed-mandato-config.js` | Script de migración (NUEVO) |
| `src/react/pages/Admin/views/EstatutosManagerView.jsx` | Secciones colapsables + controles mandato en Directorio tab |
| `src/react/pages/Wizard/steps/Step3_Config.jsx` | Duración mandato dinámica (fijo/variable) |
| `src/react/pages/Wizard/steps/Step5_Directorio.jsx` | Títulos dinámicos provisorio/definitivo |

---

## FASE 6: Motor de Plantillas de Documentos PDF

### Estado: COMPLETADO
### Fecha inicio: 2026-03-04

> **Objetivo**: Centralizar el diseño de los PDFs (Acta Constitutiva, Lista de Socios, etc.) en un
> gestor administrable con placeholders dinámicos (`{{NOMBRE_ORG}}`, `{{PRESIDENTE}}`, etc.).
> Asignar plantillas por tipo de organización y usarlas en el Paso 6 del Wizard.

### Tarea 1: Plan de Trabajo
- [x] **F6-01**: Agregar sección FASE 6 a este archivo

### Tarea 2: Backend — Modelo + Rutas + Seeder
- [x] **F6-02**: Crear modelo `server/models/DocumentTemplate.js` (name, documentType, content, placeholders, isDefault)
- [x] **F6-03**: Agregar 4 campos `*TemplateId` a `server/models/EstatutoTemplate.js` + actualizar snapshot/config
- [x] **F6-04**: Crear rutas CRUD `server/routes/documentTemplates.js` (GET/POST/PUT/DELETE + duplicate)
- [x] **F6-05**: Registrar rutas en `server/index.js`
- [x] **F6-06**: Crear seeder `server/scripts/seed-document-templates.js` (4 plantillas acta_constitutiva)

### Tarea 3: Frontend — Panel Admin (Gestor Central)
- [x] **F6-07**: Crear `src/react/pages/Admin/views/DocumentTemplatesView.jsx` (lista + editor CRUD con tabs General/Contenido/Preview)
- [x] **F6-08**: Registrar en `AdminLayout.jsx` (menu item) y `AdminDashboardPage.jsx` (VIEW_MAP)
- [x] **F6-09**: Agregar métodos en `src/services/ApiService.js` (getDocumentTemplatePublic, getDocumentTemplatesByType)

### Tarea 4: Frontend — Asignación en EstatutosManagerView
- [x] **F6-10**: Tab "Documentos" con 4 selects en `EstatutosManagerView.jsx`
- [x] **F6-11**: Actualizar ruta PUT de `estatutoTemplates.js` para aceptar `*TemplateId`

### Tarea 5: Impacto en Wizard (Paso 6) y PDFService
- [x] **F6-12**: Motor de reemplazo `generateFromTemplate()` en `src/services/PDFService.js`
- [x] **F6-13**: Cargar plantillas en `Step6_Review.jsx` y construir datos de reemplazo (22 placeholders)
- [x] **F6-14**: Mantener backward compat (sin template → texto hardcodeado actual)

### Archivos nuevos/modificados

| Archivo | Cambios |
|---------|---------|
| `server/models/DocumentTemplate.js` | **NUEVO** — modelo Mongoose |
| `server/models/EstatutoTemplate.js` | 4 campos *TemplateId, snapshot, config |
| `server/routes/documentTemplates.js` | **NUEVO** — CRUD admin |
| `server/routes/estatutoTemplates.js` | Aceptar *TemplateId en PUT |
| `server/index.js` | Import + app.use nueva ruta |
| `server/scripts/seed-document-templates.js` | **NUEVO** — seeder 4 plantillas |
| `src/services/ApiService.js` | 6 métodos CRUD |
| `src/services/PDFService.js` | generateFromTemplate() + backward compat |
| `src/react/pages/Admin/AdminLayout.jsx` | Menu item "Plantillas Docs" |
| `src/react/pages/Admin/AdminDashboardPage.jsx` | Lazy import + VIEW_MAP |
| `src/react/pages/Admin/views/DocumentTemplatesView.jsx` | **NUEVO** — CRUD view |
| `src/react/pages/Admin/views/EstatutosManagerView.jsx` | Tab "Documentos" con selects |
| `src/react/pages/Wizard/steps/Step6_Review.jsx` | Cargar templates + pasar a PDFService |

---

## FASE 7: Funcionalidad de Retractar Solicitud y Trazabilidad

### Estado: COMPLETADO
### Fecha inicio: 2026-03-04
### Fecha cierre: 2026-03-04

> **Objetivo**: Permitir al organizador retractar/cancelar una solicitud de constitución
> enviada a la municipalidad, siempre que la asamblea no se haya realizado. Mantener
> trazabilidad completa y notificar a admin y ministro de fe.

### Tareas

#### Backend
- [x] **F7-01**: Crear endpoint `POST /:id/retract` en `server/routes/organizations.js`
  - Solo el owner puede ejecutar
  - Valida que status sea retractable (waiting_ministro, ministro_scheduled, pending_review, in_review)
  - Cambia status a `draft`, limpia electionDate/electionTime/ministroData
  - Agrega evento a statusHistory
- [x] **F7-02**: Crear notificación para admin (MUNICIPALIDAD) al retractar
- [x] **F7-03**: Crear notificación para ministro de fe si estaba asignado

#### Frontend — Organizador
- [x] **F7-04**: Botón "Retractar Solicitud" en `OrgSolicitudDetail.jsx` (solo si status retractable)
- [x] **F7-05**: Modal de confirmación con texto explicativo
- [x] **F7-06**: Llamar endpoint, toast de éxito, actualizar UI

#### Frontend — Admin
- [x] **F7-07**: Verificar que lista admin excluya borradores de bandeja pendiente
  - `OrganizationsList.jsx` 'all' filter now excludes draft status
  - Stats 'Total' card excludes drafts
  - `adminStore.js` getFilteredOrganizations() also excludes drafts from 'all'
- [x] **F7-08**: Verificar que notificaciones de cancelación se muestren correctamente
  - Retract endpoint creates `type: 'status_change'` notifications (already in Notification model enum)
  - Notifications sent to all MUNICIPALIDAD admins + assigned ministro

#### Correcciones adicionales
- [x] **F7-00a**: Agregar comisión electoral a vista detalle de solicitud
- [x] **F7-00b**: Fix Zod stripping provisionalDirectorio (schema faltaba .passthrough())

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `server/routes/organizations.js` | Nuevo endpoint POST /:id/retract |
| `server/middleware/validation.js` | (ya corregido) .passthrough() en provisionalDirectorio |
| `src/react/pages/OrganizationDashboard/OrgSolicitudDetail.jsx` | Botón retractar + modal + comisión electoral |
| `src/react/pages/OrganizationDashboard/OrgMisOrganizaciones.jsx` | Método retract en apiService |
| `src/services/ApiService.js` | Nuevo método retractOrganization() |
| `src/react/pages/Admin/views/OrganizationsList.jsx` | Verificar filtro excluye draft de pendientes |

---

## FASE 8: Refactorización de Firmas Legales y Flujo de Aprobación Municipal

### Estado: COMPLETADO
### Fecha inicio: 2026-03-05
### Fecha cierre: 2026-03-05

> **Objetivo**: Eliminar el almacenamiento de imágenes de firma/timbre del Secretario Municipal
> (sin validez legal según Ley 19.799) y reemplazarlo por un flujo transaccional donde el
> funcionario sube el PDF del Certificado de Personalidad Jurídica ya firmado criptográficamente
> con Firma Electrónica Avanzada (FEA).
>
> **Justificación legal**: La Ley 19.799 sobre Documentos Electrónicos y Firma Electrónica
> establece que solo la FEA tiene equivalencia funcional a la firma manuscrita ante notario.
> Guardar imágenes de firma para estamparlas en PDFs generados no constituye firma electrónica
> válida y representa un riesgo de seguridad (suplantación, uso no autorizado).

### Tarea 1: Plan de Trabajo
- [x] **F8-01**: Agregar sección FASE 8 a PLAN_CORRECCIONES_ASAMBLEA.md

### Tarea 2: Limpieza Frontend y Backend (Eliminar vista global de Timbre/Firma)
- [x] **F8-02**: Eliminar item "Timbre/Firma" del menú lateral admin (AdminLayout.jsx)
- [x] **F8-03**: Eliminar TimbreFirmaView del VIEW_MAP y lazy import (AdminDashboardPage.jsx)
- [x] **F8-04**: Eliminar campos `timbreVirtual` y `firmaDigital` del modelo User.js
- [x] **F8-05**: Eliminar 6 endpoints CRUD de timbre/firma en server/routes/users.js + import storageService
- [x] **F8-06**: Eliminar archivo TimbreFirmaView.jsx

### Tarea 3: Backend — Nuevo Endpoint de Aprobación con Documento Firmado
- [x] **F8-07**: Agregar campo `certificadoPersonalidadJuridica` al modelo Organization.js
- [x] **F8-08**: Crear endpoint POST `/:id/approve-with-document` en organizations.js
  - Multer config para PDFs (max 10MB, memory storage)
  - Valida transición de estado
  - Guarda PDF vía storeFile (S3/base64 fallback)
  - Crea cuentas de miembros + notificación al organizador
  - Envía email de aprobación
- [x] **F8-08b**: Crear endpoint GET `/:orgId/generate-certificado-borrador` en documents.js
  - HTML con datos de la org (nombre, tipo, directorio, miembros)
  - Marca de agua "BORRADOR — requiere FEA"
  - Genera PDF con Puppeteer

### Tarea 4: Frontend — Vista de Revisión Municipal con Flujo FEA
- [x] **F8-09**: Agregar método `approveWithDocument()` a adminStore.js
- [x] **F8-10**: Agregar método API `approveOrgWithDocument()` a ApiService.js (FormData multipart)
- [x] **F8-11**: Implementar flujo de aprobación con FEA en OrgReviewModal.jsx
  - Tab "Aprobar" con 3 pasos + banner informativo Ley 19.799
  - Paso A: Botón "Descargar Borrador PDF" (consume generate-certificado-borrador)
  - Paso B: Drag & Drop + input file para subir PDF firmado con FEA
  - Paso C: Botón "Aprobar Organización" (consume approve-with-document)
  - Indicador de certificado ya cargado si org ya fue aprobada

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `PLAN_CORRECCIONES_ASAMBLEA.md` | Sección FASE 8 |
| `src/react/pages/Admin/AdminLayout.jsx` | Eliminar item timbre del menú |
| `src/react/pages/Admin/AdminDashboardPage.jsx` | Eliminar TimbreFirmaView del VIEW_MAP |
| `src/react/pages/Admin/views/TimbreFirmaView.jsx` | **ELIMINADO** |
| `server/models/User.js` | Eliminar campos timbreVirtual, firmaDigital |
| `server/routes/users.js` | Eliminar 6 endpoints de timbre/firma |
| `server/models/Organization.js` | Nuevo campo certificadoPersonalidadJuridica |
| `server/routes/organizations.js` | Nuevo endpoint approve-with-document |
| `src/react/stores/adminStore.js` | Nuevo método approveWithDocument() |
| `src/services/ApiService.js` | Nuevo método approveOrgWithDocument() |
| `src/react/pages/Admin/views/OrgReviewModal.jsx` | Flujo FEA: descargar borrador + subir firmado + aprobar |

---

## FASE 9: Validación de Quórum Mínimo Constitutivo

### Estado: COMPLETADO
### Fecha: 2026-03-05

> **Objetivo**: Conectar la configuración de `miembrosMinimos` del panel Admin con la experiencia
> del Organizador en el Wizard, validando que se registre el mínimo legal de socios fundadores
> y advirtiendo sobre la asistencia presencial obligatoria.

### Contexto
- `EstatutoTemplate.miembrosMinimos` (Number, default 15) ya existe en el modelo
- El campo viaja al frontend vía `GET /api/estatuto-templates/:tipo/config`
- `wizardStore.templateConfig.miembrosMinimos` ya se usa en Step2 para validación
- El Admin ya puede editar este campo en EstatutosManagerView (pestaña Directorio)

### Tareas

#### Backend / Schema
- [x] **F9-01**: Verificar que `miembrosMinimos` se guarda correctamente en EstatutoTemplate
  - Campo existe en schema (default: 15), se incluye en snapshot, config, y version history
  - Ruta PUT acepta y persiste el valor
  - No requiere cambios backend

#### Frontend — Wizard Step 2 (Socios Fundadores)
- [x] **F9-02**: Agregar alerta de advertencia prominente sobre asistencia presencial obligatoria
  - Recuadro amarillo con texto dinámico usando `minMembers` de templateConfig
  - Referencia a Ley 19.418 y firma ante Ministro de Fe
- [x] **F9-03**: Deshabilitar botón "Siguiente" cuando miembros < mínimo legal
  - Botón con estilo disabled (opacity, cursor not-allowed)
  - Texto de error dinámico: "Faltan X socios para cumplir el mínimo legal"
- [x] **F9-04**: Mejorar barra de progreso con indicador visual de cumplimiento

#### Frontend — Panel Admin
- [x] **F9-05**: Verificar input "Mínimo miembros para constituir" en EstatutosManagerView
  - Ya funciona correctamente en pestaña Directorio, enlazado a estado y guardado en BD

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `PLAN_CORRECCIONES_ASAMBLEA.md` | Sección FASE 9 |
| `src/react/pages/Wizard/steps/Step2_Members.jsx` | Alerta presencial + botón disabled + mensaje faltantes |

---

## FASE 10: Sistema de Validación de Documentos y QR

### Estado: COMPLETADO
### Fecha: 2026-03-10

> **Objetivo**: Implementar un sistema de verificación pública de documentos mediante códigos QR
> y folios únicos. Cada PDF generado por el sistema (Actas, Certificados, Listas) se registra
> con un folio único en la base de datos. El PDF incluye un código QR y texto de verificación
> en el pie de página. Cualquier persona puede escanear el QR o ingresar el folio en una
> página pública para verificar la autenticidad del documento.
>
> **Justificación legal**: Permite a terceros (municipalidad, notarios, otros organismos) verificar
> que un documento fue efectivamente emitido por el sistema y no ha sido adulterado.

### Tarea 1: Plan de Trabajo
- [x] **F10-01**: Agregar sección FASE 10 a este archivo

### Tarea 2: Backend — Base de Datos (DocumentRegistry)
- [x] **F10-02**: Crear modelo `server/models/DocumentRegistry.js`
  - Campos: folio (nanoid 12 chars, único), organizationId, documentType (enum 7 tipos), documentTitle, issueDate, issuedBy, assemblyId, fileHash (SHA-256), status (VALID/REVOKED)
  - Índices: folio (unique), organizationId+documentType, status
- [x] **F10-03**: Crear ruta pública `server/routes/documentRegistry.js`
  - GET `/api/document-registry/verify/:folio` — endpoint público sin autenticación
  - Retorna metadatos del documento: org name, tipo, fecha, hash
  - Maneja estados VALID, REVOKED y not found
- [x] **F10-04**: Registrar ruta en `server/index.js`

### Tarea 3: Backend — Generador de PDFs con QR
- [x] **F10-05**: Instalar dependencias `qrcode` y `nanoid@3` en server
- [x] **F10-06**: Crear helpers en `server/routes/documents.js`:
  - `registerDocumentAndGetQR()` — registra doc en DB, genera QR base64
  - `buildVerificationFooter()` — genera HTML del bloque QR + folio
  - `injectQRFooter()` — inyecta footer antes de `</body>`
- [x] **F10-07**: Inyectar QR en 5 endpoints de generación PDF:
  - `generate-acta` (Acta Constitutiva)
  - `generate-members` (Lista de Socios)
  - `generate-acta-escrutinio` (Acta de Escrutinio)
  - `generate-lista-asistencia` (Lista de Asistencia)
  - `generate-certificado-borrador` (Certificado PJ Borrador)
- [x] **F10-08**: Actualizar hash SHA-256 del PDF final en el registro

### Tarea 4: Frontend — Vista Pública de Validación (React)
- [x] **F10-09**: Crear `src/react/pages/Public/ValidarDocumentoPage.jsx`
  - Ruta pública `/validar` (con input manual) y `/validar/:folio` (directo desde QR)
  - Sin autenticación requerida
  - UI: formulario de búsqueda + 3 estados (válido/revocado/no encontrado)
  - Documento válido: badge verde, datos de org, tipo doc, fecha, hash
  - Documento revocado: alerta naranja con fecha y motivo
  - No encontrado: alerta roja con sugerencia
- [x] **F10-10**: Registrar rutas públicas en `src/react/App.jsx`

### Archivos nuevos/modificados

| Archivo | Cambios |
|---------|---------|
| `PLAN_CORRECCIONES_ASAMBLEA.md` | Sección FASE 10 |
| `server/models/DocumentRegistry.js` | **NUEVO** — modelo Mongoose con folio nanoid |
| `server/routes/documentRegistry.js` | **NUEVO** — endpoint público de verificación |
| `server/routes/documents.js` | Imports QRCode/crypto/DocumentRegistry, 3 helpers, QR en 5 endpoints PDF |
| `server/index.js` | Import + app.use documentRegistryRoutes |
| `server/package.json` | Dependencias qrcode, nanoid@3 |
| `src/react/pages/Public/ValidarDocumentoPage.jsx` | **NUEVO** — vista pública de validación |
| `src/react/App.jsx` | 2 rutas públicas /validar y /validar/:folio |

---

## FASE 11: Endurecimiento de Red (Anti-SSRF controlable) y Whitepaper

### Estado: COMPLETADO
### Fecha: 2026-03-10

> **Objetivo**: Implementar un módulo Anti-SSRF controlable por variable de entorno que bloquee
> peticiones HTTP a IPs privadas/localhost cuando está activo en producción. Proporcionar
> documentación formal (whitepaper) al Departamento de TI de la Municipalidad garantizando
> que la aplicación no realiza escaneos de red en la intranet municipal.
>
> **Contexto**: Requerimiento del Departamento de TI de la Municipalidad de Renca previo a
> permitir el uso de la plataforma en la red Wi-Fi interna.

### Tarea 1: Plan de Trabajo
- [x] **F11-01**: Agregar sección FASE 11 a este archivo

### Tarea 2: Variables de Entorno
- [x] **F11-02**: Agregar `VITE_ENABLE_STRICT_LOCAL_NETWORK_BLOCK=false` a `.env.example` (frontend)
- [x] **F11-03**: Agregar `ENABLE_STRICT_LOCAL_NETWORK_BLOCK=false` a `server/.env.example` (backend)

### Tarea 3: Interceptor Anti-SSRF en ApiService.js
- [x] **F11-04**: Crear función `assertNotLocalNetwork(url)` en `src/services/ApiService.js`
  - Solo activa si `VITE_ENABLE_STRICT_LOCAL_NETWORK_BLOCK=true`
  - Bloquea: localhost, 127.0.0.1, ::1, 0.0.0.0, 10.*, 172.16-31.*, 192.168.*, 169.254.*, fc00:/fe80: IPv6
  - Error: `Network violation: Local IP request blocked by security policy`
  - Default `false`: no rompe desarrollo local
- [x] **F11-05**: Inyectar validación en `request()` antes de ejecutar fetch

### Tarea 4: Documentación — SECURITY_WHITEPAPER.md
- [x] **F11-06**: Crear `SECURITY_WHITEPAPER.md` con:
  - Resumen ejecutivo del módulo Anti-SSRF
  - Tabla de rangos IP bloqueados (RFC 1918, link-local, IPv6 ULA)
  - Diagrama de arquitectura de red (LAN → Internet → Vercel/Railway/Atlas)
  - Recomendación de red Wi-Fi Guest con client isolation
  - Políticas CORS, CSP, autenticación HttpOnly
  - Referencias: OWASP Top 10, Ley 19.628, Ley 21.719, NCh-ISO 27001

### Archivos nuevos/modificados

| Archivo | Cambios |
|---------|---------|
| `PLAN_CORRECCIONES_ASAMBLEA.md` | Sección FASE 11 |
| `.env.example` | Variable `VITE_ENABLE_STRICT_LOCAL_NETWORK_BLOCK` |
| `server/.env.example` | Variable `ENABLE_STRICT_LOCAL_NETWORK_BLOCK` |
| `src/services/ApiService.js` | Función `assertNotLocalNetwork()` + invocación en `request()` |
| `SECURITY_WHITEPAPER.md` | **NUEVO** — Whitepaper formal para Municipalidad |

---

## FASE 12: Certificado de Inhabilidades (Registro Civil)

### Estado: COMPLETADO
### Fecha: 2026-03-10

> **Objetivo**: Exigir el Certificado de Inhabilidades para trabajar con menores de edad
> (emitido por el Registro Civil) a todos los miembros del directorio, condicionado a que
> la organización permita menores en sus estatutos (`edadConfig.permiteMenores === true`).
>
> **Contexto legal**: La Ley 20.594 (Registro de Inhabilidades) establece que toda persona
> que trabaje o se relacione habitualmente con menores de edad debe acreditar que no figura
> en el Registro de Condenas por delitos sexuales contra menores.

### Tarea 1: Plan de Trabajo
- [x] **F12-01**: Agregar sección FASE 12 a este archivo

### Tarea 2: Backend — Schema
- [x] **F12-02**: Agregar campo `inhabilityCertificate` (String, Base64) a cada miembro del provisionalDirectorio en `Organization.js`
  - Aplicado en: president, secretary, vicePresident, treasurer, additionalMembers
- [x] **F12-03**: Agregar `inhabilityCertificate` al Zod memberSchema en `validation.js`

### Tarea 3: Frontend — Wizard Step 5 (Directorio)
- [x] **F12-04**: Agregar estado `inhabilityCertificates` a `wizardStore.js`
- [x] **F12-05**: Lógica condicional en `Step5_Directorio.jsx`:
  - Si `permiteMenores === true`: muestra campo FileUpload obligatorio por cada cargo
  - Label: "Certificado de Inhabilidades (Registro Civil) *"
  - Texto de ayuda con enlace a registrocivil.cl
  - Fondo rosa (#fdf2f8) para diferenciar del certificado de antecedentes
  - Validación: bloquea avance si falta algún certificado
- [x] **F12-06**: Embeber Base64 en `inhabilityCertificate` del miembro al avanzar al paso siguiente
- [x] **F12-07**: Limpiar certificados de inhabilidades al remover un cargo

### Tarea 4: Frontend — Panel Admin (OrgReviewModal)
- [x] **F12-08**: Botón "Ver Inhabilidades" con ícono de escudo morado en la tarjeta de cada directivo
  - Solo visible si `person.inhabilityCertificate` existe
  - Descarga el Base64 como PDF al hacer click

### Archivos nuevos/modificados

| Archivo | Cambios |
|---------|---------|
| `PLAN_CORRECCIONES_ASAMBLEA.md` | Sección FASE 12 |
| `server/models/Organization.js` | Campo `inhabilityCertificate` en 5 sub-schemas del directorio |
| `server/middleware/validation.js` | Campo `inhabilityCertificate` en memberSchema Zod |
| `src/react/stores/wizardStore.js` | `inhabilityCertificates: {}` en initialFormData |
| `src/react/pages/Wizard/steps/Step5_Directorio.jsx` | FileUpload condicional + validación + embed Base64 |
| `src/react/pages/Admin/views/OrgReviewModal.jsx` | Botón "Ver Inhabilidades" con escudo morado |
