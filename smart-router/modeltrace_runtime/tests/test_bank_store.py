import copy
import errno
import hashlib
import importlib
import importlib.util
import json
import multiprocessing
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
VENDOR_DATA = REPOSITORY_ROOT / "third_party" / "modeltrace" / "data"
BUILTINS = (
    ("gpt", "GPT", VENDOR_DATA / "gpt_reference.jsonl"),
    ("claude", "Claude", VENDOR_DATA / "claude_reference.jsonl"),
)


def _process_open_fifo_store(root, entered, outcomes):
    bank_store = importlib.import_module("modeltrace_runtime.bank_store")
    entered.set()
    try:
        bank_store.BankStore(root)
    except Exception as error:
        outcomes.put((type(error).__name__, str(error)))
    else:
        outcomes.put(("success", ""))


def _process_enroll(
    root,
    rows,
    entered,
    release,
    outcomes,
    *,
    block,
):
    bank_store = importlib.import_module("modeltrace_runtime.bank_store")
    store = bank_store.BankStore(root)
    try:
        if block:
            real_build_bank = bank_store.build_bank
            blocked = False

            def blocking_build(*args, **kwargs):
                nonlocal blocked
                if not blocked:
                    blocked = True
                    entered.set()
                    if not release.wait(20):
                        raise RuntimeError("test synchronization timed out")
                return real_build_bank(*args, **kwargs)

            with mock.patch.object(
                bank_store,
                "build_bank",
                side_effect=blocking_build,
            ):
                result = store.enroll("custom-bank", rows)
        else:
            if not entered.wait(20):
                raise RuntimeError("test synchronization timed out")
            result = store.enroll("custom-bank", rows)
        outcomes.put(("ok", result))
    except Exception as error:
        outcomes.put(("error", type(error).__name__, str(error)))


