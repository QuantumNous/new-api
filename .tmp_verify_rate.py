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
stdin, stdout, stderr = c.exec_command(
    """docker exec redis redis-cli -a 'HadRedis2025!' --no-auth-warning KEYS 'rateLimit:*'
docker exec redis redis-cli -a 'HadRedis2025!' --no-auth-warning DEL rateLimit:GW183.195.9.118 rateLimit:GA183.195.9.118 rateLimit:CT183.195.9.118
# simulate burst of static asset requests from a fake check via localhost
for i in $(seq 1 80); do curl -sS -m 1 -o /dev/null -w '%{http_code} ' http://127.0.0.1:3000/console; done; echo
tr '\\0' '\\n' < /proc/$(pgrep -n new-api)/environ 2>/dev/null | grep -E 'GLOBAL_.*RATE' || true
""",
    timeout=60,
)
sys.stdout.write(stdout.read().decode("utf-8", errors="replace"))
sys.stdout.write(stderr.read().decode("utf-8", errors="replace"))
c.close()
