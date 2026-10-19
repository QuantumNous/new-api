#!/usr/bin/env python3
"""Deploy: add log indexes, then import ONLY cust_bjyt_use."""
import time
from pathlib import Path

import paramiko

HOST = "8.133.218.152"
USER = "ecs-user"
PASSWORD = "e4bA5e$27c4!"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=20, allow_agent=False, look_for_keys=False)


def run(cmd, timeout=600):
    print("\n$", cmd[:240], flush=True)
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out[-10000:] if len(out) > 10000 else out, flush=True)
    if err.strip():
        print("ERR", err[-2000:], flush=True)
    print("exit", code, flush=True)
    return code, out


def mysql_sql(sql: str, name: str, timeout=7200):
    sftp = c.open_sftp()
    path = f"/tmp/{name}"
    with sftp.file(path, "w") as f:
        f.write(sql)
    sftp.close()
    return run(
        f"docker cp {path} mysql:{path} && "
        f"docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" --default-character-set=utf8mb4 < {path}'",
        timeout=timeout,
    )


# baseline
run("df -h / | tail -1")
run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
PURGE BINARY LOGS BEFORE NOW();
SELECT username, request_count FROM users WHERE username LIKE \"cust_%\" ORDER BY username;
SELECT username, COUNT(*) FROM logs WHERE username LIKE \"cust_%\" AND type=2 GROUP BY username ORDER BY username;
"' 2>/dev/null""",
    timeout=300,
)

# indexes first (no concurrent LOAD)
print("Adding indexes...", flush=True)
t0 = time.time()
mysql_sql(
    """
USE `new-api`;
SET SESSION lock_wait_timeout=600;
SET SESSION innodb_lock_wait_timeout=600;
SET @e1 := (SELECT COUNT(1) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='new-api' AND TABLE_NAME='logs' AND INDEX_NAME='idx_username_created_at');
SET @s1 := IF(@e1=0,'ALTER TABLE logs ADD INDEX idx_username_created_at (username, created_at), ALGORITHM=INPLACE, LOCK=NONE','SELECT \"skip1\"');
PREPARE p1 FROM @s1; EXECUTE p1; DEALLOCATE PREPARE p1;
SET @e2 := (SELECT COUNT(1) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='new-api' AND TABLE_NAME='logs' AND INDEX_NAME='idx_user_id_created_at_type');
SET @s2 := IF(@e2=0,'ALTER TABLE logs ADD INDEX idx_user_id_created_at_type (user_id, created_at, type), ALGORITHM=INPLACE, LOCK=NONE','SELECT \"skip2\"');
PREPARE p2 FROM @s2; EXECUTE p2; DEALLOCATE PREPARE p2;
SHOW INDEX FROM logs WHERE Key_name IN ('idx_username_created_at','idx_user_id_created_at_type');
""",
    "add_log_idx.sql",
    timeout=7200,
)
print("index_sec", round(time.time() - t0, 1), flush=True)

# upload single-user importer
sftp = c.open_sftp()
sftp.put(
    str(Path(r"d:\nodejs\newapi\new-api\.tmp_settlement_gen\settlement_spec_v3.json")),
    "/tmp/settlement_spec_v3.json",
)
sftp.put(str(Path(r"d:\nodejs\newapi\new-api\.tmp_gen_bjyt_use_only.py")), "/tmp/gen_bjyt_use_only.py")
sftp.close()

run("python3 -c 'import bcrypt' 2>/dev/null || pip3 install bcrypt -q")
run("pkill -f '/tmp/gen_bjyt_use_only.py' 2>/dev/null; rm -f /tmp/settlement_bjyt_use_summary.json /tmp/settlement_bjyt_use_run.log; mkdir -p /tmp/settlement_v3")

run(
    "setsid env SETTLEMENT_MIN_FREE_GB=6 python3 -u /tmp/gen_bjyt_use_only.py cust_bjyt_use "
    "> /tmp/settlement_bjyt_use_run.log 2>&1 < /dev/null & echo PID:$!; sleep 2; "
    "pgrep -af '^python3 -u /tmp/gen_bjyt_use_only.py' || echo START_FAIL",
    timeout=30,
)

for i in range(240):
    time.sleep(30)
    code, out = run(
        "tail -n 15 /tmp/settlement_bjyt_use_run.log 2>/dev/null; echo ---; "
        "if pgrep -af '^python3 -u /tmp/gen_bjyt_use_only.py' >/dev/null; then echo RUNNING; else echo DONE_PROC; fi; "
        "if test -f /tmp/settlement_bjyt_use_summary.json; then echo HAS_SUMMARY; fi; "
        "df -h / | awk 'NR==2{print $3,$4,$5}'",
        timeout=90,
    )
    print(f"=== poll {i+1} ===", flush=True)
    if "HAS_SUMMARY" in out and "DONE_PROC" in out:
        break
    if "DONE_PROC" in out and "HAS_SUMMARY" not in out:
        print("FAILED", flush=True)
        run("tail -n 80 /tmp/settlement_bjyt_use_run.log")
        break
else:
    print("TIMEOUT", flush=True)

run("sudo systemctl restart new-api; sleep 2; curl -sS -m 5 -o /dev/null -w 'status=%{http_code}\\n' http://127.0.0.1:3000/api/status")
run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT username, request_count, ROUND(used_quota/500000,2) FROM users WHERE username LIKE \"cust_%\" ORDER BY username;
SELECT username, COUNT(*) FROM logs WHERE username LIKE \"cust_%\" AND type=2 GROUP BY username ORDER BY username;
SELECT \"VIDEO\", username, ROUND(MIN(quota/500000),2), ROUND(AVG(quota/500000),2), ROUND(MAX(quota/500000),2), COUNT(*)
FROM logs WHERE username=\"cust_bjyt_use\" AND type=2 AND model_name LIKE \"%seedance%\" GROUP BY username;
SELECT \"TEXT\", username, ROUND(MIN(quota/500000),2), ROUND(AVG(quota/500000),2), ROUND(MAX(quota/500000),2), COUNT(*)
FROM logs WHERE username=\"cust_bjyt_use\" AND type=2 AND model_name NOT LIKE \"%seedance%\" GROUP BY username;
"' 2>/dev/null""",
    timeout=600,
)
run("cat /tmp/settlement_bjyt_use_summary.json 2>/dev/null || echo NO_SUMMARY")

# quick stat bench
mysql_sql(
    """
USE `new-api`;
EXPLAIN SELECT COALESCE(SUM(CASE WHEN type=2 THEN quota WHEN type=6 THEN -quota ELSE 0 END),0) AS quota
FROM logs WHERE username='cust_bjyt' AND created_at>=1790179200 AND created_at<=1790242446;
SELECT COALESCE(SUM(CASE WHEN type=2 THEN quota WHEN type=6 THEN -quota ELSE 0 END),0) AS quota
FROM logs WHERE username='cust_bjyt' AND created_at>=1790179200 AND created_at<=1790242446;
""",
    "bench_stat.sql",
    timeout=120,
)

c.close()
print("DEPLOY ONE-USER FINISHED", flush=True)
