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
    "df -h / | awk 'NR==2{print}'",
    "pgrep -af 'gen_bjyt_use_only|gen_on_server_v3|add_log_idx' || echo NO_IMPORT_PROC",
    "tail -n 25 /tmp/settlement_bjyt_use_run.log 2>/dev/null || echo NO_BJYT_LOG",
    "test -f /tmp/settlement_bjyt_use_summary.json && echo HAS_SUMMARY || echo NO_SUMMARY",
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SHOW INDEX FROM logs WHERE Key_name IN (\"idx_username_created_at\",\"idx_user_id_created_at_type\");
SELECT username, request_count FROM users WHERE username LIKE \"cust_%\" ORDER BY username;
SELECT username, COUNT(*) FROM logs WHERE type=2 AND username LIKE \"cust_%\" GROUP BY username ORDER BY username;
SHOW PROCESSLIST;
"' 2>/dev/null""",
]

for cmd in cmds:
    print("===CMD===")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=180)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR", err[-400:])
c.close()
