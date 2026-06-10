#!/usr/bin/env python3
"""
AlertManager → Feishu Webhook Relay
Receives AlertManager webhook JSON, converts to Feishu card format
"""
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen

FEISHU_WEBHOOK = os.environ.get("FEISHU_WEBHOOK",
    "https://open.feishu.cn/open-apis/bot/v2/hook/748fd289-6b82-4b21-b7e5-4b7baac7b67e")
PORT = int(os.environ.get("PORT", "9098"))


def send_feishu(text_parts, severity="warning"):
    """Send an interactive card to Feishu."""
    color = "red" if severity == "critical" else "yellow" if severity == "warning" else "green"

    elements = []
    for part in text_parts:
        elements.append({
            "tag": "div",
            "text": {"tag": "lark_md", "content": part}
        })

    payload = {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": "New API 监控告警"},
                "template": color
            },
            "elements": elements + [
                {"tag": "hr"},
                {"tag": "note", "elements": [{"tag": "plain_text", "content": "Prometheus → AlertManager → Feishu"}]}
            ]
        }
    }

    data = json.dumps(payload).encode("utf-8")
    req = Request(FEISHU_WEBHOOK, data=data, headers={"Content-Type": "application/json; charset=utf-8"})
    resp = urlopen(req, timeout=10)
    raw = resp.read()
    return raw.decode("utf-8", errors="replace")


class RelayHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode())

            alerts = body.get("alerts", [])
            status = body.get("status", "firing")
            common_labels = body.get("commonLabels", {})
            common_annots = body.get("commonAnnotations", {})

            if not alerts:
                self.send_response(200)
                self.end_headers()
                return

            # Determine severity
            severity = common_labels.get("severity", "warning")
            alert_name = common_labels.get("alertname", "Unknown")

            # Build Feishu message
            emoji = "🔴" if severity == "critical" else "⚠️"
            status_text = "告警恢复 ✅" if status == "resolved" else f"告警触发 {emoji}"

            parts = [
                f"**{status_text}**",
                f"**告警名称:** {alert_name}",
                f"**级别:** {severity}",
                f"**实例:** {common_labels.get('instance', 'N/A')}",
                f"**时间:** {alerts[0].get('startsAt', 'N/A')}",
                "",
            ]

            for alert in alerts[:5]:
                annots = alert.get("annotations", {})
                parts.append(f"**{annots.get('summary', '')}**")
                parts.append(f"> {annots.get('description', '')}")
                parts.append("")

            parts.append(f"共 {len(alerts)} 条告警")

            result = send_feishu(parts, severity)
            print(f"[{status}] {alert_name} → Feishu: {result}")

        except Exception as e:
            print(f"ERROR: {e}")

        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"AlertManager -> Feishu Relay")

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    print(f"Feishu Relay starting on :{PORT}")
    print(f"  → Feishu Webhook: {FEISHU_WEBHOOK[:50]}...")
    server = HTTPServer(("0.0.0.0", PORT), RelayHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
