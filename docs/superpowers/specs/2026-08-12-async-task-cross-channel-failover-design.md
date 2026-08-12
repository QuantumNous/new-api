# 异步视频任务跨渠道容灾设计

日期：2026-08-12  
状态：已实现（核心路径已落地；multipart 跨渠与 Classic UI 仍见设计非目标）  
关联：`docs/superpowers/specs/2026-08-11-mao-async-retry-design.md`  
实现计划：`docs/superpowers/specs/2026-08-12-async-task-cross-channel-failover-plan.md`

## 1. 目标

为**全部异步视频任务**提供统一容灾：

1. **提交阶段**：创建失败时按候选顺序换下一个渠道再试  
2. **轮询阶段**：上游异步生成失败后，先同渠再提，再用尽换下一个渠道  
3. 客户端始终使用同一本地 `task_id` 轮询  
4. 计费始终按客户端请求的模型价；仅最终失败退款  

典型场景：对外统一模型名（如 `seedance2`），多渠道通过 `model_mapping` 映射到不同上游名；提交失败与生成失败都能自动换渠。

## 2. 范围与非目标

**范围内：**

- 所有异步视频 / Task 提交与轮询路径（不限单一渠道类型）  
- 同渠可配置重试次数 N + 跨渠 failover  
- 可选「模型 → 有序渠道列表」覆盖默认 Priority  
- 错误分类：审核终态；上游余额不足强制换渠；其它先同渠再换渠  
- 收编现有 Mao `TryResubmitOnFailure` 进统一编排器  

**非目标：**

- 跨不同**客户端模型名**的 fallback 链（虚拟模型 A→B→C）  
- 客户端 / Token 级自定义容灾链  
- 为协议不兼容的上游做自动请求体转译（候选取同一对外模型下的渠道，靠各渠 `model_mapping`）  
- Classic 主题完整 UI（本期优先 default；Classic 可后续跟进）  

## 3. 方案概述

新增统一编排器（建议 `service/task_failover.go`），挂在：

- `controller/relay.go` → `RelayTask` 提交重试循环（增强选渠）  
- `service/task_polling.go` → `updateVideoSingleTask` 的 `FAILURE` 分支（替代「仅适配器可选同渠重提」为「编排器决策」）  

```
提交失败 ──► 按候选顺序换下一渠道再创建
     │
创建成功 ──► 快照 failover_channel_ids；保存 request_body；绑定 channel + upstream_task_id
     │
轮询失败 ──► 审核 → 终态失败
           上游余额不足 → 直接换下一渠创建
           其它 → 同渠未用尽则再提；否则换下一渠；无候选项 → 终态失败 + 退款
```

**选渠优先级：**

1. 若该模型配置了有序渠道列表 → 严格按列表（跳过禁用 / 已试过）  
2. 否则 → 现有 Ability **Priority** 阶梯（同 Priority 内 Weight）  

## 4. 数据字段

扩展 `model.TaskPrivateData`（JSON，向后兼容）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `request_body` | string | 已有：当前渠道上游 create body，仅供**同渠**再提交 |
| `client_request_body` | string | 新增：客户端原始请求 body，供**换渠**时按新渠道重建 |
| `retry_count` | int | **语义变更**：当前渠道上的同渠失败 / 再提计数（不再是全局失败次数） |
| `tried_channel_ids` | []int | 已尝试过的渠道 ID，避免循环 |
| `failover_channel_ids` | []int | 本次任务创建成功时快照的候选顺序 |
| `same_channel_max_retries` | int | 创建时写入的同渠上限 N，避免中途改配置影响进行中任务 |

对外 `Task.TaskID` 不变。换渠时更新任务的 `channel_id`、`PrivateData.UpstreamTaskID`，并将当前渠 `retry_count` 置 0；`tried_channel_ids` 追加旧渠道。

**兼容：** 旧 Mao 任务仅有 `retry_count`、无 `failover_channel_ids` 时：同渠逻辑仍可用；无快照则换渠时按当前配置即时解析候选列表（并排除当前渠与 `tried`）。

## 5. 系统配置

| 配置键 | 说明 | 默认建议 |
|--------|------|----------|
| `TaskSameChannelMaxRetries` | 每个渠道上，异步失败后允许的**同渠再提交次数**。记创建成功后首次进入轮询失败时 `retry_count` 从 0 起：每次准备同渠再提前 `retry_count++`；当 `retry_count >= TaskSameChannelMaxRetries` 时不再同渠，改为换渠（或终态）。 | `2`（即同一渠道最多同渠再提 2 次；第 3 次失败走换渠） |
| `TaskCrossChannelFailoverEnabled` | 跨渠容灾总开关；`false` 时仅保留同渠再提（若适配器支持），行为接近现网 Mao | `true` |
| `TaskModelChannelOrder` | JSON：`map[modelName][]channelId` 有序覆盖 | `{}` |

有序列表为空的模型：完全沿用现有 Priority / Weight。

## 6. 接口与挂载点

### 6.1 编排器

```go
// 伪接口 — 实际签名以实现为准
func HandleAsyncTaskFailure(ctx, task, channel, adaptor, failReason) (handled bool, progress string, err error)
// handled=true：任务保持非终态（已同渠重提或已换渠创建），调用方不得退款
// handled=false：应按终态 FAILURE 处理并退款
```

