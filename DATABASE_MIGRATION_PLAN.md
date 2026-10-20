# Facility Management ERP — Database Strategy & Migration Plan

**Database Engine:** PostgreSQL 15+  
**Target Migration Pattern:** Client-Side PostgREST Elimination → Unified Backend Connection Pool & Normalized Relational Schema

---

## 1. Current Database State & Technology Evaluation

### Current Database Identity
```text
CURRENT DB:       PostgreSQL 15+ (Hosted on Supabase Cloud)
CURRENT CLIENT:   @supabase/supabase-js (PostgREST HTTP REST API)
CURRENT DRIVER:   node-postgres ('pg' package present in package.json but UNUSED)
CURRENT SCHEMA:   14 tables in 'public' schema + Supabase Auth schema
CURRENT STORAGE:  S3-compatible MinIO / Oracle Object Storage + Supabase Storage
```

### Should We Migrate to Another Engine?
**NO.** Under no circumstances should this ERP be migrated to MongoDB or a NoSQL database.
- Facility Management is an intrinsically relational domain:
  - A Client has multiple Sites.
  - A Site has multiple Work Orders.
  - A Work Order specifies Quotas and Billing Rates.
  - An Employee is deployed to a Site and has Attendance punches.
  - An Invoice aggregates Attendance days and Rate Cards.
  - Payments reconcile against Invoices.
- A document store (MongoDB) would require manual application-level joins, manual two-phase commit transactions, and would create massive data corruption risks across payroll and invoicing.
- **Decision:** Retain PostgreSQL as the sole relational database engine.

---

## 2. What MUST Change: The Database Access Architecture

While the engine remains PostgreSQL, the **data access mechanism must be fundamentally re-architected**:

### Current Flawed Access Pattern:
```text
Frontend React App ──(Direct PostgREST HTTP)──► Supabase Postgres
                                                       ▲
Backend Express API ──(Direct PostgREST HTTP)──────────┘
```
**Problems with current pattern:**
1. PostgREST executes single queries over HTTP. There is **no support for multi-statement ACID database transactions (`BEGIN ... COMMIT`)**.
2. Frontend holds write keys and bypasses backend validation and lock checks.
3. Every DB query incurs HTTP/TLS handshake and header serialization overhead.

### Target Production Access Pattern:
```text
Frontend React App ────(REST JSON / Bearer JWT)────► Backend Express API
                                                            │
                                                            │ Connection Pool (pg.Pool / ORM)
                                                            │ with ACID Transactions
                                                            ▼
                                                   PostgreSQL 15+ (Local or Cloud)
```
**Benefits:**
1. Guaranteed atomic transactions for Invoices, Payroll, and Attendance wipes.
2. Full isolation of database credentials behind backend network layer.
3. Connection pooling (20–50 persistent sockets) eliminating HTTP connection churn.
4. Complete local offline development without relying on external cloud endpoints.

---

## 3. Normalized Target Schema Design

To resolve the fractured JSONB blobs and missing entities identified in the audit, the schema is upgraded into a normalized enterprise schema:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    companies    │◄──────│     clients     │◄──────│      sites      │
└─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                             │
                                                             ▼
                                                    ┌─────────────────┐
                                                    │   work_orders   │
                                                    └────────┬────────┘
                                                             │
                                                             ▼
                                                    ┌─────────────────┐
                                                    │work_order_quotas│
                                                    └─────────────────┘
                                                             │
                                   ┌─────────────────────────┴────────────────────────┐
                                   ▼                                                  ▼
                         ┌───────────────────┐                              ┌───────────────────┐
                         │ site_deployments  │                              │    rate_cards     │
                         └─────────┬─────────┘                              └───────────────────┘
                                   │
                                   ▼
                         ┌───────────────────┐       ┌───────────────────┐
                         │   staff_members   │──────►│employee_documents │
                         └─────────┬─────────┘       └───────────────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │attendance_records │
                         └─────────┬─────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌──────────────────────┐                  ┌──────────────────────┐
   │    payroll_runs      │                  │       invoices       │
   └──────────┬───────────┘                  └──────────┬───────────┘
              │                                         │
              ▼                                         ▼
   ┌──────────────────────┐                  ┌──────────────────────┐
   │    payroll_items     │                  │    invoice_items     │
   └──────────────────────┘                  └──────────┬───────────┘
                                                        │
                                                        ▼
                                             ┌──────────────────────┐
                                             │   client_payments    │
                                             └──────────────────────┘
