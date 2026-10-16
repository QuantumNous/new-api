import copy
from contextlib import contextmanager
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


@contextmanager
def terminal_directory_failure(journal, identity):
    """Keep real file sync/replacement and fail only the terminal directory sync."""
    replace, fsync = os.replace, os.fsync
    events = []
    pending = False

    def actual_replace(source, destination, **kwargs):
        nonlocal pending
        result = replace(source, destination, **kwargs)
        if destination == "actions.json" and kwargs.get("dst_dir_fd") == journal.fd:
            descriptor = journal.open("actions.json", os.O_RDONLY)
            with os.fdopen(descriptor, "rb") as stream:
                entry = json.load(stream)["actions"].get(identity, {})
            if entry.get("status") == "terminal":
                events.append({"terminal_replaced": True, "http_status": entry["http_status"]})
                pending = True
        return result

    def terminal_fsync(descriptor):
        nonlocal pending
        if descriptor == journal.fd and pending:
            pending = False
            events.append({"terminal_directory_fsync_failed": True})
            raise OSError("controlled terminal journal directory sync failure")
        return fsync(descriptor)

    with patch.object(os, "replace", side_effect=actual_replace), \
            patch.object(os, "fsync", side_effect=terminal_fsync):
        yield events


@contextmanager
def first_terminal_write_failure(journal, transition):
    """Fail one real finish transition; callback and preceding intent are untouched."""
    finish, opened, fsync, replace = journal.finish, journal.open, os.fsync, os.replace
    active = failed = False

    def fail_once(name):
        nonlocal failed
        if active and not failed and name == transition:
            failed = True
            raise OSError("controlled first terminal " + transition)

    def terminal_finish(*args):
        nonlocal active
        active = True
        try:
            return finish(*args)
        finally:
            active = False

    def terminal_open(name, flags):
        if flags & os.O_CREAT:
            fail_once("create")
        return opened(name, flags)

    def terminal_sync(descriptor):
        fail_once("directory_fsync" if descriptor == journal.fd else "file_fsync")
        return fsync(descriptor)

    def terminal_replace(*args, **kwargs):
        fail_once("replace")
        return replace(*args, **kwargs)

    with patch.object(journal, "finish", side_effect=terminal_finish), \
            patch.object(journal, "open", side_effect=terminal_open), \
            patch.object(os, "fsync", side_effect=terminal_sync), \
            patch.object(os, "replace", side_effect=terminal_replace):
        yield
    if not failed:
        raise AssertionError("terminal failure transition was not reached")


class ActionJournalGuardTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="task-e-journal-i1-state-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "control"
        self.journal = workbench.ActionJournal(str(self.root))
        self.addCleanup(self.journal.close)
        self.session = {"owned": set()}
        self.parameters = {"generation": "builtin", "bank_revision": workbench.BUILTIN_REVISION}
        self.journal.begin("prior-safe", {}, "reload", self.session)
        self.journal.finish("prior-safe", {"safe": True}, 200)
        self.prior = self.journal.read()["actions"]["prior-safe"]

    def uncertain_terminal(self):
        self.journal.begin("uncertain", self.parameters, "publication", self.session)
        with terminal_directory_failure(self.journal, "uncertain"):
            with self.assertRaises(OSError):
                self.journal.finish("uncertain", {"summary": {"generation": "synthetic"}}, 200)
        return next(self.root.glob("pending-*.json"))

    def files(self):
        return {path.name: path.read_bytes() for path in self.root.iterdir() if path.is_file()}

    def test_guard_missing_between_terminal_and_retirement_never_acknowledges_success(self):
        self.journal.begin("uncertain", self.parameters, "publication", self.session)
        write = self.journal.write
        removed = False

        def lost_guard(state):
            nonlocal removed
            write(state)
            if not removed and state["actions"]["uncertain"]["status"] == "terminal":
                removed = True
                next(self.root.glob("pending-*.json")).unlink()

        with patch.object(self.journal, "write", side_effect=lost_guard):
            with self.assertRaises((OSError, workbench.RequestError)):
                self.journal.finish("uncertain", {"summary": {}}, 200)
        with self.assertRaises(workbench.RequestError):
            self.journal.read()
        raw = json.loads((self.root / "actions.json").read_bytes())
        self.assertEqual(raw["actions"]["prior-safe"], self.prior)

    def test_surviving_guard_veto_is_read_only_scoped_and_preserves_prior_receipts(self):
        guard = self.uncertain_terminal()
        before = self.files()
        self.assertEqual(self.journal.begin("prior-safe", {}, "reload", self.session),
                         ({"safe": True}, 200))
        self.assertEqual(self.journal.begin("uncertain", self.parameters, "publication", self.session),
                         ({"error": "restart_required"}, 503))
        for parameters, session, expected in (
                ({**self.parameters, "generation": "changed"}, self.session, 409),
                (self.parameters, {"owned": set()}, 404)):
            with self.assertRaises(workbench.RequestError) as error:
                self.journal.begin("uncertain", parameters, "publication", session)
            self.assertEqual(error.exception.status, expected)
        self.assertTrue(self.journal.publication_uncertain())
        self.assertEqual(self.files(), before)
        self.assertEqual(self.journal.read()["actions"]["prior-safe"], self.prior)
        self.journal.close()
        self.journal = workbench.ActionJournal(str(self.root))
        self.addCleanup(self.journal.close)
        self.assertEqual(self.files(), before)
        with self.assertRaises(workbench.RequestError) as error:
            self.journal.begin("new-publication", self.parameters, "publication", {"owned": set()})
        self.assertEqual(error.exception.code, "restart_required")
        # An unrelated kind may finish without replacing or retiring the old veto.
        fresh = {"owned": set()}
        self.journal.begin("unrelated-export", {}, "export", fresh)
        self.journal.finish("unrelated-export", {"probe_id": "synthetic"}, 200)
        self.assertEqual(guard.read_bytes(), before[guard.name])
        self.assertTrue(self.journal.publication_uncertain())
        self.assertEqual(self.journal.read()["actions"]["prior-safe"], self.prior)

    def test_invalid_or_missing_guard_fails_closed_without_recovery_writes(self):
        for mutation in ("corrupt", "oversize", "missing", "digest", "kind", "identity",
                         "symlink", "hardlink", "mode", "missing_actions"):
            with self.subTest(mutation=mutation):
                guard = self.uncertain_terminal()
                originals = self.files()
                if mutation == "missing":
                    guard.unlink()
                elif mutation == "corrupt":
                    guard.write_bytes(b"{")
                elif mutation == "oversize":
                    guard.write_bytes(b" " * 1025)
                elif mutation in ("digest", "kind", "identity"):
                    value = json.loads(guard.read_bytes())
                    key = {"identity": "action_id"}.get(mutation, mutation)
                    value[key] = {"digest": "0" * 64, "kind": "export",
                                  "identity": "prior-safe"}[mutation]
                    guard.write_text(json.dumps(value))
                elif mutation == "symlink":
                    guard.unlink()
                    guard.symlink_to(self.root / "actions.json")
                elif mutation == "hardlink":
                    os.link(guard, self.root / "guard-link")
                elif mutation == "mode":
                    guard.chmod(0o644)
                else:
                    (self.root / "actions.json").unlink()
                before = self.files()
                with self.assertRaises((OSError, ValueError, workbench.RequestError)):
                    self.journal.read()
                self.assertEqual(self.files(), before)
                self.journal.close()
                with self.assertRaises(workbench.RequestError):
                    workbench.ActionJournal(str(self.root))
                self.assertEqual(self.files(), before)
                for path in self.root.iterdir():
                    if path.name != "owner.lock":
                        path.unlink()
                for name, payload in originals.items():
                    if name != "owner.lock":
                        (self.root / name).write_bytes(payload)
                        (self.root / name).chmod(0o600)
                # Restore only this test's fixture, not through journal recovery.
                guard.unlink()
                state = json.loads((self.root / "actions.json").read_bytes())
                del state["actions"]["uncertain"]
                (self.root / "actions.json").write_text(json.dumps(state))
                self.journal = workbench.ActionJournal(str(self.root))
                self.addCleanup(self.journal.close)

    def test_retirement_failure_survives_restart_and_keeps_unknown_response(self):
        self.journal.begin("uncertain", self.parameters, "publication", self.session)
        unlink = os.unlink

        def retirement_failure(name, **kwargs):
            if name.startswith("pending-") and kwargs.get("dir_fd") == self.journal.fd:
                raise OSError("controlled retirement failure")
            return unlink(name, **kwargs)

        with patch.object(os, "unlink", side_effect=retirement_failure):
            with self.assertRaises(OSError):
                self.journal.finish("uncertain", {"summary": {}}, 200)
        before = self.files()
        self.assertEqual(self.journal.begin("uncertain", self.parameters, "publication", self.session),
                         ({"error": "restart_required"}, 503))
        self.journal.close()
        self.journal = workbench.ActionJournal(str(self.root))
        self.addCleanup(self.journal.close)
        self.assertTrue(self.journal.publication_uncertain())
        self.assertEqual(self.files(), before)

    def test_legacy_nonempty_history_is_quarantined_and_empty_history_usable(self):
        for status in ("intent", "terminal"):
            with self.subTest(status=status):
                self.journal.close()
                legacy = {"version": 1, "actions": {"legacy": {
                    "digest": "a" * 64, "kind": "publication", "status": status,
                    **({"response": {"summary": {}}, "http_status": 200}
                       if status == "terminal" else {}),
                }}}
                (self.root / "actions.json").write_text(json.dumps(legacy))
                before = self.files()
                with self.assertRaises(workbench.RequestError):
                    workbench.ActionJournal(str(self.root))
                self.assertEqual(self.files(), before)
        (self.root / "actions.json").write_text(json.dumps({"version": 1, "actions": {}}))
        self.journal = workbench.ActionJournal(str(self.root))
        self.addCleanup(self.journal.close)
        fresh = {"owned": set()}
        self.journal.begin("fresh", self.parameters, "publication", fresh)
        self.journal.finish("fresh", {"summary": {}}, 200)
        self.assertFalse(self.journal.publication_uncertain())

    def test_ordinary_success_retirement_restart_replay_and_next_action_remain_usable(self):
        self.journal.begin("success", self.parameters, "publication", self.session)
        response = {"summary": {"generation": "synthetic"}}
        self.journal.finish("success", response, 200)
        self.assertFalse(list(self.root.glob("pending-*.json")))
        before = self.files()
        self.assertEqual(self.journal.begin("success", self.parameters, "publication", self.session),
                         (response, 200))
        self.assertEqual(self.files(), before)
        self.journal.close()
        self.journal = workbench.ActionJournal(str(self.root))
        self.addCleanup(self.journal.close)
        self.assertFalse(self.journal.publication_uncertain())
        self.assertEqual(self.files(), before)
        fresh = {"owned": set()}
        self.journal.begin("next-action", self.parameters, "publication", fresh)
        self.journal.finish("next-action", {"summary": {}}, 200)
        self.assertEqual(self.journal.read()["actions"]["success"]["response"], response)
        self.assertEqual(self.journal.read()["actions"]["prior-safe"], self.prior)

    def test_retirement_preparation_failures_keep_independent_veto(self):
        for transition in ("create", "file_fsync", "replace", "directory_fsync"):
            with self.subTest(transition=transition):
                self.journal.begin("uncertain", self.parameters, "publication", self.session)
                write = self.journal.write
                fsync, replace, opened = os.fsync, os.replace, self.journal.open
                active = failed = False
                writes = 0

                def fail_once(name):
                    nonlocal failed
                    if active and not failed and name == transition:
                        failed = True
                        raise OSError("controlled retirement preparation " + transition)

                def retirement_write(state):
                    nonlocal active, writes
                    writes += 1
                    active = writes == 2
                    try:
                        return write(state)
                    finally:
                        active = False

                def retirement_open(name, flags):
                    if flags & os.O_CREAT:
                        fail_once("create")
                    return opened(name, flags)

                def retirement_sync(descriptor):
                    fail_once("directory_fsync" if descriptor == self.journal.fd else "file_fsync")
                    return fsync(descriptor)

                def retirement_replace(*args, **kwargs):
                    fail_once("replace")
                    return replace(*args, **kwargs)

                with patch.object(self.journal, "write", side_effect=retirement_write), \
                        patch.object(self.journal, "open", side_effect=retirement_open), \
                        patch.object(os, "fsync", side_effect=retirement_sync), \
                        patch.object(os, "replace", side_effect=retirement_replace):
                    with self.assertRaises(OSError):
                        self.journal.finish("uncertain", {"summary": {}}, 200)
                self.assertTrue(failed)
                before = self.files()
                self.assertEqual(self.journal.begin(
                    "uncertain", self.parameters, "publication", self.session),
                    ({"error": "restart_required"}, 503))
                self.assertEqual(self.journal.read()["actions"]["prior-safe"], self.prior)
                self.journal.close()
                self.journal = workbench.ActionJournal(str(self.root))
                self.addCleanup(self.journal.close)
                self.assertTrue(self.journal.publication_uncertain())
                self.assertEqual(self.files(), before)
                # Reset the controlled fixture only; production never clears this veto.
                next(self.root.glob("pending-*.json")).unlink()
                state = json.loads((self.root / "actions.json").read_bytes())
                del state["actions"]["uncertain"]
                self.journal.write(state)

    def test_changed_guard_at_final_retirement_boundary_is_not_deleted(self):
        self.journal.begin("uncertain", self.parameters, "publication", self.session)
        write = self.journal.write
        writes = 0

        def changed_guard(state):
            nonlocal writes
            write(state)
            writes += 1
            if writes == 2:
                guard = next(self.root.glob("pending-*.json"))
                value = json.loads(guard.read_bytes())
                value["digest"] = "0" * 64
                guard.write_text(json.dumps(value))

        with patch.object(self.journal, "write", side_effect=changed_guard):
            with self.assertRaises(workbench.RequestError):
                self.journal.finish("uncertain", {"summary": {}}, 200)
        self.assertEqual(len(list(self.root.glob("pending-*.json"))), 1)
        before = self.files()
        with self.assertRaises(workbench.RequestError):
            self.journal.read()
        self.assertEqual(self.files(), before)

    def test_crash_restored_guard_hides_only_completed_action_kind(self):
        self.journal.begin("success", self.parameters, "publication", self.session)
        response = {"summary": {}}
        guard_bytes = None
        guard_name = None
        unlink = os.unlink

        def capture_retired_guard(name, **kwargs):
            nonlocal guard_bytes, guard_name
            if name.startswith("pending-") and kwargs.get("dir_fd") == self.journal.fd:
                guard_name = name
                guard_bytes = (self.root / name).read_bytes()
            return unlink(name, **kwargs)

        with patch.object(os, "unlink", side_effect=capture_retired_guard):
            self.journal.finish("success", response, 200)
        self.journal.close()
        (self.root / guard_name).write_bytes(guard_bytes)
        (self.root / guard_name).chmod(0o600)
        before = self.files()
        self.journal = workbench.ActionJournal(str(self.root))
        self.addCleanup(self.journal.close)
        self.assertTrue(self.journal.publication_uncertain())
        self.assertEqual(self.journal.begin("prior-safe", {}, "reload", self.session),
                         ({"safe": True}, 200))
        self.assertEqual(self.journal.begin("success", self.parameters, "publication", self.session),
                         ({"error": "restart_required"}, 503))
        self.assertEqual(self.files(), before)


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

    def restart_workbench(self):
        self.app.extensions["modeltrace_workbench"].close()
        bank_root, operations_root = self.store.root, Path(self.temporary.name) / "operations"
        self.store._root_finalizer()
        self.operations.close()
        config = self.app.config.copy()
        self.store = BankStore(bank_root)
        self.addCleanup(self.store._root_finalizer)
        self.operations = Operations(operations_root)
        self.addCleanup(self.operations.close)
        self.app = workbench.create_app(self.store, object(), self.operations, self.export)
        self.app.config.update(config)
        self.addCleanup(self.app.extensions["modeltrace_workbench"].close)
        self.client = self.app.test_client()
        self.csrf = self.client.get("/api/session", base_url=ORIGIN).get_json()["csrf_token"]

    def test_terminal_directory_failure_vetoes_publication_replay_and_restart(self):
        before = self.store.summary()
        value = {"action_id": "terminal-uncertain", "bank_id": "custom", "label": "Custom",
                 "generation": before["generation"], "bank_revision": before["revision"]}
        control = self.app.extensions["modeltrace_workbench"]
        journal = control.journal(self.app)
        with terminal_directory_failure(journal, value["action_id"]) as events:
            initial = self.post("/api/banks", value)
        committed = self.store._load_manifest()
        raw = json.loads((Path(self.temporary.name) / "control/actions.json").read_bytes())
        replay = self.post("/api/banks", value)
        self.assertEqual(self.store._load_manifest(), committed)
        self.assertEqual(control.children, set())
        # No new owned ID here: its unknown receipt could mask the restart defect.
        self.restart_workbench()
        current = self.store.summary()
        fresh = self.post("/api/banks", {
            "action_id": "fresh-after-restart", "bank_id": "second", "label": "Second",
            "generation": current["generation"], "bank_revision": current["revision"],
        })
        after_fresh = self.store._load_manifest()
        reload_result = self.post("/api/banks/reload", {"action_id": "reload-after-restart"})
        old = self.post("/api/banks", value)
        print(json.dumps({"journal_i1_publication_observation": {
            "events": events, "initial": [initial.status_code, initial.get_json().get("error")],
            "readable_terminal_status": raw["actions"][value["action_id"]]["status"],
            "readable_terminal_http_status": raw["actions"][value["action_id"]].get("http_status"),
            "replay": [replay.status_code, replay.get_json().get("error")],
            "fresh_after_restart": [fresh.status_code, fresh.get_json().get("error")],
            "generation_before": committed["generation"],
            "generation_after": after_fresh["generation"],
        }}), flush=True)
        self.assertEqual(events, [{"terminal_replaced": True, "http_status": 200},
                                  {"terminal_directory_fsync_failed": True}])
        self.assertEqual(
            (initial.status_code, initial.get_json().get("error"),
             replay.status_code, replay.get_json().get("error"),
             fresh.status_code, fresh.get_json().get("error"),
             reload_result.status_code, reload_result.get_json().get("error"),
             old.status_code, after_fresh == committed),
            (503, "restart_required", 503, "restart_required", 503, "restart_required",
             503, "restart_required", 404, True),
        )

    def test_terminal_directory_failure_vetoes_export_replay_and_restart(self):
        evidence = {
            "schema_version": 1, "probe_id": "terminal-export-probe", "binding_id": BINDING,
            "claimed_model": "GPT-4o", "protocol": "chat",
            "bank_revision": workbench.BUILTIN_REVISION, "samples": reference_samples(1),
        }
        value = {"action_id": "terminal-export", "evidence": evidence}
        journal = self.app.extensions["modeltrace_workbench"].journal(self.app)
        with terminal_directory_failure(journal, value["action_id"]) as events:
            initial = self.post("/api/export", value)
        replay = self.post("/api/export", value)
        self.restart_workbench()
        fresh = self.post("/api/export", {
            "action_id": "fresh-export", "evidence": {**evidence, "probe_id": "fresh-probe"},
        })
        self.assertEqual(events, [{"terminal_replaced": True, "http_status": 200},
                                  {"terminal_directory_fsync_failed": True}])
        self.assertEqual(
            (initial.status_code, initial.get_json().get("error"),
             replay.status_code, replay.get_json().get("error"),
             fresh.status_code, fresh.get_json().get("error"), len(self.export.evidence)),
            (503, "write_unknown", 503, "write_unknown", 503, "write_unknown", 1),
        )

    def test_preterminal_guard_write_failures_preserve_intent_and_prior_receipts(self):
        for transition in ("create", "file_fsync", "replace", "directory_fsync"):
            with self.subTest(transition=transition):
                # Each branch has its own roots so an unknown receipt cannot mask another.
                with tempfile.TemporaryDirectory(prefix="task-e-journal-i1-guard-") as root:
                    store = BankStore(Path(root) / "banks")
                    operations = Operations(Path(root) / "operations")
                    app = workbench.create_app(store, object(), operations, self.export)
                    app.config.update(self.app.config)
                    app.config["WORKBENCH_STATE_ROOT"] = str(Path(root) / "control")
                    control = app.extensions["modeltrace_workbench"]
                    try:
                        client = app.test_client()
                        csrf = client.get("/api/session", base_url=ORIGIN).get_json()["csrf_token"]
                        headers = {"Origin": ORIGIN, "X-CSRF-Token": csrf}
                        prior = client.post("/api/banks/reload", base_url=ORIGIN,
                                            json={"action_id": "prior-safe"}, headers=headers)
                        before = store.summary()
                        value = {"action_id": "guard-failure", "bank_id": "custom",
                                 "label": "Custom", "generation": before["generation"],
                                 "bank_revision": before["revision"]}
                        journal = control.journal(app)
                        with first_terminal_write_failure(journal, transition):
                            initial = client.post("/api/banks", base_url=ORIGIN,
                                                  json=value, headers=headers)
                        committed = store._load_manifest()
                        raw = json.loads((Path(root) / "control/actions.json").read_bytes())
                        replay = client.post("/api/banks", base_url=ORIGIN,
                                             json=value, headers=headers)
                        self.assertEqual(initial.get_json(), {"error": "restart_required"})
                        self.assertEqual(replay.get_json(), {"error": "restart_required"})
                        self.assertEqual(raw["actions"]["prior-safe"]["response"], prior.get_json())
                        self.assertEqual(raw["actions"]["guard-failure"]["status"], "intent")
                        self.assertEqual(client.post(
                            "/api/banks/reload", base_url=ORIGIN, headers=headers,
                            json={"action_id": "prior-safe"}).get_json(), prior.get_json())
                        control.close()
                        store._root_finalizer()
                        operations.close()
                        store = BankStore(Path(root) / "banks")
                        operations = Operations(Path(root) / "operations")
                        restarted = workbench.create_app(store, object(), operations, self.export)
                        restarted.config.update(app.config)
                        control = restarted.extensions["modeltrace_workbench"]
                        client = restarted.test_client()
                        headers["X-CSRF-Token"] = client.get(
                            "/api/session", base_url=ORIGIN).get_json()["csrf_token"]
                        current = store.summary()
                        fresh = client.post("/api/banks", base_url=ORIGIN, headers=headers,
                                            json={**value, "action_id": "fresh", "bank_id": "second",
                                                  "generation": current["generation"],
                                                  "bank_revision": current["revision"]})
                        self.assertEqual(fresh.get_json(), {"error": "restart_required"})
                        self.assertEqual(store._load_manifest(), committed)
                    finally:
                        control.close()
                        operations.close()
                        store._root_finalizer()

    def test_successful_publication_and_export_replay_restart_and_next_action(self):
        before = self.store.summary()
        create = {"action_id": "success-before-restart", "bank_id": "custom",
                  "label": "Custom", "generation": before["generation"],
                  "bank_revision": before["revision"]}
        initial = self.post("/api/banks", create)
        self.assertEqual(initial.status_code, 200)
        committed = self.store._load_manifest()
        self.assertEqual(self.post("/api/banks", create).get_json(), initial.get_json())
        self.assertEqual(self.store._load_manifest(), committed)
        evidence = {
            "schema_version": 1, "probe_id": "successful-export-probe", "binding_id": BINDING,
            "claimed_model": "GPT-4o", "protocol": "chat",
            "bank_revision": self.store.summary()["revision"], "samples": reference_samples(1),
        }
        value = {"action_id": "successful-export", "evidence": evidence}
        exported = self.post("/api/export", value)
        self.assertEqual(exported.status_code, 200)
        self.assertEqual(self.post("/api/export", value).get_json(), exported.get_json())
        self.assertEqual(len(self.export.evidence), 1)
        control_root = Path(self.temporary.name) / "control"
        files = {path.name: path.read_bytes() for path in control_root.iterdir()}
        self.assertFalse(list(control_root.glob("pending-*.json")))
        self.restart_workbench()
        self.assertEqual(self.client.get("/api/banks", base_url=ORIGIN).status_code, 200)
        self.assertEqual({path.name: path.read_bytes() for path in control_root.iterdir()}, files)
        self.assertEqual(self.post("/api/banks", create).status_code, 404)
        self.assertEqual(self.post("/api/export", value).status_code, 404)
        current = self.store.summary()
        fresh = self.post("/api/banks", {
            **create, "action_id": "success-after-restart", "bank_id": "second",
            "generation": current["generation"], "bank_revision": current["revision"],
        })
        self.assertEqual(fresh.status_code, 200)
        self.assertNotEqual(self.store._load_manifest(), committed)
        fresh_export = self.post("/api/export", {
            "action_id": "new-export-after-restart",
            "evidence": {**evidence, "probe_id": "new-successful-probe",
                         "bank_revision": self.store.summary()["revision"]},
        })
        self.assertEqual(fresh_export.status_code, 200)
        self.assertEqual(len(self.export.evidence), 2)
        self.assertFalse(list(control_root.glob("pending-*.json")))
        self.assertEqual(self.app.extensions["modeltrace_workbench"].children, set())

    def test_get_after_unknown_does_not_recover_guard_or_rewrite_receipts(self):
        before = self.store.summary()
        value = {"action_id": "get-uncertain", "bank_id": "custom", "label": "Custom",
                 "generation": before["generation"], "bank_revision": before["revision"]}
        journal = self.app.extensions["modeltrace_workbench"].journal(self.app)
        with terminal_directory_failure(journal, value["action_id"]):
            self.assertEqual(self.post("/api/banks", value).status_code, 503)
        self.restart_workbench()
        control_root = Path(self.temporary.name) / "control"
        files = {path.name: path.read_bytes() for path in control_root.iterdir()}
        for path in ("/api/banks", "/api/bank?bank_id=custom"):
            response = self.client.get(path, base_url=ORIGIN)
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.get_json(), {"error": "restart_required"})
        self.assertEqual({path.name: path.read_bytes() for path in control_root.iterdir()}, files)

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
