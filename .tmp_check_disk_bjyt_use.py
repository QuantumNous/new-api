#!/usr/bin/env python3
import paramiko

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

cmds = [
    "df -h / /tmp /var/lib/docker 2>/dev/null; df -i / | tail -1",
    "pgrep -af 'gen_on_server|settlement' || echo NO_GEN",
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SHOW VARIABLES LIKE \"innodb_data_file_path\";
SHOW VARIABLES LIKE \"innodb_file_per_table\";
SHOW VARIABLES LIKE \"datadir\";
SELECT table_name, ROUND(data_length/1024/1024/1024,2) data_gb, ROUND(index_length/1024/1024/1024,2) idx_gb, table_rows
FROM information_schema.tables WHERE table_schema=\"new-api\" AND table_name=\"logs\";
SELECT username, request_count,
  (SELECT COUNT(*) FROM logs l WHERE l.username=u.username AND l.type=2) c
FROM users u WHERE username LIKE \"cust_%\" ORDER BY username;
"' 2>/dev/null""",
]

for cmd in cmds:
    print("===CMD===")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=180)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR", err[-500:])
c.close()
