"""Run as rescue admin on the verified production host; never reloads networking."""
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess


def run(args):
    p = subprocess.run(args, capture_output=True, text=True, check=True)
    return p.stdout


assert os.geteuid() == 0
assert run(['hostname']).strip() == 'a1-ubuntu-free'
os.umask(0o077)
source = Path(__file__).resolve().parent
config = Path('/etc/hardy-ops')
assert not config.exists(), 'Existing guard installation: reconcile it instead of replacing policy.'
app = json.loads(run(['docker', 'inspect', 'new-api']))[0]
assert app['State']['Health']['Status'] == 'healthy'
assert not app['HostConfig']['Privileged']
assert not app['HostConfig']['CapAdd']
assert app['HostConfig']['NetworkMode'] == 'new-api_default'
assert {m['Source'] for m in app['Mounts']} == {'/opt/new-api/data', '/opt/new-api/logs'}
compose = json.loads(run(['docker', 'compose', '-f', '/opt/new-api/compose.deploy.yml', 'config', '--format', 'json']))
service = compose['services']['new-api']
# The old administrator workflow builds from its checkout. The restricted role
# must never execute that Dockerfile or any user-supplied build instructions.
service.pop('build', None)
assert not any(service.get(k) for k in ['privileged', 'build', 'devices', 'cap_add', 'pid', 'ipc', 'network_mode', 'configs', 'secrets'])
service.pop('depends_on', None)
service['image'] = app['Image']
try:
    runtime = pwd.getpwnam('hardy-app-runtime')
except KeyError:
    run(['useradd', '--system', '--user-group', '--no-create-home', '--shell', '/usr/sbin/nologin', 'hardy-app-runtime'])
    runtime = pwd.getpwnam('hardy-app-runtime')
service['user'] = str(runtime.pw_uid) + ':' + str(runtime.pw_gid)
service['cap_drop'] = ['ALL']
service['security_opt'] = ['no-new-privileges:true']
networks = {name: {'external': True, 'name': value['name']} for name, value in compose.get('networks', {}).items()}
locked = {'name': 'new-api', 'services': {'new-api': service}, 'networks': networks}

def literal_values(value):
    if isinstance(value, str):
        return value.replace('$', '$$')
    if isinstance(value, dict):
        return {k: literal_values(v) for k, v in value.items()}
    if isinstance(value, list):
        return [literal_values(v) for v in value]
    return value

config.mkdir(mode=0o700)
(config / 'app-compose.json').write_text(json.dumps(literal_values(locked)))
(config / 'policy.json').write_text(json.dumps({'base_image_id': app['Image'], 'current_image_id': app['Image'], 'runtime_uid': runtime.pw_uid, 'runtime_gid': runtime.pw_gid}))
resolved = json.loads(run(['docker', 'compose', '--env-file', '/dev/null', '-p', 'new-api', '-f', str(config / 'app-compose.json'), 'config', '--format', 'json']))
assert resolved['services']['new-api']['environment'] == service['environment'], 'Frozen environment must preserve literal credentials'
try:
    account = pwd.getpwnam('hardy-deploy')
    raise RuntimeError('Existing deployment account must be inspected before installation')
except KeyError:
    run(['useradd', '--create-home', '--shell', '/bin/bash', 'hardy-deploy'])
account = pwd.getpwnam('hardy-deploy')
home = Path(account.pw_dir)
ssh = home / '.ssh'
ssh.mkdir(mode=0o700)
pub = (source / 'deployment-key.pub').read_text().strip()
assert pub.startswith('ssh-ed25519 ') and '\n' not in pub
(ssh / 'authorized_keys').write_text('restrict ' + pub + '\n')
(ssh / 'authorized_keys').chmod(0o600)
(home / 'incoming').mkdir(mode=0o700)
for p in [ssh, ssh / 'authorized_keys', home / 'incoming']:
    os.chown(p, account.pw_uid, account.pw_gid)
for src, dest in [('app_deploy.py', '/usr/local/sbin/hardy-app-deploy'), ('network_guard.py', '/usr/local/sbin/hardy-network-guard')]:
    shutil.copyfile(source / src, dest)
    os.chmod(dest, 0o755)
    os.chown(dest, 0, 0)
rule = Path('/etc/sudoers.d/70-hardy-app-deploy')
staged = config / 'sudoers-check'
staged.write_text('hardy-deploy ALL=(root) NOPASSWD: /usr/local/sbin/hardy-app-deploy\n')
run(['visudo', '-cf', str(staged)])
shutil.copyfile(staged, rule)
rule.chmod(0o440)
staged.unlink()
run(['visudo', '-c'])
for name in ['hardy-network-rollback.service', 'hardy-network-rollback.timer']:
    shutil.copyfile(source / name, Path('/etc/systemd/system') / name)
    (Path('/etc/systemd/system') / name).chmod(0o644)
run(['systemd-analyze', 'verify', '/etc/systemd/system/hardy-network-rollback.service', '/etc/systemd/system/hardy-network-rollback.timer'])
run(['systemctl', 'daemon-reload'])
run(['systemctl', 'enable', '--now', 'hardy-network-rollback.timer'])
run(['/usr/local/sbin/hardy-network-guard', 'status'])
run(['systemctl', 'start', 'hardy-network-rollback.service'])
print(json.dumps({'installed': True, 'network_reloaded': False, 'application_restarted': False, 'rescue_account_changed': False}))
