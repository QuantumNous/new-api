---
title: CC Switch（推荐）
description: 一键导入 DeepPattern API，配置 Claude Code、Codex 或 Gemini CLI。
---

CC Switch 可统一管理 Claude Code、Codex 和 Gemini CLI 的供应商配置，无需手动编辑配置文件。

## 第 1 步：安装并准备密钥

1. 从 [CC Switch 官方下载页](https://github.com/farion1231/cc-switch/releases/latest) 下载安装，安装后启动一次。
2. 安装需要使用的客户端：[Claude Code CLI](https://code.claude.com/docs/en/setup#install-claude-code)、[ChatGPT(Codex) 桌面端](https://chatgpt.com/download/)、Codex CLI 或 Gemini CLI。
3. 登录控制台并[创建 API Key](/start/api-key/)。

如果国内打不开或下载慢，可尝试 [镜像源下载](/clients/downloads/#cc-switch)。

## 第 2 步：导入配置

打开 [API 密钥](https://{{API_HOST}}/keys)页面，点击密钥行右侧的 **`···` → CC Switch**。

<figure class="tutorial-figure">
  <a href="/images/tutorials/clients/cc-switch-menu.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/clients/cc-switch-menu.webp" alt="密钥操作菜单中的 CC Switch 入口" width="2052" height="648" loading="lazy" />
  </a>
  <figcaption>打开 CC Switch 导入菜单。</figcaption>
</figure>

选择**应用**，填写**名称**和**主模型**，点击 **打开 CC Switch**。浏览器提示打开外部应用时，选择允许。

在 CC Switch 确认窗口中核对配置，点击 **导入**。地址和密钥已自动填入。

## 第 3 步：启用供应商

在对应应用的供应商列表中，将鼠标移到 **DeepPattern API**，点击 **启用**。

状态显示 **使用中** 后，重新打开对应客户端。

## 第 4 步：验证接入

以 Claude Code 为例，在终端运行：

```bash
claude -p "Hello"
```

收到回复后，在[使用日志](https://{{API_HOST}}/usage-logs/common)确认本次请求。

## 常见问题

- **无法打开 CC Switch**：确认已安装并启动过软件，且浏览器允许打开外部应用。
- **切换后未生效**：确认目标应用下的 DeepPattern API 显示「使用中」，然后重启客户端。
- **请求失败**：参见[错误码](/api/relay/#general/guide/errors)。

手动配置请查看 [Claude Code](/clients/claude-code/)、[Codex CLI](/clients/codex/) 或 [ChatGPT(Codex) 桌面端](/clients/chatgpt-codex/) 教程。
