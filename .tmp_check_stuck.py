#!/usr/bin/env python3
"""Read-only: is gen process stuck? Check state/cpu/io. No mutation."""
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

cmds = [
    ("ps", "ps -o pid,etime,pcpu,pmem,state,wchan:20,cmd -p 115261 2>/dev/null || echo DEAD"),
    ("children", "pstree -p 115261 2>/dev/null; pgrep -P 115261 -a 2>/dev/null || true"),
    ("mysql_proc", "docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" -e \"SHOW FULL PROCESSLIST\"' 2>/dev/null | head -40"),
    ("log_mtime", "stat /tmp/settlement_v3_run.log /tmp/settlement_v3/logs_cust_ahxt.tsv 2>/dev/null | egrep 'File:|Modify:|Size:'"),
    ("lsof", "ls -l /proc/115261/fd 2>/dev/null | head -40"),
    ("log_tail2", "tail -n 5 /tmp/settlement_v3_run.log; echo ---; date"),
]
for title, cmd in cmds:
    print(f"\n===== {title} =====", flush=True)
    _, stdout, stderr = c.exec_command(cmd, timeout=60)
    stdout.channel.settimeout(60)
    print(stdout.read().decode("utf-8", "replace"), flush=True)
    e = stderr.read().decode("utf-8", "replace")
    if e.strip():
        print("ERR", e[:200], flush=True)
c.close()
print("DONE", flush=True)
