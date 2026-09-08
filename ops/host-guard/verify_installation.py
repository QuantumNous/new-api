"""Start a real systemd rollback canary against isolated files and a fake Netplan."""
import hashlib
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess
import time

assert os.geteuid() == 0
assert subprocess.check_output(['hostname'], text=True).strip() == 'a1-ubuntu-free'
os.umask(0o077)
base = Path('/var/lib/hardy-network-guard/canary')
assert not base.exists(), 'Canary already exists; inspect its result before repeating'
base.mkdir(parents=True, mode=0o700)
script = Path('/usr/local/sbin/hardy-network-guard')
loader = importlib.machinery.SourceFileLoader('guard', str(script))
spec = importlib.util.spec_from_loader(loader.name, loader)
guard = importlib.util.module_from_spec(spec)
loader.exec_module(guard)
original_hash = guard.fingerprint(Path('/etc/netplan'))
# Exercise the real Netplan merge in a separate filesystem root only.
guard.validate(Path('/etc/netplan'))
(base / 'production-before.json').write_text(json.dumps({'network_hash': original_hash}))
guard.STATE = base / 'state'
guard.LIVE = base / 'live'
guard.STATE.mkdir()
guard.LIVE.mkdir()
(guard.LIVE / '50-base.yaml').write_text('network:\n  version: 2\n')
ident = 'canary'
guard.copy_config(guard.LIVE, guard.STATE / ident / 'before')
(guard.LIVE / '90-new.yaml').write_text('simulated broken candidate\n')
tx = {'id': ident, 'phase': 'awaiting_confirmation', 'deadline': time.time() + 3,
      'confirm_token': 'canary-only', 'before_hash': guard.fingerprint(guard.STATE / ident / 'before')}
guard.save(guard.STATE / 'active.json', tx)
fake = base / 'fake-netplan'
fake.write_text('#!/usr/bin/python3 -I\nfrom pathlib import Path\nimport sys\nwith Path(' + repr(str(base / 'calls.log')) + ').open("a") as f: f.write(" ".join(sys.argv[1:])+"\\n")\n')
fake.chmod(0o700)
runner = base / 'runner.py'
runner.write_text('''import importlib.machinery,importlib.util,sys
from pathlib import Path
loader=importlib.machinery.SourceFileLoader('guard','/usr/local/sbin/hardy-network-guard')
spec=importlib.util.spec_from_loader(loader.name,loader)
g=importlib.util.module_from_spec(spec); loader.exec_module(g)
g.STATE=Path('/var/lib/hardy-network-guard/canary/state')
g.LIVE=Path('/var/lib/hardy-network-guard/canary/live')
g.NETPLAN='/var/lib/hardy-network-guard/canary/fake-netplan'
sys.argv=['guard','check'];g.main()
''')
subprocess.run(['systemd-run', '--unit=hardy-network-guard-canary', '--on-active=5s',
                '--timer-property=AccuracySec=1s', '/usr/bin/python3', '-I', str(runner)], check=True, capture_output=True)
# Reuse the exact production binary to test a deployment build, without activation.
artifact = base / 'running-new-api'
subprocess.run(['docker', 'cp', 'new-api:/new-api', str(artifact)], check=True, capture_output=True)
digest = hashlib.file_digest(artifact.open('rb'), 'sha256').hexdigest() if hasattr(hashlib, 'file_digest') else hashlib.sha256(artifact.read_bytes()).hexdigest()
destination = Path('/home/hardy-deploy/incoming') / digest
shutil.copyfile(artifact, destination)
account = pwd.getpwnam('hardy-deploy')
os.chown(destination, account.pw_uid, account.pw_gid)
destination.chmod(0o600)
(base / 'artifact.json').write_text(json.dumps({'sha256': digest}))
print(json.dumps({'canary_armed': True, 'production_network_changed': False, 'artifact_sha256': digest}))
