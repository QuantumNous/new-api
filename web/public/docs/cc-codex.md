# Codex 最新版自定义中转站配置教程

通过 `config.toml + auth.json` 接入 61kj。

<div class="callout tip">
  <div class="callout-icon">💡</div>
  <div class="callout-content">
    <p><strong>说明：</strong>这份文档适用于 Codex 的桌面端、插件和 CLI 场景；只要使用同一套 <code>.codex</code> 配置目录，就可以按本文配置。</p>
  </div>
</div>

## 第一步：安装与基础初始化

首先确保你已经安装了 Node.js 环境，然后在终端执行：

### 1. 全局安装

```bash
npm install -g @openai/codex
```

### 2. 首次启动

```bash
codex
```

首次运行后，Codex 一般会在当前用户目录下生成 `.codex` 配置目录；如果没有自动生成，也可以手动创建。

## 第二步：找到配置目录

- **Windows：** `C:\Users\你的用户名\.codex\`
- **macOS / Linux：** `~/.codex/`

这个目录下重点关注两个文件：

- `config.toml`：主配置文件，用来指定默认模型和中转站地址
- `auth.json`：鉴权文件，用来保存 API Key

## 第三步：修改主配置文件 `config.toml`

打开下面路径中的文件：

- **Windows：** `C:\Users\你的用户名\.codex\config.toml`
- **macOS / Linux：** `~/.codex/config.toml`

```toml
disable_response_storage = true
model = "gpt-5.4"
model_provider = "61kj"
model_reasoning_effort = "high"

[model_providers."61kj"]
name = "61kj"
base_url = "http://61kj.top/v1"
requires_openai_auth = true
wire_api = "responses"
```

### 配置说明

- `model`：默认模型名称，请改成你中转站真实支持的模型 ID
- `model_provider`：默认提供方名称，这里写成 `61kj`
- `disable_response_storage = true`：关闭本地响应存储
- `base_url`：OpenAI 兼容接口地址，已改成 `http://61kj.top/v1`
- `requires_openai_auth = true`：表示使用 OpenAI 风格鉴权
- `wire_api = "responses"`：使用 Responses 接口模式

如果你默认不是 `gpt-5.4`，那就把 `model` 改成你实际使用的模型。

## 第四步：配置鉴权文件 `auth.json`

打开下面路径中的文件：

- **Windows：** `C:\Users\你的用户名\.codex\auth.json`
- **macOS / Linux：** `~/.codex/auth.json`

<div class="callout warning">
  <div class="callout-icon">⚠️</div>
  <div class="callout-content">
    <p><strong>重要：</strong><code>auth.json</code> 中除了 <code>OPENAI_API_KEY</code> 这一项外，不要再添加任何其他字段、注释、示例内容或历史配置，否则可能导致 Codex 读取鉴权异常。</p>
  </div>
</div>

```json
{
  "OPENAI_API_KEY": "sk-your-token-here"
}
```

请将 `sk-your-token-here` 替换成你从中转站获取到的真实密钥。

## 第五步：检查并启动

```bash
codex
```

如果你希望直接带一条指令启动，也可以这样写：

```bash
codex "帮我分析当前项目结构"
```

如果你想非交互执行一条任务，可以这样写：

```bash
codex exec "检查当前仓库中有哪些 TODO 需要处理"
```

<div class="callout info">
  <div class="callout-icon">ℹ️</div>
  <div class="callout-content">
    <p><strong>排查重点：</strong>优先检查 <code>model_provider</code> 和 <code>[model_providers."61kj"]</code> 是否一致、<code>base_url</code> 是否写成 <code>http://61kj.top/v1</code>、<code>auth.json</code> 是否存在且 Key 正确。</p>
    <p><strong>官方参考：</strong><a href="https://developers.openai.com/codex/cli" target="_blank" rel="noopener noreferrer">Codex 官方文档</a></p>
  </div>
</div>
