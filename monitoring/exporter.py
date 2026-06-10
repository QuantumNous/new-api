#!/usr/bin/env python3
"""
New API Prometheus Exporter
Polls New API monitoring endpoints and exposes Prometheus metrics on :9099
"""
import json
import time
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import URLError

NEW_API_BASE = os.environ.get("NEW_API_BASE", "http://host.docker.internal:3002")
SCRAPE_INTERVAL = int(os.environ.get("SCRAPE_INTERVAL", "30"))
API_KEY = os.environ.get("NEW_API_API_KEY", "")

# User/Group monitoring config
# Comma-separated list of usernames to track (empty = auto-detect from admin API)
USER_LIST = [u.strip() for u in os.environ.get("NEW_API_USER_LIST", "").split(",") if u.strip()]
# Comma-separated list of groups to track
GROUP_LIST = [g.strip() for g in os.environ.get("NEW_API_GROUP_LIST", "internal,personal").split(",") if g.strip()]

# Cached metrics
_metrics_cache = {}
_last_scrape = 0


def scrape():
    """Scrape all New API endpoints and return Prometheus metrics."""
    global _metrics_cache, _last_scrape

    now = time.time()
    if now - _last_scrape < SCRAPE_INTERVAL:
        return _metrics_cache

    metrics = []
    labels = {"instance": NEW_API_BASE}

    def add_metric(name, value, labels=None, help_text="", mtype="gauge"):
        all_labels = {**labels_}
        if labels:
            all_labels.update(labels)
        label_str = ",".join(f'{k}="{v}"' for k, v in all_labels.items())
        label_str = f"{{{label_str}}}" if label_str else ""
        metrics.append(f"# HELP {name} {help_text}")
        metrics.append(f"# TYPE {name} {mtype}")
        metrics.append(f"{name}{label_str} {value}")

    labels_ = {"instance": NEW_API_BASE}

    # 1. Status check
    try:
        req = Request(f"{NEW_API_BASE}/api/status", headers={"User-Agent": "NewAPI-Exporter"})
        resp = urlopen(req, timeout=10)
        body = json.loads(resp.read().decode())
        add_metric("newapi_up", 1 if body.get("success") else 0, help_text="New API service is up (1=up, 0=down)")

        data = body.get("data", {})

        # System settings
        add_metric("newapi_system_info", 1, {
            **labels_,
            "version": data.get("version", "unknown"),
            "system_name": data.get("system_name", "unknown"),
            "theme": data.get("theme", "unknown"),
        }, help_text="System info labels", mtype="gauge")

        add_metric("newapi_register_enabled", 1 if data.get("register_enabled") else 0,
                    help_text="Registration enabled")
        add_metric("newapi_password_login_enabled", 1 if data.get("password_login_enabled") else 0,
                    help_text="Password login enabled")
        add_metric("newapi_email_verification", 1 if data.get("email_verification") else 0,
                    help_text="Email verification enabled")
        add_metric("newapi_turnstile_check", 1 if data.get("turnstile_check") else 0,
                    help_text="Turnstile check enabled")

        uptime = now - data.get("start_time", now)
        add_metric("newapi_uptime_seconds", uptime, help_text="Service uptime in seconds")
        add_metric("newapi_quota_per_unit", data.get("quota_per_unit", 0),
                    help_text="Quota per unit")
        add_metric("newapi_usd_exchange_rate", data.get("usd_exchange_rate", 0),
                    help_text="USD exchange rate")

    except URLError as e:
        add_metric("newapi_up", 0, help_text="New API service is up (1=up, 0=down)")
        add_metric("newapi_status_error", 1, {"error": str(e.reason)},
                    help_text="Status endpoint error")
    except Exception as e:
        add_metric("newapi_up", 0, help_text="New API service is up (1=up, 0=down)")
        add_metric("newapi_status_error", 1, {"error": str(e)}, help_text="Status endpoint error")

    # 2. Log stats + token consumption (needs session auth: login -> cookie)
    admin_user = os.environ.get("NEW_API_ADMIN_USER", "")
    admin_pass = os.environ.get("NEW_API_ADMIN_PASS", "")
    if admin_user and admin_pass:
        try:
            # Step 1: Login
            login_body = json.dumps({"username": admin_user, "password": admin_pass}).encode()
            login_req = Request(
                f"{NEW_API_BASE}/api/user/login?turnstile=",
                data=login_body,
                headers={"Content-Type": "application/json", "User-Agent": "NewAPI-Exporter"},
            )
            login_resp = urlopen(login_req, timeout=10)
            login_data = json.loads(login_resp.read().decode())
            if login_data.get("success"):
                user_id = login_data["data"]["id"]
                # Extract session cookie
                set_cookie = login_resp.headers.get("Set-Cookie", "")
                cm = __import__("re").search(r"(session=[^;]+)", set_cookie)
                session_cookie = cm.group(1) if cm else ""

                if session_cookie:
                    # Step 2: Get log stats
                    stats_req = Request(
                        f"{NEW_API_BASE}/api/log/stat?type=0",
                        headers={
                            "Cookie": session_cookie,
                            "New-Api-User": str(user_id),
                            "User-Agent": "NewAPI-Exporter",
                        },
                    )
                    stats_resp = urlopen(stats_req, timeout=10)
                    stats_data = json.loads(stats_resp.read().decode())
                    if stats_data.get("success"):
                        d = stats_data.get("data", {})
                        add_metric("newapi_token_consumed", d.get("quota", 0),
                                    help_text="Total tokens consumed (quota used)")
                        add_metric("newapi_rpm", d.get("rpm", 0),
                                    help_text="Requests per minute")
                        add_metric("newapi_tpm", d.get("tpm", 0),
                                    help_text="Tokens per minute")

                    # Step 3: Get user quota info (remaining + used)
                    self_req = Request(
                        f"{NEW_API_BASE}/api/user/self",
                        headers={
                            "Cookie": session_cookie,
                            "New-Api-User": str(user_id),
                            "User-Agent": "NewAPI-Exporter",
                        },
                    )
                    self_resp = urlopen(self_req, timeout=10)
                    self_data = json.loads(self_resp.read().decode())
                    if self_data.get("success"):
                        u = self_data.get("data", {})
                        add_metric("newapi_quota_remain", u.get("quota", 0),
                                    help_text="Remaining token quota")
                        add_metric("newapi_quota_used_total", u.get("used_quota", 0),
                                    help_text="Used token quota (lifetime)")
                        add_metric("newapi_request_count", u.get("request_count", 0),
                                    help_text="Total API request count")

                    # Step 4: Per-group usage stats
                    for group in GROUP_LIST:
                        try:
                            group_stat_req = Request(
                                f"{NEW_API_BASE}/api/log/stat?type=0&group={group}",
                                headers={
                                    "Cookie": session_cookie,
                                    "New-Api-User": str(user_id),
                                    "User-Agent": "NewAPI-Exporter",
                                },
                            )
                            group_stat_resp = urlopen(group_stat_req, timeout=10)
                            group_stat_data = json.loads(group_stat_resp.read().decode())
                            if group_stat_data.get("success"):
                                gd = group_stat_data.get("data", {})
                                add_metric("newapi_group_quota_used", gd.get("quota", 0),
                                            {"group": group},
                                            help_text="Quota used per group")
                                add_metric("newapi_group_rpm", gd.get("rpm", 0),
                                            {"group": group},
                                            help_text="Requests per minute per group")
                                add_metric("newapi_group_tpm", gd.get("tpm", 0),
                                            {"group": group},
                                            help_text="Tokens per minute per group")
                        except Exception:
                            pass

                    # Step 5: Per-user usage stats
                    users = set(USER_LIST)
                    if not users:
                        # Auto-detect: get users from admin API
                        try:
                            users_req = Request(
                                f"{NEW_API_BASE}/api/user/?p=0&size=100",
                                headers={
                                    "Cookie": session_cookie,
                                    "New-Api-User": str(user_id),
                                    "User-Agent": "NewAPI-Exporter",
                                },
                            )
                            users_resp = urlopen(users_req, timeout=10)
                            users_data = json.loads(users_resp.read().decode())
                            if users_data.get("success"):
                                items = users_data.get("data", {}).get("items", [])
                                for u in items:
                                    uname = u.get("username", "")
                                    if uname:
                                        users.add(uname)
                        except Exception:
                            pass

                    for username in users:
                        try:
                            user_stat_req = Request(
                                f"{NEW_API_BASE}/api/log/stat?type=0&username={username}",
                                headers={
                                    "Cookie": session_cookie,
                                    "New-Api-User": str(user_id),
                                    "User-Agent": "NewAPI-Exporter",
                                },
                            )
                            user_stat_resp = urlopen(user_stat_req, timeout=10)
                            user_stat_data = json.loads(user_stat_resp.read().decode())
                            if user_stat_data.get("success"):
                                ud = user_stat_data.get("data", {})
                                ulabel = {"username": username}
                                add_metric("newapi_user_quota_used", ud.get("quota", 0), ulabel,
                                            help_text="Quota used per user")
                                add_metric("newapi_user_rpm", ud.get("rpm", 0), ulabel,
                                            help_text="Requests per minute per user")
                                add_metric("newapi_user_tpm", ud.get("tpm", 0), ulabel,
                                            help_text="Tokens per minute per user")
                        except Exception:
                            pass

                    # Step 6: Recent logs for model-level token breakdown
                    logs_req = Request(
                        f"{NEW_API_BASE}/api/log/?type=0&num=10",
                        headers={
                            "Cookie": session_cookie,
                            "New-Api-User": str(user_id),
                            "User-Agent": "NewAPI-Exporter",
                        },
                    )
                    logs_resp = urlopen(logs_req, timeout=10)
                    logs_data = json.loads(logs_resp.read().decode())
                    if logs_data.get("success"):
                        items = logs_data.get("data", {}).get("items", [])
                        total_pt = sum(log.get("prompt_tokens", 0) for log in items)
                        total_ct = sum(log.get("completion_tokens", 0) for log in items)
                        add_metric("newapi_log_prompt_tokens", total_pt,
                                    help_text="Sum of prompt_tokens from recent logs")
                        add_metric("newapi_log_completion_tokens", total_ct,
                                    help_text="Sum of completion_tokens from recent logs")
                        add_metric("newapi_log_total_tokens", total_pt + total_ct,
                                    help_text="Sum of total tokens from recent logs")
                        # Per-model tokens
                        model_tokens = {}
                        for log in items:
                            m = log.get("model_name", "unknown")
                            t = log.get("prompt_tokens", 0) + log.get("completion_tokens", 0)
                            model_tokens[m] = model_tokens.get(m, 0) + t
                        for model, tokens in model_tokens.items():
                            safe = model.replace(".", "_").replace("-", "_")
                            add_metric("newapi_model_tokens", tokens,
                                        {"model": model},
                                        help_text="Tokens consumed per model (from recent logs)")
        except Exception as e:
            pass  # silently skip if auth fails

    # 3. Performance metrics
    try:
        req = Request(
            f"{NEW_API_BASE}/api/perf-metrics/summary",
            headers={"User-Agent": "NewAPI-Exporter"},
        )
        resp = urlopen(req, timeout=10)
        body = json.loads(resp.read().decode())
        if body.get("success"):
            data = body.get("data", {})
            for model in data.get("models", []):
                model_name = model.get("model_name", "unknown").replace(".", "_").replace("-", "_")
                mlabel = {**labels_, "model": model.get("model_name", "unknown")}
                add_metric("newapi_model_latency_ms", model.get("avg_latency_ms", 0), mlabel,
                            help_text="Average model latency in ms")
                add_metric("newapi_model_success_rate", model.get("success_rate", 0), mlabel,
                            help_text="Model success rate (0-100)")
                add_metric("newapi_model_tps", model.get("avg_tps", 0), mlabel,
                            help_text="Average tokens per second")
        # Also try to get admin logs for recent requests
        try:
            req = Request(
                f"{NEW_API_BASE}/api/log/?type=0&num=1",
                headers={
                    "Cookie": f"session={os.environ.get('NEW_API_SESSION', '')}",
                    "New-Api-User": "1",
                    "User-Agent": "NewAPI-Exporter",
                },
            )
            resp = urlopen(req, timeout=10)
            body = json.loads(resp.read().decode())
            if body.get("success"):
                data = body.get("data", {})
                items = data.get("items", [])
                if items:
                    # Total request count from pagination
                    add_metric("newapi_total_requests", data.get("total", 0),
                                help_text="Total API requests")
        except Exception:
            pass
    except Exception as e:
        pass

    add_metric("newapi_last_scrape_timestamp", now, help_text="Last scrape timestamp (unix seconds)")
    add_metric("newapi_scrape_duration_seconds", time.time() - now, help_text="Scrape duration in seconds")

    _metrics_cache = "\n".join(metrics) + "\n"
    _last_scrape = now
    return _metrics_cache


class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/metrics":
            body = scrape()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", len(body.encode()))
            self.end_headers()
            self.wfile.write(body.encode())
        elif self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
        elif self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<html><body><h1>New API Exporter</h1><a href='/metrics'>/metrics</a></body></html>")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # suppress logs


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9099"))
    print(f"New API Exporter starting on :{port}")
    print(f"  New API Base: {NEW_API_BASE}")
    print(f"  Scrape Interval: {SCRAPE_INTERVAL}s")
    server = HTTPServer(("0.0.0.0", port), MetricsHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
