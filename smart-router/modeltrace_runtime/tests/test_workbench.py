import copy
import http.server
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import threading
import tempfile
import unittest
from unittest.mock import patch

from modeltrace_runtime import engine, workbench
from modeltrace_runtime.bank_store import BankStore
from modeltrace_runtime.operations import Operations
from modeltrace_runtime.tests.test_export import SignedDaemonFixture, KEY
from modeltrace_runtime.tests.test_transport import OwnedProvider, openai_body
from modeltrace_runtime.transport import OneShotTransport
from third_party.modeltrace.fingerprint import parse_numbers


ROOT = Path(__file__).resolve().parents[2]
BINDING = "bnd_" + "A" * 24
ORIGIN = "http://127.0.0.1:18763"


def reference_samples(count=3):
    rows = []
    with (ROOT / "third_party/modeltrace/data/gpt_reference.jsonl").open() as stream:
        for line in stream:
            row = json.loads(line)
            rows.append({
                "challenge_id": row["challenge_id"], "numbers": parse_numbers(row["text"]),
                "expected_count": row["requested_count"],
            })
            if len(rows) == count:
                break
    return rows


class CapturedExport:
    def __init__(self):
        self.evidence = []

    def submit(self, evidence):
        self.evidence.append(copy.deepcopy(evidence))
        return {"probe_id": evidence["probe_id"], "state": "running"}

    def get(self, probe_id):
        return {"probe_id": probe_id, "state": "running"}


class SequenceProvider(OwnedProvider):
    """Controlled fixed-slot responses without editing frozen Task B fixtures."""

    def __init__(self, protocol, mode):
        self.mode = mode
        self.protocol = protocol
        self.posts = []
        self.release = threading.Event()
        self.received = threading.Event()
        owner = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                value = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                owner.posts.append({"path": self.path, "body": value})
                owner.received.set()
                if len(owner.posts) == 2 and owner.mode == "late-unknown":
                    owner.release.wait(5)
                    self.close_connection = True
                    return
                text = ", ".join(["3", "2", "3"] * 100)
                invalid = len(owner.posts) == 2 and owner.mode == "partial"
                body = openai_body(text, finish="length" if invalid else "stop")
                if owner.protocol == "anthropic":
                    body = {"content": [{"type": "text", "text": text}],
                            "stop_reason": "max_tokens" if invalid else "end_turn"}
                payload = json.dumps(body).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                try:
                    self.wfile.write(payload)
                except (BrokenPipeError, ConnectionResetError):
                    pass

        self.server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever)


class ManualWorkbenchTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="task-e-manual-")
        self.addCleanup(self.temporary.cleanup)
        root = Path(self.temporary.name)
        self.store = BankStore(root / "banks")
        self.addCleanup(self.store._root_finalizer)
        self.operations = Operations(root / "operations")
        self.addCleanup(self.operations.close)
        self.export = CapturedExport()
        self.app = workbench.create_app(self.store, lambda request: None,
                                        self.operations, self.export)
        self.app.config.update(
            TESTING=True, WORKBENCH_HOSTS=("127.0.0.1:18763",),
            WORKBENCH_ORIGINS=(ORIGIN,), WORKBENCH_LOCAL_HTTP=True,
            WORKBENCH_STATE_ROOT=str(root / "control"),
            WORKBENCH_BINDINGS=({
                "binding_id": BINDING, "claimed_model": "GPT-4o", "protocol": "chat",
            },),
        )
        self.client = self.app.test_client()
        bootstrap = self.client.get("/api/session", base_url=ORIGIN)
        self.csrf = (bootstrap.get_json(silent=True) or {}).get("csrf_token", "")
        if "modeltrace_workbench" in self.app.extensions:
            self.addCleanup(self.app.extensions["modeltrace_workbench"].close)

    def post(self, path, value):
        return self.client.post(path, base_url=ORIGIN, json=value, headers={
            "Origin": ORIGIN, "X-CSRF-Token": self.csrf,
        })

    def test_workbench_manual_analyze_can_export_numeric_evidence(self):
        samples = reference_samples()
        outputs = [
            {"challenge_id": sample["challenge_id"],
             "expected_count": sample["expected_count"],
             "text": "numeric observation: " + ", ".join(map(str, sample["numbers"]))}
            for sample in samples
        ]
        response = self.post("/api/analyze", {
            "action_id": "manual-parity-1", "outputs": outputs,
        })
        self.assertEqual(response.status_code, 200, "manual analysis route is missing")
        actual = response.get_json()
        bank = json.loads((ROOT / "third_party/modeltrace/data/unified_bank.json").read_bytes())
        expected = engine.analyze_samples(samples, bank)
        self.assertEqual(actual["analysis"]["prediction"], expected["prediction"])
        self.assertAlmostEqual(actual["analysis"]["probability"], expected["probability"], delta=1e-10)
        self.assertEqual(actual["samples"], samples)
        self.assertTrue(actual["analysis"]["complete"])
        self.assertTrue(actual["analysis"]["closed_set"])
        for output, sample in zip(outputs, actual["samples"]):
            self.assertEqual(parse_numbers(output["text"]), sample["numbers"])
        evidence = {
            "schema_version": 1, "probe_id": "manual-probe-1", "binding_id": BINDING,
            "claimed_model": "GPT-4o", "protocol": "chat",
            "bank_revision": actual["bank_revision"], "samples": actual["samples"],
        }
        exported = self.post("/api/export", {"action_id": "manual-export-1", "evidence": evidence})
        self.assertEqual(exported.status_code, 200)
        self.assertEqual(self.export.evidence, [evidence])
        self.assertEqual(set(self.export.evidence[0]), {
            "schema_version", "probe_id", "binding_id", "claimed_model",
            "protocol", "bank_revision", "samples",
        })
        serialized = json.dumps(self.export.evidence)
        for forbidden in ("numeric observation", '"text"', '"prompt"', '"target"',
                          '"api_key"', '"base_url"'):
            self.assertNotIn(forbidden, serialized)

    def test_security_checks_precede_all_backend_admission(self):
        self.assertTrue(self.csrf, "session bootstrap is missing")
        value = {"action_id": "secure-analysis", "samples": reference_samples(1)}
        for path in ("/api/analyze", "/api/export", "/api/banks/reload"):
            with self.subTest(path=path):
                response = self.client.post(path, base_url=ORIGIN, json=value,
                                            headers={"Origin": "https://foreign.example"})
                self.assertEqual(response.status_code, 403)
                response = self.client.post(path, base_url=ORIGIN, json=value)
                self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get("/api/banks", base_url="http://evil.example").status_code, 403)
        other = self.app.test_client()
        self.assertEqual(other.get("/api/banks", base_url=ORIGIN).status_code, 401)
        response = self.client.get("/api/session", base_url=ORIGIN,
                                   headers={"Sec-Fetch-Site": "cross-site"})
        self.assertEqual(response.status_code, 403)
        for raw in (b'{"action_id":"a","action_id":"b"}', b'{"action_id":NaN}',
                    b'{} {}', b'\xff', b'{"action_id":"a","extra":1}',
                    b'[' * 20 + b'0' + b']' * 20, b' ' * (256 * 1024 + 1)):
            with self.subTest(raw_size=len(raw)):
                response = self.client.post("/api/analyze", base_url=ORIGIN, data=raw,
                    content_type="application/json",
                    headers={"Origin": ORIGIN, "X-CSRF-Token": self.csrf})
                self.assertIn(response.status_code, (400, 413))
                self.assertLess(len(response.data), 256)
        self.assertEqual(self.export.evidence, [])

    def test_partial_numeric_analysis_bounds_and_security_headers(self):
        response = self.post("/api/analyze", {
            "action_id": "partial-1", "samples": reference_samples(1),
        })
        self.assertEqual(response.status_code, 200)
        value = response.get_json()
        self.assertFalse(value["analysis"]["complete"])
        self.assertEqual(value["assessment"], "inconclusive")
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertEqual(response.headers["Referrer-Policy"], "no-referrer")
        self.assertEqual(response.headers["X-Frame-Options"], "DENY")
        self.assertNotIn("unsafe", response.headers["Content-Security-Policy"])
        for samples in ([], reference_samples() + reference_samples(1),
                        [{"challenge_id": "x", "expected_count": True, "numbers": [1] * 80}],
                        [{"challenge_id": "x", "expected_count": 80, "numbers": [1] * 4097}]):
            self.assertEqual(self.post("/api/analyze", {
                "action_id": "bounds", "samples": samples,
            }).status_code, 400)

    def test_numeric_export_bound_binding_owned_readback_and_replay(self):
        evidence = {
            "schema_version": 1, "probe_id": "owned-export", "binding_id": BINDING,
            "claimed_model": "GPT-4o", "protocol": "chat",
            "bank_revision": workbench.BUILTIN_REVISION, "samples": reference_samples(1),
        }
        request = {"action_id": "export-receipt", "evidence": evidence}
        response = self.post("/api/export", request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.post("/api/export", request).get_json(), response.get_json())
        self.assertEqual(len(self.export.evidence), 1, "export replay sent a second POST")
        self.assertEqual(self.client.get("/api/probes/owned-export", base_url=ORIGIN).status_code, 200)
        other = self.app.test_client()
        other.get("/api/session", base_url=ORIGIN)
        self.assertEqual(other.get("/api/probes/owned-export", base_url=ORIGIN).status_code, 404)
        for change in ({"binding_id": "GPT-4o"}, {"samples": []},
                       {"claimed_model": "different"}, {"protocol": "responses"}):
            self.assertEqual(self.post("/api/export", {
                "action_id": "bad-" + next(iter(change)), "evidence": {**evidence, **change},
            }).status_code, 400)
        self.assertEqual(len(self.export.evidence), 1)

    def test_create_enroll_three_inactive_rebuild_reload_with_receipts(self):
        before = self.client.get("/api/banks", base_url=ORIGIN).get_json()
        create = {"action_id": "create-family", "bank_id": "custom", "label": "Custom",
                  "generation": before["generation"], "bank_revision": before["revision"]}
        response = self.post("/api/banks", create)
        self.assertEqual(response.status_code, 200, "explicit bank create is missing")
        created = response.get_json()["summary"]
        self.assertEqual(self.post("/api/banks", create).get_json(), response.get_json())
        rows = [
            {"row_id": "manual-row-" + str(index), "source": "Custom Model",
             "condition_id": "condition", "nuisance_condition_id": "separate-nuisance",
             **sample}
            for index, sample in enumerate(reference_samples())
        ]
        enroll = {"action_id": "publish-three", "generation": created["generation"],
                  "bank_revision": created["revision"], "rows": rows}
        response = self.post("/api/banks/custom/enroll", enroll)
        self.assertEqual(response.status_code, 200)
        published = response.get_json()["summary"]
        family = next(item for item in published["families"] if item["id"] == "custom")
        self.assertEqual(family["row_count"], 3)
        self.assertFalse(family["active"])
        self.assertEqual(self.post("/api/banks/custom/enroll", enroll).get_json(), response.get_json())
        self.assertEqual(self.store.summary()["reference_count"], published["reference_count"])
        self.assertEqual(self.store._custom_rows["custom"][0]["nuisance_condition_id"],
                         "separate-nuisance")
        self.assertEqual(self.post("/api/banks/rebuild", {
            "action_id": "stale-rebuild", "generation": created["generation"],
            "bank_revision": created["revision"],
        }).status_code, 409)
        response = self.post("/api/banks/rebuild", {
            "action_id": "rebuild", "generation": published["generation"],
            "bank_revision": published["revision"],
        })
        self.assertEqual(response.status_code, 200)
        rebuilt = response.get_json()["summary"]
        response = self.post("/api/banks/reload", {"action_id": "reload"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["summary"], rebuilt)
        self.assertEqual(self.client.get("/api/bank?bank_id=custom", base_url=ORIGIN).get_json()
                         ["family"]["row_count"], 3)

    def test_uncertain_publication_blocks_replay_new_id_and_reload(self):
        before = self.store.summary()
        value = {"action_id": "uncertain-create", "bank_id": "custom", "label": "Custom",
                 "generation": before["generation"], "bank_revision": before["revision"]}
        if not hasattr(workbench, "execute_owned"):
            self.fail("owned publication execution is missing")
        with patch.object(workbench, "execute_owned",
                          side_effect=workbench.RequestError("deadline_exceeded", 503)):
            response = self.post("/api/banks", value)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["error"], "restart_required")
        self.assertEqual(self.post("/api/banks", value).get_json(), response.get_json())
        self.assertEqual(self.post("/api/banks", {**value, "action_id": "new-id"}).status_code, 503)
        self.assertEqual(self.post("/api/banks/reload", {"action_id": "reload-after-unknown"})
                         .get_json()["error"], "restart_required")
        self.assertTrue(self.store._write_uncertain)

    def test_factory_does_not_construct_state_network_or_threads(self):
        with patch.object(BankStore, "__init__", side_effect=AssertionError("constructed")), \
                patch.object(Operations, "__init__", side_effect=AssertionError("constructed")), \
                patch.object(threading.Thread, "start", side_effect=AssertionError("started")):
            app = workbench.create_app(object(), object(), object(), object())
            self.assertIn("/api/test/auto", [str(rule) for rule in app.url_map.iter_rules()])
            app.extensions["modeltrace_workbench"].close()

    def test_owned_analysis_child_is_reaped_before_admission_release(self):
        with patch.object(engine, "analyze_samples", side_effect=AssertionError("parent analysis")):
            response = self.post("/api/analyze", {
                "action_id": "child-analysis", "samples": reference_samples(1),
            })
        self.assertEqual(response.status_code, 200)
        control = self.app.extensions["modeltrace_workbench"]
        self.assertEqual(control.children, set())
        self.assertTrue(control.admission.acquire(blocking=False))
        control.admission.release()

    def test_coherent_snapshot_exact_bytes_and_fail_closed_external_change(self):
        snapshot = workbench.coherent_snapshot(self.store)
        self.assertEqual(snapshot["revision"], workbench.BUILTIN_REVISION)
        snapshot["bank"]["models"].clear()
        self.assertTrue(workbench.coherent_snapshot(self.store)["bank"]["models"])
        self.store._write_uncertain = True
        with self.assertRaisesRegex(RuntimeError, "restart_required"):
            workbench.coherent_snapshot(self.store)

    def test_operator_and_canonical_manual_assets_have_exact_dependency_closure(self):
        response = self.client.get("/", base_url=ORIGIN)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"/assets/app.js", response.data)
        self.assertIn(b"ModelTrace", response.data)
        self.assertIn(b"QuantumNous", response.data)
        redirect = self.client.get("/static-manual", base_url=ORIGIN)
        self.assertIn(redirect.status_code, (301, 308))
        self.assertTrue(redirect.headers["Location"].endswith("/static-manual/"))
        for name, mime in (
                ("", "text/html"), ("pages-app.js", "text/javascript"),
                ("fingerprint-core.js", "text/javascript"),
                ("challenge-browser.js", "text/javascript"),
                ("styles.css", "text/css"), ("repository-link.css", "text/css"),
                ("data/unified_bank.json", "application/json")):
            with self.subTest(asset=name):
                asset = self.client.get("/static-manual/" + name, base_url=ORIGIN)
                self.assertEqual(asset.status_code, 200)
                self.assertEqual(asset.mimetype, mime)
        self.assertEqual(self.client.get("/assets/app.js", base_url=ORIGIN).status_code, 200)
        self.assertEqual(self.client.get("/static-manual/app.js", base_url=ORIGIN).status_code, 404)
        self.assertEqual(self.client.get("/static-manual/../workbench.py", base_url=ORIGIN)
                         .status_code, 404)

    def test_durable_unknown_survives_restart_without_history_takeover(self):
        before = self.store.summary()
        value = {"action_id": "receipt-lost", "bank_id": "custom", "label": "Custom",
                 "generation": before["generation"], "bank_revision": before["revision"]}
        control = self.app.extensions["modeltrace_workbench"]
        with patch.object(workbench.ActionJournal, "finish", side_effect=OSError("receipt lost")):
            response = self.post("/api/banks", value)
        self.assertEqual(response.get_json()["error"], "restart_required")
        committed = self.store._load_manifest()
        control.close()
        restarted = BankStore(self.store.root)
        self.addCleanup(restarted._root_finalizer)
        app = workbench.create_app(restarted, object(), self.operations, self.export)
        app.config.update(self.app.config)
        self.addCleanup(app.extensions["modeltrace_workbench"].close)
        client = app.test_client()
        csrf = client.get("/api/session", base_url=ORIGIN).get_json()["csrf_token"]
        response = client.post("/api/banks/reload", base_url=ORIGIN,
                               json={"action_id": "restart-reload"},
                               headers={"Origin": ORIGIN, "X-CSRF-Token": csrf})
        self.assertEqual(response.get_json()["error"], "restart_required")
        self.assertEqual(restarted._load_manifest(), committed)
        self.assertEqual(client.get("/api/operations/receipt-lost", base_url=ORIGIN)
                         .status_code, 404)

    def test_session_expiry_cookie_and_single_process_owner(self):
        bootstrap = self.client.get("/api/session", base_url=ORIGIN)
        cookie = bootstrap.headers["Set-Cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)
        self.assertNotIn("Domain=", cookie)
        control = self.app.extensions["modeltrace_workbench"]
        with control.lock:
            for session in control.sessions.values():
                session["expires"] = 0
        self.assertEqual(self.client.get("/api/banks", base_url=ORIGIN).status_code, 401)
        fresh = self.client.get("/api/session", base_url=ORIGIN).get_json()
        self.assertNotEqual(fresh["csrf_token"], self.csrf)
        self.csrf = fresh["csrf_token"]
        self.assertEqual(self.post("/api/banks/reload", {"action_id": "owner-first"})
                         .status_code, 200)
        other = workbench.create_app(self.store, object(), self.operations, self.export)
        other.config.update(self.app.config)
        self.addCleanup(other.extensions["modeltrace_workbench"].close)
        client = other.test_client()
        csrf = client.get("/api/session", base_url=ORIGIN).get_json()["csrf_token"]
        response = client.post("/api/banks/reload", base_url=ORIGIN,
                               json={"action_id": "owner-second"},
                               headers={"Origin": ORIGIN, "X-CSRF-Token": csrf})
        self.assertEqual(response.status_code, 503)

    def test_overflow_nonfinite_json_is_rejected_by_admission_parser(self):
        for payload in (b'{"value":1e1000}', b'{"value":-1e1000}',
                        b'{"nested":[{"value":1e1000}]}'):
            with self.subTest(payload=payload):
                with self.assertRaises(workbench.RequestError):
                    workbench.strict_json(payload)

    def test_signed_readback_shares_expensive_operation_admission(self):
        evidence = {
            "schema_version": 1, "probe_id": "readback-lock", "binding_id": BINDING,
            "claimed_model": "GPT-4o", "protocol": "chat",
            "bank_revision": workbench.BUILTIN_REVISION, "samples": reference_samples(1),
        }
        self.assertEqual(self.post("/api/export", {
            "action_id": "readback-export", "evidence": evidence,
        }).status_code, 200)
        control = self.app.extensions["modeltrace_workbench"]
        self.assertTrue(control.admission.acquire(blocking=False))
        try:
            with patch.object(self.export, "get", side_effect=AssertionError("bypassed admission")):
                response = self.client.get("/api/probes/readback-lock", base_url=ORIGIN)
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.get_json(), {"error": "busy"})
        finally:
            control.admission.release()


