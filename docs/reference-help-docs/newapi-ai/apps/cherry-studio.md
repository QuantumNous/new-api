# Cherry Studio - 桌面 AI 客户端

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/apps/cherry-studio.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/apps/cherry-studio.mdx

## 页面大纲

  - NewAPI 接入方法
    - 参数填写
    - 图文指引
  - 在 Cherry Studio 中画图

## 原文内容

---
title: Cherry Studio - 桌面 AI 客户端
description: Cherry Studio 教程 — 将桌面 AI 客户端对接 New API，一键填入 API Key。内置 30+ 专业 AI 助手，覆盖多种工作场景。
---
<Callout type="info" title="聊天设置选项">
  在 New API
  控制台的系统设置->聊天设置中，可添加如下快捷选项，便于在令牌管理页一键填充到
  Cherry Studio：
</Callout>

    ```json
    { "Cherry Studio": "cherrystudio://providers/api-keys?v=1&data={cherryConfig}" }
    ```

<Callout type="info">
  🍒 Cherry Studio 是一款功能强大的桌面 AI 客户端，专为专业用户设计，集成了 30+
  行业智能助手，能够满足各种工作场景的需求，显著提升工作效率。
</Callout>

- 官网地址：[https://cherry-ai.com](https://cherry-ai.com/)
- 下载地址：[https://cherry-ai.com/download](https://cherry-ai.com/download)
- 官方文档：[https://docs.cherry-ai.com](https://docs.cherry-ai.com)

## NewAPI 接入方法

### 参数填写

提供商类型：NewAPI 支持的类型  
API 密钥：于 NewAPI 获取  
API 地址：NewAPI 站点地址

请使用您自己部署的 New API，或确认服务方具备合法上游授权和合规义务的 New API 服务。不要将来源不明的 API 地址或密钥接入生产环境。

### 图文指引

1. 在 NewAPI 中复制 API key
   ![复制 API 密钥](/assets/cherry_studio/copy_api_key.png)

2. 添加提供商
   ![添加供应商](/assets/cherry_studio/add_provider.png)

3. 添加模型
   ![添加模型](/assets/cherry_studio/add_models.png)

4. 返回聊天页面
   ![切换聊天页面](/assets/cherry_studio/back_to_chat.png)

5. 切换 NewAPI 模型
   ![切换模型](/assets/cherry_studio/switch_model.png)

## 在 Cherry Studio 中画图

1. 首先添加支持画图的模型
   ![画图模型](/assets/cherry_studio/add_paint_models.png)

2. 画图
   ![画图](/assets/cherry_studio/paint.png)
