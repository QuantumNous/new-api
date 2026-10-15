import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from modeltrace_runtime.collection import _CollectionSession, collect_rows, test_model
from modeltrace_runtime.operations import Operations
from modeltrace_runtime.tests.test_transport import CHALLENGE, OwnedProvider, TARGET, openai_body
from third_party.modeltrace.challenge_suite import fingerprint_suite


BANK_PATH = (
    Path(__file__).resolve().parents[2]
    / "third_party/modeltrace/data/unified_bank.json"
)


class CollectionTest(unittest.TestCase):
    def test_three_independent_challenges_use_exactly_three_posts(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "ledger"
            bank_bytes = BANK_PATH.read_bytes()
            calls = []
            with Operations(root) as operations:
                def provider(request):
                    saved = json.loads((root / "ledger.json").read_bytes())
                    record = saved["operations"]["probe-1"]
                    intents = [
                        slot for slot, entry in record["slots"].items()
                        if entry["status"] == "intent"
                    ]
                    self.assertEqual(len(intents), 1)
                    self.assertEqual(len(record["plan"]), 3)
                    calls.append((intents[0], request))
                    return {
                        "status_code": 200,
                        "body": openai_body(", ".join(["3", "2", "3"] * 120)),
                    }

                session = _CollectionSession(
                    operations, "probe-1", provider, model_label="sample-model",
                    bank_bytes=bank_bytes,
                )
                result = test_model(TARGET, session, json.loads(bank_bytes))
                self.assertEqual(len(calls), 3)
                self.assertEqual(len({slot for slot, request in calls}), 3)
                self.assertEqual(result["status"], "succeeded")
                self.assertTrue(result["complete"])
                self.assertEqual(result["counts"]["transport_calls"], 3)
                self.assertEqual(result["analysis"]["used_outputs"], 3)

    def test_missing_durable_session_rejects_without_transport(self):
        calls = []
        def provider(request):
            calls.append(request)
        bank = json.loads(BANK_PATH.read_bytes())
        self.assertEqual(test_model(TARGET, provider, bank)["status"], "invalid_session")
        self.assertEqual(collect_rows(TARGET, provider, 3)["status"], "invalid_session")
        self.assertEqual(calls, [])

    def test_partial_protocol_response_is_not_an_accepted_sample(self):
        for protocol, ending in (
            ("openai", "length"), ("openai", "content_filter"),
            ("anthropic", "max_tokens"),
        ):
            with self.subTest(protocol=protocol, ending=ending):
                with tempfile.TemporaryDirectory() as temporary:
                    bank_bytes = BANK_PATH.read_bytes()
                    calls = []
                    def provider(request):
                        calls.append(request)
                        text = ", ".join(["3"] * 330)
                        finish = ending if len(calls) == 2 else (
                            "stop" if protocol == "openai" else "end_turn")
                        body = openai_body(text, finish) if protocol == "openai" else {
                            "content": [{"type": "text", "text": text}],
                            "stop_reason": finish,
                        }
                        return {"status_code": 200, "body": body}
                    with Operations(Path(temporary) / "ledger") as operations:
                        session = _CollectionSession(
                            operations, "partial-1", provider, model_label="sample-model",
                            bank_bytes=bank_bytes,
                        )
                        error = None
                        try:
                            result = test_model(
                                {**TARGET, "api_format": protocol},
                                session, json.loads(bank_bytes),
                            )
                        except Exception as caught:
                            error = type(caught).__name__
                        self.assertIsNone(error)
                        self.assertEqual(result["status"], "partial")
                        self.assertFalse(result["complete"])
                        self.assertEqual(len(calls), 3)
                        self.assertEqual(result["counts"]["accepted"], 2)
                        self.assertEqual(result["counts"]["rejected"], 1)
                        self.assertEqual(result["analysis"]["used_outputs"], 2)

    def test_first_unknown_stops_without_analysis_or_replacement(self):
        with tempfile.TemporaryDirectory() as temporary:
            bank_bytes = BANK_PATH.read_bytes()
            calls = []
            def provider(request):
                calls.append(request)
                raise TimeoutError("synthetic-provider-secret")
            with Operations(Path(temporary) / "ledger") as operations:
                session = _CollectionSession(
                    operations, "unknown-1", provider, model_label="sample-model",
                    bank_bytes=bank_bytes,
                )
                error = None
                try:
                    result = test_model(TARGET, session, json.loads(bank_bytes))
                except Exception as caught:
                    error = type(caught).__name__
                self.assertIsNone(error)
                self.assertEqual(len(calls), 1)
                self.assertEqual(result["status"], "write_unknown")
                self.assertFalse(result["complete"])
                self.assertNotIn("analysis", result)
                self.assertEqual(result["counts"]["unattempted"], 2)
                self.assertNotIn("synthetic-provider-secret", json.dumps(result))

    def test_success_replay_and_restart_return_same_projection_without_posts(self):
        with tempfile.TemporaryDirectory() as temporary:
            bank_bytes = BANK_PATH.read_bytes()
            calls = []
            def provider(request):
                calls.append(request)
                return {"status_code": 200, "body": openai_body(", ".join(["3"] * 330))}
            root = Path(temporary) / "ledger"
            with Operations(root) as operations:
                session = _CollectionSession(
                    operations, "replay-1", provider, model_label="sample-model",
                    bank_bytes=bank_bytes,
                )
                first = test_model(TARGET, session, json.loads(bank_bytes))
                replay = test_model(TARGET, session, json.loads(bank_bytes))
                self.assertEqual(replay, first)
                self.assertEqual(len(calls), 3)
                changed = test_model(
                    {**TARGET, "api_key": "changed-synthetic-key"},
                    session, json.loads(bank_bytes),
                )
                self.assertEqual(changed["status"], "conflict")
                self.assertEqual(len(calls), 3)
            with Operations(root) as reopened:
                session = _CollectionSession(
                    reopened, "replay-1", provider, model_label="sample-model",
                    bank_bytes=bank_bytes,
                )
                self.assertEqual(test_model(TARGET, session, json.loads(bank_bytes)), first)
                self.assertEqual(len(calls), 3)

    def test_bank_snapshot_mismatch_rejects_before_operation_or_provider(self):
        with tempfile.TemporaryDirectory() as temporary:
            bank_bytes = BANK_PATH.read_bytes()
            supplied = json.loads(bank_bytes)
            supplied["models"][0]["name"] = "changed-model"
            calls = []
            with Operations(Path(temporary) / "ledger") as operations:
                session = _CollectionSession(
                    operations, "bank-1", lambda request: calls.append(request),
                    model_label="sample-model", bank_bytes=bank_bytes,
                )
                error = None
                try:
                    result = test_model(TARGET, session, supplied)
                except Exception as caught:
                    error = type(caught).__name__
                self.assertIsNone(error)
                self.assertEqual(result["status"], "invalid_bank")
                self.assertEqual(calls, [])
                self.assertFalse((Path(temporary) / "ledger/ledger.json").exists())

    def test_enrollment_unique_slots_preserves_full_suite_metadata(self):
        suite = fingerprint_suite()
        for count in (3, 12, 36):
            with self.subTest(count=count), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary) / "ledger"
                selected = [suite[(index * len(suite)) // count] for index in range(count)]
                calls = []
                with Operations(root) as operations:
                    def provider(request):
                        record = json.loads((root / "ledger.json").read_bytes())[
                            "operations"]["enroll-1"]
                        self.assertEqual(len(record["plan"]), count)
                        challenge = selected[len(calls)]
                        prompt = challenge["prompt"]
                        if challenge["user_prefix"]:
                            prompt = challenge["user_prefix"] + "\n\nFinal task:\n" + prompt
                        messages = request["body"]["messages"]
                        self.assertEqual(messages[-1]["content"], prompt)
                        if challenge["system"]:
                            self.assertEqual(messages[0], {
                                "role": "system", "content": challenge["system"],
                            })
                        calls.append(request)
                        return {"status_code": 200,
                                "body": openai_body(", ".join(["3", "2", "3"] * 120))}
                    session = _CollectionSession(
                        operations, "enroll-1", provider, model_label="sample-model",
                        family_id="sample-family", family_name="SampleFamily",
                    )
                    result = collect_rows(TARGET, session, count)
                    self.assertEqual(len(calls), count)
                    self.assertEqual(result["status"], "succeeded")
                    rows = result["rows"]
                    self.assertEqual(len(rows), count)
                    self.assertEqual(
                        [row["challenge_id"] for row in rows],
                        [challenge["challenge_id"] for challenge in selected],
                    )
                    for row, challenge in zip(rows, selected):
                        self.assertEqual(row["condition_id"], challenge["condition"])
                        self.assertEqual(row["nuisance_condition_id"], challenge["condition"])
                        self.assertEqual(row["family_id"], "sample-family")
                        self.assertEqual(row["source"], "sample-model")
                        self.assertEqual(row["numbers"], [3, 2, 3] * 120)

    def test_enrollment_count_and_target_bounds_reject_before_admission(self):
        with tempfile.TemporaryDirectory() as temporary:
            calls = []
            with Operations(Path(temporary) / "ledger") as operations:
                session = _CollectionSession(
                    operations, "invalid-1", lambda request: calls.append(request),
                    model_label="sample-model",
                )
                for count in (True, 2, 37, 3.0, "3"):
                    with self.subTest(count=count):
                        self.assertEqual(
                            collect_rows(TARGET, session, count)["status"], "invalid_request",
                        )
                self.assertEqual(
                    collect_rows({**TARGET, "base_url": "https://127.0.0.1"},
                                 session, 3)["status"], "invalid_target",
                )
                self.assertEqual(calls, [])
                self.assertFalse((Path(temporary) / "ledger/ledger.json").exists())

    def test_actual_loopback_collection_uses_owned_one_shot_transport(self):
        for protocol in ("openai", "anthropic"):
            with self.subTest(protocol=protocol), tempfile.TemporaryDirectory() as temporary:
                bank_bytes = BANK_PATH.read_bytes()
                with OwnedProvider(protocol=protocol) as provider:
                    with Operations(Path(temporary) / "ledger") as operations:
                        session = _CollectionSession(
                            operations, "http-1", provider.transport(),
                            model_label="sample-model", bank_bytes=bank_bytes,
                        )
                        result = test_model(
                            provider.target(), session, json.loads(bank_bytes),
                        )
                        self.assertEqual(result["status"], "succeeded")
                        self.assertEqual(len(provider.posts), 3)
                        self.assertEqual(result["counts"]["transport_calls"], 3)

    def test_claim_and_terminal_persistence_failures_never_post_again(self):
        for phase in ("claim", "finish"):
            with self.subTest(phase=phase), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary) / "ledger"
                bank_bytes = BANK_PATH.read_bytes()
                calls = []
                def provider(request):
                    calls.append(request)
                    return {"status_code": 200,
                            "body": openai_body(", ".join(["3"] * 330))}
                with Operations(root) as operations:
                    original = operations._write
                    def fail_selected_write(state):
                        record = state["operations"]["failure-1"]
                        entries = list(record["slots"].values())
                        if entries and (
                            phase == "claim" or entries[0]["status"] != "intent"
                        ):
                            raise OSError("synthetic-ledger-secret")
                        return original(state)
                    session = _CollectionSession(
                        operations, "failure-1", provider, model_label="sample-model",
                        bank_bytes=bank_bytes,
                    )
                    error = None
                    with patch.object(operations, "_write", side_effect=fail_selected_write):
                        try:
                            result = test_model(TARGET, session, json.loads(bank_bytes))
                        except Exception as caught:
                            error = type(caught).__name__
                    self.assertIsNone(error)
                    self.assertEqual(len(calls), 0 if phase == "claim" else 1)
                    self.assertEqual(result["status"], "write_unknown")
                    if phase == "finish":
                        self.assertEqual(result["counts"]["unknown"], 1)
                        self.assertEqual(result["counts"]["accepted"], 0)
                    replay = test_model(TARGET, session, json.loads(bank_bytes))
                    self.assertEqual(replay["status"], "write_unknown")
                    self.assertEqual(len(calls), 0 if phase == "claim" else 1)
                    self.assertNotIn("synthetic-ledger-secret", json.dumps(result))

    def test_readable_family_and_model_labels_survive_numeric_enrollment(self):
        with tempfile.TemporaryDirectory() as temporary:
            calls = []
            def provider(request):
                calls.append(request)
                return {"status_code": 200, "body": openai_body(", ".join(["3"] * 330))}
            with Operations(Path(temporary) / "ledger") as operations:
                session = _CollectionSession(
                    operations, "labels-1", provider, model_label="模型 Alpha",
                    family_id="alpha", family_name="Alpha Family",
                )
                result = collect_rows(TARGET, session, 3)
                self.assertEqual(result["status"], "succeeded")
                self.assertEqual(len(calls), 3)
                self.assertEqual(result["rows"][0]["source"], "模型 Alpha")
                self.assertEqual(result["rows"][0]["family_name"], "Alpha Family")

    def test_generator_wrong_count_or_duplicate_ids_never_dispatches(self):
        with tempfile.TemporaryDirectory() as temporary:
            bank_bytes = BANK_PATH.read_bytes()
            calls = []
            challenges = [
                {"id": f"challenge-{index}", "prompt": "test", "expected_count": 300}
                for index in range(3)
            ]
            for index, plan in enumerate((challenges[:2], [challenges[0]] * 3)):
                with self.subTest(plan=index):
                    calls.clear()
                    with Operations(Path(temporary) / f"ledger-{index}") as operations:
                        session = _CollectionSession(
                            operations, "plan-1", lambda request: calls.append(request),
                            model_label="sample-model", bank_bytes=bank_bytes,
                        )
                        with patch(
                            "modeltrace_runtime.collection.fingerprint.generate_challenges",
                            return_value=plan,
                        ):
                            result = test_model(TARGET, session, json.loads(bank_bytes))
                        self.assertEqual(calls, [])
                        self.assertFalse(result["complete"])

    def test_live_replay_and_competing_operation_do_not_acquire_submission(self):
        with tempfile.TemporaryDirectory() as temporary:
            bank_bytes = BANK_PATH.read_bytes()
            bank = json.loads(bank_bytes)
            root = Path(temporary) / "ledger"
            calls = []
            with Operations(root) as operations:
                def provider(request):
                    calls.append(request)
                    with Operations(root) as competitor:
                        replay = _CollectionSession(
                            competitor, "live-1", provider, model_label="sample-model",
                            bank_bytes=bank_bytes,
                        )
                        self.assertEqual(test_model(TARGET, replay, bank)["status"], "running")
                        other = _CollectionSession(
                            competitor, "live-2", provider, model_label="sample-model",
                            bank_bytes=bank_bytes,
                        )
                        self.assertEqual(test_model(TARGET, other, bank)["status"], "busy")
                    return {"status_code": 200,
                            "body": openai_body(", ".join(["3"] * 330))}
                session = _CollectionSession(
                    operations, "live-1", provider, model_label="sample-model",
                    bank_bytes=bank_bytes,
                )
                self.assertEqual(test_model(TARGET, session, bank)["status"], "succeeded")
                self.assertEqual(len(calls), 3)

    def test_collection_crash_after_durable_intent_never_resumes_posts(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "ledger"
            code = (
                "import json,os,sys; from pathlib import Path; "
                "from modeltrace_runtime.operations import Operations; "
                "from modeltrace_runtime.collection import _CollectionSession,test_model; "
                "from modeltrace_runtime.tests.test_transport import TARGET; "
                "data=Path(sys.argv[2]).read_bytes(); o=Operations(sys.argv[1]); "
                "s=_CollectionSession(o,'crash-1',lambda r:os._exit(0),"
                "model_label='sample-model',bank_bytes=data); "
                "test_model(TARGET,s,json.loads(data)); sys.exit(9)"
            )
            child = subprocess.run(
                [sys.executable, "-B", "-c", code, str(root), str(BANK_PATH)],
                cwd=Path(__file__).resolve().parents[2], timeout=15,
                capture_output=True,
                env={"PATH": "/usr/bin:/bin", "LANG": "C", "PYTHONNOUSERSITE": "1",
                     "PYTHONDONTWRITEBYTECODE": "1", "OPENBLAS_NUM_THREADS": "1",
                     "TMPDIR": os.environ["TMPDIR"]},
            )
            self.assertEqual(child.returncode, 0)
            self.assertEqual(child.stdout, b"")
            self.assertEqual(child.stderr, b"")
            state = json.loads((root / "ledger.json").read_bytes())
            self.assertEqual(state["operations"]["crash-1"]["status"], "running")
            self.assertEqual(len(state["operations"]["crash-1"]["slots"]), 1)
            calls = []
            bank_bytes = BANK_PATH.read_bytes()
            with Operations(root) as operations:
                session = _CollectionSession(
                    operations, "crash-1", lambda request: calls.append(request),
                    model_label="sample-model", bank_bytes=bank_bytes,
                )
                result = test_model(TARGET, session, json.loads(bank_bytes))
                self.assertEqual(result["status"], "write_unknown")
                self.assertIsNone(result["counts"]["transport_calls"])
                self.assertEqual(calls, [])

    def test_loopback_oversized_or_stalled_response_stops_the_operation(self):
        for mode in ("oversized", "stall"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temporary:
                bank_bytes = BANK_PATH.read_bytes()
                with OwnedProvider(mode=mode) as provider:
                    with Operations(Path(temporary) / "ledger") as operations:
                        raw_transport = provider.transport(slot_timeout=0.75)
                        session = _CollectionSession(
                            operations, "http-stop-1", raw_transport,
                            model_label="sample-model", bank_bytes=bank_bytes,
                        )
                        result = test_model(
                            provider.target(), session, json.loads(bank_bytes),
                        )
                        self.assertEqual(result["status"], "write_unknown")
                        self.assertEqual(len(provider.posts), 1)
                        self.assertEqual(result["counts"]["unattempted"], 2)
                        with self.assertRaises(ProcessLookupError):
                            os.kill(raw_transport.last_child_pid, 0)

    def test_single_probe_uses_the_same_ledger_and_hashes_its_prompt(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "ledger"
            calls = []
            def provider(request):
                state = json.loads((root / "ledger.json").read_bytes())
                record = state["operations"]["single-1"]
                self.assertEqual(record["slots"][CHALLENGE["id"]], {"status": "intent"})
                calls.append(request)
                return {"status_code": 200, "body": openai_body(", ".join(["3"] * 330))}
            with Operations(root) as operations:
                session = _CollectionSession(
                    operations, "single-1", provider, model_label="sample-model",
                )
                method = getattr(session, "_probe_once", None)
                self.assertTrue(callable(method), "single probe requires durable admission")
                first = method(TARGET, CHALLENGE)
                self.assertEqual(first["status"], "succeeded")
                self.assertEqual(len(calls), 1)
                self.assertEqual(method(TARGET, CHALLENGE), first)
                changed = method(TARGET, {**CHALLENGE, "prompt": "changed challenge"})
                self.assertEqual(changed["status"], "conflict")
                self.assertEqual(len(calls), 1)
                serialized = (root / "ledger.json").read_text()
                self.assertNotIn("controlled test", serialized)
                self.assertNotIn(TARGET["api_key"], serialized)
                self.assertNotIn(TARGET["base_url"], serialized)

    def test_persistent_post_submission_failure_does_not_accept_uncommitted_result(self):
        with tempfile.TemporaryDirectory() as temporary:
            calls = []
            bank_bytes = BANK_PATH.read_bytes()
            def provider(request):
                calls.append(request)
                return {"status_code": 200, "body": openai_body(", ".join(["3"] * 330))}
            with Operations(Path(temporary) / "ledger") as operations:
                original = operations._write
                def fail_after_dispatch(state):
                    if calls:
                        raise OSError("synthetic-persistence-secret")
                    return original(state)
                session = _CollectionSession(
                    operations, "persistent-1", provider, model_label="sample-model",
                    bank_bytes=bank_bytes,
                )
                with patch.object(operations, "_write", side_effect=fail_after_dispatch):
                    result = test_model(TARGET, session, json.loads(bank_bytes))
                self.assertEqual(len(calls), 1)
                self.assertEqual(result["status"], "write_unknown")
                self.assertEqual(result["counts"]["unknown"], 1)
                self.assertEqual(result["counts"]["accepted"], 0)
                self.assertNotIn("analysis", result)

    def test_directory_fsync_failure_never_accepts_uncertain_slot_on_replay(self):
        for action in ("test", "enroll"):
            for sustained in (False, True):
                for prior in (0, 1):
                    with self.subTest(action=action, sustained=sustained, prior=prior):
                        with tempfile.TemporaryDirectory() as temporary:
                            root = Path(temporary) / "ledger"
                            calls = []
                            failures = []
                            bank_bytes = BANK_PATH.read_bytes() if action == "test" else None
                            bank = json.loads(bank_bytes) if bank_bytes else None

                            def provider(request):
                                calls.append(1)
                                return {"status_code": 200,
                                        "body": openai_body(",".join(["3"] * 330))}

                            def execute(operations):
                                session = _CollectionSession(
                                    operations, "fsync-1", provider,
                                    model_label="sample-model", bank_bytes=bank_bytes,
                                )
                                return (test_model(TARGET, session, bank) if action == "test"
                                        else collect_rows(TARGET, session, 3))

                            with Operations(root) as operations:
                                original = os.fsync

                                def fail_terminal_directory_sync(descriptor):
                                    if (descriptor == operations._root_fd
                                            and len(calls) > prior
                                            and (sustained or not failures)):
                                        failures.append(1)
                                        raise OSError("synthetic-fsync-secret")
                                    return original(descriptor)

                                with patch("modeltrace_runtime.operations.os.fsync",
                                           side_effect=fail_terminal_directory_sync):
                                    first = execute(operations)
                                same_owner = execute(operations)
                            with Operations(root) as reopened:
                                restarted = execute(reopened)
                            self.assertEqual(len(calls), prior + 1)
                            self.assertGreaterEqual(len(failures), 1)
                            for label, result in (("first", first), ("same", same_owner),
                                                  ("reopened", restarted)):
                                with self.subTest(projection=label):
                                    self.assertEqual(result["status"], "write_unknown")
                                    self.assertEqual(result["counts"]["accepted"], prior)
                                    self.assertEqual(result["counts"]["unknown"], 1)
                                    self.assertEqual(result["counts"]["unattempted"], 2 - prior)
                                    self.assertFalse(result["complete"])
                                    if action == "test":
                                        if prior:
                                            self.assertEqual(result["analysis"]["used_outputs"], 1)
                                        else:
                                            self.assertNotIn("analysis", result)
                                    else:
                                        self.assertEqual(len(result["rows"]), prior)
                                    self.assertNotIn("synthetic-fsync-secret", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
