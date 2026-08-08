import base64
import hashlib
import hmac
import io
import json
import os
import unittest
import urllib.error
import urllib.parse
from contextlib import redirect_stdout
from unittest import mock

try:
    from scripts.browser_qa.flatkey_browser_qa import dingtalk
except ImportError:
    dingtalk = None


WEBHOOK = "https://oapi.dingtalk.com/robot/send?access_token=super-secret-webhook-token"


class FakeResponse:
    def __init__(self, status, payload):
        self.status = status
        self.payload = payload

    def read(self, _limit=-1):
        if isinstance(self.payload, bytes):
            return self.payload
        return json.dumps(self.payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class RecordingOpener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def open(self, request, timeout=0):
        self.requests.append((request, timeout))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class DingTalkModuleContractTests(unittest.TestCase):
    def test_dingtalk_module_is_available(self):
        self.assertIsNotNone(dingtalk, "DingTalk notification module is missing")


@unittest.skipIf(dingtalk is None, "DingTalk notification module is not implemented yet")
class DingTalkTests(unittest.TestCase):
    def report(self, **overrides):
        values = {
            "final_status": "passed",
            "replay_status": "passed",
            "exploration_status": "not_started",
            "exploration_actions": 0,
            "finding_count": 0,
            "cleanup_status": "passed",
            "github_run_url": "https://github.com/SolveaCX/new-api/actions/runs/12345",
            "gcs_uri": "gs://vocai-gemini-prod-flatkey-browser-qa-reports/runs/12345/manifest.json",
            "candidate_status": "skipped",
            "candidate_count": 0,
            "candidate_pr_bundle_count": 0,
            "finding_summaries": (),
        }
        values.update(overrides)
        return dingtalk.DingTalkReport(**values)

    def test_report_renders_only_the_closed_sanitized_contract(self):
        report = self.report()

        markdown = report.markdown()
        payload = report.payload()

        self.assertEqual(payload["msgtype"], "markdown")
        self.assertEqual(payload["markdown"]["title"], "Staging 浏览器 QA：全部通过")
        self.assertEqual(payload["markdown"]["text"], markdown)
        for expected in [
            "### Staging 浏览器 QA：全部通过",
            "> 测试已执行完成，未发现需要关注的问题。",
            "最终状态：全部通过（`passed`）",
            "录制回放：通过（`passed`）",
            "AI 探索：未开始（`not_started`）",
            "探索动作数：`0`",
            "问题数量：`0`",
            "账号清理：通过（`passed`）",
            "运行记录：[Run 12345（点击查看）](https://github.com/SolveaCX/new-api/actions/runs/12345)",
            "证据文件：`gs://vocai-gemini-prod-flatkey-browser-qa-reports/runs/12345/manifest.json`",
        ]:
            self.assertIn(expected, markdown)
        for forbidden in [
            "Final status:",
            "Replay status:",
            "Exploration status:",
            "Exploration actions:",
            "Finding count:",
            "Cleanup status:",
            "Run:",
            "Evidence:",
            "### Findings",
        ]:
            self.assertNotIn(forbidden, markdown)
        for forbidden in ["gmail", "password", "verification", "api key", "cookie", "authorization", "super-secret"]:
            self.assertNotIn(forbidden, markdown.lower())

    def test_report_renders_all_candidate_statuses_with_chinese_summary_counts_and_raw_code(self):
        cases = [
            (
                "skipped",
                0,
                0,
                "未执行",
                "本次无候选或当前模式未执行候选固化",
            ),
            (
                "passed",
                3,
                2,
                "验证完成",
                "候选验证完成；AI 候选总数 3 个，2 个已达到待人工审核或 Draft PR 条件；仍需人工审核和 merge",
            ),
            (
                "cleanup_failed",
                2,
                1,
                "清理失败",
                "候选验证清理失败，请优先处理；不能晋级",
            ),
            (
                "infrastructure_failed",
                2,
                0,
                "基础设施失败",
                "候选验证基础设施失败，不能作为产品结论",
            ),
            (
                "promotion_failed",
                2,
                0,
                "固化失败",
                "候选 3/3 状态不一致或聚合失败，不能自动固化",
            ),
            (
                "unknown",
                1,
                0,
                "未知",
                "候选步骤未能输出可信状态，工作流会失败；需查看 GitHub Actions",
            ),
        ]
        for status, count, bundle_count, label, summary in cases:
            with self.subTest(status=status):
                report = self.report(
                    candidate_status=status,
                    candidate_count=count,
                    candidate_pr_bundle_count=bundle_count,
                )
                markdown = report.markdown()

                self.assertIn(f"候选固化：{label}（`{status}`）", markdown)
                self.assertIn(f"AI 候选总数：`{count}`", markdown)
                self.assertIn(f"待人工审核 / Draft PR 数量：`{bundle_count}`", markdown)
                self.assertIn(summary, markdown)

    def test_candidate_failure_overrides_product_passed_title_and_summary_without_rewriting_final_status(self):
        report = self.report(
            final_status="passed",
            finding_count=0,
            candidate_status="promotion_failed",
            candidate_count=2,
            candidate_pr_bundle_count=0,
        )

        markdown = report.markdown()
        payload = report.payload()

        self.assertEqual(report.final_status, "passed")
        self.assertIn("候选固化异常", payload["markdown"]["title"])
        self.assertIn("候选固化异常", markdown)
        self.assertIn("最终状态：全部通过（`passed`）", markdown)
        self.assertIn("候选 3/3 状态不一致或聚合失败，不能自动固化", markdown)

    def test_candidate_counts_are_closed_non_negative_bounded_and_consistent(self):
        invalid_overrides = [
            {"candidate_status": "done"},
            {"candidate_count": -1},
            {"candidate_count": True},
            {"candidate_count": "1"},
            {"candidate_count": 21},
            {"candidate_pr_bundle_count": -1},
            {"candidate_pr_bundle_count": False},
            {"candidate_pr_bundle_count": "1"},
            {"candidate_pr_bundle_count": 21},
            {"candidate_count": 1, "candidate_pr_bundle_count": 2},
        ]
        for override in invalid_overrides:
            with self.subTest(override=override):
                with self.assertRaises(ValueError):
                    self.report(**override)

        report = self.report(candidate_status="passed", candidate_count=20, candidate_pr_bundle_count=20)
        self.assertIn("AI 候选总数：`20`", report.markdown())

    def test_report_renders_all_terminal_statuses_with_chinese_summary_and_raw_code(self):
        cases = [
            (
                "passed",
                0,
                "全部通过",
                "测试已执行完成，未发现需要关注的问题。",
            ),
            (
                "findings_detected",
                2,
                "发现问题",
                "测试已执行完成，AI 发现 2 个需要关注的问题；当前策略只告警，不会自动回滚。",
            ),
            (
                "replay_failed",
                0,
                "回放失败",
                "录制回放没有走完，请检查失败步骤。",
            ),
            (
                "infrastructure_failed",
                0,
                "测试基础设施失败",
                "测试环境、浏览器、任务或证据链异常，本次结果不能用于判断产品是否正常。",
            ),
            (
                "cleanup_failed",
                0,
                "清理失败",
                "测试结束，但临时账号或资源未被确认清理，请优先处理。",
            ),
        ]
        summaries = (
            {"severity": "high", "title": "登录入口跳转到错误页面", "confidence": "high", "page_path": "/admin"},
            {"severity": "medium", "title": "API Key label is visible", "confidence": "medium", "page_path": "/keys"},
        )
        for final_status, finding_count, label, summary in cases:
            with self.subTest(final_status=final_status):
                report = self.report(
                    final_status=final_status,
                    finding_count=finding_count,
                    finding_summaries=summaries if final_status == "findings_detected" else (),
                )
                markdown = report.markdown()

                self.assertEqual(report.payload()["markdown"]["title"], f"Staging 浏览器 QA：{label}")
                self.assertIn(f"### Staging 浏览器 QA：{label}", markdown)
                self.assertIn(f"> {summary}", markdown)
                self.assertIn(f"最终状态：{label}（`{final_status}`）", markdown)

    def test_passed_report_with_findings_uses_consistency_warning_summary(self):
        report = self.report(final_status="passed", finding_count=2)

        markdown = report.markdown()

        self.assertIn("> 测试已执行完成，但报告记录了 2 个需要关注的问题，请核对最终状态。", markdown)
        self.assertNotIn("> 测试已执行完成，未发现需要关注的问题。", markdown)
        self.assertIn("问题数量：`2`", markdown)
        self.assertIn("最终状态：全部通过（`passed`）", markdown)

    def test_report_renders_phase_severity_and_confidence_labels_with_raw_codes(self):
        report = self.report(
            final_status="findings_detected",
            replay_status="failed",
            exploration_status="unknown",
            cleanup_status="cleanup_failed",
            finding_count=3,
            finding_summaries=(
                {"severity": "critical", "title": "严重页面断流", "confidence": "low", "page_path": "/critical"},
                {"severity": "low", "title": "低优先级布局偏移", "confidence": "medium", "page_path": "/low"},
                {"severity": "medium", "title": "中优先级状态异常", "confidence": "high", "page_path": "/medium"},
            ),
        )
        not_started = self.report(exploration_status="not_started").markdown()
        passed = self.report(replay_status="passed", cleanup_status="passed").markdown()

        markdown = report.markdown()

        for expected in [
            "录制回放：失败（`failed`）",
            "AI 探索：未知（`unknown`）",
            "账号清理：清理失败（`cleanup_failed`）",
            "AI 探索：未开始（`not_started`）",
            "录制回放：通过（`passed`）",
            "账号清理：通过（`passed`）",
            "- [严重（`critical`）] 严重页面断流（置信度：低（`low`）；页面：/critical）",
            "- [低（`low`）] 低优先级布局偏移（置信度：中（`medium`）；页面：/low）",
            "- [中（`medium`）] 中优先级状态异常（置信度：高（`high`）；页面：/medium）",
        ]:
            self.assertIn(expected, "\n".join([markdown, not_started, passed]))

    def test_report_renders_alert_findings_only_for_findings_detected(self):
        summaries = (
            {"severity": "high", "title": "登录入口跳转到错误页面", "confidence": "high", "page_path": "/admin"},
            {"severity": "medium", "title": "API Key label is visible", "confidence": "medium", "page_path": "/keys"},
        )

        alert = self.report(final_status="findings_detected", finding_count=2, finding_summaries=summaries)
        passed = self.report(final_status="passed", finding_count=2, finding_summaries=summaries)
        failed = self.report(final_status="cleanup_failed", finding_count=2, finding_summaries=summaries)

        self.assertEqual(alert.payload()["markdown"]["title"], "Staging 浏览器 QA：发现问题")
        self.assertIn("### 发现的问题", alert.markdown())
        self.assertIn("- [高（`high`）] 登录入口跳转到错误页面（置信度：高（`high`）；页面：/admin）", alert.markdown())
        self.assertIn("- [中（`medium`）] API Key label is visible（置信度：中（`medium`）；页面：/keys）", alert.markdown())
        self.assertEqual(passed.payload()["markdown"]["title"], "Staging 浏览器 QA：全部通过")
        self.assertNotIn("### 发现的问题", passed.markdown())
        self.assertEqual(failed.payload()["markdown"]["title"], "Staging 浏览器 QA：清理失败")
        self.assertNotIn("### 发现的问题", failed.markdown())

    def test_report_escapes_untrusted_markdown_in_finding_text(self):
        report = self.report(
            final_status="findings_detected",
            finding_count=1,
            finding_summaries=(
                {
                    "severity": "high",
                    "title": "[x](https://evil.example) <b>*_`\\",
                    "confidence": "high",
                    "page_path": "/docs/[x](https://evil.example)<b>*_`\\",
                },
            ),
        )

        markdown = report.markdown()

        self.assertIn(r"\[x\]\(https://evil.example\) \<b\>\*\_\`\\", markdown)
        self.assertIn(r"/docs/\[x\]\(https://evil.example\)\<b\>\*\_\`\\", markdown)
        self.assertNotIn("[x](https://evil.example)", markdown)
        self.assertNotIn("<b>", markdown)

    def test_report_strips_query_and_fragment_from_urls_in_finding_titles(self):
        report = self.report(
            final_status="findings_detected",
            finding_count=2,
            finding_summaries=(
                {
                    "severity": "high",
                    "title": "Docs: https://staging.example/app?debug=true#panel",
                    "confidence": "high",
                    "page_path": "/docs",
                },
                {
                    "severity": "low",
                    "title": "Docs root: https://staging.example/app",
                    "confidence": "low",
                    "page_path": "/docs/root",
                },
            ),
        )

        markdown = report.markdown()

        self.assertIn("Docs: https://staging.example/app", markdown)
        self.assertIn("Docs root: https://staging.example/app", markdown)
        self.assertNotIn("debug=true", markdown)
        self.assertNotIn("#panel", markdown)

    def test_report_rejects_untrusted_status_counts_and_urls(self):
        invalid_overrides = [
            {"final_status": "passed\npassword=leak"},
            {"replay_status": "unknown-status"},
            {"exploration_status": "running"},
            {"cleanup_status": "deleted"},
            {"exploration_actions": -1},
            {"exploration_actions": True},
            {"finding_count": "0"},
            {"github_run_url": "https://evil.example/actions/runs/12345"},
            {"gcs_uri": "https://storage.googleapis.com/report"},
            {"finding_summaries": []},
            {"finding_summaries": ({"severity": "high", "title": "Leak", "confidence": "high", "page_path": "/admin", "extra": "bad"},)},
            {"finding_summaries": tuple({"severity": "high", "title": "Leak", "confidence": "high", "page_path": f"/{index}"} for index in range(4))},
            {"finding_summaries": ({"severity": "info", "title": "Info", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "bad\ncontrol", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "bad\u202eformat", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "a" * 161, "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "sk-live-secret", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "owner@example.com", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "password leaked", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "验证码 123456", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "密码泄露", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "123456", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "Authorization header leaked", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "Webhook signing secret", "confidence": "high", "page_path": "/admin"},)},
            {"finding_summaries": ({"severity": "high", "title": "Leak", "confidence": "high", "page_path": "relative"},)},
            {"finding_summaries": ({"severity": "high", "title": "Leak", "confidence": "high", "page_path": "/admin?token=secret"},)},
            {"finding_summaries": ({"severity": "high", "title": "Leak", "confidence": "high", "page_path": "/admin#secret"},)},
            {"finding_summaries": ({"severity": "high", "title": "Leak", "confidence": "high", "page_path": "/admin\nsecret"},)},
            {"finding_summaries": ({"severity": "high", "title": "Leak", "confidence": "high", "page_path": "/admin\u202e"},)},
        ]
        for override in invalid_overrides:
            with self.subTest(override=override):
                with self.assertRaises(ValueError):
                    self.report(**override)

        allowed = self.report(
            final_status="findings_detected",
            finding_count=1,
            finding_summaries=(
                {
                    "severity": "medium",
                    "title": "API Key dialog validation",
                    "confidence": "medium",
                    "page_path": "/settings/20260806",
                },
            ),
        )
        self.assertIn("API Key dialog validation", allowed.markdown())

    def test_report_rejects_sensitive_titles_without_echoing_them(self):
        for title in ["验证码 123456", "密码泄露", "123456"]:
            with self.subTest(title=title):
                with self.assertRaises(ValueError) as raised:
                    self.report(
                        final_status="findings_detected",
                        finding_count=1,
                        finding_summaries=(
                            {"severity": "high", "title": title, "confidence": "high", "page_path": "/admin"},
                        ),
                    )
                self.assertNotIn(title, str(raised.exception))

    def test_delivery_retries_transient_failures_and_requires_errcode_zero(self):
        opener = RecordingOpener(
            [
                urllib.error.URLError("temporary timeout"),
                urllib.error.HTTPError(WEBHOOK, 503, "busy", {}, io.BytesIO(b"{}")),
                FakeResponse(200, {"errcode": 0, "errmsg": "ok"}),
            ]
        )
        delays = []

        dingtalk.send_report(WEBHOOK, self.report(), opener=opener, sleeper=delays.append)

        self.assertEqual(len(opener.requests), 3)
        self.assertEqual(delays, [1, 2])
        request, timeout = opener.requests[-1]
        self.assertEqual(request.full_url, WEBHOOK)
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.headers["Content-type"], "application/json")
        self.assertEqual(timeout, 10)
        sent_payload = json.loads(request.data)
        self.assertEqual(sent_payload, self.report().payload())
        self.assertNotIn(WEBHOOK, json.dumps(sent_payload))

    def test_delivery_adds_timestamp_and_hmac_signature_when_secret_is_configured(self):
        opener = RecordingOpener([FakeResponse(200, {"errcode": 0, "errmsg": "ok"})])
        secret = "test-signing-secret"
        timestamp = "1700000000123"
        expected_sign = base64.b64encode(
            hmac.new(secret.encode("utf-8"), f"{timestamp}\n{secret}".encode("utf-8"), hashlib.sha256).digest()
        ).decode("utf-8")

        with mock.patch.object(dingtalk.time, "time", return_value=1700000000.123):
            dingtalk.send_report(WEBHOOK, self.report(), opener=opener, sleeper=lambda _: None, signing_secret=secret)

        request, _timeout = opener.requests[0]
        parsed = urllib.parse.urlsplit(request.full_url)
        query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "oapi.dingtalk.com")
        self.assertEqual(parsed.path, "/robot/send")
        self.assertEqual(query["access_token"], ["super-secret-webhook-token"])
        self.assertEqual(query["timestamp"], [timestamp])
        self.assertEqual(query["sign"], [expected_sign])
        self.assertNotIn(secret, request.full_url)
        self.assertNotIn(expected_sign, json.dumps(json.loads(request.data)))

    def test_delivery_fails_closed_without_echoing_webhook_or_remote_error(self):
        opener = RecordingOpener(
            [FakeResponse(200, {"errcode": 310000, "errmsg": "super-secret-webhook-token keyword rejected"})]
        )

        with self.assertRaises(dingtalk.DingTalkDeliveryError) as raised:
            dingtalk.send_report(WEBHOOK, self.report(), opener=opener, sleeper=lambda _: None)

        message = str(raised.exception)
        self.assertNotIn(WEBHOOK, message)
        self.assertNotIn("super-secret-webhook-token", message)
        self.assertEqual(len(opener.requests), 1)

    def test_main_reads_environment_and_prints_only_delivery_marker(self):
        summaries_json = json.dumps(
            [{"severity": "high", "title": "Unsafe redirect", "confidence": "high", "page_path": "/admin"}]
        ).encode("utf-8")
        env = {
            "DINGTALK_WEBHOOK": WEBHOOK,
            "DINGTALK_SIGNING_SECRET": "main-signing-secret",
            "BROWSER_QA_FINAL_STATUS": "findings_detected",
            "BROWSER_QA_REPLAY_STATUS": "failed",
            "BROWSER_QA_EXPLORATION_STATUS": "not_started",
            "BROWSER_QA_EXPLORATION_ACTIONS": "0",
            "BROWSER_QA_FINDING_COUNT": "1",
            "BROWSER_QA_CLEANUP_STATUS": "passed",
            "BROWSER_QA_GITHUB_RUN_URL": "https://github.com/SolveaCX/new-api/actions/runs/12345",
            "BROWSER_QA_GCS_URI": "gs://vocai-gemini-prod-flatkey-browser-qa-reports/runs/12345/manifest.json",
            "BROWSER_QA_CANDIDATE_STATUS": "passed",
            "BROWSER_QA_CANDIDATE_COUNT": "2",
            "BROWSER_QA_CANDIDATE_PR_BUNDLE_COUNT": "1",
            "BROWSER_QA_FINDING_SUMMARIES_B64": base64.urlsafe_b64encode(summaries_json).decode("ascii"),
        }
        stdout = io.StringIO()
        with mock.patch.dict(os.environ, env, clear=True):
            with mock.patch.object(dingtalk, "send_report") as send:
                with redirect_stdout(stdout):
                    exit_code = dingtalk.main()

        self.assertEqual(exit_code, 0)
        send.assert_called_once()
        webhook, report = send.call_args.args
        self.assertEqual(webhook, WEBHOOK)
        self.assertEqual(report.final_status, "findings_detected")
        self.assertEqual(report.finding_count, 1)
        self.assertEqual(report.candidate_status, "passed")
        self.assertEqual(report.candidate_count, 2)
        self.assertEqual(report.candidate_pr_bundle_count, 1)
        self.assertEqual(
            report.finding_summaries,
            ({"severity": "high", "title": "Unsafe redirect", "confidence": "high", "page_path": "/admin"},),
        )
        self.assertEqual(stdout.getvalue(), "DINGTALK_NOTIFICATION_SENT\n")
        self.assertNotIn(WEBHOOK, stdout.getvalue())
        self.assertNotIn("main-signing-secret", stdout.getvalue())
        self.assertEqual(send.call_args.kwargs, {"signing_secret": "main-signing-secret"})

    def test_main_rejects_malformed_finding_summary_env_without_echoing_input(self):
        for encoded in [
            "not+urlsafe==",
            "__==",
            base64.urlsafe_b64encode(b'{"severity":"high"}').decode("ascii"),
            base64.urlsafe_b64encode(b'[{"severity":"high","title":"sk-live-secret","confidence":"high","page_path":"/admin"}]').decode("ascii").rstrip("="),
        ]:
            with self.subTest(encoded=encoded):
                env = {
                    "DINGTALK_WEBHOOK": WEBHOOK,
                    "DINGTALK_SIGNING_SECRET": "main-signing-secret",
                    "BROWSER_QA_FINAL_STATUS": "findings_detected",
                    "BROWSER_QA_REPLAY_STATUS": "failed",
                    "BROWSER_QA_EXPLORATION_STATUS": "not_started",
                    "BROWSER_QA_EXPLORATION_ACTIONS": "0",
                    "BROWSER_QA_FINDING_COUNT": "1",
                    "BROWSER_QA_CLEANUP_STATUS": "passed",
                    "BROWSER_QA_GITHUB_RUN_URL": "https://github.com/SolveaCX/new-api/actions/runs/12345",
                    "BROWSER_QA_GCS_URI": "gs://vocai-gemini-prod-flatkey-browser-qa-reports/runs/12345/manifest.json",
                    "BROWSER_QA_CANDIDATE_STATUS": "skipped",
                    "BROWSER_QA_CANDIDATE_COUNT": "0",
                    "BROWSER_QA_CANDIDATE_PR_BUNDLE_COUNT": "0",
                    "BROWSER_QA_FINDING_SUMMARIES_B64": encoded,
                }
                with mock.patch.dict(os.environ, env, clear=True):
                    with self.assertRaises(ValueError) as raised:
                        dingtalk.main()
                self.assertNotIn(encoded, str(raised.exception))


if __name__ == "__main__":
    unittest.main()
