# 现有 new-api Go 后端：Origin Codex MVP 实施计划

共同目标与跨仓阶段以 `origin-contracts/ORIGIN_CODEX_MVP_PLAN.md` 为事实源。本仓负责 P2 数据面集成，并保持 new-api / QuantumNous 项目身份、许可证和上游可合并性。

## 当前可复用能力

- `router/relay-router.go` 已暴露 `POST /v1/responses`。
- `middleware/auth.go`、`middleware/distributor.go` 和 `controller/relay.go` 已提供鉴权、渠道分配、重试和额度生命周期。
- `relay/channel/newapi/adaptor.go` 对 Responses 使用同协议请求；`relay/channel/openai/relay_responses.go` 观察非流式/SSE usage。
- `relay/helper/model_mapped.go` 已完成平台模型名到上游模型名替换。
- 现有用户、Token、quota/billing 和 React 管理前端保留为上游能力，但不是 Origin 事实源或客户前端。

注意：`middleware/auth_origin.go` 的 Origin 指浏览器 Origin/CSRF 边界，不是 Origin AI Key；现有 quota reservation 也不是 Platform reservation。新实现必须使用明确命名，不能复用两个同名但不同语义的概念。

## 交付顺序

### P0：Origin 模式边界

- 增加显式、默认关闭的 Origin 集成配置；不改变普通 new-api 部署的默认行为。
- 固定 BeeNex 为内置 **New API** 渠道和 OpenAI Responses 同协议路径。
- 在契约测试证明模型映射和未知字段保留前，不启用全局 body pass-through。

### P2.1：Origin Key + admission bridge

- 在 Token 鉴权入口识别完整 `sk-oa-...` Key，绝不按 `-` 分段或写日志。
- 每个请求在联系 BeeNex 前携带本地 catalog version、input token estimate 和输出上限等安全风险事实调用 Platform admission；不得发送 prompt/tool arguments。
- admission 返回 tenant/project/key、reservation 和获批 catalog version/Route 引用；模型映射只从对应版本的本地 snapshot 读取。
- 超时、签名/响应校验失败、Key/余额/限额拒绝时失败关闭，不进入渠道请求。
- retry 必须复用同一 `request_id` 与 reservation，不重复占用风险额度。

### P2.2：Catalog 快照与路由

- 消费版本化 catalog snapshot，原子替换本地只读视图。
- distributor 只选择获批渠道；model mapping 只替换平台模型名到上游模型名。
- admission 返回 catalog stale 时刷新一次并用同一 `request_id` 重试；快照过期、版本回退、未知模型或无 BeeNex Route 时拒绝请求，不回退到其他协议渠道。

### P2.3：Request attempt 与 usage outbox

- 上游前持久化 request attempt；记录 reservation、catalog version、状态和安全关联 ID。
- 完成/失败/断连时在同一数据库事务更新 attempt 并写 usage outbox。
- publisher 支持租约、批量、重试、幂等发布和 DEAD/告警；Kafka 宕机不能丢 usage。
- usage 缺失或上游结果不明标记 reconciliation，不能静默成功或自动释放 reservation。
- 数据表、迁移、锁和 claim 查询必须同时兼容 SQLite、MySQL 与 PostgreSQL。

### P2.4：Responses/SSE 安全收口

- 保持 Responses 同协议 relay；禁止 Responses-over-Chat、BeeNex 专用 DTO 和 SSE JSON 重写。
- 只在首个事件前进行安全重试；首个事件后禁止换渠道重放。
- 客户断连取消上游，并根据已观察 usage 决定结算或 reconciliation。
- 移除 `relay/responses_handler.go` 的请求正文 debug 日志，保证 prompt/tool arguments 不落盘。

### P4：契约与跨仓验收

- 非流式、SSE、reasoning、function tools、usage、unknown fields、错误包络和 request ID 契约测试。
- admission 拒绝必须证明 BeeNex 未收到请求。
- outbox 重启/Kafka 恢复不丢 usage、不重复结算。
- 使用 Mock BeeNex 完成 Origin Key → Responses → usage 全链路；真实 BeeNex 仍需逐次授权。

## 测试要求

- `middleware`：完整 Key、格式错误、停用/过期/跨项目、Platform 超时和敏感信息不落日志。
- `controller/relay`：admission 一次调用、retry 复用 reservation、首事件前后重试边界。
- `relay/channel/newapi`：请求不转换协议、模型只映射一次、非流与 SSE 原语义返回。
- outbox：事务回滚、并发 claim、进程崩溃、重复发布、Kafka 宕机和 DEAD 恢复。
- E2E：余额不足不联系 BeeNex；断连有/无 usage；同一 usage 重放十次只结算一次。

## NOT in scope

- 新建 Origin 专用网关服务或复制 relay/channel 体系。
- 把 React 管理前端作为 Origin 客户前端。
- 让 new-api 用户、Token、quota、倍率、充值或余额成为 Origin 财务事实。
- 为 BeeNex 构建 Responses ↔ Chat/Claude/Gemini 转换链。

## 完成条件

- Origin 模式默认关闭且不破坏普通 new-api 行为。
- 所有 BeeNex 请求都有成功 admission；拒绝请求不接触上游。
- request attempt/outbox 可恢复，usage 缺失可观测且进入 reconciliation。
- Go 全量测试、竞态相关测试、`git diff --check` 和 Mock 跨仓 E2E 通过。
