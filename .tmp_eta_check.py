#!/usr/bin/env python3
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

cmds = [
    "pgrep -af '^python3 -u /tmp/gen_bjyt_use_only.py' || echo DONE_PROC",
    "tail -n 20 /tmp/settlement_bjyt_use_run.log 2>/dev/null || echo NO_LOG",
    "ls -lh /tmp/settlement_v3/logs_cust_bjyt_use.tsv 2>/dev/null; ls -lh /var/lib/docker/volumes 2>/dev/null | head -1; docker exec mysql ls -lh /var/lib/mysql-files/logs_cust_bjyt_use.tsv 2>/dev/null || echo NO_TSV_IN_MYSQL",
    "df -h / | awk 'NR==2'",
    "test -f /tmp/settlement_bjyt_use_summary.json && echo HAS_SUMMARY || echo NO_SUMMARY",
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SHOW FULL PROCESSLIST;
SELECT username, COUNT(*) FROM logs WHERE username=\"cust_bjyt_use\" AND type=2;
"' 2>/dev/null""",
]
for cmd in cmds:
    print("===CMD===")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
    print(stdout.read().decode("utf-8", errors="replace").replace("\xa5", "Y"))
c.close()
