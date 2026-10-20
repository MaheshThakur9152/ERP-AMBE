# 08 — Dockerized Architecture & Production Deployment Plan

**Objective:** Standardize the entire ERP on containerized infrastructure with deterministic local development and immutable production deployments.

---

## 1. Container Architecture & Startup Dependencies

```text
                                  docker compose up -d
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
                [ erp-postgres ]                        [ erp-minio ]
                PostgreSQL 15-alpine                    MinIO S3 Storage
                Named: erp_postgres_volume              Named: erp_minio_volume
                Port: 5432                              Ports: 9000, 9001
                Healthcheck: pg_isready                 Healthcheck: curl live
                        │                                     │
                        └──────────────────┬──────────────────┘
                                           │ (service_healthy)
                                           ▼
                                    [ erp-backend ]
                                    Express 4.21 API Gateway
                                    Port: 5000
                                    Healthcheck: /api/health
                                           │ (service_healthy)
                                           ▼
                                    [ erp-frontend ]
                                    Vite React SPA on Nginx Alpine
                                    Port: 80 / 443
                                    Proxy: /api/* -> backend:5000
```

---

## 2. Container Production Hardening Standards

### 1. Multi-Stage Builds (Minimal Attack Surface)
- `backend/Dockerfile`:
  - Stage 1 (`builder`): Compiles TypeScript with `devDependencies` (`tsc`).
  - Stage 2 (`runner`): Copies only `dist/` and production `node_modules` (`npm prune --production`). Resulting image is < 180MB.
- `frontend/Dockerfile`:
  - Stage 1 (`builder`): Compiles React bundle via Vite.
  - Stage 2 (`runner`): Deploys static build into official lightweight Nginx Alpine container (< 35MB).

### 2. Non-Root Execution
- Containers must never run as `root` (UID 0).
- The backend runs as unprivileged user `appuser` (GID: `appgroup`).

### 3. Graceful Shutdown & Healthchecks
- Express backend listens for `SIGTERM` and `SIGINT`:
  - Closes HTTP server to stop accepting new requests.
  - Waits up to 10 seconds for in-flight database transactions to finish.
  - Closes `pg.Pool` connection sockets before calling `process.exit(0)`.

---

## 3. Local Development vs Production Commands

### Local Development (with live code reloading)
```bash
# 1. Start local PostgreSQL and MinIO
docker compose up -d postgres minio

# 2. Run backend locally in watch mode
cd backend
npm run dev

# 3. Run frontend locally in Vite dev mode
cd frontend
npm run dev
```

### Full Production Stack (via Docker Compose)
```bash
# Build immutable production images and launch stack in background
docker compose up -d --build

# Inspect running health status
docker compose ps

# View structured logs
docker compose logs -f backend
```
