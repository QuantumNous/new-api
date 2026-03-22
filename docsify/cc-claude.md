# Claude Code 最新版自定义中转站配置教程

通过 `settings.json` 的 `env` 配置接入 61kj。

## 第一步：找到配置目录

### Windows

按下 `Win + R`，输入下面路径后回车：

```bash
%userprofile%\.claude
```

### macOS / Linux

在访达或终端中打开下面路径：

```bash
~/.claude
```

如果目录里没有 `settings.json`，请手动创建一个。

## 第二步：修改 `settings.json`

把下面内容写入 `settings.json`：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-xxx",
    "ANTHROPIC_BASE_URL": "http://61kj.top",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gpt-5.4",
    "ANTHROPIC_MODEL": "gpt-5.4",
    "ANTHROPIC_REASONING_MODEL": "gpt-5.4"
  }
}
```

### 配置说明

- `ANTHROPIC_AUTH_TOKEN`：填写你从 61kj 获取到的真实 API Key
- `ANTHROPIC_BASE_URL`：固定写成 `http://61kj.top`
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`：默认 Haiku 模型，这里统一改成 `gpt-5.4`
- `ANTHROPIC_DEFAULT_OPUS_MODEL`：默认 Opus 模型，这里统一改成 `gpt-5.4`
- `ANTHROPIC_DEFAULT_SONNET_MODEL`：默认 Sonnet 模型，这里统一改成 `gpt-5.4`
- `ANTHROPIC_MODEL`：Claude Code 主模型，这里统一改成 `gpt-5.4`
- `ANTHROPIC_REASONING_MODEL`：推理模型，这里统一改成 `gpt-5.4`

如果你后面切换模型，把上面所有 `gpt-5.4` 一起改成你实际可用的模型 ID 即可。

## 第三步：启动并验证

保存文件后，重新打开终端并执行：

```bash
claude
```

如果能正常进入 Claude Code 对话界面，并且发送消息后能收到回复，说明配置已经生效。

## 第四步：常见排查

- 先检查 `settings.json` 是否放在正确的 `.claude` 目录里
- 确认 `ANTHROPIC_AUTH_TOKEN` 是否填写成真实可用的 Key
- 确认 `ANTHROPIC_BASE_URL` 是否写成 `http://61kj.top`
- 确认所有模型名是否都统一写成 `gpt-5.4`
- 如果可以启动但回复失败，再检查账户是否有 `gpt-5.4` 的调用权限
