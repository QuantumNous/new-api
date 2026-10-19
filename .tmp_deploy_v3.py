#!/usr/bin/env python3
"""Upload generator + kick off long-running import via setsid; stream log."""
import time
from pathlib import Path

import paramiko

HOST = "8.133.218.152"
USER = "ecs-user"
PASSWORD = "e4bA5e$27c4!"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=20, allow_agent=False, look_for_keys=False)


def run(cmd, timeout=600, pty=False):
    print("\n$", cmd[:240], flush=True)
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout, get_pty=pty)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out[-8000:] if len(out) > 8000 else out, flush=True)
    if err.strip():
        print("ERR", err[-2000:], flush=True)
    print("exit", code, flush=True)
    return code, out, err


run("df -h / /tmp /var/lib/docker 2>/dev/null; free -h | head -2")
run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SHOW VARIABLES LIKE \"secure_file_priv\";
"' 2>/dev/null"""
)

sftp = c.open_sftp()
spec_local = Path(r"d:\nodejs\newapi\new-api\.tmp_settlement_gen\settlement_spec_v3.json")
sftp.put(str(spec_local), "/tmp/settlement_spec_v3.json")
sftp.put(str(Path(r"d:\nodejs\newapi\new-api\.tmp_gen_on_server_v3.py")), "/tmp/gen_on_server_v3.py")
sftp.close()
print("uploaded", flush=True)

run("python3 -c 'import bcrypt' 2>/dev/null || pip3 install bcrypt -q")
# kill any leftover
run("pkill -f '/tmp/gen_on_server_v3.py' 2>/dev/null; rm -f /tmp/settlement_v3_run.log /tmp/settlement_v3_summary.json; mkdir -p /tmp/settlement_v3; sync")

# Fully detach — no PTY, setsid, redirect stdin
start_cmd = (
    "setsid python3 -u /tmp/gen_on_server_v3.py "
    "> /tmp/settlement_v3_run.log 2>&1 < /dev/null & "
    "echo $!; sleep 1; "
    "pgrep -f '/tmp/gen_on_server_v3.py' || echo START_FAIL; "
    "wc -l /tmp/settlement_v3_run.log 2>/dev/null || true"
)
run(start_cmd, timeout=30, pty=False)

alive = True
for i in range(360):  # up to 3h
    time.sleep(30)
    code, out, err = run(
        "tail -n 20 /tmp/settlement_v3_run.log 2>/dev/null; "
        "echo '---'; "
        "if pgrep -f '/tmp/gen_on_server_v3.py' >/dev/null; then echo RUNNING; else echo DONE_PROC; fi; "
        "if test -f /tmp/settlement_v3_summary.json; then echo HAS_SUMMARY; fi; "
        "df -h / | tail -1",
        timeout=90,
        pty=False,
    )
    print(f"=== poll {i+1} ===", flush=True)
    if "HAS_SUMMARY" in out and "DONE_PROC" in out:
        print("completed successfully", flush=True)
        alive = False
        break
    if "DONE_PROC" in out and "HAS_SUMMARY" not in out:
        print("process died without summary", flush=True)
        run("tail -n 80 /tmp/settlement_v3_run.log 2>/dev/null || echo NO_LOG")
        alive = False
        break
    if "RuntimeError" in out or "Traceback (most recent call last)" in out:
        # may still be running on next customer; only stop if process gone
        if "DONE_PROC" in out:
            print("failed with traceback", flush=True)
            alive = False
            break
else:
    print("TIMEOUT waiting", flush=True)

run("sudo systemctl restart new-api; sleep 2; curl -sS -m 5 -o /dev/null -w 'status=%{http_code}\\n' http://127.0.0.1:3000/api/status")
run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT username, ROUND(used_quota/500000,2), request_count FROM users WHERE username LIKE \"cust_%\" ORDER BY username;
SELECT username, COUNT(*) FROM logs WHERE username LIKE \"cust_%\" AND type=2 GROUP BY username ORDER BY username;
SELECT \"VIDEO\", username, ROUND(AVG(quota/500000),2), ROUND(MIN(quota/500000),2), ROUND(MAX(quota/500000),2), COUNT(*)
FROM logs WHERE username LIKE \"cust_%\" AND type=2 AND model_name LIKE \"%seedance%\" GROUP BY username;
SELECT \"TEXT\", username, ROUND(AVG(quota/500000),2), ROUND(MIN(quota/500000),2), ROUND(MAX(quota/500000),2), COUNT(*)
FROM logs WHERE username LIKE \"cust_%\" AND type=2 AND model_name NOT LIKE \"%seedance%\" GROUP BY username;
"' 2>/dev/null""",
    timeout=600,
)
run("cat /tmp/settlement_v3_summary.json 2>/dev/null || echo NO_SUMMARY")

c.close()
print("DEPLOY FINISHED", flush=True)