class ControlledCollectionTest(unittest.TestCase):
    setUp = ManualWorkbenchTest.setUp
    post = ManualWorkbenchTest.post

    def test_both_protocols_fixed_three_and_safe_lookup(self):
        for protocol in ("openai", "anthropic"):
            with self.subTest(protocol=protocol):
                with OwnedProvider(protocol=protocol) as provider:
                    self.assertIn("modeltrace_dependencies", self.app.extensions,
                                  "injected collection registration is missing")
                    self.app.extensions["modeltrace_dependencies"]["transport"] = \
                        provider.transport()
                    value = {
                        "operation_id": "test-" + protocol, "model_label": "GPT-4o",
                        "target": {"base_url": provider.target()["base_url"], "api_model": "synthetic-model",
                                   "api_key": "synthetic-transient-key", "api_format": protocol},
                    }
                    response = self.post("/api/test/auto", value)
                    self.assertEqual(response.status_code, 200, "fixed collection endpoint is missing")
                    result = response.get_json()
                    self.assertEqual(result["counts"]["requested"], 3)
                    self.assertEqual(result["counts"]["transport_calls"], 3)
                    self.assertTrue(result["complete"])
                    self.assertEqual(len(provider.posts), 3)
                    self.assertEqual(self.post("/api/test/auto", value).get_json(), result)
                    self.assertEqual(len(provider.posts), 3)
                    lookup = self.client.get("/api/operations/test-" + protocol, base_url=ORIGIN)
                    self.assertEqual(lookup.status_code, 200)
                    serialized = json.dumps(lookup.get_json())
                    self.assertNotIn("synthetic-transient-key", serialized)
                    self.assertNotIn("synthetic-model", serialized)
                    self.assertNotIn("prompt", serialized)
                    other = self.app.test_client()
                    other.get("/api/session", base_url=ORIGIN)
                    self.assertEqual(other.get("/api/operations/test-" + protocol,
                                               base_url=ORIGIN).status_code, 404)

    def test_unknown_stops_and_replay_makes_zero_new_posts(self):
        with OwnedProvider(mode="stall") as provider:
            self.assertIn("modeltrace_dependencies", self.app.extensions,
                          "injected collection registration is missing")
            self.app.extensions["modeltrace_dependencies"]["transport"] = \
                provider.transport(slot_timeout=2)
            value = {
                "operation_id": "unknown-test", "model_label": "GPT-4o",
                "target": {"base_url": provider.target()["base_url"], "api_model": "synthetic-model",
                           "api_key": "synthetic-transient-key", "api_format": "openai"},
            }
            response = self.post("/api/test/auto", value)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["status"], "write_unknown")
            self.assertFalse(response.get_json()["complete"])
            self.assertEqual(len(provider.posts), 1)
            self.assertEqual(self.post("/api/test/auto", value).get_json(), response.get_json())
            self.assertEqual(len(provider.posts), 1)

    def test_both_protocols_partial_and_late_unknown_preserve_earlier_numeric_evidence(self):
        for protocol, mode in (("openai", "partial"), ("anthropic", "partial"),
                               ("openai", "late-unknown"), ("anthropic", "late-unknown")):
            with self.subTest(protocol=protocol, mode=mode), SequenceProvider(protocol, mode) as provider:
                # Isolate durable unknown latches, not retry or take over previous history.
                with tempfile.TemporaryDirectory(prefix="task-e-sequence-") as temporary:
                    operations = Operations(Path(temporary) / "operations")
                    self.addCleanup(operations.close)
                    app = workbench.create_app(self.store, provider.transport(slot_timeout=1),
                                                operations, self.export)
                    app.config.update(self.app.config)
                    app.config["WORKBENCH_STATE_ROOT"] = str(Path(temporary) / "control")
                    app.config["WORKBENCH_BINDINGS"] = ({
                        "binding_id": BINDING, "claimed_model": "GPT-4o",
                        "protocol": "chat" if protocol == "openai" else "messages",
                    },)
                    client = app.test_client()
                    csrf = client.get("/api/session", base_url=ORIGIN).get_json()["csrf_token"]
                    headers = {"Origin": ORIGIN, "X-CSRF-Token": csrf}
                    value = {"operation_id": "sequence", "model_label": "GPT-4o",
                             "target": {**provider.target(), "api_model": "synthetic-model",
                                        "api_key": "synthetic-transient-key"}}
                    try:
                        response = client.post("/api/test/auto", base_url=ORIGIN,
                                               json=value, headers=headers)
                        self.assertEqual(response.status_code, 200)
                        result = response.get_json()
                        self.assertEqual(result["status"], "partial" if mode == "partial" else "write_unknown")
                        self.assertFalse(result["complete"])
                        self.assertEqual(len(provider.posts), 3 if mode == "partial" else 2)
                        samples = [
                            {"challenge_id": identity, "expected_count": slot["result"]["expected_count"],
                             "numbers": slot["result"]["numbers"]}
                            for identity, slot in result["slots"].items() if slot["result"]["eligible"]
                        ]
                        self.assertEqual(len(samples), 2 if mode == "partial" else 1)
                        analyzed = client.post("/api/analyze", base_url=ORIGIN, headers=headers,
                                               json={"action_id": "analyze-committed", "samples": samples})
                        self.assertEqual(analyzed.status_code, 200)
                        self.assertFalse(analyzed.get_json()["analysis"]["complete"])
                        evidence = {"schema_version": 1, "probe_id": "sequence-probe",
                                    **app.config["WORKBENCH_BINDINGS"][0],
                                    "bank_revision": result["bank_revision"], "samples": samples}
                        exported = client.post("/api/export", base_url=ORIGIN, headers=headers,
                                               json={"action_id": "export-committed", "evidence": evidence})
                        self.assertEqual(exported.status_code, 200)
                        replay = client.post("/api/test/auto", base_url=ORIGIN, headers=headers, json=value)
                        self.assertEqual(replay.get_json(), result)
                        self.assertEqual(len(provider.posts), 3 if mode == "partial" else 2)
                    finally:
                        app.extensions["modeltrace_workbench"].close()
                        operations.close()

    def test_stop_cancels_active_collection_child_without_new_provider_post(self):
        with OwnedProvider(mode="stall") as provider:
            self.app.extensions["modeltrace_dependencies"]["transport"] = provider.transport(slot_timeout=20)
            control = self.app.extensions["modeltrace_workbench"]
            completed = threading.Event()
            response = []
            observed = threading.Event()

            class ObservedPosts(list):
                def append(self, value):
                    super().append(value)
                    observed.set()

            provider.posts = ObservedPosts()

            def collect():
                response.append(self.post("/api/test/auto", {
                    "operation_id": "cancel-active", "model_label": "GPT-4o",
                    "target": provider.target(),
                }))
                completed.set()

            handler = threading.Thread(target=collect)
            handler.start()
            try:
                self.assertTrue(observed.wait(10), "provider did not receive owned request")
                control.stop()
                self.assertTrue(completed.wait(10), "active collection was not cancelled")
                handler.join(5)
                self.assertFalse(handler.is_alive())
                self.assertEqual(control.children, set())
                self.assertEqual(len(provider.posts), 1)
                self.assertEqual(response[0].get_json()["status"], "write_unknown")
            finally:
                control.stop()
                provider.release.set()
                handler.join(10)

    def test_owned_generated_probe_and_three_row_enrollment_no_publication(self):
        challenges = self.client.get("/api/challenges", base_url=ORIGIN)
        self.assertEqual(challenges.status_code, 200)
        plan = challenges.get_json()
        with OwnedProvider() as provider:
            self.app.extensions["modeltrace_dependencies"]["transport"] = \
                provider.transport()
            target = {"base_url": provider.target()["base_url"], "api_model": "synthetic-model",
                      "api_key": "synthetic-transient-key", "api_format": "openai"}
            self.assertEqual(self.post("/api/test/probe", {
                "operation_id": "bad-probe", "model_label": "GPT-4o",
                "target": target, "prompt": "browser arbitrary",
            }).status_code, 400)
            response = self.post("/api/test/probe", {
                "operation_id": "single-probe", "model_label": "GPT-4o", "target": target,
                "challenge_set_id": plan["challenge_set_id"],
                "challenge_id": plan["challenges"][0]["id"],
            })
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["counts"]["transport_calls"], 1)
            response = self.post("/api/enroll/auto", {
                "operation_id": "enroll-three", "model_label": "Custom Model",
                "target": target, "family_id": "custom", "family_name": "Custom",
                "sample_count": 3,
            })
            self.assertEqual(response.status_code, 200)
            result = response.get_json()
            self.assertEqual(result["counts"]["requested"], 3)
            self.assertEqual(len(provider.posts), 4)
            self.assertEqual(len(result["rows"]), 3)
            self.assertEqual(self.store.summary()["generation"], "builtin")

    def test_collected_export_preserves_owned_protocol_label_samples_and_revision(self):
        with OwnedProvider(protocol="anthropic") as provider:
            self.app.extensions["modeltrace_dependencies"]["transport"] = provider.transport()
            self.app.config["WORKBENCH_BINDINGS"] = (
                {"binding_id": BINDING, "claimed_model": "GPT-4o", "protocol": "chat"},
                {"binding_id": "bnd_" + "B" * 24, "claimed_model": "GPT-4o", "protocol": "messages"},
            )
            result = self.post("/api/test/auto", {
                "operation_id": "bound-collection", "target": provider.target(),
                "model_label": "GPT-4o",
            }).get_json()
            samples = [
                {"challenge_id": identity, "expected_count": entry["result"]["expected_count"],
                 "numbers": entry["result"]["numbers"]}
                for identity, entry in result["slots"].items() if entry["result"]["eligible"]
            ]
            evidence = {
                "schema_version": 1, "probe_id": "bound-probe",
                **self.app.config["WORKBENCH_BINDINGS"][1],
                "bank_revision": result["bank_revision"], "samples": samples,
            }
            wrong = {**evidence, **self.app.config["WORKBENCH_BINDINGS"][0]}
            self.assertEqual(self.post("/api/export", {
                "action_id": "wrong-protocol", "operation_id": "bound-collection",
                "evidence": wrong,
            }).status_code, 409)
            response = self.post("/api/export", {
                "action_id": "correct-protocol", "operation_id": "bound-collection",
                "evidence": evidence,
            })
            self.assertEqual(response.status_code, 200)
            self.assertEqual(self.export.evidence, [evidence])
            self.assertEqual(len(provider.posts), 3)

    def test_single_probe_committed_analysis_export_and_stale_revision_fail_closed(self):
        plan = self.client.get("/api/challenges", base_url=ORIGIN).get_json()
        with OwnedProvider() as provider:
            self.app.extensions["modeltrace_dependencies"]["transport"] = provider.transport()
            result = self.post("/api/test/probe", {
                "operation_id": "bound-single", "target": provider.target(),
                "model_label": "GPT-4o", "challenge_set_id": plan["challenge_set_id"],
                "challenge_id": plan["challenges"][0]["id"],
            }).get_json()
            samples = [
                {"challenge_id": identity, "expected_count": entry["result"]["expected_count"],
                 "numbers": entry["result"]["numbers"]}
                for identity, entry in result["slots"].items() if entry["result"]["eligible"]
            ]
            analysis = self.post("/api/analyze", {
                "action_id": "single-analysis", "operation_id": "bound-single", "samples": samples,
            })
            self.assertEqual(analysis.status_code, 200)
            self.assertEqual(analysis.get_json()["bank_revision"], workbench.BUILTIN_REVISION)
            evidence = {
                "schema_version": 1, "probe_id": "single-probe-export",
                **self.app.config["WORKBENCH_BINDINGS"][0],
                "bank_revision": analysis.get_json()["bank_revision"], "samples": samples,
            }
            self.assertEqual(self.post("/api/export", {
                "action_id": "single-export", "operation_id": "bound-single", "evidence": evidence,
            }).status_code, 200)
            control = self.app.extensions["modeltrace_workbench"]
            for session in control.sessions.values():
                session["collections"]["bound-single"]["bank_revision"] = "a" * 64
            self.assertEqual(self.post("/api/analyze", {
                "action_id": "single-stale-analysis", "operation_id": "bound-single", "samples": samples,
            }).status_code, 409)
            self.assertEqual(len(provider.posts), 1)


