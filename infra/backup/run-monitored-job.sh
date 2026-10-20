#!/usr/bin/env bash
set -Eeuo pipefail

# Monitored Job Runner - ERP-AMBE
# Usage: run-monitored-job.sh <job_name> <command...>

if [[ $# -lt 2 ]]; then
  echo "ERROR: [run-monitored-job] Usage: $0 <job_name> <command...>" >&2
  exit 1
fi

JOB_NAME="$1"
shift
CMD=("$@")

LOG_FILE="/var/log/backup-jobs.log"
LOCK_FILE="/tmp/job_${JOB_NAME}.lock"
mkdir -p "$(dirname "$LOG_FILE")"

# Source environment
if [[ -f "/usr/local/bin/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/usr/local/bin/backup-config.sh"
elif [[ -f "/etc/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/etc/backup-config.sh"
fi

# Overlap guard
exec 200>"${LOCK_FILE}"
if ! flock -n 200; then
  echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [AUDIT] [${JOB_NAME}] BLOCKED: Previous execution still active" | tee -a "${LOG_FILE}"
  exit 75
fi

START_TIME=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
echo "${START_TIME} [AUDIT] [${JOB_NAME}] START: ${CMD[*]}" | tee -a "${LOG_FILE}"

EXIT_CODE=0
"${CMD[@]}" || EXIT_CODE=$?

END_TIME=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
if [[ ${EXIT_CODE} -eq 0 ]]; then
  STATUS="SUCCESS"
else
  STATUS="FAILED"
fi

echo "${END_TIME} [AUDIT] [${JOB_NAME}] ${STATUS}: exit_code=${EXIT_CODE}" | tee -a "${LOG_FILE}"

exit ${EXIT_CODE}
