# 上游 API Key 暴露风险设计与验证记录

## 背景

渠道密钥查看接口已经被设计为高权限操作：

```text
POST /api/channel/:id/key
```

该接口需要 root 权限、安全验证、关键频率限制和禁用缓存。普通 admin 可以管理渠道，但不应绕过该接口直接获得或导出上游 API key。

本记录用于固化一次已验证的安全风险：普通 admin 可以通过修改渠道认证目的地，让已有上游 key 被发送到自己控制的服务端。

## 结论

风险已在本地 PoC 中复现。

复现链路：

```text
1. 创建 OpenAI 兼容渠道，保存上游 key。
2. 以 admin 权限更新该渠道，只修改 base_url，不传 key。
3. 后端更新后旧 key 仍保留。
4. 执行渠道测试。
5. 渠道测试向新的 base_url 发起请求，并携带旧 key。
```

PoC 中假上游实际收到：

```text
Authorization: Bearer sk-upstream-secret-poc
```

该 PoC 测试文件只用于验证，已删除，不作为长期测试留存。正式修复已新增反向回归测试：普通 admin 修改敏感目的地会失败，root 通过安全验证后才允许。

## 修复前缺口

- `PUT /api/channel/` 只有 admin 权限，允许更新 `base_url`、`type`、`header_override`、`param_override` 等会影响上游认证目的地或认证载荷的字段。
- 更新渠道时，空 `key` 不会覆盖旧 key；这对普通编辑是方便行为，但在修改 `base_url` 时会变成“沿用旧 key 到新地址”。
- 渠道测试会使用渠道当前配置发起真实上游请求，因此可以作为密钥外发触发器。
- 部分错误日志、Debug 日志和视频代理路径可能记录带 key 的 URL 或原始错误。
- 多 key 管理接口会返回 key 前缀作为 `key_preview`，虽不是完整 key，但仍属于密钥材料暴露。

## 影响范围

高风险场景：

- 非 root admin 可以编辑渠道。
- 该 admin 不应直接查看上游 API key。
- 渠道类型使用 header 或 URL query 传递上游 key。
- admin 能触发渠道测试，或能等待正常业务请求命中该渠道。

受影响的典型路径：

- OpenAI 兼容渠道：上游 key 通过 `Authorization: Bearer <key>` 发送。
- Gemini 渠道：上游 key 通过 `x-goog-api-key` 发送。
- Vertex API key 模式：上游 key 可能被拼入 URL query。
- 自定义 header override：`{api_key}` 占位符会被替换为真实上游 key。

## 根因

权限边界只保护了“查看 key”动作，没有保护“改变 key 的接收方”动作。

当前行为组合如下：

```text
admin 可修改 base_url
+
不传 key 时旧 key 保留
+
渠道测试会真实调用上游
=
admin 可把旧 key 发送到自控服务端
```

因此，敏感字段的权限边界应按“是否会导致 key 外发目的地或认证内容变化”来定义，而不仅是“是否直接返回 key”。

## 锁定决策

- 将渠道敏感更新提升为 root-only，并要求安全验证。
- 敏感更新包括但不限于：
  - `key`
  - `type`
  - `base_url`
  - `header_override`
  - `param_override`
  - 代理配置
  - 会影响认证、上游路径或上游请求头的渠道 setting
- 普通 admin 仍可编辑非敏感字段：
  - `name`
  - `models`
  - `group`
  - `weight`
  - `priority`
  - `status`
  - `auto_ban`
  - `test_model`
  - `remark`
  - `tag`
- 普通 admin 不传 `key` 时可以继续做非敏感更新。
- 普通 admin 不传 `key` 且修改敏感字段时必须拒绝，不允许隐式沿用旧 key。
- root 通过安全验证后，可以修改敏感字段，也可以选择沿用旧 key。

## 非目标

- 不移除普通 admin 的渠道日常管理能力。
- 不改变 root 查看渠道 key 的现有安全验证流程。
- 不改变渠道选路、计费、模型倍率或上游适配逻辑。
- 不在数据库层加密迁移渠道 key；这是更大的密钥治理任务，应单独设计。
- 不把 PoC 攻击代码作为长期测试保留；长期测试应验证拒绝行为和脱敏行为。

