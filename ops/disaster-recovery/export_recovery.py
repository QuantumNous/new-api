#!/usr/bin/python3 -I
"""Create and restore-test a root-private recovery set; no primary mutation."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import tarfile
import time
import urllib.request


def run(args, **kwargs):
    p = subprocess.run(args, capture_output=True, text=True, **kwargs)
    if p.returncode:
        raise RuntimeError('recovery operation failed: ' + args[0])
    return p.stdout


def file_hash(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def main():
    assert os.geteuid() == 0
    assert run(['hostname']).strip() == 'a1-ubuntu-free'
    os.umask(0o077)
    app = json.loads(run(['docker', 'inspect', 'new-api']))[0]
    pg = json.loads(run(['docker', 'inspect', 'new-api-postgres']))[0]
    status = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/status', timeout=5))
    assert status['data']['system_name'] == 'Hardy'
    stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + secrets.token_hex(3)
    work = Path('/var/backups/hardy-dr') / stamp
    work.mkdir(parents=True, mode=0o700)
    env = dict(x.split('=', 1) for x in pg['Config']['Env'] if '=' in x)
    db_user = env['POSTGRES_USER']
    db_name = env.get('POSTGRES_DB', db_user)
    manifest = {'created_at': time.time(), 'source_host': 'a1-ubuntu-free',
                'source_arch': run(['uname', '-m']).strip(), 'app_version': status['data']['version'],
                'app_image_id': app['Image'], 'postgres_image_id': pg['Image'],
                'database': db_name, 'offsite_copy': False, 'restore_verified': False,
                'storage_consistency': 'Live file copy; not an atomic snapshot with PostgreSQL. Reconcile expiring drawing files after recovery.'}
    (work / 'app-container.json').write_text(json.dumps(app))
    for source, target in [('/etc/hardy-ops/app-compose.json', 'app-compose.json'),
                           ('/etc/hardy-ops/policy.json', 'deploy-policy.json'),
                           ('/opt/new-api/compose.deploy.yml', 'legacy-compose.yml')]:
        (work / target).write_bytes(Path(source).read_bytes())
    # PG dump is transactionally consistent; active requests are not stopped.
    with (work / 'database.dump').open('wb') as f:
        subprocess.run(['docker', 'exec', 'new-api-postgres', 'pg_dump', '-U', db_user,
                        '-d', db_name, '-Fc'], stdout=f, stderr=subprocess.PIPE, check=True)
    with tarfile.open(work / 'app-data.tar.gz', 'w:gz') as archive:
        archive.add('/opt/new-api/data', arcname='data', recursive=True)
    with (work / 'app-image.tar').open('wb') as f:
        subprocess.run(['docker', 'image', 'save', app['Image']], stdout=f, stderr=subprocess.PIPE, check=True)
    test_name = 'hardy-restore-' + stamp.lower()
    password_file = work / 'restore-test.env'
    password_file.write_text('POSTGRES_USER=restoretest\nPOSTGRES_DB=restoretest\nPOSTGRES_PASSWORD=' + secrets.token_hex(32) + '\n')
    try:
        run(['docker', 'run', '-d', '--name', test_name, '--network', 'none', '--env-file', str(password_file),
             '--tmpfs', '/var/lib/postgresql/data:rw,size=512m', pg['Image']], timeout=30)
        for _ in range(30):
            p = subprocess.run(['docker', 'exec', test_name, 'pg_isready', '-U', 'restoretest'], capture_output=True)
            if p.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('isolated restore database did not start')
        with (work / 'database.dump').open('rb') as f:
            p = subprocess.run(['docker', 'exec', '-i', test_name, 'pg_restore', '--exit-on-error',
                                '--no-owner', '--no-privileges', '-U', 'restoretest', '-d', 'restoretest'],
                               stdin=f, capture_output=True)
        if p.returncode:
            (work / 'restore-error.log').write_bytes(p.stderr)
            raise RuntimeError('restore validation failed; inspect the private restore log')
        counts = run(['docker', 'exec', test_name, 'psql', '-U', 'restoretest', '-d', 'restoretest', '-At', '-v',
                      'ON_ERROR_STOP=1', '-c', 'select (select count(*) from users), (select count(*) from channels);']).strip()
        manifest.update(restore_verified=True, restored_user_channel_counts=counts)
    finally:
        # Only remove the unique test container created by this invocation.
        subprocess.run(['docker', 'rm', '-f', test_name], capture_output=True)
        password_file.unlink(missing_ok=True)
    manifest['files'] = {p.name: {'bytes': p.stat().st_size, 'sha256': file_hash(p)} for p in work.iterdir() if p.is_file()}
    (work / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print(json.dumps({'recovery_directory': str(work), 'restore_verified': True,
                      'offsite_copy': False, 'primary_network_changed': False,
                      'primary_application_restarted': False, 'bytes': sum(f['bytes'] for f in manifest['files'].values())}))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Subprocess command output may contain DB connection details.
        print(json.dumps({'error': type(exc).__name__}))
        raise SystemExit(1)
