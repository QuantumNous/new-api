#!/usr/bin/env python3
"""Export new-api dashboard request logs as JSON through an optional SSH host.

NEW_API_USERNAME / NEW_API_PASSWORD or NEW_API_ACCESS_TOKEN supply credentials.
Example:
  python3 deploy/tokeninfra/export_request_logs.py --ssh tokeninfra \
    --base-url https://your-new-api --limit 1 --out /tmp/new-api-request.json

Exports billing/error log records, not request/response bodies. The API's `other`
JSON string is decoded into an object for readability. Requires Python 3 on both
machines. Credentials travel over SSH stdin and are never saved remotely.
"""

import argparse
import http.cookiejar
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def export_logs(config):
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
    )
    headers = {"Content-Type": "application/json"}

    def api(path, body=None):
        request = urllib.request.Request(
            config["base_url"].rstrip("/") + path,
            data=None if body is None else json.dumps(body).encode(),
            headers=headers,
        )
        with opener.open(request, timeout=60) as response:
            result = json.load(response)
        if result.get("success") is not True:
            raise RuntimeError("new-api API failed: " + str(result.get("message", "unknown")))
        return result["data"]

    token = config.get("access_token")
    if not token:
        login = api("/api/user/login", {
            "username": config["username"], "password": config["password"],
        })
        if login.get("require_2fa"):
            raise RuntimeError("Login requires 2FA; supply NEW_API_ACCESS_TOKEN instead")
        token = login.get("access_token")
        user_id = login.get("user", login).get("id")
        if user_id:
            headers["New-Api-User"] = str(user_id)
    if token:
        headers["Authorization"] = "Bearer " + token
    if config.get("user_id"):
        headers["New-Api-User"] = str(config["user_id"])

    records = []
    # Freeze the upper time bound while paging. Export consume or error records
    # explicitly, excluding top-ups, login events and management audit records.
    query = {
        "type": config["type"], "page_size": min(config["limit"], 100),
        "end_timestamp": config["end_timestamp"] or int(time.time()),
    }
    for key in ("start_timestamp", "model_name", "request_id"):
        value = config.get(key)
        if value:
            query[key] = value
    if config.get("filter_username"):
        query["username"] = config["filter_username"]
    page = 1
    while len(records) < config["limit"]:
        query["p"] = page
        data = api("/api/log/?" + urllib.parse.urlencode(query))
        items = data["items"] or []
        if not items:
            break
        for item in items:
            if isinstance(item.get("other"), str):
                try:
                    item["other"] = json.loads(item["other"])
                except json.JSONDecodeError:
                    pass
        records.extend(items)
        if len(items) < query["page_size"]:
            break
        page += 1
    if not records:
        raise RuntimeError("No matching request logs; no export written")
    return records[:config["limit"]]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--ssh", help="Run API requests on this SSH host")
    parser.add_argument("--limit", type=int, default=1)
    parser.add_argument("--type", type=int, choices=(2, 5), default=2,
                        help="2: consume logs (default), 5: error logs")
    parser.add_argument("--start-timestamp", type=int, default=0)
    parser.add_argument("--end-timestamp", type=int, default=0)
    parser.add_argument("--model-name")
    parser.add_argument("--username", dest="filter_username")
    parser.add_argument("--request-id")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("--limit must be positive")
    config = vars(args).copy()
    config.pop("out")
    config.update(username=os.environ.get("NEW_API_USERNAME"),
                  password=os.environ.get("NEW_API_PASSWORD"),
                  access_token=os.environ.get("NEW_API_ACCESS_TOKEN"),
                  user_id=os.environ.get("NEW_API_USER_ID"))
    if not config["access_token"] and not (config["username"] and config["password"]):
        parser.error("Set NEW_API_ACCESS_TOKEN or NEW_API_USERNAME / NEW_API_PASSWORD")
    if args.ssh:
        source = Path(__file__).read_text().rsplit('\nif __name__ == "__main__":', 1)[0]
        program = source + "\nprint(json.dumps(export_logs(" + repr(config) + "), ensure_ascii=False))\n"
        result = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "--",
             args.ssh, "python3 -"], input=program, text=True,
            capture_output=True, timeout=600,
        )
        if result.returncode:
            lines = result.stderr.splitlines()
            raise RuntimeError("Remote export failed; " + (lines[-1] if lines else "no error details"))
        records = json.loads(result.stdout)
    else:
        records = export_logs(config)
    # Exclusive creation prevents accidental overwrites; logs are owner-readable.
    fd = os.open(args.out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as output:
        json.dump(records, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(f"Exported {len(records)} request log(s) to {args.out}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as exc:
        sys.exit(str(exc))
