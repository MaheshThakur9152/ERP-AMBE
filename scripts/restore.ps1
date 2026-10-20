# ==============================================================================
# Enterprise Facility Management ERP — PostgreSQL Restore (PowerShell)
# ==============================================================================
param (
  [Parameter(Mandatory=$true)]
  [string]$BackupFile,
  [string]$DbUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
  Write-Error "❌ Backup file not found: $BackupFile"
  exit 1
}

Write-Host "⚠️ Restoring will overwrite existing data in the target database." -ForegroundColor Yellow
Write-Host "Target: $(if ($DbUrl) { $DbUrl } else { 'erp_facility' })" -ForegroundColor Yellow
Write-Host "File: $BackupFile" -ForegroundColor Yellow

$TargetSql = $BackupFile
$IsTemp = $false

if ($BackupFile.EndsWith(".gz")) {
  if (Get-Command "gzip" -ErrorAction SilentlyContinue) {
    $TargetSql = [System.IO.Path]::ChangeExtension($BackupFile, $null)
    & gzip -dc $BackupFile | Out-File -FilePath $TargetSql -Encoding utf8
    $IsTemp = $true
  } else {
    Write-Error "gzip utility not found. Please decompress $BackupFile first."
    exit 1
  }
}

try {
  if ($DbUrl) {
    & psql $DbUrl -f $TargetSql
  } else {
    $env:PGHOST = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "localhost" }
    $env:PGPORT = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
    $env:PGDATABASE = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "erp_facility" }
    $env:PGUSER = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "erp_admin" }
    if ($env:POSTGRES_PASSWORD) { $env:PGPASSWORD = $env:POSTGRES_PASSWORD } else { $env:PGPASSWORD = "postgres" }

    & psql -f $TargetSql
  }
  Write-Host "✅ Database restore completed successfully." -ForegroundColor Green
} finally {
  if ($IsTemp -and (Test-Path $TargetSql)) {
    Remove-Item $TargetSql -Force
  }
}
