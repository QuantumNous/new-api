"""Exercise reconnect behavior without a GPU or paid image request."""
import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


class WorkerReconnectTest(unittest.TestCase):
    def test_claim_timeout_retries_and_recovers_without_restarting(self):
        fake_upscale = types.ModuleType('upscale')
        fake_upscale.upscale = MagicMock()
        with patch.dict(sys.modules, {'upscale': fake_upscale, 'PIL': MagicMock()}):
            spec = importlib.util.spec_from_file_location('worker_test_target', Path(__file__).with_name('worker.py'))
            worker = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(worker)

        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / 'config.json'
            config.write_text(json.dumps({'base_url': 'https://example.com', 'token': 'test-only-' * 4}))
            response = MagicMock()
            response.__enter__.return_value.read.return_value = b''
            opener = MagicMock()
            opener.open.side_effect = [TimeoutError(), response]
            # Exit after the successful idle poll rather than running forever.
            with patch.object(worker, '__file__', str(Path(folder) / 'worker.py')), \
                 patch.object(sys, 'argv', ['worker.py', '--config', str(config)]), \
                 patch.object(worker.urllib.request, 'build_opener', return_value=opener), \
                 patch.object(worker.time, 'sleep', side_effect=[None, KeyboardInterrupt()]) as sleep, \
                 patch.object(worker.ctypes, 'windll', create=True), \
                 self.assertLogs(level='INFO') as logs:
                with self.assertRaises(KeyboardInterrupt):
                    worker.main()
            self.assertEqual(opener.open.call_count, 2)
            for call in opener.open.call_args_list:
                self.assertEqual(call.kwargs['timeout'], 15)
                self.assertEqual(call.args[0].full_url, 'https://example.com/internal/image-upscale/claim')
            self.assertEqual(sleep.call_args_list[0].args, (2,))
            self.assertTrue(any('connection restored' in line for line in logs.output))
            fake_upscale.upscale.assert_not_called()


if __name__ == '__main__':
    unittest.main()
