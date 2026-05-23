# LangBot - 即时通信机器人开发平台

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/apps/langbot.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/apps/langbot.mdx

## 页面大纲

  - 接入 NewAPI
    - 使用方式
    - 使用 LangBot 知识库

## 原文内容

---
title: LangBot - 即时通信机器人开发平台
description: LangBot 对接教程 — 面向飞书、钉钉、Telegram、Discord 等平台的 AI 聊天机器人开发框架。支持知识库、Agent、MCP，兼容 New API。
---
<Callout type="info">
  LangBot
  是一个开源的即时通信机器人开发平台，支持多种即时通信平台，如飞书、钉钉、微信、QQ、Telegram、Discord、Slack
  等。接入全球主流的 AI 模型，支持知识库、Agent、MCP等多种 AI
  应用能力，并完美适配 NewAPI。
</Callout>

- 官网地址：[https://langbot.app](https://langbot.app/)
- 下载地址：[https://github.com/langbot-app/LangBot/releases](https://github.com/langbot-app/LangBot/releases)
- 官方文档：[https://docs.langbot.app](https://docs.langbot.app/)
- 开源地址：[https://github.com/langbot-app/LangBot](https://github.com/langbot-app/LangBot)

## 接入 NewAPI

LangBot 支持接入本地部署的 NewAPI 和第三方使用 NewAPI 搭建的 NewAPI 服务。

### 使用方式

1.  从 NewAPI 中获取 API key
    ![获取 API key](/assets/langbot/get_api_key.png)

        若是本地部署的 NewAPI 请自行配置 API 地址（可参考[容器网络连接](https://docs.langbot.app/zh/workshop/network-details.html)），若使用第三方 NewAPI 服务，可在页面上复制地址。注意，地址后需要添加`/v1`。

2.  在 LangBot 中添加模型，选择使用 NewAPI 供应商，填写对应的 API key 和 API 地址
    ![添加 NewAPI 模型](/assets/langbot/add_newapi_model.png)

3.  在流水线中选择使用模型

    ![选择模型](/assets/langbot/select_model.png)

4.  在对话调试中对话或与绑定至流水线的机器人对话即可使用

    ![对话](/assets/langbot/debug_chat.png)

    ![微信对话](/assets/langbot/wechat.png)

    部署配置机器人请参考[部署机器人](https://docs.langbot.app/zh/deploy/platforms/readme.html)。

### 使用 LangBot 知识库

LangBot 支持使用 NewAPI 的嵌入模型，并将其作为知识库的向量模型。

1. 在 LangBot 中添加嵌入模型，选择使用 NewAPI 供应商
   ![添加嵌入模型](/assets/langbot/add_embedding_model.png)

2. 在新建知识库时选用嵌入模型
   ![使用嵌入模型](/assets/langbot/use_embedding_model.png)

更多使用方式请查看 LangBot 官方文档：[https://docs.langbot.app](https://docs.langbot.app/)
