import paramiko
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
cmd = r"""
ps aux | grep -E 'gen_on_server|settlement_v3' | grep -v grep | head -10
ls -lh /tmp/gen_on_server_v3.py /tmp/settlement_spec_v3.json 2>/dev/null
ls -lh /tmp/settlement_v3 2>/dev/null | head
df -h /tmp / | tail -5
"""
stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
print(stdout.read().decode())
print(stderr.read().decode())
c.close()
