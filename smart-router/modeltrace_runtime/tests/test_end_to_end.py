"""Real synthetic provider flow; no provider material crosses numeric ingress."""

import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import unittest

from modeltrace_runtime.collection import _CollectionSession, test_model
from modeltrace_runtime.export import ExportClient, validate_evidence
from modeltrace_runtime.operations import Operations
from modeltrace_runtime.transport import OneShotTransport


ROOT = Path(__file__).resolve().parents[2]
BANK = ROOT / "third_party/modeltrace/data/unified_bank.json"
PROVIDER_KEY = "synthetic-f-provider-key-sentinel"
RAW_SENTINEL = "synthetic-f-provider-body-sentinel"
INGEST = b"synthetic-f-independent-numeric-ingest-000"


class SyntheticProvider:
    def __init__(self, protocol="openai", mode="complete"):
        self.protocol, self.mode = protocol, mode
        self.posts = []
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_POST(self):
                payload = self.rfile.read(int(self.headers["Content-Length"]))
                owner.posts.append((self.path, dict(self.headers), json.loads(payload)))
                if owner.mode == "unknown":
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                    return
                text = RAW_SENTINEL + " " + ",".join(["3", "2", "3"] * 110)
                partial = (owner.mode == "partial" and len(owner.posts) == 2
                           or owner.mode == "inconclusive")
                if owner.protocol == "openai":
                    body = {"choices": [{
                        "message": {"content": text},
                        "finish_reason": "length" if partial else "stop",
                    }]}
                else:
                    body = {"content": [{"type": "text", "text": text}],
                            "stop_reason": "max_tokens" if partial else "end_turn"}
                data = json.dumps(body).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(3)
        if self.thread.is_alive():
            raise AssertionError("synthetic provider thread was not reaped")

    def target(self):
        return {
            "base_url": "http://127.0.0.1:" + str(self.server.server_port),
            "api_model": "synthetic-model", "api_key": PROVIDER_KEY,
            "api_format": self.protocol,
        }

    def transport(self):
        return OneShotTransport._for_test(self.server.socket)


def collect(provider, root, operation_id):
    root = root.resolve()
    root.mkdir(mode=0o700, exist_ok=True)
    bank_bytes = BANK.read_bytes()
    transport = provider.transport()
    with Operations(root / "ledger") as operations:
        session = _CollectionSession(
            operations, operation_id, transport, model_label="GPT-4o",
            bank_bytes=bank_bytes,
        )
        result = test_model(provider.target(), session, json.loads(bank_bytes))
    if transport.last_child_pid is not None:
        try:
            os.waitpid(transport.last_child_pid, os.WNOHANG)
        except ChildProcessError:
            pass
        else:
            raise AssertionError("one-shot provider child was not reaped")
    return result


def evidence_for(result, probe_id, protocol="chat"):
    return {
        "schema_version": 1, "probe_id": probe_id,
        "binding_id": "bnd_" + ("A" if protocol == "chat" else "C") * 24,
        "claimed_model": "GPT-4o", "protocol": protocol,
        "bank_revision": result["bank_revision"],
        "samples": [
            {"challenge_id": identity,
             "expected_count": entry["result"]["expected_count"],
             "numbers": entry["result"]["numbers"] if entry["result"]["eligible"] else []}
            for identity, entry in result["slots"].items()
            if "result" in entry
        ],
    }


