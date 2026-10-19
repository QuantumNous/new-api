#!/usr/bin/env python3
"""Read-only ECS settlement v3 final status check."""
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "8.133.218.152"
USER = "ecs-user"
PASSWORD = "e4bA5e$27c4!"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=20, allow_agent=False, look_for_keys=False)


def run(title, cmd, t=60):
    print(f"\n===== {title} =====")
    _, out, err = c.exec_command(cmd, timeout=t)
    print(out.read().decode("utf-8", "replace"))
    e = err.read().decode("utf-8", "replace")
    if e.strip():
        print("ERR", e[:800])


run("1. process", "pgrep -af gen_on_server_v3.py || echo NO_PROC")
run("2. log tail", "tail -n 30 /tmp/settlement_v3_run.log 2>/dev/null || echo NO_LOG")
run(
    "3. summary",
    "if test -f /tmp/settlement_v3_summary.json; then echo HAS_SUMMARY; cat /tmp/settlement_v3_summary.json; else echo NO_SUMMARY; fi",
)

sql = r"""
USE `new-api`;
SELECT '--- users vs logs ---' AS section;
SELECT u.username, u.request_count, COALESCE(l.log_cnt,0) AS log_cnt,
  CASE WHEN u.request_count=COALESCE(l.log_cnt,0) THEN 'OK' ELSE 'MISMATCH' END AS status
FROM users u
LEFT JOIN (
  SELECT username, COUNT(*) AS log_cnt FROM logs WHERE username LIKE 'cust_%' AND type=2 GROUP BY username
) l ON u.username=l.username
WHERE u.username LIKE 'cust_%' ORDER BY u.username;

SELECT '--- VIDEO seedance ---' AS section;
SELECT username, COUNT(*) n,
  ROUND(MIN(quota/500000),4) min_p, ROUND(AVG(quota/500000),4) avg_p, ROUND(MAX(quota/500000),4) max_p
FROM logs WHERE username LIKE 'cust_%' AND type=2 AND model_name LIKE 'seedance%'
GROUP BY username ORDER BY username;

SELECT '--- TEXT non-seedance ---' AS section;
SELECT username, COUNT(*) n,
  ROUND(MIN(quota/500000),4) min_p, ROUND(AVG(quota/500000),4) avg_p, ROUND(MAX(quota/500000),4) max_p
FROM logs WHERE username LIKE 'cust_%' AND type=2 AND model_name NOT LIKE 'seedance%'
GROUP BY username ORDER BY username;
"""

sftp = c.open_sftp()
with sftp.file("/tmp/v3_status_ro.sql", "w") as f:
    f.write(sql)
sftp.close()

run(
    "4. MySQL",
    'docker cp /tmp/v3_status_ro.sql mysql:/tmp/v3_status_ro.sql && '
    'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 '
    '-t < /tmp/v3_status_ro.sql\' 2>/dev/null',
    t=180,
)
c.close()
print("\n===== DONE =====")
