# seed-models

一键把所有支持的上游 AI 厂商导入 DeepRouter 实例。

读 `channels.yaml`、调 admin API、幂等 upsert。Python 单文件脚本，零三方依赖（除 `pyyaml`）。

---

## 快速开始

### 1. 装依赖

```bash
pip install pyyaml
```

### 2. 准备 admin token

登录你的 DeepRouter 实例后台：

```
个人中心 → API 令牌 → 创建访问令牌
```

要求该用户的 role ≥ Admin（角色码 ≥ 20）。复制生成的 `sk-...` token。

### 3. 配置 `.env`

```bash
cp .env.example .env
vim .env  # 填 DEEPROUTER_BASE_URL / DEEPROUTER_ADMIN_TOKEN 和需要启用的上游 API key
```

`.env` 已 gitignore，不会提交。

### 4. 先 dry-run 看效果

```bash
python3 seed.py --dry-run
```

输出示例：

```
准备处理 11 个 channel [DRY RUN]
──────────────────────────────────────────────────────────────────────
  CREATE OpenAI                  (type=1, models=24)
  CREATE Anthropic Claude        (type=14, models=18)
  CREATE Google Gemini           (type=24, models=7)
  CREATE xAI Grok                (type=48, models=8)
  CREATE DeepSeek 深度求索        (type=43, models=3)
  CREATE Moonshot Kimi 月之暗面   (type=25, models=7)
  CREATE 阿里通义 Qwen            (type=17, models=12)
  CREATE 智谱 GLM                 (type=26, models=9)
  ...
```

### 5. 真跑

```bash
python3 seed.py
```

二次运行会自动识别同名 channel，走 UPDATE 而不是重复创建。

---

## 常用参数

| 参数 | 作用 |
|---|---|
| `--config PATH` | 指定 YAML（默认同目录 `channels.yaml`） |
| `--dry-run` | 不发请求，只打印 |
| `--only KEYWORD` | 只处理 name 包含关键字的 channel（如 `--only OpenAI`） |
| `--include-disabled` | 也处理 `enabled: false` 的 channel |
| `--base-url URL` | 覆盖 env 里的 `DEEPROUTER_BASE_URL` |
| `--admin-token TOKEN` | 覆盖 env 里的 `DEEPROUTER_ADMIN_TOKEN` |

---

## 修改 channel 列表

打开 `channels.yaml`，每个 channel 长这样：

```yaml
- name: OpenAI                       # 幂等键，同名会更新
  type: 1                            # 来自 constant/channel.go
  enabled: true                      # false 跳过
  key_env: OPENAI_API_KEY            # 从该环境变量读 key
  base_url: https://api.openai.com   # 可选；不写用 new-api 内置默认
  test_model: gpt-4o-mini            # 用于健康检查
  tag: openai
  models:
    - gpt-5
    - gpt-4o
    - ...
```

### 加新厂商

1. 在 `channels.yaml` 加一个 channel 条目
2. 在 `.env.example` + `.env` 加 `XXX_API_KEY` 环境变量
3. 跑 `python3 seed.py --only YourName --dry-run` 检查
4. 跑 `python3 seed.py --only YourName` 实际写入

### 加新模型

直接在对应 channel 的 `models:` 数组里加。前提是该模型在 `setting/ratio_setting/model_ratio.go` 里有定价；不在的话会落到默认 ratio（`1.0` = $0.002/1K），admin UI 里可手动调。

### 关闭 channel

把 `enabled: false` 即可。下次运行不会动它，但**也不会删它**——要删请在 admin UI 手动删，避免误删。

---

## 涵盖的厂商（默认启用 17 个，备用 6 个默认关闭）

### 默认启用

**国际**: OpenAI · Anthropic · Google Gemini · xAI Grok · Mistral · Cohere · Perplexity

**国产**: DeepSeek · Moonshot Kimi · 阿里通义 Qwen · 智谱 GLM · 字节豆包 · 百度文心 · 腾讯混元 · 讯飞星火 · MiniMax · 零一万物 Yi

### 默认关闭（按需开启）

360 智脑 · OpenRouter 聚合 · SiliconFlow · Midjourney · Suno 音乐 · Sora 视频

---

## 故障排查

### `HTTP 401 Unauthorized`

admin token 失效或不是 admin 角色。回管理后台重新创建一个 role ≥ Admin 的用户的 token。

### `HTTP 400 ... type ... not supported`

YAML 里 `type` 数字不在 `constant/channel.go` 的枚举里。对照源文件改正确。

### `跳过：环境变量 XXX_API_KEY 未设置`

正常 —— 你没填那个厂商的 key 就会跳过。要么填上，要么 `enabled: false`。

### `网络错误`

`--base-url` 不对，或者 DeepRouter 实例没起来。

### 第一次创建成功，但 admin UI 里没看到模型

new-api 创建 channel 时会**自动同步** abilities 表。如果异常，回 admin UI 点 "**重建 abilities**"（路由：`POST /api/channel/fix`）。

### 想完全重来

```bash
# 删掉脚本创建的所有 channel
python3 -c "import yaml,os,urllib.request,json; \
  c=yaml.safe_load(open('channels.yaml')); \
  ..."
```

不提供清空脚本 —— 太危险，请在 admin UI 手动删。

---

## 设计原则

| 决策 | 理由 |
|---|---|
| 用 Python 单文件 + stdlib urllib | 不增加运行时依赖，所有平台开箱即用 |
| YAML 而不是 TOML / JSON | 列表写起来最直观，且支持注释 |
| 按 `name` 幂等 | 避免重复创建；也方便人读 |
| Key 从环境变量读 | 不会误提交 |
| `enabled` 字段而不是 git 注释 | 启用/禁用配置历史可追踪 |
| 不删 channel | 防误删，删除走 admin UI |

---

## 相关文档

- 上游 onboarding 设计：[`docs/onboarding-v2-prd.md`](../../docs/onboarding-v2-prd.md)
- 合规话题（推广前必须）：[`docs/compliance-prd.md`](../../docs/compliance-prd.md)
- Channel 类型枚举：[`constant/channel.go`](../../constant/channel.go)
- 模型定价表：[`setting/ratio_setting/model_ratio.go`](../../setting/ratio_setting/model_ratio.go)
