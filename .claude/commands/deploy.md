---
description: Release completo — cierra versión, commitea, publica en GitHub y sube la imagen multi-arch a Docker Hub
argument-hint: <x.y.z> (ej. 0.9.0)
---

*** NOTA DE @RGH: Este comando se ejecuta al final del ciclo de desarrollo y pruebas en local. Antes, probar siempre la aplicación con `npm run dev`. ***

Ejecuta el pipeline de release de `RELEASING.md` de principio a fin para la versión
`$ARGUMENTS`. Sigue los pasos EN ORDEN y **detente** (sin continuar) si alguno falla.

## Versión objetivo

- Versión = `$ARGUMENTS`. Debe tener formato `x.y.z`.
- Si `$ARGUMENTS` está vacío o no es `x.y.z`: NO inventes una. Lee el bloque
  `## [No publicado]` de `CHANGELOG.md` y el último `git tag`, propón la versión
  siguiente razonable (patch si solo hay correcciones, minor si hay features nuevas)
  y **pregunta al usuario** antes de seguir.

## Paso 0 — Pre-flight (verificar antes de tocar nada)

1. `git rev-parse --abbrev-ref HEAD` → confirma que estás en `main`. Si no, para y avisa.
2. Comprueba que la versión no exista ya: `git tag | grep -x "v$ARGUMENTS"` debe estar
   vacío. Si el tag ya existe, para (release duplicado).
3. Verifica sesión de Docker Hub SIN fiarte de `docker info` (con keychain da falso
   negativo): `docker-credential-desktop list 2>/dev/null | grep -i docker.io`.
   Si no aparece `mzrgh`/una credencial de `index.docker.io`, **para** y pide al
   usuario que haga `docker login -u mzrgh` en una Terminal propia (el login por `!`
   falla: "non TTY device").
4. `npm run typecheck && npm run build` → si falla cualquiera, para y reporta.

## Paso 1 — Cerrar la versión

1. En `CHANGELOG.md`: mueve el contenido de `## [No publicado]` a una entrada nueva
   `## [$ARGUMENTS] - AAAA-MM-DD` (usa la fecha de HOY). En `[No publicado]` deja solo
   la sección `### Pendiente`.
2. Actualiza los enlaces del final del fichero: cambia
   `[No publicado]: .../compare/vANTERIOR...HEAD` → `...compare/v$ARGUMENTS...HEAD` y
   añade una línea `[$ARGUMENTS]: .../releases/tag/v$ARGUMENTS`.
3. Bump y sincroniza el lock:
   ```bash
   npm version $ARGUMENTS --no-git-tag-version
   ```
   (actualiza `package.json` y `package-lock.json`).

## Paso 2 — Commit + tag

El hook `commit-msg` bloquea commits que tocan código sin actualizar `CHANGELOG.md`
(ya lo tocamos en el paso 1, así que pasa). Sigue el patrón del repo (feat + release):

```bash
git add -A
git commit -m "feat: <resumen de la versión>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git commit --allow-empty -m "chore(release): v$ARGUMENTS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git tag v$ARGUMENTS
```

Redacta el `<resumen de la versión>` a partir de lo que se mueve en el CHANGELOG.

## Paso 3 — Publicar el código en GitHub

```bash
git push origin main && git push origin v$ARGUMENTS
```
Verifica después que `git rev-parse HEAD` == `git rev-parse origin/main`.

## Paso 4 — Construir y publicar la imagen en Docker Hub (multi-arch)

Regla de oro: la imagen se construye DESPUÉS de cerrar la versión (el pie de página
se hornea leyendo `CHANGELOG.md`). Multi-arch `amd64 + arm64` (el amd64 se emula con
QEMU en Apple Silicon: puede tardar varios minutos — lánzalo en segundo plano).

```bash
docker buildx create --use --name multi 2>/dev/null || docker buildx use multi
docker buildx inspect multi --bootstrap >/dev/null 2>&1
docker buildx build --platform linux/amd64,linux/arm64 \
  -t mzrgh/tests-opo:$ARGUMENTS -t mzrgh/tests-opo:latest --push .
```

Si el builder multi-arch se cae (`graceful_stop` / `EOF`): recréalo y reintenta:
```bash
docker buildx rm multi
docker buildx create --name multi --driver docker-container --use
docker buildx inspect multi --bootstrap
```

## Paso 5 — Verificar

```bash
docker buildx imagetools inspect mzrgh/tests-opo:$ARGUMENTS
```
Confirma que el manifest lista `linux/amd64` y `linux/arm64` (los `unknown/unknown`
son attestations de buildx, es normal).

## Resumen final

Reporta al usuario, en tabla: versión, commits/tag creados, estado del push a GitHub,
tags de imagen publicados en Docker Hub y arquitecturas del manifest. Incluye el
comando para consumirla:
```bash
docker pull mzrgh/tests-opo:$ARGUMENTS
docker run --rm -p 3000:3000 --env-file .env.local mzrgh/tests-opo:$ARGUMENTS
```
