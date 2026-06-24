# tests-opo

App **personal** (single-user, sin login) para preparar oposiciones: subes un
temario en PDF, eliges la dificultad y Claude genera un test de **40 preguntas**
(una correcta + 4 opciones). Corre en `localhost` y guarda todo en Supabase.

> Estado actual: **MVP del Objetivo 1** — subir PDF → elegir dificultad →
> generar test → guardarlo y revisarlo. La plataforma de ejecución de tests
> (realizar, puntuar, historial, evolución) es el Objetivo 2 y su esquema ya
> está creado en la BD, listo para construirse encima.

## Stack

- **Next.js (App Router, TypeScript)** en localhost — frontend + Server Actions.
- **Supabase** — Postgres (datos) + Storage (PDFs). Sin auth ni RLS: el guardián
  es que el backend solo corre en tu PC y usa la `service_role` key en servidor.
- **Claude (API de Anthropic)** — lee el PDF de forma nativa y genera el test con
  **salida estructurada** (`messages.parse` + `zodOutputFormat`) validada con Zod.

## Puesta en marcha

1. **Dependencias**
   ```bash
   npm install
   ```

2. **Supabase**
   - Crea un proyecto en [supabase.com](https://supabase.com).
   - SQL Editor → pega y ejecuta `supabase/migrations/0001_init.sql`
     (crea las tablas y el bucket `temarios`).

3. **Credenciales** — copia y rellena el entorno:
   ```bash
   cp .env.example .env.local
   ```
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Settings → API.
   - `ANTHROPIC_API_KEY`: [console.anthropic.com](https://console.anthropic.com).
   - `ANTHROPIC_MODEL` (opcional): por defecto `claude-opus-4-8`. Para abaratar,
     `claude-sonnet-4-6`.

4. **Arrancar**
   ```bash
   npm run dev
   ```
   Abre http://localhost:3000. Mientras falten credenciales, la home muestra una
   pantalla de configuración en vez de fallar.

## Ejecutar con Docker

La app se empaqueta como imagen autocontenida (Node + dependencias + build, Next.js
`standalone`). Requiere igualmente un proyecto Supabase con la migración aplicada y las
credenciales: **no se incluyen en la imagen**, se inyectan en runtime.

Con docker compose (lee `.env.local`):

```bash
docker compose up --build
```

O con docker a pelo:

```bash
docker build -t tests-opo .
docker run --rm -p 3000:3000 --env-file .env.local tests-opo
```

Abre http://localhost:3000. Para parar compose: `docker compose down`.

> Las claves se pasan por `--env-file`/`env_file`; nunca se hornean en la imagen
> (`.env.local` está en `.dockerignore`). La imagen es portable a cualquier PC con Docker,
> pero necesita salida a internet para hablar con Supabase y la API de Claude.

## Cómo funciona la generación

`lib/generate-test.ts` envía el PDF (como bloque `document` base64) + un prompt
con la dificultad inyectada, y fuerza un JSON con el esquema de
`lib/test-contract.ts`. Después valida invariantes (40 preguntas, 4 opciones
únicas, índice correcto en rango, sin enunciados repetidos) y **reintenta hasta
3 veces** devolviéndole a Claude el error concreto. Nunca se persiste un test que
no pase la validación.

Cada pregunta incluye `refTemario` (fragmento del temario que la justifica) como
anclaje anti-alucinación, y `explicacion` obligatoria para el modo repaso.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build |
| `npm run typecheck` | Comprueba tipos (`tsc --noEmit`) |
| `docker compose up --build` | Construye y levanta el contenedor (lee `.env.local`) |

## Estructura

```
app/
  page.tsx            Home: formulario + temarios/tests agrupados
  GenerateForm.tsx    Formulario (client) con estado de carga
  actions.ts          Server Action: subir PDF → generar → guardar
  tests/[id]/page.tsx Vista de un test generado (revisión con soluciones)
lib/
  difficulty.ts       Definición única de dificultad (UI + prompt)
  test-contract.ts    Esquema Zod + invariantes del test generado
  generate-test.ts    Llamada a Claude + validación + reintentos
  supabase.ts         Cliente de servidor (service_role)
  anthropic.ts        Cliente de Claude + modelo
  db.ts               Lecturas (temarios, tests, preguntas)
supabase/migrations/
  0001_init.sql       Esquema completo (incl. attempts/answers para Objetivo 2)
```

## Notas y límites conocidos

- **PDFs escaneados** (imagen sin texto) no se procesan bien: necesitarían OCR.
- **Temarios muy largos** podrían exceder el contexto; futura mejora: chunking.
- **Coste**: 40 preguntas con Opus no es trivial. Mide y, si hace falta, baja a
  Sonnet vía `ANTHROPIC_MODEL`.
- La generación es **síncrona** (Server Action con estado de carga). Si en el
  futuro molesta el tiempo de espera, migrar a job asíncrono + estado
  `generando` (ya contemplado en la columna `tests.status`).
