#!/usr/bin/env python3
"""Add log indexes online with longer wait; re-benchmark self/stat query."""
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
    print("\n$", cmd[:220], flush=True)
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out[-8000:] if len(out) > 8000 else out, flush=True)
    if err.strip():
        print("ERR", err[-2000:], flush=True)
    print("exit", code, flush=True)
    return code, out, err


def mysql(sql: str, name: str, timeout=7200):
    sftp = c.open_sftp()
    path = f"/tmp/{name}"
    with sftp.file(path, "w") as f:
        f.write(sql)
    sftp.close()
    # keep stderr so we see lock errors
    return run(
        f"docker cp {path} mysql:{path} && "
        f"docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" --default-character-set=utf8mb4 < {path}'",
        timeout=timeout,
    )


run("pgrep -af '^python3 -u /tmp/gen_on_server_v3.py$' || echo DONE_PROC")
run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SHOW PROCESSLIST;
"' 2>/dev/null | head -40"""
)

print("Adding indexes online...", flush=True)
t0 = time.time()
code, out, err = mysql(
    """
USE `new-api`;
SET SESSION lock_wait_timeout = 600;
SET SESSION innodb_lock_wait_timeout = 600;

SELECT INDEX_NAME FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA='new-api' AND TABLE_NAME='logs'
   AND INDEX_NAME IN ('idx_username_created_at','idx_user_id_created_at_type');

-- username + created_at for /api/log/self/stat
SET @e1 := (
  SELECT COUNT(1) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA='new-api' AND TABLE_NAME='logs' AND INDEX_NAME='idx_username_created_at'
);
SET @s1 := IF(@e1=0,
  'ALTER TABLE logs ADD INDEX idx_username_created_at (username, created_at), ALGORITHM=INPLACE, LOCK=NONE',
  'SELECT \"skip idx_username_created_at\" AS msg');
PREPARE p1 FROM @s1; EXECUTE p1; DEALLOCATE PREPARE p1;

SET @e2 := (
  SELECT COUNT(1) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA='new-api' AND TABLE_NAME='logs' AND INDEX_NAME='idx_user_id_created_at_type'
);
SET @s2 := IF(@e2=0,
  'ALTER TABLE logs ADD INDEX idx_user_id_created_at_type (user_id, created_at, type), ALGORITHM=INPLACE, LOCK=NONE',
  'SELECT \"skip idx_user_id_created_at_type\" AS msg');
PREPARE p2 FROM @s2; EXECUTE p2; DEALLOCATE PREPARE p2;

SHOW INDEX FROM logs WHERE Key_name IN ('idx_username_created_at','idx_user_id_created_at_type');
""",
    "idx_add2.sql",
    timeout=7200,
)
print("index_elapsed_sec", round(time.time() - t0, 1), flush=True)

# Force EXPLAIN + timed query matching SumUsedQuota type=0
t0 = time.time()
mysql(
    """
USE `new-api`;
EXPLAIN SELECT COALESCE(SUM(CASE WHEN type = 2 THEN quota WHEN type = 6 THEN -quota ELSE 0 END), 0) AS quota
FROM logs
WHERE username='cust_bjyt' AND created_at >= 1790179200 AND created_at <= 1790242446\\G

SELECT COALESCE(SUM(CASE WHEN type = 2 THEN quota WHEN type = 6 THEN -quota ELSE 0 END), 0) AS quota
FROM logs
WHERE username='cust_bjyt' AND created_at >= 1790179200 AND created_at <= 1790242446;
""",
    "idx_bench2.sql",
    timeout=300,
)
print("bench_wall_sec", round(time.time() - t0, 1), flush=True)

c.close()
print("ALL_DONE", flush=True)
