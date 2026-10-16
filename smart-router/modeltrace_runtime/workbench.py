"""Independent ModelTrace operator factory and explicit runtime lifecycle."""

import copy
from functools import wraps
import base64
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import secrets
import signal
import stat
import subprocess
import sys
import tempfile
import threading
import time

from flask import Flask, g, has_request_context, jsonify, request, send_file
from werkzeug.exceptions import HTTPException

from modeltrace_runtime import engine, collection, export as numeric_export, numeric_rows
from modeltrace_runtime.bank_store import VENDOR_DATA
from modeltrace_runtime.operations import Operations, _identity, _view
from modeltrace_runtime.transport import OneShotTransport, _validate_target
from third_party.modeltrace.fingerprint import parse_numbers, generate_challenges
from urllib.parse import urlsplit


BUILTIN_REVISION = "f267d0513aa06981d024ec5394746fceddf44e4e8a75fa6bf8304255f4b32d6d"
BODY_LIMIT = 256 * 1024
SESSION_TTL = 900
RAW_LIMIT = 64 * 1024
ANALYSIS_TIMEOUT = 20
FIT_TIMEOUT = 120


def execute_owned(value, timeout, *, pass_fds=(), control=None):
    """Cancel a registered module child, then wait before releasing admission."""
    if control is None and has_request_context():
        control = g.get("workbench_control")
    payload = json.dumps(value, allow_nan=False, separators=(",", ":")).encode()
    if len(payload) > 40 * 1024 * 1024:
        raise RequestError("too_large", 413)
    child = None
    with tempfile.TemporaryFile() as output:
        try:
            child = subprocess.Popen(
                [sys.executable, "-B", "-m", "modeltrace_runtime.workbench", "--owned-child"],
                stdin=subprocess.PIPE, stdout=output, stderr=subprocess.DEVNULL,
                start_new_session=True, pass_fds=pass_fds,
                env={"PATH": "/usr/bin:/bin", "PYTHONNOUSERSITE": "1",
                     "PYTHONDONTWRITEBYTECODE": "1", "OPENBLAS_NUM_THREADS": "1",
                     "OMP_NUM_THREADS": "1", "VECLIB_MAXIMUM_THREADS": "1"},
                cwd=os.path.dirname(os.path.dirname(__file__)),
            )
            if control is not None:
                with control.lock:
                    if control.stopped:
                        raise RequestError("unavailable", 503)
                    control.children.add(child)
            child.communicate(payload, timeout=timeout)
            if child.returncode != 0 or output.tell() > 8 * 1024 * 1024:
                raise RequestError("execution_failed", 503)
            output.seek(0)
            result = strict_json(output.read(8 * 1024 * 1024 + 1))
            if type(result) is not dict:
                raise RequestError("execution_failed", 503)
            return result
        except subprocess.TimeoutExpired:
            raise RequestError("deadline_exceeded", 503) from None
        finally:
            if child is not None:
                if child.poll() is None:
                    os.killpg(child.pid, signal.SIGTERM)
                    try:
                        child.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(child.pid, signal.SIGKILL)
                        child.wait(timeout=5)
                if child.stdin is not None:
                    child.stdin.close()
                if control is not None:
                    with control.lock:
                        control.children.discard(child)


def owned_child():
    def cancelled(*_):
        raise SystemExit(1)

    signal.signal(signal.SIGTERM, cancelled)
    payload = sys.stdin.buffer.read(40 * 1024 * 1024 + 1)
    if len(payload) > 40 * 1024 * 1024:
        raise SystemExit(1)
    value = strict_json(payload)
    if value.get("kind") == "export_http":
        from modeltrace_runtime.export import _http_exchange
        result = _http_exchange(value)
    elif value.get("kind") == "analysis":
        result = engine.analyze_samples(value["samples"], value["bank"])
    elif value.get("kind") == "collection":
        operations = object.__new__(Operations)
        operations._root_fd = value["operations_fd"]
        operations._lease = operations._owner = None
        operations._pid = os.getpid()
        operations._poisoned = False
        operations._thread_lock = threading.RLock()
        transport = OneShotTransport(interpreter_sha256=value["interpreter_sha256"])
        transport._capability = tuple(value["capability"]) if value["capability"] else None
        transport._timeout = value["slot_timeout"]
        session = collection._CollectionSession(
            operations, value["operation_id"], transport, model_label=value["model_label"],
            family_id=value.get("family_id"), family_name=value.get("family_name"),
            bank_bytes=base64.b64decode(value["bank_bytes"]) if value.get("bank_bytes") else None,
        )
        # A completed last transport slot starts the independent local scoring budget.
        if value["action"] == "test":
            original_transport = transport.__call__

            class ScoringBoundTransport(OneShotTransport):
                def __call__(self, request):
                    response = original_transport(request)
                    self.calls += 1
                    if self.calls == 3 or response.get("_status") == "write_unknown":
                        signal.setitimer(signal.ITIMER_REAL, ANALYSIS_TIMEOUT)
                    return response

            bounded = object.__new__(ScoringBoundTransport)
            bounded.__dict__ = dict(transport.__dict__)
            bounded.calls = 0
            session.transport = bounded
        signal.signal(signal.SIGALRM, cancelled)
        try:
            if value["action"] == "probe":
                result = session._probe_once(value["target"], value["challenge"])
            elif value["action"] == "test":
                result = collection.test_model(value["target"], session, session.bank)
            else:
                result = collection.collect_rows(value["target"], session, value["sample_count"])
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
            operations.close()
    elif value.get("kind") == "publication":
        from modeltrace_runtime.bank_store import BankStore
        store = BankStore(value["bank_root"])
        try:
            snapshot = coherent_snapshot(store)
            if (snapshot["generation"], snapshot["revision"]) != (
                    value["generation"], value["bank_revision"]):
                result = {"error": "stale_bank"}
            elif value["action"] == "create":
                result = {"summary": store.create(value["bank_id"], value["label"])}
            elif value["action"] == "enroll":
                result = {"summary": store.enroll(value["bank_id"], value["rows"])}
            else:
                result = {"summary": store.rebuild()}
        finally:
            store._root_finalizer()
    else:
        raise SystemExit(1)
    output = json.dumps(result, allow_nan=False, separators=(",", ":")).encode()
    if len(output) > 8 * 1024 * 1024:
        raise SystemExit(1)
    sys.stdout.buffer.write(output)


