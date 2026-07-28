# ── Stage 1: Install dependencies ────────────────────────
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Production image ─────────────────────────────
FROM node:18-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# certificates/ dir is intentionally NOT copied here —
# it is bind-mounted at runtime via docker-compose volumes
# so real certs are never baked into the image.
RUN chown -R appuser:appgroup /app

USER appuser

# Expose the prod port (matches PORT_PROD in .env)
EXPOSE 8082

CMD ["node", "index.js"]