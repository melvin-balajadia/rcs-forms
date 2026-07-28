# ── Stage 1: Build the Vite app ───────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx over HTTPS ──────────────────
FROM nginx:stable-alpine AS runner

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 443 = HTTPS (mapped to CLIENT_PORT on host)
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]