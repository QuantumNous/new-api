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
SELECT COUNT(*) FROM logs WHERE username='cust_bjyt' AND type=2;
SELECT COUNT(*) FROM logs WHERE username='cust_bjyt_use' AND type=2;
SELECT ROUND(MIN(quota/500000),4), ROUND(AVG(quota/500000),4), ROUND(MAX(quota/500000),4)
FROM logs WHERE username='cust_bjyt_use' AND type=2 AND model_name LIKE 'seedance%';
SELECT ROUND(MIN(quota/500000),4), ROUND(AVG(quota/500000),4), ROUND(MAX(quota/500000),4)
FROM logs WHERE username='cust_bjyt_use' AND type=2 AND model_name NOT LIKE 'seedance%';
SELECT model_name, COUNT(*), ROUND(AVG(quota/500000),2), ROUND(MIN(quota/500000),2), ROUND(MAX(quota/500000),2)
FROM logs WHERE username='cust_bjyt_use' AND type=2 GROUP BY model_name;
"""
sftp = c.open_sftp()
with sftp.file("/tmp/v3_verify2.sql", "w") as f:
    f.write(sql)
sftp.close()
stdin, stdout, stderr = c.exec_command(
    'docker cp /tmp/v3_verify2.sql mysql:/tmp/v3_verify2.sql && docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 < /tmp/v3_verify2.sql\' 2>/dev/null',
    timeout=300,
)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))
c.close()
