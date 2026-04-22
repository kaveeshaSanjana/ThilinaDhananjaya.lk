FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# --- Production image ---
FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Copy prisma CLI so we can run migrate deploy on startup
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY prisma ./prisma

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Run pending migrations with timeout, then start the app
# Use timeout to ensure the app starts even if migrations hang
CMD ["sh", "-c", "timeout 30 node_modules/.bin/prisma migrate deploy || true; node dist/main"]
