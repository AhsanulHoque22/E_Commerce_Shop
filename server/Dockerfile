# Debian slim: Prisma's query engine needs OpenSSL libs; Alpine musl builds target libssl.so.1.1
# which current Alpine no longer ships. Bookworm ships OpenSSL 3 and matches Prisma's debian engine.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
# Avoid postinstall `prisma generate` before prisma/ exists; build stage runs generate.
RUN npm ci --ignore-scripts

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
# Skip postinstall: schema is not copied yet; use client generated in build stage.
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
EXPOSE 5000
CMD ["node", "dist/app.js"]
