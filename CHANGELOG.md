# Changelog

Todas las novedades relevantes de **tests-opo** se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

### Pendiente
- Comparativa visual de intentos del mismo test (HU-17).
- Modo repaso de preguntas falladas.

## [0.6.0] - 2026-06-27

### Añadido
- **Etiquetas de temarios** (relación N:M): tablas `etiquetas` y `subject_etiquetas`
  (migración `0002_etiquetas.sql`). Al subir un temario se pueden asignar etiquetas
  (se crean al vuelo las que no existan). En `/temarios`, filtro por chips con
  semántica **AND** (`?etiquetas=` en la URL) y edición de etiquetas en `/temarios/[id]`.
  Funciones en `lib/db.ts` (`upsertEtiquetas`, `asignarEtiquetas`, `reemplazarEtiquetas`,
  `getEtiquetas`).
- **Versión en el pie de página**: el footer muestra `Versión [x.y.z] - fecha`, derivada
  en build del `CHANGELOG.md` (fuente única, vía `next.config.mjs` → `env`).

## [0.5.0] - 2026-06-27

### Añadido
- **Límites de subida de temario** configurables en `lib/app-config.ts` (fuente única, no env):
  tamaño máximo del PDF (`maxPdfMB`, por defecto 10 MB) y nº máximo de páginas
  (`maxPdfPaginas`, por defecto 50). Validación en dos pasos en `generateAction` (tamaño →
  páginas) **antes** de subir a Storage y de llamar al LLM; control de páginas también al
  regenerar desde un temario existente. El formulario avisa del tamaño en cliente.
- **Git hook de changelog** (`.githooks/commit-msg`): bloquea commits que tocan código sin
  actualizar `CHANGELOG.md`. Autoinstalable vía `npm` (script `prepare` → `core.hooksPath`).
  Escape: `[skip changelog]` en el mensaje o `git commit --no-verify`.

## [0.4.0] - 2026-06-27

### Añadido
- **Proveedor de generación conmutable** vía `LLM_PROVIDER` (`lib/provider.ts`):
  `anthropic` (por defecto), `deepseek` y `zai` (GLM). Se cambia de motor sin tocar código.
- Cliente **DeepSeek** (`lib/deepseek.ts`, modelo por defecto `deepseek-v4-flash`).
- Cliente **z.ai / GLM** (`lib/zai.ts`, modelo por defecto `glm-4.7-flashx`).
- Extracción de texto del PDF con **`unpdf`** (`lib/pdf-text.ts`), necesaria para los
  proveedores que no leen PDFs de forma nativa (DeepSeek, z.ai).
- Helper `openAiCompatProvider` para proveedores compatibles con OpenAI.
- Variables de entorno `LLM_PROVIDER`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`,
  `ZAI_API_KEY`, `ZAI_MODEL` (documentadas en `.env.example`).

### Cambiado
- `lib/generate-test.ts` pasa a ser **agnóstico de proveedor**: construye el prompt, delega
  la llamada en `generationProvider` y valida con `GeneratedTestSchema.safeParse` + invariantes
  + reintentos (lógica de reintentos conservada).
- La detección de credenciales usa `isGenerationConfigured` (del proveedor activo) en lugar de
  `isAnthropicConfigured`; `ConfigNotice` muestra el proveedor activo y su variable de clave.
- **Dependencias fijadas a versión exacta** (antes `@anthropic-ai/sdk`, `openai` y `unpdf`
  estaban como `latest`) para builds reproducibles, sobre todo en la imagen Docker.

### Notas
- El **PDF original se sigue almacenando y sirviendo** igual; el texto extraído es efímero.
- DeepSeek y z.ai **no procesan PDFs escaneados** (sin OCR no hay texto que extraer): lanzan
  un error claro y la app no se rompe.

## [0.3.0] - 2026-06-24

### Añadido
- **Dockerización autocontenida**: `Dockerfile` multi-stage (`node:22-alpine`, salida
  `standalone`, usuario no root), `docker-compose.yml` y `.dockerignore`.
- `next.config.mjs` con `output: "standalone"` e `images.unoptimized`.
- Documentación de build, ejecución y **publicación en Docker Hub** (multi-arquitectura).
- `README.md` completo.

## [0.2.0] - 2026-06-24

### Añadido
- **Plataforma de ejecución estilo Pearson** (Objetivo 2): realizar test, guardado
  incremental, corrección, pantalla de resultados, reanudar intento e historial por test.
- **Dashboard** con KPIs, evolución (SVG inline) y últimos tests completados.
- **Navegación**: barra superior fija (`TopNav`) con logo + secciones, y pie de página.
- Sección de **temarios**: listado y detalle, **Ver temario (PDF)** (signed URL al vuelo) y
  **Generar nuevo test** reutilizando el PDF ya almacenado.
- Logo, favicon y banner.

### Cambiado
- Ajustes de copys y formato (nota media en base 10 con 2 decimales, textos de UI).

## [0.1.0] - 2026-06-24

### Añadido
- **Generación de tests** (Objetivo 1): subir un temario en PDF, elegir dificultad y generar
  un test de 40 preguntas con la API de Anthropic.
- **Salida estructurada** con `messages.parse()` + `zodOutputFormat()`, validación Zod +
  invariantes cruzadas y reintentos (hasta 3).
- Persistencia en **Supabase** (Postgres + Storage), esquema en
  `supabase/migrations/0001_init.sql`.
- Pantalla de configuración cuando faltan credenciales (no rompe sin claves).

[No publicado]: https://github.com/USUARIO/tests-opo/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.6.0
[0.5.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.5.0
[0.4.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.4.0
[0.3.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.3.0
[0.2.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.2.0
[0.1.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.1.0