## API 影响

已采用最小变更：

```text
PUT /api/channel/
```

当请求包含敏感字段变更，且当前用户不是 root 或未通过安全验证时，返回 403。非 root 返回：

```json
{
  "success": false,
  "message": "需要 root 权限才能修改渠道敏感配置",
  "code": "CHANNEL_SENSITIVE_UPDATE_REQUIRES_ROOT"
}
```

root 未通过安全验证返回：

```json
{
  "success": false,
  "message": "需要 root 权限和安全验证才能修改渠道敏感配置",
  "code": "CHANNEL_SENSITIVE_UPDATE_REQUIRES_VERIFICATION"
}
```

可选增强：

```text
POST /api/channel/:id/sensitive
```

单独提供 root-only 的敏感配置更新接口，让普通更新接口只接受非敏感字段。若选择该方案，需要同步前端编辑表单的提交路径。

## 数据与状态变化

- 不需要新增表。
- 不需要迁移历史渠道。
- 可在业务日志中记录敏感配置更新事件，但日志不得包含真实 key、Authorization、URL query key、完整 header override 值或完整 param override 值。

## 实现状态

- `PUT /api/channel/` 会比较请求与原渠道，敏感字段变化时要求 root + 安全验证。
- `PUT /api/channel/tag` 修改 `header_override` 或 `param_override` 时同样要求 root + 安全验证。
- 前端编辑渠道时会在后端返回敏感更新验证码后弹出安全验证，再重试原更新请求。
- relay Debug URL、WebSocket dial error、Gemini 视频代理 URL、Zhipu 无效 key 日志、自动禁用 reason 均已接入脱敏。
- 多 key 管理继续返回 `key_preview` 字段，但值改为不可逆 `sha256:<12 hex>` fingerprint。

## 日志与脱敏要求

修复时同步处理以下日志风险：

- relay 请求失败日志不得输出带 key 的完整 URL。
- `DebugEnabled` 下不得打印包含 `key=` 的完整 URL。
- 自动禁用渠道的 reason 需要脱敏后再写系统日志和通知。
- Gemini 视频代理不得把带 `key=` 的 URL 写日志或返回给用户。
- `MaskSensitiveInfo` 至少覆盖：
  - URL query 参数值；
  - `Authorization: Bearer ...`；
  - `x-api-key`、`x-goog-api-key`、`api-key`；
  - `sk-...` 常见 key 形态；
  - JWT 形态的长 token。

## 验收标准

- 普通 admin 修改渠道非敏感字段成功。
- 普通 admin 修改 `base_url` 被拒绝，旧 key 不会被发送到新地址。
- 普通 admin 修改 `header_override` 中包含 `{api_key}` 的配置被拒绝。
- root 通过安全验证后可以修改 `base_url`。
- 渠道测试不会成为普通 admin 外发旧 key 的工具。
- Vertex API key 模式、Gemini 视频代理、上游请求失败日志均不写出真实 key。
- 多 key 管理不再返回真实 key 前缀，改为不可逆 fingerprint 或仅返回索引和状态。

## 回归测试计划

新增测试应覆盖：

```text
1. Admin 更新 name/models/group 等非敏感字段成功。
2. Admin 更新 base_url 失败。
3. Admin 更新 type 失败。
4. Admin 更新 header_override 且值包含 {api_key} 失败。
5. Root + 安全验证更新 base_url 成功。
6. 更新失败后执行渠道测试，假上游收不到旧 key。
7. 错误日志脱敏：包含 key=、Bearer、x-api-key 的错误字符串输出后不含原始 secret。
```

## 临时缓解建议

在代码修复前，建议运营侧采取以下措施：

- 不给不可信账号 admin 权限。
- 禁止普通 admin 修改渠道 `base_url`、`header_override`、`param_override`。
- 临时关闭或限制渠道测试入口。
- 对系统日志中可能出现的上游 key 做一次搜索和轮换。
- 对关键上游 key 配置 provider 侧 IP 白名单或额度限制。
