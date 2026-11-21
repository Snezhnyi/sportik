# ---- build: typecheck + bundle the client ----
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Sub-path the app is served under behind a reverse proxy, e.g. /sportik/
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
RUN npm run build && npm test

# ---- runtime: API server + built client ----
FROM node:26-slim
ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/app/data/sportik.db \
    ALLOW_DEV_AUTH=0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 8787
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.ts"]
