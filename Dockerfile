# syntax=docker/dockerfile:1
# Node 22 remains supported Maintenance LTS through April 2027.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci
RUN node -e "const D=require('better-sqlite3'); const db=new D(':memory:'); db.prepare('SELECT 1').get(); db.close()"
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/planner.db
RUN groupadd --gid 10001 planner && useradd --uid 10001 --gid planner --no-create-home planner && mkdir /app/data /app/backups && chown planner:planner /app/data /app/backups
COPY --from=build --chown=planner:planner /app/.next/standalone ./
COPY --from=build --chown=planner:planner /app/.next/static ./.next/static
COPY --from=build --chown=planner:planner /app/public ./public
COPY --from=build --chown=planner:planner /app/drizzle ./drizzle
# Copy complete migration/native packages: tracing alone may omit CLI-only files.
COPY --from=build /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --chown=planner:planner scripts/deploy-db.mjs scripts/container-entrypoint.sh ./scripts/
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "scripts/container-entrypoint.sh"]
CMD ["node", "server.js"]
