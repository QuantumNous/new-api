#!/usr/bin/env python3
"""Kill wipe DELETE / restart remnants; preserve remaining settlement data."""
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("8.133.218.152", username="ecs-user", password="e4bA5e$27c4!", timeout=20, allow_agent=False, look_for_keys=False)

def run(cmd, timeout=300):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return out, err

# Kill ANY gen process
out, _ = run(
    "PIDS=$(ps -eo pid,cmd | grep '[p]ython3 -u /tmp/gen_on_server_v3.py' | awk '{print $1}'); "
    "if [ -n \"$PIDS\" ]; then kill -9 $PIDS; echo KILLED $PIDS; else echo NO_GEN; fi"
)
print(out, flush=True)

# Kill dangerous MySQL queries: DELETE wipe, and maybe ALTER if blocking forever
# First list then kill by Id
out, _ = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SELECT Id, Time, State, LEFT(Info,120) FROM information_schema.PROCESSLIST WHERE Info IS NOT NULL AND Command!=\"Daemon\";
" 2>/dev/null'"""
)
print("PROCESSES:\n", out, flush=True)

out, _ = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
SELECT Id FROM information_schema.PROCESSLIST
WHERE Info LIKE \"DELETE FROM logs%\"
   OR Info LIKE \"LOAD DATA%\"
   OR (Info LIKE \"ALTER TABLE logs%\" AND Time > 60);
" 2>/dev/null'"""
)
print("TO_KILL_IDS:", out, flush=True)
ids = [x.strip() for x in out.split() if x.strip().isdigit()]
for i in ids:
    o, e = run(f"""docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" -e \"KILL {i};\" 2>/dev/null'""")
    print(f"KILL {i}:", o, e[:200], flush=True)

out, _ = run(
    "docker exec mysql sh -c 'mysqladmin -uroot -p\"$MYSQL_ROOT_PASSWORD\" processlist 2>/dev/null' | head -20"
)
print("AFTER:\n", out, flush=True)

# Fast approximate counts via users table + limited count
out, _ = run(
    r"""docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "
USE \`new-api\`;
SELECT username, ROUND(used_quota/500000,2), request_count FROM users WHERE username LIKE \"cust_%\" ORDER BY username;
" 2>/dev/null'""",
    timeout=60,
)
print("USERS:\n", out, flush=True)

# Count per user may be slow; try one at a time with timeout feel
for u in ["cust_bjyt", "cust_ahxt", "cust_yunlian", "cust_zjtt", "cust_bjyt_use"]:
    o, e = run(
        f"""docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" -N -e \"
USE \\`new-api\\`;
SELECT COUNT(*) FROM logs WHERE username=\\\"{u}\\\" AND type=2;
\" 2>/dev/null'""",
        timeout=300,
    )
    print(f"COUNT {u}: {o.strip()}", flush=True)

out, _ = run("df -h /; tail -n 15 /tmp/settlement_v3_run.log")
print("DISK/LOG:\n", out, flush=True)
c.close()
