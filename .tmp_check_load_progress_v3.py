#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

def run(cmd, timeout=120):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    return out

print(run("df -h /"))
print(run(r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
SHOW MASTER STATUS;
SHOW BINARY LOGS;
SHOW GLOBAL STATUS LIKE \"Innodb_data_pending%\";
SHOW GLOBAL STATUS LIKE \"Innodb_os_log_pending%\";
SHOW GLOBAL STATUS LIKE \"Handler_commit\";
SHOW GLOBAL STATUS LIKE \"Innodb_log_writes\";
SHOW GLOBAL STATUS LIKE \"Binlog_cache_disk_use\";
" 2>/dev/null'"""))
print(run("docker exec mysql ls -lh /var/lib/mysql-files/ /var/lib/mysql/binlog.000011 2>/dev/null"))
print(run("docker exec mysql sh -c 'mysqladmin -uroot -p\"$MYSQL_ROOT_PASSWORD\" processlist 2>/dev/null' | head -15"))
print("--- sample 3s later ---")
import time
time.sleep(3)
print(run(r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SHOW MASTER STATUS;
SHOW GLOBAL STATUS LIKE \"Handler_commit\";
SHOW GLOBAL STATUS LIKE \"Innodb_log_writes\";
" 2>/dev/null'"""))
print(run("iostat -x 1 2 2>/dev/null | tail -20"))
# kill long-stuck read-only clients that compete (NOT the LOAD itself)
print(run("ps -eo pid,etime,cmd | grep -E 'docker exec.*mysql|mysql -uroot' | grep -v grep | head -20"))
c.close()
