---
title: 产品介绍
description: 在客户端或程序中调用模型，统一管理密钥、用量和费用。
---

DeepPattern API 提供 Claude、GPT、Grok 等模型的 API 接入。你可以在 Claude Code、Codex、Cherry Studio 中使用，也可以接入自己的应用；可用模型和价格以[模型广场](https://{{API_HOST}}/pricing)为准。

## 认识控制台

登录[控制台](https://{{API_HOST}}/dashboard)后，从下面四个入口开始。

<div class="docs-entrance-grid">
<a class="docs-entrance-card" href="https://{{API_HOST}}/pricing"><strong>模型广场</strong><span>查找模型，查看分组价格、支持的接口和调用示例。</span></a>
<a class="docs-entrance-card" href="/start/api-key/"><strong>API 密钥</strong><span>创建访问密钥，设置分组、消费上限和有效期。</span></a>
<a class="docs-entrance-card" href="/start/quickstart/"><strong>使用日志</strong><span>按请求查看模型、Tokens、费用和耗时。</span></a>
<a class="docs-entrance-card" href="/start/redeem/"><strong>钱包</strong><span>查看账户余额；有兑换码时按兑换码充值教程增加额度。</span></a>
</div>

## 选择接入方式

<div class="docs-path-grid">
<section class="docs-path-card">
<h3>在客户端中使用</h3>
<p><a href="/start/api-key/">创建 API Key</a>后，按对应教程配置。</p>
<ul>
<li><strong>Claude Code / Codex / Gemini CLI</strong>：<a href="/clients/cc-switch/">CC Switch 一键导入</a>。</li>
<li><strong>桌面聊天</strong>：<a href="/clients/cherry-studio/">Cherry Studio</a>。</li>
<li><strong>办公 Agent</strong>：<a href="/clients/workbuddy/">WorkBuddy</a>。</li>
<li><strong>编辑器插件</strong>：<a href="/clients/cursor-cline/">Cursor / Cline</a>。</li>
</ul>
</section>
<section class="docs-path-card">
<h3>在程序中调用</h3>
<p>先按<a href="/start/quickstart/">快速接入</a>发送一条请求，再接入 <a href="/clients/sdk/">Python / Node.js SDK</a>。完整参数见 <a href="/api/relay/">API 参考</a>。</p>
</section>
</div>

**模型名称、服务分组和接口格式需要匹配。** 例如，本教程使用 `ChatGPT` 分组下的 `gpt-5.6-luna`，通过 `/v1/chat/completions` 调用；不要把图片模型填入文本对话请求。
