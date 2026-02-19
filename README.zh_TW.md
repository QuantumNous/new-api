<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 **新一代大模型網關與AI資產管理系統**

<p align="center">
  繁體中文 |
  <a href="./README.zh_CN.md">简体中文</a> |
  <a href="./README.md">English</a> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/Calcium-Ion/new-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/Calcium-Ion/new-api?color=brightgreen" alt="license">
  </a>
  <a href="https://github.com/Calcium-Ion/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/Calcium-Ion/new-api?color=brightgreen&include_prereleases" alt="release">
  </a>
  <a href="https://hub.docker.com/r/CalciumIon/new-api">
    <img src="https://img.shields.io/badge/docker-dockerHub-blue" alt="docker">
  </a>
  <a href="https://goreportcard.com/report/github.com/Calcium-Ion/new-api">
    <img src="https://goreportcard.com/badge/github.com/Calcium-Ion/new-api" alt="GoReportCard">
  </a>
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/8227" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/8227" alt="Calcium-Ion%2Fnew-api | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/>
  </a>
  <br>
  <a href="https://hellogithub.com/repository/QuantumNous/new-api" target="_blank">
    <img src="https://api.hellogithub.com/v1/widgets/recommend.svg?rid=539ac4217e69431684ad4a0bab768811&claim_uid=tbFPfKIDHpc4TzR" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54" />
  </a>
  <a href="https://www.producthunt.com/products/new-api/launches/new-api?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-new-api" target="_blank" rel="noopener noreferrer">
    <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1047693&theme=light&t=1769577875005" alt="New API - All-in-one AI asset management gateway. | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" />
  </a>
</p>

<p align="center">
  <a href="#-快速開始">快速開始</a> •
  <a href="#-主要特性">主要特性</a> •
  <a href="#-部署">部署</a> •
  <a href="#-文件">文件</a> •
  <a href="#-幫助支援">幫助</a>
</p>

</div>

## 📝 項目說明

