FROM postgres:16-alpine
RUN apk --no-cache add aws-cli bash coreutils gnupg gzip jq su-exec tzdata
ENV TZ=UTC
RUN cp /usr/share/zoneinfo/UTC /etc/localtime && echo UTC > /etc/timezone
WORKDIR /backups
COPY infra/postgres/postgresql.conf /etc/postgresql/postgresql.conf
COPY infra/backup/backup-config.sh /usr/local/bin/backup-config.sh
COPY infra/backup/entrypoint.sh /usr/local/bin/backup-entrypoint.sh
COPY infra/backup/run-monitored-job.sh /usr/local/bin/run-monitored-job.sh
COPY infra/backup/logical-backup-job.sh /usr/local/bin/logical-backup-job.sh
COPY infra/backup/physical-base-backup.sh /usr/local/bin/physical-base-backup.sh
COPY infra/backup/weekly-logical-restore-test.sh /usr/local/bin/weekly-logical-restore-test.sh
COPY infra/backup/weekly-physical-restore-test.sh /usr/local/bin/weekly-physical-restore-test.sh
COPY infra/postgres/pg-restore-wal.sh /usr/local/bin/pg-restore-wal
RUN chmod 755 /usr/local/bin/backup-config.sh \
              /usr/local/bin/backup-entrypoint.sh \
              /usr/local/bin/run-monitored-job.sh \
              /usr/local/bin/logical-backup-job.sh \
              /usr/local/bin/physical-base-backup.sh \
              /usr/local/bin/weekly-logical-restore-test.sh \
              /usr/local/bin/weekly-physical-restore-test.sh \
              /usr/local/bin/pg-restore-wal
ENTRYPOINT ["/usr/local/bin/backup-entrypoint.sh"]
