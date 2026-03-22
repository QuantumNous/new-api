# OpenCode 最新版自定义中转站配置教程

通过 `/connect + opencode.json` 接入 61kj。

## 第一步：安装与基础初始化

首先确保你已经安装了 Node.js 环境，然后在终端执行：

### 1. 全局安装

```bash
npm install -g opencode-ai
```

### 2. 首次启动

```bash
opencode
```

如果终端里能正常进入 OpenCode 界面，说明安装成功。

## 第二步：通过 `/connect` 添加 61kj 鉴权

根据 OpenCode 官方文档，当前推荐通过 TUI 里的 `/connect` 命令添加 Provider 鉴权信息。

1. **输入命令**

```bash
/connect
```

2. **选择 Provider**
在 Provider 列表里选择 `Other`。

3. **填写 Provider ID**
在 Provider ID 里填写 `61kj`。

4. **填写 API Key**
粘贴你从 61kj 获取到的真实 API Key。

<div class="callout tip">
  <div class="callout-icon">💡</div>
  <div class="callout-content">
    <p><strong>说明：</strong>完成后，OpenCode 会把鉴权信息保存到本地，后面配置文件里只需要继续使用同一个 Provider ID。</p>
  </div>
</div>

## 第三步：创建或修改配置文件 `opencode.json`

推荐直接在你的**项目根目录**创建 `opencode.json`，这样跨平台通用，而且优先级高于全局配置。

### macOS / Linux / WSL 全局配置

```bash
~/.config/opencode/opencode.json
```

### 项目级配置

```bash
项目根目录/opencode.json
```

如果你在 Windows 上使用 OpenCode，官方当前更推荐在 `WSL` 环境下运行。

将配置写成下面这样：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "61kj": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "61kj",
      "options": {
        "baseURL": "http://61kj.top/v1"
      },
      "models": {
        "gpt-5.4": {
          "model": "gpt-5.4",
          "name": "GPT-5.4",
          "options": {
            "variant": "xhigh"
          },
          "limit": {
            "context": 200000,
            "output": 8192
          }
        }
      }
    }
  },
  "model": "61kj/gpt-5.4",
  "small_model": "61kj/gpt-5.4"
}
```

### 配置说明

- `provider.61kj`：这里的 Provider ID 必须和 `/connect` 里填写的 `61kj` 保持一致
- `npm`：OpenAI 兼容接口使用 `@ai-sdk/openai-compatible`
- `options.baseURL`：61kj 的 OpenAI 兼容接口地址
- `models`：这里填写你要在 OpenCode 中显示的模型
- `model`：默认主模型
- `small_model`：轻量任务使用的模型；如果暂时只有一个模型，可以先和主模型写成一样

如果你后面切换模型，只需要把 `gpt-5.4` 改成你实际可用的模型 ID。

## 第四步：验证配置是否生效

### 1. 重新启动 OpenCode

```bash
opencode
```

### 2. 在 TUI 中输入

```bash
/models
```

如果你能看到 `61kj/gpt-5.4`，说明配置已经生效。

### 3. 也可以在终端直接检查

```bash
opencode models 61kj
```

## 第五步：常见排查

- `/models` 里看不到 `61kj` 时，先检查 `/connect` 的 Provider ID 和 `opencode.json` 里的 Provider ID 是否完全一致
- 确认 `baseURL` 是否写成 `http://61kj.top/v1`
- 确认模型 ID 是否写成你账号实际可用的 GPT 模型

想确认鉴权有没有保存成功，可以执行：

```bash
opencode auth list
```

<div class="callout info">
  <div class="callout-icon">ℹ️</div>
  <div class="callout-content">
    <p><strong>排查重点：</strong>优先检查 <code>provider ID</code>、<code>baseURL</code>、<code>model</code>、API Key 四项是否匹配。</p>
  </div>
</div>
