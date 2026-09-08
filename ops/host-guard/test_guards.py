"""Boundary tests; no production network or application mutation."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


guard = module('network_guard', 'network_guard.py')
deploy = module('app_deploy', 'app_deploy.py')


class NetworkTransactions(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.state = self.root / 'state'
        self.live = self.root / 'live'
        self.candidate = self.root / 'candidate'
        for path in (self.state, self.live, self.candidate):
            path.mkdir()
        self.original = 'network:\n  version: 2\n  ethernets:\n    dummy0:\n      dhcp4: true\n'
        (self.live / '50-base.yaml').write_text(self.original)
        (self.candidate / '50-base.yaml').write_text(self.original)
        (self.candidate / '90-new.yaml').write_text('network:\n  version: 2\n')
        self.patch = patch.multiple(guard, STATE=self.state, LIVE=self.live)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def test_deadline_restores_snapshot_and_removes_new_overlay(self):
        def command(args, **kwargs):
            if args[-1] == 'apply':
                self.assertTrue((self.state / 'active.json').exists(), 'rollback must be armed before applying')
            return ''
        with patch.object(guard, 'run', side_effect=command), patch.object(guard, 'validate'):
            tx = guard.dispatch(['begin', str(self.candidate)])
            self.assertNotIn('confirm_token', tx)
            self.assertTrue((self.live / '90-new.yaml').exists())
            with patch.object(guard.time, 'time', return_value=tx['deadline'] + 1):
                result = guard.dispatch(['check'])
        self.assertEqual(result['phase'], 'rolled_back')
        self.assertEqual((self.live / '50-base.yaml').read_text(), self.original)
        self.assertFalse((self.live / '90-new.yaml').exists())
        self.assertFalse((self.state / 'active.json').exists())

    def test_confirm_requires_verification_and_rejects_external_edit(self):
        with patch.object(guard, 'run', return_value=''), patch.object(guard, 'validate'):
            tx = guard.dispatch(['begin', str(self.candidate)])
            secret = guard.active()['confirm_token']
            with self.assertRaisesRegex(RuntimeError, 'not verified'):
                guard.dispatch(['confirm', tx['id'], secret])
            receipt = guard.dispatch(['verify', tx['id']])
            (self.live / '90-new.yaml').write_text('changed')
            with self.assertRaisesRegex(RuntimeError, 'not verified'):
                guard.dispatch(['confirm', tx['id'], receipt['token']])
            guard.dispatch(['rollback', tx['id']])

    def test_confirmation_cancels_future_rollback(self):
        with patch.object(guard, 'run', return_value=''), patch.object(guard, 'validate'):
            tx = guard.dispatch(['begin', str(self.candidate)])
            receipt = guard.dispatch(['verify', tx['id']])
            result = guard.dispatch(['confirm', tx['id'], receipt['token']])
            self.assertEqual(result['phase'], 'confirmed')
            with patch.object(guard.time, 'time', return_value=tx['deadline'] + 1):
                self.assertEqual(guard.dispatch(['check'])['phase'], 'idle')
        self.assertTrue((self.live / '90-new.yaml').exists())

    def test_invalid_candidate_never_arms_or_changes_live_config(self):
        with patch.object(guard, 'run', return_value=''), patch.object(guard, 'validate', side_effect=RuntimeError('invalid')):
            with self.assertRaisesRegex(RuntimeError, 'invalid'):
                guard.dispatch(['begin', str(self.candidate)])
        self.assertFalse((self.state / 'active.json').exists())
        self.assertFalse((self.live / '90-new.yaml').exists())

    def test_failed_restore_remains_armed_for_next_timer_run(self):
        with patch.object(guard, 'run', return_value=''), patch.object(guard, 'validate'):
            tx = guard.dispatch(['begin', str(self.candidate)])
        with patch.object(guard.time, 'time', return_value=tx['deadline'] + 1):
            with patch.object(guard, 'run', side_effect=RuntimeError('apply failed')):
                with self.assertRaises(RuntimeError):
                    guard.dispatch(['check'])
            self.assertEqual(guard.active()['phase'], 'rollback_failed')
            with patch.object(guard, 'run', return_value=''):
                self.assertEqual(guard.dispatch(['check'])['phase'], 'rolled_back')

    def test_live_rollback_timer_must_be_active_before_mutation(self):
        with patch.object(guard, 'run', side_effect=RuntimeError('timer inactive')):
            with self.assertRaisesRegex(RuntimeError, 'timer inactive'):
                guard.dispatch(['begin', str(self.candidate)])
        self.assertFalse((self.state / 'active.json').exists())
        self.assertFalse((self.live / '90-new.yaml').exists())

    def test_expired_transaction_cannot_be_confirmed(self):
        with patch.object(guard, 'run', return_value=''), patch.object(guard, 'validate'):
            tx = guard.dispatch(['begin', str(self.candidate)])
            receipt = guard.dispatch(['verify', tx['id']])
            with patch.object(guard.time, 'time', return_value=tx['deadline'] + 1):
                with self.assertRaisesRegex(RuntimeError, 'expired'):
                    guard.dispatch(['confirm', tx['id'], receipt['token']])
        self.assertEqual((self.live / '50-base.yaml').read_text(), self.original)


class DeploymentBoundaries(unittest.TestCase):
    def test_artifact_symlink_cannot_read_host_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            incoming = root / 'incoming'
            incoming.mkdir()
            outside = root / 'secret'
            outside.write_bytes(b'private-host-content')
            (incoming / ('a' * 64)).symlink_to(outside)
            with patch.object(deploy, 'INCOMING', incoming):
                with self.assertRaises(OSError):
                    deploy.copy_binary('a' * 64, root / 'output')
            self.assertFalse((root / 'output').exists())

    def test_artifact_digest_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ('b' * 64)).write_bytes(b'x' * 100)
            with patch.object(deploy, 'INCOMING', root), patch.object(deploy.pwd, 'getpwnam') as user:
                user.return_value.pw_uid = os.getuid()
                with self.assertRaisesRegex(RuntimeError, 'SHA256 mismatch'):
                    deploy.copy_binary('b' * 64, root / 'output')
            self.assertFalse((root / 'output').exists())

    def test_failed_activation_reapplies_previous_fixed_configuration(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            config = root / 'config'
            config.mkdir()
            digest = 'c' * 64
            (root / digest).mkdir()
            previous = {'services': {'new-api': {'image': 'sha256:old', 'environment': {'A': 'unchanged'}}}}
            (config / 'app-compose.json').write_text(json.dumps(previous))
            (root / digest / 'manifest.json').write_text(json.dumps({'version': 'v2', 'image_id': 'sha256:new'}))
            images = []
            def command(args):
                images.append(json.loads((config / 'app-compose.json').read_text())['services']['new-api']['image'])
                self.assertIn('--no-deps', args)
                return ''
            with patch.multiple(deploy, ROOT=root, CONFIG=config), patch.object(deploy, 'check_current', return_value={'runtime_uid': 1003, 'runtime_gid': 1003}), patch.object(deploy, 'prepare_storage'), patch.object(deploy, 'healthy', return_value=False), patch.object(deploy, 'run', side_effect=command):
                with self.assertRaisesRegex(RuntimeError, 'activation failed'):
                    deploy.activate('v2', digest)
            self.assertEqual(images, ['sha256:new', 'sha256:old'])
            self.assertEqual(json.loads((config / 'app-compose.json').read_text()), previous)


if __name__ == '__main__':
    unittest.main(verbosity=2)
