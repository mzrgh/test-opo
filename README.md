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
- **LLM de generación, conmutable** (`LLM_PROVIDER`):
  - **Claude (Anthropic)** — lee el PDF de forma nativa y genera con **salida
    estructurada** (`messages.parse` + `zodOutputFormat`).
  - **DeepSeek** (`deepseek-v4-flash`) y **z.ai / GLM** (`glm-4.7-flashx`) — más
    baratos, API compatible con OpenAI; **no leen PDFs**, así que el temario se
    extrae a texto con `unpdf` y se valida en código.
  - En todos los casos la salida se valida con Zod + invariantes y se reintenta.

## Puesta en marcha

1. **Dependencias**
   ```bash
   npm install
   ```

2. **Supabase**
   - Crea un proyecto en [supabase.com](https://supabase.com).
   - SQL Editor → ejecuta las migraciones en orden:
     `supabase/migrations/0001_init.sql` (tablas + bucket `temarios`) y luego
     `supabase/migrations/0002_etiquetas.sql` (etiquetas de temarios).

3. **Credenciales** — copia y rellena el entorno:
   ```bash
   cp .env.example .env.local
   ```
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Settings → API.
   - `LLM_PROVIDER` (opcional): `anthropic` (por defecto), `deepseek` o `zai`.
   - Si `anthropic`: `ANTHROPIC_API_KEY` ([console.anthropic.com](https://console.anthropic.com))
     y `ANTHROPIC_MODEL` (opcional, por defecto `claude-opus-4-8`; para abaratar
     `claude-sonnet-4-6`).
   - Si `deepseek`: `DEEPSEEK_API_KEY` ([platform.deepseek.com](https://platform.deepseek.com))
     y `DEEPSEEK_MODEL` (opcional, por defecto `deepseek-v4-flash`).
   - Si `zai`: `ZAI_API_KEY` ([z.ai](https://z.ai)) y `ZAI_MODEL` (opcional, por
     defecto `glm-4.7-flashx`).
   - Ojo: DeepSeek y z.ai no leen PDFs escaneados (sin OCR no hay texto que extraer).

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

## Publicar en Docker Hub (compartir con otros equipos)

Requiere una cuenta en [hub.docker.com](https://hub.docker.com) y un repositorio (p. ej.
`tests-opo`). Sustituye `TU_USUARIO` por tu usuario de Docker Hub.

1. **Login** (interactivo):
   ```bash
   docker login -u TU_USUARIO
   ```

2. **Recomendado — build multi-arquitectura y push en un paso.** Necesario si los equipos
   usan distinta CPU (Apple Silicon `arm64` vs Windows/Linux Intel `amd64`):
   ```bash
   docker buildx create --use --name multi 2>/dev/null || docker buildx use multi
   docker buildx build --platform linux/amd64,linux/arm64 \
     -t TU_USUARIO/tests-opo:1.0.0 \
     -t TU_USUARIO/tests-opo:latest \
     --push .
   ```

   Alternativa (solo tu arquitectura, a partir de la imagen ya construida):
   ```bash
   docker tag tests-opo TU_USUARIO/tests-opo:1.0.0
   docker tag tests-opo TU_USUARIO/tests-opo:latest
   docker push TU_USUARIO/tests-opo:1.0.0
   docker push TU_USUARIO/tests-opo:latest
   ```

3. **Quien la use** (otro equipo) — necesita su propio `.env.local`:
   ```bash
   docker pull TU_USUARIO/tests-opo:latest
   docker run --rm -p 3000:3000 --env-file .env.local TU_USUARIO/tests-opo:latest
   ```

> Cada equipo necesita sus credenciales (`.env.example` como plantilla; **nunca compartas tu
> `.env.local`**) y su proyecto Supabase con la migración aplicada. Si el repositorio es
> privado, los demás deben tener acceso y hacer `docker login`.

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
  generate-test.ts    Orquestación (prompt + validación + reintentos), agnóstico de proveedor
  provider.ts         Capa conmutable de proveedor (Anthropic | DeepSeek | z.ai)
  anthropic.ts        Cliente de Claude + modelo
  deepseek.ts         Cliente de DeepSeek (compatible OpenAI) + modelo
  zai.ts              Cliente de z.ai / GLM (compatible OpenAI) + modelo
  pdf-text.ts         Extracción de texto del PDF (unpdf), para proveedores sin lectura nativa
  supabase.ts         Cliente de servidor (service_role)
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