class RequestError(Exception):
    def __init__(self, code, status=400):
        self.code = code
        self.status = status


def exact_fields(value, required, optional=()):
    if type(value) is not dict or not set(required) <= set(value) or set(value) - set(required) - set(optional):
        raise RequestError("invalid_request")


def strict_json(payload):
    def object_pairs(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError
            value[key] = item
        return value

    def constant(_):
        raise ValueError

    try:
        value = json.loads(payload.decode("utf-8", "strict"),
                           object_pairs_hook=object_pairs, parse_constant=constant)
        pending = [(value, 0)]
        while pending:
            item, depth = pending.pop()
            if depth > 12:
                raise ValueError
            if type(item) is float and not math.isfinite(item):
                raise ValueError
            if type(item) is dict:
                pending.extend((child, depth + 1) for child in item.values())
            elif type(item) is list:
                pending.extend((child, depth + 1) for child in item)
        return value
    except (ValueError, UnicodeError, RecursionError, OverflowError):
        raise RequestError("invalid_request") from None


def numeric_samples(value, *, outputs=False, require_eligible=True):
    if type(value) is not list or not 1 <= len(value) <= 3:
        raise RequestError("invalid_request")
    samples = []
    seen = set()
    for item in value:
        exact_fields(item, ("challenge_id", "expected_count", "text" if outputs else "numbers"))
        try:
            identity = _identity(item["challenge_id"])
        except (ValueError, TypeError):
            raise RequestError("invalid_request") from None
        count = item["expected_count"]
        if identity in seen or type(count) is not int or not 0 <= count <= 4096:
            raise RequestError("invalid_request")
        seen.add(identity)
        if outputs:
            text = item["text"]
            if type(text) is not str or len(text.encode("utf-8")) > RAW_LIMIT:
                raise RequestError("invalid_request")
            numbers = parse_numbers(text)
        else:
            numbers = item["numbers"]
        if type(numbers) is not list or len(numbers) > 4096 or any(
                type(number) is not int or not 1 <= number <= 355 for number in numbers):
            raise RequestError("invalid_request")
        samples.append({"challenge_id": identity, "expected_count": count,
                        "numbers": list(numbers)})
    if require_eligible and not any(len(item["numbers"]) >= max(
            80, (item["expected_count"] * 55 + 99) // 100) for item in samples):
        raise RequestError("no_eligible_samples")
    return samples


class WorkbenchControl:
    """Bounded local control identities, not remote administrator authentication."""

    def __init__(self):
        self.pid = os.getpid()
        self.sessions = {}
        self.lock = threading.RLock()
        self.admission = threading.Lock()
        self.stopped = False
        self.children = set()
        self.state = None

    def close(self):
        with self.lock:
            self.stopped = True
            self.sessions.clear()
            children = list(self.children)
        for child in children:
            if child.poll() is None:
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=5)
        with self.lock:
            self.children.difference_update(children)
            if self.state is not None:
                self.state.close()
                self.state = None

    def stop(self):
        with self.lock:
            self.stopped = True
            children = list(self.children)
        for child in children:
            try:
                if child.poll() is None:
                    os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

    def journal(self, app):
        with self.lock:
            if self.stopped or self.pid != os.getpid():
                raise RequestError("unavailable", 503)
            if self.state is None:
                self.state = ActionJournal(app.config.get("WORKBENCH_STATE_ROOT"))
            return self.state

    def session(self, *, bootstrap=False):
        now = time.monotonic()
        with self.lock:
            if self.stopped or self.pid != os.getpid():
                raise RequestError("unavailable", 503)
            self.sessions = {identity: value for identity, value in self.sessions.items()
                             if value["expires"] > now and value["last"] + 300 > now}
            identity = request.cookies.get("modeltrace_control", "")
            value = self.sessions.get(identity)
            if value is None:
                if not bootstrap:
                    raise RequestError("session_required", 401)
                if len(self.sessions) >= 32:
                    raise RequestError("capacity", 503)
                identity = secrets.token_hex(32)
                value = {"csrf": secrets.token_hex(32), "expires": now + SESSION_TTL,
                         "last": now, "owned": set(), "plans": {}, "probes": set(),
                         "collections": {}}
                self.sessions[identity] = value
            value["last"] = now
            return identity, value


class ActionJournal:
    """One process owner and fsynced safe action intents, never provider credentials."""

    def __init__(self, root):
        self.fd = self.lease = None
        path = Path(root) if type(root) is str else None
        if path is None or not path.is_absolute() or ".." in path.parts:
            raise RequestError("unavailable", 503)
        descriptor = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
        try:
            for index, component in enumerate(path.parts[1:]):
                if index == len(path.parts) - 2:
                    try:
                        os.mkdir(component, 0o700, dir_fd=descriptor)
                        os.fsync(descriptor)
                    except FileExistsError:
                        pass
                child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                                dir_fd=descriptor)
                os.close(descriptor)
                descriptor = child
            metadata = os.fstat(descriptor)
            if metadata.st_uid != os.getuid() or metadata.st_mode & 0o077:
                raise ValueError
            self.fd, descriptor = descriptor, None
            self.lease = self.open("owner.lock", os.O_RDWR | os.O_CREAT)
            fcntl.flock(self.lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.read()
        except Exception:
            self.close()
            raise RequestError("unavailable", 503) from None
        finally:
            if descriptor is not None:
                os.close(descriptor)

    def open(self, name, flags):
        descriptor = os.open(name, flags | os.O_NOFOLLOW | os.O_NONBLOCK,
                             mode=0o600, dir_fd=self.fd)
        metadata = os.fstat(descriptor)
        if (not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1
                or metadata.st_uid != os.getuid() or metadata.st_mode & 0o077):
            os.close(descriptor)
            raise ValueError
        return descriptor

    def guard(self, identity, entry):
        return {"version": 1, "action_id": identity,
                "digest": entry["digest"], "kind": entry["kind"]}

    def read_guard(self, identity):
        try:
            descriptor = self.open("pending-" + identity + ".json", os.O_RDONLY)
        except FileNotFoundError:
            return None
        with os.fdopen(descriptor, "rb") as stream:
            payload = stream.read(1025)
        if len(payload) > 1024:
            raise RequestError("unavailable", 503)
        value = strict_json(payload)
        exact_fields(value, ("version", "action_id", "digest", "kind"))
        if type(value["version"]) is not int or value["version"] != 1:
            raise RequestError("unavailable", 503)
        return value

    def read(self):
        guards = {name for name in os.listdir(self.fd) if name.startswith("pending-")}
        try:
            descriptor = self.open("actions.json", os.O_RDONLY)
        except FileNotFoundError:
            if guards:
                raise RequestError("unavailable", 503)
            return {"version": 2, "actions": {}}
        with os.fdopen(descriptor, "rb") as stream:
            payload = stream.read(8 * 1024 * 1024 + 1)
        if len(payload) > 8 * 1024 * 1024:
            raise RequestError("unavailable", 503)
        value = strict_json(payload)
        exact_fields(value, ("version", "actions"))
        if (type(value["version"]) is not int or value["version"] not in (1, 2)
                or type(value["actions"]) is not dict or len(value["actions"]) > 128):
            raise RequestError("unavailable", 503)
        # The old journal has no independent proof of terminal durability.
        if value["version"] == 1 and value["actions"]:
            raise RequestError("unavailable", 503)
        value["version"] = 2
        for identity, entry in value["actions"].items():
            _identity(identity)
            exact_fields(entry, ("digest", "kind", "status"),
                         ("response", "http_status", "precondition", "guard_pending"))
            if (type(entry["digest"]) is not str or not re.fullmatch("[0-9a-f]{64}", entry["digest"])
                    or entry["kind"] not in ("analysis", "collection", "publication", "export", "reload")
                    or entry["status"] not in ("intent", "terminal")
                    or ("guard_pending" in entry and entry["guard_pending"] is not True)
                    or (entry["status"] == "terminal" and (
                        type(entry.get("response")) is not dict
                        or type(entry.get("http_status")) is not int
                        or not 100 <= entry["http_status"] <= 599))):
                raise RequestError("unavailable", 503)
            guard = self.read_guard(identity)
            if guard is None:
                if entry.get("guard_pending"):
                    raise RequestError("unavailable", 503)
            else:
                if guard != self.guard(identity, entry):
                    raise RequestError("unavailable", 503)
                guards.discard("pending-" + identity + ".json")
                entry["guard_pending"] = True
        if guards:
            raise RequestError("unavailable", 503)
        return value

    def write(self, value):
        self.persist("actions.json", value)

    def persist(self, destination, value):
        payload = json.dumps(value, allow_nan=False, separators=(",", ":")).encode()
        if len(payload) > 8 * 1024 * 1024:
            raise RequestError("capacity", 503)
        name = ".action-" + secrets.token_hex(16)
        try:
            descriptor = self.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(name, destination, src_dir_fd=self.fd, dst_dir_fd=self.fd)
            os.fsync(self.fd)
        finally:
            try:
                os.unlink(name, dir_fd=self.fd)
            except FileNotFoundError:
                pass

    def begin(self, identity, parameters, kind, session):
        _identity(identity)
        digest = hashlib.sha256(json.dumps(parameters, sort_keys=True, allow_nan=False,
                                           separators=(",", ":")).encode()).hexdigest()
        state = self.read()
        entry = state["actions"].get(identity)
        if entry is not None:
            if identity not in session["owned"]:
                raise RequestError("not_found", 404)
            if entry["digest"] != digest or entry["kind"] != kind:
                raise RequestError("conflict", 409)
            if entry["status"] == "intent" or entry.get("guard_pending"):
                return ({"error": "restart_required" if kind == "publication" else "write_unknown"}, 503)
            return entry["response"], entry["http_status"]
        if len(state["actions"]) >= 128 or len(session["owned"]) >= 128:
            raise RequestError("capacity", 503)
        if kind in ("publication", "collection", "export") and any(
                item["kind"] == kind and (
                    item["status"] == "intent" or item.get("guard_pending")
                    or item.get("response", {}).get("error") in (
                        "write_unknown", "restart_required")
                    or item.get("response", {}).get("status") == "write_unknown")
                for item in state["actions"].values()):
            raise RequestError("restart_required" if kind == "publication" else "write_unknown", 503)
        state["actions"][identity] = {"digest": digest, "kind": kind, "status": "intent"}
        if kind == "publication":
            state["actions"][identity]["precondition"] = {
                key: parameters[key] for key in ("generation", "bank_revision")
            }
        self.write(state)
        session["owned"].add(identity)
        return None

    def finish(self, identity, response, status):
        state = self.read()
        entry = state["actions"][identity]
        if entry["status"] != "intent" or entry.get("guard_pending"):
            raise RequestError("unavailable", 503)
        guard = self.guard(identity, entry)
        name = "pending-" + identity + ".json"
        self.persist(name, guard)
        if self.read_guard(identity) != guard:
            raise RequestError("unavailable", 503)
        entry.update({
            "status": "terminal", "response": response, "http_status": status,
            "guard_pending": True,
        })
        self.write(state)
        # A missing veto is unsafe until the terminal receipt was fully synced.
        if self.read_guard(identity) != guard:
            raise RequestError("unavailable", 503)
        del entry["guard_pending"]
        self.write(state)
        # No post-unlink sync: a crash-restored veto remains conservative.
        if self.read_guard(identity) != guard:
            raise RequestError("unavailable", 503)
        os.unlink(name, dir_fd=self.fd)

    def publication_uncertain(self, active_identity=None):
        return any(identity != active_identity and item["kind"] == "publication" and (
            item["status"] == "intent" or item.get("guard_pending")
            or item.get("response", {}).get("error") == "restart_required")
            for identity, item in self.read()["actions"].items())

    def close(self):
        for field in ("lease", "fd"):
            descriptor = getattr(self, field)
            if descriptor is not None:
                os.close(descriptor)
                setattr(self, field, None)


def admitted(control):
    def decorate(handler):
        @wraps(handler)
        def exclusive(*args, **kwargs):
            if control.stopped or control.pid != os.getpid():
                raise RequestError("unavailable", 503)
            if not control.admission.acquire(blocking=False):
                raise RequestError("busy", 409)
            try:
                return handler(*args, **kwargs)
            finally:
                control.admission.release()
        return exclusive
    return decorate


def coherent_snapshot(store):
    with store._cache_lock:
        if store._write_uncertain:
            raise RuntimeError("restart_required")
        store._refresh_committed()
        summary = store.summary()
        bank, revision = store._current_bank()
        generation = store._committed_generation
        if generation == "builtin":
            if store._entry_exists(store._root_fd, "current.json"):
                raise ValueError("bank_changed")
            descriptor = os.open(VENDOR_DATA, store._directory_open_flags())
            try:
                payload = store._read_regular_file(descriptor, "unified_bank.json",
                                                   maximum=16 * 1024 * 1024)
            finally:
                os.close(descriptor)
            if hashlib.sha256(payload).hexdigest() != BUILTIN_REVISION:
                raise ValueError("bank_changed")
            if store._entry_exists(store._root_fd, "current.json"):
                raise ValueError("bank_changed")
        else:
            manifest = store._load_manifest()
            if manifest["generation"] != generation:
                raise ValueError("bank_changed")
            payload = store._read_artifact(manifest, manifest["bank"],
                                           maximum=16 * 1024 * 1024)
            if store._load_manifest() != manifest:
                raise ValueError("bank_changed")
        if (hashlib.sha256(payload).hexdigest() != revision
                or summary["revision"] != revision or summary["generation"] != generation):
            raise ValueError("bank_changed")
        return {
            "bank": copy.deepcopy(bank), "summary": copy.deepcopy(summary),
            "generation": generation, "revision": revision, "bank_bytes": payload,
        }


def create_app(bank_store, transport, operations, export_client):
    app = Flask(__name__, static_folder=None)
    app.config["MAX_CONTENT_LENGTH"] = BODY_LIMIT
    control = WorkbenchControl()
    app.extensions["modeltrace_workbench"] = control
    dependencies = {
        "bank_store": bank_store, "transport": transport, "operations": operations,
        "export_client": export_client,
    }
    app.extensions["modeltrace_dependencies"] = dependencies

    def action_response(identity, parameters, kind, callback):
        try:
            _identity(identity)
        except (ValueError, TypeError):
            raise RequestError("invalid_request") from None
        if control.stopped or control.pid != os.getpid():
            raise RequestError("unavailable", 503)
        if not control.admission.acquire(blocking=False):
            raise RequestError("busy", 409)
        try:
            journal = control.journal(app)
            replay = journal.begin(identity, parameters, kind, g.control_session)
            if replay is not None:
                return jsonify(replay[0]), replay[1]
            g.active_action = identity
            try:
                result, status = callback()
            except RequestError as error:
                result, status = {"error": error.code}, error.status
                if kind == "publication" and error.code != "stale_bank":
                    bank_store._write_uncertain = True
                    result, status = {"error": "restart_required"}, 503
            except Exception:
                if kind == "publication":
                    bank_store._write_uncertain = True
                result, status = {
                    "error": "restart_required" if kind == "publication" else "write_unknown"
                }, 503
            try:
                journal.finish(identity, result, status)
            except Exception:
                if kind == "publication":
                    bank_store._write_uncertain = True
                result, status = {
                    "error": "restart_required" if kind == "publication" else "write_unknown"
                }, 503
            return jsonify(result), status
        finally:
            control.admission.release()

    def scoring_snapshot():
        if control.journal(app).publication_uncertain(g.get("active_action")):
            raise RequestError("restart_required", 503)
        try:
            return coherent_snapshot(bank_store)
        except RuntimeError:
            raise RequestError("restart_required", 503) from None
        except Exception:
            raise RequestError("bank_changed", 503) from None

    def owned_record(identity):
        if identity not in g.control_session["owned"]:
            raise RequestError("not_found", 404)
        try:
            with operations._locked():
                record = operations._read()["operations"].get(identity)
                if record is None:
                    raise RequestError("not_found", 404)
                result = _view(record)
            if result["status"] == "running" and not control.children:
                result["status"] = "write_unknown"
            return result
        except (ValueError, OSError):
            raise RequestError("unavailable", 503) from None

    @app.before_request
    def security_boundary():
        hosts = app.config.get("WORKBENCH_HOSTS", ())
        origins = app.config.get("WORKBENCH_ORIGINS", ())
        host = request.environ.get("HTTP_HOST", "")
        origin = request.headers.get("Origin")
        site = request.headers.get("Sec-Fetch-Site")
        if (type(hosts) not in (tuple, list) or type(origins) not in (tuple, list)
                or not hosts or not origins or host not in hosts
                or site not in (None, "none", "same-origin")
                or (origin is not None and origin not in origins)):
            raise RequestError("forbidden", 403)
        if request.scheme == "http":
            if not app.config.get("WORKBENCH_LOCAL_HTTP") or not re.fullmatch(
                    r"127\.0\.0\.1:[0-9]{1,5}|\[::1\]:[0-9]{1,5}", host):
                raise RequestError("forbidden", 403)
        elif request.scheme != "https":
            raise RequestError("forbidden", 403)
        # A browser POST without Origin must explicitly identify same-origin Fetch Metadata.
        if request.method == "POST" and origin is None and site != "same-origin":
            raise RequestError("forbidden", 403)
        if request.path.startswith("/api/"):
            g.workbench_control = control
            g.control_id, g.control_session = control.session(
                bootstrap=request.path == "/api/session" and request.method == "GET")
        if request.method == "POST":
            if not request.path.startswith("/api/"):
                raise RequestError("invalid_request")
            if not secrets.compare_digest(request.headers.get("X-CSRF-Token", ""),
                                          g.control_session["csrf"]):
                raise RequestError("forbidden", 403)
            if request.mimetype != "application/json":
                raise RequestError("invalid_request")
            if request.content_length is not None and request.content_length > BODY_LIMIT:
                raise RequestError("too_large", 413)
            payload = request.stream.read(BODY_LIMIT + 1)
            if len(payload) > BODY_LIMIT:
                raise RequestError("too_large", 413)
            g.input = strict_json(payload)

    @app.after_request
    def security_headers(response):
        response.headers.update({
            "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
            "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; script-src 'self'; "
                "style-src 'self'; connect-src 'self'; img-src 'self'; "
                "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
        })
        return response

    @app.errorhandler(RequestError)
    def request_error(error):
        return jsonify({"error": error.code}), error.status

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify({"error": "too_large" if error.code == 413 else "invalid_request"}), error.code

    @app.errorhandler(Exception)
    def unexpected_error(_):
        return jsonify({"error": "unavailable"}), 503

    @app.get("/")
    def operator_page():
        return send_file(Path(__file__).parent / "web/index.html", mimetype="text/html")

    @app.get("/assets/app.js")
    def operator_script():
        return send_file(Path(__file__).parent / "web/app.js", mimetype="text/javascript")

    @app.get("/static-manual/")
    @app.get("/static-manual/<path:name>")
    def manual_asset(name="index.html"):
        allowed = {
            "index.html": "text/html", "pages-app.js": "text/javascript",
            "fingerprint-core.js": "text/javascript", "challenge-browser.js": "text/javascript",
            "styles.css": "text/css", "repository-link.css": "text/css",
            "data/unified_bank.json": "application/json",
        }
        if name not in allowed:
            raise RequestError("not_found", 404)
        return send_file(Path(__file__).parent / "static-manual" / name,
                         mimetype=allowed[name])

    @app.get("/api/session")
    def session_bootstrap():
        try:
            bindings = app.config.get("WORKBENCH_BINDINGS", ())
            if type(bindings) not in (list, tuple) or len(bindings) > 128:
                raise ValueError
            bindings = [numeric_export.binding_metadata(value) for value in bindings]
        except (ValueError, TypeError, KeyError):
            raise RequestError("unavailable", 503) from None
        response = jsonify({"csrf_token": g.control_session["csrf"],
                            "expires_in": max(0, int(g.control_session["expires"] - time.monotonic())),
                            "scope": "independent_local_operator",
                            "bindings": bindings})
        response.set_cookie("modeltrace_control", g.control_id, max_age=SESSION_TTL,
                            secure=request.scheme == "https", httponly=True,
                            samesite="Strict", path="/")
        return response

    @app.get("/api/challenges")
    def challenges():
        session = g.control_session
        if len(session["plans"]) >= 8:
            raise RequestError("capacity", 503)
        identity = secrets.token_hex(16)
        plan = generate_challenges(3)
        session["plans"][identity] = plan
        return jsonify({"challenge_set_id": identity, "challenges": plan})

    @app.post("/api/analyze")
    def analyze():
        value = g.input
        exact_fields(value, ("action_id",), ("outputs", "samples", "operation_id"))
        try:
            _identity(value["action_id"])
        except (ValueError, TypeError):
            raise RequestError("invalid_request") from None
        if ("outputs" in value) == ("samples" in value):
            raise RequestError("invalid_request")
        samples = numeric_samples(value.get("outputs", value.get("samples")),
                                  outputs="outputs" in value)
        collection_metadata = None
        if "operation_id" in value:
            identity = value["operation_id"]
            if type(identity) is not str or "outputs" in value:
                raise RequestError("invalid_request")
            collection_metadata = g.control_session["collections"].get(identity)
            record = owned_record(identity)
            committed = {
                slot: entry["result"] for slot, entry in record["slots"].items()
                if entry.get("result", {}).get("eligible")
            }
            if collection_metadata is None or any(
                    sample["challenge_id"] not in committed or any(
                        sample[field] != committed[sample["challenge_id"]][field]
                        for field in ("numbers", "expected_count")) for sample in samples):
                raise RequestError("conflict", 409)
        def execute():
            snapshot = scoring_snapshot()
            if collection_metadata is not None and (
                    snapshot["revision"] != collection_metadata["bank_revision"]):
                raise RequestError("stale_bank", 409)
            analysis = execute_owned({"kind": "analysis", "samples": samples,
                                      "bank": snapshot["bank"]}, ANALYSIS_TIMEOUT)
            return {
                "analysis": analysis, "samples": samples,
                "bank_revision": snapshot["revision"], "generation": snapshot["generation"],
                "assessment": "inconclusive",
            }, 200
        parameters = {"samples": samples}
        if "operation_id" in value:
            parameters["operation_id"] = value["operation_id"]
        return action_response(value["action_id"], parameters, "analysis", execute)

    @app.post("/api/export")
    def export():
        value = g.input
        exact_fields(value, ("action_id", "evidence"), ("operation_id",))
        try:
            numeric_export.validate_evidence(value["evidence"])
            evidence = copy.deepcopy(value["evidence"])
            metadata = {key: evidence[key] for key in ("binding_id", "claimed_model", "protocol")}
            if metadata not in app.config.get("WORKBENCH_BINDINGS", ()):
                raise ValueError
        except (ValueError, TypeError, KeyError, UnicodeError):
            raise RequestError("invalid_request") from None
        if "operation_id" in value:
            identity = value["operation_id"]
            if type(identity) is not str:
                raise RequestError("invalid_request")
            metadata = g.control_session["collections"].get(identity)
            record = owned_record(identity)
            committed = {
                slot: entry["result"] for slot, entry in record["slots"].items()
                if entry.get("result", {}).get("eligible")
            }
            if (metadata is None or evidence["protocol"] != metadata["protocol"]
                    or evidence["claimed_model"] != metadata["claimed_model"]
                    or evidence["bank_revision"] != metadata["bank_revision"]
                    or any(sample["challenge_id"] not in committed or any(
                        sample[field] != committed[sample["challenge_id"]][field]
                        for field in ("numbers", "expected_count"))
                        for sample in evidence["samples"])):
                raise RequestError("conflict", 409)
        probe_id = evidence["probe_id"]
        if probe_id in g.control_session["probes"] and value["action_id"] not in g.control_session["owned"]:
            raise RequestError("conflict", 409)

        def execute():
            g.control_session["probes"].add(probe_id)
            return dependencies["export_client"].submit(evidence), 200
        return action_response(value["action_id"], evidence, "export", execute)

    @app.get("/api/probes/<probe_id>")
    @admitted(control)
    def probe_readback(probe_id):
        if probe_id not in g.control_session["probes"]:
            raise RequestError("not_found", 404)
        # Signed readback has a hard I/O child deadline but is not a new POST action.
        return jsonify(dependencies["export_client"].get(probe_id))

    @app.get("/api/banks")
    def banks():
        return jsonify(scoring_snapshot()["summary"])

    @app.get("/api/bank")
    def bank_summary():
        if set(request.args) != {"bank_id"} or len(request.args.getlist("bank_id")) != 1:
            raise RequestError("invalid_request")
        summary = scoring_snapshot()["summary"]
        family = next((item for item in summary["families"] if item["id"] == request.args["bank_id"]), None)
        if family is None:
            raise RequestError("not_found", 404)
        return jsonify({"family": family, "generation": summary["generation"],
                        "bank_revision": summary["revision"],
                        "models": [item for item in summary["models"] if item["family"] == family["id"]]})

    @app.get("/api/operations/<identity>")
    def operation_status(identity):
        return jsonify(owned_record(identity))

    @app.post("/api/test/probe")
    @app.post("/api/test/auto")
    @app.post("/api/enroll/auto")
    def collect():
        value = g.input
        action = "probe" if request.path.endswith("/probe") else (
            "enroll" if request.path.startswith("/api/enroll/") else "test")
        required = ["operation_id", "target", "model_label"]
        if action == "probe":
            required.extend(("challenge_set_id", "challenge_id"))
        if action == "enroll":
            required.extend(("family_id", "family_name", "sample_count"))
        exact_fields(value, required)
        try:
            _identity(value["operation_id"])
            numeric_export.safe_label(value["model_label"])
            wire_transport = dependencies["transport"]
            if not isinstance(wire_transport, OneShotTransport):
                raise ValueError
            target = _validate_target(value["target"], wire_transport._capability)
            if action == "enroll":
                if type(value["sample_count"]) is not int or not 3 <= value["sample_count"] <= 36:
                    raise ValueError
                if not re.fullmatch("[a-z0-9][a-z0-9-]{0,63}", value["family_id"]):
                    raise ValueError
                numeric_export.safe_label(value["family_name"])
        except (ValueError, TypeError, KeyError):
            raise RequestError("invalid_request") from None
        count = value["sample_count"] if action == "enroll" else (1 if action == "probe" else 3)
        challenge = None
        if action == "probe":
            plan = g.control_session["plans"].get(value["challenge_set_id"], ())
            challenge = next((item for item in plan if item["id"] == value["challenge_id"]), None)
            if challenge is None:
                raise RequestError("invalid_request")

        def execute():
            snapshot = scoring_snapshot() if action in ("test", "probe") else None
            g.control_session["collections"][value["operation_id"]] = {
                "protocol": "chat" if target["api_format"] == "openai" else "messages",
                "claimed_model": value["model_label"],
                "bank_revision": snapshot["revision"] if snapshot else None,
            }
            envelope = {
                **value, "kind": "collection", "action": action, "target": target,
                "operations_fd": operations._root_fd, "interpreter_sha256": wire_transport._pin,
                "capability": wire_transport._capability, "slot_timeout": wire_transport._timeout,
                "sample_count": count, "challenge": challenge,
                "bank_bytes": base64.b64encode(snapshot["bank_bytes"]).decode() if snapshot else None,
            }
            try:
                result = execute_owned(envelope, wire_transport._timeout * count + ANALYSIS_TIMEOUT,
                                       pass_fds=(operations._root_fd,))
            except RequestError:
                result = owned_record(value["operation_id"])
                result["status"] = "write_unknown"
            result["complete"] = result.get("complete", False) and result.get("status") == "succeeded"
            if "analysis" in result:
                result["assessment"] = "inconclusive"
            return result, 200
        return action_response(value["operation_id"], value, "collection", execute)

    @app.post("/api/banks")
    @app.post("/api/banks/<bank_id>/enroll")
    @app.post("/api/banks/rebuild")
    def publish(bank_id=None):
        value = g.input
        action = "create" if request.path == "/api/banks" else (
            "enroll" if bank_id is not None else "rebuild")
        required = ["action_id", "generation", "bank_revision"]
        if action == "create":
            required.extend(("bank_id", "label"))
        exact_fields(value, required, ("rows", "operation_id") if action == "enroll" else ())
        if (type(value["generation"]) is not str or not 1 <= len(value["generation"]) <= 128
                or type(value["bank_revision"]) is not str
                or not re.fullmatch("[0-9a-f]{64}", value["bank_revision"])):
            raise RequestError("invalid_request")
        destination = value["bank_id"] if action == "create" else bank_id
        if destination is not None and (
                type(destination) is not str or not re.fullmatch("[a-z0-9][a-z0-9-]{0,63}", destination)
                or destination in ("gpt", "claude", "unified")):
            raise RequestError("invalid_request")
        rows = None
        if action == "create":
            try:
                numeric_export.safe_label(value["label"])
            except (ValueError, TypeError, UnicodeError):
                raise RequestError("invalid_request") from None
        if action == "enroll":
            if ("rows" in value) == ("operation_id" in value):
                raise RequestError("invalid_request")
            if "operation_id" in value:
                record = owned_record(value["operation_id"])
                if record["status"] != "succeeded":
                    raise RequestError("collection_incomplete", 409)
                rows = [entry["result"]["row"] for entry in record["slots"].values()
                        if entry.get("result", {}).get("row", {}).get("strict_valid")]
            else:
                rows = value["rows"]
            if type(rows) is not list or not 1 <= len(rows) <= 36:
                raise RequestError("invalid_request")
            normalized = []
            for row in rows:
                exact_fields(row, ("row_id", "source", "condition_id", "challenge_id",
                                  "expected_count", "numbers"),
                             ("family_id", "family_name", "nuisance_condition_id", "time",
                              "counts", "strict_valid") if "operation_id" in value else (
                                  "family_id", "family_name", "nuisance_condition_id", "time"))
                try:
                    item = numeric_rows.normalize_row(row)
                    numeric_export.safe_label(item["source"])
                    if not item["strict_valid"]:
                        raise ValueError
                    normalized.append(item)
                except (ValueError, TypeError):
                    raise RequestError("invalid_request") from None
            rows = normalized

        def execute():
            snapshot = scoring_snapshot()
            if (snapshot["generation"], snapshot["revision"]) != (
                    value["generation"], value["bank_revision"]):
                raise RequestError("stale_bank", 409)
            result = execute_owned({
                **value, "kind": "publication", "action": action,
                "bank_root": str(bank_store.root), "bank_id": destination, "rows": rows,
            }, FIT_TIMEOUT)
            if result.get("error") == "stale_bank":
                raise RequestError("stale_bank", 409)
            if "summary" not in result:
                raise RequestError("restart_required", 503)
            current = coherent_snapshot(bank_store)["summary"]
            if current != result["summary"]:
                raise RequestError("restart_required", 503)
            return result, 200
        parameters = {**value, "bank_id": destination}
        if rows is not None:
            parameters["rows"] = rows
        return action_response(value["action_id"], parameters, "publication", execute)

    @app.post("/api/banks/reload")
    def reload_bank():
        value = g.input
        exact_fields(value, ("action_id",))
        return action_response(value["action_id"], {}, "reload",
                               lambda: ({"summary": scoring_snapshot()["summary"]}, 200))

    return app


def main(argv=None):
    """Explicit trusted settings and owned lifecycle; never Flask auto-discovery."""
    import argparse
    import ipaddress
    from modeltrace_runtime.bank_store import BankStore
    from werkzeug.serving import WSGIRequestHandler, make_server

    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--ingest-key-fd", required=True, type=int)
    args = parser.parse_args(argv)
    store = operations = server = app = None
    try:
        descriptor = os.open(args.config, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(descriptor, "rb") as stream:
            metadata = os.fstat(stream.fileno())
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > BODY_LIMIT:
                raise ValueError
            settings = strict_json(stream.read(BODY_LIMIT + 1))
        exact_fields(settings, (
            "listen_host", "listen_port", "hosts", "origins", "local_http",
            "bank_root", "operations_root", "state_root", "bindings", "daemon_url",
            "interpreter_sha256",
        ), ("tls_certificate", "tls_private_key", "allow_container_listen"))
        address = ipaddress.ip_address(settings["listen_host"])
        port = settings["listen_port"]
        if type(port) is not int or not 1 <= port <= 65535 or type(settings["local_http"]) is not bool:
            raise ValueError
        if (type(settings["hosts"]) is not list or not 1 <= len(settings["hosts"]) <= 8
                or type(settings["origins"]) is not list or not 1 <= len(settings["origins"]) <= 8):
            raise ValueError
        scheme = "http" if settings["local_http"] else "https"
        tls = None
        container_listen = settings.get("allow_container_listen", False)
        if type(container_listen) is not bool:
            raise ValueError
        if settings["local_http"]:
            if (not (address.is_loopback or container_listen and address.is_unspecified)
                    or "tls_certificate" in settings or "tls_private_key" in settings):
                raise ValueError
            if any(type(host) is not str or not re.fullmatch(
                    r"127\.0\.0\.1:[0-9]{1,5}|\[::1\]:[0-9]{1,5}", host)
                    for host in settings["hosts"]):
                raise ValueError
        else:
            if container_listen:
                raise ValueError
            tls = (settings["tls_certificate"], settings["tls_private_key"])
        for origin in settings["origins"]:
            parsed = urlsplit(origin)
            if (parsed.scheme != scheme or parsed.netloc not in settings["hosts"]
                    or parsed.path or parsed.query or parsed.fragment
                    or parsed.username is not None or parsed.password is not None
                    or origin != scheme + "://" + parsed.netloc):
                raise ValueError
        for host in settings["hosts"]:
            if (type(host) is not str or not host or len(host) > 255
                    or any(character in host for character in "/\\@*?#")
                    or any(ord(character) <= 32 or ord(character) >= 127 for character in host)):
                raise ValueError
        if type(settings["bindings"]) is not list or len(settings["bindings"]) > 128:
            raise ValueError
        bindings = [numeric_export.binding_metadata(value) for value in settings["bindings"]]
        transport = OneShotTransport(interpreter_sha256=settings["interpreter_sha256"])
        if args.ingest_key_fd < 3:
            raise ValueError
        with os.fdopen(args.ingest_key_fd, "rb") as stream:
            ingest_key = stream.read(4097)
        client = numeric_export.ExportClient(settings["daemon_url"], ingest_key)
        ingest_key = None
        store = BankStore(settings["bank_root"])
        operations = Operations(settings["operations_root"])
        app = create_app(store, transport, operations, client)
        app.config.update(
            WORKBENCH_HOSTS=tuple(settings["hosts"]), WORKBENCH_ORIGINS=tuple(settings["origins"]),
            WORKBENCH_LOCAL_HTTP=settings["local_http"], WORKBENCH_BINDINGS=tuple(bindings),
            WORKBENCH_STATE_ROOT=settings["state_root"],
        )
        control = app.extensions["modeltrace_workbench"]
        control.journal(app)

        class QuietRequestHandler(WSGIRequestHandler):
            def log(self, *args, **kwargs):
                pass

        server = make_server(settings["listen_host"], port, app, threaded=True,
                             request_handler=QuietRequestHandler, ssl_context=tls)
        server.daemon_threads = False
        server.block_on_close = True
        server.timeout = .25
        stopped = threading.Event()

        def terminate(*_):
            stopped.set()
            control.stop()

        signal.signal(signal.SIGTERM, terminate)
        signal.signal(signal.SIGINT, terminate)
        print("modeltrace_workbench_ready", flush=True)
        while not stopped.is_set():
            server.handle_request()
        return 0
    except Exception:
        return 1
    finally:
        if app is not None:
            app.extensions["modeltrace_workbench"].stop()
        if server is not None:
            server.server_close()
        if app is not None:
            app.extensions["modeltrace_workbench"].close()
        if operations is not None:
            operations.close()
        if store is not None:
            store._root_finalizer()


if __name__ == "__main__":
    if sys.argv[1:] == ["--owned-child"]:
        owned_child()
    else:
        raise SystemExit(main())
