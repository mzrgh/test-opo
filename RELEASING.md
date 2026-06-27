# Pipeline de release

Cómo llevar una versión desde el código hasta Docker Hub, paso a paso. Pensado como
checklist: no hace falta recordarlo de memoria.

## Visión general

```
1. CÓDIGO        Implementas la feature
                 npm run typecheck && npm run build       (compila sin errores)
        │
2. DEV LOCAL     npm run dev  →  localhost:3000
        │        (pruebas la feature con tu .env.local real)
        │
3. CERRAR VER.   CHANGELOG [No publicado] → [x.y.z]
                 package.json version bump + npm install
                 git commit (feat) + git commit (release) + git tag vX.Y.Z
        │
4. DOCKER LOCAL  Construyes la imagen y la pruebas EN CONTENEDOR
                 docker compose up --build   →  localhost:3000
        │
5. PUBLICAR      git push && git push --tags                (código → GitHub)
                 docker buildx build --push                 (imagen → Docker Hub)
        │
6. CONSUMIR      docker pull  +  docker run                 (o desde Docker Desktop)
```

> **Regla de oro:** cierra la versión (paso 3) **antes** de construir la imagen (pasos 4/5).
> La versión del pie de página (`Versión [x.y.z] - fecha`) se **hornea en el build** leyendo
> `CHANGELOG.md`. Si construyes la imagen antes de mover el CHANGELOG, el contenedor mostrará
> la versión anterior.

## Las "versiones" deben coincidir

El mismo número vive en varios sitios. Todos deben cuadrar:

| Dónde | Qué es | Cómo se pone |
| --- | --- | --- |
| `CHANGELOG.md` → `## [x.y.z]` | **Fuente de verdad** | A mano al cerrar versión |
| `package.json` → `"version"` | Metadato npm | A mano (bump) + `npm install` (sincroniza el lock) |
| `git tag vx.y.z` | Marcador en el historial | `git tag` |
| Tag de Docker `:x.y.z` | Etiqueta de la imagen | `-t mzrgh/tests-opo:x.y.z` al construir |
| Pie de la web | Derivado | **Automático**: `next build` lee el CHANGELOG |

## Los dos builds de Docker (no confundir)

| | `docker build` / `docker compose up --build` | `docker buildx build --push` |
| --- | --- | --- |
| **Para qué** | Probar el contenedor en tu Mac | Publicar en Docker Hub |
| **Arquitecturas** | Solo la tuya (arm64) | Multi-arch (amd64 + arm64) |
| **Dónde queda** | Local (Docker Desktop) | Sube directo al registro |
| **Cuándo** | Paso 4 (verificar) | Paso 5 (publicar) |

> Multi-arch (amd64 + arm64) **solo hace falta si compartes la imagen con equipos en
> Intel/Windows**. Si es solo para tu Mac (Apple Silicon), el build normal arm64 basta y
> te ahorras la emulación QEMU (lenta y propensa a tirar el builder).

---

## Paso 3 — Cerrar la versión

1. En `CHANGELOG.md`, mueve lo de `## [No publicado]` a una entrada nueva
   `## [x.y.z] - AAAA-MM-DD` y deja en `[No publicado]` solo lo pendiente. Actualiza los
   enlaces del final (`[No publicado]: ...compare/vx.y.z...HEAD` y `[x.y.z]: ...tag/vx.y.z`).
2. Sube la versión en `package.json` y sincroniza el lock:
   ```bash
   npm install        # actualiza package-lock.json a la nueva versión
   ```
3. Commits + tag:
   ```bash
   git add -A
   git commit -m "feat: ..."            # el feature (el hook exige CHANGELOG tocado)
   git commit -m "chore(release): vx.y.z" --allow-empty   # si el bump va aparte
   git tag vx.y.z
   ```

> El hook `commit-msg` bloquea commits que tocan código (`app/`, `lib/`, `supabase/`,
> `package.json`, `next.config.mjs`, `Dockerfile`, `docker-compose.yml`) sin actualizar
> `CHANGELOG.md`. Escape: `[skip changelog]` en el mensaje o `git commit --no-verify`.

