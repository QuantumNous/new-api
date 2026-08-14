# Origin AI Codex MVP 与现有 new-api Go 后端集成

> 本文只说明 Origin 的部署与集成边界，不重命名、删除或替换 new-api / QuantumNous 的项目身份、署名、许可证或上游文档。

## 术语与目标链路

本文中的“New API 数据面”专指当前工作区源码目录 `/Users/wangshuohao/myhome/project/origin-main/new-api` 内的现有 new-api Go 后端（Origin 受控版本）。它是客户请求链路中的模型网关层，不是 `origin-platform`，不是旧的 `origin-ai-gateway`，也不是另行新建的 `origin-newapi-gateway` 服务。

new-api 的服务主体是 Go（Gin 路由/中间件 + relay/channel 体系），管理前端是 React。Origin Codex MVP 复用并补丁的是下述 Go 后端链路，不复用管理前端承载 Origin 客户业务。

Codex MVP 的目标生产链路只有：

```text
Codex / OpenAI SDK
  → 现有 new-api Go 后端（鉴权、模型映射、转发、SSE、usage）
  → BeeNex
```

Origin 对 new-api 的使用方式是在现有项目上维护受控版本：保留原项目身份、架构和许可证，只增加 Origin 必需的集成补丁。`origin-ai-gateway` 和 CLIProxyAPI 都不是该链路的前置或后置节点。

## MVP 实际复用的现有代码

| 职责 | 现有代码 |
|---|---|
| 暴露 `POST /v1/responses` | `router/relay-router.go` |
| 客户 Token 鉴权；后续接入 Origin Key 的补丁点 | `middleware/auth.go` |
| 选择渠道并校验模型权限 | `middleware/distributor.go` |
| 请求入口、重试和额度流程 | `controller/relay.go` |
| 使用内置 **New API** 同协议渠道请求 BeeNex | `relay/channel/newapi/adaptor.go` |
| 观察 Responses/usage，返回非流式响应或 SSE | `relay/channel/openai/relay_responses.go` |
| 只把平台模型名替换为上游模型名 | `relay/helper/model_mapped.go` |

BeeNex 渠道使用内置 **New API** 渠道类型。其 Base URL 是不重复附加 `/v1` 的 BeeNex API 根地址，API Key 只保存在服务端，模型别名来自数据配置而不是硬编码的 Go 常量。

## 同协议直转约束

BeeNex 已原生支持 OpenAI Responses。Origin 受控版本不得新增 BeeNex 专用 Responses Adaptor，也不得把 Responses 转换为 Chat Completions。

因此，当前实现不需要多重组装模型格式：客户入口是 OpenAI Responses，BeeNex 上游也是 OpenAI Responses，中间只经过一次同协议 relay。现有 typed request 路径可能为了校验、模型名替换和发送而解析/序列化请求；非流式响应会读取原始正文观察 usage，SSE 会扫描 `data:` 事件观察 usage/tools。这些都是同协议内处理，不是 Responses → Chat → Responses 或多个 Adaptor 串联。

允许的处理：

- 鉴权 Origin Key，并绑定 tenant/project/key 身份；
- 在上游调用前取得 Origin admission/reservation；
- 只把公开的平台模型名替换为获批的上游模型名；
- 移除客户提供的供应商凭据，注入服务端 BeeNex Key；
- 观察状态、usage 和安全的上游关联元数据；
- 客户断开连接时取消上游工作。

禁止的处理：

- Responses → Chat Completions → Responses 转换；
- 为已有兼容操作增加 BeeNex 专用请求/响应 DTO；
- 重建非流式 Responses JSON；
- 改写 SSE 事件 JSON 或 tool arguments；
- 记录 Authorization、API Key、prompt、tool arguments 或响应正文；
- 经由 `origin-ai-gateway` 或 CLIProxyAPI 转发。

现有非流式 relay 在观察 usage 后写回原始上游响应正文；流式 relay 扫描 `data:` 事件以观察 usage/tools，并写回原始事件数据。因此这是语义事件透传，不是原始 TCP 字节复制。

在契约测试证明模型别名替换仍然有效前，MVP 不启用全局 `PassThroughBodyEnabled`。优先使用现有 typed no-op 路径。如果未来 Responses 字段尚未被当前 DTO 表达，应增加保留 JSON、只修改模型名的最小补丁，而不是实现完整 Provider Adaptor。

## Origin 的四项最小补丁

1. **Origin Key bridge**：接收完整的 `sk-oa-...` Key，校验状态、有效期和项目作用域，绝不能在 `-` 处分段截断。
2. **Admission/reservation**：联系 BeeNex 前先调用 Origin Platform；无法确认钱包、限额或风险敞口时失败关闭。
3. **Usage outbox**：异步发布到 Kafka/Redpanda 前先持久化标准 usage 事实；普通 new-api 日志不是 Origin 账单。
4. **Catalog sync**：接收 Origin Platform 审批的平台模型、能力和映射；不得硬编码单一模型 ID。

这四项补丁直接落在现有 new-api Go 后端的通用集成点中，不复制 Gin 路由、中间件、relay/channel 体系、Responses/SSE 处理或管理前端，也不创建新的 Origin 专用网关服务。

Origin Platform 仍是 Tenant、Project、Origin Key、PlatformModel 商品状态、PriceBook、Wallet、Charge 和 Ledger 的唯一权威。现有 new-api 的用户、Token、额度、计费和控制台仍是上游项目能力，但不是 Origin 客户或财务事实源。

## MVP 实施顺序

1. 为非流式 Responses、SSE、function tools、usage、未知字段保留和禁止 Responses-over-Chat 建立契约测试。
2. 先增加完整 `sk-oa-...` Key 解析的失败测试，再实现最小 Origin 鉴权桥接。
3. 实现版本化 reservation 契约和 Platform 逻辑。
4. 实现持久化 usage outbox 和 Platform 幂等结算。
5. 执行本地 Mock BeeNex E2E：创建 Origin Key → Responses → usage → Charge/Ledger → 余额/调用记录。
6. 真实 BeeNex 冒烟仅在另行明确授权模型、次数和预算后执行。

## 验收矩阵

- 除出站请求中获批的平台模型名到上游模型名映射外，非流式请求与响应结构不做协议转换；
- SSE 事件类型、顺序、JSON、tool arguments 和 usage 保持兼容；
- 有效、停用、过期和跨项目 Origin Key 均按 Origin 契约处理；
- 余额不足或项目限额不允许时不得联系 BeeNex；
- 只能在首个事件前安全重试；客户断开连接会取消上游请求；
- usage 缺失进入待对账状态，绝不能静默记为零成本成功；
- 同一 usage 重放十次只产生一笔 Origin Charge；
- outbox/Kafka 恢复既不丢 usage，也不重复扣费；
- 生产拓扑只有一个 AI 业务代理：现有 new-api Go 后端。

## 许可证与项目身份

现有 new-api Go 后端的 Origin 受控版本必须保留所有 new-api 和 QuantumNous 署名、元数据与许可证要求。Origin 补丁应保持小而可审计，以便持续合并上游更新，无需重建已有 relay 行为。
