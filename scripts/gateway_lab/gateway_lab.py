#!/usr/bin/env python3
"""Portable HTTP gateway diagnostics: list scenarios, serve a mock, run requests."""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from client import DriverSetupError, control_json, run_case, validate_url
from scenarios import PROTOCOLS, VALID_EXPECTS, load_scenarios


def load_targets(args: argparse.Namespace, scenarios: dict) -> list[dict[str, Any]]:
    """Validate all targets before making a model request or reading a secret."""
    if args.targets:
        path = Path(args.targets)
        if path.stat().st_size > 1024 * 1024:
            raise DriverSetupError("targets file exceeds 1 MiB")
        targets = json.loads(path.read_text(encoding="utf-8"))
    else:
        targets = [{"name": args.name, "base_url": args.base_url, "model": args.model,
                    "protocol": args.protocol, "api_key_env": args.api_key_env}]
    if not isinstance(targets, list) or not 1 <= len(targets) <= 64:
        raise DriverSetupError("targets must be a JSON array of 1..64 objects")
    names: set[str] = set()
    allowed = {"name", "base_url", "protocol", "model", "api_key_env", "mock_url",
               "expectations", "max_cancel_delay_ms"}
    for target in targets:
        if not isinstance(target, dict) or set(target) - allowed:
            raise DriverSetupError("target must be an object with known fields")
        target.setdefault("protocol", "chat")
        target.setdefault("mock_url", args.mock_url)
        target.setdefault("expectations", {})
        target.setdefault("max_cancel_delay_ms", 1000)
        for name in ("name", "base_url", "model", "protocol", "mock_url"):
            if not isinstance(target.get(name), str) or not target[name] or len(target[name]) > 2048:
                raise DriverSetupError(f"target {name} must be a nonempty bounded string")
        if target["name"] in names:
            raise DriverSetupError("target names must be unique")
        names.add(target["name"])
        if target["protocol"] not in PROTOCOLS:
            raise DriverSetupError("target protocol is unsupported")
        validate_url(target["base_url"])
        validate_url(target["mock_url"])
        env = target.get("api_key_env")
        if env is not None and (not isinstance(env, str) or not env or not os.environ.get(env)):
            raise DriverSetupError("configured API-key environment variable is missing or empty")
        delay = target["max_cancel_delay_ms"]
        if type(delay) not in (int, float) or not math.isfinite(delay) or not 0 < delay <= 600000:
            raise DriverSetupError("max_cancel_delay_ms must be a finite number in (0, 600000]")
        expectations = target["expectations"]
        if not isinstance(expectations, dict):
            raise DriverSetupError("expectations must be an object keyed by case name")
        if any(k not in scenarios or not isinstance(v, str) or v not in VALID_EXPECTS for k, v in expectations.items()):
            raise DriverSetupError("unknown expectation or case in target configuration")
    return targets


