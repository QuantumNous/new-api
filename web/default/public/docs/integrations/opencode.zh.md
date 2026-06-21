# OpenCode → DeepRouter

把 SST 出品的 [OpenCode](https://opencode.ai) 指向 DeepRouter，让它的请求走你的
DeepRouter 账户，而不是直接发给某一家模型厂商。OpenCode 允许你添加自己的
**OpenAI 兼容服务商（OpenAI‑compatible provider）**，而 DeepRouter 正好就是这样一个服务商——所以只需要一个小小的配置
文件加一个 API Key 就行，完全不用写代码。

> **一句话总结** —— 在你的 `opencode.json` 里加一个服务商，再配一个 API Key。
> ```json
> {
>   "$schema": "https://opencode.ai/config.json",
>   "provider": {
>     "deeprouter": {
>       "npm": "@ai-sdk/openai-compatible",
>       "name": "DeepRouter",
>       "options": {
>         "baseURL": "https://api.deeprouter.co/v1",
>         "apiKey": "{env:DEEPROUTER_API_KEY}"
>       },
>       "models": { "claude-haiku-4-5": { "name": "Claude Haiku 4.5" } }
>     }
>   }
> }
> ```
> ```bash
> export DEEPROUTER_API_KEY=sk-...your-deeprouter-key...
> ```

---

## 为什么让 OpenCode 走 DeepRouter

- **一个 Key，所有模型。** Claude、GPT 系列，以及众多开源模型——全都能通过同一个
  OpenAI 风格的接口访问，自动选模型、自动兜底切换。
- **智能路由。** DeepRouter 会为每个请求挑选合适的模型和通道，当某个上游出故障时
  自动切换。
- **账单集中管理。** 你团队的用量、花费和日志都集中在 DeepRouter 控制台里。

---

## 开始之前

1. 一个 DeepRouter 账户 → **https://deeprouter.co**
2. 一个 DeepRouter **API Key**（以 `sk-` 开头）。在控制台获取：
   **API Keys** 页面（注册后欢迎页上也会显示一次）。
3. 安装好 OpenCode：
   ```bash
   npm install -g opencode-ai
   ```

---

## 第 1 步 —— 打开（或新建）你的 OpenCode 配置文件

配置文件放在哪里，你有两种选择：

- **只给某一个项目用：** 放在该项目根目录下的 `opencode.json`。
- **给你所有项目都用：** 放在用户主目录下的 `~/.config/opencode/opencode.json`。

挑一个就行。如果文件（或 `~/.config/opencode` 文件夹）还不存在，就新建一个。

---

## 第 2 步 —— 把 DeepRouter 添加为服务商

把下面这段粘进文件里：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "deeprouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepRouter",
      "options": {
        "baseURL": "https://api.deeprouter.co/v1",
        "apiKey": "{env:DEEPROUTER_API_KEY}"
      },
      "models": {
        "claude-haiku-4-5": { "name": "Claude Haiku 4.5" }
      }
    }
  }
}
```

用大白话解释每一项的作用：

- **`npm`** —— 告诉 OpenCode 使用它内置的 OpenAI 兼容适配器，这正是
  DeepRouter 的 `/v1` 接口所讲的"方言"。
- **`name`** —— 你在 OpenCode 模型选择器里看到的名字。
- **`baseURL`** —— 请求发往哪里。请原样填 `https://api.deeprouter.co/v1`（结尾不要带斜杠）；
  OpenCode 会自动帮你补上 `/chat/completions`。
- **`apiKey`** —— `{env:DEEPROUTER_API_KEY}` 的意思是"从那个环境变量里读取 Key"，
  这样密钥就不会直接出现在文件里。
- **`models`** —— 这个服务商提供的模型清单。你想用哪个模型，就为它的模型 ID 加一条；
  从控制台的 **Model Catalog** 里复制准确的 ID。

想提供更多模型，就在 `models` 下面多加几行：

```json
"models": {
  "claude-haiku-4-5": { "name": "Claude Haiku 4.5" },
  "gpt-5-mini": { "name": "GPT-5 mini" }
}
```

---

## 第 3 步 —— 把你的 Key 放进环境变量

把你的 DeepRouter Key 加到 shell 配置文件里（`~/.zshrc`、`~/.bashrc`，或你的 fish 配置）：

```bash
export DEEPROUTER_API_KEY=sk-...your-deeprouter-key...
```

然后重新加载 shell（或者打开一个新的终端窗口）：

```bash
source ~/.zshrc
```

> 不想用环境变量？你也可以把 Key 直接粘进文件里，写成
> `"apiKey": "sk-...your-key..."`——但这样的话，一定要把这个文件保密，别提交到任何 git 仓库里。

---

## 验证是否生效

启动 OpenCode：

```bash
opencode
```

打开模型选择器，选 **DeepRouter → Claude Haiku 4.5**（或你添加的任意模型），
然后随便问它一句，比如"say hello"。能正常回复，就说明流量已经走通 DeepRouter 了。
想进一步确认，可以打开 DeepRouter 控制台，看着用量往上涨。

你也可以用 curl 直接测试接口——返回 `200` 就说明路由正确：

```bash
curl https://api.deeprouter.co/v1/chat/completions \
  -H "Authorization: Bearer $DEEPROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "messages": [{"role": "user", "content": "Say hello from DeepRouter."}]
  }'
```

---

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **连接错误或 404** | 确认 `baseURL` 原样写成 `https://api.deeprouter.co/v1`——要带 `/v1`，并且**结尾不要带斜杠**。 |
| **认证失败 / 401** | Key 写错了或为空。检查 `DEEPROUTER_API_KEY` 是否已设置（`echo $DEEPROUTER_API_KEY`），并和文件里 `{env:...}` 的名字一致。 |
| **选择器里看不到 DeepRouter** | `opencode.json` 有拼写错误，或者放在了 OpenCode 不会读取的文件夹里。重新检查 JSON 是否合法、文件位置是否正确（项目根目录或 `~/.config/opencode/`）。 |
| **Key 没被读取到** | 如果你是在 shell 里设置的 Key，请在新的终端里重启 OpenCode，让它继承到新值。 |
| **`model not found`** | `models` 里的模型 ID 没有为你的账户开通。请从控制台 **Model Catalog** 里挑一个 ID。 |

---

## 参考速查

| 项目 | 取值 |
|---|---|
| 配置文件 | `opencode.json`（项目根目录）或 `~/.config/opencode/opencode.json` |
| 适配器（`npm`） | `@ai-sdk/openai-compatible` |
| OpenAI 兼容接入地址（Base URL） | `https://api.deeprouter.co/v1` |
| 接口端点 | `POST /chat/completions`（由 OpenCode 自动补上） |
| 认证方式 | `Authorization: Bearer <key>`（来自 `apiKey`） |
| 模型 ID | DeepRouter 控制台 → **Model Catalog** |
| 获取 Key | DeepRouter 控制台 → **API Keys** |
