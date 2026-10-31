# 长期维护分支：补丁清单与上游同步记录

本文件用于长期保留 fork 的必要功能，同时持续合并官方上游。仓库内的执行入口是
[上游同步 Prompt](../.agents/prompts/maintain-fork.md)。本文件记录维护策略和历史证据，不代替每轮 Git 与运行环境核验。

## 1. 维护对象与边界

| 项目 | 2026-09-12 建档值 |
| --- | --- |
| 官方上游 | `origin` → `https://github.com/QuantumNous/new-api.git`，源分支 `main` |
| 自有 fork | `fork` → `https://github.com/zhls-ayl/new-api.git` |
| 维护分支 | `fix/anthropic-consume-log-cache-tokens` |
| tracking branch | `fork/fix/anthropic-consume-log-cache-tokens` |
| 同步策略 | 在维护分支 merge 固定的上游 SHA，保留共享历史 |
| 默认交付 | 已验证范围内的本地提交与维护记录；push 必须有用户明确授权 |

当前分支即长期维护分支，不为名称美观自动改名。`main` 不承载本地功能补丁，也不因同步自动移动。
不因本文件存在自动创建定时任务、发布、部署、Issue 或 PR。上游 PR 的 URL/状态只在取得实时证据后记录；当前未登记 PR，不推断维护者意图。

本地差异分为业务补丁和维护资产两类；本文件与 Prompt 属于维护资产。不要把维护文档计入功能偏离，也不要隐藏其实际 tree diff。
项目身份、署名和许可遵循根目录 [AGENTS.md](../AGENTS.md)。若维护流程和当前规范冲突，执行更严格且适用的要求，不借“上游原样合并”绕过必要检查。

## 2. 本地补丁清单

状态使用：`active`（仍需保留）、`adapted`（已适配上游）、`upstream-equivalent`（上游已等价覆盖并移除重复实现）、`retired`（用户明确取消需求）。每个新补丁新增独立条目。

### PATCH-001：Anthropic consume log 输入 token 总数