```

---

## 4. Entity Mapping: Old Models to New Normalized Tables

### 1. Clients (New Normalized Entity)
Extracts raw `sites.client_name` and `sites.gstin` into a dedicated table.

| Old Source | New Normalized Table | New Column | Type & Constraints | Rationale |
|---|---|---|---|---|
| `sites.client_name` | `clients` | `name` | `text NOT NULL` | Unifies client records |
| `sites.client_name` | `clients` | `legal_name` | `text` | Corporate legal title |
| `sites.gstin` | `clients` | `gstin` | `text` | Verified tax registration |
| `sites.company_id` | `clients` | `company_id` | `uuid REFERENCES companies(id)` | Multi-entity ownership |
| *New* | `clients` | `payment_terms_days` | `integer DEFAULT 30` | Commercial payment cycle |
| *New* | `clients` | `status` | `client_status_enum DEFAULT 'active'` | Lifecycle management |

---

### 2. Sites (Refactored)
Purges embedded JSONB rate cards and associates directly with `client_id`.

| Old Field | New Field | Type | Change / Rationale |
|---|---|---|---|
| `sites.id` | `sites.id` | `uuid PRIMARY KEY` | Unchanged |
| `sites.company_id` | `sites.company_id` | `uuid NOT NULL REFERENCES companies(id)` | Enforced FK |
| *Derived* | `sites.client_id` | `uuid NOT NULL REFERENCES clients(id)` | Replaces string `client_name` |
| `sites.site_name` | `sites.name` | `text NOT NULL` | Renamed for clarity |
| `sites.code_name` | `sites.code` | `text UNIQUE` | Short code (e.g. "DLF-T1") |
| `sites.management_fee_percent` | `sites.mgmt_fee_percent` | `numeric(5,2) DEFAULT 5.00` | Normalized decimal |
| `sites.rate_cards` (JSONB) | `site_billing_rates` (Table) | Normalized rows | Moves billing cards to table |
| `sites.person_work_order` | Purged | Handled in `work_order_quotas` | Removed denormalized field |
| `sites.person_worked_site` | Purged | Handled in `attendance_records` | Removed denormalized field |

---

### 3. Work Orders & Quotas (New Entities)

#### Table: `work_orders`
```sql
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  wo_number text NOT NULL UNIQUE,
  start_date date NOT NULL,
  end_date date,
  billing_frequency text NOT NULL DEFAULT 'monthly', -- 'monthly', 'bi_weekly'
  billing_type text NOT NULL DEFAULT 'attendance_based', -- 'attendance_based', 'fixed_headcount'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### Table: `work_order_quotas`
```sql
CREATE TABLE public.work_order_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  designation text NOT NULL,
  shift_type text NOT NULL DEFAULT 'General', -- 'Day', 'Night', 'General'
  contracted_headcount integer NOT NULL CHECK (contracted_headcount >= 0),
  monthly_billing_rate numeric(12,2) NOT NULL,
  daily_billing_rate numeric(12,2) GENERATED ALWAYS AS (monthly_billing_rate / 30.0) STORED,
  working_days_per_month integer NOT NULL DEFAULT 31,
  hsn_code text DEFAULT '9985'
);
```

---

### 4. Staff / Workforce (Hardened)

