# ── Imagen autocontenida de TESTS-OPO-Hector (Next.js standalone) ─────────────
# Multi-stage: deps → builder → runner. Resultado: imagen pequeña con Node +
# solo las dependencias necesarias + el build de producción.

# 1) Dependencias (incluye devDeps, necesarias para el build)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) Build de la aplicación
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3) Runtime mínimo
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuario no root (el grupo/usuario 'node' ya existe en la imagen base)
USER node

# Salida standalone: server.js + node_modules mínimos, estáticos y public.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
