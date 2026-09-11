"""Run beside the installed upscale.py. Credentials live in a private JSON file."""
import argparse
import json
import logging
import threading
import time
import urllib.error
import urllib.request
import uuid
import ctypes
import os
from pathlib import Path
from PIL import Image
from upscale import upscale


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding='utf-8-sig'))
    base = config['base_url'].rstrip('/') + '/internal/image-upscale'
    if not (base.startswith('https://') or base.startswith('http://127.0.0.1:')):
        raise ValueError('HTTPS is required')
    token = config['token']
    if len(token) < 32:
        raise ValueError('Worker token is too short')
    if os.name == 'nt':
        # Keep computation available without keeping the monitor on or changing
        # the machine's persistent power plan. Released when this process exits.
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000001)
    work = Path(__file__).resolve().parent / 'worker-state'
    work.mkdir(exist_ok=True)
    state = work / 'job.json'
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(path, data=None, lease=None, extra_headers=None):
        headers = {
            'Authorization': 'Bearer ' + token,
            'User-Agent': 'Hardy-GPU-Worker/1.0',
            'Accept': 'application/json',
        }
        if lease:
            headers['X-Upscale-Lease'] = lease
        if extra_headers:
            headers.update(extra_headers)
        req = urllib.request.Request(base + path, data=data, headers=headers)
        with opener.open(req, timeout=600) as response:
            body = response.read(32 * 1024 * 1024 + 1)
            if len(body) > 32 * 1024 * 1024:
                raise ValueError('Response exceeds limit')
            return body

    def heartbeat():
        while True:
            try:
                request('/heartbeat', b'')
            except Exception:
                pass
            time.sleep(10)

    threading.Thread(target=heartbeat, daemon=True).start()
    while True:
        job = None
        try:
            if state.exists():
                job = json.loads(state.read_text())
            else:
                body = request('/claim', b'')
                if not body:
                    time.sleep(2)
                    continue
                job = json.loads(body)
                # Never allow server-provided paths or commands.
                uuid.UUID(job['id'])
                uuid.UUID(job['lease'])
                if job['target'] not in (2048, 4096):
                    raise ValueError('Invalid target')
                if job.get('output_format') not in ('png', 'webp'):
                    raise ValueError('Invalid output format')
                state.write_text(json.dumps(job), encoding='utf-8')
            inp, out = work/(job['id']+'.input.png'), work/(job['id']+'.output.png')
            transport = work/(job['id']+'.transport.webp')
            if not out.exists():
                inp.write_bytes(request('/'+job['id']+'/input', lease=job['lease']))
                try:
                    report = upscale(inp, out, job['target'])
                    job['compute_ms'] = round(float(report['seconds']) * 1000)
                    state.write_text(json.dumps(job), encoding='utf-8')
                except Exception:
                    request('/'+job['id']+'/fail', b'', job['lease'])
                    state.unlink(missing_ok=True)
                    inp.unlink(missing_ok=True)
                    out.unlink(missing_ok=True)
                    logging.error('GPU processing failed for job %s', job['id'])
                    continue
            if not transport.exists():
                encode_started = time.monotonic()
                with Image.open(out) as im:
                    im.save(transport, 'WEBP', quality=100, method=4)
                job['encode_ms'] = round((time.monotonic() - encode_started) * 1000)
                state.write_text(json.dumps(job), encoding='utf-8')
            timings = {
                'X-Upscale-Compute-Ms': str(max(0, int(job.get('compute_ms', 0)))),
                'X-Upscale-Encode-Ms': str(max(0, int(job.get('encode_ms', 0)))),
            }
            request('/'+job['id']+'/result', transport.read_bytes(), job['lease'], timings)
            state.unlink(missing_ok=True)
            inp.unlink(missing_ok=True)
            out.unlink(missing_ok=True)
            transport.unlink(missing_ok=True)
            logging.info('Completed job %s', job['id'])
        except urllib.error.HTTPError as exc:
            if job and exc.code in (413, 422):
                try:
                    request('/'+job['id']+'/fail', b'', job['lease'])
                except Exception:
                    time.sleep(5)
                    continue
            if job and exc.code in (404, 409, 410, 413, 422):
                state.unlink(missing_ok=True)
                (work/(job['id']+'.input.png')).unlink(missing_ok=True)
                (work/(job['id']+'.output.png')).unlink(missing_ok=True)
                (work/(job['id']+'.transport.webp')).unlink(missing_ok=True)
            logging.warning('Worker HTTP status %s; retrying', exc.code)
            time.sleep(5)
        except Exception as exc:
            logging.warning('Worker error (%s); retrying', type(exc).__name__)
            time.sleep(5)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
    main()
