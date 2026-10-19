#!/usr/bin/env python3
"""Stop accidental full restart wipe; assess bjyt_use LOAD failure state."""
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

def run(cmd, timeout=300):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return out, err

# Kill any gen restart — do NOT allow full wipe after LOAD mid-fail
out, err = run(
    "ps -eo pid,etime,cmd | grep -E '[p]ython3 -u /tmp/gen_on_server_v3.py|[g]en_on_server' ; "
    "PIDS=$(ps -eo pid,cmd | grep '[p]ython3 -u /tmp/gen_on_server_v3.py' | awk '{print $1}'); "
    "if [ -n \"$PIDS\" ]; then echo KILLING $PIDS; kill $PIDS; sleep 2; "
    "ps -eo pid,cmd | grep '[p]ython3 -u /tmp/gen_on_server_v3.py' || echo GEN_STOPPED; "
    "else echo NO_GEN; fi"
)
print("=== GEN ===", out, flush=True)

out, err = run("df -h /; echo ---; tail -n 40 /tmp/settlement_v3_run.log")
print("=== DISK/LOG ===", out, flush=True)

out, err = run(
    "docker exec mysql sh -c 'mysqladmin -uroot -p\"$MYSQL_ROOT_PASSWORD\" processlist 2>/dev/null' | head -25"
)
print("=== PROCESSLIST ===", out, flush=True)

# Assess counts — may be slow
out, err = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT \"LOGS\", username, COUNT(*) FROM logs WHERE username LIKE \"cust_%\" AND type=2 GROUP BY username ORDER BY username;
SELECT \"USERS\", username, ROUND(used_quota/500000,2), request_count FROM users WHERE username LIKE \"cust_%\" ORDER BY username;
SHOW TABLE STATUS FROM \`new-api\` LIKE \"logs\";
" 2>/dev/null'""",
    timeout=600,
)
print("=== COUNTS ===", out, flush=True)
print("ERR", err[:500], flush=True)

out, err = run("test -f /tmp/settlement_v3_summary.json && cat /tmp/settlement_v3_summary.json || echo NO_SUMMARY; ls -lh /var/lib/docker/volumes 2>/dev/null | head; docker exec mysql du -sh /var/lib/mysql /var/lib/mysql-files 2>/dev/null")
print("=== SUMMARY/SIZE ===", out, flush=True)
c.close()
