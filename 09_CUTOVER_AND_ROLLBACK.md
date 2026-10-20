# 09 — Production Cutover & Emergency Rollback Runbook

**Target:** Zero-Downtime Migration from Supabase to Self-Hosted PostgreSQL & Express Data Layer  
**Risk Level:** HIGH (Live Business ERP)  
**Execution Window:** Scheduled low-traffic maintenance window (e.g. Sunday 22:00 – 02:00 IST)

---

## 1. Pre-Cutover Verification Checklist (T - 24 Hours)

- [ ] **T-24h:** Confirm latest encrypted GitHub Actions backup can be decrypted cleanly using `RESTORE.md`.
- [ ] **T-12h:** Run test restore against an isolated local PostgreSQL container (`erp-postgres`). Confirm row counts match Supabase.
- [ ] **T-4h:** Verify MinIO storage bucket has all historical document files synced via Rclone.
- [ ] **T-2h:** Notify company operations managers of 30-minute read-only maintenance window.
- [ ] **T-30m:** Verify DNS TTL on `api.ambeservice.com` is set to 300s (5 minutes).

---

## 2. Cutover Execution Protocol (T = 0)

```text
[Step 1: Maintenance Mode] ──► [Step 2: Final DB Dump] ──► [Step 3: Restore to Standalone PG]
                                                                        │
[Step 6: Traffic Switch]  ◄── [Step 5: Smoke Testing] ◄── [Step 4: Run Normalization Migrations]
```

### Step 1: Enable Maintenance Mode (T + 00:00)
Prevent new writes on the live ERP during the final data snapshot:
```bash
# In frontend, toggle maintenance banner or route to maintenance static page
curl -X POST https://api.ambeservice.com/api/admin/maintenance -H "Authorization: Bearer $SUPERADMIN_TOKEN" -d '{"enabled": true}'
```

### Step 2: Final Data Sync & Export (T + 00:05)
Trigger manual backup or execute live pg_dump from Supabase:
```bash
SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require"
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-acl -f "final_prod_dump_$(date +%F_%H%M).dump"
```

### Step 3: Restore to Target PostgreSQL (T + 00:15)
```bash
TARGET_DB="postgresql://erp_admin:[PASSWORD]@localhost:5432/erp_facility"
pg_restore -d "$TARGET_DB" --clean --if-exists "final_prod_dump_$(date +%F_%H%M).dump"
```

### Step 4: Run Target Normalization Migrations (T + 00:20)
```bash
# Run normalization migrations (clients, work_orders, invoice_items, performance indexes)
docker exec -i erp-postgres psql -U erp_admin -d erp_facility < backend/src/db/migrations/final_normalization.sql
```

### Step 5: Verification & Smoke Test (T + 00:25)
1. **Health Check:** `curl -f http://localhost:5000/api/health`
2. **Auth Verification:** Login as SuperAdmin; verify JWT claims and refresh token cookie.
3. **Data Parity:** Compare staff count, invoice count, and company profiles against Supabase.
4. **Storage Check:** Generate pre-signed URL for an existing employee KYC document; verify image loads in browser.

### Step 6: Traffic Cutover (T + 00:35)
Update Nginx reverse proxy configuration to route `/api/*` traffic to the new containerized Express backend.

---

## 3. Emergency Abort & Rollback Runbook

### Abort Criteria (Trigger Rollback immediately if):
1. Final database restore fails or row counts have > 0.1% variance.
2. SuperAdmin login fails and cannot be authenticated.
3. Document storage pre-signed URLs return 404 on critical client agreements.
4. Total execution time exceeds 45 minutes of downtime.

### Rollback Procedure:
```bash
# 1. Revert Nginx upstream back to the old systemd service (Port 5000 / old binary)
sudo cp /etc/nginx/conf.d/ambeservice.conf.bak /etc/nginx/conf.d/ambeservice.conf
sudo nginx -s reload

# 2. Restart legacy systemd service
sudo systemctl restart ambeservice

# 3. Verify legacy service health
curl -f http://127.0.0.1:5000/api/health

# 4. Disable maintenance banner
curl -X POST https://api.ambeservice.com/api/admin/maintenance -d '{"enabled": false}'
```

**Zero-Data-Loss Guarantee:** Because the original Supabase database was placed in read-only mode during cutover and **never modified or dropped**, rolling back takes < 60 seconds and restores 100% of historical production data without loss.
