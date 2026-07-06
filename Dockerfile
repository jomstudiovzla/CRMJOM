FROM node:18-alpine AS base

# Dependencias necesarias para Node y Next.js en Alpine
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Usamos un entorno de producción para el build
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Runner (Producción)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000

# Se agregan los paquetes para chromium o dependencias extra si luego necesitas whatsapp-web
# RUN apk add --no-cache chromium

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Solo copiar los archivos estrictamente necesarios para correr en producción
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/background_tasks.js ./background_tasks.js
COPY --from=builder /app/scripts ./scripts

# Next.js genera un server standalone en .next/standalone si se configura en next.config.mjs,
# pero como tenemos un custom server.js, usaremos node_modules completo (limitación del custom server).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src

USER nextjs

EXPOSE 3000

# Arranca usando el custom server de forma segura
CMD ["node", "server.js"]
