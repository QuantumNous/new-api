#!/usr/bin/env python3
"""Read-only follow-up: ahxt progress + bjyt prices. No mutation."""
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

def run(title, cmd, timeout=120):
    print(f"\n===== {title} =====", flush=True)
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    stdout.channel.settimeout(timeout)
    print(stdout.read().decode("utf-8", "replace"), flush=True)
    e = stderr.read().decode("utf-8", "replace")
    if e.strip():
        print("ERR", e[:300], flush=True)

run("proc", "pgrep -af 'python3 -u /tmp/gen_on_server_v3.py' || echo NO_PROC")
run("now_and_tsv", "date; ls -lh /tmp/settlement_v3/logs_cust_*.tsv 2>/dev/null; wc -l /tmp/settlement_v3/logs_cust_ahxt.tsv 2>/dev/null")
run("log_tail", "tail -n 15 /tmp/settlement_v3_run.log")
run("summary", "test -f /tmp/settlement_v3_summary.json && cat /tmp/settlement_v3_summary.json || echo NO_SUMMARY")

sql = r"""
USE `new-api`;
SELECT username, request_count, ROUND(used_quota/500000,2) used_usd
FROM users WHERE username LIKE 'cust_%' ORDER BY username;

SELECT 'bjyt_type2' AS k, COUNT(*) FROM logs WHERE username='cust_bjyt' AND type=2;
SELECT 'ahxt_type2' AS k, COUNT(*) FROM logs WHERE username='cust_ahxt' AND type=2;

SELECT 'VIDEO' AS kind, COUNT(*) n,
  ROUND(MIN(quota/500000),4) mn, ROUND(AVG(quota/500000),4) av, ROUND(MAX(quota/500000),4) mx
FROM logs WHERE username='cust_bjyt' AND type=2 AND model_name LIKE 'seedance%';
SELECT 'TEXT' AS kind, COUNT(*) n,
  ROUND(MIN(quota/500000),4) mn, ROUND(AVG(quota/500000),4) av, ROUND(MAX(quota/500000),4) mx
FROM logs WHERE username='cust_bjyt' AND type=2 AND model_name NOT LIKE 'seedance%';
"""
sftp = c.open_sftp()
with sftp.file("/tmp/v3_follow_ro.sql", "w") as f:
    f.write(sql)
sftp.close()

run(
    "mysql",
    'docker cp /tmp/v3_follow_ro.sql mysql:/tmp/v3_follow_ro.sql && '
    'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N '
    '< /tmp/v3_follow_ro.sql\' 2>/dev/null',
    timeout=600,
)

c.close()
print("\n===== DONE =====", flush=True)
