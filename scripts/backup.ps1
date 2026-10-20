# ==============================================================================
# Enterprise Facility Management ERP — Automated PostgreSQL Backup (PowerShell)
# ==============================================================================
param (
  [string]$BackupDir = "./backups",
  [int]$RetentionDays = 30,
  [string]$DbUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "erp_facility_backup_$Timestamp.sql"
$CompressedFile = "$BackupFile.gz"

Write-Host "📦 Starting ERP PostgreSQL backup..." -ForegroundColor Cyan

if ($DbUrl) {
  & pg_dump $DbUrl --clean --if-exists --no-owner --no-privileges -f $BackupFile
} else {
  $env:PGHOST = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "localhost" }
  $env:PGPORT = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
  $env:PGDATABASE = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "erp_facility" }
  $env:PGUSER = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "erp_admin" }
  if ($env:POSTGRES_PASSWORD) { $env:PGPASSWORD = $env:POSTGRES_PASSWORD } else { $env:PGPASSWORD = "postgres" }

  & pg_dump --clean --if-exists --no-owner --no-privileges -f $BackupFile
}

if ($LASTEXITCODE -ne 0) {
  Write-Error "❌ pg_dump failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

# Compress if gzip/tar is available, else keep .sql
if (Get-Command "gzip" -ErrorAction SilentlyContinue) {
  & gzip -f $BackupFile
  $FinalFile = $CompressedFile
} else {
  $FinalFile = $BackupFile
}

$Size = (Get-Item $FinalFile).Length / 1KB
Write-Host "✅ Backup created: $FinalFile ($([math]::Round($Size, 2)) KB)" -ForegroundColor Green

# Retention cleanup
$Cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "erp_facility_backup_*" | Where-Object { $_.LastWriteTime -lt $Cutoff } | ForEach-Object {
  Write-Host "🧹 Deleting old backup: $($_.Name)" -ForegroundColor Yellow
  Remove-Item $_.FullName -Force
}

Write-Host "🏁 Backup completed." -ForegroundColor Cyan
