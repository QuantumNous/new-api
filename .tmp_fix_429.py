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

def run(cmd, timeout=60):
    print("\n$", cmd[:180])
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out)
    if err.strip():
        print("ERR", err[-1000:])
    return out

# show current .env
run("cat /opt/new-api/.env")

# backup and raise web+api rate limits (SPA loads many assets)
run(r"""
set -e
cd /opt/new-api
cp -a .env .env.bak.ratelimit.$(date +%Y%m%d%H%M%S)
# remove old rate limit lines if any, then append
grep -vE '^(GLOBAL_WEB_RATE_LIMIT|GLOBAL_API_RATE_LIMIT|GLOBAL_WEB_RATE_LIMIT_ENABLE|GLOBAL_API_RATE_LIMIT_ENABLE|GLOBAL_WEB_RATE_LIMIT_DURATION|GLOBAL_API_RATE_LIMIT_DURATION)=' .env > .env.tmp || true
mv .env.tmp .env
cat >> .env <<'EOF'
GLOBAL_WEB_RATE_LIMIT_ENABLE=true
GLOBAL_WEB_RATE_LIMIT=3000
GLOBAL_WEB_RATE_LIMIT_DURATION=180
GLOBAL_API_RATE_LIMIT_ENABLE=true
GLOBAL_API_RATE_LIMIT=3000
GLOBAL_API_RATE_LIMIT_DURATION=180
EOF
echo '--- new env ---'
cat .env
""")

# clear redis rate-limit keys (GW/GA)
run(r"""
docker exec redis redis-cli -a 'HadRedis2025!' --no-auth-warning KEYS 'rateLimit:*' 2>/dev/null | head -50
docker exec redis redis-cli -a 'HadRedis2025!' --no-auth-warning --scan --pattern 'rateLimit:*' | while read k; do docker exec redis redis-cli -a 'HadRedis2025!' --no-auth-warning DEL "$k" >/dev/null; done
echo CLEARED
docker exec redis redis-cli -a 'HadRedis2025!' --no-auth-warning KEYS 'rateLimit:*' 2>/dev/null | wc -l
""")

run("sudo systemctl restart new-api && sleep 2 && sudo systemctl is-active new-api")
run("curl -sS -m 5 -o /dev/null -w 'console=%{http_code}\n' http://127.0.0.1:3000/console; curl -sS -m 5 -o /dev/null -w 'status=%{http_code}\n' http://127.0.0.1:3000/api/status")

c.close()
