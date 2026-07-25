# QuantumNous/new-api 上游 PR 同步记录（2026-07-20）

## 1. 文档目的

本文记录本轮从上游仓库 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 向本项目 [SolveaCX/new-api](https://github.com/SolveaCX/new-api) 吸收 PR 的情况，包括：

- 上游 PR 当前状态；
- 本地是否完整同步、适配同步、部分同步或暂缓；
- 没有直接照搬的原因；
- 已完成的验证和剩余风险。

> 本文中的“已同步”表示 PR 的功能或修复已移植到当前 worktree，并不代表执行了 Git merge commit，也不代表已经提交、推送或部署。

## 2. 工作区快照

- Worktree：`/Users/jjcc/develop_project/shulex/new-api/.worktrees/gpt-56-compat`
- 分支：`codex/gpt-56-compat`
- 起始基线：`79b9518f7`
- 记录日期：2026-07-20（Asia/Shanghai）
- 当前状态：改动尚未 stage、commit 或 push

## 3. PR 同步总览

| PR | 上游状态 | 本地状态 | 处理结果 |
| --- | --- | --- | --- |
| [#6049 feat: gpt-5.6](https://github.com/QuantumNous/new-api/pull/6049) | Open（已核对 `5ec205f3c`） | 已适配同步 | 补充 GPT-5.6 模型、Responses/Compact 字段、缓存写入 token 解析与计费，以及对应模型倍率；按本项目现有 DTO、桥接和计费结构适配。 |
| [#6063 fix: correct gpt-5.6 completion ratio](https://github.com/QuantumNous/new-api/pull/6063) | Open（已核对 `f3b07efce`） | 已同步 | 修正 GPT-5.6 completion ratio，并补充本地倍率测试。 |
| [#6018 fix: sync codex responses passthrough fields](https://github.com/QuantumNous/new-api/pull/6018) | Merged（`dad57a6bb`） | 已适配同步 | 同步 Codex Responses/Compact 透传字段、usage 细分字段和相关桥接逻辑；保留显式零值语义，并补充本地回归测试。 |
| [#6184 feat(channel): support Codex upstream model discovery](https://github.com/QuantumNous/new-api/pull/6184) | Merged（`57746fc97`） | 已适配同步 | 支持创建 Codex 渠道时发现上游模型；结合本项目增加保存渠道限制、SSRF 校验、代理支持、缓存和错误降级，不允许后台巡检触发 Codex OAuth 刷新。 |
| [#6032 fix: Realtime GA models no longer send beta marker](https://github.com/QuantumNous/new-api/pull/6032) | Merged（`16bfae175`） | 已同步 | GA Realtime 模型不再发送 `OpenAI-Beta: realtime=v1` 或 `openai-beta.realtime-v1`；仅 legacy preview 模型保留 beta 标识，并补充 HTTP/WebSocket 测试。 |
| [#5865 fix: handle Ollama non-stream tool calls](https://github.com/QuantumNous/new-api/pull/5865) | Merged（`0977965d9`） | 已适配同步 | 修复 Ollama 非流式 `tool_calls` 丢失，并统一流式/非流式 `finish_reason=tool_calls`；JSON 操作改为项目 `common` 封装。 |
| [#5923 fix: task quota persistence and Ali duration](https://github.com/QuantumNous/new-api/pull/5923) | Merged（`043720f9b`） | **部分同步** | 仅保留 Ali 视频 `duration <= 0` 默认 5 秒的独立修复；quota 单独写回方案因结算一致性风险撤回。 |
| [#5684 fix: async task usage log node attribution](https://github.com/QuantumNous/new-api/pull/5684) | Merged（`d10fc762f`） | **暂缓** | 当前分支缺少其前置 #5465 节点维度 `QuotaData`/分流图模型。单独增加 `NodeName` 字段不会产生实际效果，完整同步范围较大。 |
| [#5300 feat: Seedance 2.0 resolution billing](https://github.com/QuantumNous/new-api/pull/5300) | Merged（`c8491b41b`） | 已适配同步 | 在本项目官方 Seedance `content[]` 入站架构上实现 720p/1080p 与是否含视频输入的组合计费。 |
| [#5824 feat: Seedance 2.0 fields and 4K billing](https://github.com/QuantumNous/new-api/pull/5824) | Merged（`e514db20f`） | 已适配同步 | 增加 `safety_identifier`、可保留显式 `priority=0` 的指针字段，以及 4K × 视频输入计费档位。共享 DTO 保持可选字段，其他 Seedance 渠道行为不变。 |
| [#4984 feat: support Wan2.7 i2v media mapping](https://github.com/QuantumNous/new-api/pull/4984) | Merged（`52858ad1e`） | 已同步 | 增加 `wan2.7-i2v`/`wan2.7-t2v`，将单图、双图和显式 metadata 映射为 `input.media`，并保持 Wan2.5 等旧模型的 `img_url` 协议。 |
| [#6164 fix: infer MiniMax vendor](https://github.com/QuantumNous/new-api/pull/6164) | Merged（`a63364d15`） | 已同步 | 为名称包含 `minimax` 的模型补充 MiniMax 厂商识别和测试。 |
| [#5592 feat: passive channel monitoring mode](https://github.com/QuantumNous/new-api/pull/5592) | Merged（`efd6c445a`） | 已适配同步 | 增加 `scheduled_all`/`passive_recovery`；被动模式仅复测自动禁用渠道，不主动禁用启用中的渠道。本项目额外同步 en/zh/fr/ja/ru/vi/es/pt 共 8 种语言。 |

## 4. 部分同步和暂缓项说明

### 4.1 #5923 quota 持久化暂缓

上游实现的顺序是：

1. 调整钱包或订阅额度；
2. 调整 token 额度；
3. 单独更新任务 `quota`；
4. `quota` 更新失败时仅记录日志。

当前任务在计费前已经通过 CAS 进入终态，后续轮询不会再次执行结算。因此如果资金和 token 已经调账，而任务 `quota` 写库失败，会造成永久不一致。该问题需要可重试、幂等且多节点安全的结算状态机，不能用一次普通 `UPDATE` 解决。

本轮最终处理：

- 保留 Ali 视频时长默认值修复；
- 撤回 `Task.UpdateQuota()` 和结算后的独立写库；
- 后续单独设计 exactly-once 异步结算和失败恢复机制。

### 4.2 #5684 多节点日志归属暂缓

#5684 依赖上游 #5465 引入的以下能力：

- `QuotaData` 增加 `NodeName`、group、token、channel 等维度；
- `LogQuotaData` 改为结构化参数；
- 数据看板分流图按节点展示。

当前项目仍使用旧版 `LogQuotaData(userId, username, modelName, ...)`，没有节点维度。只复制 #5684 的 `TaskPrivateData.NodeName` 不会改变日志或看板结果。

本轮最终处理：保持暂缓，后续若需要节点分流图，应把 #5465 与 #5684 作为一组独立评估，并验证 SQLite、MySQL、PostgreSQL 和多节点并发写入。

## 5. 非上游 PR 的本地同步项

以下改动属于本轮相关工作，但不是上述上游 PR 的直接 merge：

- Codex 官方取消短周期/5 小时窗口：前后端只展示上游真实返回的窗口，不再臆造 5 小时卡片；免费计划也不再显示该窗口。
- Codex 邀请功能下线：删除本项目自建的 Codex 邀请 API、服务、UI、hook、测试及翻译文案。
- legacy `newapi` 下线：项目与 GCP 部署文档同步为官网、console、router 的当前部署结构，不再把 legacy `newapi` 作为部署目标。

## 6. 验证记录

### Go

- 通过 OpenAI、Ollama、Ali、Doubao、全部 task channel、relay/common、dto、model、service 的相关测试。
- #5592 配置、渠道筛选和 #5923 相关测试通过 race detector。
- Stripe controller 全部定向测试通过；embedded checkout 的测试期望已与现有 `return_url` 行为同步。
- `go build ./...` 通过。
- `git diff --check` 通过。

### 前端

- `bun test`：279 tests passed。
- `bun run typecheck`：通过。
- `bun run build:check`：通过。
- `bun run i18n:sync`：8 种语言的 missing、extras、untranslated 均为 0。

### Staging Codex 实测补充（2026-07-23）

- GPT-5.6 sol/terra/luna 的 Responses 流式调用、Compact 调用，以及 Chat Completions 流式/非流式桥接均通过。
- `client_metadata` 与合法的 `reasoning.mode/context` 可正常透传；当前有效值为 `mode=standard/pro`、`context=auto/current_turn/all_turns`，且 `pro` 受模型能力限制。
- 真实 Codex 上游会拒绝 `prompt_cache_options`，并拒绝 Compact 的 `temperature`、`top_p`、`max_output_tokens`、`max_tool_calls`、`top_logprobs`；Codex adaptor 已按实测结果过滤这些字段，DTO 仍保留完整字段供其他 provider 使用。
- Compact 的 `parallel_tool_calls:false` 可正常使用。
- 重复长提示第二次命中 `cached_tokens=3840`，日志和结算按缓存读取价格计算；两次 `cache_write_tokens` 都为 0，当前上游未返回非零写入量。

## 7. 生产上线前只读核对

核对时间：2026-07-20（Asia/Shanghai）。本次仅查看生产状态，没有修改 Cloud Run、控制台设置、渠道、模型价格、流量或 Terraform。

### 7.1 模型价格与渠道

| 项目 | 生产现状 | 上线前结论 |
| --- | --- | --- |
| `gpt-5.6-sol` | 已配置按 Token 计费：输入 `$5`、输出 `$30`、缓存 `$0.5` | 已满足 |
| `gpt-5.6-luna` | 已配置按 Token 计费：输入 `$1`、输出 `$6`、缓存 `$0.1` | 已满足 |
| `gpt-5.6-terra` | 已配置按 Token 计费：输入 `$2.5`、输出 `$15`、缓存 `$0.25` | 已满足 |
| GPT-5.6 渠道映射 | 生产已有 Codex/BlockRun 渠道匹配三档 GPT-5.6 | 已满足；staging 仍需做真实 Responses smoke test |
| `doubao-seedance-2-0-260128` | 已有基础价格项；生产有 1 个 DoubaoVideo 渠道，模型筛选能匹配 2 个渠道记录 | 基础调用条件已具备；分辨率倍率需在 staging 验证 |
| `doubao-seedance-2-0-fast-260128` | 无模型价格项；生产有 1 个 DoubaoVideo 渠道可匹配 | **部署前必须补价格**，否则不得开放生产流量 |
| `wan2.7-i2v` / `wan2.7-t2v` | 无模型价格项；无 Ali/Wan 渠道和模型映射 | 当前不能生产验证；若本次不启用可保持关闭，启用前必须补渠道、映射和价格 |
| Ollama | 生产无 Ollama 渠道类型 | 只能用 staging/专用测试渠道验证，不应为本次发布临时新增生产渠道 |

### 7.2 多节点与自动渠道测试

- `newapi-console`：`APP_ROLE=console`、`NODE_TYPE=master`；
- `newapi-router`：`APP_ROLE=router`、`NODE_TYPE=slave`；
- 两个服务都未设置 `CHANNEL_TEST_FREQUENCY`，不会被环境变量强制切换为全量定时测试；
- 生产监控设置页当前直接打开为空白，浏览器对认证配置接口的直接访问也被安全策略拦截，因此无法可靠读取当前 `channel_test_mode`、allowed/ignored channel types。部署后必须先在 staging 验证 `passive_recovery`，生产启用前再由控制台确认保存值，禁止用“测试全部渠道”代替验证。

### 7.3 当前生产流量状态

首次核对时生产正在部署 `4862c2feec31`（PR #450）。复核后该批次的 canary 已完成：

- `newapi-router`：100% `newapi-router-20260720-130659-4862c2feec31`；
- PR #450 的 canary 阻断已解除。

本批上游同步不再受其他发布批次阻断。与本次代码无关的后续生产发布不纳入本文风险项。

## 8. 部署建议

- **Router deploy：required**
  - 原因：涉及 GPT-5.6/Codex relay、Realtime、Ollama、Ali/Wan、Seedance provider、usage/计费和异步任务路径。
- **Other deploy targets：**
  - `newapi-console`：required，包含后端配置、管理 API 和 `web/default` 被动监控 UI；
  - `newapi-web`：not required；
  - legacy `newapi`：已下线，不部署；
  - Terraform / Cloudflare：not required。
- **建议发布顺序：**先合入远程 `staging` 分支，在 staging 验证后再进入生产审批。
- **最低 smoke test：**
  - GPT-5.6 Responses、Responses Compact 和缓存 token 计费；
  - Codex 新建渠道模型发现、SSRF 拒绝和保存渠道限制；
  - Realtime GA HTTP/WebSocket 握手；
  - Ollama 非流式 tool call；
  - Seedance 720p/1080p/4K 与视频输入计费；
  - Wan2.7 单图/双图 `input.media`；
  - 被动监控只恢复自动禁用渠道。

## 9. 后续待办

1. 为 #5923 设计幂等、多节点安全、可恢复的异步结算状态机。
2. 将 #5465 与 #5684 作为一个整体评估节点维度流量看板。
3. 在提交当前 worktree 后，将下游 commit/PR 链接补充到本文档。
4. 上游 #6049、#6063 目前仍为 Open；合入生产前再次检查其 head 是否仍分别为 `5ec205f3c`、`f3b07efce`，并复核后续 review 结论。
