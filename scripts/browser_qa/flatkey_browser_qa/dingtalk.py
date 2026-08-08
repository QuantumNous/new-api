import base64
import hashlib
import hmac
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


FINAL_STATUSES = frozenset(
    {"passed", "findings_detected", "replay_failed", "infrastructure_failed", "cleanup_failed"}
)
REPLAY_STATUSES = frozenset({"passed", "failed", "unknown"})
EXPLORATION_STATUSES = frozenset({"passed", "failed", "not_started", "unknown"})
CLEANUP_STATUSES = frozenset({"passed", "cleanup_failed", "unknown"})
CANDIDATE_STATUSES = frozenset(
    {"skipped", "passed", "cleanup_failed", "infrastructure_failed", "promotion_failed", "unknown"}
)
FINDING_SEVERITIES = frozenset({"critical", "high", "medium", "low"})
FINDING_CONFIDENCE = frozenset({"low", "medium", "high"})
FINAL_STATUS_LABELS = {
    "passed": "全部通过",
    "findings_detected": "发现问题",
    "replay_failed": "回放失败",
    "infrastructure_failed": "测试基础设施失败",
    "cleanup_failed": "清理失败",
}
PHASE_LABELS = {
    "passed": "通过",
    "failed": "失败",
    "not_started": "未开始",
    "unknown": "未知",
    "cleanup_failed": "清理失败",
}
SEVERITY_LABELS = {
    "critical": "严重",
    "high": "高",
    "medium": "中",
    "low": "低",
}
CONFIDENCE_LABELS = {
    "high": "高",
    "medium": "中",
    "low": "低",
}
CANDIDATE_STATUS_LABELS = {
    "skipped": "未执行",
    "passed": "验证完成",
    "cleanup_failed": "清理失败",
    "infrastructure_failed": "基础设施失败",
    "promotion_failed": "固化失败",
    "unknown": "未知",
}
GITHUB_RUN_URL = re.compile(
    r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[1-9][0-9]*"
)
GCS_MANIFEST_URI = re.compile(
    r"gs://[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]/runs/[0-9]+/manifest\.json"
)
URLSAFE_B64 = re.compile(r"[A-Za-z0-9_-]+={0,2}")
HTTP_URL_IN_TEXT = re.compile(r"https?://[^\s<>\[\]()`]+")
EMAIL_ADDRESS = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
OPENAI_SECRET_KEY = re.compile(r"\bsk-[A-Za-z0-9_-]{6,}\b")
SECRET_TERMS = re.compile(
    r"\b("
    r"verification|verification code|verify code|captcha|password|passcode|cookie|authorization|"
    r"webhook|signing secret|secret"
    r")\b",
    re.IGNORECASE,
)
LOCALIZED_SECRET_TERMS = ("验证码", "密码", "口令", "授权", "签名密钥", "机器人地址")
SIX_DIGIT_CODE = re.compile(r"(?<!\d)\d{6}(?!\d)")
MAX_RESPONSE_BYTES = 16 * 1024


class DingTalkDeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class DingTalkReport:
    final_status: str
    replay_status: str
    exploration_status: str
    exploration_actions: int
    finding_count: int
    cleanup_status: str
    github_run_url: str
    gcs_uri: str
    candidate_status: str
    candidate_count: int
    candidate_pr_bundle_count: int
    finding_summaries: tuple[dict, ...] = ()

    def __post_init__(self):
        _require_member("final_status", self.final_status, FINAL_STATUSES)
        _require_member("replay_status", self.replay_status, REPLAY_STATUSES)
        _require_member("exploration_status", self.exploration_status, EXPLORATION_STATUSES)
        _require_count("exploration_actions", self.exploration_actions)
        _require_count("finding_count", self.finding_count)
        _require_member("cleanup_status", self.cleanup_status, CLEANUP_STATUSES)
        if not isinstance(self.github_run_url, str) or GITHUB_RUN_URL.fullmatch(self.github_run_url) is None:
            raise ValueError("github_run_url is invalid")
        if not isinstance(self.gcs_uri, str) or GCS_MANIFEST_URI.fullmatch(self.gcs_uri) is None:
            raise ValueError("gcs_uri is invalid")
        _require_member("candidate_status", self.candidate_status, CANDIDATE_STATUSES)
        _require_count("candidate_count", self.candidate_count, maximum=20)
        _require_count("candidate_pr_bundle_count", self.candidate_pr_bundle_count, maximum=20)
        if self.candidate_pr_bundle_count > self.candidate_count:
            raise ValueError("candidate_pr_bundle_count is invalid")
        _validate_finding_summaries(self.finding_summaries)

    def markdown(self):
        title = _title(self)
        run_id = self.github_run_url.rsplit("/", 1)[-1]
        lines = [
            f"### {title}",
            f"> {_summary(self)}",
            f"- 最终状态：{_final_label(self.final_status)}（`{self.final_status}`）",
            f"- 录制回放：{_phase_label(self.replay_status)}（`{self.replay_status}`）",
            f"- AI 探索：{_phase_label(self.exploration_status)}（`{self.exploration_status}`）",
            f"- 探索动作数：`{self.exploration_actions}`",
            f"- 问题数量：`{self.finding_count}`",
            f"- 账号清理：{_phase_label(self.cleanup_status)}（`{self.cleanup_status}`）",
            f"- 候选固化：{_candidate_label(self.candidate_status)}（`{self.candidate_status}`）",
            f"- AI 候选总数：`{self.candidate_count}`",
            f"- 待人工审核 / Draft PR 数量：`{self.candidate_pr_bundle_count}`",
            f"- 运行记录：[Run {run_id}（点击查看）]({self.github_run_url})",
            f"- 证据文件：`{self.gcs_uri}`",
        ]
        if self.final_status == "findings_detected":
            lines.append("")
            lines.append("### 发现的问题")
            for item in self.finding_summaries:
                title = _markdown_escape(_strip_http_url_query_fragment(item["title"]))
                page_path = _markdown_escape(item["page_path"])
                severity = item["severity"]
                confidence = item["confidence"]
                lines.append(
                    f"- [{_severity_label(severity)}（`{severity}`）] {title}"
                    f"（置信度：{_confidence_label(confidence)}（`{confidence}`）；页面：{page_path}）"
                )
        return "\n".join(lines)

    def payload(self):
        return {
            "msgtype": "markdown",
            "markdown": {
                "title": _title(self),
                "text": self.markdown(),
            },
        }


