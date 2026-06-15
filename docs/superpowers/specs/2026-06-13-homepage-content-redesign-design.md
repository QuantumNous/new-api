# 首页内容重构设计 — 泡泡Api（面向终端用户）

- 日期：2026-06-13
- 主题：new-api 默认主题（web/default）首页内容重构
- 状态：设计已与用户确认

## 目标

把首页内容/文案从「面向框架运营者/开发者」改为「面向泡泡Api 的终端用户」，强调使用泡泡Api 的收益。**视觉风格与版式布局不变**，仅替换文案与重心。展示语言：**仅中文**。

## 受众

想使用 AI 大模型的终端用户：开发者、AI 爱好者、使用 Cherry Studio 等客户端的人。

## 泡泡Api 卖点（用户确认：A B C D E 都算）

- A 价格便宜 / 计费透明
- B 模型齐全（国内主流：GLM、DeepSeek、MiniMax、Kimi 等）
- C 稳定快速（可用性 100%）
- D 接入简单（兼容 OpenAI 协议，一键配置客户端）
- E 新人福利（注册送 20 元额度）

## 各区块定稿文案（中文）

### ① Hero
- 角标：一个密钥 · 畅用全网大模型
- 大标题：一个 API 密钥 / 接入所有 AI 大模型
- 副标题：泡泡Api 聚合 GLM、DeepSeek、MiniMax、Kimi 等国内主流大模型，按量计费、价格更省；兼容 OpenAI 协议，几分钟接入 Cherry Studio 等客户端，注册即送 20 元额度。
- 按钮：立即注册 / 查看价格 / 文档（已登录则：进入控制台）
- 「支持的应用」：保留并强化（Cherry Studio、CC Switch…）

### ② Stats
- 100% / 服务可用性
- 20 元 / 新人注册赠送额度
- 7×24 / 全天稳定运行
- 毫秒级 / 响应速度（可调）

### ③ Features（bento 大卡 4 + 小卡 4）
- 大卡：
  1. 模型齐全 —— 一个密钥用遍 GLM/DeepSeek/MiniMax/Kimi 等国内主流模型（配模型 chips）
  2. 价格实惠 —— 按量计费，比直连更省，账单透明
  3. 稳定快速 —— 100% 可用性，低延迟、不掉单
  4. 接入简单 —— 兼容 OpenAI 协议，一键配置常用客户端
- 小卡：新人福利（注册送 20 元）/ 多端支持 / 计费透明 / 社区支持
- 区块标题：为什么选择泡泡Api

### ④ HowItWorks（改为上手步骤）
1 注册领 20 元额度 → 2 获取 API 密钥 → 3 配置到你的应用 → 4 开始调用，按量计费

### ⑤ CTA
立即注册，领取 20 元新人额度

## 实现方式

内容为 i18n 驱动（`t('英文源串')` + 各语言 json）。仅做中文：修改组件内英文源串，并在 `zh.json` 增加对应中文翻译；不更新 en/fr/ru/ja/vi（站点中文展示，其余语言不维护）。

涉及文件：
- `web/default/src/features/home/components/sections/hero.tsx`（角标、标题、副标题、支持应用说明）
- `web/default/src/features/home/components/sections/features.tsx`（大卡/小卡文案；模型 chips 改为国产；区块标题）
- `web/default/src/features/home/constants.ts`（`DEFAULT_STATS` 值；`DEFAULT_FEATURES` 文案）
- `web/default/src/features/home/components/sections/stats.tsx`（沿用 constants，确认渲染）
- `web/default/src/features/home/components/sections/how-it-works.tsx`（改为上手步骤）
- `web/default/src/features/home/components/sections/cta.tsx`（CTA 文案）
- `web/default/src/i18n/locales/zh.json`（新增所有新串的中文）

模型 chips（features 大卡 1）：原 `OpenAI/Claude/Gemini/DeepSeek/Qwen/Llama` → 改为 `GLM/DeepSeek/MiniMax/Kimi/通义千问/豆包`（国产）。

部署：`web/default` 执行 `bun run build` → `GOMAXPROCS=2 go build -p 2` → 重启 dev :3000。遵循防 OOM 规矩（先查 swap/RAM，串行）。

## 假设 / 待确认

- Stats 中「7×24」「毫秒级」为常规服务表述，可调。
- 模型 chips 含「通义千问 / 豆包」为补充示例，若未接入可去掉，只保留用户点名的 GLM/DeepSeek/MiniMax/Kimi。
