# code cli 客户端下载

> 来源：https://docs.codexzh.com/ai-hub-api/clients
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- code cli 客户端下载
  - 命令行工具（CLI）
    - 前置要求
  - Claude Code
  - Codex
  - Gemini CLI
  - 常见问题

## 原文内容

# code cli 客户端下载

## 命令行工具（CLI）

### 前置要求

所有 CLI 工具都需要 Node.js 环境。

检查是否已安装：

bash

```
node --version
npm --version
```

如未安装：

-   Windows：访问 [Node.js 官网](https://nodejs.org/) 下载安装包
-   macOS：使用 Homebrew 安装：`brew install node`
-   Linux：使用包管理器：`sudo apt install nodejs npm`

* * *

## Claude Code

安装命令：

bash

```
npm install -g @anthropic-ai/claude-code@latest
```

验证安装：

bash

```
claude --version
```

官方文档：[https://docs.anthropic.com/claude-code](https://docs.anthropic.com/claude-code)

![img](https://cdn.xf233.io/project/Packy-docs/Cli/003.png)

* * *

## Codex

安装命令：

bash

```
npm install -g @openai/codex@latest
```

验证安装：

bash

```
codex --version
```

官方文档：[https://openai.com/codex](https://openai.com/codex)

![img](https://cdn.xf233.io/project/Packy-docs/Cli/004.png)

* * *

## Gemini CLI

安装命令：

bash

```
npm install -g @google/gemini-cli@latest
```

验证安装：

bash

```
gemini --version
```

官方文档：[https://ai.google.dev/gemini-api](https://ai.google.dev/gemini-api)

![img](https://cdn.xf233.io/project/Packy-docs/Cli/005.png)

* * *

## 常见问题

提示 "npm: command not found"

-   原因：Node.js 未安装或未添加到环境变量
-   解决：重新安装 Node.js，确保勾选"添加到 PATH"

权限错误（Permission denied）

-   Windows：以管理员身份运行命令行
-   macOS/Linux：命令前加 `sudo`

安装速度慢

-   使用国内镜像：`npm config set registry https://registry.npmmirror.com`

* * *

**最后更新**：2025-02-01