> [!IMPORTANT]
> - 本項目僅供個人學習使用，不保證穩定性，且不提供任何技術支援
> - 使用者必須在遵循 OpenAI 的 [使用條款](https://openai.com/policies/terms-of-use) 以及**法律法規**的情況下使用，不得用於非法用途
> - 根據 [《生成式人工智慧服務管理暫行辦法》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm) 的要求，請勿對中國地區公眾提供一切未經備案的生成式人工智慧服務

---

## 🤝 我們信任的合作伙伴

<p align="center">
  <em>排名不分先後</em>
</p>

<p align="center">
  <a href="https://www.cherry-ai.com/" target="_blank">
    <img src="./docs/images/cherry-studio.png" alt="Cherry Studio" height="80" />
  </a>
  <a href="https://bda.pku.edu.cn/" target="_blank">
    <img src="./docs/images/pku.png" alt="北京大學" height="80" />
  </a>
  <a href="https://www.compshare.cn/?ytag=GPU_yy_gh_newapi" target="_blank">
    <img src="./docs/images/ucloud.png" alt="UCloud 優刻得" height="80" />
  </a>
  <a href="https://www.aliyun.com/" target="_blank">
    <img src="./docs/images/aliyun.png" alt="阿里雲" height="80" />
  </a>
  <a href="https://io.net/" target="_blank">
    <img src="./docs/images/io-net.png" alt="IO.NET" height="80" />
  </a>
</p>

---

## 🙏 特別鳴謝

<p align="center">
  <a href="https://www.jetbrains.com/?from=new-api" target="_blank">
    <img src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.png" alt="JetBrains Logo" width="120" />
  </a>
</p>

<p align="center">
  <strong>感謝 <a href="https://www.jetbrains.com/?from=new-api">JetBrains</a> 為本項目提供免費的開源開發許可證</strong>
</p>

---

## 🚀 快速開始

### 使用 Docker Compose（推薦）

```bash
# 複製項目
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# 編輯 docker-compose.yml 配置
nano docker-compose.yml

# 啟動服務
docker-compose up -d
```

<details>
<summary><strong>使用 Docker 命令</strong></summary>

```bash
# 拉取最新鏡像
docker pull calciumion/new-api:latest

# 使用 SQLite（預設）
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest

# 使用 MySQL
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

> **💡 提示：** `-v ./data:/data` 會將數據保存在當前目錄的 `data` 資料夾中，你也可以改為絕對路徑如 `-v /your/custom/path:/data`

</details>

---

🎉 部署完成後，訪問 `http://localhost:3000` 即可使用！

📖 更多部署方式請參考 [部署指南](https://docs.newapi.pro/zh/docs/installation)

---

## 📚 文件

<div align="center">

### 📖 [官方文件](https://docs.newapi.pro/zh/docs) | [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QuantumNous/new-api)

</div>

**快速導航：**

| 分類 | 連結 |
|------|------|
| 🚀 部署指南 | [安裝文件](https://docs.newapi.pro/zh/docs/installation) |
| ⚙️ 環境配置 | [環境變數](https://docs.newapi.pro/zh/docs/installation/config-maintenance/environment-variables) |
| 📡 接口文件 | [API 文件](https://docs.newapi.pro/zh/docs/api) |
| ❓ 常見問題 | [FAQ](https://docs.newapi.pro/zh/docs/support/faq) |
| 💬 社群交流 | [交流管道](https://docs.newapi.pro/zh/docs/support/community-interaction) |

---

## ✨ 主要特性

> 詳細特性請參考 [特性說明](https://docs.newapi.pro/zh/docs/guide/wiki/basic-concepts/features-introduction)

### 🎨 核心功能

| 特性 | 說明 |
|------|------|
| 🎨 全新 UI | 現代化的用戶界面設計 |
| 🌍 多語言 | 支援簡體中文、繁體中文、英文、法語、日語 |
| 🔄 數據兼容 | 完全兼容原版 One API 資料庫 |
| 📈 數據看板 | 視覺化控制檯與統計分析 |
| 🔒 權限管理 | 令牌分組、模型限制、用戶管理 |

### 💰 支付與計費

- ✅ 在線儲值（易支付、Stripe）
- ✅ 模型按次數收費
- ✅ 快取計費支援（OpenAI、Azure、DeepSeek、Claude、Qwen等所有支援的模型）
- ✅ 靈活的計費策略配置

### 🔐 授權與安全

- 😈 Discord 授權登錄
- 🤖 LinuxDO 授權登錄
- 📱 Telegram 授權登錄
- 🔑 OIDC 統一認證
- 🔍 Key 查詢使用額度（配合 [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool)）

### 🚀 高級功能

**API 格式支援：**
- ⚡ [OpenAI Responses](https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/create-response)
- ⚡ [OpenAI Realtime API](https://docs.newapi.pro/zh/docs/api/ai-model/realtime/create-realtime-session)（含 Azure）
- ⚡ [Claude Messages](https://docs.newapi.pro/zh/docs/api/ai-model/chat/create-message)
- ⚡ [Google Gemini](https://doc.newapi.pro/api/google-gemini-chat)
- 🔄 [Rerank 模型](https://docs.newapi.pro/zh/docs/api/ai-model/rerank/create-rerank)（Cohere、Jina）

**智慧路由：**
- ⚖️ 管道加權隨機
- 🔄 失敗自動重試
- 🚦 用戶級別模型限流

**格式轉換：**
- 🔄 **OpenAI Compatible ⇄ Claude Messages**
- 🔄 **OpenAI Compatible → Google Gemini**
- 🔄 **Google Gemini → OpenAI Compatible** - 僅支援文本，暫不支援函數調用
- 🚧 **OpenAI Compatible ⇄ OpenAI Responses** - 開發中
- 🔄 **思考轉內容功能**

**Reasoning Effort 支援：**

<details>
<summary>查看詳細配置</summary>

**OpenAI 系列模型：**
- `o3-mini-high` - High reasoning effort
- `o3-mini-medium` - Medium reasoning effort
- `o3-mini-low` - Low reasoning effort
- `gpt-5-high` - High reasoning effort
- `gpt-5-medium` - Medium reasoning effort
- `gpt-5-low` - Low reasoning effort

**Claude 思考模型：**
- `claude-3-7-sonnet-20250219-thinking` - 啟用思考模式

**Google Gemini 系列模型：**
- `gemini-2.5-flash-thinking` - 啟用思考模式
- `gemini-2.5-flash-nothinking` - 禁用思考模式
- `gemini-2.5-pro-thinking` - 啟用思考模式
- `gemini-2.5-pro-thinking-128` - 啟用思考模式，並設置思考預算為128tokens
- 也可以直接在 Gemini 模型名稱後追加 `-low` / `-medium` / `-high` 來控制思考力道（無需再設置思考預算後綴）

</details>

---

## 🤖 模型支援

> 詳情請參考 [接口文件 - 中繼接口](https://docs.newapi.pro/zh/docs/api)

| 模型類型 | 說明 | 文件 |
|---------|------|------|
| 🤖 OpenAI-Compatible | OpenAI 兼容模型 | [文件](https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createchatcompletion) |
| 🤖 OpenAI Responses | OpenAI Responses 格式 | [文件](https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createresponse) |
| 🎨 Midjourney-Proxy | [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy) | [文件](https://doc.newapi.pro/api/midjourney-proxy-image) |
| 🎵 Suno-API | [Suno API](https://github.com/Suno-API/Suno-API) | [文件](https://doc.newapi.pro/api/suno-music) |
| 🔄 Rerank | Cohere、Jina | [文件](https://docs.newapi.pro/zh/docs/api/ai-model/rerank/create-rerank) |
| 💬 Claude | Messages 格式 | [文件](https://docs.newapi.pro/zh/docs/api/ai-model/chat/createmessage) |
| 🌐 Gemini | Google Gemini 格式 | [文件](https://docs.newapi.pro/zh/docs/api/ai-model/chat/gemini/geminirelayv1beta) |
| 🔧 Dify | ChatFlow 模式 | - |
| 🎯 自訂 | 支援完整調用位址 | - |

### 📡 支援的接口

<details>
<summary>查看完整接口列表</summary>

- [聊天接口 (Chat Completions)](https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createchatcompletion)
- [響應接口 (Responses)](https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createresponse)
- [圖像接口 (Image)](https://docs.newapi.pro/zh/docs/api/ai-model/images/openai/post-v1-images-generations)
- [音訊接口 (Audio)](https://docs.newapi.pro/zh/docs/api/ai-model/audio/openai/create-transcription)
- [影片接口 (Video)](https://docs.newapi.pro/zh/docs/api/ai-model/audio/openai/createspeech)
- [嵌入接口 (Embeddings)](https://docs.newapi.pro/zh/docs/api/ai-model/embeddings/createembedding)
- [重排序接口 (Rerank)](https://docs.newapi.pro/zh/docs/api/ai-model/rerank/creatererank)
- [即時對話 (Realtime)](https://docs.newapi.pro/zh/docs/api/ai-model/realtime/createrealtimesession)
- [Claude 聊天](https://docs.newapi.pro/zh/docs/api/ai-model/chat/createmessage)
- [Google Gemini 聊天](https://docs.newapi.pro/zh/docs/api/ai-model/chat/gemini/geminirelayv1beta)

</details>

---

## 🚢 部署

> [!TIP]
> **最新版 Docker 鏡像：** `calciumion/new-api:latest`

### 📋 部署要求

| 組件 | 要求 |
|------|------|
| **本地資料庫** | SQLite（Docker 需掛載 `/data` 目錄）|
| **遠端資料庫** | MySQL ≥ 5.7.8 或 PostgreSQL ≥ 9.6 |
| **容器引擎** | Docker / Docker Compose |

### ⚙️ 環境變數配置

<details>
<summary>常用環境變數配置</summary>

| 變數名 | 說明                                                           | 預設值 |
|--------|--------------------------------------------------------------|--------|
| `SESSION_SECRET` | 會話密鑰（多機部署必須）                                                 | - |
| `CRYPTO_SECRET` | 加密密鑰（Redis 必須）                                               | - |
| `SQL_DSN` | 資料庫連接字符串                                                     | - |
| `REDIS_CONN_STRING` | Redis 連接字符串                                                  | - |
| `STREAMING_TIMEOUT` | 流式超時時間（秒）                                                    | `300` |
| `STREAM_SCANNER_MAX_BUFFER_MB` | 流式掃描器單行最大緩衝（MB），圖像生成等超大 `data:` 片段（如 4K 圖片 base64）需適當調大 | `64` |
| `MAX_REQUEST_BODY_MB` | 請求體最大大小（MB，**解壓縮後**計；防止超大請求/zip bomb 導致記憶體暴漲），超過將返回 `413` | `32` |
| `AZURE_DEFAULT_API_VERSION` | Azure API 版本                                                 | `2025-04-01-preview` |
| `ERROR_LOG_ENABLED` | 錯誤日誌開關                                                       | `false` |
| `PYROSCOPE_URL` | Pyroscope 服務位址                                            | - |
| `PYROSCOPE_APP_NAME` | Pyroscope 應用名                                        | `new-api` |
| `PYROSCOPE_BASIC_AUTH_USER` | Pyroscope Basic Auth 用戶名                        | - |
| `PYROSCOPE_BASIC_AUTH_PASSWORD` | Pyroscope Basic Auth 密碼                  | - |
| `PYROSCOPE_MUTEX_RATE` | Pyroscope mutex 採樣率                               | `5` |
| `PYROSCOPE_BLOCK_RATE` | Pyroscope block 採樣率                               | `5` |
| `HOSTNAME` | Pyroscope 標籤裡的主機名                                          | `new-api` |

📖 **完整配置：** [環境變數文件](https://docs.newapi.pro/zh/docs/installation/config-maintenance/environment-variables)

</details>

### 🔧 部署方式

<details>
<summary><strong>方式 1：Docker Compose（推薦）</strong></summary>

```bash
# 複製項目
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# 編輯配置
nano docker-compose.yml

# 啟動服務
docker-compose up -d
```

</details>

<details>
<summary><strong>方式 2：Docker 命令</strong></summary>

**使用 SQLite：**
```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

**使用 MySQL：**
```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

> **💡 路徑說明：**
> - `./data:/data` - 相對路徑，數據保存在當前目錄的 data 資料夾
> - 也可使用絕對路徑，如：`/your/custom/path:/data`

</details>

<details>
<summary><strong>方式 3：寶塔面板</strong></summary>

1. 安裝寶塔面板（≥ 9.2.0 版本）
2. 在應用商店搜尋 **New-API**
3. 一鍵安裝

📖 [圖文教學](./docs/BT.md)

</details>

### ⚠️ 多機部署注意事項

> [!WARNING]
> - **必須設置** `SESSION_SECRET` - 否則登錄狀態不一致
> - **公用 Redis 必須設置** `CRYPTO_SECRET` - 否則數據無法解密

### 🔄 管道重試與快取

**重試配置：** `設置 → 運營設置 → 通用設置 → 失敗重試次數`

**快取配置：**
- `REDIS_CONN_STRING`：Redis 快取（推薦）
- `MEMORY_CACHE_ENABLED`：記憶體快取

---

## 🔗 相關項目

### 上游項目

| 項目 | 說明 |
|------|------|
| [One API](https://github.com/songquanpeng/one-api) | 原版項目基礎 |
| [Midjourney-Proxy](https://github.com/novicezk/midjourney-proxy) | Midjourney 接口支援 |

### 配套工具

| 項目 | 說明 |
|------|------|
| [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool) | Key 額度查詢工具 |
| [new-api-horizon](https://github.com/Calcium-Ion/new-api-horizon) | New API 高性能優化版 |

---

## 💬 幫助支援

### 📖 文件資源

| 資源 | 連結 |
|------|------|
| 📘 常見問題 | [FAQ](https://docs.newapi.pro/zh/docs/support/faq) |
| 💬 社群交流 | [交流管道](https://docs.newapi.pro/zh/docs/support/community-interaction) |
| 🐛 回饋問題 | [問題回饋](https://docs.newapi.pro/zh/docs/support/feedback-issues) |
| 📚 完整文件 | [官方文件](https://docs.newapi.pro/zh/docs) |

### 🤝 貢獻指南

歡迎各種形式的貢獻！

- 🐛 報告 Bug
- 💡 提出新功能
- 📝 改進文件
- 🔧 提交程式碼

---

## 📜 許可證

本項目採用 [GNU Affero 通用公共許可證 v3.0 (AGPLv3)](./LICENSE) 授權。

本項目為開源項目，在 [One API](https://github.com/songquanpeng/one-api)（MIT 許可證）的基礎上進行二次開發。

如果您所在的組織政策不允許使用 AGPLv3 許可的軟體，或您希望規避 AGPLv3 的開源義務，請發送郵件至：[support@quantumnous.com](mailto:support@quantumnous.com)

---

## 🌟 Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)

</div>

---

<div align="center">

### 💖 感謝使用 New API

如果這個項目對你有幫助，歡迎給我們一個 ⭐️ Star！

**[官方文件](https://docs.newapi.pro/zh/docs)** • **[問題回饋](https://github.com/Calcium-Ion/new-api/issues)** • **[最新發布](https://github.com/Calcium-Ion/new-api/releases)**

<sub>Built with ❤️ by QuantumNous</sub>

</div>
