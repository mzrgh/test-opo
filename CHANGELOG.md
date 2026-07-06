# Changelog

Todas las novedades relevantes de **tests-opo** se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

### Pendiente
- Comparativa visual de intentos del mismo test (HU-17).
- Modo repaso de preguntas falladas.

## [1.0.0] - 2026-07-06

### Añadido
- **Timer de lectura obligatoria** en la ejecución de tests: al mostrar cada
  pregunta, las opciones A/B/C/D y "Marcar para revisión" quedan bloqueadas
  unos segundos (barra de progreso + cuenta atrás visibles, sin tapar enunciado
  ni respuestas) para forzar la lectura. La navegación entre preguntas no se
  bloquea y el timer se reinicia cada vez que se muestra una pregunta (también
  al reanudar o recargar). Configurable con la env `QUESTION_UNLOCK_SECONDS`
  (default 20; `0` = desactivado), fuente única en `lib/run-config.ts`.
- **Tips (pistas) por pregunta**: al generar un test se puede marcar "Generar
  con pistas" (en `/generar` y al regenerar desde un temario). `con_tips` es un
  atributo del test (como la dificultad, badge "💡 Con pistas") y cada pregunta
  lleva una pista generada por el LLM que orienta sin desvelar la respuesta
  (invariante validada con reintento). Durante el test, la pista se puede
  revelar una vez pasado el timer; revelarla es irreversible (queda visible) y
  se registra en servidor (`answers.tip_revelado`, action `revealTip`). No
  penaliza la nota. El nº de pistas usadas se ve en la ejecución, en resultados
  (contador + enunciado en rojo + texto de la pista en la revisión), en el
  historial de intentos, en el solucionario y como KPI del dashboard
  (`attempts.tips_revelados`, denormalizado al finalizar). Migración
  `0003_tips.sql`.

## [0.8.0] - 2026-07-04

### Añadido
- **Feedback de progreso en la generación**: barra animada + mensajes de fase
  ("Leyendo el PDF…", "Redactando 40 preguntas…", "Validando y equilibrando
  respuestas…") mientras se genera un test, en `/generar` y al regenerar desde un
  temario. Componente cliente reutilizable `app/GenerationProgress.tsx` (progreso
  simulado, sin canal de backend nuevo).
- **Tipo obligatorio en los temarios**: todo temario debe tener exactamente un
  Tipo (**General** o **Informática**, mutuamente excluyentes) y al menos otra
  etiqueta libre (mínimo 2 en total). Reglas centralizadas en `lib/etiquetas.ts`,
  con selector de Tipo en los formularios de subida y edición y validación doble
  (cliente + Server Actions).

### Cambiado
- **Reparto equilibrado de respuestas correctas** entre A/B/C/D: tras generar y
  validar, el servidor baraja las opciones y reparte la posición correcta de forma
  balanceada (`equilibrarRespuestas` en `lib/generate-test.ts`), eliminando el sesgo
  del modelo a concentrar la correcta en la B. Determinista y sin coste de tokens.
- **Prompt con estilo de examen oficial de oposición**: enunciados formales, citas
  normativas al estilo oficial (solo si figuran en el temario), supuestos prácticos y
  distractores homogéneos. Se prohíben opciones auto-referenciales ("todas las
  anteriores", "a y c son correctas"), verificado además en `validateInvariants`.

## [0.7.0] - 2026-06-27

### Añadido
- **Perfiles de uso (Gestor / Estudiante)** vía la variable de entorno
  `ENABLE_TEMARIO_MANAGEMENT` (`.env.local`). Con `TRUE` (perfil **Gestor**) se
  habilitan las funciones de gestión; con `FALSE`, ausente o valor inválido se
  aplica el perfil **Estudiante** (fail-safe). En modo Estudiante se ocultan y se
  bloquean en servidor: **"+ Subir nuevo temario"** (menú y Dashboard, ruta
  `/generar`), **"Ver solucionario (spoiler)"** (`/tests/[id]` y la ruta
  `/tests/[id]/solucionario`) y **"+ Editar etiquetas"** (`/temarios/[id]` y la
  Server Action correspondiente). El bloqueo es UI + servidor: un Estudiante no
  accede ni escribiendo la URL ni invocando la acción. "Generar nuevo test" desde
  un temario existente sigue disponible para ambos perfiles. Lógica centralizada en
  `lib/perfil.ts` (`esGestor`).

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

[No publicado]: https://github.com/USUARIO/tests-opo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/USUARIO/tests-opo/releases/tag/v1.0.0
[0.8.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.8.0
[0.7.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.7.0
[0.6.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.6.0
[0.5.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.5.0
[0.4.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.4.0
[0.3.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.3.0
[0.2.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.2.0
[0.1.0]: https://github.com/USUARIO/tests-opo/releases/tag/v0.1.0
