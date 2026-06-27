# PRD — Skill runner 解析 routing 端点的 OpenAI 响应

> **Status**: 🔧 eval · 已实现 + 单测通过；待 PR review + 线上 live 验证
> **Author**: Kaitao Lai + Claude
> **Date**: 2026-06-27
> **Owner**: DeepRouter Platform (Skill Marketplace)
> **Ticket**: DR-1002
> **Parent**: [`docs/tasks/dr63-public-routing-api-contract-prd.md`](./dr63-public-routing-api-contract-prd.md) · [`docs/tasks/dr79-publish-time-skill-packaging-prd.md`](./dr79-publish-time-skill-packaging-prd.md)
> **范围**: 打包进 skill zip 的运行时客户端 `internal/skill/packageassets/runtime/deeprouter_skill_runner.py`

---

## 1. 背景 / 问题

skill 包运行时客户端执行报错:

```
{"code": "EXECUTION_FAILED", "message": "Execution API response missing text"}
```

(此错误出现在 DR-1001 修好 token 白名单 403 *之后* —— 请求已能到达执行端点。)

根因:**runner 与 routing 端点的响应格式不一致**。
- Runner(`deeprouter_skill_runner.py:141`)读取顶层 `parsed.get("text")`,缺失即报
  `EXECUTION_FAILED`。
- 端点 `POST /v1/routing/chat/completions`(`router/relay-router.go:89-97`)走
  `controller.Relay(c, types.RelayFormatOpenAI)`,返回**标准 OpenAI chat-completion
  格式**(`dto/openai_response.go:40-48`):`{"choices":[{"message":{"content":...}}]}`,
  **没有顶层 `text`**。整条 skill relay 链路无任何把响应改写成 `{"text":...}` 的代码。

DR-63 PRD 定义了*请求*契约,但**未规定响应格式**;runner 期望的 `{"text":...}`
是一个从未实现的形状。

## 2. 决策(2026-06-27,Owner 拍板)

**修 runner**(让它解析 OpenAI 形状),而不是改端点。理由:
- 端点刻意使用 `RelayFormatOpenAI` 且路径名为 `.../chat/completions` —— OpenAI 形状
  就是预期契约;漂移的是 runner。
- 改动最小(纯 Python 解析逻辑),不碰 Go relay 热路径(无需处理流式/usage/error
  整形),回归面最小。
- DR-79 在下次 publish 时会自动把新 runner 重新打包进 zip。
- (备选「改端点返回 `{"text":...}`」已否决:改动大、风险高、且与端点的 OpenAI 定位
  相悖。)

## 3. 实现

`internal/skill/packageassets/runtime/deeprouter_skill_runner.py` 的响应解析改为:
1. 先读顶层 `text`(**向后兼容**任何确实返回 `{"text":...}` 的部署);
2. 否则从 `choices[0].message.content` 取 assistant 文本(防御式类型校验:
   list/dict/str 逐层判断);
3. 两者都拿不到才报原 `EXECUTION_FAILED: Execution API response missing text`。

不改请求体、不改身份解析、不改端点。

## 4. 验收 / 测试
- [x] 端点返回 OpenAI 形状时,runner 输出 `choices[0].message.content`
      并退出 0(新增 `TestDownloadedPackageRunner_MockSuccessOpenAIShape`)。
- [x] 端点返回旧 `{"text":...}` 时仍正常(原
      `TestDownloadedPackageRunner_MockSuccessFromExtractedZip` 仍通过 = 向后兼容)。
- [x] 缺 text 且缺 choices 时仍报原 `EXECUTION_FAILED` 错误码(防御式解析)。
- [x] Python 语法检查 + `go test ./internal/skill/handler/` 全通过。
- [x] `CHANGELOG.md` 记录(Rule 10)。
- [ ] **线上 live**:真 key 走 `POST :3000/v1/routing/chat/completions` 跑通
      polished-writer,确认输出软文文本(CLAUDE.md §0 rule 3)。

## 5. 部署 / 迁移说明
- 已分发/已下载的 skill 包内嵌的是**旧 runner**,本修复**不会**自动更新它们;需
  **重新下载/重新发布**才会带上新 runner。
- 临时验证:可直接把本仓库修好的 runner 覆盖到本地已解压包的
  `runtime/deeprouter_skill_runner.py`。

## 6. 开放问题
1. 流式响应(`stream=true`)目前 runner 不发该参数、端点默认非流式,故不在本次范围;
   若未来 runner 支持流式,需另定 SSE 解析。
2. 是否应在 DR-63 PRD 显式补一节"响应契约 = OpenAI chat-completion 形状",避免再次
   漂移?建议补,留作 follow-up。
