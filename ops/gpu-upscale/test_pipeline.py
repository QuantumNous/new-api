import json
import tempfile
import threading
import time
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch
from pipeline import Pipeline


def job():
    return dict(id=str(uuid.uuid4()), lease=str(uuid.uuid4()), target=2048, expires_at=time.time()+60)


class PipelineTests(unittest.TestCase):
    def test_claim_without_server_expiry_gets_durable_local_deadline(self):
        item = job()
        del item['expires_at']
        calls = []
        def request(path, data=None, lease=None):
            calls.append(path)
            return json.dumps(item).encode() if path == '/claim' else b'image'
        def render(inp, out, target, lock):
            out.write_bytes(b'output')
            return {}
        with tempfile.TemporaryDirectory() as tmp:
            pipeline = Pipeline(tmp, request, render)
            try:
                pipeline.tick()
                for future in pipeline.pending.values():
                    future.result(timeout=5)
                self.assertIn('/'+item['id']+'/result', calls)
            finally:
                pipeline.pool.shutdown()

    def test_next_image_computes_while_first_upload_waits(self):
        first, second = job(), job()
        uploading = threading.Event()
        second_rendered = threading.Event()
        def request(path, data=None, lease=None):
            if path.endswith('/input'):
                return b'image'
            if first['id'] in path:
                uploading.set()
                self.assertTrue(second_rendered.wait(5))
            return b''
        def render(inp, out, target, lock):
            with lock:
                if second['id'] in str(inp):
                    self.assertTrue(uploading.wait(5))
                    second_rendered.set()
                out.write_bytes(b'lossless result')
            return {}
        with tempfile.TemporaryDirectory() as tmp:
            pipeline = Pipeline(tmp, request, render)
            try:
                for item in (first, second):
                    pipeline.save(item)
                futures = [pipeline.pool.submit(pipeline.process, item) for item in (first, second)]
                for future in futures:
                    future.result(timeout=10)
                self.assertTrue(second_rendered.is_set())
                self.assertEqual(list(Path(tmp).iterdir()), [])
            finally:
                pipeline.pool.shutdown()

    def test_lost_upload_ack_reuses_output_without_recomputing(self):
        item = job()
        counts = dict(render=0, upload=0)
        def request(path, data=None, lease=None):
            if path.endswith('/input'):
                return b'image'
            counts['upload'] += 1
            if counts['upload'] == 1:
                raise TimeoutError()
            return b''
        def render(inp, out, target, lock):
            counts['render'] += 1
            out.write_bytes(b'output')
            return {}
        with tempfile.TemporaryDirectory() as tmp:
            pipeline = Pipeline(tmp, request, render)
            try:
                pipeline.save(item)
                with patch('pipeline.time.sleep'):
                    pipeline.process(item)
                self.assertEqual(counts, dict(render=1, upload=2))
                self.assertFalse((Path(tmp)/(item['id']+'.json')).exists())
            finally:
                pipeline.pool.shutdown()

    def test_restart_uploads_saved_output_without_downloading_or_rendering(self):
        item = job()
        calls = []
        def request(path, data=None, lease=None):
            calls.append(path)
            return b''
        def render(*args):
            self.fail('Saved output must be reused')
        with tempfile.TemporaryDirectory() as tmp:
            pipeline = Pipeline(tmp, request, render)
            try:
                pipeline.save(item)
                (Path(tmp)/(item['id']+'.transport.webp')).write_bytes(b'output')
                pipeline.process(json.loads((Path(tmp)/(item['id']+'.json')).read_text()))
                self.assertEqual(calls, ['/'+item['id']+'/result'])
            finally:
                pipeline.pool.shutdown()


if __name__ == '__main__':
    unittest.main()
