---
title: WorkBuddy
description: 在 WorkBuddy 中添加自定义 OpenAI 兼容模型，使用 DeepPattern API 的密钥与模型完成接入。
---

WorkBuddy 是腾讯的 AI Agent 办公工具。按照[官方模型配置文档](https://www.workbuddy.ai/docs/zh/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%A8%A1%E5%9E%8B)，可在设置中添加 **自定义 / Custom** 模型，无需编辑配置文件。

本教程通过 **OpenAI Chat Completions** 接入 DeepPattern API，不使用腾讯云 Token Plan 或 Coding Plan。

## 第 1 步：安装并准备密钥

1. 从 [WorkBuddy 官网](https://www.workbuddy.ai/) 下载并安装客户端。
2. 确认[钱包](https://{{API_HOST}}/wallet)有可用额度，按[创建 API Key](/start/api-key/)教程创建密钥。本例使用 **`Claude` 分组**，可将密钥命名为 `WorkBuddy`，便于核对用量。
3. 在 [API 密钥](https://{{API_HOST}}/keys)列表中选择 **`···` → 复制密钥**，不要复制带星号的隐藏文本。
4. 打开[模型广场](https://{{API_HOST}}/pricing)，搜索 **`claude-opus-5`**，在模型详情的 **API → openai** 中确认接口为 `/v1/chat/completions`。

模型与分组以控制台当前配置为准。若示例模型不可用，改用密钥分组内支持 `openai` 接口的文本模型，并在下文填写对应的完整模型 ID；不要直接使用图片模型或仅支持其他协议的模型。

## 第 2 步：打开自定义模型设置

1. 进入 WorkBuddy **设置 → 模型**。
2. 在 **自定义模型** 区域点击 **添加模型**。
3. 打开 **提供商** 下拉框，选择 **自定义 / Custom**，**不要选择腾讯云 Coding Plan**。

## 第 3 步：填写 DeepPattern API 配置

确认 **提供商** 为 **自定义 / Custom**，按下表填写并保存：

| 配置项 | 填写内容 |
|---|---|
| 提供商 | **自定义 / Custom** |
| 接口地址 | `https://{{API_HOST}}/v1/chat/completions` |
| API KEY | 你的完整 DeepPattern API 密钥，不加 `Bearer ` 前缀 |
| 模型名称 | `claude-opus-5`，或你在模型广场确认的完整模型 ID |
| 自定义协议 | **关闭**，使用标准 Chat Completions 路径 |

**这里填写的是完整「接口地址」，不是只填域名的 Base URL。** 不要改成 `/v1/responses` 或 `/v1/messages`。`Claude` 是控制台密钥的分组，不是模型名称。

### 高级配置怎么选

自定义提供商的能力项应按模型实际支持情况设置，不要全部勾选：

| 配置项 | 设置建议 |
|---|---|
| 工具调用 | 需要 WorkBuddy 调用工具、执行任务时，确认模型支持工具调用后开启 |
| 图片输入 | 需要提交图片且模型支持图像理解时开启 |
| 推理模式 | 仅在模型支持相应推理请求参数时开启 |
| 输入 / 输出 | 初次接入保留「使用提供商默认值」；如需手填，按模型实际上下文与输出上限设置 |

:::note[「自定义协议」不是切换 API 协议]
根据官方说明，关闭时会校验并补全标准 `/chat/completions` 路径；开启时会直接使用填写的 URL，跳过路径校验与自动补全。DeepPattern API 使用标准端点，保持关闭即可。打开这个开关不会让 WorkBuddy 改用 Anthropic Messages 或 OpenAI Responses。
:::

填写完成后点击 **保存**。配置会自动持久化，可继续在模型列表中编辑或删除。

### 用配置文件批量添加（可选）

界面保存的自定义模型会写入 `~/.workbuddy/models.json`，这个文件也可以直接编辑，适合一次配置多个模型或在多台机器间复制配置。

不想手写时，在控制台 [API 密钥](https://{{API_HOST}}/keys)列表点击密钥行的 **`···` → WorkBuddy**，选择模型和能力后 **复制配置** 或 **下载 models.json**：接口地址、密钥和模型 ID 都已填好，粘贴进下面这个文件即可。

在 WorkBuddy **设置 → 模型** 中，点击「自定义模型」说明里的 `~/.workbuddy/models.json` 链接即可打开该文件，把生成的配置填进去保存。

<figure class="tutorial-figure">
  <a href="/images/tutorials/clients/workbuddy-models-json-entry.png" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/clients/workbuddy-models-json-entry.png" alt="WorkBuddy 设置 → 模型页面，点击「自定义模型」说明中的 ~/.workbuddy/models.json 链接打开配置文件" width="1568" height="1185" loading="lazy" />
  </a>
  <figcaption>点击红框中的 ~/.workbuddy/models.json 打开配置文件；粘贴保存后 WorkBuddy 会自动重载。点击图片可查看大图。</figcaption>
</figure>

```json title="~/.workbuddy/models.json"
[
  {
    "id": "claude-opus-5",
    "name": "DeepPattern API · claude-opus-5",
    "vendor": "Custom",
    "url": "https://{{API_HOST}}/v1/chat/completions",
    "apiKey": "${DP_API_KEY}",
    "supportsToolCall": true,
    "supportsImages": true,
    "useCustomProtocol": false
  }
]
```

- **文件顶层是数组**，整个内容必须包在一对 `[ ]` 里。文件里已经有模型时，把新对象追加进现有数组（对象之间用 `,` 分隔），不要把数组整体覆盖掉，也不要只粘贴一个裸对象——那样 JSON 解析会失败，配置不生效。
- 也支持 `{"models": [...], "availableModels": [...]}` 对象写法；界面保存时用的是顶层数组。
- `id` 必填，必须是完整模型 ID；`url` 必须是完整接口地址，仍以 `/chat/completions` 结尾。
- `apiKey` 与 `url` 支持 `${环境变量名}` 引用，避免把密钥明文写进文件。用明文时把文件权限设为 `600`。
- 保存后 WorkBuddy 会监听文件变更并自动重载（约 1 秒防抖），不需要重启客户端。
- 项目级配置放在 `<项目目录>/.codebuddy/models.json`，同 `id` 覆盖用户级配置。

## 第 4 步：在对话中选择模型

1. 回到 WorkBuddy 对话界面，新建会话。
2. 打开模型选择器，在 **自定义模型** 分组中选择刚添加的模型。
3. 首次验证不要停留在 **自动模式** 或内置模型；自动模式会由 WorkBuddy 选择模型，不能据此确认请求走了 DeepPattern API。
4. 先发送一个不需要访问本地文件或调用工具的简单请求：

```text
请只回复：Hello。不读取或修改本地文件，不调用工具。
```

接入成功时，对话中应出现模型回复。标准非流式 Chat Completions 响应的正文位于 `choices[0].message.content`；流式正文位于 `choices[0].delta.content`。如需独立检查密钥、模型和接口，可按[快速接入](/start/quickstart/)中的 cURL 示例验证。

**保存配置不等于调用成功。** 模型请求会按实际用量计费，复杂 Agent 任务可能发起多次调用；首次验证后再尝试工具任务。

## 第 5 步：核对调用记录

打开[使用日志](https://{{API_HOST}}/usage-logs/common)：

1. 选择包含本次请求的时间范围，类型选择 **消耗**。
2. 在 **模型名称** 中填写本次使用的模型；展开筛选项，在 **令牌名称** 中填写密钥名称，例如 `WorkBuddy`。
3. 点击 **搜索**，核对模型、Tokens、费用和耗时，确认请求使用了这把 DeepPattern API 密钥。

若客户端有回复但没有对应记录，先核对时间范围、密钥名称，以及会话是否真正选中了 **自定义模型**，而不是自动模式或内置模型。

## 常见问题

| 现象 | 检查方式 |
|---|---|
| `401` / 密钥无效 | 重新复制完整密钥，确认未禁用、未过期；不要填写带星号的文本或 `Bearer ` 前缀 |
| `403` / 无权限 | 核对密钥分组、模型限制和 IP 限制是否允许本次调用 |
| `404` / 路径错误 | 使用上表的完整接口地址，检查是否重复填写 `/v1` 或 `/chat/completions`；标准端点的自定义协议保持关闭 |
| 模型不存在或不可用 | 使用模型广场的完整模型 ID，并确认密钥分组和 `openai` 接口匹配 |
| 余额或额度不足 | 检查账户余额以及这把密钥的剩余额度 |
| 只能对话，无法调用工具 | 确认模型支持工具调用，并在高级配置中开启对应能力；勾选能力项不会为模型增加它原本不支持的能力 |
| 保存后仍使用内置模型 | 在当前会话的模型选择器中重新选择自定义模型 |

更多请求错误见 [API 错误码](/api/relay/#general/guide/errors)。

## 官方参考

- [WorkBuddy：模型配置与自定义模型](https://www.workbuddy.ai/docs/zh/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%A8%A1%E5%9E%8B)
- [WorkBuddy：自定义协议的 URL 处理规则](https://www.workbuddy.ai/docs/zh/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model#%E8%87%AA%E5%AE%9A%E4%B9%89%E5%8D%8F%E8%AE%AE)

本文配图基于上述官方文档的[模型设置截图](https://www.workbuddy.ai/docs/static/model-1.BuUbNA6x.png)与[自定义模型截图](https://www.workbuddy.ai/docs/static/model-7.Buzcl1Ob.png)，经过局部裁剪、编号标注及示例值填入，用于说明 DeepPattern API 的配置方法，并非真实账号配置完成的截图，不包含真实密钥。
