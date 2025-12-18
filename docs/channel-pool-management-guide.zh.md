# 渠道池治理实施指南：便宜优先 + 官方兜底

本指南提供完整的渠道池配置方案，实现"便宜号源优先、官方账号兜底"的高可用架构。

## 目录

- [架构概述](#架构概述)
- [第一步：建立三层渠道池](#第一步建立三层渠道池)
- [第二步：配置 Multi-Key 模式](#第二步配置-multi-key-模式)
- [第三步：设置重试次数](#第三步设置重试次数)
- [第四步：配置自动禁用](#第四步配置自动禁用)
- [第五步：用户分组隔离](#第五步用户分组隔离)
- [第六步：超时设置](#第六步超时设置)
- [健康检查脚本](#健康检查脚本)
- [常见问题](#常见问题)

---

## 架构概述

```
用户请求
    ↓
┌─────────────────────────────────┐
│  第一层: 便宜池 (Priority=100)   │  ← 主力输出，成本极低
│  - 号商账号A (Multi-Key)         │
│  - 号商账号B (Multi-Key)         │
│  - 体验号账号                    │
└─────────────────────────────────┘
    ↓ 失败/被禁用
┌─────────────────────────────────┐
│  第二层: 中转池 (Priority=50)    │  ← 缓冲层（可选）
│  - 第三方中转A                   │
│  - 第三方中转B                   │
└─────────────────────────────────┘
    ↓ 失败/被禁用
┌─────────────────────────────────┐
│  第三层: 官方池 (Priority=0)     │  ← 最后堡垒，100%可用
│  - 官方账号                      │
└─────────────────────────────────┘
    ↓
返回结果
```

**核心原理**：系统根据 `Priority` 字段选择渠道，优先使用高优先级渠道。当高优先级渠道失败时，自动重试到低优先级渠道。

---

## 第一步：建立三层渠道池

### 1.1 便宜池配置（Priority=100）

**适用场景**：号商账号、体验账号、促销账号

| 配置项   | 推荐值             | 说明                                 |
| -------- | ------------------ | ------------------------------------ |
| Priority | `100`              | 最高优先级，优先被选中               |
| AutoBan  | `开启`             | 遇到错误自动禁用                     |
| Weight   | `5-20`             | 根据账号稳定性分配，稳定的给更高权重 |
| Group    | `default,vip,free` | 所有用户组都可访问                   |

**创建渠道示例**：

```bash
# 通过 API 创建便宜池渠道
curl -X POST "http://localhost:3000/api/channel" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "便宜池-OpenAI-号商A",
    "type": 1,
    "key": "sk-xxx1\nsk-xxx2\nsk-xxx3",
    "base_url": "",
    "models": "gpt-4o,gpt-4o-mini,gpt-4-turbo",
    "group": "default,vip,free",
    "priority": 100,
    "weight": 10,
    "auto_ban": 1,
    "tag": "merchant-a-batch1",
    "channel_info": {
      "is_multi_key": true,
      "multi_key_mode": 1
    }
  }'
```

### 1.2 中转池配置（Priority=50，可选）

**适用场景**：第三方中转服务、备用渠道

| 配置项   | 推荐值        | 说明                                    |
| -------- | ------------- | --------------------------------------- |
| Priority | `50`          | 中间优先级                              |
| AutoBan  | `开启`        | 建议开启                                |
| Weight   | `10`          | 均衡分配                                |
| Group    | `default,vip` | 普通用户和 VIP 可访问，免费用户不可访问 |

### 1.3 官方池配置（Priority=0）

**适用场景**：官方 API 账号，作为最终兜底

| 配置项   | 推荐值 | 说明                                              |
| -------- | ------ | ------------------------------------------------- |
| Priority | `0`    | 最低优先级，仅作为兜底                            |
| AutoBan  | `开启` | 建议开启，但需要更谨慎的恢复策略                  |
| Weight   | `10`   | 默认值                                            |
| Group    | `vip`  | **只有 VIP 用户可访问**，防止免费用户消耗官方额度 |

```bash
# 创建官方池渠道
curl -X POST "http://localhost:3000/api/channel" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "官方池-OpenAI",
    "type": 1,
    "key": "sk-official-xxx",
    "base_url": "",
    "models": "gpt-4o,gpt-4o-mini,gpt-4-turbo",
    "group": "vip",
    "priority": 0,
    "weight": 10,
    "auto_ban": 1,
    "tag": "official-openai"
  }'
```

---

## 第二步：配置 Multi-Key 模式

**核心价值**：将大量号商账号合并到少量渠道，避免"运维地狱"。

### 2.1 Multi-Key 模式说明

| 模式    | 值  | 说明             | 适用场景                      |
| ------- | --- | ---------------- | ----------------------------- |
| Random  | `1` | 随机选择可用 Key | **推荐**，更抗"坏 key 污染"   |
| Polling | `2` | 轮询选择 Key     | 更均匀，但坏 key 会被频繁命中 |

### 2.2 配置方式

**通过 UI 配置**：

1. 编辑渠道 → 高级设置
2. 开启「多密钥模式」
3. 选择「随机」或「轮询」
4. 在密钥框中，每行一个 Key

**通过 API 配置**：

```json
{
  "key": "sk-key1\nsk-key2\nsk-key3",
  "channel_info": {
    "is_multi_key": true,
    "multi_key_mode": 1
  }
}
```

### 2.3 Key 级别禁用

当某个 Key 失效时，系统会自动禁用该 Key（而非整个渠道），直到所有 Key 都被禁用才会禁用整个渠道。

查看 Key 状态：

```bash
curl -X GET "http://localhost:3000/api/channel/123" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 响应中的 channel_info.multi_key_status_list 显示每个 key 的状态
```

---

## 第三步：设置重试次数

**路径**：系统设置 → 运营设置 → 通用设置 → 失败重试次数

**推荐值**：`1` 或 `2`

**原因**：

- 重试次数过多会让用户等待太久
- 1-2 次重试足够从 Priority=100 降级到 Priority=0
- 每次重试会尝试下一个优先级的渠道集合

**重试流程示例**（RetryTimes=2）：

```
请求 → 便宜池(P=100) → 失败
  ↓ 第1次重试
便宜池内其他渠道(P=100) → 失败
  ↓ 第2次重试
中转池(P=50) → 失败
  ↓ 第3次重试（超过限制，不再重试）
返回错误
```

---

## 第四步：配置自动禁用

### 4.1 启用自动禁用

**路径**：系统设置 → 运营设置 → 通用设置 → 自动禁用失败通道

确保此选项已开启。

### 4.2 添加自动禁用关键词

**路径**：系统设置 → 运营设置 → 通用设置 → 自动禁用关键词

添加号商账号特有的错误关键词：

```
Your credit balance is too low
balance not enough
access denied
rate limit exceeded
account suspended
trial expired
free tier exhausted
quota exceeded
plan limit reached
subscription inactive
api key disabled
invalid subscription
payment required
credits exhausted
```

**注意**：关键词会被转为小写匹配。建议观察日志后持续补充。

完整的推荐关键词列表见 [recommended_autoban_keywords.txt](recommended_autoban_keywords.txt)

### 4.3 系统内置禁用条件

系统已自动处理以下错误：

- HTTP 401 (Unauthorized)
- HTTP 403 (Forbidden，针对 Gemini)
- `invalid_api_key`
- `account_deactivated`
- `billing_not_active`
- `insufficient_quota`
- `authentication_error`
- `permission_error`

---

## 第五步：用户分组隔离

### 5.1 分组策略

| 用户类型 | Group     | 可访问的渠道池           | 说明                 |
| -------- | --------- | ------------------------ | -------------------- |
| VIP 用户 | `vip`     | 便宜池 + 中转池 + 官方池 | 高可用，可降级到官方 |
| 普通用户 | `default` | 便宜池 + 中转池          | 便宜池全挂则失败     |
| 免费用户 | `free`    | 仅便宜池                 | 成本最低             |

### 5.2 渠道分组配置

```
便宜池渠道: Group = "default,vip,free"
中转池渠道: Group = "default,vip"
官方池渠道: Group = "vip"
```

### 5.3 用户分组设置

**通过 UI**：用户管理 → 编辑用户 → 分组

**通过 API**：

```bash
curl -X PUT "http://localhost:3000/api/user" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123,
    "group": "vip"
  }'
```

---

## 第六步：超时设置

### 6.1 便宜池超时

便宜号有时会无响应（hang 住），建议设置较短的超时时间：

**推荐值**：`15` 秒

**配置方式**：

- 渠道编辑 → 其他设置 → 超时时间
- 或在渠道的 `setting` 字段中设置

### 6.2 官方池超时

官方 API 通常更稳定，可以使用默认超时：

**推荐值**：`60` 秒（默认）

### 6.3 效果

快速失败 → 快速重试 → 减少用户感知延迟

---

## 健康检查工具

详见 [cmd/README.md](../cmd/README.md)

### 功能

1. **定时探测**：对便宜池渠道发起轻量级测试请求
2. **自动禁用**：检测到 Fatal 错误时禁用渠道/Key
3. **冷却恢复**：被禁用的渠道在冷却期后自动重试启用

### 编译

```bash
# 使用 Makefile
make tools

# 或手动编译
go build -o bin/channel-health-check ./cmd/channel-health-check
go build -o bin/channel-batch-manager ./cmd/channel-batch-manager
```

### 使用方式

```bash
# 单次运行，检查 priority >= 100 的渠道
./bin/channel-health-check -priority 100

# 循环模式，每 5 分钟检查一次
./bin/channel-health-check -priority 100 -interval 300

# 详细输出
./bin/channel-health-check -priority 100 -v
```

### Cron 配置

```bash
# 每 5 分钟运行一次健康检查
*/5 * * * * cd /path/to/new-api && ./bin/channel-health-check -priority 100 >> /var/log/channel_health_check.log 2>&1
```

---

## 常见问题

### Q1: 如何判断渠道是便宜池还是官方池？

通过 `Priority` 字段判断：

- `Priority >= 100`：便宜池
- `Priority = 50`：中转池
- `Priority = 0`：官方池

### Q2: 免费用户请求失败了怎么办？

这是预期行为。免费用户只能访问便宜池，便宜池全挂时请求会失败。
如果想让免费用户也能降级，需要将中转池的 Group 改为 `default,vip,free`。

### Q3: 某个号商的账号全部失效了怎么办？

1. 使用 Tag 批量禁用该号商的所有渠道
2. 联系号商获取新账号
3. 将新账号添加到新的渠道或更新现有渠道的 Key

```bash
# 批量禁用某个 Tag 的渠道
curl -X POST "http://localhost:3000/api/channel/tag/disabled" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag": "merchant-a-batch1"}'
```

### Q4: 如何监控官方兜底的触发频率？

查看日志统计，筛选 `Priority=0` 的渠道使用记录：

```bash
curl -X GET "http://localhost:3000/api/log?channel_id=官方池渠道ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Q5: Multi-Key 模式下，单个 Key 被禁用后会自动恢复吗？

需要配合健康检查脚本实现自动恢复。系统本身会在请求成功时自动启用被禁用的渠道/Key（如果开启了 `AutomaticEnableChannelEnabled`）。

---

## 配置检查清单

- [ ] 按平台建立三层渠道池（Priority: 100/50/0）
- [ ] 便宜池启用 Multi-Key 模式
- [ ] 设置 RetryTimes = 1~2
- [ ] 开启自动禁用，添加号商特有错误关键词
- [ ] 配置用户分组，限制免费用户访问官方池
- [ ] 便宜池超时设为 15 秒
- [ ] 部署健康检查脚本
- [ ] 按来源/批次为渠道打 Tag