class WorkbenchLifecycleTest(unittest.TestCase):
    def test_container_wildcard_listen_requires_opt_in_and_loopback_operator_hosts(self):
        with tempfile.TemporaryDirectory(prefix="task-e-container-settings-") as temporary:
            root = Path(temporary)
            config = {
                "listen_host": "0.0.0.0", "listen_port": 18763,
                "hosts": ["127.0.0.1:18763"], "origins": [ORIGIN],
                "local_http": True, "bank_root": str(root / "banks"),
                "operations_root": str(root / "operations"), "state_root": str(root / "control"),
                "bindings": [], "daemon_url": "http://127.0.0.1:1",
                "interpreter_sha256": __import__("hashlib").sha256(
                    Path(sys.executable).read_bytes()).hexdigest(),
            }
            config_path = root / "config.json"
            installed = {}
            server = unittest.mock.Mock()
            server.handle_request.side_effect = lambda: installed[signal.SIGTERM]()

            def run(value):
                config_path.write_text(json.dumps(value))
                read_fd, write_fd = os.pipe()
                os.write(write_fd, b"synthetic-container-ingest-key-32bytes")
                os.close(write_fd)
                try:
                    return workbench.main(["--config", str(config_path),
                                           "--ingest-key-fd", str(read_fd)])
                finally:
                    try:
                        os.close(read_fd)
                    except OSError:
                        pass

            with patch("werkzeug.serving.make_server", return_value=server) as listen, \
                    patch.object(signal, "signal", side_effect=lambda sig, callback:
                                 installed.update({sig: callback})):
                self.assertEqual(run(config), 1)
                listen.assert_not_called()
                self.assertEqual(run({**config, "allow_container_listen": True}), 0)
                self.assertEqual(listen.call_args.args[:2], ("0.0.0.0", 18763))
                server.server_close.assert_called_once()
                listen.reset_mock()
                self.assertEqual(run({
                    **config, "allow_container_listen": True,
                    "hosts": ["remote.example:18763"], "origins": ["http://remote.example:18763"],
                }), 1)
                listen.assert_not_called()

    def test_explicit_main_starts_and_sigterm_releases_listener_and_state(self):
        with tempfile.TemporaryDirectory(prefix="task-e-lifecycle-") as temporary:
            root = Path(temporary)
            with socket.socket() as listener:
                listener.bind(("127.0.0.1", 0))
                port = listener.getsockname()[1]
            origin = "http://127.0.0.1:" + str(port)
            config = {
                "listen_host": "127.0.0.1", "listen_port": port,
                "hosts": ["127.0.0.1:" + str(port)], "origins": [origin],
                "local_http": True, "bank_root": str(root / "banks"),
                "operations_root": str(root / "operations"), "state_root": str(root / "control"),
                "bindings": [], "daemon_url": "http://127.0.0.1:1",
                "interpreter_sha256": __import__("hashlib").sha256(
                    Path(sys.executable).read_bytes()).hexdigest(),
            }
            config_path = root / "config.json"
            config_path.write_text(json.dumps(config))
            read_fd, write_fd = os.pipe()
            os.write(write_fd, b"synthetic-runtime-ingest-key-32bytes")
            os.close(write_fd)
            child = subprocess.Popen(
                [sys.executable, "-B", "-m", "modeltrace_runtime.workbench",
                 "--config", str(config_path), "--ingest-key-fd", str(read_fd)],
                cwd=ROOT, pass_fds=(read_fd,), stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                env={"PATH": "/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1",
                     "OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1"},
                start_new_session=True,
            )
            os.close(read_fd)
            try:
                import selectors
                with selectors.DefaultSelector() as selector:
                    selector.register(child.stdout, selectors.EVENT_READ)
                    self.assertTrue(selector.select(10), "explicit main did not become ready")
                self.assertEqual(child.stdout.readline(), b"modeltrace_workbench_ready\n",
                                 "explicit configured main is missing")
                child.send_signal(signal.SIGTERM)
                self.assertEqual(child.wait(timeout=15), 0)
                with socket.socket() as listener:
                    self.assertNotEqual(listener.connect_ex(("127.0.0.1", port)), 0)
                journal = workbench.ActionJournal(str(root / "control"))
                journal.close()
                with self.assertRaises(ChildProcessError):
                    os.waitpid(child.pid, os.WNOHANG)
            finally:
                if child.poll() is None:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait(timeout=5)
                child.stdout.close()
