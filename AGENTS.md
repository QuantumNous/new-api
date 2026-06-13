# AGENTS.md

> 适用范围：Codex 桌面端/CLI 在真实商业项目中的日常开发、Bug 修复、需求模块开发、UI 调整、产品/需求文档、任务拆解、架构调整、新项目接入、代码审查与安全审查。  
> 核心目标：正常任务高效推进；高风险任务可控、可审查、可回滚；尽量节约 token，但不牺牲证据、质量和安全底线。

## 0. 文件分工：只按需读取

Codex 每次进入项目必须读取本文件。专项任务再按需读取下列文件，避免一次性加载全部规则：

```text
.agents/WORKFLOW.md          # 日常开发、Bug、UI、架构调整、新项目接入
.agents/PLAN_POLICY.md       # 执行前计划、任务拆解、阶段执行文档规则
.agents/PRODUCT_WORKFLOW.md  # 需求分析、UI 设计、产品文档、验收标准
.agents/REVIEW_SECURITY.md   # 未提交代码审查、多提交功能审查、阶段性安全扫描
.agents/PAYMENT_REVIEW.md    # 支付、交易、余额、权限、生产数据等严格审查
.agents/TOKEN_POLICY.md      # token 控制、RTK/摘要、证据保留策略
.agents/LOOP_POLICY.md       # 受控 Loop、自动修复轮数、停止条件
.agents/CHANGE_POLICY.md     # Bug/需求变更/决策记录的索引与归档规则
```

原则：`AGENTS.md` 是入口和边界，不是百科全书。不要把所有历史、所有 bug、所有需求全文塞进上下文。

## 1. 基础沟通规则

- 默认使用中文回复、写计划、写总结。
- 先辩证判断，不要为了迎合用户而执行明显高风险、不合理或过度工程化的方案。
- 不重复询问用户已提供的信息；能从仓库、文档、配置、代码、Git diff 中确认的，先自行确认。
- 必须确认的问题集中列出，不要每一步零散打断。
- 非阻塞疑问可先做合理假设，并在最终总结中标注；长期有价值的假设写入 `docs/codex/ASSUMPTIONS.md`。
- 不编造已经运行过的命令、测试、扫描、文件内容或审查结论。
- 输出简洁，但不能省略：风险、假设、验证结果、人工验收点。

## 2. 授权边界

当用户明确要求“实现、修改、修复、优化、重构、生成文件、补充文档、整理规则包”时，视为允许在当前项目工作区内做必要文件修改。

以下操作必须先集中询问并获得明确确认：

- 删除文件、批量移动文件、清空目录。
- `git commit`、`git push`、`git reset --hard`、`git clean -fd`、切换/删除分支。
- 安装、升级、删除依赖，或修改 lockfile。
- 修改数据库结构、迁移脚本、生产配置、CI/CD 发布流程。
- 修改登录、权限、支付、交易、余额、计费、文件读写、加密、远程接口、Webhook、Token、密钥相关逻辑。
- 访问网络、调用外部服务、读取或输出 `.env`、证书、私钥、生产密钥、真实用户数据。
- 项目根目录以外的写入。
- 大范围重构、跨模块架构变更、破坏兼容性的 API/数据结构变更。

## 3. 风险等级

每次任务先判断风险等级，并按等级选择流程：

```text
L1 低风险：文案、样式、小范围 UI、注释、普通展示配置、非核心日志。
L2 中风险：普通功能迭代、Bug 修复、组件结构、路由、状态、接口参数、轻量重构。
L3 高风险：登录、权限、文件读写、远程接口、Webhook、安全相关、数据迁移、依赖升级。
L4 架构级：技术栈迁移、核心模块重构、数据库设计、CI/CD 发布链路、大规模目录调整。
L5 严格级：支付、交易、余额、计费、提现、结算、生产数据、密钥、资金或权限闭环。
```

执行原则：

- L1/L2：用户已明确任务时，按简短计划直接执行，尽量少打断。
- L3：先分析影响面和风险；可做无风险调查，核心修改前集中确认。
- L4：优先方案、拆解、迁移计划和回滚方案；没有明确确认不直接大规模修改。
- L5：必须读取 `.agents/PAYMENT_REVIEW.md`，走严格审查；不得用日常流程绕过。

