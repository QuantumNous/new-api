---
title: 模型广场与分组
description: 选对模型、接口和密钥分组，确认实际适用的价格。
---

## 第 1 步：查找模型

打开[模型广场](https://{{API_HOST}}/pricing)，输入模型名称，例如 `gpt-5.6-luna`。可按分组、供应商和端点类型筛选。

卡片视图点击 **详情**；表格视图点击模型名称。请求的 `model` 必须使用完整模型 ID，不能填写供应商名或分组名。

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/model-search.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/model-search.webp" alt="模型广场：搜索 gpt-5.6-luna，并查看分组筛选和模型价格" width="1600" height="370" loading="lazy" />
  </a>
  <figcaption>按完整模型名搜索；图中价格仅代表截图时的配置。</figcaption>
</figure>

## 第 2 步：查看价格和接口

在模型详情的 **概览** 中查看 **按分组定价**。同一模型可能有多个价格档位，不能只看顶部基础价。

- **输入 / 输出**：分别对应发送给模型和模型生成的 Tokens。
- **缓存读取 / 写入**：仅在请求产生对应缓存用量时适用。
- **动态计费**：按上下文长度等条件命中不同档位，查看分档价格表。
- **1M / 1K**：分别表示每百万 / 每千 Tokens 的价格，不是单次请求价格。

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/model-detail.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/model-detail.webp" alt="gpt-5.6-luna 在 ChatGPT 分组下的 standard 与 long_context 档位价格" width="1600" height="583" loading="lazy" />
  </a>
  <figcaption>对照密钥分组查看价格与档位；最终费用以使用日志为准。</figcaption>
</figure>

切换到 **API** 页，选择需要的格式并查看调用示例：

| 详情页端点 | 用途 |
|---|---|
| `openai` | OpenAI Chat Completions，常见聊天客户端 |
| `openai-response` | OpenAI Responses，例如 Codex |
| `anthropic` | Anthropic Messages，例如 Claude Code |
| `gemini` | Gemini 格式请求 |

只使用该模型详情中实际列出的端点；模型名称相同不代表所有接口都可用。[快速接入](/start/quickstart/)演示了 `openai` 格式的完整调用。

## 第 3 步：匹配密钥分组

在[创建或编辑 API Key](https://{{API_HOST}}/keys)时选择分组：

| 选择 | 行为 |
|---|---|
| 指定分组，如 `ChatGPT` | 使用该分组支持的模型和价格 |
| `auto` | 按 Auto 分组顺序，匹配支持目标模型的分组 |

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/key-auto-groups.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/key-auto-groups.webp" alt="API Key 的 auto 分组配置：分组顺序和跨分组重试开关" width="1180" height="608" loading="lazy" />
  </a>
  <figcaption>Auto 分组顺序决定候选范围；跨分组重试是单独的开关。</figcaption>
</figure>

`auto` 不等于所有模型都可用。目标模型所属分组必须在候选顺序中；开启 **跨分组重试** 后，当前分组渠道失败时才会继续尝试后续分组。切换分组也可能改变适用价格。

**模型广场展示的是平台模型，不是某把密钥的授权清单。** 还需检查密钥是否启用、分组是否匹配，以及高级设置中的模型限制。

已设置 `DP_API_KEY` 时，可查询这把密钥可访问的模型：

```bash
curl https://{{API_HOST}}/v1/models \
  -H "Authorization: Bearer $DP_API_KEY"
```

返回的 `data[].id` 是模型 ID。接口格式仍需在模型详情中确认。