## Paso 4 — Probar el contenedor en local

```bash
docker compose up --build
```
- `--build` reconstruye la imagen con el código actual.
- `compose` lee tu `.env.local` automáticamente (`env_file` en `docker-compose.yml`).
- Abre http://localhost:3000 y comprueba: arranca, el pie muestra la versión correcta y el
  perfil (Gestor/Estudiante) responde a `ENABLE_TEMARIO_MANAGEMENT`.
- Parar: `Ctrl+C` y luego `docker compose down`.

Sin compose:
```bash
docker build -t tests-opo:x.y.z -t tests-opo:latest .
docker run --rm -p 3000:3000 --env-file .env.local tests-opo:x.y.z
```

> El `.env.local` **no está dentro de la imagen** (lo excluye `.dockerignore`); se inyecta
> al arrancar. La misma imagen sirve para perfil Gestor o Estudiante según el `.env.local`
> que traiga cada quien.

## Paso 5 — Publicar

Código a GitHub:
```bash
git push && git push --tags
```

Imagen a Docker Hub (login una sola vez, queda en el keychain de macOS):
```bash
docker login -u mzrgh
```

Multi-arch + push en un paso:
```bash
docker buildx create --use --name multi 2>/dev/null || docker buildx use multi
docker buildx build --platform linux/amd64,linux/arm64 \
  -t mzrgh/tests-opo:x.y.z \
  -t mzrgh/tests-opo:latest \
  --push .
```

Solo tu arquitectura (más rápido, sin multi-arch):
```bash
docker build -t mzrgh/tests-opo:x.y.z -t mzrgh/tests-opo:latest .
docker push mzrgh/tests-opo:x.y.z
docker push mzrgh/tests-opo:latest
```

Verificar el manifest publicado (debe listar `linux/amd64` y `linux/arm64`):
```bash
docker buildx imagetools inspect mzrgh/tests-opo:x.y.z
```

> **Si el builder multi-arch se cae** (`graceful_stop` / `EOF`, típico al emular amd64 en
> Apple Silicon): recréalo y reintenta (la caché acelera el reintento):
> ```bash
> docker buildx rm multi
> docker buildx create --name multi --driver docker-container --use
> docker buildx inspect multi --bootstrap
> ```

## Paso 6 — Consumir / ejecutar desde Docker Desktop

**En tu Mac (donde construiste la imagen):** ya está en Docker Desktop → pestaña **Images**.
No necesitas `pull`.

**En otra máquina (o para traer la del registro):**
```bash
docker pull mzrgh/tests-opo:latest
```

**Ejecutar por CLI (recomendado: usa tu `.env.local` de un golpe):**
```bash
docker run --rm -p 3000:3000 --env-file .env.local mzrgh/tests-opo:latest
# -d para segundo plano; docker ps + docker stop <id> para pararlo
```

**Ejecutar desde la GUI de Docker Desktop:**
1. **Images** → `mzrgh/tests-opo` → **Run**.
2. **Optional settings** → **Ports**: Host port `3000`.
3. **Environment variables**: la GUI **no** lee tu `.env.local`; mete las variables a mano,
   o mejor arranca por CLI con `--env-file`.
4. Run → http://localhost:3000.

---

## Receta rápida (copia-pega por versión)

```bash
# 1-2. Código probado en dev
npm run typecheck && npm run build
npm run dev                      # verificación manual en localhost:3000

# 3. Cerrar versión: CHANGELOG → [x.y.z], bump package.json
npm install
git add -A && git commit -m "feat: ..." && git tag vX.Y.Z

# 4. Probar el contenedor
docker compose up --build        # localhost:3000 → Ctrl+C + docker compose down

# 5. Publicar
git push && git push --tags
docker login -u mzrgh            # solo si no hay sesión
docker buildx build --platform linux/amd64,linux/arm64 \
  -t mzrgh/tests-opo:X.Y.Z -t mzrgh/tests-opo:latest --push .

# 6. Consumir (otra máquina)
docker pull mzrgh/tests-opo:latest
docker run --rm -p 3000:3000 --env-file .env.local mzrgh/tests-opo:latest
```
