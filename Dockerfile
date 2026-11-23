# One build, two images:
#   app  NestJS API, BullMQ worker and DB migrations (command chosen in docker-compose.prod.yml)
#   web  Angular console served by nginx (the shared Caddy sends /api/* to the API, everything else here)
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json nx.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
RUN npm ci --no-audit --no-fund
RUN npm run build -w @ai-insure/shared \
 && npm run build -w @ai-insure/db \
 && npm run build -w @ai-insure/api \
 && npm run build -w @ai-insure/worker \
 && npm run build -w @ai-insure/web
RUN npm prune --omit=dev

FROM node:22-slim AS app
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
# Override per service: services/api/dist/main.js | services/worker/dist/main.js | packages/db/dist/migrate.js
CMD ["node", "services/api/dist/main.js"]

FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html
EXPOSE 80