同渠再提：若适配器实现现有 `TaskAsyncFailureResubmitter`（或抽出的更窄「同渠再提交」接口），由编排器在「应同渠」分支调用。  
未实现同渠再提的渠道：视为同渠能力为 0，直接进入换渠（在可重试且非审核的前提下）。

换渠创建：编排器选下一候选渠道，**禁止**把旧渠道的上游私有 `request_body` 原样 POST 到新上游。  
提交成功时必须额外持久化**客户端原始请求 body**（字段名建议 `client_request_body`；与上游 `request_body` 区分）。换渠时对新区道走完整 Convert + `model_mapping` + Build，再创建；成功后刷新该渠的上游 `request_body` 与 `UpstreamTaskID`。

### 6.2 提交阶段

`RelayTask` 循环中 `getChannel` / 候选展开改为：

- 读取有序列表或 Priority 展开为有序候选  
- `retry` 索引对应下一候选（与现有 Priority 阶梯语义对齐）  
- 创建成功后写入 `failover_channel_ids`、`same_channel_max_retries`、上游 `request_body`、以及 `client_request_body`

`shouldRetryTaskRelay` 规则基本保留（400 / 本地错误不重试等）。

### 6.3 轮询阶段

`updateVideoSingleTask` 在 `TaskStatusFailure` 分支：

1. 调用编排器 `HandleAsyncTaskFailure`  
2. 若 `handled` → 置 Queued（或等价非终态）、更新 Progress、**不** `shouldRefund`  
3. 否则 → 原有 FAILURE + 退款  

Mao 专用路径不再单独短路为唯一实现，改为编排器内的同渠分支实现之一。

## 7. 错误分类

从 Mao 关键词表抽到公共包（如 `service/task_fail_reason.go`），并调整语义：

| 类型 | 行为 |
|------|------|
| 审核 / 违规 | 立刻终态失败，不同渠、不换渠 |
| 上游余额不足 | **强制换下一渠道**（跳过同渠重提） |
| 其它可重试失败 | 先同渠，用尽再换渠 |
| 本地 / 参数错误（提交阶段） | 不重试 |
| 候选用尽 | 终态失败 + 退款 |

**审核类关键词（示例，与现网 Mao 对齐并可扩展）：**  
`audit`、`policy`、`违规`、`敏感`、`违禁`、`content_policy`、`moderation`、`nsfw`、`rejected by`、`审核`

**上游余额不足（强制换渠，不再作为「不可重试终态」）：**  
`余额不足`、`insufficient balance`、`insufficient_quota`、`insufficient quota`、`out of credit`、`out of credits`、`quota exceeded`、`payment required`、`402`、`credit insufficient`、`no enough quota`

注意：此处「余额不足」指**上游渠道**余额，不是本站用户额度不足。本站用户预扣失败仍走本地错误，不换渠。

## 8. 进度文案

| 场景 | 示例 |
|------|------|
| 同渠再提 | `retrying 2/3` |
| 换渠后 | `switching 2/5`（当前候选序号 / 总候选数） |

具体分母与计数在实现时与 `same_channel_max_retries`、`failover_channel_ids` 长度对齐，保证客户端可理解且稳定。

## 9. 计费

- 预扣与结算始终基于 **OriginModelName** 及提交时 `BillingContext` 快照  
- 换渠不按新渠道重新计价，不重复预扣  
- 中间同渠 / 换渠失败：不退款  
- 最终 `FAILURE`（审核终态或候选用尽）：退款  
- 成功：沿用现有轮询差额结算逻辑（按次模型可跳过补差）  

## 10. 前端（default）

1. 系统设置：`TaskSameChannelMaxRetries`、`TaskCrossChannelFailoverEnabled`  
2. 模型有序渠道列表编辑器：选择模型 → 列出支持该模型的渠道 → 拖拽排序 → 保存到 `TaskModelChannelOrder`  
3. 渠道编辑可提示：未进入有序列表时仍参与 Priority 容灾  

## 11. 测试要点

- 关键词：审核终态；余额不足强制换渠；其它先同渠再换渠  
- 提交：有序列表顺序；无列表时 Priority  
- 轮询：同渠 N 次后换渠；`task_id` 不变；`tried_channel_ids` 不循环  
- 计费：中途不退；全失败才退；成功按原模型价  
- 回归：原 Mao 同渠行为经编排器后仍正确；无同渠接口的渠道可直接换渠  
- 换渠创建使用新渠道 mapping / Build，不把渠 A 的上游私有 body 原样打到渠 B  

## 12. 风险与约束

- **协议差异**：同一对外模型下若渠道协议不兼容，换渠可能失败；失败则继续下一候选，最终仍可能全失败。不在本期做协议转译。  
- **request_body 不可移植**：必须在换渠路径使用客户端原始请求 + 新渠道适配器重建。  
- **与 channel affinity**：指定渠道 / affinity 禁止重试时，提交与轮询跨渠均应尊重现有 SkipRetry 语义（不强制换渠）。  
- **并发轮询**：换渠更新需与现有任务 CAS / 乐观更新一致，避免双重退款或双着重提。  

## 13. 实现分期建议

1. 公共失败分类 + 编排器骨架 + 轮询挂载（含 Mao 收编）  
2. 提交阶段有序候选 + PrivateData 快照字段  
3. 换渠创建（原始 body 重建）+ 计费回归  
4. 系统配置与 default 前端有序列表编辑器  
