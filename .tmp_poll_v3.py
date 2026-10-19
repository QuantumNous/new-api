#!/usr/bin/env python3
import sys
import time

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "8.133.218.152"
USER = "ecs-user"
PASSWORD = "e4bA5e$27c4!"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=20, allow_agent=False, look_for_keys=False)


def run(cmd, timeout=300):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    # read with channel timeout handling
    stdout.channel.settimeout(timeout)
    chunks = []
    while True:
        try:
            data = stdout.channel.recv(65536)
            if not data:
                break
            chunks.append(data)
        except Exception:
            if stdout.channel.exit_status_ready():
                break
            time.sleep(0.5)
    while not stdout.channel.exit_status_ready():
        time.sleep(0.2)
    out = b"".join(chunks).decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


# free some space if possible
run("sudo journalctl --vacuum-size=50M 2>/dev/null; docker exec mysql sh -c 'rm -f /var/lib/mysql-files/logs_*.tsv /var/lib/mysql-files/qd_*.tsv /var/lib/mysql-files/logs_*.csv 2>/dev/null; true'")

for i in range(300):
    code, out, err = run(
        "tail -n 25 /tmp/settlement_v3_run.log; "
        "echo __MARK__; "
        "pgrep -a -f '^python3 -u /tmp/gen_on_server_v3.py$' || echo PROC_GONE; "
        "test -f /tmp/settlement_v3_summary.json && echo FILE_SUMMARY_OK; "
        "df -h / | awk 'NR==2{print $3,$4,$5}'; "
        "ls -lh /tmp/settlement_v3 2>/dev/null | awk 'NR>1{print $5,$9}'; "
        "docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" -N -e \""
        "USE \\`new-api\\`; "
        "SELECT CONCAT(username,\\\"=\\\",COUNT(*)) FROM logs WHERE username LIKE \\\"cust_%\\\" AND type=2 GROUP BY username ORDER BY username;"
        "\"' 2>/dev/null"
    )
    print(f"\n######## poll {i+1} ########", flush=True)
    print(out[-5000:] if len(out) > 5000 else out, flush=True)

    has_summary = "FILE_SUMMARY_OK" in out
    proc_gone = "PROC_GONE" in out
    if has_summary and proc_gone:
        print("COMPLETED", flush=True)
        break
    if proc_gone and not has_summary:
        print("DIED", flush=True)
        break
    time.sleep(60)
else:
    print("TIMEOUT", flush=True)

code, out, err = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT username, ROUND(used_quota/500000,2), request_count FROM users WHERE username LIKE \"cust_%\" ORDER BY username;
SELECT username, COUNT(*) FROM logs WHERE username LIKE \"cust_%\" AND type=2 GROUP BY username ORDER BY username;
SELECT \"VIDEO\", username, ROUND(AVG(quota/500000),2), ROUND(MIN(quota/500000),2), ROUND(MAX(quota/500000),2), COUNT(*)
FROM logs WHERE username LIKE \"cust_%\" AND type=2 AND model_name LIKE \"%seedance%\" GROUP BY username;
SELECT \"TEXT\", username, ROUND(AVG(quota/500000),2), ROUND(MIN(quota/500000),2), ROUND(MAX(quota/500000),2), COUNT(*)
FROM logs WHERE username LIKE \"cust_%\" AND type=2 AND model_name NOT LIKE \"%seedance%\" GROUP BY username;
"' 2>/dev/null""",
    timeout=900,
)
print("\n=== FINAL VERIFY ===", flush=True)
print(out, flush=True)
if err.strip():
    print("ERR", err[:1000], flush=True)

code, out, err = run("cat /tmp/settlement_v3_summary.json 2>/dev/null || echo NO_SUMMARY", timeout=60)
print("\n=== SUMMARY ===", flush=True)
print(out[:12000], flush=True)

run(
    "sudo systemctl restart new-api; sleep 2; "
    "curl -sS -m 5 -o /dev/null -w 'status=%{http_code}\\n' http://127.0.0.1:3000/api/status"
)

c.close()
print("POLL_DONE", flush=True)
