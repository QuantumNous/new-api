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
    err = stderr.read().decode("utf-8", "replace")
    return stdout.channel.recv_exit_status(), out, err

# Free more non-critical tmp; keep gen script + spec + run log
cmds = [
    "rm -rf /tmp/bun-linux-x64 /tmp/bun.zip /tmp/import_settlement.sql /tmp/import_settlement_v2.sql /tmp/node-compile-cache /tmp/node-jiti 2>/dev/null; echo more_tmp_cleared",
    "sudo find /var/log -type f -name '*.gz' -delete 2>/dev/null; sudo find /var/log -type f -name '*.1' -delete 2>/dev/null; echo logs_rotated_cleared",
    "df -h /; echo ---; ps -eo pid,etime,cmd | grep '[p]ython3 -u /tmp/gen_on_server_v3.py' || echo GEN_GONE",
    "docker exec mysql sh -c 'mysqladmin -uroot -p\"$MYSQL_ROOT_PASSWORD\" processlist 2>/dev/null' | head -20",
    "tail -n 20 /tmp/settlement_v3_run.log",
]
for cmd in cmds:
    code, out, err = run(cmd)
    print(f"\n### {cmd[:60]}", flush=True)
    print(out, flush=True)
c.close()
