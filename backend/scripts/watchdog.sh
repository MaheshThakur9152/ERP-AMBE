#!/usr/bin/env bash
# ==============================================================================
# Health Check Watchdog & Auto-Restart Script for ambeservice
# Usage: Run via cron every minute:
#   * * * * * /path/to/backend/scripts/watchdog.sh >> /var/log/ambeservice-watchdog.log 2>&1
# ==============================================================================

HEALTH_URL="${HEALTH_CHECK_URL:-http://127.0.0.1:5000/api/health}"
SERVICE_NAME="${SERVICE_NAME:-ambeservice}"
STATE_FILE="/tmp/${SERVICE_NAME}_health_fails"
MAX_FAILURES=2
ALERT_WEBHOOK="${ALERT_WEBHOOK_URL:-}"

mkdir -p "$(dirname "$STATE_FILE")"
touch "$STATE_FILE"

FAILS=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
FAILS=${FAILS:-0}

# Curl deep health endpoint with 5s connect/max timeout
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 8 "$HEALTH_URL")

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ "$HTTP_CODE" -eq 200 ]; then
  if [ "$FAILS" -gt 0 ]; then
    echo "[$TIMESTAMP] [Watchdog] Health check RECOVERED (HTTP 200). Resetting fail counter."
    echo 0 > "$STATE_FILE"
  fi
else
  FAILS=$((FAILS + 1))
  echo "$FAILS" > "$STATE_FILE"
  echo "[$TIMESTAMP] [Watchdog] Health check FAILED with HTTP $HTTP_CODE (consecutive failures: $FAILS/$MAX_FAILURES)"

  if [ "$FAILS" -ge "$MAX_FAILURES" ]; then
    echo "[$TIMESTAMP] [Watchdog] CRITICAL: Reached $FAILS consecutive failures. Restarting $SERVICE_NAME..."

    # Restart the systemd service
    if command -v systemctl >/dev/null 2>&1; then
      systemctl restart "$SERVICE_NAME"
      echo "[$TIMESTAMP] [Watchdog] systemctl restart $SERVICE_NAME executed."
    else
      echo "[$TIMESTAMP] [Watchdog] systemctl not found, skipping restart command."
    fi

    # Reset failure counter after restart attempt
    echo 0 > "$STATE_FILE"

    # Send webhook alert if configured
    if [ -n "$ALERT_WEBHOOK" ]; then
      ALERT_PAYLOAD="{\"text\": \"🚨 [CRITICAL ALERT] $SERVICE_NAME failed health check ($HTTP_CODE). Auto-restarting service at $TIMESTAMP.\"}"
      curl -s -X POST -H "Content-Type: application/json" -d "$ALERT_PAYLOAD" "$ALERT_WEBHOOK" >/dev/null 2>&1
    fi
  fi
fi
