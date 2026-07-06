# Image-Aware Model Routing（图片感知模型路由）

## 功能概述

允许你配置一个**虚拟入口模型名**（如 `auto-coder`），客户端统一向这个名字发请求，网关自动根据当前轮请求内容决定路由目标：

- 最后一条 user 消息**包含图片** → 路由到配置好的**视觉模型**（如 `gpt-4o`）
- 最后一条 user 消息**不含图片** → 路由到配置好的**编程模型**（如 `claude-sonnet-4`）

整个过程对客户端透明，客户端只需发同一个模型名，无需感知切换。

## 配置方式

在管理后台进入：**运维设置 → Image-Aware Model Routing**

在 JSON textarea 中填入路由规则，格式如下：

```json
{
  "auto-coder": {
    "vision_model": "gpt-4o",
    "coding_model": "claude-sonnet-4"
  }
}
```

- **key**（`auto-coder`）：客户端请求时发送的模型名，即虚拟入口名，可自定义
- **`vision_model`**：检测到图片时路由到的真实模型名，需在该用户 group 下有对应渠道
- **`coding_model`**：无图片时路由到的真实模型名，需在该用户 group 下有对应渠道

保存后立即生效，无需重启。

**关闭功能**：将内容改为 `{}` 保存即可。

## 多入口示例

可同时配置多个虚拟模型名，互不干扰：

```json
{
  "auto-coder": {
    "vision_model": "gpt-4o",
    "coding_model": "claude-sonnet-4"
  },
  "auto-writer": {
    "vision_model": "gpt-4o",
    "coding_model": "gpt-4-turbo"
  }
}
```

## 使用方式（客户端）

以 OpenAI 兼容 API 为例，将 `model` 字段设为配置好的入口名即可：

```bash
# 发送带图片的请求（会路由到 vision_model）
curl https://your-newapi-host/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto-coder",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "这张截图里的代码有什么问题？"},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
        ]
      }
    ]
  }'

# 发送纯文本请求（会路由到 coding_model）
curl https://your-newapi-host/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto-coder",
    "messages": [
      {"role": "user", "content": "用 Python 实现一个二分查找"}
    ]
  }'
```

在 IDE 插件（Cursor、Cline、Continue 等）中，将模型名设置为 `auto-coder` 即可。

## 多轮对话行为

网关只检测**当前请求最后一条 role=user 的消息**，历史消息不影响路由决策：

| 轮次 | 最后一条 user 消息 | 路由目标 |
|------|-------------------|---------|
| 第 1 轮 | 含图片（截图分析） | `vision_model` |
| 第 2 轮 | 纯文本（根据分析写代码） | `coding_model` |
| 第 3 轮 | 纯文本（优化代码） | `coding_model` |
| 第 4 轮 | 含新图片（另一张截图） | `vision_model` |

第 2 轮的 coding model 能看到第 1 轮 vision model 的输出，因为客户端会把完整对话历史随请求发送，网关无需存储任何状态。

## 渠道配置前提

虚拟入口名（`auto-coder`）**不需要**对应任何真实渠道。

但 `vision_model` 和 `coding_model` 指定的模型名**必须**在请求用户所在 group 下有可用渠道，否则会返回「找不到可用渠道」错误。配置路由规则前，请先确认：

1. 目标模型已在「渠道管理」中添加并启用
2. 对应渠道已在用户所在分组的 ability 表中注册（正常添加渠道后自动完成）

## Token 权限

如果你使用了 **Token 模型限制**（在 Token 配置里勾选了允许的模型），只需把**虚拟入口名**（`auto-coder`）加入允许列表即可，无需额外添加 `vision_model` / `coding_model`。路由后的真实模型作为网关内部细节处理。

## 日志与计费

- **计费**按实际使用的真实模型（`gpt-4o` 或 `claude-sonnet-4`）计算，不按虚拟入口名
- **日志**中显示的模型名为真实模型名
- 如需在日志中追溯入口名：用量日志的 Model 列会显示入口模型（含相机图标与入口名 Popover），同时 `image_aware_entry_model` 仍会记录在上下文元数据中