def send_report(webhook, report, *, opener=None, sleeper=time.sleep, signing_secret=None):
    _validate_webhook(webhook)
    if not isinstance(report, DingTalkReport):
        raise TypeError("report must be DingTalkReport")
    if signing_secret is not None:
        _validate_signing_secret(signing_secret)
    if opener is None:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    body = json.dumps(report.payload(), ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    for attempt in range(3):
        request_url = _signed_webhook(webhook, signing_secret) if signing_secret is not None else webhook
        request = urllib.request.Request(
            request_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with opener.open(request, timeout=10) as response:
                status = getattr(response, "status", 200)
                if status == 429 or 500 <= status <= 599:
                    raise _TransientDeliveryError
                if status < 200 or status >= 300:
                    raise DingTalkDeliveryError("DingTalk notification was rejected")
                raw = response.read(MAX_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as exc:
            if exc.code == 429 or 500 <= exc.code <= 599:
                if attempt < 2:
                    sleeper(2**attempt)
                    continue
                raise DingTalkDeliveryError("DingTalk notification delivery failed after retries") from None
            raise DingTalkDeliveryError("DingTalk notification was rejected") from None
        except (urllib.error.URLError, TimeoutError, _TransientDeliveryError):
            if attempt < 2:
                sleeper(2**attempt)
                continue
            raise DingTalkDeliveryError("DingTalk notification delivery failed after retries") from None

        if len(raw) > MAX_RESPONSE_BYTES:
            raise DingTalkDeliveryError("DingTalk returned an invalid response")
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise DingTalkDeliveryError("DingTalk returned an invalid response") from None
        if not isinstance(payload, dict) or type(payload.get("errcode")) is not int:
            raise DingTalkDeliveryError("DingTalk returned an invalid response")
        if payload["errcode"] != 0:
            raise DingTalkDeliveryError("DingTalk notification was rejected")
        return

    raise DingTalkDeliveryError("DingTalk notification delivery failed after retries")


def main():
    report = DingTalkReport(
        final_status=_required_env("BROWSER_QA_FINAL_STATUS"),
        replay_status=_required_env("BROWSER_QA_REPLAY_STATUS"),
        exploration_status=_required_env("BROWSER_QA_EXPLORATION_STATUS"),
        exploration_actions=_env_count("BROWSER_QA_EXPLORATION_ACTIONS"),
        finding_count=_env_count("BROWSER_QA_FINDING_COUNT"),
        cleanup_status=_required_env("BROWSER_QA_CLEANUP_STATUS"),
        github_run_url=_required_env("BROWSER_QA_GITHUB_RUN_URL"),
        gcs_uri=_required_env("BROWSER_QA_GCS_URI"),
        candidate_status=_required_env("BROWSER_QA_CANDIDATE_STATUS"),
        candidate_count=_env_count("BROWSER_QA_CANDIDATE_COUNT"),
        candidate_pr_bundle_count=_env_count("BROWSER_QA_CANDIDATE_PR_BUNDLE_COUNT"),
        finding_summaries=_env_finding_summaries("BROWSER_QA_FINDING_SUMMARIES_B64"),
    )
    send_report(_required_env("DINGTALK_WEBHOOK"), report, signing_secret=_required_env("DINGTALK_SIGNING_SECRET"))
    print("DINGTALK_NOTIFICATION_SENT")
    return 0


class _TransientDeliveryError(Exception):
    pass


def _final_label(status):
    return FINAL_STATUS_LABELS[status]


def _phase_label(status):
    return PHASE_LABELS[status]


def _severity_label(severity):
    return SEVERITY_LABELS[severity]


def _confidence_label(confidence):
    return CONFIDENCE_LABELS[confidence]


def _candidate_label(status):
    return CANDIDATE_STATUS_LABELS[status]


def _candidate_failed(status):
    return status in {"cleanup_failed", "infrastructure_failed", "promotion_failed", "unknown"}


def _title(report):
    suffix = " / 候选固化异常" if _candidate_failed(report.candidate_status) else ""
    return f"Staging 浏览器 QA：{_final_label(report.final_status)}{suffix}"


def _product_summary(final_status, finding_count):
    if final_status == "passed":
        if finding_count > 0:
            return f"测试已执行完成，但报告记录了 {finding_count} 个需要关注的问题，请核对最终状态。"
        return "测试已执行完成，未发现需要关注的问题。"
    if final_status == "findings_detected":
        return f"测试已执行完成，AI 发现 {finding_count} 个需要关注的问题；当前策略只告警，不会自动回滚。"
    if final_status == "replay_failed":
        return "录制回放没有走完，请检查失败步骤。"
    if final_status == "infrastructure_failed":
        return "测试环境、浏览器、任务或证据链异常，本次结果不能用于判断产品是否正常。"
    return "测试结束，但临时账号或资源未被确认清理，请优先处理。"


def _candidate_summary(report):
    if report.candidate_status == "skipped":
        return "候选固化：本次无候选或当前模式未执行候选固化。"
    if report.candidate_status == "passed":
        return (
            f"候选验证完成；AI 候选总数 {report.candidate_count} 个，"
            f"{report.candidate_pr_bundle_count} 个已达到待人工审核或 Draft PR 条件；仍需人工审核和 merge。"
        )
    if report.candidate_status == "cleanup_failed":
        return "候选固化异常：候选验证清理失败，请优先处理；不能晋级。"
    if report.candidate_status == "infrastructure_failed":
        return "候选固化异常：候选验证基础设施失败，不能作为产品结论。"
    if report.candidate_status == "promotion_failed":
        return "候选固化异常：候选 3/3 状态不一致或聚合失败，不能自动固化。"
    return "候选固化异常：候选步骤未能输出可信状态，工作流会失败；需查看 GitHub Actions。"


def _summary(report):
    return f"{_product_summary(report.final_status, report.finding_count)} {_candidate_summary(report)}"


def _require_member(name, value, allowed):
    if not isinstance(value, str) or value not in allowed:
        raise ValueError(f"{name} is invalid")


def _require_count(name, value, *, maximum=None):
    if type(value) is not int or value < 0 or (maximum is not None and value > maximum):
        raise ValueError(f"{name} is invalid")


def _required_env(name):
    value = os.environ.get(name)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{name} is required")
    return value


def _env_count(name):
    value = _required_env(name)
    if not value.isascii() or not value.isdecimal():
        raise ValueError(f"{name} is invalid")
    return int(value)


def _env_finding_summaries(name):
    value = os.environ.get(name)
    if value is None:
        return ()
    if not isinstance(value, str) or not value or len(value) % 4 != 0 or URLSAFE_B64.fullmatch(value) is None:
        raise ValueError(f"{name} is invalid")
    try:
        raw = base64.b64decode(value.encode("ascii"), altchars=b"-_", validate=True)
        if base64.urlsafe_b64encode(raw).decode("ascii") != value:
            raise ValueError
        payload = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        raise ValueError(f"{name} is invalid") from None
    if not isinstance(payload, list):
        raise ValueError(f"{name} is invalid")
    summaries = tuple(payload)
    try:
        _validate_finding_summaries(summaries)
    except ValueError:
        raise ValueError(f"{name} is invalid") from None
    return summaries


def _validate_finding_summaries(summaries):
    if not isinstance(summaries, tuple) or len(summaries) > 3:
        raise ValueError("finding_summaries is invalid")
    for item in summaries:
        if not isinstance(item, dict) or set(item) != {"severity", "title", "confidence", "page_path"}:
            raise ValueError("finding_summaries is invalid")
        _require_member("finding severity", item["severity"], FINDING_SEVERITIES)
        _require_member("finding confidence", item["confidence"], FINDING_CONFIDENCE)
        _validate_finding_title(item["title"])
        _validate_finding_page_path(item["page_path"])


def _validate_finding_title(title):
    if not isinstance(title, str) or not title:
        raise ValueError("finding title is invalid")
    folded = " ".join(title.split())
    if title != folded or len(title) > 160 or _has_control_character(title):
        raise ValueError("finding title is invalid")
    if _is_sensitive_finding_title(title):
        raise ValueError("finding title is invalid")


def _validate_finding_page_path(page_path):
    if (
        not isinstance(page_path, str)
        or not page_path.startswith("/")
        or "?" in page_path
        or "#" in page_path
        or _has_control_character(page_path)
    ):
        raise ValueError("finding page_path is invalid")


def _has_control_character(value):
    return any(unicodedata.category(char).startswith("C") for char in value)


def _is_sensitive_finding_title(title):
    return (
        OPENAI_SECRET_KEY.search(title) is not None
        or EMAIL_ADDRESS.search(title) is not None
        or SECRET_TERMS.search(title) is not None
        or any(term in title for term in LOCALIZED_SECRET_TERMS)
        or SIX_DIGIT_CODE.search(title) is not None
    )


def _markdown_escape(value):
    escaped = []
    for char in value:
        if char in "\\[]()<>*_`":
            escaped.append("\\")
        escaped.append(char)
    return "".join(escaped)


def _strip_http_url_query_fragment(value):
    def strip(match):
        url = match.group(0)
        parsed = urllib.parse.urlsplit(url)
        return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))

    return HTTP_URL_IN_TEXT.sub(strip, value)


def _validate_webhook(webhook):
    if not isinstance(webhook, str):
        raise ValueError("DingTalk webhook is invalid")
    parsed = urllib.parse.urlsplit(webhook)
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "oapi.dingtalk.com"
        or parsed.port is not None
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path != "/robot/send"
        or parsed.fragment
        or set(query) != {"access_token"}
        or len(query["access_token"]) != 1
        or not query["access_token"][0]
    ):
        raise ValueError("DingTalk webhook is invalid")


def _validate_signing_secret(signing_secret):
    if not isinstance(signing_secret, str) or not signing_secret:
        raise ValueError("DingTalk signing secret is invalid")


def _signed_webhook(webhook, signing_secret):
    timestamp = str(int(time.time() * 1000))
    string_to_sign = f"{timestamp}\n{signing_secret}".encode("utf-8")
    signature = base64.b64encode(
        hmac.new(signing_secret.encode("utf-8"), string_to_sign, hashlib.sha256).digest()
    ).decode("utf-8")
    parsed = urllib.parse.urlsplit(webhook)
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    query.extend([("timestamp", timestamp), ("sign", signature)])
    return urllib.parse.urlunsplit(parsed._replace(query=urllib.parse.urlencode(query)))


if __name__ == "__main__":
    raise SystemExit(main())
