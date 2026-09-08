#!/usr/bin/python3 -I
"""Narrow deployment capability: fixed container settings, no shell/Docker access."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import time
import urllib.request

ROOT = Path('/var/lib/hardy-app-deploy')
CONFIG = Path('/etc/hardy-ops')
INCOMING = Path('/home/hardy-deploy/incoming')
DOCKER = '/usr/bin/docker'


def run(args, timeout=90):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError('operation failed: ' + Path(args[0]).name)
    return p.stdout


def write_json(path, data):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data))
    os.replace(temp, path)


def inspect():
    c = json.loads(run([DOCKER, 'inspect', 'new-api']))[0]
    return {'image_id': c['Image'], 'status': c['State']['Status'],
            'health': c['State'].get('Health', {}).get('Status'), 'restarts': c['RestartCount']}


def check_current():
    policy = json.loads((CONFIG / 'policy.json').read_text())
    if inspect()['image_id'] != policy['current_image_id']:
        raise RuntimeError('application changed outside guarded deployment; administrator must reconcile policy')
    return policy


def copy_binary(digest, target):
    uid = pwd.getpwnam('hardy-deploy').pw_uid
    directory = os.open(INCOMING, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        fd = os.open(digest, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
    finally:
        os.close(directory)
    with os.fdopen(fd, 'rb') as source:
        meta = os.fstat(source.fileno())
        if not stat.S_ISREG(meta.st_mode) or meta.st_uid != uid or not 20 <= meta.st_size <= 256 * 1024 * 1024:
            raise RuntimeError('invalid deployment artifact')
        with target.open('wb') as dest:
            h = hashlib.sha256()
            length = 0
            while chunk := source.read(1024 * 1024):
                length += len(chunk)
                if length > 256 * 1024 * 1024:
                    raise RuntimeError('artifact too large')
                h.update(chunk)
                dest.write(chunk)
        if h.hexdigest() != digest:
            target.unlink()
            raise RuntimeError('artifact SHA256 mismatch')
    with target.open('rb') as f:
        header = f.read(20)
    if header[:6] != b'\x7fELF\x02\x01' or int.from_bytes(header[18:20], 'little') != 183:
        target.unlink()
        raise RuntimeError('expected a Linux ARM64 executable')
    target.chmod(0o755)


def build(version, digest):
    policy = check_current()
    work = ROOT / digest
    manifest_path = work / 'manifest.json'
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        if manifest['version'] != version:
            raise RuntimeError('artifact already built under a different version')
        return manifest
    work.mkdir(mode=0o700, exist_ok=True)
    copy_binary(digest, work / 'new-api')
    (work / 'Dockerfile').write_text('FROM ' + policy['base_image_id'] + '\nCOPY new-api /new-api\n')
    # No uploaded Dockerfile, scripts, environment, build arguments, mounts or network.
    tag = 'hardy777/new-api:guard-' + digest[:20]
    run([DOCKER, 'build', '--network=none', '--pull=false', '-t', tag, str(work)], timeout=120)
    image_id = run([DOCKER, 'image', 'inspect', '--format', '{{.Id}}', tag]).strip()
    manifest = {'version': version, 'sha256': digest, 'image_id': image_id, 'built_at': time.time()}
    write_json(manifest_path, manifest)
    return manifest


def healthy(version):
    client = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(20):
        try:
            with client.open('http://127.0.0.1:3000/api/status', timeout=2) as r:
                data = json.load(r)
            if data.get('data', {}).get('version') == version and inspect()['health'] == 'healthy':
                return True
        except Exception:
            pass
        time.sleep(2)
    return False


def prepare_storage(uid, gid):
    # fwalk anchors operations to directory descriptors; do not follow a symlink
    # planted in application-writable storage while recursively setting ownership.
    for directory in ('/opt/new-api/data', '/opt/new-api/logs'):
        fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fchown(fd, uid, gid)
            for _, dirs, files, parent in os.fwalk('.', dir_fd=fd, follow_symlinks=False):
                for name in dirs + files:
                    os.chown(name, uid, gid, dir_fd=parent, follow_symlinks=False)
        finally:
            os.close(fd)


def activate(version, digest):
    policy = check_current()
    manifest = json.loads((ROOT / digest / 'manifest.json').read_text())
    if manifest['version'] != version:
        raise RuntimeError('version does not match built artifact')
    prepare_storage(policy['runtime_uid'], policy['runtime_gid'])
    path = CONFIG / 'app-compose.json'
    before = json.loads(path.read_text())
    after = json.loads(path.read_text())
    after['services']['new-api']['image'] = manifest['image_id']
    write_json(ROOT / 'previous-compose.json', before)
    write_json(path, after)
    args = [DOCKER, 'compose', '--env-file', '/dev/null', '-p', 'new-api', '-f', str(path), 'up', '-d', '--no-deps', '--pull', 'never', 'new-api']
    try:
        run(args)
        if not healthy(version):
            raise RuntimeError('candidate did not pass application health check')
    except Exception:
        write_json(path, before)
        run(args)
        raise RuntimeError('activation failed; previous image restored; review database compatibility separately')
    policy['current_image_id'] = manifest['image_id']
    write_json(CONFIG / 'policy.json', policy)
    return {'activated': version, **inspect()}


def main():
    if os.geteuid() != 0:
        raise RuntimeError('use the approved sudo entry point')
    os.umask(0o077)
    os.environ.clear()
    os.environ['PATH'] = '/usr/sbin:/usr/bin:/sbin:/bin'
    os.chdir('/')
    ROOT.mkdir(parents=True, mode=0o700, exist_ok=True)
    args = sys.argv[1:]
    with (ROOT / 'lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args == ['status']:
            result = inspect()
        elif args == ['restart']:
            check_current()
            run([DOCKER, 'restart', 'new-api'])
            result = inspect()
        elif len(args) == 3 and args[0] in ('build', 'activate'):
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,79}', args[1]) or not re.fullmatch(r'[0-9a-f]{64}', args[2]):
                raise RuntimeError('invalid version or digest')
            result = (build if args[0] == 'build' else activate)(args[1], args[2])
        else:
            raise RuntimeError('allowed: status | restart | build VERSION SHA256 | activate VERSION SHA256')
        print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Do not echo Docker output, environment, or application secrets.
        print(json.dumps({'error': str(exc)}), file=sys.stderr)
        sys.exit(1)
