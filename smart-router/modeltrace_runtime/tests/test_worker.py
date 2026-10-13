import hashlib
import importlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


FORBIDDEN_MODULES = (
    "third_party.modeltrace.app",
    "third_party.modeltrace.enrollment",
    "third_party.modeltrace.transport",
    "third_party.modeltrace.web",
)
BANK_ENVIRONMENT_KEY = "SMART_ROUTER_MODELTRACE_BANK"
MAX_BANK_BYTES = 16 * 1024 * 1024
MAX_STDIN_BYTES = 256 * 1024
PYTHON_EXECUTABLE = (
    "/private/tmp/smart-router-modeltrace-evidence-20261012/venv/bin/python"
)
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
VENDORED_BANK_PATH = (
    REPOSITORY_ROOT
    / "third_party"
    / "modeltrace"
    / "data"
    / "unified_bank.json"
)


class WorkerTest(unittest.TestCase):
    def base_request(self):
        return {
            "schema_version": 1,
            "bank_revision": "a" * 64,
            "samples": [
                {
                    "challenge_id": "challenge-1",
                    "expected_count": 0,
                    "numbers": [1] * 80,
                }
            ],
        }

    def assert_worker_error(self, request, expected_message):
        worker = importlib.import_module("modeltrace_runtime.worker")
        error = None
        try:
            worker.process(request)
        except Exception as caught:
            error = caught
        self.assertIs(type(error), ValueError)
        self.assertEqual(expected_message, str(error))

    def call_worker(self, request):
        worker = importlib.import_module("modeltrace_runtime.worker")
        try:
            return worker.process(request), None
        except Exception as caught:
            return None, caught

    def run_stdio(self, payload, bank_path):
        return subprocess.run(
            [
                PYTHON_EXECUTABLE,
                "-m",
                "modeltrace_runtime.worker",
            ],
            cwd=REPOSITORY_ROOT,
            input=payload,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={
                "PYTHONDONTWRITEBYTECODE": "1",
                BANK_ENVIRONMENT_KEY: str(bank_path),
            },
            timeout=20,
            check=False,
        )

    def test_process_callable_capability_probe_without_vendor_apps(self):
        before = set(sys.modules)
        location = importlib.util.find_spec("modeltrace_runtime.worker")

        self.assertIsNotNone(location, "ModelTrace worker module is missing")
        worker = importlib.import_module("modeltrace_runtime.worker")
        process = getattr(worker, "process", None)
        self.assertTrue(callable(process), "worker process must be callable")

        imported = set(sys.modules) - before
        forbidden = [
            name
            for name in imported
            if any(
                name == prefix or name.startswith(f"{prefix}.")
                for prefix in FORBIDDEN_MODULES
            )
        ]
        self.assertEqual([], forbidden)

    def test_request_envelope_is_exact_and_bounded(self):
        for request in (None, [], "request"):
            with self.subTest(request_type=type(request).__name__):
                self.assert_worker_error(request, "invalid request")

        for missing in ("schema_version", "bank_revision", "samples"):
            request = self.base_request()
            del request[missing]
            with self.subTest(missing=missing):
                self.assert_worker_error(
                    request,
                    "invalid request fields",
                )

        forbidden_fields = (
            "unknown",
            "script",
            "path",
            "env",
            "prompt",
            "text",
            "raw_text",
            "provider",
            "api_key",
            "headers",
            "metadata",
        )
        for field in forbidden_fields:
            request = self.base_request()
            request[field] = "secret-sentinel"
            with self.subTest(forbidden=field):
                self.assert_worker_error(
                    request,
                    "invalid request fields",
                )

        for schema_version in (True, False, 0, 2, 1.0, "1"):
            request = self.base_request()
            request["schema_version"] = schema_version
            with self.subTest(schema_version=schema_version):
                self.assert_worker_error(
                    request,
                    "invalid schema_version",
                )

        for revision in (
            "",
            "a" * 63,
            "a" * 65,
            "A" * 64,
            "g" * 64,
            1,
            None,
        ):
            request = self.base_request()
            request["bank_revision"] = revision
            with self.subTest(revision_type=type(revision).__name__):
                self.assert_worker_error(
                    request,
                    "invalid bank_revision",
                )

        invalid_samples = (None, {}, (), [], [self.base_request()["samples"][0]] * 4)
        for samples in invalid_samples:
            request = self.base_request()
            request["samples"] = samples
            with self.subTest(samples_type=type(samples).__name__):
                self.assert_worker_error(request, "invalid samples")

        self.assert_worker_error(
            self.base_request(),
            "bank configuration is missing",
        )

    def test_samples_are_exact_bounded_and_have_unique_safe_ids(self):
        for sample in (None, [], "sample"):
            request = self.base_request()
            request["samples"] = [sample]
            with self.subTest(sample_type=type(sample).__name__):
                self.assert_worker_error(request, "invalid sample")

        sample_fields = ("challenge_id", "expected_count", "numbers")
        for missing in sample_fields:
            request = self.base_request()
            del request["samples"][0][missing]
            with self.subTest(missing=missing):
                self.assert_worker_error(
                    request,
                    "invalid sample fields",
                )

        for forbidden in (
            "unknown",
            "script",
            "path",
            "env",
            "prompt",
            "text",
            "raw_text",
            "provider",
            "api_key",
            "headers",
            "metadata",
        ):
            request = self.base_request()
            request["samples"][0][forbidden] = "secret-sentinel"
            with self.subTest(forbidden=forbidden):
                self.assert_worker_error(
                    request,
                    "invalid sample fields",
                )

        for challenge_id in (
            "",
            "a" * 129,
            "contains space",
            "contains/slash",
            "_starts-with-punctuation",
            "挑战",
            1,
            None,
        ):
            request = self.base_request()
            request["samples"][0]["challenge_id"] = challenge_id
            with self.subTest(challenge_id_type=type(challenge_id).__name__):
                self.assert_worker_error(
                    request,
                    "invalid challenge_id",
                )

        duplicate = self.base_request()["samples"][0].copy()
        request = self.base_request()
        request["samples"].append(duplicate)
        with self.subTest(duplicate_challenge_id=True):
            self.assert_worker_error(request, "duplicate challenge_id")

        for expected_count in (True, False, -1, 4097, 1.0, "1", None):
            request = self.base_request()
            request["samples"][0]["expected_count"] = expected_count
            with self.subTest(expected_count=expected_count):
                self.assert_worker_error(
                    request,
                    "invalid expected_count",
                )

        for numbers in (None, {}, (), [1] * 4097):
            request = self.base_request()
            request["samples"][0]["numbers"] = numbers
            with self.subTest(numbers_type=type(numbers).__name__):
                self.assert_worker_error(request, "invalid numbers")

        for number in (True, False, 0, 356, 1.0, "1", None):
            request = self.base_request()
            request["samples"][0]["numbers"] = [number]
            with self.subTest(number=number):
                self.assert_worker_error(request, "invalid number")

        request = self.base_request()
        request["samples"] = [
            {
                "challenge_id": "A.b:c_1-2",
                "expected_count": 0,
                "numbers": [],
            },
            {
                "challenge_id": "boundary-2",
                "expected_count": 4096,
                "numbers": [1, 355],
            },
        ]
        self.assert_worker_error(
            request,
            "bank configuration is missing",
        )

    def test_bank_configuration_rejects_missing_relative_and_file_errors(self):
        worker = importlib.import_module("modeltrace_runtime.worker")
        request = self.base_request()

        with mock.patch.dict(os.environ, {}, clear=True):
            self.assert_worker_error(
                request,
                "bank configuration is missing",
            )

        with mock.patch.dict(
            os.environ,
            {BANK_ENVIRONMENT_KEY: "relative/bank.json"},
            clear=True,
        ):
            with self.subTest(configuration="relative"):
                self.assert_worker_error(
                    request,
                    "bank path must be absolute",
                )

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            unavailable = root / "missing-secret-name.json"
            for path in (unavailable, root):
                with self.subTest(file_kind=path.name or "directory"):
                    with mock.patch.dict(
                        os.environ,
                        {BANK_ENVIRONMENT_KEY: str(path)},
                        clear=True,
                    ):
                        self.assert_worker_error(
                            request,
                            "bank file unavailable",
                        )

    def test_bank_is_opened_once_and_read_once_with_bound(self):
        worker = importlib.import_module("modeltrace_runtime.worker")
        bank_bytes = b'{"schema":"not-parsed-yet"}'
        request = self.base_request()
        request["bank_revision"] = hashlib.sha256(bank_bytes).hexdigest()
        bank_path = "/controlled/bank.json"
        accessed_keys = []

        def controlled_getenv(key):
            accessed_keys.append(key)
            if key != BANK_ENVIRONMENT_KEY:
                raise AssertionError("unexpected environment access")
            return bank_path

        controlled_open = mock.mock_open(read_data=bank_bytes)
        with (
            mock.patch.object(os, "getenv", side_effect=controlled_getenv),
            mock.patch("builtins.open", controlled_open),
        ):
            with self.subTest(process=True):
                self.assert_worker_error(
                    request,
                    "invalid bank",
                )

        with self.subTest(environment_access=True):
            self.assertEqual([BANK_ENVIRONMENT_KEY], accessed_keys)
        with self.subTest(open_count=True):
            controlled_open.assert_called_once_with(bank_path, "rb")
        stream = controlled_open.return_value.__enter__.return_value
        with self.subTest(read_count=True):
            stream.read.assert_called_once_with(MAX_BANK_BYTES + 1)

    def test_bank_size_and_exact_byte_revision_are_enforced(self):
        worker = importlib.import_module("modeltrace_runtime.worker")
        compact = b'{"value":1}'
        spaced = b'{ "value": 1 }\n'
        compact_revision = hashlib.sha256(compact).hexdigest()
        spaced_revision = hashlib.sha256(spaced).hexdigest()
        self.assertNotEqual(compact_revision, spaced_revision)

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            compact_path = root / "compact.json"
            spaced_path = root / "spaced.json"
            compact_path.write_bytes(compact)
            spaced_path.write_bytes(spaced)

            for path, revision in (
                (compact_path, compact_revision),
                (spaced_path, spaced_revision),
            ):
                request = self.base_request()
                request["bank_revision"] = revision
                with self.subTest(path=path.name):
                    with mock.patch.dict(
                        os.environ,
                        {BANK_ENVIRONMENT_KEY: str(path)},
                        clear=True,
                    ):
                        self.assert_worker_error(
                            request,
                            "invalid bank",
                        )

            request = self.base_request()
            request["bank_revision"] = spaced_revision
            with mock.patch.dict(
                os.environ,
                {BANK_ENVIRONMENT_KEY: str(compact_path)},
                clear=True,
            ):
                with self.subTest(revision_mismatch=True):
                    self.assert_worker_error(
                        request,
                        "bank revision mismatch",
                    )

            oversized_path = root / "oversized-secret-name.json"
            with oversized_path.open("wb") as stream:
                stream.seek(MAX_BANK_BYTES)
                stream.write(b"x")
            with mock.patch.dict(
                os.environ,
                {BANK_ENVIRONMENT_KEY: str(oversized_path)},
                clear=True,
            ):
                with self.subTest(oversized=True):
                    self.assert_worker_error(
                        request,
                        "bank file too large",
                    )

    def test_bank_json_is_strict_and_bank_schema_is_validated(self):
        malformed_json = (
            b"",
            b"\xff",
            b"{",
            b"{}{}",
            b'{"duplicate":1,"duplicate":2}',
            b'{"constant":NaN}',
            b'{"constant":Infinity}',
            b'{"constant":-Infinity}',
        )
        non_objects = (b"null", b"[]", b'"bank"', b"1")

        with tempfile.TemporaryDirectory() as temporary:
            bank_path = Path(temporary) / "bank.json"
            for index, bank_bytes in enumerate(malformed_json):
                bank_path.write_bytes(bank_bytes)
                request = self.base_request()
                request["bank_revision"] = hashlib.sha256(
                    bank_bytes
                ).hexdigest()
                with self.subTest(malformed=index):
                    with mock.patch.dict(
                        os.environ,
                        {BANK_ENVIRONMENT_KEY: str(bank_path)},
                        clear=True,
                    ):
                        self.assert_worker_error(
                            request,
                            "invalid bank JSON",
                        )

            for index, bank_bytes in enumerate(non_objects):
                bank_path.write_bytes(bank_bytes)
                request = self.base_request()
                request["bank_revision"] = hashlib.sha256(
                    bank_bytes
                ).hexdigest()
                with self.subTest(non_object=index):
                    with mock.patch.dict(
                        os.environ,
                        {BANK_ENVIRONMENT_KEY: str(bank_path)},
                        clear=True,
                    ):
                        self.assert_worker_error(
                            request,
                            "invalid bank JSON object",
                        )

            invalid_bank = b"{}"
            bank_path.write_bytes(invalid_bank)
            request = self.base_request()
            request["bank_revision"] = hashlib.sha256(
                invalid_bank
            ).hexdigest()
            with self.subTest(invalid_bank=True):
                with mock.patch.dict(
                    os.environ,
                    {BANK_ENVIRONMENT_KEY: str(bank_path)},
                    clear=True,
                ):
                    self.assert_worker_error(request, "invalid bank")

            vendored_bank = VENDORED_BANK_PATH.read_bytes()
            bank_path.write_bytes(vendored_bank)
            request = self.base_request()
            request["bank_revision"] = hashlib.sha256(
                vendored_bank
            ).hexdigest()
            with self.subTest(valid_bank=True):
                with mock.patch.dict(
                    os.environ,
                    {BANK_ENVIRONMENT_KEY: str(bank_path)},
                    clear=True,
                ):
                    result, error = self.call_worker(request)
                self.assertIsNone(
                    error,
                    f"valid bank was rejected: {error!r}",
                )
                self.assertEqual(
                    request["bank_revision"],
                    result["bank_revision"],
                )

    def test_process_returns_full_engine_result_without_sensitive_inputs(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank_bytes = VENDORED_BANK_PATH.read_bytes()
        bank = json.loads(bank_bytes)
        revision = hashlib.sha256(bank_bytes).hexdigest()
        request = self.base_request()
        request["bank_revision"] = revision
        expected_engine_result = engine.analyze_samples(
            request["samples"],
            bank,
        )

        with tempfile.TemporaryDirectory(
            prefix="bank-path-secret-sentinel-"
        ) as temporary:
            bank_path = Path(temporary) / "private-bank.json"
            bank_path.write_bytes(bank_bytes)
            with mock.patch.dict(
                os.environ,
                {BANK_ENVIRONMENT_KEY: str(bank_path)},
                clear=True,
            ):
                result, error = self.call_worker(request)

            self.assertIsNone(
                error,
                f"valid worker request failed: {error!r}",
            )
            self.assertEqual(
                {"schema_version", "bank_revision"} | set(expected_engine_result),
                set(result),
            )
            self.assertEqual(1, result["schema_version"])
            self.assertEqual(revision, result["bank_revision"])
            for key, value in expected_engine_result.items():
                self.assertEqual(value, result[key], key)

            def collect_keys(value):
                keys = set()
                if isinstance(value, dict):
                    keys.update(value)
                    for item in value.values():
                        keys.update(collect_keys(item))
                elif isinstance(value, list):
                    for item in value:
                        keys.update(collect_keys(item))
                return keys

            forbidden_output_keys = {
                "numbers",
                "prompt",
                "raw_text",
                "text",
                "provider_body",
                "api_key",
                "key",
                "headers",
                "path",
                "env",
            }
            self.assertTrue(
                forbidden_output_keys.isdisjoint(collect_keys(result))
            )
            serialized = json.dumps(result, sort_keys=True)
            self.assertNotIn(str(bank_path), serialized)
            self.assertNotIn("secret-sentinel", serialized)
            for diagnostic in result["diagnostics"]:
                self.assertEqual(
                    {
                        "index",
                        "challenge_id",
                        "parsed_numbers",
                        "minimum_numbers",
                        "accepted",
                    },
                    set(diagnostic),
                )

    def test_process_uses_one_immutable_bank_snapshot_per_request(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        old_bytes = VENDORED_BANK_PATH.read_bytes()
        new_bytes = b" " + old_bytes
        old_revision = hashlib.sha256(old_bytes).hexdigest()
        new_revision = hashlib.sha256(new_bytes).hexdigest()
        self.assertNotEqual(old_revision, new_revision)
        expected_old = engine.analyze_samples(
            self.base_request()["samples"],
            json.loads(old_bytes),
        )

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            bank_path = root / "bank.json"
            replacement_path = root / "replacement.json"
            bank_path.write_bytes(old_bytes)
            replacement_path.write_bytes(new_bytes)
            real_open = open
            open_count = 0

            class ReplacingStream:
                def __init__(self, stream):
                    self.stream = stream

                def __enter__(self):
                    return self

                def __exit__(self, exception_type, exception, traceback):
                    self.stream.close()

                def read(self, size):
                    data = self.stream.read(size)
                    os.replace(replacement_path, bank_path)
                    return data

            def controlled_open(path, mode):
                nonlocal open_count
                open_count += 1
                return ReplacingStream(real_open(path, mode))

            old_request = self.base_request()
            old_request["bank_revision"] = old_revision
            with (
                mock.patch.dict(
                    os.environ,
                    {BANK_ENVIRONMENT_KEY: str(bank_path)},
                    clear=True,
                ),
                mock.patch("builtins.open", side_effect=controlled_open),
            ):
                old_result, old_error = self.call_worker(old_request)

            self.assertIsNone(
                old_error,
                f"snapshot request failed: {old_error!r}",
            )
            self.assertEqual(1, open_count)
            self.assertEqual(old_revision, old_result["bank_revision"])
            for key, value in expected_old.items():
                self.assertEqual(value, old_result[key], key)

            new_request = self.base_request()
            new_request["bank_revision"] = new_revision
            with mock.patch.dict(
                os.environ,
                {BANK_ENVIRONMENT_KEY: str(bank_path)},
                clear=True,
            ):
                new_result, new_error = self.call_worker(new_request)

            self.assertIsNone(
                new_error,
                f"next request failed: {new_error!r}",
            )
            self.assertEqual(new_revision, new_result["bank_revision"])
            old_without_revision = dict(old_result)
            new_without_revision = dict(new_result)
            del old_without_revision["bank_revision"]
            del new_without_revision["bank_revision"]
            self.assertEqual(old_without_revision, new_without_revision)

    def test_stdio_success_writes_exactly_one_json_result(self):
        bank_bytes = VENDORED_BANK_PATH.read_bytes()
        revision = hashlib.sha256(bank_bytes).hexdigest()
        request = self.base_request()
        request["bank_revision"] = revision
        payload = json.dumps(
            request,
            separators=(",", ":"),
        ).encode("utf-8")

        with tempfile.TemporaryDirectory() as temporary:
            bank_path = Path(temporary) / "bank.json"
            bank_path.write_bytes(bank_bytes)
            completed = self.run_stdio(payload, bank_path)

        self.assertEqual(0, completed.returncode)
        self.assertEqual(b"", completed.stderr)
        self.assertTrue(completed.stdout.endswith(b"\n"))
        self.assertEqual(1, len(completed.stdout.splitlines()))
        result = json.loads(completed.stdout)
        self.assertEqual(1, result["schema_version"])
        self.assertEqual(revision, result["bank_revision"])
        self.assertEqual("challenge-1", result["diagnostics"][0]["challenge_id"])

    def test_stdio_rejects_strict_or_oversized_input_with_redacted_error(self):
        bank_bytes = VENDORED_BANK_PATH.read_bytes()
        revision = hashlib.sha256(bank_bytes).hexdigest()
        request = self.base_request()
        request["bank_revision"] = revision
        valid_payload = json.dumps(
            request,
            separators=(",", ":"),
        ).encode("utf-8")
        unknown_request = dict(request)
        unknown_request["prompt"] = "stdio-secret-sentinel"
        samples_payload = json.dumps(
            request["samples"],
            separators=(",", ":"),
        )
        duplicate_payload = (
            "{"
            '"schema_version":1,'
            '"schema_version":1,'
            f'"bank_revision":"{revision}",'
            f'"samples":{samples_payload}'
            "}"
        ).encode("utf-8")
        nan_payload = valid_payload.replace(
            b'"schema_version":1',
            b'"schema_version":NaN',
            1,
        )
        error_line = b"MODELTRACE_WORKER_ERROR request rejected\n"

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            bank_path = root / "bank.json"
            bank_path.write_bytes(bank_bytes)
            cases = (
                (
                    "unknown",
                    json.dumps(
                        unknown_request,
                        separators=(",", ":"),
                    ).encode("utf-8"),
                    bank_path,
                ),
                ("duplicate", duplicate_payload, bank_path),
                ("tail", valid_payload + b"{}", bank_path),
                ("nan", nan_payload, bank_path),
                ("oversized", b" " * (MAX_STDIN_BYTES + 1), bank_path),
                (
                    "bank-path",
                    valid_payload,
                    root / "stdio-secret-path-sentinel.json",
                ),
            )
            for name, payload, configured_path in cases:
                with self.subTest(case=name):
                    completed = self.run_stdio(payload, configured_path)
                    self.assertNotEqual(0, completed.returncode)
                    self.assertEqual(b"", completed.stdout)
                    self.assertEqual(error_line, completed.stderr)
                    self.assertNotIn(b"stdio-secret", completed.stderr)
                    self.assertNotIn(b"Traceback", completed.stderr)
