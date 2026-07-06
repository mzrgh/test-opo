# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

App **personal single-user** (sin auth, corre en localhost) para preparar oposiciones:
subir un temario en PDF → elegir dificultad → Claude genera un test de 40 preguntas
→ realizarlo estilo Pearson → corregir y revisar. Backend en Supabase (Postgres +
Storage), generación con la API de Anthropic.

**Estado**: Objetivo 1 (generación) y Objetivo 2 (ejecución: realizar test, guardado
incremental, corrección, resultados, reanudar, historial por test) implementados.
Pendiente: dashboard global, evolución entre temarios, comparativa de intentos,
modo repaso de falladas (Épicas 5/6 restantes).

## Comandos

```bash
npm run dev        # desarrollo (localhost:3000)
npm run build      # build de producción
npm run typecheck  # tsc --noEmit
docker compose up --build   # contenedor (lee credenciales de .env.local)
```

**Docker**: `next.config.mjs` usa `output: "standalone"` e `images.unoptimized`. El
`Dockerfile` es multi-stage (deps → builder → runner, `node:22-alpine`, usuario no root) y
copia `.next/standalone` + `.next/static` + `public`. Las credenciales se inyectan en runtime
(`env_file`/`--env-file`), nunca se hornean en la imagen (`.env.local` en `.dockerignore`).

No hay suite de tests todavía. Tras cambios en `lib/` o tipos, valida con
`npm run typecheck`; para cambios de UI/rutas, `npm run build` detecta errores de
fronteras cliente/servidor y de prerender.

## Arquitectura (lo no obvio)

**Flujo de generación** — todo pasa por la Server Action `app/actions.ts:generateAction`:
sube el PDF a Storage → llama a `lib/generate-test.ts` (paso caro, ANTES de tocar la BD)
→ si falla, borra el PDF huérfano → solo entonces persiste `subjects` + `tests` +
`questions` → `redirect` al test. Este orden (generar antes de insertar) evita filas
huérfanas en BD.

**Contrato de generación** (`lib/test-contract.ts`) — Claude SOLO devuelve `descripcion`
+ `preguntas[]`. El servidor es la fuente de verdad de `id`, `dificultad` (ya la eligió
el usuario) y `fechaGeneracion`. No pedir esos campos al LLM.

**Proveedor de generación conmutable** (`lib/provider.ts`) — `LLM_PROVIDER` (env, default
`anthropic`) elige entre **Anthropic**, **DeepSeek** y **z.ai/GLM**. `lib/generate-test.ts`
es agnóstico: construye el prompt, llama a `generationProvider.generarObjeto()` y valida.
Cada proveedor encapsula su SDK:
- **anthropic** (`lib/anthropic.ts`): `messages.parse()` + `zodOutputFormat()`, lee el PDF
  nativo (bloque `document`), thinking/effort condicionados a que no sea Haiku.
- **deepseek** (`lib/deepseek.ts`) y **zai** (`lib/zai.ts`): ambos SDK `openai` (compatibles
  OpenAI) vía el helper `openAiCompatProvider`, con `response_format: json_object`. Defaults
  `deepseek-v4-flash` (NO `deepseek-chat`/`deepseek-reasoner`: se deprecan 2026/07/24) y
  `glm-4.7-flashx`. **No leen PDFs**: el temario se extrae a texto con `unpdf`
  (`lib/pdf-text.ts`) una vez antes del loop; PDFs escaneados sin OCR lanzan error. El texto
  es efímero; el **PDF original siempre se almacena y se sirve** igual (Storage intacto).

**Salida estructurada** — `lib/generate-test.ts` valida con `GeneratedTestSchema.safeParse`
+ invariantes cruzadas (`validateInvariants`: 40 preguntas, 4 opciones únicas, índice en
rango, sin enunciados repetidos) y **reintenta hasta 3 veces** devolviéndole al modelo el
error concreto. Nunca se persiste un test que no pase la validación.

**Zod v4, no v3** — el helper `zodOutputFormat` del SDK importa de `zod/v4`. Los esquemas
que se le pasan DEBEN importar `import { z } from "zod/v4"` (no `"zod"`), o el typecheck
falla por incompatibilidad de tipos. Ver `lib/test-contract.ts`.

**Dificultad: fuente única** (`lib/difficulty.ts`) — cada nivel tiene `description` (UI) y
`promptGuidance` (prompt). Lo que se muestra al usuario y lo que se le pide a Claude
salen del mismo sitio para que nunca diverjan. Al tocar dificultad, edita solo aquí.