| Old Field | New Field | Type | Change / Rationale |
|---|---|---|---|
| `staff.id` | `staff_members.id` | `uuid PRIMARY KEY` | Unchanged |
| `staff.employee_name` | `staff_members.full_name` | `text NOT NULL` | Standardized naming |
| `staff.biometric_code` | `staff_members.biometric_code` | `text NOT NULL UNIQUE` | **Added UNIQUE constraint** |
| `staff.site_id` | `staff_members.primary_site_id` | `uuid REFERENCES sites(id)` | Designates home base site |
| `staff.rate_card_id` | `staff_members.payroll_rate_card_id`| `uuid REFERENCES rate_cards(id)` | Clear FK to salary structure |
| `staff.weekly_off` | `staff_members.weekly_off_day` | `smallint NOT NULL DEFAULT 0` | 0=Sun..6=Sat (Fast integer math) |
| `staff.status` | `staff_members.status` | `staff_status_enum` | 'onboarding','active','inactive','terminated' |
| *New* | `staff_members.deleted_at` | `timestamptz NULL` | Soft-delete support |

---

### 5. Invoices & Invoice Items (Normalized)

#### Master Table: `invoices`
- Preserves header metadata: `company_id`, `client_id`, `site_id`, `invoice_no`, `type`, `status`, `invoice_date`, `billing_period`.
- Eliminates JSONB array `line_items`.
- Subtotal, Tax Total, and Grand Total calculated from `invoice_items`.

#### Line Items Table: `invoice_items`
```sql
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'service', -- 'service', 'material', 'machinery', 'charge'
  description text NOT NULL,
  location text DEFAULT '',
  hsn_code text NOT NULL DEFAULT '9985',
  quantity numeric(10,2) NOT NULL DEFAULT 1.0, -- Persons or Units
  working_days numeric(6,2) NOT NULL DEFAULT 30.0,
  unit_rate numeric(12,2) NOT NULL,
  amount numeric(12,2) NOT NULL,
  cgst_rate numeric(5,2) DEFAULT 9.00,
  sgst_rate numeric(5,2) DEFAULT 9.00,
  igst_rate numeric(5,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
```

---

### 6. Client Payments & Ledger (New Financial Module)
```sql
CREATE TABLE public.client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  payment_date date NOT NULL,
  amount_received numeric(12,2) NOT NULL CHECK (amount_received > 0),
  tds_deducted numeric(12,2) DEFAULT 0.00,
  payment_mode text NOT NULL, -- 'NEFT', 'RTGS', 'Cheque', 'UPI'
  bank_reference text,
  remarks text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.invoice_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.client_payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  allocated_amount numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

---

### 7. Audit Log Table (New Governance Module)
```sql
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  action text NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOCK', 'UNLOCK', 'APPROVE'
  entity_type text NOT NULL, -- 'staff', 'invoice', 'attendance', 'rate_card', 'site'
  entity_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
```

---

## 5. Migration Execution Strategy (Zero Downtime)

The migration will be executed in four safe, non-destructive phases:

```text
Phase A: Additive Tables & Views (No existing code broken)
   ├── Create 'clients' table
   ├── Populate 'clients' from DISTINCT sites.client_name
   ├── Backfill sites.client_id
   ├── Create 'work_orders' & 'work_order_quotas'
   └── Create 'audit_logs'

Phase B: Backend Service Normalization
   ├── Switch backend from PostgREST to direct PostgreSQL connection pool (pg.Pool)
   ├── Wrap all mutations in db.transaction(async (client) => { ... })
   ├── Introduce atomic sequence increment function
   └── Add missing POST /api/staff and GET /api/clients routes

Phase C: Frontend Decoupling
   ├── Replace all direct Supabase calls in React components with fetchWithRetry(/api/*)
   ├── Remove VITE_SUPABASE_ANON_KEY from frontend production builds
   └── Enable restrictive PostgreSQL RLS denying all anon client writes

Phase D: Table Cleanup & Deprecations
   ├── Drop duplicate backup tables (rate_cards_migration_backup_09)
   └── Add NOT NULL constraints and foreign key cascade rules
```
