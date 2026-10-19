#!/usr/bin/env python3
import sys
import time
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

def run(cmd, timeout=60):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return out, err

# Ensure no gen / kill long queries
run(
    "PIDS=$(ps -eo pid,cmd | grep '[p]ython3 -u /tmp/gen_on_server_v3.py' | awk '{print $1}'); "
    "[ -n \"$PIDS\" ] && kill -9 $PIDS; echo ok"
)
out, _ = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SELECT Id FROM information_schema.PROCESSLIST WHERE Info LIKE \"%COUNT(*)%\" OR Info LIKE \"DELETE FROM logs%\";
" 2>/dev/null'"""
)
for i in out.split():
    if i.isdigit():
        run(f"""docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" -e \"KILL {i};\" 2>/dev/null'""")

# Users quick
out, _ = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT username, ROUND(used_quota/500000,2), request_count FROM users WHERE username LIKE \"cust_%\" ORDER BY username;
" 2>/dev/null'"""
)
print("USERS:\n", out, flush=True)

# Kick async counts on server
sql = r"""
USE `new-api`;
SELECT CONCAT('bjyt=', COUNT(*)) FROM logs WHERE username='cust_bjyt' AND type=2;
SELECT CONCAT('ahxt=', COUNT(*)) FROM logs WHERE username='cust_ahxt' AND type=2;
SELECT CONCAT('yunlian=', COUNT(*)) FROM logs WHERE username='cust_yunlian' AND type=2;
SELECT CONCAT('zjtt=', COUNT(*)) FROM logs WHERE username='cust_zjtt' AND type=2;
SELECT CONCAT('bjyt_use=', COUNT(*)) FROM logs WHERE username='cust_bjyt_use' AND type=2;
"""
sftp = c.open_sftp()
with sftp.file("/tmp/v3_async_counts.sql", "w") as f:
    f.write(sql)
sftp.close()

run(
    "docker cp /tmp/v3_async_counts.sql mysql:/tmp/v3_async_counts.sql; "
    "rm -f /tmp/v3_async_counts.out; "
    "nohup docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" --default-character-set=utf8mb4 < /tmp/v3_async_counts.sql' > /tmp/v3_async_counts.out 2>/tmp/v3_async_counts.err & "
    "echo ASYNC_STARTED; sleep 1; ls -l /tmp/v3_async_counts.*"
)

# Poll async result up to ~25 min
for i in range(50):
    out, _ = run("wc -l /tmp/v3_async_counts.out 2>/dev/null; cat /tmp/v3_async_counts.out 2>/dev/null; echo ---ERR---; cat /tmp/v3_async_counts.err 2>/dev/null | tail -5")
    print(f"poll {i+1}:\n{out}", flush=True)
    if "bjyt_use=" in out and "bjyt=" in out and "ahxt=" in out:
        break
    # also check if docker mysql count still running
    time.sleep(30)

out, _ = run("df -h /; systemctl is-active new-api; curl -sS -m 5 -o /dev/null -w 'http=%{http_code}\\n' http://127.0.0.1:3000/api/status || true")
print("DISK/SERVICE:\n", out, flush=True)
out, _ = run("tail -n 25 /tmp/settlement_v3_run.log")
print("LOG:\n", out, flush=True)
c.close()
print("ASSESS_DONE", flush=True)
