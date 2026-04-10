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

# Run pending migrations then start the app.
# If migrate deploy fails (e.g. a prior broken migration is recorded), resolve it and retry.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy || (echo 'Retrying: resolving stuck migration...' && node_modules/.bin/prisma migrate resolve --rolled-back 20260409020000_add_payment_method_portion 2>/dev/null; node_modules/.bin/prisma migrate deploy) && node dist/main"]
