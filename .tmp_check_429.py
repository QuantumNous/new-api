import paramiko
import sys

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

cmds = [
    "sudo systemctl is-active new-api; sudo systemctl status new-api --no-pager -l | head -35",
    "ss -lntp | grep 3000 || true",
    "curl -sS -m 5 -o /tmp/r.txt -w 'root=%{http_code}\\n' http://127.0.0.1:3000/; curl -sS -m 5 -o /tmp/c.txt -w 'console=%{http_code}\\n' http://127.0.0.1:3000/console; curl -sS -m 5 -o /tmp/s.txt -w 'status=%{http_code}\\n' http://127.0.0.1:3000/api/status; echo '---body---'; head -c 300 /tmp/c.txt; echo; head -c 200 /tmp/s.txt; echo",
    "journalctl -u new-api --no-pager -n 80 2>&1 | tail -80",
    "free -h; uptime; ps -o pid,etime,%cpu,%mem,cmd -p $(pgrep -n new-api) 2>/dev/null",
    # rate limit related env/options
    "grep -E 'RATE|LIMIT|GLOBAL|MEMORY' /opt/new-api/.env 2>/dev/null || true",
    """docker exec mysql sh -c 'mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" -N -e \"USE \\\`new-api\\\`; SELECT \\\`key\\\`, LEFT(value,200) FROM options WHERE \\\`key\\\` LIKE \\\"%Rate%\\\" OR \\\`key\\\` LIKE \\\"%rate%\\\" OR \\\`key\\\` LIKE \\\"%Limit%\\\" OR \\\`key\\\` LIKE \\\"%limit%\\\" OR \\\`key\\\` LIKE \\\"%Global%\\\";\"' 2>/dev/null""",
]
for cmd in cmds:
    print("\n=====", cmd[:100])
    stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
    sys.stdout.write(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        sys.stdout.write("ERR:" + err[-1500:])
c.close()
