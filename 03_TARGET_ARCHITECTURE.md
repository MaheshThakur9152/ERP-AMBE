# 03 — Target Enterprise Architecture

**Goal:** Clean, decoupled, production-grade 3-tier architecture with zero third-party platform lock-in.

---

## 1. System Architecture Diagram

```text
                                   INTERNET
                                      │
                                      ▼
                        [ HTTPS / Nginx Reverse Proxy ]
                        (Port 443 SSL Termination, SPA Static Files)
                                      │
             ┌────────────────────────┴────────────────────────┐
             ▼                                                 ▼
    [ Static Assets / SPA ]                          [ API Traffic (/api/*) ]
    React 18 + Vite (dist)                           Upstream to Express
             │                                                 │
             └─────────────────(fetchWithRetry)────────────────┘
                                      │
                                      ▼
                 [ Express REST API Gateway (Port 5000) ]
  ┌────────────────────────────────────────────────────────────────────────┐
  │ • Security Middlewares: Helmet, Strict CORS, Rate Limiting, Cookies     │
  │ • Authentication: Asymmetric JWT Verification (RS256 / JWKS)           │
  │ • Multi-Tenant Context: Injects req.user { id, email, role, company_id }│
  │ • Authorization: Role-Based Access Control (RBAC Guard)                │
  │ • Audit Interceptor: Captures mutations into public.audit_logs          │
  │ • Request Validation: Strict Zod Schemas before service execution     │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
                           [ Domain Business Services ]
  ┌──────────────┬──────────────┬──────────────┬──────────────┬────────────┐
  │ Auth & Users │ Clients & WO │ Staff & Roster│ Attendance   │ Payroll    │
  ├──────────────┼──────────────┼──────────────┼──────────────┼────────────┤
  │ Invoicing    │ Payments     │ Expenses     │ Documents    │ Reports    │
  └──────────────┴──────────────┴──────────────┴──────────────┴────────────┘
                                      │
                                      ▼
                 [ Database Data Access Layer (pg.Pool) ]
  ┌────────────────────────────────────────────────────────────────────────┐
  │ • Connection Pool: 20-50 persistent PostgreSQL client sockets          │
  │ • Transaction Helper: db.transaction(async (tx) => { ... })            │
  │ • Safe Parametric Queries: $1, $2 (Zero SQL Injection)                 │
  │ • Atomic Sequences: Native SQL UPDATE ... RETURNING                    │
  └───────────────────┬────────────────────────────────┬───────────────────┘
                      │                                │
                      ▼                                ▼
         [ PostgreSQL 15+ Engine ]         [ MinIO / S3 Object Storage ]
         • Relational Normalized Schema    • Compressed PDF & KYC Storage
         • Foreign Keys & Cascades         • Time-Limited Pre-signed URLs
         • Composite Performance Indexes   • Automated Bucket Lifecycle
```

---

## 2. Layer Responsibilities & Technical Standards

### Layer 1: Client Application (React 18 SPA)
- **Role:** Pure presentation and user interaction.
- **Protocol:** HTTP/2 over TLS 1.3 using JSON REST payloads.
- **Authentication:** In-memory access token + HTTP-only rotating refresh token cookie.
- **Rule:** **Zero database client libraries.** The client knows only API endpoints (`/api/*`).

### Layer 2: API Gateway & Application Server (Express 4.21+)
- **Security:**
  - Strict Content-Security-Policy (CSP) and security headers via Helmet.
  - Rate limiting: 100 req/min for general API, 5 req/min for auth login.
- **Authentication:**
  - Replaces Supabase Auth with custom JWT issuing service.
  - Access tokens signed via RS256 private key; verified via public key.
  - Exposes `/.well-known/jwks.json` for key transparency.
- **Authorization & Multi-Tenancy:**
  - Token payload explicitly embeds `company_id`.
  - Service functions accept `user: AuthUser` and automatically scope queries:
    ```sql
    WHERE company_id = $1 AND id = $2
    ```

### Layer 3: Database Data Access Layer (`backend/src/db/pool.ts`)
- **Connection Management:** Single pooled instance of `pg.Pool` from `node-postgres`.
- **Transaction Pattern:**
  ```typescript
  export async function withTransaction<T>(
    callback: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  ```

### Layer 4: Storage Infrastructure (MinIO / S3)
- Retains `OracleStorageService` pattern using `@aws-sdk/client-s3`.
- Storage paths partitioned by tenant and entity:
  `{companyId}/{siteName}/{entityType}/{year}/{filename}`.
- Direct read access restricted; client downloads exclusively via pre-signed S3 URLs (60-minute TTL).

---

## 3. Standardized API Response & Error Contract

All backend endpoints must adhere to a deterministic JSON envelope:

### Successful Response:
```json
{
  "success": true,
  "data": {},
  "message": "Resource successfully created"
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "TENANT_ACCESS_DENIED",
    "message": "You do not have permission to access resources in this company",
    "details": {}
  }
}
```
