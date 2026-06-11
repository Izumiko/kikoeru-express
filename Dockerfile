FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build && rm build/*.map
RUN mkdir -p node_modules_slim/@libsql && cp -R node_modules/@libsql/*-x64* node_modules_slim/@libsql/ ; cp -R node_modules/@libsql/*-arm* node_modules_slim/@libsql/

FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules_slim ./node_modules
COPY --from=builder /app/package.json ./

RUN apk add --no-cache nodejs

ENV NODE_ENV=production

EXPOSE 8888

CMD ["node", "build/server.js"]
