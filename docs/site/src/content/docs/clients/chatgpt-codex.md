---
title: ChatGPT(Codex) 桌面端
description: 通过 CC Switch 或终端命令，一次导入 DeepPattern API 地址、模型和密钥。
---

从 [ChatGPT 官方下载页](https://chatgpt.com/download/) 下载桌面端，并[创建一把 `ChatGPT` 分组的 API Key](/start/api-key/)。

如果国内打不开或下载慢，可尝试 [镜像源下载](/clients/downloads/#chatgpt)。

**创建密钥不等于完成接入。** 还需要把 DeepPattern API 的 Base URL、模型和密钥一起导入。下面两种方式任选一种，导入前先完全退出 ChatGPT。

## 方式一：CC Switch 导入（推荐）

1. 从 [CC Switch 官方下载页](https://github.com/farion1231/cc-switch/releases/latest) 下载安装并打开；访问困难时可使用[镜像源](/clients/downloads/#cc-switch)。
2. 打开控制台 [API 密钥](https://{{API_HOST}}/keys)，点击密钥右侧 **`···` → CC Switch**。

<figure class="tutorial-figure">
  <a href="/images/tutorials/clients/cc-switch-menu.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/clients/cc-switch-menu.webp" alt="在密钥操作菜单中选择 CC Switch 导入" width="2052" height="648" loading="lazy" />
  </a>
  <figcaption>从这把密钥的菜单发起导入。</figcaption>
</figure>

3. **应用选 `Codex`**，名称填 `DeepPattern API`，主模型选 `gpt-5.6-luna`，点击 **打开 CC Switch**。
4. 在 CC Switch 中点击 **导入**，然后在 **Codex** 列表启用 **DeepPattern API**；已显示 **使用中**则不用再点。

5. 重新打开 ChatGPT，进入 **Codex** 模式，新建对话即可使用。

导入会携带 `https://{{API_HOST}}/v1`、模型和这把密钥，不需要再到 ChatGPT 登录页单独粘贴密钥。

## 方式二：终端命令导入（macOS）

打开「终端」，复制执行下面整段命令，再按提示粘贴你的密钥。输入密钥时不会显示字符。

:::caution
命令会先备份，再替换 `config.toml`，不修改你的 ChatGPT 登录文件。如果需要保留现有 MCP 或其他自定义配置，请用上面的 CC Switch 方式。桌面端和 Codex CLI 可能共用此配置。
:::

```bash
bash <<'SH'
set -e
umask 077
read -r -s -p '粘贴 DeepPattern API API Key，然后回车：' KEY </dev/tty
printf '\n'
[[ "$KEY" =~ ^sk-[A-Za-z0-9_-]+$ ]] || { echo '密钥格式不正确，未修改配置。'; exit 1; }
DIR="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$DIR"
BACKUP="$(mktemp -d "$DIR/backup-deeppattern.XXXXXX")"
if [ -f "$DIR/config.toml" ]; then cp -p "$DIR/config.toml" "$BACKUP/config.toml"; fi
TMP="$(mktemp "$DIR/config.deeppattern.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
cat > "$TMP" <<'TOML'
model_provider = "deeppattern"
model = "gpt-5.6-luna"

[model_providers.deeppattern]
name = "DeepPattern API"
base_url = "https://{{API_HOST}}/v1"
wire_api = "responses"
requires_openai_auth = false
TOML
printf 'experimental_bearer_token = "%s"\n' "$KEY" >> "$TMP"
mv "$TMP" "$DIR/config.toml"
unset KEY
printf '配置已导入。原配置备份：%s\n请重新打开 ChatGPT，进入 Codex 模式。\n' "$BACKUP"
SH
```

这段命令同时写入 **Base URL、模型和密钥**，不是只设置临时环境变量。看到「配置已导入」后重新打开 ChatGPT，新建对话；无需另做 API 密钥登录。Windows 用户可直接使用上面的 CC Switch 方式。

配置文件中含有密钥，请勿分享或上传。多人共用的 macOS 电脑，在 CC Switch 导入后可执行 `chmod 700 ~/.codex && chmod 600 ~/.codex/config.toml`，限制其他本地账号读取；终端导入命令创建的文件已使用仅本人可读写的权限。

## 发一条消息

在 **Codex** 模式新建对话，输入：

```text
请只回复 Hello，不要读取文件或运行命令。
```

收到回复后，在[使用日志](https://{{API_HOST}}/usage-logs/common)查看本次调用的模型、Tokens 和费用。这里扣的是 **DeepPattern API 余额**，不是 ChatGPT 订阅额度。

- **仍显示登录页或原来的供应商**：完全退出后重新打开；CC Switch 方式需先启用供应商。不要用重新粘贴密钥代替配置导入。
- **`401` / `Invalid token`**：用正确的完整密钥重新导入。
- **余额不足**：到[钱包](https://{{API_HOST}}/wallet)补充额度。

命令行客户端请查看 [Codex CLI](/clients/codex/)。
