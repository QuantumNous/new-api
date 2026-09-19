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
| 状态 | `adapted`；在合并 `05f423130` 后核验，已纳入 fork 的 OpenRouter 修复 `104902b51` |
| 原始提交 | `4add2c53afe574d0a26038ac51c9e2668d7bab1d` |
| 后续修复 | `104902b51371345fead518d9e702a967983675b4`，保留 OpenRouter 输入总数，处理 aggregate/split cache write 不一致 |
| 实现 | [service/text_quota.go](../service/text_quota.go) |
| 回归 | [service/text_quota_test.go](../service/text_quota_test.go)、[service/text_quota_consume_log_test.go](../service/text_quota_consume_log_test.go) |
| 必要性 | Anthropic 风格 fresh-only 输入计数在写 consume log 时需加回 cache read/write，使统计采用总输入 token |
| 上游跟踪 | 目标 `043ff99a5` 尚未包含等价实现；未登记 PR 状态 |

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
