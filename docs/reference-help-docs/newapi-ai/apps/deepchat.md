# DeepChat - 全功能AI Agent客户端

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/apps/deepchat.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/apps/deepchat.mdx

## 页面大纲

  - NewAPI 接入方法
    - 方式一：一键导入
    - 方式二：手动导入
  - 相关链接

## 原文内容

---
title: DeepChat - 全功能AI Agent客户端
description: DeepChat 教程 — 将全功能AI Agent客户端对接 New API，并通过 DeepLink 一键导入 DeepChat 配置。
---
<Callout type="info" title="聊天设置选项">
  在 New API
  控制台的系统设置->聊天设置中，可添加如下快捷选项，便于在令牌管理页一键填充到
  DeepChat：
</Callout>

    ```json
    { "DeepChat": "deepchat://provider/install?v=1&data={deepchatConfig}" }
    ```

<Callout type="info">
  DeepChat 是一款开源、跨平台的商业化友好全功能AI Agent客户端，支持云端与本地模型、MCP
  工具调用、Skills、ACP、Agent 集成和远程控制等工作流，适合需要统一管理多个
  Provider 与高级 AI Agent的用户。
</Callout>

- 官网地址：[https://deepchat.thinkinai.xyz](https://deepchat.thinkinai.xyz)
- GitHub 仓库：[https://github.com/ThinkInAIXYZ/deepchat](https://github.com/ThinkInAIXYZ/deepchat)
- 下载地址：[https://deepchat.thinkinai.xyz/#/download](https://deepchat.thinkinai.xyz/#/download)

## NewAPI 接入方法

### 方式一：一键导入

1. 在 New API 控制台侧边栏进入「令牌管理」，找到需要使用的令牌
   <img src="/assets/deepchat/1-Enter-API-key.png" alt="进入令牌管理" width="240" />

2. 在令牌操作中选择 **DeepChat**
   <img src="/assets/deepchat/2-API-key-deepchat.png" alt="选择 DeepChat" width="360" />

3. 浏览器唤起 DeepChat，确认打开应用
   ![打开 DeepChat](/assets/deepchat/3-open-deepchat.png)

4. 在 DeepChat 的 Provider 导入预览中确认配置
   ![确认 DeepChat 配置](/assets/deepchat/4-deepchat-ok.png)

5. 打开模型列表，选择 New API 模型开始使用
   ![打开模型列表](/assets/deepchat/5-open-models.png)

### 方式二：手动导入

1. 在 New API 控制台复制 API Key 和站点地址
   ![New API 手动配置指引](/assets/deepchat/7-new-api-manual-guidance.png)

2. 在 DeepChat 设置中添加或编辑 New API Provider，填写 API 地址和 API Key
   ![DeepChat 手动配置指引](/assets/deepchat/6-deepchat-manual-guidance.png)

3. 打开模型列表，选择 New API 模型开始使用
   ![打开模型列表](/assets/deepchat/5-open-models.png)

## 相关链接

- [DeepChat GitHub 仓库](https://github.com/ThinkInAIXYZ/deepchat)
- [DeepChat 下载页面](https://deepchatai.cn/#/download)
