# CLI 配置教程

> 来源：https://docs.codexzh.com/ai-hub-api/cli-config
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- CLI 配置教程
  - 通用步骤：环境检查
    - （1）确认 Node.js 已安装
    - （2）安装 CLI 工具
    - （3）验证安装
  - Claude Code 配置
    - 配置文件位置
    - 手动配置步骤
  - Codex 配置
    - 配置文件位置
    - 手动配置步骤
  - Gemini 配置
    - 配置文件位置
    - 手动配置步骤
  - 常见问题
    - 找不到配置文件夹
    - 提示「模型不存在」
    - 无法连接到服务器
    - VS Code 插件如何配置？
  - 高级配置
    - 自定义模型
    - 设置代理（可选）
  - 更简单的方式

## 原文内容

# CLI 配置教程

手动配置 Claude Code、Codex、Gemini CLI 工具。

* * *

> **推荐使用 CC-Switch**
>
> 不熟悉命令行或配置文件编辑，建议改用 [CC-Switch](https://docs.codexzh.com/ai-hub-api/cc-switch)。
>
> 本页面适合：
>
> -   偏好手动配置的进阶用户
> -   CC-Switch 不适用的特殊场景
> -   需要深度定制配置的用户

## 通用步骤：环境检查

配置任何 CLI 前，先检查运行环境。

### （1）确认 Node.js 已安装

打开终端，运行：

bash

```
node --version
npm --version
```

提示「命令未找到」说明未安装 Node.js，请参考 [code cli 客户端下载](https://docs.codexzh.com/ai-hub-api/clients) 安装。

* * *

### （2）安装 CLI 工具

bash

```
# Claude Code
npm install -g @anthropic-ai/claude-code@latest

# Codex
npm install -g @openai/codex@latest

# Gemini CLI
npm install -g @google/gemini-cli@latest
```

* * *

### （3）验证安装

运行对应命令：

**Claude Code**：

bash

```
claude
```

**Codex**：

bash

```
codex
```

**Gemini**：

bash

```
gemini
```

出现欢迎界面或输入提示，说明安装成功。

> **重要**
>
> 首次运行会在用户目录下生成配置文件夹，这是后续配置的基础，请务必执行此步骤！

## Claude Code 配置

### 配置文件位置

**Windows**：

```
%USERPROFILE%\.claude\
```

**macOS / Linux**：

```
~/.claude/
```

### 手动配置步骤

#### 1\. 打开配置目录

**Windows**：按 `Win+R`，输入 `%USERPROFILE%\.claude`，回车

**macOS**：在访达按 `Command+Shift+G`，输入 `~/.claude`，回车

#### 2\. 编辑 auth.json

目录中没有 `auth.json` 时手动创建：

json

```
{
  "api.xbai.top": {
    "apiKey": "sk-你的API令牌"
  }
}
```

> **重要**
>
> 令牌必须是 **CC 分组** 的！

#### 3\. 编辑 config.json（可选）

创建或编辑 `config.json`，配置默认 API：

json

```
{
  "primaryApiKey": "api.xbai.top"
}
```

Claude Code 会默认使用 api.xbai.top 的配置。

#### 4\. 测试配置

bash

```
claude
```

能正常对话即配置成功。

## Codex 配置

### 配置文件位置

**Windows**：

```
%USERPROFILE%\.codex\
```

**macOS / Linux**：

```
~/.codex/
```

### 手动配置步骤

#### 1\. 打开配置目录

**Windows**：按 `Win+R`，输入 `%USERPROFILE%\.codex`，回车

**macOS**：访达按 `Command+Shift+G`，输入 `~/.codex`

#### 2\. 编辑 auth.json

创建或编辑 `auth.json`：

json

```
{
  "apiKey": "sk-你的API令牌"
}
```

> **重要**
>
> 令牌必须是 **Codex 分组** 的！

* * *

#### 3\. 编辑 config.toml

创建或编辑 `config.toml`：

toml

```
model_provider = "xbai"
model = "gpt-5.1-codex"

[model_providers.xbai]
name = "xbai"
base_url = "https://api.xbai.top/v1"
wire_api = "responses"
requires_openai_auth = true
```

* * *

#### 4\. 测试配置

bash

```
codex
```

能正常使用即配置成功。

* * *

## Gemini 配置

### 配置文件位置

**Windows**：

```
%USERPROFILE%\.gemini\
```

**macOS / Linux**：

```
~/.gemini/
```

* * *

### 手动配置步骤

#### 1\. 打开配置目录

同上述方法打开对应目录。

* * *

#### 2\. 编辑 config.json

创建或编辑 `config.json`：

json

```
{
  "apiKey": "sk-你的API令牌",
  "baseUrl": "https://api.xbai.top/gemini/v1"
}
```

> **重要**
>
> 令牌必须是 **Gemini 分组** 的！

* * *

#### 3\. 测试配置

bash

```
gemini
```

能正常对话即配置成功。

* * *

## 常见问题

### 找不到配置文件夹

先运行一次对应 CLI（`claude` / `codex` / `gemini`），会自动创建配置目录。

* * *

### 提示「模型不存在」

令牌分组选错了：

-   Claude Code 必须用 CC 分组令牌
-   Codex 必须用 Codex 分组令牌
-   Gemini 必须用 Gemini 分组令牌

查看 [模型分组介绍](https://docs.codexzh.com/ai-hub-api/model-groups) 确认分组。

* * *

### 无法连接到服务器

1.  确认网络正常，能访问 [https://api.xbai.top](https://api.xbai.top/)
2.  确认 API Key 正确且有额度
3.  确认 base\_url 配置正确（末尾不要有多余的 `/`）
4.  查看 [客服支持](https://docs.codexzh.com/ai-hub-api/support) 获取帮助

* * *

### VS Code 插件如何配置？

**Claude Code 插件**：

1.  确保 CLI 已正确配置（参考上述步骤）
2.  编辑 `~/.claude/config.json`，添加：

json

```
{
  "primaryApiKey": "api.xbai.top"
}
```

3.  重启 VS Code

**Cline / Roo Code 插件**：

在插件设置中：

-   API Provider：选择 "OpenAI-compatible"
-   Base URL：`https://api.xbai.top/v1`
-   API Key：你的令牌
-   Model：根据分组选择对应模型

* * *

## 高级配置

### 自定义模型

**Codex**：

toml

```
model = "你想使用的模型名"
```

**Gemini**：

json

```
{
  "defaultModel": "gemini-pro"
}
```

可用模型列表请查看控制台「模型广场」。

* * *

### 设置代理（可选）

**环境变量方式**：

bash

```
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
```

**配置文件方式**（Codex）：

toml

```
[network]
proxy = "http://127.0.0.1:7890"
```

* * *

## 更简单的方式

手动配置太复杂？使用 [CC-Switch](https://docs.codexzh.com/ai-hub-api/cc-switch) 一键完成配置。

* * *

**最后更新**：2025-02-01
