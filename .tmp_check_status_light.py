#!/usr/bin/env python3
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

cmds = [
    "pgrep -af '^python3 -u /tmp/gen_on_server_v3.py$' || echo DONE_PROC",
    "tail -n 35 /tmp/settlement_v3_run.log 2>/dev/null || echo NO_LOG",
    "test -f /tmp/settlement_v3_summary.json && echo HAS_SUMMARY || echo NO_SUMMARY",
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT username, request_count,
  (SELECT COUNT(*) FROM logs l WHERE l.username=u.username AND l.type=2) AS log_cnt,
  ROUND(used_quota/500000,2)
FROM users u WHERE username LIKE \"cust_%\" ORDER BY username;
"' 2>/dev/null""",
]

for cmd in cmds:
    print("=== CMD ===")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=300)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR", err[-500:])

c.close()
