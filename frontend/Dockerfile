# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG API_URL=http://backend:8000
ENV API_URL=${API_URL}
# Ensure standalone mode is used
ENV NEXT_OUTPUT_STANDALONE=true
# ⚡ OPTIMIZATION: Limit Node memory to avoid OOM on limited runners
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set correct permissions for Next.js cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build and static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Copy our custom server.js
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js

# 🚀 FINAL FIX: Manually copy node_modules to ensure http-proxy is found
# Next.js standalone mode sometimes misses dependencies used in custom server.js
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start using our custom server that supports WebSockets
CMD ["node", "server.js"]
