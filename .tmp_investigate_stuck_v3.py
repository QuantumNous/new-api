#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

def run(cmd, timeout=180):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return stdout.channel.recv_exit_status(), out, err

checks = [
    "df -h /; echo ---; df -i / | tail -1",
    "docker exec mysql sh -c 'ls -lh /var/lib/mysql-files/ 2>/dev/null'",
    "docker exec mysql sh -c 'du -sh /var/lib/mysql /var/lib/mysql-files 2>/dev/null; ls -lh /var/lib/mysql/*.ibd 2>/dev/null | tail -5; ls -lh /var/lib/mysql/ib_logfile* /var/lib/mysql/mysql-bin* /var/lib/mysql/binlog* 2>/dev/null | head -20'",
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
SHOW GLOBAL STATUS LIKE \"Innodb_data_pending%\";
SHOW GLOBAL STATUS LIKE \"Innodb_os_log_pending%\";
SHOW GLOBAL STATUS LIKE \"Threads_running\";
SHOW VARIABLES LIKE \"innodb_flush_log_at_trx_commit\";
SHOW VARIABLES LIKE \"sync_binlog\";
SHOW VARIABLES LIKE \"log_bin\";
SHOW BINARY LOGS;
" 2>/dev/null'""",
    "iostat -x 1 3 2>/dev/null || vmstat 1 3",
    "ps -eo pid,etime,pcpu,pmem,state,cmd | grep -E 'mysql|115261|gen_on' | grep -v grep",
]
for cmd in checks:
    print(f"\n======== {cmd[:70]} ========", flush=True)
    code, out, err = run(cmd)
    print(out[:5000], flush=True)
    if err.strip():
        print("ERR", err[:300], flush=True)

# Remove OLD customer tsvs from mysql-files (keep bjyt_use)
code, out, err = run(
    "docker exec mysql sh -c '"
    "cd /var/lib/mysql-files && "
    "ls -lh && "
    "rm -f logs_cust_bjyt.tsv logs_cust_ahxt.tsv logs_cust_yunlian.tsv logs_cust_zjtt.tsv && "
    "echo AFTER && ls -lh"
    "'"
)
print("\n======== cleanup old mysql-files ========", flush=True)
print(out, flush=True)
print("df:", flush=True)
code, out, err = run("df -h /")
print(out, flush=True)
code, out, err = run(
    "docker exec mysql sh -c 'mysqladmin -uroot -p\"$MYSQL_ROOT_PASSWORD\" processlist 2>/dev/null' | grep -iE 'Load|query end|cust_'"
)
print("LOAD:", out, flush=True)
c.close()