## 4. Codex 桌面端能力使用原则

优先使用 Codex 已有能力，不重复造轮子：

- 代码审查优先使用 Codex 的 review/diff 能力；必要时用 `/review` 或审查当前 diff/commit range。
- 复杂任务、支付/交易修复、架构调整优先使用 Worktree 隔离，不污染当前工作目录。
- 安全相关审查优先使用 Codex Security 的最窄 workflow；不要默认 deep scan。
- Sandbox/approval 是商业项目安全边界，不要为了少确认长期使用 full access。
- Subagents 只在复杂审查或多方向分析时使用，日常任务不要默认开多个 agent 烧 token。
- Skills/plugins 只装真正高频且能减少手动循环的；不要装一堆泛泛 code-review skill。

## 5. Token 与上下文原则

- 默认先看 `git status`、`git diff --name-only`、`git diff --stat`、相关文件、测试摘要。
- 不默认全仓扫描、不默认 deep scan、不默认读取所有 `docs/codex/*`。
- 优先使用 `.agents/TOKEN_POLICY.md` 中的压缩和证据保留策略。
- 安全、支付、权限、数据库、生产配置相关证据不得只保留摘要。
- 长日志只引用关键行和原始命令；必要时说明如何查看完整输出。

## 6. 项目沉淀文档：使用中生成，不随规则包预置

以下文档由 Codex 在项目使用中按需创建/更新，升级规则包时不得删除：

```text
docs/codex/PROJECT_CONTEXT.md   # 项目结构、技术栈、启动/验证方式、关键模块
docs/codex/CODE_STYLE.md        # 从现有代码提炼的编码风格和约定
docs/codex/DECISIONS.md         # 重要技术决策、取舍、不可随意改动原因
docs/codex/OPEN_RISKS.md        # 未关闭风险、技术债、人工关注点
docs/codex/BUG_INDEX.md         # 可复用 bug 模式索引，不记录所有全文
docs/codex/CHANGE_INDEX.md      # 需求/产品变更索引，不记录所有全文
docs/codex/TASK_STATE.md        # 当前任务计划、进度、失败尝试、停止条件
docs/codex/archive/             # 旧 bug、旧变更、旧记录归档
```

不要维护无限增长的 `ALL_BUGS.md` 或 `FULL_CHANGELOG.md`。历史资料用索引 + 归档，按需检索。

## 7. 执行前计划

涉及代码修改、产品文档、UI 设计、架构调整、新项目接入、复杂 Bug 修复时，先按 `.agents/PLAN_POLICY.md` 写简短执行计划。计划必须包含：目标、范围、不做什么、风险等级、步骤、验证方式、停止条件。

L1/L2 计划可以很短；L3/L4/L5 计划必须更严格，并列出确认项。

## 8. 验证规则

优先运行项目统一检查脚本：

```powershell
.\scripts\codex-check.ps1
```

阶段性安全扫描：

```powershell
.\scripts\codex-check.ps1 -Security
```

严格模式：

```powershell
.\scripts\codex-check.ps1 -Security -Strict
```

多提交范围辅助：

```powershell
.\scripts\codex-check.ps1 -ReviewBase <base> -ReviewHead <head>
```

验证失败时：最多自动修复 3 轮；同类错误重复 2 次必须停止并总结。不得为了通过检查而删除测试、降低规则、吞掉错误或屏蔽安全扫描。

## 9. 最终回复格式

日常任务完成后输出：

```text
本次做了什么：
修改文件：
为什么这样改：
验证命令与结果：
风险点：
人工验收点：
已更新的 docs/codex 文档：
```

代码审查/安全扫描完成后输出：

```text
审查范围：未提交代码 / commit range / 阶段性安全 / 严格审查
总体结论：可继续 / 需修复后继续 / 暂不建议合并
已运行检查：
未能运行检查及原因：
高风险：
中风险：
低风险：
可能误报：
可自动修复项：
必须人工确认项：
建议处理顺序：
```