**Supabase service_role** (`lib/supabase.ts`) — cliente de SERVIDOR con la `service_role`
key (salta RLS; no hay RLS porque es single-user). NUNCA importar en componentes cliente.
`lib/db.ts` y `lib/generate-test.ts` llevan `import "server-only"` como salvaguarda.

**Sin credenciales no peta** — `isSupabaseConfigured` / `isGenerationConfigured` (esta
última resuelve el flag del proveedor activo, en `lib/provider.ts`) detectan placeholders;
la home muestra una pantalla de configuración en vez de fallar. Usa `isGenerationConfigured`,
no `isAnthropicConfigured` directamente, en código de UI/acciones.

## Convenciones

- Proveedor de generación vía `LLM_PROVIDER` (`anthropic` | `deepseek` | `zai`, default
  `anthropic`). Modelo Anthropic vía `ANTHROPIC_MODEL` (default `claude-opus-4-8`;
  `claude-sonnet-4-6` para abaratar). Modelo DeepSeek vía `DEEPSEEK_MODEL` (default
  `deepseek-v4-flash`). Modelo z.ai vía `ZAI_MODEL` (default `glm-4.7-flashx`).
- Nombres de dominio en **español** (`subjects`, `tests`, `questions`, `dificultad`,
  `enunciado`, `opciones`, `indiceCorrecta`). Mantenerlo.
- El esquema SQL vive en `supabase/migrations/0001_init.sql` y se ejecuta a mano en el
  SQL Editor de Supabase (no hay CLI de Supabase conectado). Si cambias tablas, añade una
  nueva migración numerada, no edites la existente.
- `randomUUID()` (de `node:crypto`) para los paths de PDF en Storage.

## Ejecución de tests (Objetivo 2)

**Modo examen — no filtrar soluciones al cliente.** `getRunData` (lib/db.ts) selecciona
las preguntas SIN `indice_correcta` ni `explicacion`; la pantalla de ejecución
(`app/attempts/[id]/run`) nunca recibe la respuesta correcta. `es_correcta` se calcula
en servidor en `saveAnswer` (app/attempt-actions.ts). Las soluciones solo aparecen en
resultados (`getResultData`) y en el solucionario.

**Guardado incremental.** `startAttempt` crea el `attempts` y **pre-crea las 40 filas de
`answers`** (una por pregunta). Cada interacción es un UPDATE (`saveAnswer`, `toggleMark`),
no un upsert — así no se pisan `opcion_elegida` y `marcada_para_revision` entre sí. Esto
habilita reanudar: `attempts.finished_at = null` ⇒ test en curso; la landing del test
ofrece "Continuar" y `getInProgressAttempt` lo localiza.

**Scoring.** `finishAttempt` cuenta `es_correcta = true`, guarda `score` (nº de aciertos),
`duracion` (seg desde `started_at`), `tips_revelados` (nº de pistas usadas) y
`finished_at`. Es idempotente (no re-puntúa si ya está finalizado). Sin penalización por
fallo ni por pista (las pistas solo se contabilizan).

**Timer de lectura obligatoria.** Al mostrar cada pregunta, `RunClient` bloquea opciones
y "Marcar para revisión" durante `QUESTION_UNLOCK_SECONDS` segundos (env; default 20,
`0` = off; fuente única `lib/run-config.ts`, **server-only**: llega al cliente como prop
desde `run/page.tsx`). Se reinicia SIEMPRE que se muestra la pregunta (navegar, reanudar,
recargar), aunque ya esté contestada — decisión explícita. La navegación no se bloquea.

**Tips (pistas).** `tests.con_tips` es atributo del test (como la dificultad); se elige
con checkbox en ambos flujos de generación (`name="tips"`). Con tips, el prompt exige
`tip` por pregunta (pista que orienta SIN desvelar la respuesta ni citar opciones/letras
— las opciones se barajan después) y `validateInvariants(test, conTips)` fuerza reintento
si falta. El `tip` SÍ viaja al cliente en `getRunData` (no es la solución; sigue sin
viajar `indice_correcta`/`explicacion`). Revelar es irreversible: `revealTip`
(attempt-actions) pone `answers.tip_revelado = true`, nunca lo revierte; el botón solo se
habilita pasado el timer. Preguntas con tip revelado → enunciado en rojo
(`.q-head.tip-revelado`) en resultados. Migración `0003_tips.sql`.

## Navegación / IA (barra fija con 3 secciones)

