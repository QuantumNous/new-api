#!/usr/bin/env python3
"""Resume monitoring bjyt_use-only import; fix GBK print; do not wipe others."""
import os
import sys
import time

# force utf-8 stdout on Windows
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

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
    print("\n$", cmd[:200], flush=True)
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    safe = (out[-8000:] if len(out) > 8000 else out).replace("\xa5", "Y")
    print(safe, flush=True)
    if err.strip():
        print("ERR", err[-1000:].replace("\xa5", "Y"), flush=True)
    print("exit", code, flush=True)
    return code, out


code, out = run(
    "pgrep -af '^python3 -u /tmp/gen_bjyt_use_only.py' || echo DONE_PROC; "
    "tail -n 30 /tmp/settlement_bjyt_use_run.log 2>/dev/null || echo NO_LOG; "
    "test -f /tmp/settlement_bjyt_use_summary.json && echo HAS_SUMMARY || echo NO_SUMMARY; "
    "df -h / | awk 'NR==2{print $3,$4,$5}'"
)

if "HAS_SUMMARY" in out and "DONE_PROC" in out:
    print("Already finished", flush=True)
elif "DONE_PROC" in out and "HAS_SUMMARY" not in out:
    # restart import only if dead without summary
    print("Process dead, restarting one-user import...", flush=True)
    run(
        "setsid env SETTLEMENT_MIN_FREE_GB=6 python3 -u /tmp/gen_bjyt_use_only.py cust_bjyt_use "
        "> /tmp/settlement_bjyt_use_run.log 2>&1 < /dev/null & echo PID:$!; sleep 2; "
        "pgrep -af '^python3 -u /tmp/gen_bjyt_use_only.py' || echo START_FAIL",
        timeout=30,
    )
else:
    print("Import still running, polling...", flush=True)

for i in range(240):
    time.sleep(30)
    code, out = run(
        "tail -n 20 /tmp/settlement_bjyt_use_run.log 2>/dev/null; echo ---; "
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
        run("tail -n 100 /tmp/settlement_bjyt_use_run.log")
        break
else:
    print("TIMEOUT", flush=True)

run("sudo systemctl restart new-api; sleep 2; curl -sS -m 5 -o /dev/null -w 'status=%{http_code}\\n' http://127.0.0.1:3000/api/status")
run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT username, request_count, ROUND(used_quota/500000,2) FROM users WHERE username LIKE \"cust_%\" ORDER BY username;
SELECT username, COUNT(*) FROM logs WHERE username LIKE \"cust_%\" AND type=2 GROUP BY username ORDER BY username;
"' 2>/dev/null""",
    timeout=600,
)
run("cat /tmp/settlement_bjyt_use_summary.json 2>/dev/null || echo NO_SUMMARY")
c.close()
print("MONITOR DONE", flush=True)
