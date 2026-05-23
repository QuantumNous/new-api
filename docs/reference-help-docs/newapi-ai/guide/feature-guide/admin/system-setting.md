# 系统设置

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/system-setting.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/system-setting.mdx

## 页面大纲

  - 通用设置
  - 计费与倍率设置
  - 注册与安全设置
  - OAuth 配置
    - OIDC 配置重要提示
  - 邮件服务器配置
  - Worker 配置

## 原文内容

---
title: 系统设置
description: Root 专属的全局配置中心
---
import { Callout } from 'fumadocs-ui/components/callout';

Root 专属的全局配置中心，涵盖站点基础信息、计费规则、支付配置等所有系统级参数。使用 Root 账号登录后，左侧导航点击「设置」，或直接访问 `/console/setting`。

![系统设置页标签页导航总览](../../../assets/guide/feature-guide/setting-tabs.png)

系统设置页顶部有多个标签页，点击对应标签切换到不同配置区域。

## 通用设置

1. 点击「通用设置」标签页

![通用设置标签页](../../../assets/guide/feature-guide/setting-general.png)

2. 可配置以下内容：
   - **站点名称**：显示在浏览器标签和页面顶部的名称
   - **首页公告**：在首页展示的公告文字，支持 Markdown 格式
   - **文档地址**：填写后首页左侧导航出现「文档」按钮，点击跳转到该地址
   - **充值链接**：自定义充值页面的跳转地址
3. 修改完成后点击「保存」

<Callout type="info">
  文档地址留空时，左侧导航不会显示「文档」按钮。
</Callout>

## 计费与倍率设置

1. 点击「计费设置」或「倍率设置」标签页

![计费与倍率设置标签页](../../../assets/guide/feature-guide/setting-ratio.png)

2. 在模型倍率列表中找到目标模型，修改输入/输出倍率数值
3. 在分组倍率区域可为不同分组设置差异化的计费倍率
4. 修改完成后点击「保存」

## 注册与安全设置

1. 点击「安全设置」或「注册设置」标签页

![注册与安全设置标签页](../../../assets/guide/feature-guide/setting-security.png)

2. 可配置以下内容：
   - **开放注册**：开关控制是否允许新用户自行注册
   - **邮箱白名单**：限制只有特定邮箱域名可以注册
   - **Turnstile 验证**：填写 Cloudflare Turnstile 的 Site Key 和 Secret Key，启用人机验证
3. 修改完成后点击「保存」

## OAuth 配置

1. 点击「OAuth 设置」标签页

![OAuth 设置标签页](../../../assets/guide/feature-guide/setting-oauth.png)

2. 为需要启用的第三方登录平台填写对应的 Client ID 和 Client Secret
3. 修改完成后点击「保存」，用户登录页即可看到对应的第三方登录按钮

### OIDC 配置重要提示

<Callout type="warn">
  当启用 OIDC 配置后，请一定要勾选"允许新用户注册"，否则会导致 OIDC 登录的新用户无法正常创建用户，并同时勾选"允许通过 OIDC 进行登录"。其他配置根据需要勾选。
</Callout>

## 邮件服务器配置

配置邮件服务器用于发送验证码、通知等邮件。

![系统设置 - 邮件服务器](../../../assets/guide/system-setting-2.png)

1. 在系统设置页找到「邮件服务器」配置区域
2. 填写以下信息：
   - **SMTP 服务器地址**：邮件服务器地址（如 smtp.gmail.com）
   - **SMTP 端口**：通常为 465（SSL）或 587（TLS）
   - **发件人邮箱**：用于发送邮件的邮箱地址
   - **发件人名称**：邮件中显示的发件人名称
   - **SMTP 用户名**：通常与发件人邮箱相同
   - **SMTP 密码**：邮箱的授权密码或应用专用密码
3. 点击「测试邮件」验证配置是否正确
4. 点击「保存」

<Callout type="info">
  Gmail 等邮箱需要使用应用专用密码，而不是账号密码。请在邮箱设置中生成应用专用密码。
</Callout>

## Worker 配置

配置 New API Worker 相关参数。

![系统设置 - Worker 配置](../../../assets/guide/system-setting-1.png)

Worker 用于处理异步任务，如：
- 邮件发送
- 数据统计
- 定时任务

配置项：
- **Worker 数量**：并发处理任务的 Worker 数量
- **任务队列大小**：待处理任务的队列容量

<Callout type="info">
  Worker 数量建议根据服务器性能设置，通常设置为 CPU 核心数的 2-4 倍
</Callout>
