import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const baseDir = dirname(fileURLToPath(import.meta.url));

/**
 * Versión que se muestra en el pie. FUENTE ÚNICA: CHANGELOG.md.
 * Toma la primera versión publicada (`## [x.y.z] - YYYY-MM-DD`), ignorando
 * `## [No publicado]`. Se resuelve en build y se inyecta vía `env`, así no hay
 * que leer ficheros en runtime (clave para el contenedor Docker).
 */
function leerVersionChangelog() {
  try {
    const txt = readFileSync(join(baseDir, "CHANGELOG.md"), "utf8");
    const m = txt.match(/^##\s*\[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/m);
    if (m) return { version: m[1], fecha: m[2] };
  } catch {
    // CHANGELOG no disponible en el contexto de build: caemos a package.json.
  }
  try {
    const pkg = JSON.parse(readFileSync(join(baseDir, "package.json"), "utf8"));
    return { version: pkg.version ?? "0.0.0", fecha: "" };
  } catch {
    return { version: "0.0.0", fecha: "" };
  }
}

const { version: APP_VERSION, fecha: APP_VERSION_DATE } = leerVersionChangelog();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Genera un servidor Node autocontenido en .next/standalone (para Docker).
  output: "standalone",
  // Sin optimización de imágenes (evita depender de sharp en Alpine); el único
  // next/image es el logo, irrelevante optimizar.
  images: {
    unoptimized: true,
  },
  // Versión de la app (del CHANGELOG), inlineada en build para mostrarla en el pie.
  env: {
    APP_VERSION,
    APP_VERSION_DATE,
  },
  experimental: {
    // Los PDFs de temario se suben vía Server Action (FormData). El límite por
    // defecto es 1 MB; lo subimos para admitir temarios razonablemente grandes.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