| 项目 | 内容 |
| --- | --- |
| 状态 | `adapted`；2026-10-15 合并 `d199ac1fb` 后核验，继续保留 OpenRouter 修复 `104902b51`；实现无改动，仅按上游新增的 cache-only 语义补充一条回归用例（`654f356eb`） |
| 原始提交 | `4add2c53afe574d0a26038ac51c9e2668d7bab1d` |
| 后续修复 | `104902b51371345fead518d9e702a967983675b4`，保留 OpenRouter 输入总数，处理 aggregate/split cache write 不一致 |
| 实现 | [service/text_quota.go](../service/text_quota.go) |
| 回归 | [service/text_quota_test.go](../service/text_quota_test.go)、[service/text_quota_consume_log_test.go](../service/text_quota_consume_log_test.go) |
| 必要性 | Anthropic 风格 fresh-only 输入计数在写 consume log 时需加回 cache read/write，使统计采用总输入 token |
| 上游跟踪 | 目标 `718a4e7f9` 仍无等价实现：写日志处仍是 `PromptTokens: summary.PromptTokens`，`PromptTokensExcludeCache` / `consumeLogPromptTokens` 在该 SHA 不存在。上游 `1b63c28dc` 只让 cache-only 的 Claude 响应保持可计费（`hasBillableUsage`）并保留其零值 fresh input，属于互补而非替代。上游 open PR [#7305](https://github.com/QuantumNous/new-api/pull/7305)（本 fork 提交，head = `60327b1c2`，2026-10-15 核对为 OPEN / REVIEW_REQUIRED / BLOCKED）与 [#7291](https://github.com/QuantumNous/new-api/pull/7291)（TomJKS，2026-10-15 OPEN / BLOCKED）均未合并 |

必须保持的行为：

- 原生 Anthropic semantic 与 legacy Claude-derived fresh-only usage：日志输入总数为 fresh input + cache read + cache write。
- OpenAI semantic：已有总输入 token 不再重复加 cache。
- OpenRouter Claude billing：上游输入本身为总数，日志只加回计费调整实际减去的 cache read 与 aggregate cache write；不能改用更大的 split 合计，避免 aggregate 缺失或小于 5m/1h 合计时虚增输入。
- 其他 fresh-only 路径的 cache write 5m/1h 拆分遵循现有 `cacheWriteTokensTotal` 规则，不能重复计数。
- 规范化发生在 consume log 边界；保留上游实际结算、预扣/退款、tiered billing 和 OpenRouter 的既有费用语义。
- TPM、`SumUsedToken` 和 `quota_data.token_used` 消费正确的日志 token 总数；日志 UI 的 cache 明细不能再次加回总数。

定位入口是 `PromptTokensExcludeCache`、`OpenRouterClaudeBilling`、`consumeLogPromptTokens`、`PostTextConsumeQuota`、`RecordConsumeLog`。
入口名称可能随上游重构变化；上述业务契约比文件名、helper 名和旧代码形态更重要。

最小回归入口（从仓库根目录执行）：

```sh
GOWORK=off go test ./service -run 'Test(CalculateTextQuotaSummary|ConsumeLogPromptTokens|FixedPriceBillingDatabaseMatrix)' -count=1
```

上游吸收判据：先在固定上游 SHA 上确认上述行为与相关失败边界，再对照维护分支测试。
仅 patch-id 相同或原提交已成为祖先不够；即使原提交不在历史中，上游也可能已独立实现等价行为。
确认吸收后在当前代码上移除重复逻辑，保留必要测试；不要机械 revert 原始补丁，否则可能撤销后续上游适配。记录证据、替代实现与状态变更。

## 3. 每轮同步流程

### 3.1 现场核验与固定目标

先读取当前根目录和受影响目录的 `AGENTS.md`，再执行只读核验：

```sh
git status --short --branch
git branch -vv
git worktree list
git remote -v
git log -5 --oneline
```

确认没有未完成的 merge/rebase/cherry-pick，URL 与目标仓库一致。凭据不得出现在报告、URL、Git config 或证据日志中。
工作区有无关改动时，不自动 stash、reset 或混入提交；能隔离时使用独立 worktree。维护分支已在别处检出时不要强行重复 checkout。

确认 remote 后再 fetch；不要用无参数 `git pull`，因为当前 tracking 指向 fork：

```sh
git fetch origin
git fetch fork
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count HEAD...origin/main
git log --oneline HEAD..origin/main
git log --oneline HEAD..fork/fix/anthropic-consume-log-cache-tokens
```

把现场结果记录为 `PRE_HEAD`、`TARGET_SHA` 和 fork 远端 SHA。它们是本轮固定值，不能在验证后悄悄换成新移动的 `origin/main`。
fork 若有本地未包含的提交，先核对其来源和改动，正常合并已确认的维护工作后重新记录基线；有功能取舍冲突时请求用户决定，不覆盖远端提交。

若 `git merge-base --is-ancestor <TARGET_SHA> HEAD` 成功，说明此目标已在历史中；结合补丁清单核验后报告 no-op，不创建空 merge。
仍有未完成的验证或补丁事项时，可单独跟进并记录实际结果，不能把旧合并算作本次新增。

### 3.2 增量分析与恢复点

以下尖括号是说明占位符，执行时必须替换为已核验的真实 SHA 或分支名：

```sh
git diff --stat <PRE_HEAD>...<TARGET_SHA>
git diff <TARGET_SHA> <PRE_HEAD> -- service/text_quota.go service/text_quota_test.go
git log --left-right --cherry-mark --oneline <PRE_HEAD>...<TARGET_SHA>
```

三点 diff 用于观察共同祖先之后的上游增量；两端 tree diff 表示当前代码差异。在合并前，tree diff 还包含“尚未合入的上游变化”，不能都称为本地补丁。
提交历史只用于定位，合并后相对目标的 tree diff 与行为回归共同证明当前补丁状态。

检查补丁入口及调用链、上游相关测试、数据库/认证/计费/relaykit/依赖变化。优先让 subAgents 做独立只读审查或互不干扰的测试；Git 操作与文件写入由一个执行者负责。
运行数据库测试的并行任务必须使用各自隔离数据库，不能共享会被清理的 fixture。

有新增改动时，以唯一名称建立本地恢复引用，例如 `codex/backup/anthropic-cache-<UTC时间戳>`，指向 `PRE_HEAD`。先查重，不覆盖已有引用。
恢复引用保留到本轮验收完成；清理时精确识别本轮临时资源，不批量删除历史备份。

### 3.3 合并与解决冲突

```sh
git merge --no-ff --no-commit <TARGET_SHA>
git diff --name-only --diff-filter=U
git diff --cached --check
```

`--no-ff --no-commit` 确保即使可 fast-forward 也有提交前检查机会，并统一维护分支的同步记录。
不 rebase/squash 共享分支，不 force push。禁止用整文件 ours/theirs 代替业务判断。
冲突处理必须同时保留补丁契约与上游有效修复；修改实现前读取相关规范、skill 和设计文档。

对已证明的合并回归，修复后再提交。对功能取舍不明的冲突，保留现场并报告具体选择。
若决定放弃未提交合并，在确认合并后没有新增用户工作时使用 `git merge --abort`。
已经提交的同步不能用 `reset --hard` 作为默认回滚方案；用单独修复/回退提交，并说明回退 merge 会影响今后重新引入同一上游历史。

## 4. 验证与失败处理

每轮以现场 `go.mod`、`web/package.json`、lockfile 和 [.github/workflows/ci.yml](../.github/workflows/ci.yml) 为准，记录 Go、Bun、Node 版本。
CI 版本与本地不同时显式记录；环境不兼容要先定位，不通过更新 lockfile 或业务代码掩盖问题。

当本轮包含前端改动时，先在 `web/` 执行：

```sh
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run test
```

涉及文件的 lint、UI 行为验证按 `web/AGENTS.md` 执行。若实际编辑 UI，先使用项目组件复用流程与 shadcn-ui skill；不能只靠自动 merge 或 typecheck 宣称 UI 语义已审查。
root 嵌入 `web/dist`，应先完成真实前端构建。CI 的空 index placeholder 只能支持后端隔离检查，不能冒充可交付前端。

仓库根目录：

```sh
GOWORK=off go vet ./...
GOWORK=off go build ./...
GOWORK=off go test ./...
```

在 `relaykit/` 独立执行（影响该模块或公共 API 时必做）：

```sh
GOWORK=off go vet ./...
GOWORK=off go build ./...
GOWORK=off go test ./...
```

补丁回归不可因全量测试使用缓存而省略；补丁相关测试使用 `-count=1`。已经通过的检查仅在新修改或新证据影响结论时重跑。

### 数据库与认证

本轮含数据库行为变化时，真实 SQLite、MySQL、PostgreSQL matrix 是必要验证。迁移覆盖 fresh、最新已发布版本的代表性数据库升级、连续两次启动/migration、数据/约束/索引保留；受影响时包含独立 log DB。
具体支持版本、最低版本与测试要求按当前 `AGENTS.md` 执行。

建档时现有测试入口：

```sh
GOWORK=off go test ./model -run 'Test(MigrationSchemaStability|MigratePrefillGroupUniqueness)' -count=1 -v
GOWORK=off go test ./controller -run '^TestPasskeyRPIDMigrationPreservesExistingCredentials$' -count=1 -v
```

model matrix 使用 `TEST_MYSQL_DSN`、`TEST_POSTGRES_DSN`；Passkey fixture 还使用 `TEST_SECURITY_DIALECT`。
先读 fixture 确认初始化与清理行为，只连接专用可销毁测试数据库。认证材料经临时进程环境注入，不写入文档、shell 历史或版本库。
检查实际执行和 SKIP 子项；现有 fixture 不能覆盖新变化时补充必要用例。
认证实现或审查还需按项目要求实时读取适用 OWASP 指南并记录 ASVS 版本、使用的控制项和回归证据。

缺少实例时，记录哪种数据库、哪条路径未验证及所需条件。允许保存带缺口的本地同步记录，但三数据库兼容性和完整验证仍为未完成；不能据此发布或声称任务已全部验收。

### 失败分类与证据

| 分类 | 处理 |
| --- | --- |
| 合并引入的回归 | 最小修复并验证后提交；不得以“上游问题”带过 |
| 疑似上游已有失败 | 在固定 `TARGET_SHA` 的隔离 worktree、相同依赖与环境中复现；仅目录相同不能排除配置/环境差异 |
| 环境阻塞 | 记录缺失构建产物、版本差异、实例/依赖不可用等具体证据与恢复条件 |
| 疑似并发/时序不稳定 | 原样保留首轮日志，受影响文件降低并发复跑一次；通过仅说明复跑成功，不代表找到根因或全量一次通过 |

不删测试、不弱化断言、不无依据延长 timeout，不反复运行直到偶然通过。稳定失败要做对照或报告阻塞，不能无限扩展本轮范围修复无关上游问题。
非敏感摘要与命令写入本文件。完整日志可存本地 `git rev-parse --git-common-dir` 所指共同 Git 目录下的 `maintenance-evidence/<轮次>/`，并在记录中写明解析后的绝对路径。
不要存入 linked worktree 专有 metadata 后又清理该 worktree，否则证据也会丢失。
本地证据不会随 push 分享；若日志必须跨机器保留，使用已授权的 CI artifact 或存储，并在文档中留下可访问引用。不要把 `/tmp` 路径当作永久证据。

## 5. 提交、推送与维护记录

提交前检查 unresolved entries 为空、cached diff 无空白错误、合并结果相对目标仅保留已解释的本地业务补丁和维护资产。
只暂存本轮必要文件，不使用无边界 `git add -A`。

1. 创建 merge commit，消息包含上游来源与维护分支。
2. 取得 merge SHA 后更新下方日志及补丁清单，单独创建 scoped docs commit。这样日志能引用真实 merge SHA，不需要 amend 形成自引用。
3. 复核 `git merge-base --is-ancestor <TARGET_SHA> HEAD`、patch 状态、tree diff、工作区及恢复引用。
4. 没有 push 授权则停在 local commit。获授权后先重新 fetch fork，确认无远端新分歧，再普通 push 到已核验的 fork 分支。禁止推送到 `origin`、force push 或绕过 hooks。
5. 推送后用 `git ls-remote fork refs/heads/fix/anthropic-consume-log-cache-tokens` 和更新后的 tracking ref 核对远端 SHA 等于 local HEAD。

最终 push 的 SHA 回执写入本轮回复或外部执行记录；下轮日志可记录上轮已核验的远端 SHA。
不要为把“包含本条记录的最终 commit SHA”写回同一 commit 而反复 amend/commit/push。日志中的推送状态必须带核验时点，不能将提交前的计划写成已经完成。

“Git 已同步”只指固定目标已纳入历史；“补丁已验证”需要行为证据；“完整验证通过”要求所有适用检查无缺口；“可发布”还需要该次发布范围的授权与验收。
最终交付必须分别报告这些结论，不把本地合并、push 和部署混为一谈。

新功能继续做独立 scoped commit，同步更新补丁清单及回归入口。每轮同步检查已登记的验证缺口；不能把旧的 SKIP 长期复制成已知且无须处理。

## 6. 同步日志

### 2026-09-12：建立长期维护基线

| 字段 | 记录 |
| --- | --- |
| 合并前 | `4add2c53afe574d0a26038ac51c9e2668d7bab1d` |
| 固定上游目标 | `043ff99a51ecad8229389ddd04f45f4b25a23ac6` |
| merge commit | `9edffcc4eab7fdd4133316a08d81c5d187f58333` |
| 上游新增 | 21 个提交 |
| 冲突 | 无；`service/text_quota.go` 及其测试自动合并 |
| PATCH-001 | `active`；写日志时规范化，计费与 UI 无重复累计；相对目标仅保留原有两个业务文件差异 |
| 推送 | 此次未推送；合并后工作区干净，较当时 fork tracking ahead 22 |
| 工具 | Go 1.27.1 darwin/arm64、Bun 1.3.9、Node 26.8.2；当时 CI 指定 Bun 1.4.0 |
| 后端 | `GOWORK=off go vet ./...`、`go build ./...`、`go test ./...` 通过 |
| relaykit | 独立 `GOWORK=off go vet/build/test ./...` 通过 |
| 前端 | frozen-lockfile 安装、typecheck、build 通过 |
| 全量前端测试 | 首轮 1470 passed / 3 failed，132 个文件中 129 passed / 3 failed |
| 复跑 | 3 个失败文件使用 `--maxWorkers=2`，96/96 passed；并未再次完整运行全量套件 |
| 数据库 | SQLite 3.50.4 下 model migration 与 Passkey migration 指定测试通过 |
| 未验证 | MySQL/PostgreSQL 无可用实例，DSN 未设置，matrix 相应子项 SKIP；不宣称三数据库兼容性验证完成 |

首轮 root 测试因缺少 `web/dist` 报 setup failure；前端构建后 root vet/build/test 通过。
前端失败分别为 channel configuration 的 5 秒 timeout、audit viewer 中文记录查询失败、dashboard setup guide 可见性断言失败。
单独复跑通过支持时序/负载影响的可能性，未确证根因，不标记为“已修复”。

复跑命令（`web/`）：

```sh
bun run test src/features/channels/components/__tests__/channel-configuration.test.tsx src/features/usage-logs/audit/__tests__/viewer.test.tsx src/features/dashboard/components/overview/__tests__/setup-guide.test.tsx --maxWorkers=2
```

当时 SQLite 的两条 focused migration 实际命令（固定历史值，不随上方流程更新）：

```sh
go test ./model -run 'Test(MigrationSchemaStability|MigratePrefillGroupUniqueness)' -count=1 -v
go test ./controller -run '^TestPasskeyRPIDMigrationPreservesExistingCredentials$' -count=1 -v
```

model 覆盖重复 migration、数据与唯一约束；Passkey 覆盖 fresh 和 v1.0.0-rc.36 schema 升级、两次 migration、凭据/索引保留与登录验收。
历史完整日志位于当时 `/tmp/new-api-upstream-merge-go-test.log`、`/tmp/new-api-upstream-merge-vitest.log` 和 `/tmp/new-api-upstream-merge-vitest-retry.log`，仅为临时证据；本次建档时已核对摘要，后续不能假设文件仍存在。
此次原操作未建立命名备份引用；恢复定位使用记录的合并前 SHA。本流程以后要求建立恢复引用，不把新增规范冒充历史已执行步骤。

待跟进：补跑 MySQL/PostgreSQL，尤其 PostgreSQL unique constraint migration 专属路径；后续前端完整测试继续观察上述三项，不删除其覆盖。若准备发布，还需按现行认证规范补齐适用安全审查证据。

### 2026-09-12：推送前合并 fork 并行修复

| 字段 | 记录 |
| --- | --- |
| 合并前 | `9edffcc4eab7fdd4133316a08d81c5d187f58333` |
| 恢复引用 | `codex/backup/anthropic-cache-pre-fork-104902b51` |
| fork fetch 目标 | `104902b51371345fead518d9e702a967983675b4`，远端独有 1 个提交，本地独有 22 个提交 |
| merge commit | `05f423130330c1d551f763f69b34d0da3bec0432` |
| 上游基线 | 仍为 `043ff99a51ecad8229389ddd04f45f4b25a23ac6`；本轮只处理 fork 分歧，未重新同步官方上游 |
| 处理 | 无文本冲突；保留 OpenRouter 原始 total input 的修复，纠正新增测试四个 quota 取整预期 |
| PATCH-001 | `adapted`；OpenRouter 精确还原计费调整，原生 Anthropic/显式 OpenAI semantic 继续通过回归 |
| 验证 | `GOWORK=off go test ./service -count=1` 通过；`GOWORK=off go vet ./service`、`GOWORK=off go build ./...`、gofmt 与 cached diff 检查通过 |
| 版本与范围 | Go 1.27.1 darwin/arm64；本轮未更改前端、relaykit、数据库 schema/查询或计费算术，不重复运行这些完整验证 |
| 既有缺口 | 前轮 MySQL/PostgreSQL 和适用认证审查仍待补齐；不因本轮 service PASS 标记为完成 |
| 推送状态 | 用户已授权提交、推送；本条写入时尚未执行最终 push，实际远端 SHA 以任务回执为准 |

首轮完整 service 测试失败，再次以 `-json -count=1` 记录后确认同样四项 quota 断言稳定失败。
在合并前 `9edffcc4e` 的 detached worktree 放入原样远端测试，复现相同的 972→973、1012→1013、1002→1003、982→983 差异。
原实现 `common.QuotaFromDecimalChecked` 已使用 `d.Round(0)`；对应中间值均为 `.5`，应按 half away from zero 取整。
本轮只纠正四个测试常量并补充说明，没有为通过测试改变计费实现。修正后再次执行完整 service 测试（`-count=1 -json`）通过，包含 11 个新增回归 case。

本地证据目录：`/Users/andy/AI/GitHub/new-api/.git/maintenance-evidence/2026-09-12-fork-104902b51/`。
其中 `service-before-test-correction.jsonl`、`service-after-test-correction.jsonl` 保存修正前后结果；文件不会随 push 分享。

### 2026-09-21：同步 76 个上游提交并补验三数据库

| 字段 | 记录 |
| --- | --- |
| 执行环境 | macOS darwin/arm64，日期按 Asia/Shanghai |
| 维护分支 / 合并前 | `fix/anthropic-consume-log-cache-tokens` / `c95446d2f4a1cf03da9e7f067feeedeb9f4327d9` |
| 固定上游目标 | `origin/main` → `9a0be8750a6d736d9692535ed2cd68f8eec46529`，新增 76 个提交 |
| fork 初次 fetch | `c95446d2f4a1cf03da9e7f067feeedeb9f4327d9`，与本地相同，无远端独有提交；也确认上一轮文档提交已在远端 |
| 恢复引用 | `codex/backup/anthropic-cache-2026-09-20T172846Z-upstream-9a0be8750`，保留在本地 |
| merge commit | `bf9f4111f4eeeca0d736035bcc67d4218279bd6b` |
| 冲突 / 本地适配 | 无文本冲突；自动合并 `service/text_quota.go` 与测试。未修改业务实现或测试断言 |
| PATCH-001 | `adapted`，原生 Anthropic、legacy Claude-derived、显式 OpenAI semantic、OpenRouter aggregate/split 不一致及幂等读取回归通过 |
| 工具 | Go 1.27.1、Bun 1.3.9、Node 26.8.2；模块声明 Go 1.25.1，CI 使用该声明及 Bun 1.4.0。依赖清单和 lockfile 本轮无变化 |
| 前端 | frozen-lockfile 安装、typecheck、真实 build、236 个涉及 TS/JS 文件 lint 通过；完整测试首轮 164/164 文件、2057/2057 用例通过 |
| root | 默认 CGO 的 vet 被 Xcode license 环境阻塞；`CGO_ENABLED=0` 下 vet/build 通过，全量 test 失败，归因见下文 |
| relaykit | 独立 `GOWORK=off` vet/build/test 通过；9 个有测试的 package、462 个含子用例的 pass event，无测试用例 SKIP、无 cached package |
| 数据库 | 真实 SQLite 3.50.4、MySQL 8.4.11、PostgreSQL 16.14；本轮受影响 focused matrix 最终均通过且无 SKIP |
| 同步与验收状态 | 固定上游已纳入历史；PATCH-001 已验证；完整验证未通过；不作为已完整验收或可发布版本交付 |
| 推送状态（文档提交前） | 用户已明确授权完成后推送；此条写入时尚未执行最终 push。最终 HEAD 回执保存于本轮证据和任务回复，下轮再补记 |

补丁独立审查确认，上游在 `text_quota.go` 的增量只调整 performance output 记录，未实现 consume log 输入归一化。
合并同时保留该上游改动和本地日志边界修复，OpenRouter 只加回计费实际减去的 aggregate cache，不用更大的 split 合计替代。
TPM、`SumUsedToken`、`quota_data.token_used` 的消费链做了源码核对；没有新增这些聚合值的端到端数值断言，不把计费 matrix 冒称为其动态验证。
桌面、移动卡片与详情直接显示 `log.prompt_tokens`，cache 仅为明细；前端既有用例覆盖输入 1000、缓存 300 时仍显示输入 1000。

本轮前端只读审查聚焦日志契约及代表性公共交互，非 253 个变更文件的逐行全面审计。
模型复制复用 `CopyButton`，详情复用 `DetailRow`，批量映射复用共享 `Dialog` / `UpstreamModelSelection`；
新增 `FloatingWindow` 的非 modal 拖动、resize、collapse 能力不由这些既有候选覆盖。
7 个变更插件的 numeric usage descriptions 已检查为“计费对象 + unit price/单价”，unit 分离、en/zh 等价；
`openai_image`、`retainResult`、`upstreams` 的 API 文档、schema、d.ts 与 runtime 契约一致。

#### 检查命令与数据库范围

从 `web/` 执行 `bun install --frozen-lockfile`、`bun run typecheck`、`bun run build`、`bun run test`；
lint 使用 `bun x --no-install oxlint -c .oxlintrc.json <本轮 236 个 TS/JS 文件>`，文件集合取固定 PRE/TARGET 的 diff。
额外 `bun run format:check` 未通过，固定上游对照结果见下一节。

root 首次执行 `GOWORK=off go vet ./...`；环境阻塞后依次执行：

```sh
CGO_ENABLED=0 GOWORK=off go vet ./...
CGO_ENABLED=0 GOWORK=off go build ./...
CGO_ENABLED=0 GOWORK=off go test -json ./...
```

relaykit 目录独立执行 `GOWORK=off go vet ./...`、`go build ./...`、`go test -json ./...`。
原始 root 全量测试无缓存，含 49 个数据库/外部服务 SKIP 子项；不能将这些视为成功。
随后以专用实例和进程作用域 DSN 执行以下 `go test -json -count=1`，均带 `CGO_ENABLED=0 GOWORK=off`：

| package / `-run` | 数据库设置与实际覆盖 |
| --- | --- |
| `./model` / `Test(MigrationSchemaStability\|MigratePrefillGroupUniqueness\|RequestPolicyDatabaseMatrix\|SystemTaskHistoryDatabaseMatrix\|InferencePresetSettingsAndDatabaseRoundTrip)` | `TEST_MYSQL_DSN`、`TEST_POSTGRES_DSN`；三库 options 事务、history、channel settings、重复 migration、数据/约束/索引，含 PostgreSQL renamed unique constraints |
| `./service` / `Test(CalculateTextQuotaSummary\|ConsumeLogPromptTokens\|FixedPriceBillingDatabaseMatrix)` | `TEST_FIXED_{MYSQL,POSTGRES}_DSN` 及各自 `_LOG_DSN`；三库主库与独立 log DB、预扣/结算/退款和 PATCH-001 |
| `./controller` / `Test(ExecuteTaskSubmissionHonorsRouteRetainResult\|ImmediateTaskSettlementDatabase\|TaskListsOmitPersistedSnapshot)` | `TEST_TASK_DB_DIALECT=sqlite/mysql/postgres` 分别运行；三库 serializer、NULL data、列表省略快照、立即结算 |
| `./controller` / `Test(OAuthLogin\|OAuthBind\|GenerateOAuthCode\|SecurityLogin\|SessionLimitDoesNotRecordRejectedLoginAsSuccessful\|GetStatusDoesNotExposePasskeyOrigins\|PasskeyRPIDMigrationPreservesExistingCredentials)` | `TEST_SECURITY_DIALECT=sqlite/mysql/postgres` 分别运行；每库 74 个含子用例的 pass event，动态创建隔离 main/log DB |
| `./controller` / `Test(PreConsumePolicyDatabaseMatrix\|ModelPricingConversionDatabaseMatrix\|ModelManagementDatabaseMatrix\|SharedModelPluginPricingDatabaseMatrix)` | 三库设置持久化、重复加载、价格与 model management |
| `./controller` / `^TestMultiKeyEnableRestoresOnlyExhaustedChannels$` | 通过 `TEST_CHANNEL_SQL_DSN` 分别运行三库，验证手动/标签禁用状态保留 |
| `./controller` / `^TestRequestPolicyRoutingDatabaseMatrix$` | 三库 routing / affinity / cache 路径 |
| `./pkg/perf_metrics` / `^TestPerformanceAggregationAndFlush$` | `TEST_PERF_MYSQL_DSN`、`TEST_PERF_POSTGRES_DSN`；首轮误用普通 DSN 名产生 2 SKIP，保留日志；纠正变量名后三库通过、0 SKIP |
| `./controller` / `^Test(DeleteThirdPartyPluginReportsAssociatedChannelsAndInFlightTasks\|DisableThirdPartyPluginSupportsCascadeAndForce)$` | 使用 `-overlay <证据目录>/plugin-matrix-overlay.json`；仅将原 SQLite fixture 换为既有 `openTaskDialectDatabase`，原断言不变，三库验证关联渠道查询与只解绑目标插件；仓库文件未修改 |

所有上述最终 focused matrix 已逐项检查 0 SKIP。全量中未补跑的无关历史矩阵、ClickHouse audit、VLLM live 等仍以
`test-summary.json` 的原始 SKIP 清单为准，不能据此宣称全仓库全部外部集成已验收。
本轮没有 schema、migration 或 GORM/driver dependency 变更；现场 fetch 到的 `v1.0.0-rc.39` 与固定目标之间
`model/`、`go.mod`、`go.sum` tree diff 为空。
补跑的历史 migration fixture 覆盖合成旧 schema 和重复 migration；Passkey 包括 fresh、rc.36 schema 升级、两次 migration、凭据/索引保留及登录。
它们不是从 latest release 完整实例导出的升级验收。上一轮“完全没有 MySQL/PostgreSQL 实例”的阻塞已消除，不继续沿用为本轮理由。

#### 首轮失败、复跑与固定上游对照

1. 默认 CGO 的 root vet 在 `runtime/cgo` 报 Xcode license 未接受；未接受或改动系统许可，改用纯 Go 构建完成 vet/build。
2. root 全量 `controller` 失败：`TestResponsesWebSocketInitialUpstreamRejectionRefundsReservation` 的两个子项期望余额 2990，实际 3000。
   以 `-p 1 -count=1` 单独复跑仍失败；固定 `9a0be8750` 的 detached worktree、相同工具和依赖、相同 CGO 设置也复现两个断言。
   上游已改为仅按输入预扣，该测试仍假定 output-only expression 会预扣 10；本轮不修改上游实现或断言。
3. `TestSecurityAccountDeletionConcurrentRequestsHaveOneWinner` 首轮出现 `SQLITE_BUSY`，期望一个成功响应而实际为零。
   同批 focused 复跑通过，固定上游对照失败；归为已有并发/时序不稳定，未确证根因、未标记修复。
4. 前端 format check 报 21 个文件；固定上游 worktree 使用同一 node_modules 后复现完全相同文件列表。
   未批量格式化无关上游代码。前端完整测试首轮已全绿，无需重跑到绿。

后端复跑与上游对照均执行：

```sh
CGO_ENABLED=0 GOWORK=off go test -json -p 1 -count=1 ./controller \
  -run 'Test(ResponsesWebSocketInitialUpstreamRejectionRefundsReservation|SecurityAccountDeletionConcurrentRequestsHaveOneWinner)'
```

用户补充允许改为 [v1.0.0-rc.39](https://github.com/QuantumNous/new-api/releases/tag/v1.0.0-rc.39) 后，
额外在固定 release SHA `9978ee1e25a647bfe004e96c8719a2cb62c24732` 的独立 worktree 执行同一后端对照及 format check。
该版本的两个 WebSocket 预扣断言同样失败，账户删除并发用例此次通过；format check 报 22 个文件，不能视为全绿替代版本。
rc.39 到本轮目标仅有 `47713bcb1`（插件版本更新）和 `9a0be8750`（插件 enum 收窄后的定价编辑修复）两个提交，
相关后端/认证路径没有 tree diff。由于回到 rc.39 不能避开已发现的问题，本轮仍采用原固定目标，保留上述验证缺口。
release 对照日志与 `rc39-comparison.json` 已保存，对照 worktree 随后清理。

#### 认证审查边界与后续事项

本轮按 [ASVS 5.0.0](https://github.com/OWASP/ASVS/releases/tag/v5.0.0) 及
[Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)、
[Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)、
[OAuth2](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)、
[MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)、
[CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) 指南审查。
使用的控制项为 `v5.0.0-6.3.4`、`6.5.1`、`6.5.5`、`7.2.1`、`7.2.4`、`7.5.1`、`10.1.2`、`10.2.1`。
GitHub legacy binding 增量要求 verified account evidence 或既有 MFA，相关错误证据、replay、expiry、事务回滚回归通过。
仍有两项明确边界，不声明 OWASP 合规完成：

- 既有 OAuth login 缺少发起浏览器的服务端绑定：`controller/oauth.go` 仅 bind/verify 强制发起 session，
  login flow 无 browser secret；前端无记忆 marker 时仍可按 login 兑换 callback，并写 refresh cookie。
  关联行为在合并前已存在。静态确认与 `10.1.2` 的会话/事务绑定要求有缺口；真实 provider、双浏览器攻击复现未执行。
- GitHub 跨用户并发认领的唯一性尚未验证：`migrateLegacyGitHubBinding` 使用 COUNT 后 UPDATE，`github_id` 仅普通 index。
  现有顺序 interference 测试不证明并发所有权保证；这是待审查/验证项，未称为已复现缺陷。

本轮证据：`/Users/andy/AI/GitHub/new-api/.git/maintenance-evidence/2026-09-20T172846Z-upstream-9a0be8750/`。
包括 baseline/environment、原始 root/relaykit/frontend 日志、全部 matrix 命令和 JSONL、首次失败/复跑/上游对照、
`test-summary.json`、独立审查摘要、overlay fixture 与 cleanup 回执；均为本地持久证据，不随 push 共享。
专用数据库容器及其匿名 volume、上游对照 worktree 已清理；无其他运行容器时将 OrbStack 恢复到初始 stopped 状态，保留恢复引用。
merge 后目标 ancestry 成立，相对目标仅剩 3 个 PATCH-001 业务/测试文件和 2 个维护资产；维护记录另作独立 docs commit。

### 2026-10-12：同步 112 个上游提交并复核三数据库与启动 migration

| 字段 | 记录 |
| --- | --- |
| 执行环境 | macOS darwin/arm64（Darwin 27.0.0），日期按 Asia/Shanghai |
| 维护分支 / 合并前 | `fix/anthropic-consume-log-cache-tokens` / `d82cfd64672de9eb4534eb5426ccebfb8a2e28d9` |
| 固定上游目标 | `origin/main` → `633b4c5b190dc1af99a2814391354d86948e7943`，新增 112 个提交、663 个文件（+36272 / −9732） |
| fork fetch | `d82cfd646`，与本地相同，无远端独有提交 |
| 恢复引用 | `codex/backup/anthropic-cache-2026-10-12T144745Z-upstream-633b4c5b1` → `d82cfd646` |
| merge commit | `7ce439e8118169a8fb4f160ec2a1bc8911d5810f` |
| 冲突 | 无文本冲突；`service/text_quota.go`、`service/text_quota_test.go` 自动合并，未修改业务实现或测试断言 |
| PATCH-001 | `adapted`，契约回归在三库全部通过；上游等价实现仍不存在（见补丁清单“上游跟踪”） |
| 工具 | Go 1.27.2 darwin/arm64、Bun 1.3.9、Node 26.11.1；`go.mod` 本轮由 `go 1.25.1` 升到 `go 1.26`，CI 用 `go-version-file` 与 Bun 1.4.0（本地 Bun 低于 CI，未改 lockfile） |
| 前端 | frozen-lockfile 安装、typecheck、真实 build（`web/dist` 重建后再构建 root）通过；完整测试 187 文件 / 2250 用例全通过 |
| 前端 lint | 195 个本轮变更 TS/JS 文件 oxlint 报 9 error + warning（3 个文件）；固定 `633b4c5b1` 隔离 worktree 用同一 node_modules 复现完全相同的文件与数量，属上游既有 lint 债 |
| root | `CGO_ENABLED=0 GOWORK=off go vet/build` 通过；全量 `go test -json ./...` 无缓存 exit 0：4793 pass、0 fail、52 个 test-level SKIP（数据库/外部服务），数据库类 SKIP 已由下方 focused matrix 逐项覆盖 |
| relaykit | 独立 `GOWORK=off` vet/build/test 通过；9 个有测试的 package、539 个 pass event、无 test-level SKIP（另 8 个 package 无测试文件） |
| 数据库 | SQLite 3.50.4（modernc.org/sqlite v1.40.1）、MySQL 8.4.11、PostgreSQL 16.15（OrbStack 容器，专用可销毁库） |
| 同步与验收状态 | 固定上游已纳入历史；PATCH-001 已验证；本轮适用检查通过（含 rc.39 升级路径与两次启动幂等），另有 1 个已复现的上游既有 fixture 失败（`^TestManageUser`）与下方未验证项 |
| 推送状态（文档提交前） | 用户本轮只授权合并，未授权 push；此条写入时未推送，本地 HEAD 为紧随其后的 docs commit |

源码核对确认，上游在 `service/text_quota.go` 的增量只涉及 i18n 消息（`extraContent` 改为 `[]*common.Message`）、tool surcharge 调用次数上限钳制（`relaycommon.MaxBillableToolCallCount`）与 web search 计费调整；写 consume log 处仍是 `summary.PromptTokens`，`PromptTokensExcludeCache`、`consumeLogPromptTokens` 在 TARGET 不存在。
合并后相对 TARGET 的 tree diff 仍只有 3 个 PATCH-001 文件与 2 个维护资产（`.agents/prompts/maintain-fork.md`、本文件）。

本轮上游增量内容：scoped access token（新增 `middleware/access_token_routes.go`、`model/user_access_token.go`，`middleware/auth.go` 路由级 scope 与 step-up 身份）、安全登记与审计、日志导出、后端 i18n、tokenkit 模块、relaykit 多项修复，以及 Go/前端依赖升级（`go-epay` 0.0.5、`testify` 1.12.1、`gorilla/websocket` 1.5.3、`@lobehub/icons`、`ai` 7.0.136、`katex` 0.18.2、`dompurify` 3.4.16 等）。GORM 与数据库 driver 版本未变。

#### 检查命令与三数据库结果

前端：`bun install --frozen-lockfile`、`bun run typecheck`、`bun run build`、`bun run test`；lint 使用 `bun x --no-install oxlint -c .oxlintrc.json <本轮变更文件>`。
后端 focused 命令统一带 `CGO_ENABLED=0 GOWORK=off` 与 `-json -count=1`，全部按首个失败即记录、复跑保留：

| package / `-run` | 设置与实际覆盖 | 结果 |
| --- | --- | --- |
| `./model` / `Test(MigrationSchemaStability\|RequestPolicyDatabaseMatrix\|InferencePresetSettingsAndDatabaseRoundTrip\|SystemTaskHistoryDatabaseMatrix\|MigratePrefillGroupUniqueness.*\|MigrateTokenKeyUniqueness.*\|UserSessionPreviousRefreshHash.*)` | `TEST_MYSQL_DSN`、`TEST_POSTGRES_DSN` | 62 pass / 0 fail / 0 SKIP |
| `./service` / `Test(CalculateTextQuotaSummary\|ConsumeLogPromptTokens\|FixedPriceBillingDatabaseMatrix)` | `TEST_FIXED_{MYSQL,POSTGRES}_DSN` 及各自 `_LOG_DSN` | 114 pass / 0 fail / 0 SKIP（每方言 25 个叶子用例） |
| `./controller` / `Test(PreConsumePolicyDatabaseMatrix\|ModelPricingConversionDatabaseMatrix\|ModelManagementDatabaseMatrix\|SharedModelPluginPricingDatabaseMatrix\|VendorManagementDatabaseMatrix\|ModelDeletionDatabaseMatrix\|RequestPolicyRoutingDatabaseMatrix\|AuditDatabaseMatrix\|LogExportDatabaseMatrix)` | `TEST_{MYSQL,POSTGRES}_DSN`；审计类用 `AUDIT_*` | 341 pass / 0 fail（首轮 5 个 SKIP，补 `AUDIT_*` 后 15 pass、仅 `clickhouse` 1 SKIP） |
| `./controller` / `Test(APITokenAuditDatabaseMatrix\|DeleteRedemptionBatch\|IndependentAuditLogStores\|TokenMigrationFromChar48ToVarchar128.*)` | `TEST_{MYSQL,POSTGRES}_DSN` + `_LOG_DSN`、`AUDIT_*` | 224 pass / 0 fail（`clickhouse` 2 SKIP） |
| `./controller` / `Test(ExecuteTaskSubmissionHonorsRouteRetainResult\|ImmediateTaskSettlementDatabase\|TaskListsOmitPersistedSnapshot)` | `TEST_TASK_DB_DIALECT=sqlite/mysql/postgres` 分别运行 | 每库 15 pass / 0 SKIP |
| `./controller` / `Test(SecurityLogin\|OAuthLogin\|OAuthBind\|GenerateOAuthCode\|PasskeyRPIDMigrationPreservesExistingCredentials\|AccessTokenAudit\|AccessTokenLifecycle)` | `TEST_SECURITY_DIALECT=sqlite/mysql/postgres` 分别运行 | 每库 72 pass / 0 SKIP |
| `./controller` / `^TestMultiKeyEnableRestoresOnlyExhaustedChannels$` | `TEST_CHANNEL_SQL_DSN` 分别指向三库 | 每库 18 pass / 0 SKIP |
| `./pkg/perf_metrics` / `^TestPerformanceAggregationAndFlush$` | `TEST_PERF_MYSQL_DSN`、`TEST_PERF_POSTGRES_DSN` | 11 pass / 0 SKIP |

启动 migration 幂等性（真实二进制两次启动，MySQL 与 PostgreSQL 各一轮）：`startup-migration-twice.sh` 首次启动 → 插入 sentinel 行 `users(migration-sentinel)` → 第二次启动 → 对比 `information_schema`/`pg_indexes` 快照。
两库结果一致：`columns identical`、`indexes identical`（两库均 37 张表）、sentinel 行保留、新表 `user_access_tokens` 存在。

#### 首轮失败、纠正与复跑

1. `./model` 三库矩阵首轮 3 个 fail：PostgreSQL DSN 用了 keyword/value 形式，而 `model/main.go` 的 `chooseDB` 只在 `postgres://` / `postgresql://` 前缀时才走 PostgreSQL 分支，于是被当作 MySQL 打开并报 `default addr for network ... unknown`。改用 URL 形式 DSN 后复跑通过；首轮日志保留为 `model-db-matrix-first-dsn-format-fail.jsonl`。
2. 启动 migration 首轮（MySQL）sentinel 插入语句包含不存在的 `updated_at` 列而失败；同一轮 PostgreSQL 的 schema 快照查询漏了 `-d newapi_startup`，两次快照都是空文件，"identical" 无意义。修正脚本后两库完整重跑，结果如上；首轮产物另存为 `startup-run1-*`。
3. 全量 root 测试本轮一次通过（无上一轮的 WebSocket 预扣断言失败与 `SQLITE_BUSY` 抖动），未做复跑。

#### 升级路径与补充矩阵（独立审查后补验）

独立只读审查（补丁契约、认证、数据库三路）指出两处首轮未覆盖项，本轮已补验：

1. `task_plugins.source/icon` 由 `TEXT/MEDIUMTEXT` 升为 `LongText`：`controller` 的 `^TestTaskPluginSourceAboveMySQLTextLimitRoundTrips$` 在 `TEST_TASK_DB_DIALECT=sqlite/mysql/postgres` 三库分别运行，各 2 pass / 0 fail / 0 SKIP。
2. `^TestManageUser` 在 `TEST_MANAGE_USER_DIALECT=sqlite/mysql/postgres` 三库各 43 pass；其中 `TestManageUserQuotaMiddlewareKeepsOneOperationPerRequest` 三库一致失败（期望 200，实际 401 `ACCESS_TOKEN_LEGACY_RETIRED`：dialect 路径的 fixture 未初始化 legacy token 的 30 天退役选项，fail-closed 生效）。在固定 `633b4c5b1` 的隔离 worktree 用相同环境复现同一失败，判定为上游既有的 fixture 缺口，非本轮合并引入；按维护规则不在本轮顺手修改上游实现或断言，也未改动该测试。

升级路径（`upgrade-from-rc43.sh`，参数化 binary 与库名）：最新发布 tag `v1.0.0-rc.44` 就是本轮目标 `633b4c5b1`，而 `v1.0.0-rc.43` 已包含新表，因此真正有意义的升级基线取 `v1.0.0-rc.39`（`9978ee1e2`，2026-09-20，上一轮维护基线所在发布版）。用 rc.39 二进制在全新库建立“已发布版本 schema”（MySQL/PG 各 36 张表），插入 sentinel 行后再用本轮合并二进制启动升级：

| 检查 | MySQL 8.4.11 | PostgreSQL 16.15 |
| --- | --- | --- |
| 启动日志错误 | 无 | 无 |
| schema 差异 | 仅 `task_plugins.source` `text→longtext`、`icon` `mediumtext→longtext`，新增 `user_access_tokens`（10 列） | 仅 `task_plugins.icon` `varchar→text`，新增 `user_access_tokens`（10 列） |
| 表数 / 列数 | 36→37 / 440→450 | 36→37 / 440→450 |
| sentinel 行 | 保留 | 保留 |
| `LegacyAccessTokenRetireAt` option | 0→1 | 0→1 |
| 升级后再次启动 | schema 快照完全一致、无重复 ALTER | 同上 |

另用 rc.43 → 合并结果各跑一轮（MySQL）：`user_access_tokens`、`longtext`、option 行在 rc.43 已存在，升级后 sentinel 保留、无错误，作为相邻发布版的回归数据点。

#### 认证与其他专项

本轮上游引入路由级 scoped access token 与 step-up 身份（`middleware/access_token_routes.go`、`middleware/auth.go`、`model/user_access_token.go`、`service/security_verification.go`）。
`TEST_SECURITY_DIALECT` 三库安全矩阵（含 OAuth login 流程绑定、Passkey 迁移、access token 生命周期与审计）全部通过。
本轮只做了入口级静态核对（未新增 ASVS 判定）：上一轮记录的两项边界（以 `10.1.2` 计的 OAuth login 发起浏览器服务端绑定缺失、GitHub 跨用户并发认领唯一性未验证）本轮没有针对性验证，状态不变，仍不作为合规结论。
真实 provider、双浏览器攻击复现与 GitHub 并发声明测试仍未执行。

本轮证据：`/Users/andy/AI/GitHub/new-api/.git/maintenance-evidence/2026-10-12T144745Z-upstream-633b4c5b1/`。
包含 baseline/环境、前端安装/typecheck/build/test/lint 与 TARGET lint 对照、root vet/build/test、relaykit、全部三库 matrix 的 JSONL 与状态、启动 migration 脚本与两轮快照、首轮失败与修正记录；均为本地持久证据，不随 push 共享。

未验证项 / 阻塞：ClickHouse 日志库与审计存储（无实例，`LogExportDatabaseMatrix/clickhouse`、`IndependentAuditLogStores/clickhouse` 保持 SKIP）；`TestVLLMStatusLive`（外部服务）；上节 OWASP 两项边界仍待验证；`^TestManageUser` 的 fixture 缺口为已复现的上游既有失败（非环境阻塞）。这些缺口不因其余检查全绿而消失。

### 2026-10-15：同步 14 个上游提交并复核三数据库与 rc.44 升级路径

| 字段 | 记录 |
| --- | --- |
| 执行环境 | macOS darwin/arm64（Darwin 27.0.0），日期按 Asia/Shanghai（Git 恢复引用用 UTC 时间戳） |
| 维护分支 / 合并前 | `fix/anthropic-consume-log-cache-tokens` / `60327b1c242f8639564eddfdf0aa213c1dd05417` |
| 固定上游目标 | `origin/main` → `718a4e7f9751c5bf1958747cd0c2c895e2b937d4`，新增 14 个提交、71 个文件（+2603 / −323） |
| fork fetch | `HEAD..fork/fix/anthropic-consume-log-cache-tokens` 为空，无远端独有提交 |
| 恢复引用 | `codex/backup/anthropic-cache-2026-10-14T162034Z-upstream-718a4e7f9` → `60327b1c2` |
| merge commit | `d199ac1fb479e6a33ea1dbe294d0ca4cb4ef0602` |
| 后续提交 | `654f356eb`（PATCH-001 cache-only 回归用例）；本条日志为独立 docs commit |
| 冲突 | 无文本冲突；`service/text_quota.go`、`service/text_quota_test.go` 自动合并，未修改业务实现 |
| PATCH-001 | `adapted`；合并后 `hasBillableUsage` 取上游新版（cache-only 可计费），`PromptTokensExcludeCache` / `consumeLogPromptTokens` 保留，三库回归与新增 cache-only 用例通过 |
| 工具 | Go 1.27.2 darwin/arm64、Bun 1.3.9、Node 26.11.1；`go.mod` 仅 `moejs alpha.6 → alpha.7`，无 GORM/driver 变化 |
| 前端 | frozen-lockfile 安装、typecheck、真实 build（重建 `web/dist` 后再构建 root）通过；完整测试 189 文件 / 2264 用例全通过 |
| 前端 lint | 22 个本轮变更 TS/TSX 文件 oxlint 报 2 error（2 文件）；固定 `718a4e7f9` 隔离 worktree 用同一 node_modules 复现同样 2 文件 2 error，属上游既有 lint 债 |
| 插件 lint | 4 个变更 `plugin.js`：0 error / 2 warning |
| root | `CGO_ENABLED=0 GOWORK=off go vet/build` 通过；全量 `go test -json ./...` 无缓存 exit 0：4907 pass、0 fail、90 个 test-level SKIP（数据库/外部服务），数据库类 SKIP 由下方 focused matrix 逐项覆盖 |
| relaykit | 独立 `GOWORK=off` vet/build/test 通过；9 个有测试的包 539 pass、0 fail、无 test-level SKIP（另 8 个包无测试文件） |
| 数据库 | SQLite 3.50.4（modernc.org/sqlite v1.40.1）、MySQL 8.4.11、PostgreSQL 16.14（OrbStack 一次性容器，专用可销毁库） |
| 同步与验收状态 | 固定上游已纳入历史；PATCH-001 已验证；本轮适用检查通过（含 rc.44 升级路径、两次启动幂等与数据保留） |
| 推送状态（文档提交前） | 用户本轮只授权合并，未授权 push；此条写入时未推送，本地 HEAD 为紧随其后的 docs commit |

本轮上游增量：Vertex API Key 模式 project_id 与多区域主机名、Vidu/Hailuo/Veo 插件绑定与 Vidu 计费修正、Claude 缓存专用 usage 保留（`1b63c28dc`）、令牌 `allow_user_quota_query` 与只读令牌接口的 IP 白名单/禁用校验、定价排序、Sub2API 余额查询、请求体读取错误传播（`common/gin.go`、`middleware/utils.go` 的 413）、默认关闭敏感词过滤，以及 moejs 与第三方许可清单更新。

#### 检查命令与三数据库结果

前端：`bun install --frozen-lockfile`、`bun run typecheck`、`bun run build`、`bun run test`；lint 使用 `bun x --no-install oxlint -c .oxlintrc.json <本轮变更文件>`。
后端 focused 命令统一带 `CGO_ENABLED=0 GOWORK=off` 与 `-json -count=1`：

| package / `-run` | 设置与实际覆盖 | 结果 |
| --- | --- | --- |
| `./model` / `Test(MigrationSchemaStability\|RequestPolicyDatabaseMatrix\|InferencePresetSettingsAndDatabaseRoundTrip\|SystemTaskHistoryDatabaseMatrix\|MigratePrefillGroupUniqueness\|MigrateTokenKeyUniqueness\|UserSessionPreviousRefreshHash)` | `TEST_MYSQL_DSN`、`TEST_POSTGRES_DSN` | 62 pass / 0 fail / 0 SKIP |
| `./service` / `Test(CalculateTextQuotaSummary\|ConsumeLogPromptTokens\|FixedPriceBillingDatabaseMatrix)` | `TEST_FIXED_{MYSQL,POSTGRES}_DSN` 及各自 `_LOG_DSN` | 114 pass / 0 fail / 0 SKIP |
| `./controller` / `TestTokenMigrationFromChar48ToVarchar128` | `TEST_MYSQL_DSN`、`TEST_POSTGRES_DSN`；含 `allow_user_quota_query` 列断言 | 4 pass / 0 SKIP（sqlite/mysql/postgres） |
| `./controller` / `Test(APITokenAuditDatabaseMatrix\|DeleteRedemptionBatch\|IndependentAuditLogStores\|LogExportDatabaseMatrix)` | `TEST_{MYSQL,POSTGRES}_DSN` + `_LOG_DSN`、`AUDIT_{MYSQL,POSTGRES}_DSN` | 231 pass / 0 fail / 3 SKIP（clickhouse 无实例） |
| `./controller` / `Test(PreConsumePolicyDatabaseMatrix\|ModelPricingConversionDatabaseMatrix\|ModelManagementDatabaseMatrix\|SharedModelPluginPricingDatabaseMatrix\|VendorManagementDatabaseMatrix\|ModelDeletionDatabaseMatrix\|RequestPolicyRoutingDatabaseMatrix)` | `TEST_{MYSQL,POSTGRES}_DSN` | 335 pass / 0 fail / 0 SKIP |
| `./controller` / `Test(SecurityLogin\|OAuthLogin\|OAuthBind\|GenerateOAuthCode\|PasskeyRPIDMigrationPreservesExistingCredentials\|AccessTokenAudit\|AccessTokenLifecycle)` | `TEST_SECURITY_DIALECT=sqlite/mysql/postgres` + 对应 `TEST_<DIALECT>_DSN` | 每方言 72 pass / 0 fail |
| `./controller` / `Test(ExecuteTaskSubmissionHonorsRouteRetainResult\|ImmediateTaskSettlementDatabase\|TaskListsOmitPersistedSnapshot)` | `TEST_TASK_DB_DIALECT=sqlite/mysql/postgres` | 每方言 15 pass / 0 SKIP |

启动 migration 幂等性（真实二进制两次启动，MySQL 与 PostgreSQL 各一轮）：首次启动 → 插入 sentinel 用户与令牌行（`remain_quota=777`）→ 第二次启动 → 对比列/索引快照。
两库一致：`columns identical`、`indexes identical`、37 张表、sentinel 两行保留、`tokens.allow_user_quota_query` 存在。

升级路径（`upgrade-from-rc44.sh`）：最新发布 tag `v1.0.0-rc.44` 即 `633b4c5b1`，用其二进制在全新库建立已发布 schema（37 张表、无 `allow_user_quota_query`），插入 sentinel 后用本轮合并二进制启动升级：

| 检查 | MySQL 8.4.11 | PostgreSQL 16.14 |
| --- | --- | --- |
| 启动日志错误 | 无 | 无 |
| schema 差异（列） | 仅新增 `tokens.allow_user_quota_query` `tinyint(1)`（可空、无默认） | 仅新增 `tokens.allow_user_quota_query` `boolean`（可空、无默认） |
| schema 差异（索引） | 无 | 无 |
| sentinel 行 | 用户 `quota=42`、令牌 `remain_quota=777` 保留 | 同上 |
| 升级后再次启动 | 列/索引快照完全一致 | 列/索引快照完全一致 |

新增列可空且无默认，升级后的既有令牌读取为 `false`（用户额度查询保持关闭），新建令牌由 `AddToken`/注册流程写入 `true`；该语义由上游 `TestTokenAllowUserQuotaQueryOnCreateAndUpdate`、`TestGetTokenUsageFollowsTheUserQuotaSwitchAndIPWhitelist` 与 token 迁移兼容测试共同固定。

#### 首轮失败、纠正与复跑

1. 首轮 controller 混合组（token 迁移 + 审计 + 兑换批 + 预扣费/模型管理 + `APITokenAuditDatabaseMatrix`）失败 18 项：同一 DSN 上先跑的组留下 `users/tokens/channels` 表，使要求空库的 `TestTokenMigrationFromChar48ToVarchar128*` 主动 SKIP、`TestDeleteRedemptionBatch` 报 "use an empty test database"。改为按组清理库并按组运行后全部通过（本过程不使用 `IF NOT EXISTS` 之外的绕过手段，未修改任何测试）。
2. 审计组随后 11 项失败为 `Unknown database 'newapi_audit'`：创建该库（MySQL/PG）后 231 pass / 0 fail，仅 clickhouse 保持 SKIP。
3. 安全矩阵首轮 mysql/postgres 各 65 fail：fixture 通过 `TEST_<DIALECT>_DSN` 取 DSN，而首轮只设了 `TEST_SECURITY_DIALECT`；补上两个 DSN 后每方言 72 pass。
4. `TestDeleteRedemptionBatch/sqlite` 在隔离运行（`-run 'TestDeleteRedemptionBatch/sqlite'`）时失败（审计事件为 0、200 断言不成立），在固定 `718a4e7f9` 的隔离 worktree 复现完全相同的失败签名；全量套件中通过。判定为上游既有的测试隔离/全局状态依赖，非本轮合并引入，未修改该测试。
5. 证据脚本自身两处缺陷（PostgreSQL 分支用 `0` 写 boolean 列、`key` 列未加反引号）导致首轮 sentinel 令牌未写入；修正后重跑 MySQL 与 PostgreSQL 两轮，得到上表结果。

#### 认证与其他专项

本轮上游改动触及只读令牌接口：`middleware/auth.go` 的 `TokenAuthReadOnly` 现在拒绝已禁用令牌、并在存在 IP 白名单时强制校验（客户端 IP 无法解析即 403，fail-closed）；`controller/token.go` 的 `GetTokenUsage` 仅在该令牌 `allow_user_quota_query` 为真时返回所属用户额度。
两者都是服务端强制控制，未引入前端可绕过的路径；三库安全矩阵（含 OAuth login/bind、Passkey 迁移、access token 生命周期与审计）各 72 pass。
本轮为合并上游既有实现，未新增 ASVS 控制项判定；上一轮记录的两项边界（OAuth login 缺少发起浏览器的服务端绑定、GitHub 跨用户并发认领唯一性未验证）本轮无针对性验证，状态不变，仍不作为合规结论。

#### 独立只读审查发现（三个并行 subAgent，未改动仓库文件）

- 补丁与计费：PATCH-001 契约成立；上游 `1b63c28dc`（cache-only 可计费 + 保留零 fresh input）与 Claude relay 估算修复使纯 cache 请求由"不收费/过度估算"转为按上报 usage 计费，方向一致且有测试；Vidu `metadata` 不能再覆盖计费用的 model/duration/resolution，非负与有界由插件 + host（`relay/channel/task/jsplugin/adaptor.go`、`service/task_billing.go`）双重兜底。
- 插件元数据：四个变更插件的数值字段仍是"计费对象 + 单价"、unit 分离、en/zh 等价，无新增不规范描述；`docs/plugin-api/*` 本区间未改动，无需同步。两处既存缺口（`v1.d.ts` 的 `DriverContext` 未声明 `auth`/`authError`；`v1.md` 的 native-route 前缀示例未列 vidu/hailuo/google/vertex-ai）非本轮引入，未处理。
- 前端：组件复用、i18n（12 个新 key 在七语言齐全）、Intl locale 规则均无问题；上游本轮新增的 UI 路径存在测试覆盖缺口（排序仅断言 4 项、Vertex Project ID 组件级行为无测试、令牌开关编辑路径无测试等），属上游既有范围，本轮不顺手补测。
- 值得跟进的可见行为变化：pricing 排序选项改值后，旧书签 `?sort=price-low` / `price-high` 不再匹配，静默回退为 API 原序（无测试、无迁移）；`TokenAuthReadOnly` 本轮新增令牌 IP 白名单强制（已禁用令牌的拒绝校验在合并前即存在，本轮只同步了注释），已配 `allow_ips` 的令牌在非白名单 IP 访问 `GET /api/usage/token/`（`router/api-router.go:301-306`）与 `GET /api/log/token`（`:359`）由 200 变 403，客户端 IP 无法解析时同样 403；未配白名单的令牌不受影响。`middleware/auth_test.go`、`controller/token_test.go` 覆盖。
- 认证侧本轮只做了入口级静态核对：新增的 per-token 额度查询开关由服务端强制、默认仅对新建令牌开启；独立审查建议下一轮按 ASVS 对"额度信息暴露面"做一次正式判定（本轮未做，故不声明合规）。

本轮证据：`/Users/andy/AI/GitHub/new-api/.git/maintenance-evidence/2026-10-14T162034Z-upstream-718a4e7f9/`（含 baseline 环境、root/relaykit/前端日志、全部三库 matrix 的 JSONL、首轮失败与纠正、启动 migration 与 rc.44 升级脚本与快照）。本地持久证据，不随 push 共享。

未验证项 / 阻塞：ClickHouse 日志与审计存储（无实例）；`TestVLLMStatusLive`（外部服务）；上述两项 OWASP 边界与本节新增的 ASVS 判定待办。这些缺口不因其余检查全绿而消失。

### 新轮次记录模板

复制到本节末尾，替换所有占位内容；无变化不必新增流水账。

```text
日期 / 执行环境：
维护分支 / 合并前 SHA / 恢复引用：
上游 remote / 固定目标 SHA / 新增提交数：
fork fetch 后 SHA / 是否存在远端独有提交 / 处理：
merge SHA（或 no-op、未提交及原因）：
本地补丁：逐项状态、契约验证、上游等价实现证据：
冲突文件 / 解决理由 / 新增适配：
工具版本 / 与 CI 的差异：
检查命令与结果（含首次失败、复跑、cached、SKIP）：
数据库精确版本 / fresh、upgrade、重复 migration 及数据约束结果：
认证或其他专项审查（适用时）：
完整日志位置 / 可持久访问的证据：
未验证项 / 阻塞 / 下一步：
目标 ancestry / 剩余 tree diff / 工作区复核：
Git 同步状态 / 补丁验证状态 / 完整验证状态：
推送授权与结果（未推送或实际已核对的远端 SHA）：
```
