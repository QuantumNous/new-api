#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

def run(cmd, timeout=900):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return out, err

# Kill leftover SELECT/COUNT and any DELETE leftovers
out, _ = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SELECT Id, Time, LEFT(Info,100) FROM information_schema.PROCESSLIST WHERE db=\"new-api\" AND Command=\"Query\";
" 2>/dev/null'"""
)
print("LIVE:", out, flush=True)
out, _ = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SELECT Id FROM information_schema.PROCESSLIST WHERE Info LIKE \"%COUNT(*)%\" OR Info LIKE \"DELETE FROM logs%\" OR Info LIKE \"ALTER TABLE logs%\";
" 2>/dev/null'"""
)
for i in out.split():
    if i.isdigit():
        run(f"""docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" -e \"KILL {i};\" 2>/dev/null'""")
        print("killed", i, flush=True)

out, _ = run("df -h /; ps -eo pid,cmd | grep '[p]ython3 -u /tmp/gen_on_server' || echo NO_GEN")
print(out, flush=True)

# Write SQL file and run with long timeout
sql = """
USE `new-api`;
SELECT 'bjyt', COUNT(*) FROM logs WHERE username='cust_bjyt' AND type=2;
SELECT 'ahxt', COUNT(*) FROM logs WHERE username='cust_ahxt' AND type=2;
SELECT 'yunlian', COUNT(*) FROM logs WHERE username='cust_yunlian' AND type=2;
SELECT 'zjtt', COUNT(*) FROM logs WHERE username='cust_zjtt' AND type=2;
SELECT 'bjyt_use', COUNT(*) FROM logs WHERE username='cust_bjyt_use' AND type=2;
SELECT username, ROUND(used_quota/500000,2), request_count FROM users WHERE username LIKE 'cust_%' ORDER BY username;
"""
sftp = c.open_sftp()
with sftp.file("/tmp/v3_counts.sql", "w") as f:
    f.write(sql)
sftp.close()

out, err = run(
    'docker cp /tmp/v3_counts.sql mysql:/tmp/v3_counts.sql && '
    'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 < /tmp/v3_counts.sql\' 2>/dev/null',
    timeout=900,
)
print("COUNTS:\n", out, flush=True)
print("ERR:", err[:300], flush=True)

# Price ranges for completed customers
sql2 = """
USE `new-api`;
SELECT 'VIDEO', username, ROUND(MIN(quota/500000),2), ROUND(AVG(quota/500000),2), ROUND(MAX(quota/500000),2), COUNT(*)
FROM logs WHERE username IN ('cust_bjyt','cust_ahxt','cust_yunlian','cust_zjtt') AND type=2 AND model_name LIKE '%seedance%'
GROUP BY username ORDER BY username;
SELECT 'TEXT', username, ROUND(MIN(quota/500000),2), ROUND(AVG(quota/500000),2), ROUND(MAX(quota/500000),2), COUNT(*)
FROM logs WHERE username IN ('cust_bjyt','cust_ahxt','cust_yunlian','cust_zjtt') AND type=2 AND model_name NOT LIKE '%seedance%'
GROUP BY username ORDER BY username;
"""
with sftp.file("/tmp/v3_prices.sql", "w") as f:
    f.write(sql2) if False else None
sftp = c.open_sftp()
with sftp.file("/tmp/v3_prices.sql", "w") as f:
    f.write(sql2)
sftp.close()
out, err = run(
    'docker cp /tmp/v3_prices.sql mysql:/tmp/v3_prices.sql && '
    'docker exec mysql sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 < /tmp/v3_prices.sql\' 2>/dev/null',
    timeout=900,
)
print("PRICES:\n", out, flush=True)

out, _ = run("systemctl is-active new-api; curl -sS -m 5 -o /dev/null -w 'http=%{http_code}\\n' http://127.0.0.1:3000/api/status || true")
print("SERVICE:\n", out, flush=True)
c.close()
