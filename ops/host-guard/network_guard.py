#!/usr/bin/python3 -I
"""Root-only, timed Netplan transactions. Never invoked by the deployment role."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile
import time

STATE = Path('/var/lib/hardy-network-guard')
LIVE = Path('/etc/netplan')
NETPLAN = '/usr/sbin/netplan'
SYSTEMCTL = '/usr/bin/systemctl'
TIMEOUT = 180


def run(args, timeout=30):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError('command failed: ' + args[0])
    return p.stdout


def save(path, value):
    tmp = path.with_suffix('.tmp')
    with tmp.open('w') as f:
        json.dump(value, f)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)
    fd = os.open(path.parent, os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def config_files(directory):
    files = sorted(directory.glob('*.yaml'))
    if not files:
        raise RuntimeError('configuration directory has no YAML files')
    for p in files:
        if p.is_symlink() or not p.is_file() or p.stat().st_size > 1024 * 1024:
            raise RuntimeError('unsafe configuration file')
    return files


def copy_config(source, target):
    target.mkdir(parents=True, exist_ok=True, mode=0o700)
    files = config_files(source)
    for p in files:
        shutil.copyfile(p, target / p.name)
        (target / p.name).chmod(0o600)


def replace_config(source):
    files = config_files(source)
    # Stage each file first; an interrupted replacement remains covered by the timer.
    for p in files:
        staged = LIVE / ('.hardy-' + p.name)
        shutil.copyfile(p, staged)
        staged.chmod(0o600)
        os.replace(staged, LIVE / p.name)
    names = {p.name for p in files}
    for p in LIVE.glob('*.yaml'):
        if p.name not in names:
            p.unlink()


def fingerprint(directory):
    h = hashlib.sha256()
    for p in config_files(directory):
        h.update(p.name.encode() + b'\0' + p.read_bytes() + b'\0')
    return h.hexdigest()


def validate(candidate):
    # Includes distribution and runtime overlays in the dry-run merge.
    with tempfile.TemporaryDirectory(prefix='validate-', dir=STATE) as temp:
        root = Path(temp)
        for origin in (Path('/lib/netplan'), Path('/run/netplan')):
            if origin.exists():
                shutil.copytree(origin, root / str(origin).lstrip('/'), symlinks=False)
        copy_config(candidate, root / 'etc/netplan')
        run([NETPLAN, 'generate', '--root-dir', str(root)])


def active():
    path = STATE / 'active.json'
    return json.loads(path.read_text()) if path.exists() else None


def finish(tx, phase):
    tx['phase'] = phase
    tx['finished_at'] = time.time()
    save(STATE / tx['id'] / 'result.json', tx)
    (STATE / 'active.json').unlink(missing_ok=True)


def rollback(tx):
    tx['phase'] = 'rolling_back'
    save(STATE / 'active.json', tx)
    try:
        replace_config(STATE / tx['id'] / 'before')
        run([NETPLAN, 'generate'])
        run([NETPLAN, 'apply'], timeout=45)
    except Exception:
        # Leave expired transaction armed; subsequent timer runs retry restoration.
        tx['phase'] = 'rollback_failed'
        save(STATE / 'active.json', tx)
        raise
    finish(tx, 'rolled_back')


def dispatch(args):
    command = args[0] if args else 'status'
    tx = active()
    if command == 'status' and len(args) <= 1:
        return tx or {'phase': 'idle'}
    if command == 'check' and len(args) == 1:
        if tx and time.time() >= tx['deadline']:
            rollback(tx)
            return {'phase': 'rolled_back', 'id': tx['id']}
        return {'phase': 'waiting' if tx else 'idle'}
    if command == 'begin' and len(args) == 2:
        if tx:
            raise RuntimeError('another network change is pending')
        run([SYSTEMCTL, 'is-active', '--quiet', 'hardy-network-rollback.timer'])
        candidate = Path(args[1]).resolve(strict=True)
        ident = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + secrets.token_hex(4)
        work = STATE / ident
        work.mkdir(mode=0o700)
        copy_config(LIVE, work / 'before')
        copy_config(candidate, work / 'candidate')
        validate(work / 'candidate')
        tx = {'id': ident, 'phase': 'armed', 'deadline': time.time() + TIMEOUT,
              'before_hash': fingerprint(LIVE), 'candidate_hash': fingerprint(work / 'candidate'),
              'confirm_token': secrets.token_hex(24)}
        save(STATE / 'active.json', tx)
        try:
            replace_config(work / 'candidate')
            run([NETPLAN, 'generate'])
            run([NETPLAN, 'apply'], timeout=45)
            tx['phase'] = 'awaiting_confirmation'
            save(STATE / 'active.json', tx)
        except Exception:
            rollback(tx)
            raise
        # Confirmation token is retrieved only by the following SSH verification call.
        return {k: v for k, v in tx.items() if k != 'confirm_token'}
    if command == 'verify' and len(args) == 2:
        if not tx or tx['id'] != args[1] or tx['phase'] != 'awaiting_confirmation':
            raise RuntimeError('no matching change awaiting confirmation')
        if time.time() >= tx['deadline']:
            rollback(tx)
            raise RuntimeError('change expired; rollback executed')
        if fingerprint(LIVE) != tx['candidate_hash']:
            raise RuntimeError('configuration changed outside this transaction')
        tx['verified_at'] = time.time()
        save(STATE / 'active.json', tx)
        return {'id': tx['id'], 'token': tx['confirm_token'], 'deadline': tx['deadline']}
    if command == 'confirm' and len(args) == 3:
        if not tx or tx['id'] != args[1] or not secrets.compare_digest(tx['confirm_token'], args[2]):
            raise RuntimeError('invalid confirmation')
        if time.time() >= tx['deadline']:
            rollback(tx)
            raise RuntimeError('change expired; rollback executed')
        if not tx.get('verified_at') or fingerprint(LIVE) != tx['candidate_hash']:
            raise RuntimeError('configuration not verified')
        finish(tx, 'confirmed')
        return {'phase': 'confirmed', 'id': tx['id']}
    if command == 'rollback' and len(args) == 2:
        if not tx or tx['id'] != args[1]:
            raise RuntimeError('no matching pending change')
        rollback(tx)
        return {'phase': 'rolled_back', 'id': tx['id']}
    raise RuntimeError('usage: status | begin DIRECTORY | verify ID | confirm ID TOKEN | rollback ID')


def main():
    if os.geteuid() != 0:
        raise RuntimeError('network administration requires the rescue administrator')
    os.umask(0o077)
    os.environ.clear()
    os.environ['PATH'] = '/usr/sbin:/usr/bin:/sbin:/bin'
    os.chdir('/')
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (STATE / 'lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        result = dispatch(sys.argv[1:])
        if (sys.argv[1:] or ['status'])[0] == 'status':
            result = {k: v for k, v in result.items() if k != 'confirm_token'}
        print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'error': str(exc)}), file=sys.stderr)
        sys.exit(1)
