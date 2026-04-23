# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install root (LMS) dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Install landing dependencies
COPY landing/package.json landing/package-lock.json ./landing/
RUN npm --prefix landing ci

# Copy all source
COPY . .

# Build landing + LMS + merge into dist/
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
