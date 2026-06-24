# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

App **personal single-user** (sin auth, corre en localhost) para preparar oposiciones:
subir un temario en PDF → elegir dificultad → Claude genera un test de 40 preguntas
→ guardarlo y revisarlo. Backend en Supabase (Postgres + Storage), generación con la
API de Anthropic. Estado actual: **MVP del Objetivo 1** (generación). El Objetivo 2
(realizar tests, puntuación, historial, evolución) aún no está implementado pero su
esquema ya existe en la BD (`attempts`, `answers`).

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

## Al construir el Objetivo 2 (plataforma de ejecución)

Las tablas ya están: `attempts` (un intento; `finished_at = null` ⇒ test en curso, para
reanudar) y `answers` (guardado **incremental** por pregunta, con `marcada_para_revision`).
Guardar respuestas a medida que se contestan, no solo al finalizar — es lo que habilita
reanudar un test y el marcado para revisión.