`app/layout.tsx` monta `TopNav` (fija, client, marca sección activa con `usePathname`) +
`Footer` (© Raúl González + **versión** + ancla `#top`). La versión del pie se deriva en
**build** de `CHANGELOG.md` (primera entrada `## [x.y.z] - fecha`, ignorando `[No publicado]`):
`next.config.mjs` la lee y la inyecta vía `env` (`APP_VERSION`/`APP_VERSION_DATE`), por lo que
NO se lee fichero en runtime (Docker). Por eso `.dockerignore` incluye `!CHANGELOG.md`. Secciones:
- `/` → **Dashboard** (`app/page.tsx`): 5 KPIs + evolución (SVG inline, sin librería) +
  actividad reciente. Datos de `getDashboardStats()`. KPIs solo de intentos finalizados;
  nota media = % medio (aciertos/preguntas).
- `/generar` → formulario (`GenerateForm`, reutilizado).
- `/temarios` → lista de temarios (card + nº tests + etiquetas) con **filtro por etiquetas**
  (chips, AND, estado en `?etiquetas=ids` → `EtiquetaFilter`, client); `/temarios/[id]` →
  tests del temario con nº intentos y mejor % (`getSubjectDetailWithStats`), enlaza a la
  landing del test. Además: **Ver temario (PDF)** vía `app/temarios/[id]/pdf/route.ts` (genera
  una signed URL del bucket privado al vuelo y redirige), **Generar nuevo test** reutilizando
  el PDF ya almacenado (`generateFromSubjectAction` en `app/actions.ts`: descarga el PDF de
  Storage, no re-sube) y **Editar etiquetas** (`EditEtiquetasForm` → `updateSubjectEtiquetasAction`).
  La inserción test+preguntas está extraída en `insertTestWithQuestions` (`lib/db.ts`),
  compartida con `generateAction`.

**Etiquetas (N:M)** — tablas `etiquetas` + `subject_etiquetas` (migración `0002_etiquetas.sql`;
unicidad case-insensitive vía `lower(nombre)`). Toda la lógica en `lib/db.ts`: `upsertEtiquetas`
(crea las que falten), `asignarEtiquetas` (aditivo, al subir), `reemplazarEtiquetas` (edición),
`getEtiquetas` (catálogo). El filtro AND se aplica en memoria en `getSubjectsWithTests` (volumen
single-user). Las etiquetas son metadato del servidor: NO se piden al LLM.

Pantalla de credenciales compartida: `app/ConfigNotice.tsx` (exporta `appConfigured`);
las páginas con datos hacen `if (!appConfigured) return <ConfigNotice />`.

**Rutas de test/ejecución.** `/tests/[id]` = landing (realizar/continuar + historial).
`/tests/[id]/solucionario` = soluciones abiertas. `/attempts/[id]/run` = examen (client).
`/attempts/[id]/result` = corrección + revisión.

## Perfiles de uso (Gestor / Estudiante)

`lib/perfil.ts` (`esGestor()`, **server-only**) lee la env `ENABLE_TEMARIO_MANAGEMENT`:
`TRUE` ⇒ **Gestor**; cualquier otra cosa (ausente/ inválida) ⇒ **Estudiante** (fail-safe,
restrictivo). El Estudiante NO puede: subir temarios (`/generar`), ver el solucionario
(`/tests/[id]/solucionario`) ni editar etiquetas. Sí realiza/consulta tests y puede
**generar un test nuevo desde un temario ya existente** (decisión explícita: esa función
queda disponible para ambos perfiles).

El control es **doble (UI + servidor)**, nunca solo cosmético:
- **UI**: `TopNav` recibe `gestor` como prop desde `layout.tsx` (la env no llega al cliente
  sin `NEXT_PUBLIC_`; se pasa desde el server component). Dashboard, `/tests/[id]` y
  `/temarios/[id]` ocultan sus controles con `esGestor()`.
- **Servidor**: las rutas `/generar` y `/tests/[id]/solucionario` hacen `redirect("/")` si
  no es Gestor; las Server Actions `generateAction` y `updateSubjectEtiquetasAction`
  rechazan en modo Estudiante (`generateFromSubjectAction` NO se bloquea).

Al añadir una función de gestión nueva, protégela en ambos planos (ocultar en UI **y**
blindar la ruta/action), nunca solo uno.

## Pendiente

Comparativa visual de intentos del mismo test (`HU-17`, ya hay datos), modo repaso de
preguntas falladas. La columna `tests.status` (`generando`) está reservada por si se migra
la generación a un job async.
