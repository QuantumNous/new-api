import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "8.133.218.152",
    username="ecs-user",
    password="e4bA5e$27c4!",
    timeout=15,
    allow_agent=False,
    look_for_keys=False,
)
sql = r"""
USE `new-api`;
SELECT username, ROUND(used_quota/500000,2) used_yuan, request_count FROM users WHERE username LIKE 'cust_%' ORDER BY username;
SELECT 'video' kind, username,
  ROUND(AVG(quota/500000),2) avg_y, ROUND(MIN(quota/500000),2) min_y, ROUND(MAX(quota/500000),2) max_y, COUNT(*) n
FROM logs WHERE username LIKE 'cust_%' AND type=2 AND model_name LIKE '%seedance%'
GROUP BY username;
SELECT 'text' kind, username,
  ROUND(AVG(quota/500000),2) avg_y, ROUND(MIN(quota/500000),2) min_y, ROUND(MAX(quota/500000),2) max_y, COUNT(*) n
FROM logs WHERE username LIKE 'cust_%' AND type=2 AND model_name NOT LIKE '%seedance%'
GROUP BY username;
SELECT username, model_name, ROUND(quota/500000,2) yuan, prompt_tokens, completion_tokens, FROM_UNIXTIME(created_at)
FROM logs WHERE username='cust_bjyt_use' AND type=2 ORDER BY id DESC LIMIT 8;
"""
sftp = c.open_sftp()
with sftp.file("/tmp/v3_verify.sql", "w") as f:
    f.write(sql)
sftp.close()
stdin, stdout, stderr = c.exec_command(
    'docker cp /tmp/v3_verify.sql mysql:/tmp/v3_verify.sql && docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 < /tmp/v3_verify.sql\' 2>/dev/null',
    timeout=120,
)
print(stdout.read().decode("utf-8", errors="replace"))
c.close()