def run(args: argparse.Namespace) -> int:
    """Execute a bounded request matrix and write a secret-free JSON report."""
    scenarios = load_scenarios(args.scenarios)
    cases = list(scenarios) if args.cases == "all" else args.cases.split(",")
    cases = [name.strip() for name in cases]
    if not cases or any(name not in scenarios for name in cases) or len(set(cases)) != len(cases):
        raise DriverSetupError("cases must be distinct known names, or all")
    if not 1 <= args.repeat <= 1000 or not 1 <= args.concurrency <= 32:
        raise DriverSetupError("repeat must be 1..1000 and concurrency 1..32")
    if not math.isfinite(args.cancel_grace_s) or not 0 < args.cancel_grace_s <= 600:
        raise DriverSetupError("cancel-grace-s must be finite in (0, 600]")
    targets = load_targets(args, scenarios)
    if len(targets) * len(cases) * args.repeat > 5000:
        raise DriverSetupError("request matrix exceeds 5000 exchanges")
    for mock_url in {t["mock_url"] for t in targets}:
        try:
            control_json(mock_url.rstrip("/") + "/healthz")
        except (OSError, ValueError):
            raise DriverSetupError("mock health check failed; no model requests sent") from None
    run_id = uuid.uuid4().hex
    jobs = [(target, scenarios[name], uuid.uuid4().hex)
            for target in targets for name in cases for _ in range(args.repeat)]

    def execute(job: tuple) -> dict:
        return run_case(job[0], job[1], run_id, job[2], cancel_grace_s=args.cancel_grace_s)

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        results = list(pool.map(execute, jobs))
    totals: dict[str, Any] = {v: sum(r["verdict"] == v for r in results)
                              for v in ("PASS", "FAIL", "OBSERVED", "SKIP")}
    totals["total"] = len(results)
    distribution: dict[str, dict[str, int]] = {}
    for result in results:
        counts = distribution.setdefault(result["target"], {})
        upstream = result.get("upstream", {})
        for node, count in upstream.get("attempts_by_node", {}).items():
            counts[node] = counts.get(node, 0) + count
        print(f"{result['verdict']:8} {result['target']}/{result['case']} "
              f"status={result.get('status')} elapsed_ms={result.get('elapsed_ms')} "
              f"ttft_ms={result.get('ttft_ms')} attempts={upstream.get('attempts', 0)} "
              f"nodes={','.join(upstream.get('nodes', []))} {result['reason']}")
    totals["attempts_by_node"] = distribution
    report = {"schema_version": 1, "run_id": run_id, "totals": totals, "results": results}
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"run_id={run_id} report={args.output} totals={totals}")
    return int(totals["FAIL"] > 0 or totals["SKIP"] == len(results))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    listing = commands.add_parser("list", help="list named scenarios")
    listing.add_argument("--protocol", choices=PROTOCOLS)
    listing.add_argument("--scenarios")
    server = commands.add_parser("serve", help="serve fake upstream protocols")
    server.add_argument("--host", default="127.0.0.1")
    server.add_argument("--port", type=int, default=19090, help="0 selects an ephemeral port")
    server.add_argument("--scenarios")
    server.add_argument("--events-file", help="optional append-only metadata NDJSON file")
    runner = commands.add_parser("run", help="send real HTTP requests through gateways")
    source = runner.add_mutually_exclusive_group(required=True)
    source.add_argument("--targets")
    source.add_argument("--base-url")
    runner.add_argument("--name", default="gateway")
    runner.add_argument("--model", default="gateway-lab")
    runner.add_argument("--protocol", choices=PROTOCOLS, default="chat")
    runner.add_argument("--api-key-env", help="environment variable name, never the API key itself")
    runner.add_argument("--mock-url", default="http://127.0.0.1:19090")
    runner.add_argument("--cases", default="nonstream,stream,fragmented_sse")
    runner.add_argument("--scenarios")
    runner.add_argument("--repeat", type=int, default=1)
    runner.add_argument("--concurrency", type=int, default=1)
    runner.add_argument("--cancel-grace-s", type=float, default=1)
    runner.add_argument("--output", default="gateway-lab-report.json")
    args = parser.parse_args()
    try:
        if args.command == "run":
            return run(args)
        scenarios = load_scenarios(args.scenarios)
        if args.command == "list":
            for scenario in scenarios.values():
                if args.protocol is None or args.protocol in scenario.protocols:
                    print(f"{scenario.name:24} stream={scenario.stream!s:5} expect={scenario.expect:9} protocols={','.join(scenario.protocols)}")
            return 0
        if not 0 <= args.port <= 65535:
            raise DriverSetupError("port must be in 0..65535")
        from upstream import serve
        serve(args.host, args.port, scenarios, args.events_file)
        return 0
    except (ValueError, OSError, TypeError) as exc:
        message = str(exc) if isinstance(exc, DriverSetupError) else type(exc).__name__
        print(f"configuration error: {message}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
