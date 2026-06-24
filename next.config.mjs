/** @type {import('next').NextConfig} */
const nextConfig = {
  // Genera un servidor Node autocontenido en .next/standalone (para Docker).
  output: "standalone",
  // Sin optimización de imágenes (evita depender de sharp en Alpine); el único
  // next/image es el logo, irrelevante optimizar.
  images: {
    unoptimized: true,
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
