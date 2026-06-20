#!/usr/bin/env python3
"""
seed_options.py — 把「安全、不需你决策」的系统设置默认值一键灌进 DeepRouter 实例。

配套 seed.py（渠道/模型）。本脚本只动 system options，走 PUT /api/option/（需 root token）。
设计原则：
  - 只写已在 model/option.go::InitOptionMap 核验过的 key，避免 no-op。
  - 只设运营类安全默认（限流/重试/监控/绘图安全/导航/额度等）。
  - 绝不碰：密钥、品牌名、域名、汇率、支付、SMTP、OAuth、Turnstile —— 这些留给你手动填。
  - JSON 类的值按字符串原样发送（后端对非 bool/数字一律 %v 存储）。

用法：
  cp .env.example .env        # 或复用 seed.py 的同一个 .env
  python3 seed_options.py --dry-run
  python3 seed_options.py
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error

# ── 复用 seed.py 同款 .env 加载（stdlib，零依赖）──────────────────────────
def load_dotenv(path: str = ".env") -> None:
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


# ── 要写入的安全默认值 ────────────────────────────────────────────────────
# (key, value, 说明)。value 为 bool/int 直传；JSON/列表类用字符串。
SAFE_OPTIONS = [
    # —— 系统行为 ——
    ("RetryTimes", 3, "请求失败重试次数"),
    ("DefaultCollapseSidebar", True, "默认折叠侧栏"),
    ("SelfUseModeEnabled", False, "关闭自用模式（多用户商业站）"),
    ("DemoSiteEnabled", False, "关闭演示站模式"),
    ("DefaultUseAutoGroup", False, "新用户默认不启用自动分组"),

    # —— 监控与告警 ——
    ("AutomaticDisableChannelEnabled", True, "故障自动禁用渠道"),
    ("AutomaticEnableChannelEnabled", False, "恢复不自动启用（人工复核）"),
    ("ChannelDisableThreshold", 30, "测试超时阈值(秒)，超则自动禁用"),
    ("AutomaticDisableKeywords",
     "Your credit balance is too low\nquota exceeded\ninsufficient_quota",
     "命中关键词则禁用渠道"),
    ("AutomaticDisableStatusCodes", "429,500-503", "触发禁用的 HTTP 状态码"),
    ("AutomaticRetryStatusCodes", "429,502,503", "触发重试的 HTTP 状态码"),

    # —— 速率限制 ——
    ("ModelRequestRateLimitEnabled", True, "开启请求频率限制"),
    ("ModelRequestRateLimitDurationMinutes", 60, "限流周期(分钟)"),
    ("ModelRequestRateLimitCount", 200, "周期内最大请求数(含失败)"),
    ("ModelRequestRateLimitSuccessCount", 100, "周期内最大成功请求数"),
    ("ModelRequestRateLimitGroup", '{"default":[200,100],"vip":[0,1000]}',
     "分组限流 [最大请求,最大成功]，0=不限"),

    # —— 敏感词（开关；词表留空=无副作用，需要时再加）——
    ("CheckSensitiveEnabled", True, "开启敏感词检查（词表空则不拦截）"),
    ("CheckSensitiveOnPromptEnabled", True, "在请求到上游前检查用户输入"),
    ("StopOnSensitiveEnabled", True, "命中敏感词则中断（词表空则不触发）"),

    # —— 绘图安全（Midjourney 风格）——
    ("DrawingEnabled", True, "开启绘图功能"),
    ("MjNotifyEnabled", False, "关闭上游回调（隐藏服务器 IP）"),
    ("MjAccountFilterEnabled", True, "允许 accountFilter 参数"),
    ("MjForwardUrlEnabled", True, "回调 URL 重写到本地"),
    ("MjModeClearEnabled", True, "清除 --fast/--relax/--turbo 模式标志"),
    ("MjActionCheckSuccessEnabled", True, "要求任务成功后才能后续操作"),

    # —— 日志与展示 ——
    ("LogConsumeEnabled", True, "记录 API 请求日志"),
    ("DisplayInCurrencyEnabled", True, "以货币显示价格"),
    ("DisplayTokenStatEnabled", True, "显示 Token 消费统计"),
    ("DataExportEnabled", True, "开启数据看板"),
    ("DataExportInterval", 30, "数据看板刷新间隔(分钟)"),

    # —— 额度 / 拉新（数值可后续在 UI 调）——
    ("QuotaForNewUser", 20000, "新用户赠送额度"),
    ("PreConsumedQuota", 8000, "预消费额度"),
    ("QuotaForInviter", 15000, "邀请人奖励"),
    ("QuotaForInvitee", 10000, "被邀请人奖励"),

    # —— 基本认证（安全侧，不涉及密钥）——
    ("PasswordLoginEnabled", True, "允许密码登录"),
    ("RegisterEnabled", True, "允许注册"),
    ("PasswordRegisterEnabled", True, "允许密码注册"),
    ("EmailAliasRestrictionEnabled", True, "禁止 user+alias@ 刷注册"),
]

# 需你手动配（脚本故意不碰）——仅打印提醒
MANUAL_ITEMS = [
    "SystemName / ServerAddress / Logo / Footer  —— 品牌与域名",
    "USDExchangeRate / Price / MinTopUp           —— 充值汇率与价格",
    "Epay/Stripe/Waffo/Airwallex 各支付密钥       —— 支付网关",
    "SMTPServer/Port/Account/Token/From           —— 邮件服务",
    "Turnstile SiteKey/SecretKey                  —— 人机验证",
    "GitHub/微信/Telegram/OIDC 各 OAuth client     —— 第三方登录",
    "ModelRatio / GroupRatio                      —— 模型与分组定价（按你的成本/利润定）",
]

C_GREEN, C_YEL, C_RED, C_DIM, C_RST = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"


def put_option(base_url: str, token: str, key: str, value, timeout: int = 30):
    url = base_url.rstrip("/") + "/api/option/"
    body = json.dumps({"key": key, "value": value}).encode()
    req = urllib.request.Request(
        url, data=body, method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "New-Api-User": os.environ.get("DEEPROUTER_USER_ID", "1"),
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode())
    return data


def main() -> int:
    p = argparse.ArgumentParser(description="灌入安全的系统设置默认值")
    p.add_argument("--base-url", default=os.environ.get("DEEPROUTER_BASE_URL"))
    p.add_argument("--admin-token", default=os.environ.get("DEEPROUTER_ADMIN_TOKEN"),
                   help="root 角色的 access token")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--env", default=".env")
    args, _ = p.parse_known_args()

    load_dotenv(args.env)
    base_url = args.base_url or os.environ.get("DEEPROUTER_BASE_URL")
    token = args.admin_token or os.environ.get("DEEPROUTER_ADMIN_TOKEN")

    print(f"目标实例: {base_url or '(未设置)'}")
    print(f"准备写入 {len(SAFE_OPTIONS)} 项系统设置" + (" [DRY RUN]" if args.dry_run else ""))
    print("─" * 70)

    if not args.dry_run and (not base_url or not token):
        print(f"{C_RED}缺 DEEPROUTER_BASE_URL 或 DEEPROUTER_ADMIN_TOKEN（需 root token）{C_RST}")
        print("先在 .env 填好，或用 --base-url / --admin-token 传入。")
        return 2

    ok = fail = 0
    for key, value, desc in SAFE_OPTIONS:
        shown = value if not isinstance(value, str) or len(value) <= 40 else value[:37] + "..."
        if args.dry_run:
            print(f"  {C_DIM}SET{C_RST} {key:<38} = {shown}   {C_DIM}# {desc}{C_RST}")
            continue
        try:
            res = put_option(base_url, token, key, value)
            if res.get("success"):
                ok += 1
                print(f"  {C_GREEN}✓{C_RST} {key:<38} = {shown}")
            else:
                fail += 1
                print(f"  {C_RED}✗{C_RST} {key:<38} {res.get('message')}")
        except urllib.error.HTTPError as e:
            fail += 1
            print(f"  {C_RED}✗{C_RST} {key:<38} HTTP {e.code}")
        except Exception as e:  # noqa
            fail += 1
            print(f"  {C_RED}✗{C_RST} {key:<38} {e}")

    print("─" * 70)
    if args.dry_run:
        print("[DRY RUN] 没有真正发请求")
    else:
        print(f"完成：成功 {C_GREEN}{ok}{C_RST}  失败 {C_RED}{fail}{C_RST}")

    print(f"\n{C_YEL}以下需你手动配（脚本未碰，因涉及密钥/品牌/定价决策）：{C_RST}")
    for m in MANUAL_ITEMS:
        print(f"  • {m}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
