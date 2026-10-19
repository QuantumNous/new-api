#!/usr/bin/env python3
"""Fast read-only MySQL settlement counts."""
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

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

# Keep channel alive longer for heavy COUNT on large logs table
sql = r"""
USE `new-api`;
SELECT username, request_count FROM users WHERE username LIKE 'cust_%' ORDER BY username;
SELECT username, COUNT(*) AS log_cnt FROM logs WHERE username LIKE 'cust_%' AND type=2 GROUP BY username ORDER BY username;
SELECT 'VIDEO' AS kind, username, COUNT(*) n,
  ROUND(MIN(quota/500000),4) min_p, ROUND(AVG(quota/500000),4) avg_p, ROUND(MAX(quota/500000),4) max_p
FROM logs WHERE username LIKE 'cust_%' AND type=2 AND model_name LIKE 'seedance%'
GROUP BY username ORDER BY username;
SELECT 'TEXT' AS kind, username, COUNT(*) n,
  ROUND(MIN(quota/500000),4) min_p, ROUND(AVG(quota/500000),4) avg_p, ROUND(MAX(quota/500000),4) max_p
FROM logs WHERE username LIKE 'cust_%' AND type=2 AND model_name NOT LIKE 'seedance%'
GROUP BY username ORDER BY username;
"""

sftp = c.open_sftp()
with sftp.file("/tmp/v3_fast.sql", "w") as f:
    f.write(sql)
sftp.close()

# Run on server with nohup so we don't hold SSH channel forever; poll result file
cmd = (
    "rm -f /tmp/v3_fast.out /tmp/v3_fast.done; "
    "nohup bash -c '"
    "docker cp /tmp/v3_fast.sql mysql:/tmp/v3_fast.sql && "
    "docker exec mysql sh -c \"mysql -uroot -p\\\"\\$MYSQL_ROOT_PASSWORD\\\" "
    "--default-character-set=utf8mb4 -t < /tmp/v3_fast.sql\" "
    "> /tmp/v3_fast.out 2>/tmp/v3_fast.err; "
    "echo DONE > /tmp/v3_fast.done"
    "' >/dev/null 2>&1 & echo STARTED"
)
_, out, _ = c.exec_command(cmd, timeout=30)
print(out.read().decode())

# Poll up to ~8 minutes
import time

for i in range(48):
    time.sleep(10)
    _, out, _ = c.exec_command(
        "if test -f /tmp/v3_fast.done; then echo READY; else echo WAIT; fi; "
        "pgrep -af gen_on_server_v3.py | head -1 || echo NO_PROC",
        timeout=30,
    )
    status = out.read().decode("utf-8", "replace")
    print(f"[{i*10}s] {status.strip()}")
    if "READY" in status:
        break

_, out, _ = c.exec_command(
    "echo '=== OUT ==='; cat /tmp/v3_fast.out 2>/dev/null; "
    "echo '=== ERR ==='; cat /tmp/v3_fast.err 2>/dev/null | head -20; "
    "echo '=== PROC ==='; pgrep -af gen_on_server_v3.py || echo NO_PROC; "
    "echo '=== SUM ==='; test -f /tmp/settlement_v3_summary.json && echo HAS_SUMMARY || echo NO_SUMMARY; "
    "echo '=== LOGTAIL ==='; tail -5 /tmp/settlement_v3_run.log",
    timeout=60,
)
print(out.read().decode("utf-8", "replace"))
c.close()
