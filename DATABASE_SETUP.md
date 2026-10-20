# Facility Management ERP — Local Database Setup & Operations Guide

This guide describes how to run and manage the local PostgreSQL database, run migrations, seed dummy operational data, and reset the environment using Docker Compose.

---

## 1. Prerequisites

Ensure you have installed:
- [Docker Engine & Docker Compose](https://docs.docker.com/get-docker/) (v20.10+)
- [Node.js](https://nodejs.org/) (v20+ or v22+)
- [PostgreSQL Client (`psql`)](https://www.postgresql.org/download/) (optional, for direct CLI queries)

---

## 2. Environment Configuration

Copy the example environment file in the project root:

```bash
cp .env.example .env
```

Ensure the database parameters in your root `.env` or `backend/.env` match:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=erp_facility
POSTGRES_USER=erp_admin
POSTGRES_PASSWORD=local_secure_dev_password_2026

DATABASE_URL=postgresql://erp_admin:local_secure_dev_password_2026@localhost:5432/erp_facility

# MinIO Local Object Storage
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=ambeuploads
```

---

## 3. Starting the Local Environment

Start the PostgreSQL database and MinIO storage in the background:

```bash
# Start DB & Storage
docker compose up -d postgres minio

# Verify both services are healthy
docker compose ps
```

You should see:
```text
NAME           IMAGE                      COMMAND                  SERVICE    STATUS
erp-postgres   postgres:15-alpine         "docker-entrypoint.s…"   postgres   Up (healthy)
erp-minio      minio/minio:RELEASE...     "/opt/bin/minio serv…"   minio      Up (healthy)
```

---

## 4. Running Migrations

Database migrations are stored in sequential order under `backend/src/db/migrations/`.

### Automated Execution (via Docker Init)
When the `postgres` container starts for the first time with an empty volume, it automatically mounts and runs all `.sql` files found in `backend/src/db/migrations/` sequentially.

### Manual / CI Migration Execution
To execute migrations against an already running container:

```bash
# Execute all sequential migrations via bash / psql inside container:
docker exec -i erp-postgres psql -U erp_admin -d erp_facility << 'EOF'
\i /docker-entrypoint-initdb.d/01_create_refresh_tokens.sql
\i /docker-entrypoint-initdb.d/02_add_part_bonus_tracking.sql
\i /docker-entrypoint-initdb.d/03_add_bonus_disbursements.sql
\i /docker-entrypoint-initdb.d/04_add_rate_card_bonus_percent.sql
\i /docker-entrypoint-initdb.d/05_fixed_amount_bonus_system.sql
\i /docker-entrypoint-initdb.d/06_add_rate_card_remark.sql
\i /docker-entrypoint-initdb.d/07_add_staff_compliance_name.sql
\i /docker-entrypoint-initdb.d/07_add_staff_kyc_columns.sql
\i /docker-entrypoint-initdb.d/08_add_invoice_certification_columns.sql
\i /docker-entrypoint-initdb.d/09_separate_billing_and_payroll_rate_cards.sql
\i /docker-entrypoint-initdb.d/10_add_in_out_time_duration_to_attendance_records.sql
\i /docker-entrypoint-initdb.d/11_add_duration_text_and_unique_constraint.sql
\i /docker-entrypoint-initdb.d/12_backfill_weekly_off_attendance_records.sql
\i /docker-entrypoint-initdb.d/13_add_payroll_records_unique_constraint.sql
\i /docker-entrypoint-initdb.d/14_add_staff_offboarding_columns.sql
\i /docker-entrypoint-initdb.d/15_add_manual_pt_adjustment.sql
\i /docker-entrypoint-initdb.d/16_add_site_person_counts.sql
\i /docker-entrypoint-initdb.d/17_add_payslip_manual_override_columns.sql
EOF
```

---

## 5. Seed Data Setup

The initial seed script is located at `supabase/seed.sql`. To seed sample operating entities, test sites, and staff:

```bash
# Pipe seed.sql directly into the postgres container:
docker exec -i erp-postgres psql -U erp_admin -d erp_facility < supabase/seed.sql
```

---

## 6. Complete Database Reset (Wipe & Re-create)

> [!CAUTION]
> This command will permanently delete the local `erp_postgres_volume` volume and all local records.

```bash
# 1. Stop containers and destroy named persistent volumes
docker compose down -v

# 2. Re-launch fresh database and storage containers
docker compose up -d postgres minio

# 3. Check health status
docker compose ps
```

---

## 7. Connecting Directly to Local Postgres

### Via Command Line:
```bash
docker exec -it erp-postgres psql -U erp_admin -d erp_facility
```

### Via GUI Tools (DBeaver, TablePlus, pgAdmin):
- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `erp_facility`
- **User:** `erp_admin`
- **Password:** `local_secure_dev_password_2026`
- **SSL Mode:** `disable`
