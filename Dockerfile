# ---- Build Stage ----
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-slim AS runner

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy runtime source files (tsx compiles them on-the-fly)
COPY server/ ./server/
COPY services/ ./services/
COPY types.ts .
COPY index.html .

# Ensure data directories exist
RUN mkdir -p uploads db config

ENV NODE_ENV=production
ENV PORT=3000
# Enable remote access in Docker (nginx proxy manager handles external routing)
ENV ENABLE_REMOTE_ACCESS=true

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
