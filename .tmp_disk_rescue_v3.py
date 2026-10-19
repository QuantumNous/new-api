#!/usr/bin/env python3
"""Emergency free disk space without touching gen process or MySQL data volumes."""
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

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


def run(cmd, timeout=120):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


print("=== BEFORE ===", flush=True)
code, out, err = run("df -h /; echo ---; du -sh /tmp/* 2>/dev/null | sort -hr | head -20; echo ---; ls -lh /tmp/settlement_v3 /var/lib/docker/volumes 2>/dev/null | head")
print(out, flush=True)

# Check whether mysql-files still has the tsv (LOAD source)
code, out, err = run(
    "docker exec mysql sh -c 'ls -lh /var/lib/mysql-files/logs_cust_bjyt_use.tsv 2>/dev/null || echo NO_MYSQL_TSV'; "
    "ps -eo pid,cmd | grep \"[p]ython3 -u /tmp/gen_on_server_v3.py\" || echo GEN_GONE'"
)
print("=== MYSQL TSV / GEN ===", flush=True)
print(out, flush=True)

# Free safe space: host /tmp copy of current tsv (LOAD reads from mysql-files),
# old tmp artifacts, journal vacuum, truncated docker json logs (not volumes).
cmds = [
    # only remove host /tmp copy if mysql-files copy exists
    "if docker exec mysql test -f /var/lib/mysql-files/logs_cust_bjyt_use.tsv; then "
    "  rm -f /tmp/settlement_v3/logs_cust_bjyt_use.tsv && echo REMOVED_TMP_TSV; "
    "else echo KEEP_TMP_TSV; fi",
    "rm -f /tmp/*.tsv /tmp/v3_*.sql /tmp/settlement_v3/*.tsv.bak 2>/dev/null; echo cleaned_tmp_misc",
    "sudo journalctl --vacuum-size=50M 2>&1 | tail -3",
    # truncate large container json logs only
    "sudo find /var/lib/docker/containers -name '*-json.log' -size +50M -exec truncate -s 0 {} \\; 2>/dev/null; echo truncated_docker_logs",
    "sudo rm -rf /var/tmp/* /tmp/pip-* /tmp/npm-* 2>/dev/null; echo cleaned_var_tmp",
    "df -h /",
    "docker exec mysql sh -c 'mysqladmin -uroot -p\"$MYSQL_ROOT_PASSWORD\" processlist 2>/dev/null' | grep -iE 'Load|query end|cust_' | head -10 || true",
]

for cmd in cmds:
    print(f"\n>>> {cmd[:80]}...", flush=True)
    code, out, err = run(cmd, timeout=180)
    print(out, flush=True)
    if err.strip():
        print("ERR", err[:400], flush=True)

c.close()
print("DISK_RESCUE_DONE", flush=True)
