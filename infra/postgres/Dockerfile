FROM postgres:16-alpine
RUN apk --no-cache add aws-cli bash curl coreutils gnupg
COPY infra/postgres/postgresql.conf /etc/postgresql/postgresql.conf
COPY infra/postgres/entrypoint-wrapper.sh /usr/local/bin/entrypoint-wrapper.sh
COPY infra/postgres/pg-archive-wal.sh /usr/local/bin/pg-archive-wal
COPY infra/postgres/pg-restore-wal.sh /usr/local/bin/pg-restore-wal
RUN chmod 755 /usr/local/bin/entrypoint-wrapper.sh \
              /usr/local/bin/pg-archive-wal \
              /usr/local/bin/pg-restore-wal
ENTRYPOINT ["/usr/local/bin/entrypoint-wrapper.sh"]
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
