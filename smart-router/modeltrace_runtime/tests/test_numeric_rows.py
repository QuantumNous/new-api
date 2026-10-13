import importlib
import importlib.util
import json
import multiprocessing
import os
import tempfile
import unittest
from pathlib import Path


def _process_read_numeric_fifo(path, entered, outcomes):
    numeric_rows = importlib.import_module("modeltrace_runtime.numeric_rows")
    entered.set()
    try:
        numeric_rows.read_numeric_rows(path)
    except Exception as error:
        outcomes.put((type(error).__name__, str(error)))
    else:
        outcomes.put(("success", ""))


class NumericRowsTest(unittest.TestCase):
    @unittest.skipUnless(hasattr(os, "mkfifo"), "requires POSIX FIFOs")
    def test_numeric_fifo_without_writer_completes_with_typed_value_error(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory).resolve() / "rows.fifo"
            os.mkfifo(path, 0o600)
            context = multiprocessing.get_context("spawn")
            entered = context.Event()
            outcomes = context.Queue()
            child = context.Process(
                target=_process_read_numeric_fifo,
                args=(path, entered, outcomes),
            )
            try:
                child.start()
                self.assertTrue(entered.wait(3), "FIFO child did not enter reader")
                child.join(2)
                self.assertFalse(child.is_alive(), "numeric FIFO reader blocked")
                self.assertEqual(0, child.exitcode)
                outcome = outcomes.get(timeout=2)
                self.assertEqual("ValueError", outcome[0])
                self.assertIn("regular file", outcome[1])
            finally:
                if child.pid is not None:
                    if child.is_alive():
                        child.terminate()
                    child.join(3)
                child.close()
                outcomes.close()
                outcomes.join_thread()

    def test_numeric_rows_do_not_need_text(self):
        module_name = "modeltrace_runtime.numeric_rows"
        spec = importlib.util.find_spec(module_name)
        self.assertIsNotNone(spec, "numeric row normalization capability is missing")
        numeric_rows = importlib.import_module(module_name)
        row = {
            "row_id": "row-1",
            "source": "sample-model",
            "condition_id": "environment-01",
            "challenge_id": "query-01",
            "expected_count": 0,
            "numbers": [17] * 80,
            "text": "must not be required or retained",
            "unknown": "must not be retained",
        }

        normalized = numeric_rows.normalize_row(row)

        self.assertEqual(80, normalized["counts"][16])
        self.assertEqual(80, sum(normalized["counts"]))
        self.assertTrue(normalized["strict_valid"])
        self.assertNotIn("text", normalized)
        self.assertNotIn("unknown", normalized)

    def test_normalize_row_validates_exact_types_and_bounds(self):
        numeric_rows = importlib.import_module("modeltrace_runtime.numeric_rows")
        base = {
            "row_id": "row-1",
            "source": "sample-model",
            "family_id": "sample-family",
            "family_name": "Sample Family",
            "condition_id": "calibration-group",
            "nuisance_condition_id": "nuisance-group",
            "challenge_id": "query-1",
            "expected_count": 200,
            "numbers": [1] * 109,
            "time": "2026-10-12T00:00:00Z",
            "counts": [999] * 355,
            "strict_valid": True,
        }

        normalized = numeric_rows.normalize_row(base)

        self.assertFalse(normalized["strict_valid"])
        self.assertEqual(109, normalized["counts"][0])
        self.assertEqual("nuisance-group", normalized["nuisance_condition_id"])
        self.assertEqual("calibration-group", normalized["condition_id"])
        for field, value in (
            ("row_id", ""),
            ("source", 123),
            ("family_id", "x" * 257),
            ("family_name", "\x00unsafe"),
            ("condition_id", ""),
            ("nuisance_condition_id", False),
            ("challenge_id", []),
            ("time", {}),
            ("expected_count", True),
            ("expected_count", 4097),
            ("numbers", "1,2,3"),
            ("numbers", [True] + [1] * 79),
            ("numbers", [0] + [1] * 79),
            ("numbers", [356] + [1] * 79),
            ("numbers", [1] * 4097),
        ):
            malformed = dict(base)
            malformed[field] = value
            with self.subTest(field=field, value=repr(value)[:80]):
                error = None
                try:
                    numeric_rows.normalize_row(malformed)
                except Exception as caught:
                    error = caught
                self.assertIs(type(error), ValueError)

    def test_whitespace_only_identifiers_are_rejected(self):
        numeric_rows = importlib.import_module("modeltrace_runtime.numeric_rows")
        base = {
            "row_id": "row-1",
            "source": "Sample Model",
            "family_id": "sample-family",
            "family_name": "Sample Family",
            "condition_id": "Calibration Group",
            "nuisance_condition_id": "Nuisance Group",
            "challenge_id": "query-1",
            "expected_count": 0,
            "numbers": [17] * 80,
            "time": "2026-10-13T00:00:00Z",
        }

        for field in (
            "row_id",
            "source",
            "family_id",
            "family_name",
            "condition_id",
            "nuisance_condition_id",
            "challenge_id",
            "time",
        ):
            for value in ("   ", "\u2003\u00a0"):
                with self.subTest(field=field, value=repr(value)):
                    with self.assertRaisesRegex(
                        ValueError,
                        f"^invalid numeric row: {field} must be a non-empty safe string",
                    ):
                        numeric_rows.normalize_row({**base, field: value})

    def test_unicode_and_human_readable_identifiers_are_preserved(self):
        numeric_rows = importlib.import_module("modeltrace_runtime.numeric_rows")
        row = {
            "row_id": "\u884c-1",
            "source": " \u6a21\u578b Alpha ",
            "family_id": "sample-family",
            "family_name": "\u6a21\u578b\u65cf Family",
            "condition_id": "Calibration Group",
            "nuisance_condition_id": "Nuisance Group",
            "challenge_id": "\u6311\u6218 1",
            "expected_count": 0,
            "numbers": [17] * 80,
            "time": "2026-10-13T00:00:00Z",
        }

        normalized = numeric_rows.normalize_row(row)

        self.assertTrue(normalized["strict_valid"])
        for field, value in row.items():
            self.assertEqual(value, normalized[field])

    def test_read_numeric_rows_is_strict_and_bounded(self):
        numeric_rows = importlib.import_module("modeltrace_runtime.numeric_rows")
        reader = getattr(numeric_rows, "read_numeric_rows", None)
        self.assertTrue(callable(reader), "read_numeric_rows must be callable")
        row = {
            "row_id": "row-1",
            "source": "sample-model",
            "condition_id": "environment-01",
            "challenge_id": "query-01",
            "expected_count": 0,
            "numbers": [17] * 80,
            "text": "raw sentinel",
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "rows.jsonl"
            path.write_bytes(
                (json.dumps(row, separators=(",", ":")) + "\n").encode("utf-8")
            )

            rows = reader(path)

            self.assertEqual(1, len(rows))
            self.assertNotIn("text", rows[0])
            self.assertEqual(80, rows[0]["counts"][16])

            for payload in (
                b'{"row_id":"x","source":"x","condition_id":"x",'
                b'"challenge_id":"x","expected_count":0,"numbers":[NaN]}\n',
                b'{"row_id":"x"} trailing\n',
                b"[]\n",
                b"\n",
                b"\xff\n",
            ):
                path.write_bytes(payload)
                with self.subTest(payload=repr(payload)[:80]):
                    with self.assertRaises(ValueError):
                        reader(path)

            oversized = root / "oversized.jsonl"
            with oversized.open("wb") as stream:
                stream.truncate(16 * 1024 * 1024 + 1)
            with self.assertRaises(ValueError):
                reader(oversized)

            excessive = root / "excessive.jsonl"
            encoded = (json.dumps(row, separators=(",", ":")) + "\n").encode(
                "utf-8"
            )
            excessive.write_bytes(encoded * 8193)
            with self.assertRaises(ValueError):
                reader(excessive)

            symlink = root / "linked.jsonl"
            os.symlink(path.name, symlink)
            with self.assertRaises(ValueError):
                reader(symlink)


if __name__ == "__main__":
    unittest.main()
