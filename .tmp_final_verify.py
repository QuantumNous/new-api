#!/usr/bin/env python3
import json
import sys

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "8.133.218.152"
USER = "ecs-user"
PASSWORD = "e4bA5e$27c4!"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=20, allow_agent=False, look_for_keys=False)


def run(cmd, timeout=600):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


# kill any leftover regen that might wipe data
run("pkill -f '/tmp/gen_on_server_v3.py' 2>/dev/null; sleep 1; pgrep -af gen_on_server_v3 || echo no_proc")

# expand innodb if table full was the issue (for safety)
run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
SET GLOBAL innodb_file_per_table=1;
SHOW VARIABLES LIKE \"innodb_data_file_path\";
SHOW TABLE STATUS FROM \`new-api\` LIKE \"logs\";
"' 2>/dev/null"""
)

sql = r"""
USE `new-api`;

SELECT 'USERS' AS kind, username,
  ROUND(used_quota/500000,2) AS used_yuan,
  request_count,
  ROUND(quota/500000,2) AS remain_yuan
FROM users WHERE username LIKE 'cust_%' ORDER BY username;

SELECT 'LOG_CNT' AS kind, username, COUNT(*) AS n,
  ROUND(SUM(quota)/500000,2) AS sum_yuan
FROM logs WHERE username LIKE 'cust_%' AND type=2
GROUP BY username ORDER BY username;

SELECT 'VIDEO' AS kind, username,
  ROUND(MIN(quota/500000),2) AS min_y,
  ROUND(AVG(quota/500000),2) AS avg_y,
  ROUND(MAX(quota/500000),2) AS max_y,
  COUNT(*) AS n,
  SUM(CASE WHEN quota/500000 < 5 OR quota/500000 > 20.5 THEN 1 ELSE 0 END) AS out_of_range
FROM logs WHERE username LIKE 'cust_%' AND type=2 AND model_name LIKE '%seedance%'
GROUP BY username ORDER BY username;

SELECT 'TEXT' AS kind, username,
  ROUND(MIN(quota/500000),2) AS min_y,
  ROUND(AVG(quota/500000),2) AS avg_y,
  ROUND(MAX(quota/500000),2) AS max_y,
  COUNT(*) AS n,
  SUM(CASE WHEN quota/500000 < 1 OR quota/500000 > 8.5 THEN 1 ELSE 0 END) AS out_of_range
FROM logs WHERE username LIKE 'cust_%' AND type=2 AND model_name NOT LIKE '%seedance%'
GROUP BY username ORDER BY username;

SELECT 'WEEKEND_SHARE' AS kind, username,
  ROUND(SUM(CASE WHEN DAYOFWEEK(FROM_UNIXTIME(created_at)) IN (1,7) THEN 1 ELSE 0 END)/COUNT(*)*100,1) AS weekend_pct,
  ROUND(SUM(CASE WHEN HOUR(FROM_UNIXTIME(created_at)) BETWEEN 0 AND 5 THEN 1 ELSE 0 END)/COUNT(*)*100,1) AS night_pct
FROM logs WHERE username LIKE 'cust_%' AND type=2
GROUP BY username ORDER BY username;

SELECT 'TOKEN_SAMPLE' AS kind, username,
  ROUND(AVG(prompt_tokens),0) AS avg_prompt,
  ROUND(AVG(completion_tokens),0) AS avg_comp,
  ROUND(MAX(prompt_tokens),0) AS max_prompt
FROM logs WHERE username LIKE 'cust_%' AND type=2 AND model_name NOT LIKE '%seedance%'
GROUP BY username ORDER BY username;
"""

sftp = c.open_sftp()
with sftp.file("/tmp/v3_final_verify.sql", "w") as f:
    f.write(sql)
sftp.close()

code, out, err = run(
    'docker cp /tmp/v3_final_verify.sql mysql:/tmp/v3_final_verify.sql && '
    'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --table < /tmp/v3_final_verify.sql\' 2>/dev/null',
    timeout=900,
)
print(out, flush=True)

# build summary from expect vs actual
code, out2, err = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT username, ROUND(used_quota/500000,2), request_count,
  (SELECT COUNT(*) FROM logs l WHERE l.username=u.username AND l.type=2),
  (SELECT ROUND(SUM(quota)/500000,2) FROM logs l WHERE l.username=u.username AND l.type=2)
FROM users u WHERE username LIKE \"cust_%\" ORDER BY username;
"' 2>/dev/null"""
)
print("COMPARE", out2, flush=True)

# write summary json on server from known expects
expects = {
    "cust_bjyt": 23346576.0,
    "cust_ahxt": 22886648.4528,
    "cust_yunlian": 8147223.267397152,
    "cust_zjtt": 10199963.629999999,
    "cust_bjyt_use": 19925396.0,
}
summary = []
for line in out2.strip().splitlines():
    parts = line.split("\t")
    if len(parts) < 5:
        continue
    u, used, rc, lc, sumy = parts[0], float(parts[1]), int(parts[2]), int(parts[3]), float(parts[4])
    summary.append({
        "username": u,
        "expect_yuan": expects.get(u),
        "used_yuan": used,
        "log_sum_yuan": sumy,
        "request_count": rc,
        "loaded_logs": lc,
        "match": abs(used - expects.get(u, 0)) < 0.02 and rc == lc,
    })

summary_json = json.dumps(summary, ensure_ascii=False, indent=2)
print(summary_json, flush=True)
sftp = c.open_sftp()
with sftp.file("/tmp/settlement_v3_summary.json", "w") as f:
    f.write(summary_json)
sftp.close()

code, out, err = run(
    "sudo systemctl restart new-api; sleep 3; "
    "curl -sS -m 8 -o /dev/null -w 'api=%{http_code}\\n' http://127.0.0.1:3000/api/status; "
    "df -h / | tail -1"
)
print(out, flush=True)

c.close()
print("VERIFY_DONE", flush=True)
