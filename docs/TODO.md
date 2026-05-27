# 待办（Project TODO）

记录下游分支（SolveaCX/new-api）需要后续完成的功能改动 / 修复。
按优先级排序，每条注明背景、改动范围与验证方式。

---

## [TODO] ChannelAffinity 上游故障时自动 fallback（保 cache + 防 5xx 透传）

**优先级**：中（生产已有 workaround，副作用可控）  
**关联**：`SolveaCX/new-api` 当前 `claude cli trace` 亲和性规则、PR #18 (BlockRun)

### 背景

`ChannelAffinityRule.SkipRetryOnFailure` 当前是一个一刀切的 bool：
- 开启 → 命中规则的请求**任何错误都不跨渠道重试**（连 5xx 上游故障都直接透传给客户端）
- 关闭 → 命中规则的请求**任何错误都触发重试**，但 fallback 成功后 affinity cache 会改写到 fallback 渠道，TTL 内（已调成 180s）所有同 key 请求继续粘 fallback 渠道，造成 Anthropic prompt cache 在原渠道与 fallback 渠道间反复 miss

理想行为：**软错误（4xx 参数错/认证错/限流）按 SkipRetryOnFailure 决定，硬错误（5xx 上游真挂）始终允许 fallback，且 fallback 成功不改写 affinity cache（让原渠道恢复后立即回归）**。

线上历史故障：2026-05-19 14:19-14:21 期间 flatkey 上游（router.flatkey.ai）的 NAS / Mac mini Cloudflare Tunnel 节点抽风约 2 分钟，因为 `SkipRetryOnFailure=true` 导致 8 次 502 直接透传给 Claude Code 客户端，未尝试 openrouter-fallback / BlockRun 渠道。

### 设计

在 `ChannelAffinityRule` 加新字段，向后兼容（默认 false → 现状行为不变）：

```go
// setting/operation_setting/channel_affinity_setting.go
type ChannelAffinityRule struct {
    ...
    SkipRetryOnFailure     bool   // 已存在 — 控制软错误是否跳过 retry
    RetryOnUpstreamFailure bool   // 新增 — true 时即使 SkipRetryOnFailure=true,
                                  //         遇到 5xx (除 504/524) 仍允许 fallback
}
```

在 `controller/relay.go::shouldRetry` 改判定顺序：

```go
if service.ShouldSkipRetryAfterChannelAffinityFailure(c) {
    if openaiErr.StatusCode >= 500 && openaiErr.StatusCode <= 599 &&
       openaiErr.StatusCode != 504 && openaiErr.StatusCode != 524 &&
       service.ChannelAffinityAllowsRetryOnUpstream(c) {
        // 5xx 上游硬错误,即便 SkipRetry=true 也放行 retry
    } else {
        return false
    }
}
```

在 `service/channel_affinity.go::MarkChannelAffinityUsed` 加判定：如果当前请求是 fallback 上来的（即非首次尝试），**不更新 affinity cache**，让原渠道下次仍是首选：

```go
func MarkChannelAffinityUsed(c *gin.Context, selectedGroup string, channelID int) {
    ...
    // fallback 成功的请求不写 affinity cache,让原渠道恢复后立即回归
    if isFallbackAttempt(c) {
        return
    }
    ...
}
```

需要一个判断"是否是 fallback 尝试"的辅助方法 — 可以读 retryParam.GetRetry() > 0 或 gin context 里塞个 flag。

### 改动范围（预估）

| 文件 | 改动 |
|---|---|
| `setting/operation_setting/channel_affinity_setting.go` | 加 `RetryOnUpstreamFailure` 字段 + JSON tag |
| `service/channel_affinity.go` | 加 `ChannelAffinityAllowsRetryOnUpstream(c)` 辅助；`MarkChannelAffinityUsed` 加 fallback skip 逻辑 |
| `controller/relay.go::shouldRetry` | 改判定顺序，5xx 时绕过 SkipRetry |
| `controller/relay.go::relayHelper`（或附近）| 设置 ginContext 的 "is_fallback_attempt" flag |
| 前端 affinity 规则编辑 UI | 加 "Retry on upstream failure" toggle |
| 单测 | `shouldRetry` 在 (skip=true, 5xx, RetryOnUpstreamFailure=true) 组合下的行为 |
| docs | `docs/channel/` 或独立文档说明新字段 |

预估工作量：**1.5 - 2 小时**（含测试 + 前端）

### 验证方式

1. 单测：构造 5 个组合表（skip×retry_on_upstream×status_code），断言 `shouldRetry` 返回符合预期
2. 本机端到端：复用之前本地 newapi 启动方式，配两个 BlockRun / flatkey 渠道，把其中一个 base URL 故意改错让它必 5xx，调一次 Claude API，验证：
   - 第一次请求触发 5xx
   - 自动 fallback 到第二个渠道返回 200
   - **再发一次**同 user_id 请求，验证仍优先去原（错的）渠道（说明 affinity cache 没被改写）
3. 生产灰度：开启该 toggle 后，监控 1 天内 502 透传次数应降到 0，affinity cache 命中率应基本不变

### 当前生产 workaround（直到本 TODO 完成）

- 已关闭 `claude cli trace` 规则的「失败后不重试」开关
- 已将 TTL 从默认 3600s 改为 180s（让 fallback 切走后 3 分钟内自动回归原渠道）
- 副作用：每次 fallback 会多花一次 Anthropic prompt cache_creation 费用，但故障期内可用性优先

---
