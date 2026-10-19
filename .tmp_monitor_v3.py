#!/usr/bin/env python3
"""Fixed monitor: avoid false HAS_SUMMARY/DONE_PROC from pgrep cmdline."""
import sys
import time

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "8.133.218.152"
USER = "ecs-user"
PASSWORD = "e4bA5e$27c4!"
POLL_SEC = 150
MAX_POLLS = 60


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=20, allow_agent=False, look_for_keys=False)
    return c


def run(c, cmd, timeout=180):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


# Keep markers out of remote cmdline that pgrep would print.
# Light poll only — avoid COUNT(*) during LOAD DATA (contends with import).
# Use ps+[p]ython trick so status shell cmdline is not matched.
STATUS_CMD = r"""
echo '===LOG===';
tail -n 35 /tmp/settlement_v3_run.log 2>/dev/null
echo '===PROC===';
ps -eo pid,cmd | grep '[p]ython3 -u /tmp/gen_on_server_v3.py' || echo 'NOT_RUNNING'
echo '===SUM===';
if [ -f /tmp/settlement_v3_summary.json ]; then echo 'SUMMARY_YES'; else echo 'SUMMARY_NO'; fi
echo '===DISK===';
df -h / | tail -1
echo '===TSV===';
ls -lh /tmp/settlement_v3 2>/dev/null | tail -10
echo '===MYSQL===';
docker exec mysql sh -c 'mysqladmin -uroot -p"$MYSQL_ROOT_PASSWORD" processlist 2>/dev/null' | grep -iE 'Load|cust_|Query' | head -12 || true
"""


def restart_gen(c):
    print("=== RESTARTING gen_on_server_v3.py via setsid ===", flush=True)
    code, out, err = run(
        c,
        "test -f /tmp/gen_on_server_v3.py && "
        "setsid python3 -u /tmp/gen_on_server_v3.py >> /tmp/settlement_v3_run.log 2>&1 < /dev/null & "
        "sleep 2; "
        "PIDS=$(ps -eo pid,cmd | grep '[p]ython3 -u /tmp/gen_on_server_v3.py' || true); "
        "if [ -n \"$PIDS\" ]; then echo RESTART_OK; echo \"$PIDS\"; else echo RESTART_FAIL; fi",
        timeout=30,
    )
    print(out, flush=True)
    return "RESTART_OK" in out


def final_verify_and_restart(c):
    print("\n=== FINAL VERIFY ===", flush=True)
    code, out, err = run(
        c,
        r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT \"USERS\", username, ROUND(used_quota/500000,2), request_count FROM users WHERE username LIKE \"cust_%\" ORDER BY username;
SELECT \"LOGS\", username, COUNT(*) FROM logs WHERE username LIKE \"cust_%\" AND type=2 GROUP BY username ORDER BY username;
SELECT \"VIDEO\", username, ROUND(AVG(quota/500000),2), ROUND(MIN(quota/500000),2), ROUND(MAX(quota/500000),2), COUNT(*)
FROM logs WHERE username LIKE \"cust_%\" AND type=2 AND model_name LIKE \"%seedance%\" GROUP BY username ORDER BY username;
SELECT \"TEXT\", username, ROUND(AVG(quota/500000),2), ROUND(MIN(quota/500000),2), ROUND(MAX(quota/500000),2), COUNT(*)
FROM logs WHERE username LIKE \"cust_%\" AND type=2 AND model_name NOT LIKE \"%seedance%\" GROUP BY username ORDER BY username;
"' 2>/dev/null""",
        timeout=900,
    )
    print(out, flush=True)

    code, out, err = run(c, "cat /tmp/settlement_v3_summary.json 2>/dev/null || echo SUMMARY_MISSING")
    print("\n=== SUMMARY JSON ===", flush=True)
    print(out[:12000], flush=True)

    print("\n=== RESTART new-api ===", flush=True)
    code, out, err = run(
        c,
        "sudo systemctl restart new-api; sleep 3; "
        "systemctl is-active new-api; "
        "curl -sS -m 8 -o /dev/null -w 'http_status=%{http_code}\\n' http://127.0.0.1:3000/api/status || true",
        timeout=60,
    )
    print(out, flush=True)
    if err.strip():
        print("ERR", err[:500], flush=True)


def main():
    c = connect()
    restarted_once = False

    for i in range(MAX_POLLS):
        try:
            code, out, err = run(c, STATUS_CMD, timeout=300)
        except Exception as e:
            print(f"poll {i+1} SSH error: {e}, reconnecting...", flush=True)
            try:
                c.close()
            except Exception:
                pass
            time.sleep(5)
            c = connect()
            code, out, err = run(c, STATUS_CMD, timeout=300)

        print(f"\n######## poll {i+1}/{MAX_POLLS} @ {time.strftime('%H:%M:%S')} ########", flush=True)
        # strip noise: drop lines that are our own status bash if any
        print(out[-8000:] if len(out) > 8000 else out, flush=True)
        if err.strip():
            print("ERR", err[:500], flush=True)

        proc_section = out.split("===PROC===")[-1].split("===SUM===")[0] if "===PROC===" in out else ""
        sum_section = out.split("===SUM===")[-1].split("===DISK===")[0] if "===SUM===" in out else ""
        is_running = ("gen_on_server_v3.py" in proc_section) and ("NOT_RUNNING" not in proc_section)
        has_summary = ("SUMMARY_YES" in sum_section) and ("SUMMARY_NO" not in sum_section)

        if has_summary and not is_running:
            print("SUCCESS: process done + summary present", flush=True)
            final_verify_and_restart(c)
            c.close()
            print("MONITOR_DONE", flush=True)
            return 0

        if (not is_running) and (not has_summary):
            print("DIED without summary — inspecting log", flush=True)
            code, out2, _ = run(c, "tail -n 120 /tmp/settlement_v3_run.log 2>/dev/null")
            print(out2, flush=True)
            log = out2.lower()
            recoverable = any(
                x in log
                for x in (
                    "killed",
                    "signal",
                    "broken pipe",
                    "connection reset",
                    "temporary failure",
                    "too many connections",
                    "lock wait",
                    "gone away",
                    "oom",
                )
            )
            load_fail = "load data" in log and ("error" in log or "fail" in log)
            if load_fail and not recoverable:
                print("LOAD_FAILED: mid-load failure, not restarting", flush=True)
                c.close()
                return 2
            if not restarted_once:
                ok = restart_gen(c)
                restarted_once = True
                if not ok:
                    print("RESTART_FAILED", flush=True)
                    c.close()
                    return 3
                time.sleep(POLL_SEC)
                continue
            print("Already restarted once; still dead. Aborting.", flush=True)
            c.close()
            return 4

        time.sleep(POLL_SEC)

    print("TIMEOUT after max polls", flush=True)
    c.close()
    return 1


if __name__ == "__main__":
    sys.exit(main())
