#!/usr/bin/env python3
"""
New API 定时报表 → 飞书
用法: python report.py          # 发送一次
      python report.py --cron   # 定时模式（每 N 分钟）
环境变量:
  PROMETHEUS_URL=http://prometheus:9090
  FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
  REPORT_INTERVAL=60            # 定时发送间隔（分钟）
"""
import json
import os
import sys
import time
from datetime import datetime
from urllib.request import Request, urlopen

PROMETHEUS = os.environ.get("PROMETHEUS_URL", "http://prometheus:9090")
FEISHU = os.environ.get("FEISHU_WEBHOOK",
    "https://open.feishu.cn/open-apis/bot/v2/hook/748fd289-6b82-4b21-b7e5-4b7baac7b67e")
INTERVAL = int(os.environ.get("REPORT_INTERVAL", "60"))

def prom_query(query):
    """Query Prometheus instant API."""
    url = f"{PROMETHEUS}/api/v1/query?query={query}"
    req = Request(url, headers={"User-Agent": "NewAPI-Report"})
    resp = urlopen(req, timeout=10)
    data = json.loads(resp.read().decode())
    results = data.get("data", {}).get("result", [])
    if not results:
        return None
    return float(results[0].get("value", [0, 0])[1])


def gather_metrics():
    """Gather all key metrics from Prometheus."""
    m = {}

    # Service status
    m["up"] = prom_query("newapi_up") or 0

    # Token metrics
    m["token_consumed"] = int(prom_query("newapi_token_consumed") or 0)
    m["quota_remain"] = int(prom_query("newapi_quota_remain") or 0)
    m["quota_used"] = int(prom_query("newapi_quota_used_total") or 0)

    # Traffic
    m["rpm"] = prom_query("newapi_rpm") or 0
    m["tpm"] = prom_query("newapi_tpm") or 0
    m["request_count"] = int(prom_query("newapi_request_count") or 0)

    # Model performance (get top models)
    m["model_latency"] = prom_query("newapi_model_latency_ms") or 0
    m["model_success_rate"] = prom_query("newapi_model_success_rate") or 0
    m["model_tps"] = prom_query("newapi_model_tps") or 0

    # Uptime
    uptime_sec = prom_query("newapi_uptime_seconds") or 0
    days = int(uptime_sec / 86400)
    hours = int((uptime_sec % 86400) / 3600)
    m["uptime"] = f"{days}d {hours}h"

    return m


def format_number(n):
    """Format large numbers."""
    if n >= 1_000_000_000:
        return f"{n/1_000_000_000:.1f}B"
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}K"
    return str(n)


def gather_user_metrics():
    """Query Prometheus for per-user usage metrics."""
    url = f"{PROMETHEUS}/api/v1/query?query=newapi_user_quota_used"
    req = Request(url, headers={"User-Agent": "NewAPI-Report"})
    try:
        resp = urlopen(req, timeout=10)
        data = json.loads(resp.read().decode())
        results = data.get("data", {}).get("result", [])
        users = []
        for r in results:
            username = r.get("metric", {}).get("username", "unknown")
            quota = float(r.get("value", [0, 1])[1])
            users.append({"username": username, "quota": int(quota)})
        # Sort by quota descending
        users.sort(key=lambda u: u["quota"], reverse=True)
        return users
    except Exception:
        return []


def send_report(m):
    """Build and send Feishu card."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    status_icon = "🟢" if m["up"] else "🔴"
    status_text = "正常运行" if m["up"] else "服务异常"

    # Token usage percentage
    total_quota = m["quota_remain"] + m["quota_used"]
    usage_pct = (m["quota_used"] / total_quota * 100) if total_quota > 0 else 0

    elements = [
        {"tag": "div", "text": {"tag": "lark_md", "content": f"**服务状态:** {status_icon} {status_text}  |  运行时间: {m['uptime']}"}},
        {"tag": "hr"},
        {"tag": "div", "text": {"tag": "lark_md", "content": f"**📈 Token 消耗**\n累计消耗: **{format_number(m['token_consumed'])}**  |  已用额度: {format_number(m['quota_used'])}  |  剩余: {format_number(m['quota_remain'])}\n额度使用率: {usage_pct:.1f}%"}},
        {"tag": "hr"},
        {"tag": "div", "text": {"tag": "lark_md", "content": f"**🚦 实时流量**\nRPM: {m['rpm']:.0f}  |  TPM: {m['tpm']:.0f}  |  总请求: {m['request_count']}"}},
        {"tag": "hr"},
        {"tag": "div", "text": {"tag": "lark_md", "content": f"**🤖 模型性能**\n延迟: {m['model_latency']:.0f}ms  |  成功率: {m['model_success_rate']:.1f}%  |  TPS: {m['model_tps']:.1f}"}},
    ]

    # Per-user usage ranking (Top 10)
    users = gather_user_metrics()
    if users:
        lines = [f"**👥 用户用量排行 (Top {min(len(users), 10)})**", ""]
        for i, u in enumerate(users[:10], 1):
            icon = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else f"{i}."
            lines.append(f"{icon} **{u['username']}**: {format_number(u['quota'])} tokens")
        elements.append({"tag": "hr"})
        elements.append({"tag": "div", "text": {"tag": "lark_md", "content": "\n".join(lines)}})

    elements.append({"tag": "hr"})
    elements.append({"tag": "div", "text": {"tag": "lark_md", "content": f"📎 [Grafana 面板](http://localhost:3003) | [Prometheus](http://localhost:9090)"}})
    elements.append({"tag": "note", "elements": [{"tag": "plain_text", "content": f"定时报表 · 每 {INTERVAL} 分钟 · {now}"}]})

    card = {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": f"📊 New API 监控报表 | {now}"},
                "template": "green" if m["up"] else "red"
            },
            "elements": elements
        }
    }

    data = json.dumps(card).encode("utf-8")
    req = Request(FEISHU, data=data, headers={"Content-Type": "application/json; charset=utf-8"})
    resp = urlopen(req, timeout=10)
    result = resp.read().decode("utf-8", errors="replace")
    print(f"[{now}] Report sent: {result}")
    return result


if __name__ == "__main__":
    if "--cron" in sys.argv:
        print(f"Report scheduler started (interval={INTERVAL}min)")
        # Send first report immediately
        try:
            m = gather_metrics()
            send_report(m)
        except Exception as e:
            print(f"ERROR: {e}")

        while True:
            time.sleep(INTERVAL * 60)
            try:
                m = gather_metrics()
                send_report(m)
            except Exception as e:
                print(f"ERROR: {e}")
    else:
        m = gather_metrics()
        send_report(m)
