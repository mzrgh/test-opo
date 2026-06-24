/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Los PDFs de temario se suben vía Server Action (FormData). El límite por
    // defecto es 1 MB; lo subimos para admitir temarios razonablemente grandes.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
