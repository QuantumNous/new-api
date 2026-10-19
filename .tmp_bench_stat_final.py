#!/usr/bin/env python3
import sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

sql = """
USE `new-api`;
EXPLAIN SELECT COALESCE(SUM(CASE WHEN type=2 THEN quota WHEN type=6 THEN -quota ELSE 0 END),0) AS quota
FROM logs WHERE username='cust_bjyt' AND created_at>=1790179200 AND created_at<=1790242446;
SELECT COALESCE(SUM(CASE WHEN type=2 THEN quota WHEN type=6 THEN -quota ELSE 0 END),0) AS quota
FROM logs WHERE username='cust_bjyt' AND created_at>=1790179200 AND created_at<=1790242446;
"""
sftp = c.open_sftp()
with sftp.file("/tmp/bench_final.sql", "w") as f:
    f.write(sql)
sftp.close()
t0 = time.time()
stdin, stdout, stderr = c.exec_command(
    'docker cp /tmp/bench_final.sql mysql:/tmp/bench_final.sql && '
    'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 < /tmp/bench_final.sql\' 2>/dev/null',
    timeout=120,
)
print(stdout.read().decode("utf-8", errors="replace"))
print("elapsed_sec", round(time.time() - t0, 2))
c.close()
