# syntax=docker/dockerfile:1

FROM node:24-alpine3.23 AS builder

# Install OpenSSL required for Prisma engine compilation/downloads on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Bind both package.json and package-lock.json for deterministic builds
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci

# Copy full application source (including prisma/schema.prisma)
COPY . .

# Generate Prisma Client binaries explicitly before building TypeScript
RUN npx prisma generate

# Build TypeScript application
RUN npm run build
RUN npm run build:seed


# Deps stage: install production dependencies only
FROM node:24-alpine3.23 AS deps

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=builder /app/prisma ./prisma

RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci --omit=dev

# Ensure generated client engines exist in production node_modules
RUN npx prisma generate


# Runner stage: minimal runtime image
FROM node:24-alpine3.23 AS runner

# Install OpenSSL for Prisma engine execution at runtime
RUN apk add --no-cache openssl

ENV PATH=/app/node_modules/.bin:$PATH
ENV NODE_ENV=production

WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 4000

CMD ["node", "dist/main.js"]