class EndToEndTests(unittest.TestCase):
    def test_real_protocol_collection_worker_and_historical_replay(self):
        for protocol in ("openai", "anthropic"):
            with self.subTest(protocol=protocol), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                with SyntheticProvider(protocol) as provider:
                    result = collect(provider, root, "complete-operation")
                    self.assertEqual(result["status"], "succeeded")
                    self.assertEqual(len(provider.posts), 3)
                    self.assertEqual(len({item["slot_id"] for item in result["plan"]}), 3)
                    self.assertEqual(len({post[2]["messages"][-1]["content"]
                                          for post in provider.posts}), 3)
                    path = "/v1/chat/completions" if protocol == "openai" else "/v1/messages"
                    key_header = "Authorization" if protocol == "openai" else "x-api-key"
                    for target, headers, _ in provider.posts:
                        self.assertEqual(target, path)
                        self.assertIn(PROVIDER_KEY, headers[key_header])
                    replay = collect(provider, root, "complete-operation")
                    self.assertEqual(replay, result)
                    self.assertEqual(len(provider.posts), 3)
                    evidence = evidence_for(result, "worker-probe",
                                            "chat" if protocol == "openai" else "messages")
                    payload = validate_evidence(evidence)
                    request = {key: evidence[key] for key in (
                        "schema_version", "bank_revision", "samples")}
                    child = subprocess.run(
                        [sys.executable, "-B", "-m", "modeltrace_runtime.worker"],
                        cwd=ROOT, input=json.dumps(request).encode(), capture_output=True,
                        timeout=20, env={
                            "PATH": "/usr/bin:/bin", "LANG": "C",
                            "SMART_ROUTER_MODELTRACE_BANK": str(BANK),
                            "PYTHONDONTWRITEBYTECODE": "1", "OPENBLAS_NUM_THREADS": "1",
                        },
                    )
                    self.assertEqual(child.returncode, 0)
                    self.assertEqual(child.stderr, b"")
                    worker = json.loads(child.stdout)
                    self.assertEqual(worker["used_outputs"], 3)
                    self.assertTrue(worker["complete"])
                    for sentinel in (PROVIDER_KEY, RAW_SENTINEL):
                        self.assertNotIn(sentinel.encode(), payload)
                        self.assertNotIn(sentinel.encode(), child.stdout)
                        for file in root.rglob("*"):
                            if file.is_file():
                                self.assertNotIn(sentinel.encode(), file.read_bytes())

    def test_partial_and_unknown_are_not_replaced_or_exported_as_complete(self):
        for protocol in ("openai", "anthropic"):
            for mode, status, calls, accepted in (
                    ("partial", "partial", 3, 2),
                    ("inconclusive", "failed", 3, 0),
                    ("unknown", "write_unknown", 1, 0)):
                with self.subTest(protocol=protocol, mode=mode), tempfile.TemporaryDirectory() as temporary:
                    with SyntheticProvider(protocol, mode) as provider:
                        result = collect(provider, Path(temporary), "bounded-operation")
                        self.assertEqual(result["status"], status)
                        self.assertEqual(len(result["plan"]), 3)
                        self.assertEqual(result["counts"]["accepted"], accepted)
                        self.assertFalse(result["complete"])
                        replay = collect(provider, Path(temporary), "bounded-operation")
                        self.assertEqual(replay, result)
                        self.assertEqual(len(provider.posts), calls)
                        evidence = evidence_for(result, "partial-probe",
                                                "chat" if protocol == "openai" else "messages")
                        if accepted:
                            validate_evidence(evidence)
                            self.assertEqual(result["analysis"]["used_outputs"], 2)
                            self.assertFalse(result["analysis"]["complete"])
                        else:
                            with self.assertRaises(ValueError):
                                validate_evidence(evidence)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--flow", action="store_true")
    parser.add_argument("--state", type=Path)
    parser.add_argument("--daemon")
    args = parser.parse_args()
    if not args.flow:
        unittest.main(argv=[sys.argv[0]])
        return
    records, evidence_list, calls = [], [], 0
    client = ExportClient(args.daemon, INGEST)
    for protocol in ("openai", "anthropic"):
        for mode in ("complete", "partial"):
            with SyntheticProvider(protocol, mode) as provider:
                identity = protocol + "-" + mode
                result = collect(provider, args.state / identity, identity)
                replay = collect(provider, args.state / identity, identity)
                if len(provider.posts) != 3 or replay != result:
                    raise AssertionError("three fixed slots or zero-POST replay failed")
                evidence = evidence_for(result, identity,
                                        "chat" if protocol == "openai" else "messages")
                record = client.submit(evidence)
                fetched = client.get(identity)
                replayed = client.submit(evidence)
                if (record.get("state") != "succeeded"
                        or fetched != record
                        or replayed != record):
                    values = json.dumps({
                        "record": record, "fetched": fetched, "replayed": replayed,
                    }, sort_keys=True)
                    raise AssertionError(
                        "signed durable numeric submit/get/replay failed: " + values)
                used = 3 if mode == "complete" else 2
                if (record["result"]["used_outputs"] != used
                        or record["result"]["complete"] != (used == 3)
                        or used == 2 and record["result"]["assessment"] != "inconclusive"):
                    raise AssertionError("partial projection was promoted")
                records.append(record)
                evidence_list.append(evidence)
                calls += len(provider.posts)
    print(json.dumps({"records": records, "provider_calls": calls,
                      "evidence": evidence_list}), flush=True)


if __name__ == "__main__":
    main()
