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
```

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

**Salida estructurada** — se fuerza con `messages.parse()` + `zodOutputFormat()` del SDK
de Anthropic (NO tool use manual). `lib/generate-test.ts` valida con Zod + invariantes
cruzadas (`validateInvariants`: 40 preguntas, 4 opciones únicas, índice en rango, sin
enunciados repetidos) y **reintenta hasta 3 veces** devolviéndole a Claude el error
concreto. Nunca se persiste un test que no pase la validación.

**Zod v4, no v3** — el helper `zodOutputFormat` del SDK importa de `zod/v4`. Los esquemas
que se le pasan DEBEN importar `import { z } from "zod/v4"` (no `"zod"`), o el typecheck
falla por incompatibilidad de tipos. Ver `lib/test-contract.ts`.

**Dificultad: fuente única** (`lib/difficulty.ts`) — cada nivel tiene `description` (UI) y
`promptGuidance` (prompt). Lo que se muestra al usuario y lo que se le pide a Claude
salen del mismo sitio para que nunca diverjan. Al tocar dificultad, edita solo aquí.

**Supabase service_role** (`lib/supabase.ts`) — cliente de SERVIDOR con la `service_role`
key (salta RLS; no hay RLS porque es single-user). NUNCA importar en componentes cliente.
`lib/db.ts` y `lib/generate-test.ts` llevan `import "server-only"` como salvaguarda.

**Sin credenciales no peta** — `isSupabaseConfigured` / `isAnthropicConfigured` detectan
placeholders; la home muestra una pantalla de configuración en vez de fallar. Útil para
arrancar antes de tener claves.

## Convenciones

- Modelo de generación configurable vía `ANTHROPIC_MODEL` (default `claude-opus-4-8`;
  bajar a `claude-sonnet-4-6` para abaratar). Definido en `lib/anthropic.ts`.
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
`duracion` (seg desde `started_at`) y `finished_at`. Es idempotente (no re-puntúa si ya
está finalizado). Sin penalización por fallo todavía (mejora futura).

## Navegación / IA (barra fija con 3 secciones)

`app/layout.tsx` monta `TopNav` (fija, client, marca sección activa con `usePathname`) +
`Footer` (© Raúl González + ancla `#top`). Secciones:
- `/` → **Dashboard** (`app/page.tsx`): 5 KPIs + evolución (SVG inline, sin librería) +
  actividad reciente. Datos de `getDashboardStats()`. KPIs solo de intentos finalizados;
  nota media = % medio (aciertos/preguntas).
- `/generar` → formulario (`GenerateForm`, reutilizado).
- `/temarios` → lista de temarios (card + nº tests); `/temarios/[id]` → tests del temario
  con nº intentos y mejor % (`getSubjectDetailWithStats`), enlaza a la landing del test.

Pantalla de credenciales compartida: `app/ConfigNotice.tsx` (exporta `appConfigured`);
las páginas con datos hacen `if (!appConfigured) return <ConfigNotice />`.

**Rutas de test/ejecución.** `/tests/[id]` = landing (realizar/continuar + historial).
`/tests/[id]/solucionario` = soluciones abiertas. `/attempts/[id]/run` = examen (client).
`/attempts/[id]/result` = corrección + revisión.

## Pendiente

Comparativa visual de intentos del mismo test (`HU-17`, ya hay datos), modo repaso de
preguntas falladas. La columna `tests.status` (`generando`) está reservada por si se migra
la generación a un job async.
