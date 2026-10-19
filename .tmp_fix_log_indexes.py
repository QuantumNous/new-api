#!/usr/bin/env python3
"""Diagnose + add composite indexes for log self/stat performance."""
import time
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "8.133.218.152",
    username="ecs-user",
    password="e4bA5e$27c4!",
    timeout=20,
    allow_agent=False,
    look_for_keys=False,
)


def run(cmd, timeout=600):
    print("\n$", cmd[:200], flush=True)
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out[-6000:] if len(out) > 6000 else out, flush=True)
    if err.strip():
        print("ERR", err[-1500:], flush=True)
    print("exit", code, flush=True)
    return code, out


def mysql_file(sql: str, name: str, timeout=3600):
    sftp = c.open_sftp()
    path = f"/tmp/{name}"
    with sftp.file(path, "w") as f:
        f.write(sql)
    sftp.close()
    return run(
        f'docker cp {path} mysql:{path} && '
        f'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 < {path}\' 2>/dev/null',
        timeout=timeout,
    )


# 1) import still running?
run("pgrep -af '^python3 -u /tmp/gen_on_server_v3.py$' || echo DONE_PROC")
run("tail -n 8 /tmp/settlement_v3_run.log 2>/dev/null || true")
run("test -f /tmp/settlement_v3_summary.json && echo HAS_SUMMARY || echo NO_SUMMARY")

# 2) add indexes if missing
mysql_file(
    """
USE `new-api`;
-- for /api/log/self/stat (username + created_at range)
SELECT INDEX_NAME FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA='new-api' AND TABLE_NAME='logs' AND INDEX_NAME='idx_username_created_at';
SELECT INDEX_NAME FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA='new-api' AND TABLE_NAME='logs' AND INDEX_NAME='idx_user_id_created_at_type';
""",
    "idx_check.sql",
)

print("Creating indexes (may take several minutes on ~10M rows)...", flush=True)
t0 = time.time()
code, out = mysql_file(
    """
USE `new-api`;
SET SESSION lock_wait_timeout=10;
-- Ignore error if exists via procedure-ish checks in app; use IF NOT EXISTS pattern via dynamic SQL
SET @exist := (
  SELECT COUNT(1) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA='new-api' AND TABLE_NAME='logs' AND INDEX_NAME='idx_username_created_at'
);
SET @sql := IF(@exist=0,
  'ALTER TABLE logs ADD INDEX idx_username_created_at (username, created_at)',
  'SELECT \"idx_username_created_at already exists\"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist2 := (
  SELECT COUNT(1) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA='new-api' AND TABLE_NAME='logs' AND INDEX_NAME='idx_user_id_created_at_type'
);
SET @sql2 := IF(@exist2=0,
  'ALTER TABLE logs ADD INDEX idx_user_id_created_at_type (user_id, created_at, type)',
  'SELECT \"idx_user_id_created_at_type already exists\"');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SHOW INDEX FROM logs WHERE Key_name IN ('idx_username_created_at','idx_user_id_created_at_type');
ANALYZE TABLE logs;
""",
    "idx_add.sql",
    timeout=3600,
)
print("index_elapsed", round(time.time() - t0, 1), flush=True)

# 3) re-time the same query
mysql_file(
    """
USE `new-api`;
EXPLAIN SELECT COALESCE(SUM(CASE WHEN type = 2 THEN quota WHEN type = 6 THEN -quota ELSE 0 END), 0) AS quota
FROM logs
WHERE username='cust_bjyt' AND created_at >= 1790179200 AND created_at <= 1790242446;

SELECT COALESCE(SUM(CASE WHEN type = 2 THEN quota WHEN type = 6 THEN -quota ELSE 0 END), 0) AS quota
FROM logs
WHERE username='cust_bjyt' AND created_at >= 1790179200 AND created_at <= 1790242446;
""",
    "idx_bench.sql",
    timeout=300,
)

c.close()
print("DONE", flush=True)
