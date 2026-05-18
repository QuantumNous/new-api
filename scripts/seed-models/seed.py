#!/usr/bin/env python3
"""
DeepRouter — seed-models 自动化脚本

读取 channels.yaml，调用 DeepRouter admin API 创建/更新所有 channel。

用法：
    python3 seed.py --base-url https://your-deeprouter.example.com \\
                    --admin-token sk-admin-xxxx \\
                    [--config channels.yaml] [--dry-run] [--only NAME]

环境变量（上游 API key）：
    OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY,
    MOONSHOT_API_KEY, ALI_API_KEY, ZHIPU_API_KEY, XAI_API_KEY,
    BAIDU_API_KEY, TENCENT_API_KEY, MINIMAX_API_KEY, YI_API_KEY,
    XUNFEI_API_KEY, VOLCENGINE_API_KEY, MISTRAL_API_KEY, COHERE_API_KEY,
    PERPLEXITY_API_KEY 等（参见 channels.yaml 的 key_env 字段）

依赖：
    pip install pyyaml

幂等性：
    按 channel.name 做 upsert —— 同名 channel 会更新而不是重复创建。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    sys.stderr.write("缺少依赖：pip install pyyaml\n")
    sys.exit(2)


# ─── 状态码与样式 ────────────────────────────────────────────────────────

STATUS_ENABLED = 1
STATUS_DISABLED = 2

COLOR_RED = "\033[91m"
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_BLUE = "\033[94m"
COLOR_GRAY = "\033[90m"
COLOR_RESET = "\033[0m"


def color(text: str, c: str) -> str:
    if not sys.stdout.isatty():
        return text
    return f"{c}{text}{COLOR_RESET}"


# ─── HTTP 客户端 ────────────────────────────────────────────────────────


class AdminClient:
    """极简 admin API 客户端，stdlib urllib 实现避免 requests 依赖。"""

    def __init__(self, base_url: str, admin_token: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.admin_token = admin_token
        self.timeout = timeout

    def _request(
        self, method: str, path: str, payload: dict | None = None
    ) -> dict:
        url = f"{self.base_url}{path}"
        headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json",
        }
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            try:
                err_body = json.loads(raw)
            except json.JSONDecodeError:
                err_body = {"raw": raw}
            raise RuntimeError(
                f"HTTP {e.code} {method} {path}: {err_body}"
            ) from None
        except urllib.error.URLError as e:
            raise RuntimeError(f"网络错误 {method} {url}: {e.reason}") from None

    def list_channels(self) -> list[dict]:
        """拉取全量 channel（admin API 支持分页时按 size=999 一次性取回）。"""
        # new-api 的 GetAllChannels 端点支持 page/page_size
        out: list[dict] = []
        page = 1
        page_size = 200
        while True:
            res = self._request(
                "GET", f"/api/channel/?p={page}&page_size={page_size}"
            )
            data = res.get("data") or {}
            items = data.get("items") if isinstance(data, dict) else data
            if not items:
                # 兼容老版本：data 直接是列表
                if isinstance(data, list):
                    items = data
                else:
                    items = []
            out.extend(items)
            if len(items) < page_size:
                break
            page += 1
        return out

    def add_channel(self, channel: dict, mode: str = "single") -> dict:
        return self._request(
            "POST",
            "/api/channel/",
            {
                "mode": mode,
                "multi_key_mode": "polling",
                "batch_add_set_key_prefix_2_name": False,
                "channel": channel,
            },
        )

    def update_channel(self, channel: dict) -> dict:
        return self._request("PUT", "/api/channel/", channel)


# ─── Channel 构造 ────────────────────────────────────────────────────────


def build_channel_payload(
    entry: dict, defaults: dict, env_key_value: str | None
) -> dict:
    """把 YAML 一条 channel 转成 new-api 期望的 JSON payload。"""
    status = STATUS_ENABLED if defaults.get("status", "enabled") == "enabled" else STATUS_DISABLED
    payload: dict[str, Any] = {
        "type": entry["type"],
        "name": entry["name"],
        "key": env_key_value or "",
        "models": ",".join(entry.get("models", [])),
        "group": entry.get("group", defaults.get("group", "default")),
        "priority": entry.get("priority", defaults.get("priority", 100)),
        "weight": entry.get("weight", defaults.get("weight", 10)),
        "status": status,
        "tag": entry.get("tag", ""),
    }
    if entry.get("base_url"):
        payload["base_url"] = entry["base_url"]
    if entry.get("test_model"):
        payload["test_model"] = entry["test_model"]
    if entry.get("model_mapping"):
        payload["model_mapping"] = json.dumps(entry["model_mapping"])
    return payload


# ─── 主流程 ─────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="DeepRouter seed-models：自动创建/更新所有 channel"
    )
    p.add_argument(
        "--base-url",
        default=os.environ.get("DEEPROUTER_BASE_URL"),
        help="DeepRouter 实例地址 (env: DEEPROUTER_BASE_URL)",
    )
    p.add_argument(
        "--admin-token",
        default=os.environ.get("DEEPROUTER_ADMIN_TOKEN"),
        help="管理员 access token (env: DEEPROUTER_ADMIN_TOKEN)",
    )
    p.add_argument(
        "--config",
        default=str(Path(__file__).parent / "channels.yaml"),
        help="YAML 配置文件路径（默认 ./channels.yaml）",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="只显示将要执行的操作，不发请求",
    )
    p.add_argument(
        "--only",
        help="只处理 name 包含此关键字的 channel（区分大小写）",
    )
    p.add_argument(
        "--include-disabled",
        action="store_true",
        help="也处理 YAML 里 enabled: false 的 channel（默认跳过）",
    )
    return p.parse_args()


def load_dotenv_if_present() -> None:
    """非常简单的 .env 加载，不依赖 python-dotenv。"""
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        # 不覆盖已经设置的环境变量（命令行/shell 优先）
        os.environ.setdefault(k, v)


def main() -> int:
    load_dotenv_if_present()
    args = parse_args()

    if not args.dry_run and (not args.base_url or not args.admin_token):
        sys.stderr.write(
            "缺 --base-url 或 --admin-token（也可设环境变量 "
            "DEEPROUTER_BASE_URL / DEEPROUTER_ADMIN_TOKEN）\n"
        )
        return 2

    config_path = Path(args.config)
    if not config_path.exists():
        sys.stderr.write(f"找不到配置文件：{config_path}\n")
        return 2

    with config_path.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    defaults = cfg.get("defaults", {})
    channels = cfg.get("channels", [])
    if not channels:
        sys.stderr.write("配置里没有 channels\n")
        return 2

    # 过滤
    todo: list[dict] = []
    for c in channels:
        if not args.include_disabled and not c.get("enabled", True):
            print(
                color(f"⊘ 跳过（disabled）", COLOR_GRAY),
                color(c["name"], COLOR_GRAY),
            )
            continue
        if args.only and args.only not in c["name"]:
            continue
        todo.append(c)

    if not todo:
        print("没有要处理的 channel")
        return 0

    print(f"\n准备处理 {len(todo)} 个 channel" + (" [DRY RUN]" if args.dry_run else ""))
    print("─" * 70)

    # 拉一次 existing channels 做 upsert 比对
    existing: dict[str, dict] = {}
    client: AdminClient | None = None
    if not args.dry_run:
        client = AdminClient(args.base_url, args.admin_token)
        try:
            for c in client.list_channels():
                existing[c["name"]] = c
        except RuntimeError as e:
            sys.stderr.write(f"拉取现有 channel 失败：{e}\n")
            return 3

    summary = {"created": 0, "updated": 0, "skipped_no_key": 0, "failed": 0}

    for entry in todo:
        name = entry["name"]
        key_env = entry.get("key_env", "")
        key_value = os.environ.get(key_env, "") if key_env else ""

        # 没设 key 的情况
        if not key_value and not args.dry_run:
            print(
                color("⚠ 跳过", COLOR_YELLOW),
                f"{name}：环境变量 {key_env} 未设置（请在 .env 或 shell 里配上游 key）",
            )
            summary["skipped_no_key"] += 1
            continue

        payload = build_channel_payload(entry, defaults, key_value)

        existing_ch = existing.get(name)
        if existing_ch:
            payload["id"] = existing_ch["id"]
            action = "UPDATE"
            color_label = COLOR_BLUE
        else:
            action = "CREATE"
            color_label = COLOR_GREEN

        model_count = len(entry.get("models", []))
        line = f"  {action:6s} {name}  (type={entry['type']}, models={model_count})"
        print(color(line, color_label))

        if args.dry_run:
            continue

        try:
            if existing_ch:
                client.update_channel(payload)
                summary["updated"] += 1
            else:
                mode = defaults.get("mode", "single")
                client.add_channel(payload, mode=mode)
                summary["created"] += 1
        except RuntimeError as e:
            print(color(f"      失败：{e}", COLOR_RED))
            summary["failed"] += 1

    print("─" * 70)
    print(
        f"完成：创建 {color(str(summary['created']), COLOR_GREEN)}  "
        f"更新 {color(str(summary['updated']), COLOR_BLUE)}  "
        f"跳过(缺 key) {color(str(summary['skipped_no_key']), COLOR_YELLOW)}  "
        f"失败 {color(str(summary['failed']), COLOR_RED)}"
    )
    if args.dry_run:
        print(color("[DRY RUN] 没有真正发请求", COLOR_GRAY))

    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
