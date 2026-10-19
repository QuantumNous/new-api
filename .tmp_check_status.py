#!/usr/bin/env python3
"""Read-only ECS settlement v3 progress check. No data mutation."""
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOST = "8.133.218.152"
USER = "ecs-user"
PASSWORD = "e4bA5e$27c4!"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=20, allow_agent=False, look_for_keys=False)

cmds = [
    ("1. process", "pgrep -af gen_on_server_v3.py || echo NO_PROC"),
    ("2. log tail", "tail -n 40 /tmp/settlement_v3_run.log 2>/dev/null || echo NO_LOG"),
    ("3. summary", "if test -f /tmp/settlement_v3_summary.json; then cat /tmp/settlement_v3_summary.json; else echo NO_SUMMARY; fi"),
]

def out(s: str) -> None:
    print(s, flush=True)

for title, cmd in cmds:
    out(f"\n===== {title} =====")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
    out(stdout.read().decode("utf-8", "replace"))
    e = stderr.read().decode("utf-8", "replace")
    if e.strip():
        out("ERR " + e[:500])

sql = r"""
USE `new-api`;
SELECT '--- users ---' AS section;
SELECT username, request_count, ROUND(used_quota/500000, 2) AS used_usd
FROM users WHERE username LIKE 'cust_%' ORDER BY username;

SELECT '--- logs type=2 count ---' AS section;
SELECT username, COUNT(*) AS log_cnt
FROM logs WHERE username LIKE 'cust_%' AND type=2
GROUP BY username ORDER BY username;

SELECT '--- VIDEO seedance unit price ---' AS section;
SELECT username,
  COUNT(*) AS n,
  ROUND(MIN(quota/500000), 4) AS min_p,
  ROUND(AVG(quota/500000), 4) AS avg_p,
  ROUND(MAX(quota/500000), 4) AS max_p
FROM logs
WHERE username LIKE 'cust_%' AND type=2 AND model_name LIKE 'seedance%'
GROUP BY username ORDER BY username;

SELECT '--- TEXT non-seedance unit price ---' AS section;
SELECT username,
  COUNT(*) AS n,
  ROUND(MIN(quota/500000), 4) AS min_p,
  ROUND(AVG(quota/500000), 4) AS avg_p,
  ROUND(MAX(quota/500000), 4) AS max_p
FROM logs
WHERE username LIKE 'cust_%' AND type=2 AND model_name NOT LIKE 'seedance%'
GROUP BY username ORDER BY username;
"""

out("\n===== 4/5. MySQL stats =====")
sftp = c.open_sftp()
with sftp.file("/tmp/v3_status_ro.sql", "w") as f:
    f.write(sql)
sftp.close()

stdin, stdout, stderr = c.exec_command(
    'docker cp /tmp/v3_status_ro.sql mysql:/tmp/v3_status_ro.sql && '
    'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 '
    '-t < /tmp/v3_status_ro.sql\' 2>/dev/null',
    timeout=180,
)
out(stdout.read().decode("utf-8", "replace"))
e = stderr.read().decode("utf-8", "replace")
if e.strip():
    out("ERR " + e[:800])

c.close()
out("\n===== DONE =====")
