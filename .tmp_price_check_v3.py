#!/usr/bin/env python3
"""Quick price range check for 4 completed customers + bjyt_use tsv presence."""
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

def run(cmd, timeout=600):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    return stdout.read().decode("utf-8", "replace"), stderr.read().decode("utf-8", "replace")

out, _ = run("docker exec mysql ls -lh /var/lib/mysql-files/ 2>/dev/null; ls -lh /tmp/settlement_v3 2>/dev/null; test -f /tmp/settlement_v3_summary.json && echo HAS_SUM || echo NO_SUM")
print("TSV/SUM:\n", out, flush=True)

sql = """
USE `new-api`;
SELECT 'VIDEO', username,
  ROUND(MIN(quota/500000),2), ROUND(AVG(quota/500000),2), ROUND(MAX(quota/500000),2)
FROM logs WHERE username IN ('cust_bjyt','cust_ahxt','cust_yunlian','cust_zjtt') AND type=2 AND model_name LIKE '%seedance%'
GROUP BY username ORDER BY username;
SELECT 'TEXT', username,
  ROUND(MIN(quota/500000),2), ROUND(AVG(quota/500000),2), ROUND(MAX(quota/500000),2)
FROM logs WHERE username IN ('cust_bjyt','cust_ahxt','cust_yunlian','cust_zjtt') AND type=2 AND model_name NOT LIKE '%seedance%'
GROUP BY username ORDER BY username;
"""
sftp = c.open_sftp()
with sftp.file("/tmp/v3_price_check.sql", "w") as f:
    f.write(sql)
sftp.close()
run("docker cp /tmp/v3_price_check.sql mysql:/tmp/v3_price_check.sql")
run(
    "rm -f /tmp/v3_price_check.out; "
    "nohup docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" --default-character-set=utf8mb4 < /tmp/v3_price_check.sql' > /tmp/v3_price_check.out 2>/tmp/v3_price_check.err & echo started"
)
import time
for i in range(40):
    out, _ = run("cat /tmp/v3_price_check.out 2>/dev/null; wc -l /tmp/v3_price_check.out 2>/dev/null")
    print(f"p{i+1}:", out[:2000], flush=True)
    if out.count("VIDEO") >= 4 or (out.count("cust_") >= 8):
        break
    time.sleep(20)
out, _ = run("systemctl is-active new-api; curl -sS -m 5 -o /dev/null -w 'http=%{http_code}\\n' http://127.0.0.1:3000/api/status")
print("SVC:", out, flush=True)
c.close()
