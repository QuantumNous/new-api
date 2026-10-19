#!/usr/bin/env python3
"""Purge old MySQL binary logs to unblock LOAD DATA commit. Keep current binlog."""
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

def run(cmd, timeout=180):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return stdout.channel.recv_exit_status(), out, err

print("BEFORE df:", flush=True)
print(run("df -h /")[1], flush=True)

# Show current master status / binary logs
code, out, err = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
SHOW MASTER STATUS;
SHOW BINARY LOGS;
" 2>/dev/null'"""
)
print(out, flush=True)

# Purge all binlogs before current file
code, out, err = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
PURGE BINARY LOGS TO \"binlog.000011\";
SHOW BINARY LOGS;
" 2>/dev/null'"""
)
print("PURGE result:", flush=True)
print(out, flush=True)
print("ERR:", err[:500], flush=True)

print("AFTER df:", flush=True)
print(run("df -h /")[1], flush=True)

code, out, err = run(
    "docker exec mysql sh -c 'mysqladmin -uroot -p\"$MYSQL_ROOT_PASSWORD\" processlist 2>/dev/null' | grep -iE 'Load|query end|cust_|Info'"
)
print("LOAD state:", out, flush=True)

code, out, err = run("ps -eo pid,etime,cmd | grep '[p]ython3 -u /tmp/gen_on_server_v3.py'")
print("GEN:", out, flush=True)

c.close()
