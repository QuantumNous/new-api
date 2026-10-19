#!/usr/bin/env python3
"""Light status check — no heavy COUNT during LOAD."""
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
cmd = r"""
echo '===LOG===';
tail -n 35 /tmp/settlement_v3_run.log 2>/dev/null
echo '===PROC===';
PIDS=$(pgrep -f 'python3 -u /tmp/gen_on_server_v3.py' || true)
if [ -n "$PIDS" ]; then echo "RUNNING $PIDS"; else echo 'NOT_RUNNING'; fi
echo '===SUM===';
if [ -f /tmp/settlement_v3_summary.json ]; then echo 'SUMMARY_YES'; ls -lh /tmp/settlement_v3_summary.json; else echo 'SUMMARY_NO'; fi
echo '===DISK===';
df -h / | tail -1
echo '===TSV===';
ls -lh /tmp/settlement_v3 2>/dev/null | tail -10
echo '===MYSQL===';
docker exec mysql sh -c 'mysqladmin -uroot -p"$MYSQL_ROOT_PASSWORD" processlist 2>/dev/null' | grep -iE 'load data|Query|cust_' | head -15 || true
"""
stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR", err[:500])
c.close()
