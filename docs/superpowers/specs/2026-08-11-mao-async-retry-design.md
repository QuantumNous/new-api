# Mao 异步失败同渠重试设计

日期：2026-08-11  
状态：已确认设计，待实现  
关联：`docs/superpowers/specs/2026-08-11-mao-seedance-adaptive-channel-design.md`

## 1. 目标

mao 渠道在**异步任务失败**后，用同一渠道、同一上游请求体自动再提交；最多累计 **3 次失败** 才标记真正失败并退款。客户端仍使用同一本地 `task_id` 轮询。

## 2. 范围与非目标

**范围内：**
- 仅 `ChannelTypeMao`（同渠道重试，不换渠道）
- 轮询发现上游 `failed` 时触发
- 客户端进度可见：`retrying n/3`
- 审核类、上游余额不足类：**不重试**，第一次即终态失败

**非目标：**
- 不换其它渠道重试
- 不改同步提交阶段的渠道级 RetryTimes
- 不对其它视频渠道默认开启（其它渠道可不实现可选接口）

## 3. 方案

轮询钩子 + `PrivateData` 持久化上游请求体。

创建成功时保存发往 catertx 的 JSON；轮询失败时由可选接口 `TryResubmitOnFailure` 决定是否重提。其它渠道不实现该接口则行为不变。

## 4. 数据字段

扩展 `model.TaskPrivateData`（JSON，向后兼容）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `request_body` | string / raw JSON | 创建时发给上游的完整 body（已含 `sd-2-0-*` 等） |
| `retry_count` | int | 已发生的异步失败次数（0～3） |
| `max_retries` | int | 固定为 3（可写死常量，字段可选） |

对外 `Task.TaskID` 不变；仅更新 `PrivateData.UpstreamTaskID`。

## 5. 接口形态

因 `service.TaskPollingAdaptor` 需避免循环依赖，重试通过**类型断言**可选能力接入：

```go
type TaskAsyncFailureResubmitter interface {
    // TryResubmitOnFailure：若应重提，更新 task 的 UpstreamTaskID / retry_count / 状态相关字段，
    // 返回 resubmitted=true 与对外 progress（如 "retrying 2/3"）。
    // 返回 resubmitted=false 表示应按终态失败处理（含不可重试原因、次数耗尽、重提失败且已达上限等）。
    TryResubmitOnFailure(ctx context.Context, ch *model.Channel, task *model.Task, failReason string) (resubmitted bool, progress string, err error)
}
```

挂载点：`service/task_polling.go` → `updateVideoSingleTask`，在 `case model.TaskStatusFailure` 分支、执行退款之前。

伪逻辑：

```
if status == FAILURE {
  if r, ok := adaptor.(TaskAsyncFailureResubmitter); ok {
    okResubmit, progress, err := r.TryResubmitOnFailure(...)
    if err == nil && okResubmit {
      // 保持非终态；Progress = progress；不退款；Update 后 return
    }
  }
  // 原有：FAILURE + 100% + 退款
}
```

## 6. 不可重试判定

失败原因字符串（小写）命中任一关键词则**不重试**：

**审核 / 策略：**  
`audit`、`policy`、`违规`、`敏感`、`违禁`、`content_policy`、`moderation`、`nsfw`、`rejected by`、`审核`

**余额 / 计费：**  
`余额不足`、`insufficient balance`、`insufficient_quota`、`insufficient quota`、`out of credit`、`out of credits`、`quota exceeded`、`payment required`、`402`、`credit insufficient`、`no enough quota`

不用过宽的单独词 `billing`，避免误伤普通错误文案。

实现常量集中在 `relay/channel/task/mao/retry.go`（或同类文件），便于单测。

## 7. 状态机与计费

| 事件 | 本地状态 | Progress | 退款 |
|------|----------|----------|------|
| 首次提交成功 | queued / in_progress | 正常 | 否 |
| 可重试失败（失败次数 1 或 2）且重提成功 | 进行中 | `retrying 2/3` 或 `retrying 3/3` | 否 |
| 第 3 次失败 / 审核 / 余额不足 | FAILURE | `100%` | 是 |
| 最终成功 | SUCCESS | `100%` | 否（走现有结算） |

约定：
- `retry_count` = 已发生的异步失败次数；`retry_count >= 3` 不再重提
- 第 1 次失败后重提成功 → progress `retrying 2/3`（表示第 2 次尝试进行中）
- 第 2 次失败后再提 → `retrying 3/3`
- 预扣保持到终态；中间重试不重复扣费
- 重提 HTTP/解析失败也计一次失败；若因此 `retry_count >= 3` 则终态失败

## 8. mao 实现要点

1. **创建路径**：`BuildRequestBody` / 提交成功落库时，将实际上游 body 写入 `PrivateData.RequestBody`（需核对 `controller` / relay task 提交写 Task 的位置，保证能带上 PrivateData）。
2. **TryResubmitOnFailure**：
   - 无 `RequestBody` → 不重试
   - `isNonRetryable(failReason)` → 不重试
   - `retry_count >= 3` → 不重试
   - `retry_count++`，POST `{base}/v1/video/generations`，Bearer 同渠道 Key
   - 解析新 `task_id` → 写 `UpstreamTaskID`；状态改为 queued/in_progress；返回 progress
3. **日志**：记录本地 task_id、旧/新 upstream id、retry_count、failReason（勿打完整密钥）。

## 9. 测试要点

- 审核文案 → 不重试
- 余额不足文案 → 不重试
- 普通 failed + retry_count 0 → 重提，progress `retrying 2/3`，UpstreamTaskID 更新
- retry_count 已为 2 再失败 → 第 3 次失败后不重提（或重提后再失败则终态，与常量语义一致：最多 3 次失败）
- 无 RequestBody → 不重试
- 轮询层：resubmitted 时不调用退款

## 10. 代码落点

| 区域 | 变更 |
|------|------|
| `model/task.go` | `TaskPrivateData` 增字段 |
| `service/task_polling.go` | Failure 分支类型断言 + 短路退款 |
| `relay/channel/task/mao/` | 存 body、retry 判定、重提 HTTP、单测 |
| 任务提交写库路径 | 确保 RequestBody 写入 PrivateData |

## 11. 示例进度语义

```
attempt 1 running → upstream fail
  retry_count=1, resubmit → progress "retrying 2/3"
attempt 2 running → upstream fail
  retry_count=2, resubmit → progress "retrying 3/3"
attempt 3 running → upstream fail
  retry_count=3 → FAILURE + refund
```
