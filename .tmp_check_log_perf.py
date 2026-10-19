#!/usr/bin/env python3
import paramiko
import time

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

sql = r"""
USE `new-api`;
SHOW INDEX FROM logs;
SELECT COUNT(*) AS total_logs FROM logs;
SELECT id, username FROM users WHERE username LIKE 'cust_%' LIMIT 1;
"""

sftp = c.open_sftp()
with sftp.file("/tmp/log_perf_check.sql", "w") as f:
    f.write(sql)
sftp.close()

stdin, stdout, stderr = c.exec_command(
    'docker cp /tmp/log_perf_check.sql mysql:/tmp/log_perf_check.sql && '
    'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 < /tmp/log_perf_check.sql\' 2>/dev/null',
    timeout=300,
)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace")[-500:])

# get bjyt user id then EXPLAIN the stat query
stdin, stdout, stderr = c.exec_command(
    r'''docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT id FROM users WHERE username=\"cust_bjyt\" LIMIT 1;
"' 2>/dev/null''',
    timeout=60,
)
uid = stdout.read().decode().strip().splitlines()[-1]
print("uid", uid)

# timestamps from user URL roughly Sept 24 2026 day window? 
# 1790179200 / 1790242446
explain_sql = f"""
USE `new-api`;
EXPLAIN SELECT COUNT(*) AS count, COALESCE(SUM(quota),0) AS quota,
  COALESCE(SUM(prompt_tokens),0)+COALESCE(SUM(completion_tokens),0) AS token
FROM logs
WHERE user_id={uid} AND created_at >= 1790179200 AND created_at <= 1790242446;
"""
sftp = c.open_sftp()
with sftp.file("/tmp/log_explain.sql", "w") as f:
    f.write(explain_sql)
sftp.close()

t0 = time.time()
stdin, stdout, stderr = c.exec_command(
    'docker cp /tmp/log_explain.sql mysql:/tmp/log_explain.sql && '
    'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 < /tmp/log_explain.sql\' 2>/dev/null',
    timeout=300,
)
print("EXPLAIN:\n", stdout.read().decode("utf-8", errors="replace"))
print("explain_elapsed", round(time.time()-t0, 2))

# time the actual query
run_sql = f"""
USE `new-api`;
SELECT COUNT(*) AS count, COALESCE(SUM(quota),0) AS quota,
  COALESCE(SUM(prompt_tokens),0)+COALESCE(SUM(completion_tokens),0) AS token
FROM logs
WHERE user_id={uid} AND created_at >= 1790179200 AND created_at <= 1790242446;
"""
sftp = c.open_sftp()
with sftp.file("/tmp/log_run.sql", "w") as f:
    f.write(run_sql)
sftp.close()
t0 = time.time()
stdin, stdout, stderr = c.exec_command(
    'docker cp /tmp/log_run.sql mysql:/tmp/log_run.sql && '
    'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 < /tmp/log_run.sql\' 2>/dev/null',
    timeout=600,
)
print("RESULT:\n", stdout.read().decode("utf-8", errors="replace"))
print("query_elapsed", round(time.time()-t0, 2))

c.close()