class BankStoreTest(unittest.TestCase):
    @unittest.skipUnless(hasattr(os, "mkfifo"), "requires POSIX FIFOs")
    def test_committed_fifos_without_writer_complete_with_typed_value_error(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        for artifact in ("current", "references"):
            with self.subTest(artifact=artifact), tempfile.TemporaryDirectory() as directory:
                root = Path(directory).resolve() / "state"
                store = bank_store.BankStore(root)
                store.create("custom-bank", "Custom Bank")
                manifest = json.loads((root / "current.json").read_bytes())
                path = (
                    root / "current.json" if artifact == "current"
                    else root / manifest["references"]["path"]
                )
                path.parent.chmod(0o700)
                path.unlink()
                os.mkfifo(path, 0o600)
                context = multiprocessing.get_context("spawn")
                entered = context.Event()
                outcomes = context.Queue()
                child = context.Process(
                    target=_process_open_fifo_store,
                    args=(root, entered, outcomes),
                )
                try:
                    child.start()
                    self.assertTrue(entered.wait(3), "FIFO child did not enter store")
                    child.join(2)
                    self.assertFalse(child.is_alive(), "committed FIFO reader blocked")
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

    def custom_rows(self, source="custom-model", *, count=4, start=0):
        return [
            {
                "row_id": f"{source}-row-{index}",
                "source": source,
                "condition_id": "custom-calibration",
                "nuisance_condition_id": "custom-nuisance",
                "challenge_id": f"custom-query-{index}",
                "expected_count": 0,
                "numbers": [
                    ((index * 41 + position * 17) % 355) + 1
                    for position in range(80)
                ],
                "time": f"2026-10-12T00:00:0{index}Z",
            }
            for index in range(start, start + count)
        ]

    def load_current_bank(self, root):
        manifest = json.loads((root / "current.json").read_text(encoding="utf-8"))
        return json.loads(
            (root / manifest["bank"]["path"]).read_text(encoding="utf-8")
        )

    def replace_current_references(self, root, rows):
        manifest_path = root / "current.json"
        manifest = json.loads(manifest_path.read_bytes())
        payload = (
            "\n".join(json.dumps(row, sort_keys=True) for row in rows) + "\n"
        ).encode("utf-8")
        self.replace_current_artifact(root, manifest, manifest["references"], payload)

    def replace_current_artifact(self, root, manifest, entry, payload):
        entry["sha256"] = hashlib.sha256(payload).hexdigest()
        for path, content in (
            (root / entry["path"], payload),
            (root / "current.json", json.dumps(manifest, sort_keys=True).encode("utf-8")),
        ):
            path.chmod(0o600)
            try:
                path.write_bytes(content)
            finally:
                path.chmod(0o400)

    def over_capacity_generation(self, root):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        builtin_sources = {
            row["source"] for row in bank_store._load_builtin_rows()
        }
        store = bank_store.BankStore(root)
        store.create("custom-bank", "Custom Bank")
        expected = store.enroll(
            "custom-bank",
            [
                self.custom_rows(source=f"pending-model-{index}", count=1)[0]
                for index in range(256 - len(builtin_sources))
            ],
        )
        self.assertEqual(expected, bank_store.BankStore(root).summary())
        bank_store.BankStore(root).create("next-bank", "Next Bank")
        manifest = json.loads((root / "current.json").read_bytes())
        rows = [
            json.loads(line)
            for line in (
                root / manifest["references"]["path"]
            ).read_bytes().splitlines()
        ]
        self.assertEqual(256, len({row["source"] for row in rows}))
        rows.append(
            bank_store.normalize_row(
                {
                    **self.custom_rows(source="one-model-too-many", count=1)[0],
                    "family_id": "custom-bank",
                    "family_name": "Custom Bank",
                }
            )
        )
        self.assertEqual(257, len({row["source"] for row in rows}))
        self.assertEqual({"gpt", "claude"}, set(manifest["families"]))
        self.replace_current_references(root, rows)
        return store, expected

    def disk_snapshot(self, root):
        snapshot = {}
        for path in (root, *root.rglob("*")):
            status = path.stat()
            snapshot[path.relative_to(root).as_posix()] = (
                path.read_bytes() if path.is_file() else None,
                status.st_mode,
                status.st_dev,
                status.st_ino,
                status.st_size,
                status.st_mtime_ns,
                status.st_ctime_ns,
            )
        return snapshot

    def assert_load_rejected_without_fit_or_write(
        self, root, operation, message, *, reader=None
    ):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        before_files = self.disk_snapshot(root)
        if reader is not None:
            cached = {
                field: getattr(reader, field)
                for field in (
                    "_banks", "_custom_rows", "_builtin_rows",
                    "_family_calibration", "_committed_bank",
                )
            }
            revision = reader._committed_revision
            generation = reader._committed_generation
        with mock.patch.object(
            bank_store,
            "build_bank",
            side_effect=AssertionError("fitter must not be called"),
        ) as fitter, mock.patch.object(
            bank_store.BankStore,
            "_write_file",
            side_effect=AssertionError("writer must not be called"),
        ) as writer:
            try:
                with self.assertRaisesRegex(ValueError, message):
                    operation()
            finally:
                fitter.assert_not_called()
                writer.assert_not_called()
                self.assertEqual(before_files, self.disk_snapshot(root))
                if reader is not None:
                    for field, value in cached.items():
                        self.assertIs(value, getattr(reader, field), field)
                    self.assertEqual(revision, reader._committed_revision)
                    self.assertEqual(generation, reader._committed_generation)

    def assert_snapshot_rejected_on_restart_and_refresh(self, root, reader, message):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        for name, operation in (
            ("constructor", lambda: bank_store.BankStore(root)),
            ("reader-refresh", reader.summary),
        ):
            with self.subTest(operation=name):
                self.assert_load_rejected_without_fit_or_write(
                    root, operation, message, reader=reader
                )

    def active_custom_generation(self, root):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        store = bank_store.BankStore(root)
        store.create("custom-bank", "Custom Bank")
        expected = store.enroll("custom-bank", self.custom_rows())
        self.assertEqual(expected, bank_store.BankStore(root).summary())
        manifest = json.loads((root / "current.json").read_bytes())
        rows = [
            json.loads(line)
            for line in (root / manifest["references"]["path"]).read_bytes().splitlines()
        ]
        return store, manifest, rows

    def test_restart_and_refresh_reject_pending_model_retained_in_unified(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            reader, manifest, rows = self.active_custom_generation(root)
            builtin = [row for row in rows if row["family_id"] != "custom-bank"]
            custom = [row for row in rows if row["family_id"] == "custom-bank"]
            self.assertEqual(4, len({row["challenge_id"] for row in custom}))
            manifest["families"].pop("custom-bank")
            self.replace_current_artifact(
                root, manifest, manifest["references"],
                bank_store._jsonl_bytes(builtin + custom[:3]),
            )

            self.assert_snapshot_rejected_on_restart_and_refresh(
                root, reader, "^committed unified model membership mismatch$"
            )

    def test_restart_and_refresh_reject_foreign_family_artifact(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            reader, manifest, _ = self.active_custom_generation(root)
            gpt_bytes = (root / manifest["families"]["gpt"]["path"]).read_bytes()
            bank_store.validate_bank(json.loads(gpt_bytes))
            self.replace_current_artifact(
                root, manifest, manifest["families"]["custom-bank"], gpt_bytes
            )

            self.assert_snapshot_rejected_on_restart_and_refresh(
                root, reader, "^committed family model membership mismatch$"
            )

    def test_restart_and_refresh_reject_unified_missing_ready_custom_model(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            reader, manifest, _ = self.active_custom_generation(root)
            builtin_bytes = (VENDOR_DATA / "unified_bank.json").read_bytes()
            bank_store.validate_bank(json.loads(builtin_bytes))
            self.replace_current_artifact(root, manifest, manifest["bank"], builtin_bytes)

            self.assert_snapshot_rejected_on_restart_and_refresh(
                root, reader, "^committed unified model membership mismatch$"
            )

    def test_restart_and_refresh_check_ownership_against_actual_builtins(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        for omission in ("conflicting-source", "all-builtins"):
            with self.subTest(omission=omission), tempfile.TemporaryDirectory() as directory:
                root = Path(directory).resolve() / "state"
                reader = bank_store.BankStore(root)
                expected = reader.create("custom-bank", "Custom Bank")
                self.assertEqual(expected, bank_store.BankStore(root).summary())
                manifest = json.loads((root / "current.json").read_bytes())
                actual = bank_store._load_builtin_rows()
                self.assertIn("gpt-5.4", {row["source"] for row in actual})
                remaining = (
                    [row for row in actual if row["source"] != "gpt-5.4"]
                    if omission == "conflicting-source" else []
                )
                pending = bank_store.normalize_row({
                    **self.custom_rows(source="gpt-5.4", count=1)[0],
                    "family_id": "custom-bank",
                    "family_name": "Custom Bank",
                })
                self.assertTrue(pending["strict_valid"])
                self.replace_current_artifact(
                    root, manifest, manifest["references"],
                    bank_store._jsonl_bytes(remaining + [pending]),
                )

                self.assert_snapshot_rejected_on_restart_and_refresh(
                    root, reader, "different family"
                )

    def test_restart_and_refresh_reject_artifact_model_identity_mismatch(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            _, manifest, _ = self.active_custom_generation(root)
            for artifact in ("custom-bank", "gpt", "unified"):
                entry = (
                    manifest["bank"] if artifact == "unified"
                    else manifest["families"][artifact]
                )
                original = (root / entry["path"]).read_bytes()
                for field, value in (
                    ("family", "foreign-bank"),
                    ("family_name", "Wrong Label"),
                    ("id", "unexpected-model"),
                ):
                    with self.subTest(artifact=artifact, field=field):
                        reader = bank_store.BankStore(root)
                        changed = json.loads(original)
                        model = next(
                            item for item in changed["models"]
                            if artifact != "unified" or item["id"] == "custom-model"
                        )
                        if field == "id":
                            index = changed["robust"]["model_order"].index(model["id"])
                            changed["robust"]["model_order"][index] = value
                            model[field] = value
                        else:
                            for item in changed["models"]:
                                if item["family"] == model["family"]:
                                    item[field] = value
                        bank_store.validate_bank(changed)
                        self.replace_current_artifact(
                            root, manifest, entry, bank_store._json_bytes(changed)
                        )
                        try:
                            self.assert_snapshot_rejected_on_restart_and_refresh(
                                root, reader,
                                f"^committed {'unified' if artifact == 'unified' else 'family'} "
                                "model membership mismatch$",
                            )
                        finally:
                            self.replace_current_artifact(root, manifest, entry, original)

    def test_restart_rejects_committed_references_over_source_limit(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            self.over_capacity_generation(root)

            self.assert_load_rejected_without_fit_or_write(
                root,
                lambda: bank_store.BankStore(root),
                "^at most 256 distinct models are supported$",
            )

    def test_refresh_rejects_source_overflow_without_replacing_cached_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            reader, expected = self.over_capacity_generation(root)
            banks = reader._banks
            custom_rows = reader._custom_rows
            bank = reader._committed_bank

            self.assert_load_rejected_without_fit_or_write(
                root,
                reader.summary,
                "^at most 256 distinct models are supported$",
            )

            self.assertIs(banks, reader._banks)
            self.assertIs(custom_rows, reader._custom_rows)
            self.assertIs(bank, reader._committed_bank)
            self.assertEqual({"custom-bank": "Custom Bank"}, reader._banks)
            self.assertEqual(expected["generation"], reader._committed_generation)
            self.assertEqual(expected["revision"], reader._committed_revision)

    def test_restart_and_refresh_bound_effective_references_without_serialized_builtins(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            reader = bank_store.BankStore(root)
            baseline = reader.create("custom-bank", "Custom Bank")
            builtin_count = len(reader._get_builtin_rows())
            self.assertGreater(builtin_count, 0)
            template = {
                **self.custom_rows(source="pending-model", count=1)[0],
                "family_id": "custom-bank",
                "family_name": "Custom Bank",
            }
            self.assertTrue(bank_store.normalize_row(template)["strict_valid"])
            rows = [
                {**template, "row_id": f"pending-row-{index}"}
                for index in range(8192 - builtin_count)
            ]
            self.assertFalse(bank_store.BankStore._family_is_fit_ready(rows))
            self.replace_current_references(root, rows)

            before_files = self.disk_snapshot(root)
            with mock.patch.object(
                bank_store,
                "build_bank",
                side_effect=AssertionError("fitter must not be called"),
            ) as fitter, mock.patch.object(
                bank_store.BankStore,
                "_write_file",
                side_effect=AssertionError("writer must not be called"),
            ) as writer:
                try:
                    boundary = bank_store.BankStore(root).summary()
                    self.assertEqual(8192, boundary["reference_count"])
                    self.assertEqual(boundary, reader.summary())
                    self.assertEqual(baseline["revision"], boundary["revision"])
                    self.assertEqual(baseline["generation"], boundary["generation"])
                    family = next(
                        item for item in boundary["families"]
                        if item["id"] == "custom-bank"
                    )
                    self.assertFalse(family["active"])
                    self.assertEqual(len(rows), family["row_count"])
                finally:
                    fitter.assert_not_called()
                    writer.assert_not_called()
                    self.assertEqual(before_files, self.disk_snapshot(root))

            rows.append({**template, "row_id": f"pending-row-{len(rows)}"})
            self.assertEqual(8193, builtin_count + len(rows))
            self.assertLess(len(rows), bank_store.numeric_rows.MAX_ROWS)
            self.replace_current_references(root, rows)
            manifest = json.loads((root / "current.json").read_bytes())
            serialized = (root / manifest["references"]["path"]).read_bytes()
            parsed = bank_store._parse_numeric_rows(serialized)
            self.assertEqual(len(rows), len(parsed))
            self.assertTrue(all(row["strict_valid"] for row in parsed))
            self.assertEqual({"custom-bank"}, {row["family_id"] for row in parsed})
            self.assertEqual({"pending-model"}, {row["source"] for row in parsed})
            self.assertEqual({template["challenge_id"]}, {row["challenge_id"] for row in parsed})
            self.assertEqual(len(rows), len({row["row_id"] for row in parsed}))

            self.assert_snapshot_rejected_on_restart_and_refresh(
                root, reader, "^at most 8192 numeric references are supported$"
            )

    def test_restart_rejects_committed_custom_row_with_forged_strict_valid(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            expected = store.enroll("custom-bank", self.custom_rows(count=1))
            self.assertEqual(expected, bank_store.BankStore(root).summary())
            family = next(
                item for item in expected["families"] if item["id"] == "custom-bank"
            )
            self.assertFalse(family["active"])
            self.assertEqual(1, family["row_count"])
            manifest = json.loads((root / "current.json").read_bytes())
            rows = [
                json.loads(line)
                for line in (
                    root / manifest["references"]["path"]
                ).read_bytes().splitlines()
            ]
            (custom_row,) = [
                row for row in rows if row["family_id"] == "custom-bank"
            ]
            custom_row["numbers"] = [17] * 79
            custom_row["strict_valid"] = True
            custom_row["counts"] = [999] * 355
            derived = bank_store.normalize_row(custom_row)
            self.assertFalse(derived["strict_valid"])
            self.assertEqual(79, derived["counts"][16])
            self.assertEqual(79, sum(derived["counts"]))
            self.assertEqual({"gpt", "claude"}, set(manifest["families"]))
            self.replace_current_references(root, rows)

            self.assert_load_rejected_without_fit_or_write(
                root,
                lambda: bank_store.BankStore(root),
                "^committed custom references must be strict-valid$",
            )

    def test_sanitized_fit_matches_original_fit(self):
        module_name = "modeltrace_runtime.bank_store"
        spec = importlib.util.find_spec(module_name)
        self.assertIsNotNone(spec, "controlled builtin loader capability is missing")
        bank_store = importlib.import_module(module_name)
        loader = getattr(bank_store, "_load_builtin_rows", None)
        self.assertTrue(callable(loader), "controlled builtin loader is missing")
        builder = importlib.import_module("third_party.modeltrace.bank_builder")
        original = []
        for family_id, family_name, path in BUILTINS:
            original.extend(
                {
                    **row,
                    "family_id": family_id,
                    "family_name": family_name,
                }
                for row in builder.read_rows(path)
            )

        original_fit = builder.build_bank(original)
        sanitized_fit = builder.build_bank(loader())

        for field in ("models", "robust", "calibration"):
            with self.subTest(field=field):
                self.assertEqual(original_fit[field], sanitized_fit[field])

    def test_split_calibration_activates_with_finite_unevaluated_fallback(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        builder = importlib.import_module("third_party.modeltrace.bank_builder")
        rows = [
            {**row, "condition_id": f"split-calibration-{index}"}
            for index, row in enumerate(self.custom_rows())
        ]
        normalized = [
            bank_store.normalize_row({
                **row, "family_id": "custom-bank", "family_name": "Custom Bank",
            })
            for row in rows
        ]
        self.assertTrue(all(row["strict_valid"] for row in normalized))
        self.assertTrue(bank_store.BankStore._family_is_fit_ready(normalized))
        oracle = builder.build_bank(normalized)
        self.assertFalse(oracle["calibration"]["1"]["fallback"])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            before = store.create("custom-bank", "Custom Bank")
            error = None
            try:
                activated = store.enroll("custom-bank", rows)
            except Exception as caught:
                error = caught
            self.assertIsNone(error, f"fit-ready split family failed: {error}")
            self.assertNotEqual(before["generation"], activated["generation"])
            family = next(item for item in activated["families"] if item["id"] == "custom-bank")
            self.assertTrue(family["active"])
            self.assertEqual(4, family["row_count"])
            manifest = json.loads((root / "current.json").read_bytes())
            family_bank = json.loads(
                (root / manifest["families"]["custom-bank"]["path"]).read_bytes()
            )
            unified = self.load_current_bank(root)
            bank_store.validate_bank(family_bank)
            bank_store.validate_bank(unified)
            self.assertEqual(["custom-model"], [model["id"] for model in family_bank["models"]])
            self.assertIn("custom-model", {model["id"] for model in unified["models"]})
            self.assertEqual(oracle["calibration"]["1"], family_bank["calibration"]["1"])
            for key in ("2", "3"):
                self.assertEqual({
                    "beta": 1.0, "cv_accuracy": 0.0, "cv_correct": 0,
                    "cv_samples": 0, "cv_nll": None, "fallback": True,
                }, family_bank["calibration"][key])
            persisted = [
                json.loads(line)
                for line in (root / manifest["references"]["path"]).read_bytes().splitlines()
            ]
            custom = [row for row in persisted if row["family_id"] == "custom-bank"]
            self.assertEqual({row["condition_id"] for row in rows}, {row["condition_id"] for row in custom})
            self.assertEqual({"custom-nuisance"}, {row["nuisance_condition_id"] for row in custom})
            self.assertEqual(activated, bank_store.BankStore(root).summary())

    def test_missing_family_calibration_reuses_only_validated_same_family_beta(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            store.enroll("custom-bank", self.custom_rows())
            manifest = json.loads((root / "current.json").read_bytes())
            prior = json.loads(
                (root / manifest["families"]["custom-bank"]["path"]).read_bytes()
            )["calibration"]
            self.assertTrue(all(entry["cv_samples"] > 0 for entry in prior.values()))
            self.assertTrue(any(entry["beta"] != 1.0 for entry in prior.values()))
            store = bank_store.BankStore(root)
            rows = [
                {
                    **row, "condition_id": f"other-calibration-{index}",
                    "challenge_id": f"other-challenge-{index}",
                }
                for index, row in enumerate(self.custom_rows(source="other-model"))
            ]
            error = None
            try:
                activated = store.enroll("custom-bank", rows)
            except Exception as caught:
                error = caught
            self.assertIsNone(error, f"same-family fallback failed: {error}")
            manifest = json.loads((root / "current.json").read_bytes())
            family_bank = json.loads(
                (root / manifest["families"]["custom-bank"]["path"]).read_bytes()
            )
            for key in ("1", "2", "3"):
                self.assertEqual({
                    "beta": prior[key]["beta"], "cv_accuracy": 0.0,
                    "cv_correct": 0, "cv_samples": 0, "cv_nll": None,
                    "fallback": True,
                }, family_bank["calibration"][key])
            self.assertEqual(activated, bank_store.BankStore(root).summary())

    def test_two_summaries_return_complete_old_or_new_generation(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            writer = bank_store.BankStore(root)
            old = writer.create("custom-bank", "Custom Bank")
            reader = bank_store.BankStore(root)
            captured = threading.Event()
            release = threading.Event()
            second_entered = threading.Event()
            second_done = threading.Event()
            outcomes = {}
            errors = []
            real_current = reader._current_bank

            def pause_after_capture():
                result = real_current()
                if threading.current_thread() is first:
                    captured.set()
                    if not release.wait(10):
                        raise RuntimeError("summary synchronization timed out")
                return result

            def summarize(name, done=None):
                if name == "second":
                    second_entered.set()
                try:
                    outcomes[name] = reader.summary()
                except Exception as error:
                    errors.append(error)
                finally:
                    if done is not None:
                        done.set()

            first = threading.Thread(target=summarize, args=("first",))
            second = threading.Thread(target=summarize, args=("second", second_done))
            started = []
            with mock.patch.object(reader, "_current_bank", side_effect=pause_after_capture):
                try:
                    first.start()
                    started.append(first)
                    self.assertTrue(captured.wait(3), "first summary did not capture old bank")
                    new = writer.enroll("custom-bank", self.custom_rows())
                    self.assertNotEqual(old["revision"], new["revision"])
                    self.assertNotEqual(old["generation"], new["generation"])
                    self.assertEqual(old["model_count"] + 1, new["model_count"])
                    second.start()
                    started.append(second)
                    self.assertTrue(second_entered.wait(3), "second summary did not enter refresh")
                    # An unlocked refresh finishes here; a coherent locked reader waits.
                    second_done.wait(2)
                finally:
                    release.set()
                    for thread in started:
                        thread.join(5)
                self.assertTrue(all(not thread.is_alive() for thread in started))
            self.assertEqual([], errors)
            self.assertEqual({"first", "second"}, set(outcomes))
            for name, result in outcomes.items():
                with self.subTest(summary=name):
                    self.assertIn(result, (old, new), "summary mixed committed generations")
            self.assertEqual(new, reader.summary())

    def test_same_instance_second_writer_is_busy_while_other_reader_is_independent(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            old = store.create("custom-bank", "Custom Bank")
            reader = bank_store.BankStore(root)
            entered = threading.Event()
            release = threading.Event()
            competing_done = threading.Event()
            outcomes = {}
            errors = []
            real_build = bank_store.build_bank

            def blocking_build(*args, **kwargs):
                if threading.current_thread() is first and not entered.is_set():
                    entered.set()
                    if not release.wait(10):
                        raise RuntimeError("writer synchronization timed out")
                return real_build(*args, **kwargs)

            def enroll():
                try:
                    outcomes["first"] = store.enroll("custom-bank", self.custom_rows())
                except Exception as error:
                    errors.append(error)

            def compete():
                try:
                    store.create("second-bank", "Second Bank")
                except Exception as error:
                    outcomes["second"] = (type(error), str(error))
                finally:
                    competing_done.set()

            first = threading.Thread(target=enroll)
            second = threading.Thread(target=compete)
            started = []
            with mock.patch.object(bank_store, "build_bank", side_effect=blocking_build):
                try:
                    first.start()
                    started.append(first)
                    self.assertTrue(entered.wait(3), "first writer did not enter fitter")
                    second.start()
                    started.append(second)
                    self.assertTrue(competing_done.wait(2), "second writer waited instead of busy")
                    self.assertEqual((RuntimeError, "bank store is busy"), outcomes["second"])
                    self.assertEqual(old, reader.summary())
                finally:
                    release.set()
                    for thread in started:
                        thread.join(5)
                self.assertTrue(all(not thread.is_alive() for thread in started))
            self.assertEqual([], errors)
            self.assertEqual(outcomes["first"], reader.summary())

    def test_writer_cleanup_faults_preserve_body_error_and_release_once(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        for fault in ("unlock", "close", "both"):
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as directory:
                root = Path(directory).resolve() / "state"
                store = bank_store.BankStore(root)
                before = store.create("custom-bank", "Custom Bank")
                real_flock = bank_store.fcntl.flock
                real_close = bank_store.os.close
                descriptor = None
                unlocks = []
                closes = []
                body_error = ValueError("original body error")
                key = f"{store._root_identity[0]}:{store._root_identity[1]}"
                mutex = bank_store._THREAD_LOCKS[key]

                def faulty_flock(fd, operation):
                    nonlocal descriptor
                    if operation & bank_store.fcntl.LOCK_EX:
                        descriptor = fd
                    if operation == bank_store.fcntl.LOCK_UN:
                        unlocks.append(fd)
                        if fault in ("unlock", "both"):
                            raise OSError(errno.EIO, "private unlock detail")
                    return real_flock(fd, operation)

                def faulty_close(fd):
                    if fd == descriptor:
                        closes.append(fd)
                        real_close(fd)
                        if fault in ("close", "both"):
                            raise OSError(errno.EIO, "private close detail")
                        return
                    return real_close(fd)

                error = None
                try:
                    with mock.patch.object(bank_store.fcntl, "flock", side_effect=faulty_flock), mock.patch.object(
                        bank_store.os, "close", side_effect=faulty_close,
                    ), mock.patch.object(bank_store.os, "replace", wraps=bank_store.os.replace) as replace:
                        try:
                            with store._writer_lock():
                                raise body_error
                        except Exception as caught:
                            error = caught
                    self.assertIs(error, body_error, "cleanup replaced the original body exception")
                    self.assertEqual([descriptor], unlocks)
                    self.assertEqual([descriptor], closes, "writer close was skipped or retried")
                    with self.assertRaises(OSError) as caught:
                        os.fstat(descriptor)
                    self.assertEqual(errno.EBADF, caught.exception.errno)
                    self.assertFalse(mutex.locked(), "writer mutex leaked")
                    replace.assert_not_called()
                    self.assertFalse(store._write_uncertain)
                    restarted = bank_store.BankStore(root)
                    with restarted._writer_lock():
                        pass
                    self.assertEqual(before, restarted.summary())
                finally:
                    if descriptor is not None and not closes:
                        real_flock(descriptor, bank_store.fcntl.LOCK_UN)
                        real_close(descriptor)
                    if mutex.locked():
                        mutex.release()

    def test_successful_unpublished_body_cleanup_fault_does_not_report_success(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            before = store.create("custom-bank", "Custom Bank")
            real_flock = bank_store.fcntl.flock
            descriptor = None

            def faulty_unlock(fd, operation):
                nonlocal descriptor
                if operation & bank_store.fcntl.LOCK_EX:
                    descriptor = fd
                if operation == bank_store.fcntl.LOCK_UN:
                    raise OSError(errno.EIO, "private unlock detail")
                return real_flock(fd, operation)

            error = None
            key = f"{store._root_identity[0]}:{store._root_identity[1]}"
            mutex = bank_store._THREAD_LOCKS[key]
            try:
                with mock.patch.object(bank_store.fcntl, "flock", side_effect=faulty_unlock):
                    try:
                        with store._writer_lock():
                            pass
                    except Exception as caught:
                        error = caught
                self.assertIs(type(error), RuntimeError)
                self.assertEqual("bank store writer cleanup failed", str(error))
                self.assertFalse(store._write_uncertain)
                self.assertFalse(mutex.locked())
                with bank_store.BankStore(root)._writer_lock():
                    pass
                self.assertEqual(before, store.summary())
            finally:
                try:
                    os.fstat(descriptor)
                except OSError:
                    pass
                else:
                    real_flock(descriptor, bank_store.fcntl.LOCK_UN)
                    os.close(descriptor)
                if mutex.locked():
                    mutex.release()

    def test_post_switch_writer_cleanup_fault_is_uncertain_without_replay(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        for fault in ("unlock", "close", "both"):
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as directory:
                root = Path(directory).resolve() / "state"
                store = bank_store.BankStore(root)
                before = store.create("custom-bank", "Custom Bank")
                before_manifest = (root / "current.json").read_bytes()
                real_flock = bank_store.fcntl.flock
                real_close = bank_store.os.close
                descriptor = None
                unlocks = []
                closes = []
                key = f"{store._root_identity[0]}:{store._root_identity[1]}"
                mutex = bank_store._THREAD_LOCKS[key]

                def faulty_flock(fd, operation):
                    nonlocal descriptor
                    if operation & bank_store.fcntl.LOCK_EX:
                        descriptor = fd
                    if operation == bank_store.fcntl.LOCK_UN:
                        unlocks.append(fd)
                        if fault in ("unlock", "both"):
                            raise OSError(errno.EIO, "private unlock detail")
                    return real_flock(fd, operation)

                def faulty_close(fd):
                    if fd == descriptor:
                        closes.append(fd)
                        real_close(fd)
                        if fault in ("close", "both"):
                            raise OSError(errno.EIO, "private close detail")
                        return
                    return real_close(fd)

                error = None
                try:
                    with mock.patch.object(bank_store.fcntl, "flock", side_effect=faulty_flock), mock.patch.object(
                        bank_store.os, "close", side_effect=faulty_close,
                    ), mock.patch.object(bank_store.os, "replace", wraps=bank_store.os.replace) as replace:
                        try:
                            store.enroll("custom-bank", self.custom_rows())
                        except Exception as caught:
                            error = caught
                    self.assertIs(type(error), RuntimeError, "cleanup did not report stable uncertainty")
                    self.assertEqual(
                        "bank store commit outcome is uncertain; restart required", str(error),
                    )
                    self.assertTrue(store._write_uncertain)
                    self.assertEqual([descriptor], unlocks)
                    self.assertEqual([descriptor], closes)
                    self.assertFalse(mutex.locked())
                    with self.assertRaises(OSError) as caught:
                        os.fstat(descriptor)
                    self.assertEqual(errno.EBADF, caught.exception.errno)
                    replace.assert_called_once()
                    switched = (root / "current.json").read_bytes()
                    self.assertNotEqual(before_manifest, switched)
                    frozen = store.summary()
                    for operation in (
                        lambda: store.create("another-bank", "Another Bank"),
                        lambda: store.enroll("custom-bank", self.custom_rows(start=4)),
                        store.rebuild,
                    ):
                        with mock.patch.object(bank_store.os, "replace", wraps=bank_store.os.replace) as replay:
                            with self.assertRaisesRegex(
                                RuntimeError,
                                "^bank store commit outcome is uncertain; restart required$",
                            ):
                                operation()
                            replay.assert_not_called()
                        self.assertEqual(switched, (root / "current.json").read_bytes())
                        self.assertEqual(frozen, store.summary())
                    restarted = bank_store.BankStore(root)
                    new = restarted.summary()
                    self.assertNotEqual(before["generation"], new["generation"])
                    self.assertIn("custom-model", {model["id"] for model in new["models"]})
                    with restarted._writer_lock():
                        pass
                finally:
                    if descriptor is not None and not closes:
                        real_flock(descriptor, bank_store.fcntl.LOCK_UN)
                        real_close(descriptor)
                    if mutex.locked():
                        mutex.release()

    def assert_publication_close_fault(
        self, *, switched, body_kind, close_kind, fault_position
    ):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")

        class PublicationAbort(BaseException):
            pass

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            restarted = None
            try:
                before = store.create("custom-bank", "Custom Bank")
                old_manifest = (root / "current.json").read_bytes()
                sequence = store._commit_sequence
                key = f"{store._root_identity[0]}:{store._root_identity[1]}"
                mutex = bank_store._THREAD_LOCKS[key]
                real_open = bank_store.os.open
                real_close = bank_store.os.close
                real_fstat = bank_store.os.fstat
                real_fsync = bank_store.os.fsync
                real_replace = bank_store.os.replace
                owned = {}
                closes = []
                body_faults = []
                root_syncs = []
                cache_fields = (
                    "_banks", "_custom_rows", "_builtin_rows",
                    "_family_calibration", "_committed_bank",
                )
                cached = {}
                cached_values = {}
                close_error = (
                    OSError(errno.EIO, "private publication close detail")
                    if close_kind == "oserror"
                    else PublicationAbort("private publication close detail")
                )
                body_error = None
                if body_kind == "ordinary":
                    body_error = (
                        ValueError("original publication body failure")
                        if switched
                        else OSError(errno.EIO, "original publication body failure")
                    )
                elif body_kind == "base":
                    body_error = PublicationAbort("original publication body failure")

                def recording_open(name, flags, *args, **kwargs):
                    fd = real_open(name, flags, *args, **kwargs)
                    if type(name) is str and name.startswith(".tmp-generation-"):
                        owned["generations"] = kwargs["dir_fd"]
                        owned["temporary"] = fd
                    elif name == "families" and kwargs.get("dir_fd") == owned.get("temporary"):
                        owned["family"] = fd
                        cached.update({field: getattr(store, field) for field in cache_fields})
                        cached_values.update(copy.deepcopy(cached))
                    return fd

                def faulty_close(fd):
                    if fd in owned.values():
                        closes.append(fd)
                        real_close(fd)
                        if fd == owned.get(fault_position):
                            raise close_error
                        return
                    return real_close(fd)

                def faulty_fsync(fd):
                    result = real_fsync(fd)
                    if fd == store._root_fd:
                        root_syncs.append(fd)
                    target = store._root_fd if switched else owned.get("generations")
                    if body_error is not None and fd == target:
                        body_faults.append(fd)
                        raise body_error
                    return result

                error = None
                try:
                    with mock.patch.object(
                        bank_store.os, "open", side_effect=recording_open,
                    ), mock.patch.object(
                        bank_store.os, "close", side_effect=faulty_close,
                    ), mock.patch.object(
                        bank_store.os, "fsync", side_effect=faulty_fsync,
                    ), mock.patch.object(
                        bank_store.os, "replace", wraps=real_replace,
                    ) as replace:
                        try:
                            store.create("second-bank", "Second Bank")
                        except BaseException as caught:
                            error = caught
                    self.assertEqual({"family", "temporary", "generations"}, set(owned))
                    self.assertEqual(3, len(set(owned.values())))
                    with self.subTest(observation="close-attempts"):
                        self.assertEqual(
                            [owned[name] for name in ("family", "temporary", "generations")],
                            closes, "publication close was skipped or retried",
                        )
                    for name, fd in owned.items():
                        with self.subTest(observation="released-fd", descriptor=name):
                            with self.assertRaises(OSError) as caught:
                                real_fstat(fd)
                            self.assertEqual(errno.EBADF, caught.exception.errno)
                    with self.subTest(observation="exception"):
                        if body_error is not None:
                            self.assertIs(error, body_error, "cleanup masked the body exception")
                        else:
                            self.assertIs(type(error), RuntimeError, "cleanup acknowledged success")
                            self.assertEqual(
                                "bank store commit outcome is uncertain; restart required", str(error),
                            )
                            self.assertNotIn(str(close_error), str(error))
                    self.assertEqual(
                        [] if body_error is None else [
                            store._root_fd if switched else owned["generations"]
                        ],
                        body_faults,
                    )
                finally:
                    # RED can skip later closes; recover only known, unattempted owned FDs.
                    for fd in owned.values():
                        if fd not in closes:
                            try:
                                real_fstat(fd)
                            except OSError as caught:
                                if caught.errno != errno.EBADF:
                                    raise
                            else:
                                real_close(fd)

                self.assertFalse(mutex.locked(), "publication failure leaked the writer mutex")
                self.assertEqual(int(switched), replace.call_count, "publication was retried")
                self.assertEqual(sequence + int(switched), store._commit_sequence)
                self.assertEqual([store._root_fd] if switched else [], root_syncs)
                self.assertEqual(switched, store._write_uncertain)
                for field, value in cached.items():
                    self.assertIs(value, getattr(store, field), field)
                    self.assertEqual(cached_values[field], getattr(store, field), field)
                self.assertEqual(before["revision"], store._committed_revision)
                self.assertEqual(before["generation"], store._committed_generation)
                self.assertEqual(before, store.summary(), "summary mixed old and new snapshots")
                manifest_bytes = (root / "current.json").read_bytes()
                if switched:
                    self.assertNotEqual(old_manifest, manifest_bytes)
                    with mock.patch.object(
                        store, "_publish_generation",
                    ) as publish, mock.patch.object(
                        bank_store, "build_bank",
                    ) as fitter, mock.patch.object(
                        bank_store.os, "replace", wraps=real_replace,
                    ) as replay:
                        for name, mutation in (
                            ("create", lambda: store.create("blocked-bank", "Blocked Bank")),
                            ("enroll", lambda: store.enroll("custom-bank", self.custom_rows())),
                            ("rebuild", store.rebuild),
                        ):
                            with self.subTest(blocked=name):
                                with self.assertRaisesRegex(
                                    RuntimeError,
                                    "^bank store commit outcome is uncertain; restart required$",
                                ):
                                    mutation()
                                self.assertEqual(before, store.summary())
                        publish.assert_not_called()
                        fitter.assert_not_called()
                        replay.assert_not_called()
                else:
                    self.assertEqual(old_manifest, manifest_bytes)
                    with store._writer_lock():
                        pass
                after = self.disk_snapshot(root)
                with mock.patch.object(
                    bank_store, "build_bank",
                ) as fitter, mock.patch.object(
                    bank_store.BankStore, "_write_file",
                ) as writer, mock.patch.object(
                    bank_store.os, "replace", wraps=real_replace,
                ) as replay:
                    restarted = bank_store.BankStore(root)
                    expected = copy.deepcopy(before)
                    if switched:
                        manifest = json.loads(manifest_bytes)
                        expected["generation"] = manifest["generation"]
                        expected["revision"] = manifest["bank"]["sha256"]
                        expected["families"].append({
                            "id": "second-bank", "label": "Second Bank", "builtin": False,
                            "active": False, "row_count": 0,
                        })
                        expected["family_count"] += 1
                    self.assertFalse(restarted._write_uncertain)
                    self.assertEqual(expected, restarted.summary())
                    fitter.assert_not_called()
                    writer.assert_not_called()
                    replay.assert_not_called()
                self.assertEqual(after, self.disk_snapshot(root))
                self.assertEqual(manifest_bytes, (root / "current.json").read_bytes())
            finally:
                if restarted is not None:
                    restarted._root_finalizer()
                store._root_finalizer()

    def test_publication_close_faults_preserve_pre_switch_body_error(self):
        for body_kind in ("ordinary", "base"):
            for close_kind in ("oserror", "base"):
                for fault_position in ("family", "temporary"):
                    with self.subTest(body=body_kind, close=close_kind, position=fault_position):
                        self.assert_publication_close_fault(
                            switched=False, body_kind=body_kind,
                            close_kind=close_kind, fault_position=fault_position,
                        )

    def test_publication_close_faults_preserve_post_switch_body_error(self):
        for body_kind in ("ordinary", "base"):
            for close_kind in ("oserror", "base"):
                for fault_position in ("family", "temporary"):
                    with self.subTest(body=body_kind, close=close_kind, position=fault_position):
                        self.assert_publication_close_fault(
                            switched=True, body_kind=body_kind,
                            close_kind=close_kind, fault_position=fault_position,
                        )

    def test_successful_publication_close_fault_is_uncertain_without_replay(self):
        for close_kind in ("oserror", "base"):
            for fault_position in ("family", "temporary"):
                with self.subTest(close=close_kind, position=fault_position):
                    self.assert_publication_close_fault(
                        switched=True, body_kind=None,
                        close_kind=close_kind, fault_position=fault_position,
                    )

    def test_post_switch_manifest_read_failure_preserves_complete_old_caches(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        for operation in ("create", "pending-enroll", "active-enroll"):
            with self.subTest(operation=operation), tempfile.TemporaryDirectory() as directory:
                root = Path(directory).resolve() / "state"
                store = bank_store.BankStore(root)
                before = store.create("custom-bank", "Custom Bank")
                self.assertEqual(before, bank_store.BankStore(root).summary())
                sequence = store._commit_sequence
                old_manifest = (root / "current.json").read_bytes()
                old_status = os.stat(
                    "current.json", dir_fd=store._root_fd, follow_symlinks=False,
                )
                old_identity = (old_status.st_dev, old_status.st_ino)
                rows = self.custom_rows(count=1 if operation == "pending-enroll" else 4)
                real_replace = bank_store.os.replace
                real_read = bank_store.os.read
                cache_fields = (
                    "_banks", "_custom_rows", "_builtin_rows",
                    "_family_calibration", "_committed_bank",
                )
                cached = {}
                cached_values = {}
                switched_identity = None
                read_faults = []
                read_error = OSError(errno.EIO, "private manifest read failure detail")

                def recording_replace(*args, **kwargs):
                    nonlocal switched_identity
                    self.assertEqual("current.json", args[1])
                    self.assertEqual(before["revision"], store._committed_revision)
                    self.assertEqual(before["generation"], store._committed_generation)
                    # Capture after writer-entry refresh, before the atomic switch.
                    cached.update({field: getattr(store, field) for field in cache_fields})
                    cached_values.update(copy.deepcopy(cached))
                    result = real_replace(*args, **kwargs)
                    current = os.stat(
                        "current.json", dir_fd=store._root_fd, follow_symlinks=False,
                    )
                    switched_identity = (current.st_dev, current.st_ino)
                    self.assertNotEqual(old_identity, switched_identity)
                    return result

                def fail_new_manifest_read(fd, size):
                    if switched_identity is not None and not read_faults:
                        opened = os.fstat(fd)
                        if (opened.st_dev, opened.st_ino) == switched_identity:
                            read_faults.append(fd)
                            raise read_error
                    return real_read(fd, size)

                with mock.patch.object(
                    bank_store.os, "replace", side_effect=recording_replace,
                ) as replace, mock.patch.object(
                    bank_store.os, "read", side_effect=fail_new_manifest_read,
                ):
                    with self.assertRaises(ValueError) as caught:
                        if operation == "create":
                            store.create("second-bank", "Second Bank")
                        else:
                            store.enroll("custom-bank", rows)
                self.assertIs(type(caught.exception), ValueError)
                self.assertEqual("could not read committed artifact", str(caught.exception))
                self.assertIs(read_error, caught.exception.__cause__)
                self.assertEqual(errno.EIO, caught.exception.__cause__.errno)
                self.assertNotIn(read_error.strerror, str(caught.exception))
                self.assertEqual(1, len(read_faults))
                replace.assert_called_once()
                self.assertEqual(sequence + 1, store._commit_sequence)
                self.assertTrue(store._write_uncertain)

                after_fault = self.disk_snapshot(root)
                switched_manifest = (root / "current.json").read_bytes()
                self.assertNotEqual(old_manifest, switched_manifest)
                manifest = json.loads(switched_manifest)
                self.assertNotEqual(before["generation"], manifest["generation"])
                bank_bytes = (root / manifest["bank"]["path"]).read_bytes()
                self.assertEqual(
                    manifest["bank"]["sha256"], hashlib.sha256(bank_bytes).hexdigest(),
                )
                bank = json.loads(bank_bytes)
                bank_store.validate_bank(bank)
                expected = copy.deepcopy(before)
                expected["generation"] = manifest["generation"]
                expected["revision"] = manifest["bank"]["sha256"]
                if operation == "create":
                    expected["families"].append({
                        "id": "second-bank", "label": "Second Bank", "builtin": False,
                        "active": False, "row_count": 0,
                    })
                    expected["family_count"] += 1
                else:
                    family = next(
                        item for item in expected["families"] if item["id"] == "custom-bank"
                    )
                    family["active"] = operation == "active-enroll"
                    family["row_count"] = len(rows)
                    expected["reference_count"] += len(rows)
                expected["models"] = [
                    {
                        field: model[field]
                        for field in (
                            "id", "family", "family_name",
                            "response_count", "valid_number_count",
                        )
                    }
                    for model in bank["models"]
                ]
                expected["model_count"] = len(expected["models"])
                self.assertEqual(
                    before["model_count"] + (operation == "active-enroll"),
                    expected["model_count"],
                )
                self.assertEqual(
                    operation == "active-enroll",
                    "custom-model" in {model["id"] for model in expected["models"]},
                )
                self.assertEqual(
                    {"gpt", "claude"} | (
                        {"custom-bank"} if operation == "active-enroll" else set()
                    ),
                    set(manifest["families"]),
                )
                persisted = [
                    json.loads(line)
                    for line in (root / manifest["references"]["path"]).read_bytes().splitlines()
                ]
                self.assertEqual(
                    [] if operation == "create" else [
                        bank_store.normalize_row({
                            **row, "family_id": "custom-bank", "family_name": "Custom Bank",
                        })
                        for row in rows
                    ],
                    [row for row in persisted if row["family_id"] == "custom-bank"],
                )
                self.assertEqual(
                    {
                        "banks": [
                            {"id": family["id"], "label": family["label"]}
                            for family in expected["families"] if not family["builtin"]
                        ],
                    },
                    json.loads((root / manifest["state"]["path"]).read_bytes()),
                )
                for attempt in range(2):
                    with self.subTest(summary=attempt):
                        self.assertEqual(before, store.summary(), "summary mixed generations")
                with mock.patch.object(store, "_refresh_committed") as refresh, mock.patch.object(
                    store, "_publish_generation",
                ) as publish, mock.patch.object(
                    bank_store, "build_bank",
                ) as fitter, mock.patch.object(
                    bank_store.os, "replace", wraps=real_replace,
                ) as replay:
                    for name, mutation in (
                        ("create", lambda: store.create("blocked-bank", "Blocked Bank")),
                        ("enroll", lambda: store.enroll("custom-bank", self.custom_rows(start=4))),
                        ("rebuild", store.rebuild),
                    ):
                        with self.subTest(blocked=name):
                            with self.assertRaisesRegex(
                                RuntimeError,
                                "^bank store commit outcome is uncertain; restart required$",
                            ):
                                mutation()
                            self.assertTrue(store._write_uncertain)
                            self.assertEqual(sequence + 1, store._commit_sequence)
                            self.assertEqual(before, store.summary())
                        self.assertEqual(after_fault, self.disk_snapshot(root))
                    refresh.assert_not_called()
                    publish.assert_not_called()
                    fitter.assert_not_called()
                    replay.assert_not_called()
                for field, value in cached.items():
                    with self.subTest(cache=field):
                        self.assertIs(value, getattr(store, field), field)
                        self.assertEqual(cached_values[field], getattr(store, field), field)
                self.assertEqual(before["revision"], store._committed_revision)
                self.assertEqual(before["generation"], store._committed_generation)
                restarted = bank_store.BankStore(root)
                self.assertFalse(restarted._write_uncertain)
                self.assertEqual(expected, restarted.summary())
                self.assertEqual(expected, restarted.summary())
                self.assertEqual(after_fault, self.disk_snapshot(root))

    def test_custom_bank_is_included_in_unified_rebuild(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        store_type = getattr(bank_store, "BankStore", None)
        self.assertTrue(callable(store_type), "BankStore capability is missing")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = store_type(root)

            created = store.create("custom-bank", "Custom Bank")

            custom_family = next(
                family
                for family in created["families"]
                if family["id"] == "custom-bank"
            )
            self.assertFalse(custom_family["active"])
            enrolled = store.enroll("custom-bank", self.custom_rows())
            rebuilt = store.rebuild()
            bank = self.load_current_bank(root)

            self.assertIn(
                "custom-model",
                {model["id"] for model in bank["models"]},
            )
            custom_model = next(
                model for model in bank["models"] if model["id"] == "custom-model"
            )
            self.assertEqual("custom-bank", custom_model["family"])
            self.assertEqual("Custom Bank", custom_model["family_name"])
            for result in (created, enrolled, rebuilt):
                self.assertNotIn("numbers", json.dumps(result))
                self.assertNotIn("rows", result)

    def test_incremental_rows_stay_pending_until_four_distinct_challenges(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            created = store.create("custom-bank", "Custom Bank")
            baseline_count = created["reference_count"]
            rows = self.custom_rows()
            rows[0]["text"] = "RAW_PENDING_SENTINEL_4d2a"

            for count, row in enumerate(rows[:3], start=1):
                summary = store.enroll("custom-bank", [row])
                family = next(
                    item
                    for item in summary["families"]
                    if item["id"] == "custom-bank"
                )
                self.assertFalse(family["active"])
                self.assertEqual(count, family["row_count"])
                self.assertEqual(
                    baseline_count + count,
                    summary["reference_count"],
                )
                self.assertNotIn(
                    "custom-model",
                    {model["id"] for model in summary["models"]},
                )
                manifest = json.loads(
                    (root / "current.json").read_text(encoding="utf-8")
                )
                self.assertNotIn("custom-bank", manifest["families"])
                references = (
                    root / manifest["references"]["path"]
                ).read_bytes()
                self.assertEqual(
                    count,
                    sum(
                        json.loads(line).get("family_id") == "custom-bank"
                        for line in references.splitlines()
                    ),
                )
                self.assertNotIn(b"RAW_PENDING_SENTINEL_4d2a", references)

                restarted = bank_store.BankStore(root)
                self.assertEqual(summary, restarted.summary())
                store = restarted

            rebuilt = store.rebuild()
            rebuilt_family = next(
                item
                for item in rebuilt["families"]
                if item["id"] == "custom-bank"
            )
            self.assertFalse(rebuilt_family["active"])
            self.assertNotIn(
                "custom-model",
                {model["id"] for model in rebuilt["models"]},
            )
            manifest = json.loads(
                (root / "current.json").read_text(encoding="utf-8")
            )
            self.assertNotIn("custom-bank", manifest["families"])

            activated = store.enroll("custom-bank", [rows[3]])
            activated_family = next(
                item
                for item in activated["families"]
                if item["id"] == "custom-bank"
            )
            self.assertTrue(activated_family["active"])
            self.assertEqual(4, activated_family["row_count"])
            self.assertIn(
                "custom-model",
                {model["id"] for model in activated["models"]},
            )
            manifest = json.loads(
                (root / "current.json").read_text(encoding="utf-8")
            )
            self.assertIn("custom-bank", manifest["families"])
            self.assertEqual(
                activated,
                bank_store.BankStore(root).summary(),
            )

    def test_multi_model_family_waits_for_every_model(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            pending = store.enroll(
                "custom-bank",
                self.custom_rows(source="custom-model-a")
                + self.custom_rows(source="custom-model-b", count=3),
            )

            family = next(
                item
                for item in pending["families"]
                if item["id"] == "custom-bank"
            )
            self.assertFalse(family["active"])
            self.assertEqual(7, family["row_count"])
            self.assertTrue(
                {"custom-model-a", "custom-model-b"}.isdisjoint(
                    {model["id"] for model in pending["models"]}
                )
            )
            manifest = json.loads(
                (root / "current.json").read_text(encoding="utf-8")
            )
            self.assertNotIn("custom-bank", manifest["families"])

            activated = store.enroll(
                "custom-bank",
                self.custom_rows(
                    source="custom-model-b",
                    count=1,
                    start=3,
                ),
            )
            family = next(
                item
                for item in activated["families"]
                if item["id"] == "custom-bank"
            )
            self.assertTrue(family["active"])
            self.assertTrue(
                {"custom-model-a", "custom-model-b"}.issubset(
                    {model["id"] for model in activated["models"]}
                )
            )

    def test_duplicate_challenges_do_not_make_family_fit_ready(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        rows = self.custom_rows()
        for row in rows:
            row["challenge_id"] = "one-shared-challenge"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")

            pending = store.enroll("custom-bank", rows)
            family = next(
                item
                for item in pending["families"]
                if item["id"] == "custom-bank"
            )
            self.assertFalse(family["active"])
            self.assertEqual(4, family["row_count"])
            self.assertNotIn(
                "custom-model",
                {model["id"] for model in pending["models"]},
            )
            manifest = json.loads(
                (root / "current.json").read_text(encoding="utf-8")
            )
            self.assertNotIn("custom-bank", manifest["families"])

            restarted = bank_store.BankStore(root)
            rebuilt = restarted.rebuild()
            rebuilt_family = next(
                item
                for item in rebuilt["families"]
                if item["id"] == "custom-bank"
            )
            self.assertFalse(rebuilt_family["active"])
            self.assertEqual(4, rebuilt_family["row_count"])

    def test_pending_rows_still_reserve_model_ownership(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("first-bank", "First Bank")
            store.create("second-bank", "Second Bank")
            first = store.enroll(
                "first-bank",
                [self.custom_rows(source="shared-model", count=1)[0]],
            )
            before_manifest = (root / "current.json").read_bytes()

            with self.assertRaisesRegex(ValueError, "different family"):
                store.enroll(
                    "second-bank",
                    [self.custom_rows(source="shared-model", count=1)[0]],
                )

            self.assertEqual(before_manifest, (root / "current.json").read_bytes())
            families = {
                item["id"]: item for item in first["families"]
            }
            self.assertFalse(families["first-bank"]["active"])
            self.assertEqual(1, families["first-bank"]["row_count"])
            self.assertFalse(families["second-bank"]["active"])
            self.assertEqual(0, families["second-bank"]["row_count"])
            self.assertEqual(first, bank_store.BankStore(root).summary())

    def test_pending_models_obey_total_distinct_source_limit(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        builtin_source_count = len(
            {
                row["source"]
                for row in bank_store._load_builtin_rows()
            }
        )
        custom_source_count = 256 - builtin_source_count
        self.assertGreater(custom_source_count, 0)
        exact_limit_rows = [
            self.custom_rows(
                source=f"pending-model-{index}",
                count=1,
            )[0]
            for index in range(custom_source_count)
        ]

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            store.enroll("custom-bank", exact_limit_rows)
            repeated = store.enroll(
                "custom-bank",
                [
                    self.custom_rows(
                        source="pending-model-0",
                        count=1,
                        start=1,
                    )[0]
                ],
            )
            before_manifest = (root / "current.json").read_bytes()
            before_generations = {
                path.name for path in (root / "generations").iterdir()
            }

            error = None
            with mock.patch.object(
                bank_store,
                "build_bank",
                side_effect=AssertionError("fitter must not be called"),
            ) as fitter:
                try:
                    store.enroll(
                        "custom-bank",
                        [
                            self.custom_rows(
                                source="one-model-too-many",
                                count=1,
                            )[0]
                        ],
                    )
                except Exception as caught:
                    error = caught

            self.assertIs(type(error), ValueError)
            self.assertIn("256", str(error))
            fitter.assert_not_called()
            self.assertEqual(
                before_manifest,
                (root / "current.json").read_bytes(),
            )
            self.assertEqual(
                before_generations,
                {path.name for path in (root / "generations").iterdir()},
            )
            self.assertEqual(repeated, store.summary())
            self.assertEqual(repeated, bank_store.BankStore(root).summary())

    def test_model_label_collision_is_rejected_across_families(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            store = bank_store.BankStore(Path(directory).resolve() / "state")
            store.create("custom-bank", "Custom Bank")

            error = None
            try:
                store.enroll(
                    "custom-bank",
                    self.custom_rows(source="gpt-5.4"),
                )
            except Exception as caught:
                error = caught

            self.assertIs(type(error), ValueError)
            self.assertIn("different family", str(error))
            family = next(
                item
                for item in store.summary()["families"]
                if item["id"] == "custom-bank"
            )
            self.assertFalse(family["active"])
            self.assertEqual(0, family["row_count"])

    def test_bank_id_traversal_is_rejected(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        invalid_ids = (
            "../escape",
            "/absolute",
            "nested/bank",
            ".",
            "Uppercase",
            "under_score",
            "",
            "a" * 65,
            "gpt",
            "claude",
            "unified",
        )
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory).resolve()
            for index, bank_id in enumerate(invalid_ids):
                with self.subTest(bank_id=bank_id):
                    store = bank_store.BankStore(parent / f"state-{index}")
                    error = None
                    try:
                        store.create(bank_id, "Unsafe Bank")
                    except Exception as caught:
                        error = caught
                    self.assertIs(type(error), ValueError)
            self.assertFalse((parent / "escape").exists())
            store = bank_store.BankStore(parent / "valid-state")
            summary = store.create("valid-bank-1", "Valid Bank")
            self.assertIn(
                "valid-bank-1",
                {family["id"] for family in summary["families"]},
            )

    def test_failed_fit_preserves_manifest_and_previous_generation(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            before_summary = store.enroll(
                "custom-bank",
                self.custom_rows(),
            )
            before_manifest = (root / "current.json").read_bytes()
            before_files = {
                path.relative_to(root).as_posix(): path.read_bytes()
                for path in root.rglob("*")
                if path.is_file() and path.name != "writer.lock"
            }

            with mock.patch.object(
                bank_store,
                "build_bank",
                side_effect=RuntimeError("forced fit failure"),
            ):
                with self.assertRaisesRegex(RuntimeError, "forced fit failure"):
                    store.enroll(
                        "custom-bank",
                        self.custom_rows(start=4),
                    )

            after_files = {
                path.relative_to(root).as_posix(): path.read_bytes()
                for path in root.rglob("*")
                if path.is_file() and path.name != "writer.lock"
            }
            self.assertEqual(before_manifest, (root / "current.json").read_bytes())
            self.assertEqual(before_files, after_files)
            self.assertEqual(before_summary, store.summary())

    def test_concurrent_enrollment_has_one_writer(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            before_generation = store.summary()["generation"]
            context = multiprocessing.get_context("spawn")
            entered = context.Event()
            release = context.Event()
            first_outcomes = context.Queue()
            second_outcomes = context.Queue()
            first = context.Process(
                target=_process_enroll,
                args=(
                    root,
                    self.custom_rows(source="custom-model-a"),
                    entered,
                    release,
                    first_outcomes,
                ),
                kwargs={"block": True},
            )
            second = context.Process(
                target=_process_enroll,
                args=(
                    root,
                    self.custom_rows(source="custom-model-b"),
                    entered,
                    release,
                    second_outcomes,
                ),
                kwargs={"block": False},
            )
            try:
                first.start()
                self.assertTrue(entered.wait(20), "first writer did not enter fitter")
                second.start()
                second_outcome = second_outcomes.get(timeout=20)
                self.assertEqual(
                    ("error", "RuntimeError", "bank store is busy"),
                    second_outcome,
                )
                release.set()
                first.join(20)
                second.join(20)
                self.assertFalse(first.is_alive(), "first writer did not exit")
                self.assertFalse(second.is_alive(), "second writer did not exit")
                self.assertEqual(0, first.exitcode)
                self.assertEqual(0, second.exitcode)
                first_outcome = first_outcomes.get(timeout=20)
                self.assertEqual("ok", first_outcome[0])
            finally:
                release.set()
                for child in (first, second):
                    if child.pid is not None:
                        child.join(3)
                        if child.is_alive():
                            child.terminate()
                            child.join(3)
                    child.close()
                for outcomes in (first_outcomes, second_outcomes):
                    outcomes.close()
                    outcomes.join_thread()
            restarted = bank_store.BankStore(root)
            summary = restarted.summary()
            self.assertNotEqual(before_generation, summary["generation"])
            custom_models = {
                model["id"]
                for model in summary["models"]
                if model["family"] == "custom-bank"
            }
            self.assertEqual({"custom-model-a"}, custom_models)
            self.assertEqual(
                2,
                len(list((root / "generations").glob("generation-*"))),
            )
            manifest = json.loads(
                (root / "current.json").read_text(encoding="utf-8")
            )
            entries = [
                manifest["bank"],
                manifest["references"],
                manifest["state"],
                *manifest["families"].values(),
            ]
            self.assertTrue(
                all(
                    Path(entry["path"]).parts[1] == manifest["generation"]
                    for entry in entries
                )
            )

    def test_restart_loads_committed_generation(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            first = bank_store.BankStore(root)
            first.create("custom-bank", "Custom Bank")
            expected = first.enroll("custom-bank", self.custom_rows())
            (root / "generations" / ".tmp-interrupted").mkdir()
            orphan = root / "generations" / "generation-orphan"
            orphan.mkdir()
            (orphan / "bank.json").write_text(
                '{"not":"committed"}\n',
                encoding="utf-8",
            )

            restarted = bank_store.BankStore(root)

            self.assertEqual(expected, restarted.summary())
            rebuilt = restarted.rebuild()
            self.assertEqual(
                {"custom-model"},
                {
                    model["id"]
                    for model in rebuilt["models"]
                    if model["family"] == "custom-bank"
                },
            )
            self.assertTrue(
                (root / "generations" / ".tmp-interrupted").exists()
            )
            self.assertTrue(orphan.exists())

    def test_nuisance_conditions_and_calibration_groups_are_preserved(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        builder = importlib.import_module("third_party.modeltrace.bank_builder")
        rows = []
        for condition_index, condition_id in enumerate(("cal-a", "cal-b")):
            for query_index in range(4):
                index = condition_index * 4 + query_index
                rows.append(
                    {
                        "row_id": f"grouped-row-{index}",
                        "source": "grouped-model",
                        "family_id": "custom-bank",
                        "family_name": "Custom Bank",
                        "condition_id": condition_id,
                        "nuisance_condition_id": (
                            "noise-a" if query_index % 2 == 0 else "noise-b"
                        ),
                        "challenge_id": f"{condition_id}-query-{query_index}",
                        "expected_count": 0,
                        "numbers": [
                            ((index * 29 + position * 13) % 355) + 1
                            for position in range(80)
                        ],
                        "time": f"2026-10-12T00:01:0{index}Z",
                    }
                )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            store.enroll("custom-bank", rows)
            manifest = json.loads(
                (root / "current.json").read_text(encoding="utf-8")
            )
            references = [
                json.loads(line)
                for line in (
                    root / manifest["references"]["path"]
                ).read_text(encoding="utf-8").splitlines()
            ]
            persisted = [
                row for row in references if row.get("family_id") == "custom-bank"
            ]
            family_bank = json.loads(
                (
                    root
                    / manifest["families"]["custom-bank"]["path"]
                ).read_text(encoding="utf-8")
            )
            expected = builder.build_bank(persisted)

            self.assertEqual(
                {"cal-a", "cal-b"},
                {row["condition_id"] for row in persisted},
            )
            self.assertEqual(
                {"noise-a", "noise-b"},
                {row["nuisance_condition_id"] for row in persisted},
            )
            self.assertEqual(
                {row["challenge_id"] for row in rows},
                {row["challenge_id"] for row in persisted},
            )
            self.assertEqual(
                ["noise-a", "noise-b"],
                family_bank["robust"]["hellinger"]["nuisance_environments"],
            )
            self.assertEqual(
                ["cal-a", "cal-b"],
                family_bank["robust"]["complete_environments"],
            )
            self.assertEqual(expected["calibration"], family_bank["calibration"])

    def test_bank_storage_does_not_contain_raw_or_secret_sentinels(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        sentinels = (
            "RAW_TEXT_SENTINEL_7f4c",
            "PROMPT_SENTINEL_65ab",
            "PROVIDER_BODY_SENTINEL_12de",
            "API_KEY_SENTINEL_93a1",
            "AUTH_SENTINEL_013f",
            "URL_SENTINEL_48d2",
        )
        rows = self.custom_rows()
        for row in rows:
            row.update(
                {
                    "text": "RAW_TEXT_SENTINEL_7f4c",
                    "prompt": "PROMPT_SENTINEL_65ab",
                    "provider_body": "PROVIDER_BODY_SENTINEL_12de",
                    "api_key": "API_KEY_SENTINEL_93a1",
                    "authorization": "AUTH_SENTINEL_013f",
                    "url": "https://invalid/URL_SENTINEL_48d2",
                }
            )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            store.enroll("custom-bank", rows)
            manifest_bytes = (root / "current.json").read_bytes()
            manifest = json.loads(manifest_bytes)
            entries = [
                manifest["bank"],
                manifest["references"],
                manifest["state"],
                *manifest["families"].values(),
            ]
            disk_bytes = manifest_bytes + b"".join(
                (root / entry["path"]).read_bytes()
                for entry in entries
            )
            for allowed in (
                "custom-model",
                "custom-model-row-0",
                "custom-calibration",
                "custom-nuisance",
                "custom-query-0",
            ):
                self.assertIn(allowed.encode("ascii"), disk_bytes)
            for sentinel in sentinels:
                with self.subTest(sentinel=sentinel):
                    encoded = sentinel.encode("ascii")
                    self.assertFalse(
                        encoded in disk_bytes,
                        f"forbidden sentinel persisted: {sentinel}",
                    )

    def test_symlinked_root_ancestor_is_rejected_without_escape(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory).resolve()
            outside = parent / "outside"
            outside.mkdir()
            linked = parent / "linked"
            linked.symlink_to(outside, target_is_directory=True)
            requested = linked / "nested" / "state"

            with self.assertRaises(ValueError):
                bank_store.BankStore(requested)

            self.assertEqual([], list(outside.iterdir()))
            self.assertFalse((outside / "nested").exists())
            self.assertFalse((outside / "current.json").exists())

    def test_open_root_closes_child_fd_when_child_fstat_fails(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        real_open = bank_store.os.open
        real_fstat = bank_store.os.fstat
        child_fd = None

        def capture_child_open(path, *args, **kwargs):
            nonlocal child_fd
            descriptor = real_open(path, *args, **kwargs)
            if path != os.sep and child_fd is None:
                child_fd = descriptor
            return descriptor

        def fail_child_fstat(descriptor):
            if descriptor == child_fd:
                raise OSError(errno.EIO, "forced child fstat failure")
            return real_fstat(descriptor)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            with mock.patch.object(
                bank_store.os,
                "open",
                side_effect=capture_child_open,
            ), mock.patch.object(
                bank_store.os,
                "fstat",
                side_effect=fail_child_fstat,
            ):
                with self.assertRaises(ValueError):
                    bank_store.BankStore(root)

            self.assertIsNotNone(child_fd)
            with self.assertRaises(OSError) as caught:
                real_fstat(child_fd)
            self.assertEqual(errno.EBADF, caught.exception.errno)

    def test_generations_symlink_is_rejected_before_publication(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory).resolve()
            root = parent / "state"
            root.mkdir()
            outside = parent / "outside-generations"
            outside.mkdir()
            (root / "generations").symlink_to(
                outside,
                target_is_directory=True,
            )
            store = bank_store.BankStore(root)

            with self.assertRaises(ValueError):
                store.create("custom-bank", "Custom Bank")

            self.assertEqual([], list(outside.iterdir()))
            self.assertFalse((root / "current.json").exists())

    def test_root_label_and_duplicate_admission_fail_closed(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory).resolve()
            real_root = parent / "real-state"
            real_root.mkdir()
            linked_root = parent / "linked-state"
            linked_root.symlink_to(real_root, target_is_directory=True)
            with self.assertRaises(ValueError):
                bank_store.BankStore(linked_root)

            file_root = parent / "file-state"
            file_root.write_text("not a directory", encoding="utf-8")
            with self.assertRaises(ValueError):
                bank_store.BankStore(file_root)

            invalid_labels = (
                "",
                17,
                "x" * 257,
                "unsafe\x00label",
                "https://invalid/label",
                "Authorization: secret",
            )
            for index, label in enumerate(invalid_labels):
                with self.subTest(label=repr(label)):
                    root = parent / f"label-state-{index}"
                    store = bank_store.BankStore(root)
                    with self.assertRaises(ValueError):
                        store.create("custom-bank", label)
                    self.assertFalse((root / "current.json").exists())

            root = parent / "duplicate-state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            before = (root / "current.json").read_bytes()
            with self.assertRaises(ValueError):
                store.create("custom-bank", "Replacement")
            self.assertEqual(before, (root / "current.json").read_bytes())

    def test_blank_and_sensitive_labels_are_rejected_before_publication(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        invalid_labels = (
            "   ",
            "\u2003\u00a0",
            "API_KEY_SENTINEL_93a1",
            "Api Key Label",
            "api_key_label",
            "api-key-label",
            "apikey",
            "Authorization",
            "BEARER access",
            "client_secret",
            "access-token",
            "PASSWORD",
            "service credential",
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            before_summary = store.create("existing-bank", "Existing Bank")
            before_manifest = (root / "current.json").read_bytes()
            before_generations = {
                path.name for path in (root / "generations").iterdir()
            }

            for index, label in enumerate(invalid_labels):
                with self.subTest(label=repr(label)):
                    with self.assertRaises(ValueError):
                        store.create(f"rejected-{index}", label)
                    self.assertEqual(
                        before_manifest,
                        (root / "current.json").read_bytes(),
                    )
                    self.assertEqual(
                        before_generations,
                        {
                            path.name
                            for path in (root / "generations").iterdir()
                        },
                    )

            restarted = bank_store.BankStore(root)
            self.assertEqual(before_summary, restarted.summary())
            accepted = restarted.create(
                "tokenizer-models",
                "Tokenizer Models",
            )
            tokenizer_family = next(
                family
                for family in accepted["families"]
                if family["id"] == "tokenizer-models"
            )
            self.assertEqual("Tokenizer Models", tokenizer_family["label"])

    def test_manifest_and_generation_symlinks_are_rejected(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory).resolve()
            for case in ("manifest", "artifact"):
                with self.subTest(case=case):
                    root = parent / f"{case}-state"
                    store = bank_store.BankStore(root)
                    store.create("custom-bank", "Custom Bank")
                    manifest_path = root / "current.json"
                    manifest = json.loads(
                        manifest_path.read_text(encoding="utf-8")
                    )
                    if case == "manifest":
                        outside = parent / "outside-manifest.json"
                        outside.write_bytes(manifest_path.read_bytes())
                        manifest_path.unlink()
                        manifest_path.symlink_to(outside)
                    else:
                        bank_path = root / manifest["bank"]["path"]
                        outside = parent / "outside-bank.json"
                        outside.write_bytes(bank_path.read_bytes())
                        bank_path.parent.chmod(0o700)
                        bank_path.unlink()
                        bank_path.symlink_to(outside)

                    error = None
                    try:
                        bank_store.BankStore(root)
                    except Exception as caught:
                        error = caught
                    self.assertIs(type(error), ValueError)

    def test_family_and_reference_capacity_is_enforced_before_fitting(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "family-state"
            store = bank_store.BankStore(root)
            for index in range(30):
                full = store.create(f"bank-{index}", f"Bank {index}")
            self.assertEqual(30, len(store._banks))
            self.assertEqual(32, full["family_count"])
            self.assertEqual(full, bank_store.BankStore(root).summary())
            before_manifest = (root / "current.json").read_bytes()
            before_generations = {path.name for path in (root / "generations").iterdir()}
            with mock.patch.object(
                store, "_fit_family_banks",
                side_effect=AssertionError("family fitter must not be called"),
            ) as family_fitter, mock.patch.object(
                bank_store, "build_bank",
                side_effect=AssertionError("fitter must not be called"),
            ) as fitter, mock.patch.object(
                store, "_publish_generation",
                side_effect=AssertionError("publisher must not be called"),
            ) as publisher:
                with self.assertRaisesRegex(ValueError, "^at most 30 custom banks are supported$"):
                    store.create("bank-30", "Bank 30")
                family_fitter.assert_not_called()
                fitter.assert_not_called()
                publisher.assert_not_called()
            self.assertEqual(before_manifest, (root / "current.json").read_bytes())
            self.assertEqual(
                before_generations, {path.name for path in (root / "generations").iterdir()},
            )
            self.assertEqual(full, store.summary())

        with tempfile.TemporaryDirectory() as directory:
            store = bank_store.BankStore(
                Path(directory).resolve() / "reference-state"
            )
            store.create("custom-bank", "Custom Bank")
            builtin_count = len(bank_store._load_builtin_rows())
            row = self.custom_rows(count=1)[0]
            excessive = [row] * (8192 - builtin_count + 1)
            error = None
            with mock.patch.object(
                bank_store,
                "build_bank",
                side_effect=AssertionError("fitter must not be called"),
            ):
                try:
                    store.enroll("custom-bank", excessive)
                except Exception as caught:
                    error = caught
            self.assertIs(type(error), ValueError)
            self.assertIn("8192", str(error))

    def test_oversized_references_are_rejected_before_publication(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        numeric_rows = importlib.import_module("modeltrace_runtime.numeric_rows")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            before_manifest = (root / "current.json").read_bytes()
            manifest = json.loads(before_manifest)
            references_path = root / manifest["references"]["path"]
            before_generations = {
                path.name for path in (root / "generations").iterdir()
            }
            publication_opens = []
            real_open_directory = store._open_directory

            def record_open(parent, name, *, create=False):
                if name == "generations" and create:
                    publication_opens.append(name)
                return real_open_directory(parent, name, create=create)

            with mock.patch.object(
                numeric_rows,
                "MAX_FILE_BYTES",
                references_path.stat().st_size,
            ), mock.patch.object(
                store,
                "_open_directory",
                side_effect=record_open,
            ):
                with self.assertRaises(ValueError):
                    store.enroll("custom-bank", self.custom_rows())

                self.assertEqual([], publication_opens)
                self.assertEqual(
                    before_manifest,
                    (root / "current.json").read_bytes(),
                )
                self.assertEqual(
                    before_generations,
                    {path.name for path in (root / "generations").iterdir()},
                )
                restarted = bank_store.BankStore(root)
                self.assertEqual(store.summary(), restarted.summary())

    def test_manifest_fsync_failure_keeps_previous_current_generation(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            store.create("custom-bank", "Custom Bank")
            before_summary = store.enroll(
                "custom-bank",
                self.custom_rows(),
            )
            before_manifest = (root / "current.json").read_bytes()

            real_write_file = store._write_file

            def fail_manifest_write(*args, **kwargs):
                target = args[0] if len(args) == 2 else args[1]
                if Path(os.fspath(target)).name.startswith(".current-"):
                    raise OSError("forced manifest fsync failure")
                return real_write_file(*args, **kwargs)

            with mock.patch.object(store, "_write_file", side_effect=fail_manifest_write):
                with self.assertRaisesRegex(
                    OSError,
                    "forced manifest fsync failure",
                ):
                    store.enroll(
                        "custom-bank",
                        self.custom_rows(start=4),
                    )

            self.assertEqual(before_manifest, (root / "current.json").read_bytes())
            self.assertEqual(before_summary, store.summary())

    def test_root_directory_fsync_follows_current_replace(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            root_status = root.stat()
            events = []
            real_replace = bank_store.os.replace
            real_fsync_directory = store._fsync_directory

            def is_root(target):
                status = (
                    os.fstat(target)
                    if type(target) is int
                    else os.stat(target, follow_symlinks=False)
                )
                return (
                    status.st_dev,
                    status.st_ino,
                ) == (
                    root_status.st_dev,
                    root_status.st_ino,
                )

            def recording_replace(*args, **kwargs):
                result = real_replace(*args, **kwargs)
                events.append("replace")
                return result

            def recording_fsync(target):
                result = real_fsync_directory(target)
                if is_root(target):
                    events.append("root-fsync")
                return result

            with mock.patch.object(
                bank_store.os,
                "replace",
                side_effect=recording_replace,
            ), mock.patch.object(
                store,
                "_fsync_directory",
                side_effect=recording_fsync,
            ):
                store.create("custom-bank", "Custom Bank")

            self.assertEqual(["replace", "root-fsync"], events)

    def test_post_switch_fsync_failure_latches_uncertain_commit(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            before_summary = store.create("custom-bank", "Custom Bank")
            before_manifest = json.loads(
                (root / "current.json").read_text(encoding="utf-8")
            )
            root_status = root.stat()
            replaced = False
            real_replace = bank_store.os.replace
            real_fsync_directory = store._fsync_directory

            def is_root(target):
                status = (
                    os.fstat(target)
                    if type(target) is int
                    else os.stat(target, follow_symlinks=False)
                )
                return (
                    status.st_dev,
                    status.st_ino,
                ) == (
                    root_status.st_dev,
                    root_status.st_ino,
                )

            def recording_replace(*args, **kwargs):
                nonlocal replaced
                result = real_replace(*args, **kwargs)
                replaced = True
                return result

            def fail_post_switch_root_fsync(target):
                if replaced and is_root(target):
                    raise OSError("sensitive forced fsync detail")
                return real_fsync_directory(target)

            with mock.patch.object(
                bank_store.os,
                "replace",
                side_effect=recording_replace,
            ), mock.patch.object(
                store,
                "_fsync_directory",
                side_effect=fail_post_switch_root_fsync,
            ):
                with self.assertRaisesRegex(
                    RuntimeError,
                    "^bank store commit outcome is uncertain; restart required$",
                ):
                    store.enroll("custom-bank", self.custom_rows())

            self.assertTrue(replaced)
            self.assertEqual(before_summary, store.summary())
            switched_manifest_bytes = (root / "current.json").read_bytes()
            switched_manifest = json.loads(switched_manifest_bytes)
            for operation in (
                lambda: store.create("another-bank", "Another Bank"),
                lambda: store.enroll(
                    "custom-bank",
                    self.custom_rows(source="another-model"),
                ),
                store.rebuild,
            ):
                with self.assertRaisesRegex(
                    RuntimeError,
                    "^bank store commit outcome is uncertain; restart required$",
                ):
                    operation()
                self.assertEqual(
                    switched_manifest_bytes,
                    (root / "current.json").read_bytes(),
                )

            restarted = bank_store.BankStore(root)
            restarted_summary = restarted.summary()
            self.assertIn(
                restarted_summary["generation"],
                {
                    before_manifest["generation"],
                    switched_manifest["generation"],
                },
            )
            entries = [
                switched_manifest["bank"],
                switched_manifest["references"],
                switched_manifest["state"],
                *switched_manifest["families"].values(),
            ]
            self.assertTrue(
                all(
                    Path(entry["path"]).parts[1]
                    == switched_manifest["generation"]
                    for entry in entries
                )
            )

    def test_summary_identifies_one_bounded_committed_generation(self):
        bank_store = importlib.import_module("modeltrace_runtime.bank_store")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "state"
            store = bank_store.BankStore(root)
            summary = store.create("custom-bank", "Custom Bank")
            manifest = json.loads(
                (root / "current.json").read_text(encoding="utf-8")
            )

            self.assertIn("generation", summary)
            self.assertEqual(manifest["generation"], summary["generation"])
            self.assertEqual(manifest["bank"]["sha256"], summary["revision"])
            self.assertLessEqual(summary["model_count"], 256)
            self.assertLessEqual(summary["family_count"], 32)
            encoded = json.dumps(summary, sort_keys=True)
            for forbidden in (
                "numbers",
                "counts",
                "prompt",
                "response_body",
                "authorization",
                "secret",
            ):
                self.assertNotIn(forbidden, encoded.casefold())


if __name__ == "__main__":
    unittest.main()
