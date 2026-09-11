"""Bounded single-GPU pipeline with durable per-job retries."""
import json
import logging
import threading
import time
import urllib.error
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


class Pipeline:
    def __init__(self, work, request, render, capacity=3):
        self.work = Path(work)
        self.request = request
        self.render = render
        self.capacity = capacity
        self.gpu = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=capacity)
        self.pending = {}

    def save(self, job):
        for key in ('id', 'lease'):
            if str(uuid.UUID(job[key])) != job[key]:
                raise ValueError('Invalid job identifier')
        if job['target'] not in (2048, 4096):
            raise ValueError('Invalid target')
        job.setdefault('expires_at', time.time() + 600)
        path = self.work / (job['id'] + '.json')
        tmp = path.with_suffix('.json.tmp')
        tmp.write_text(json.dumps(job), encoding='utf-8')
        tmp.replace(path)
        return path

    def clean(self, job):
        for suffix in ('.input.png', '.input.tmp', '.transport.webp', '.transport.webp.tmp', '.json'):
            (self.work / (job['id'] + suffix)).unlink(missing_ok=True)

    def process(self, job):
        started = time.monotonic()
        inp = self.work / (job['id'] + '.input.png')
        out = self.work / (job['id'] + '.transport.webp')
        path = '/' + job['id']
        timings = {}
        while time.time() < job.get('expires_at', 0):
            try:
                if job.get('render_failed'):
                    self.request(path + '/fail', b'', job['lease'])
                    self.clean(job)
                    return
                if not out.exists():
                    if not inp.exists():
                        tick = time.monotonic()
                        content = self.request(path + '/input', lease=job['lease'])
                        tmp = inp.with_suffix('.tmp')
                        tmp.write_bytes(content)
                        tmp.replace(inp)
                        timings['download_s'] = round(time.monotonic() - tick, 3)
                    try:
                        timings.update(self.render(inp, out, job['target'], self.gpu))
                    except Exception:
                        # Persist failure intent: a failed acknowledgement must
                        # not cause another GPU computation after restart.
                        job['render_failed'] = True
                        self.save(job)
                        raise
                if job.get('render_failed'):
                    self.request(path + '/fail', b'', job['lease'])
                else:
                    tick = time.monotonic()
                    self.request(path + '/result', out.read_bytes(), job['lease'])
                    timings['upload_ack_s'] = round(time.monotonic() - tick, 3)
                    timings['total_s'] = round(time.monotonic() - started, 3)
                    timings['bytes'] = out.stat().st_size
                    logging.info('Completed job %s stages=%s', job['id'], json.dumps(timings))
                self.clean(job)
                return
            except urllib.error.HTTPError as exc:
                if exc.code in (404, 409, 410):
                    self.clean(job)
                    return
                if exc.code in (413, 422):
                    job['render_failed'] = True
                    self.save(job)
                logging.warning('Job %s HTTP %s; retrying', job['id'], exc.code)
            except Exception as exc:
                logging.warning('Job %s error %s; retrying', job['id'], type(exc).__name__)
            time.sleep(2)
            if job.get('render_failed'):
                # Skip download/render on the next attempt; retry only fail ACK.
                try:
                    self.request(path + '/fail', b'', job['lease'])
                    self.clean(job)
                    return
                except Exception:
                    continue
        self.clean(job)
        logging.warning('Job %s expired', job['id'])

    def tick(self):
        for key, future in list(self.pending.items()):
            if future.done():
                future.result()
                del self.pending[key]
        # Recover saved jobs before claiming more work.
        for state in self.work.glob('*.json'):
            if state.stem in self.pending:
                continue
            if state.name == 'job.json':
                job = json.loads(state.read_text())
                self.save(job)
                state.unlink()
            else:
                job = json.loads(state.read_text())
            job.setdefault('expires_at', time.time() + 600)
            if job['id'] not in self.pending and len(self.pending) < self.capacity:
                self.pending[job['id']] = self.pool.submit(self.process, job)
        if len(self.pending) >= self.capacity:
            return
        body = self.request('/claim', b'')
        if body:
            job = json.loads(body)
            self.save(job)
            self.pending[job['id']] = self.pool.submit(self.process, job)

