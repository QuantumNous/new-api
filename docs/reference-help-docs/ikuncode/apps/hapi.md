# Hapi 远程控制配置指南

> 来源：https://docs.ikuncode.cc/zh/apps/hapi
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- Hapi 远程控制配置指南
  - 🔗 相关链接
  - ✨ 核心功能
  - 🛠️ 安装步骤
    - 第一步：安装 Hapi
    - 第二步：启动 AI 会话
  - 🌐 配置 Cloudflare 内网穿透
    - 前置要求
    - 配置流程
  - ✅ 使用 Hapi
  - 🔒 安全建议
  - 常见问题
    - 提示无法连接到服务器？
    - Cloudflare Tunnel 配置失败？
    - 更多问题
  - 🚀 进阶优化

## 原文内容

# Hapi 远程控制配置指南

**随时随地远程控制你的 AI 编程助手**

> **作者**：[weishu](https://github.com/tiann)**官方文档**：[https://hapi.run/](https://hapi.run/)

📋 简介

Hapi 是一个本地优先的应用程序，可以让你在本地运行 Claude Code / Codex / Gemini 会话，并通过 Web / PWA / Telegram Mini App 进行远程控制。这意味着你可以在手机或浏览器上监控和管理你的 AI 编程任务。

## 🔗 相关链接

| 资源 | 地址 |
| --- | --- |
| Hapi 官网 | [https://hapi.run/](https://hapi.run/) |
| Hapi 仓库 | [https://github.com/tiann/hapi](https://github.com/tiann/hapi) |
| 快速开始 | [官方快速开始文档](https://hapi.run/docs/guide/quick-start) |
| Cloudflare Tunnel 文档 | [创建远程隧道](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/) |

## ✨ 核心功能

Hapi 提供以下强大功能：

-   ✅ **无缝切换**：在本地原生环境和远程控制之间无缝切换
-   ✅ **远程会话**：从任何设备发起远程会话
-   ✅ **移动监控**：通过手机或浏览器监控和管理任务
-   ✅ **权限控制**：远程批准/拒绝工具权限
-   ✅ **文件浏览**：浏览文件和查看 git diff
-   ✅ **进度跟踪**：通过待办事项列表跟踪进度
-   ✅ **多后端支持**：支持 Claude Code、Codex、Gemini

## 🛠️ 安装步骤

### 第一步：安装 Hapi

💡 前置要求

请确保已安装 Node.js 18+ 环境。如需安装，请参考 [Node.js 环境安装](https://docs.ikuncode.cc/node/windows)。

访问 [Hapi 官方快速开始文档](https://hapi.run/docs/guide/quick-start) 了解详细的安装方法。

推荐使用 npx 快速启动 Hapi 服务器：

bash

```
npx @twsxtd/hapi server
```

启动后会显示 Token 凭证和访问地址。

⚠️ 重要提示

**请务必保存好 Token 凭证！** 这是你连接和控制 Hapi 服务的唯一凭证。

![保留 Token 凭证](https://docs.ikuncode.cc/images/apps/hapi/image.png)

### 第二步：启动 AI 会话

在项目目录下执行以下命令启动对应的 AI 服务：

**启动 Claude Code**：

bash

```
hapi claude
```

**启动 Codex**：

bash

```
hapi codex
```

**启动 Gemini**：

bash

```
hapi gemini
```

![启动命令](https://docs.ikuncode.cc/images/apps/hapi/image%201.png)

启动成功后，前端界面会显示连接状态：

![前端连接状态](https://docs.ikuncode.cc/images/apps/hapi/image%202.png)

🎉 局域网访问

此时你已经可以在本地局域网内通过 `http://<server-ip>:3006` 访问和控制你的 AI 编程助手了！

## 🌐 配置 Cloudflare 内网穿透

如果你想在任何地方（包括外网）访问你的 Hapi 服务，可以通过 Cloudflare Tunnel 实现内网穿透。

### 前置要求

-   一个域名（任意域名均可）
-   Cloudflare 账号（免费账号即可）

### 配置流程

按照 [Cloudflare Tunnel 官方文档](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/) 进行配置：

**1\. 登录 Cloudflare Zero Trust 控制台**

![配置步骤 1](https://docs.ikuncode.cc/images/apps/hapi/image%203.png)

**2\. 创建新的 Tunnel**

![配置步骤 2](https://docs.ikuncode.cc/images/apps/hapi/image%204.png)

**3\. 安装 cloudflared 客户端**

![配置步骤 3](https://docs.ikuncode.cc/images/apps/hapi/image%205.png)

**4\. 配置隧道名称**

![配置步骤 4](https://docs.ikuncode.cc/images/apps/hapi/image%206.png)

**5\. 配置公共主机名**

![配置步骤 5](https://docs.ikuncode.cc/images/apps/hapi/image%207.png)

**6\. 设置服务地址**

将服务地址设置为 `localhost:3006`（Hapi 默认端口）

![配置步骤 6](https://docs.ikuncode.cc/images/apps/hapi/image%208.png)

**7\. 完成配置**

![配置步骤 7](https://docs.ikuncode.cc/images/apps/hapi/image%209.png)

## ✅ 使用 Hapi

配置完成后，你可以：

1.  **本地访问**：`http://localhost:3006`
2.  **局域网访问**：`http://<server-ip>:3006`
3.  **公网访问**：`https://your-domain.com`（如果配置了 Cloudflare Tunnel）

使用步骤：

1.  打开浏览器访问 Hapi 地址
2.  输入 Token 登录
3.  选择要启动的 AI 后端（Claude / Codex / Gemini）
4.  开始远程控制你的 AI 编程助手

💡 使用技巧

-   在手机浏览器中访问可以随时随地监控任务进度
-   可以安装为 PWA 应用，获得类似原生应用的体验
-   支持多设备同时连接和控制

## 🔒 安全建议

-   不要将 Token 泄露给他人
-   如果使用公网访问，建议启用 Cloudflare 的安全功能（如 Access 策略）
-   定期更换 Token
-   仅在可信网络环境下使用

## 常见问题

### 提示无法连接到服务器？

-   检查 Hapi 服务是否正常运行
-   确认防火墙未阻止 3006 端口
-   检查 Token 是否正确

### Cloudflare Tunnel 配置失败？

-   确认域名已正确添加到 Cloudflare
-   检查 cloudflared 客户端是否正确安装
-   查看 cloudflared 日志排查问题

### 更多问题

请查看 [FAQ](https://docs.ikuncode.cc/support/faq) 或访问 [Hapi GitHub Issues](https://github.com/tiann/hapi/issues)。

## 🚀 进阶优化

如果你想进一步提升 Hapi 的访问速度（特别是在国内网络环境下），可以配置 Cloudflare 优选 IP：

💡 速度优化

通过配置 Cloudflare 优选 IP，可以将访问延迟从几百毫秒降低到几十毫秒，实现接近直连的体验。

👉 查看详细教程：[Hapi 进阶：Cloudflare 优选 IP 高速穿透](https://docs.ikuncode.cc/apps/hapi-advanced)
