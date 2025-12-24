<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 **次世代大規模モデルゲートウェイとAI資産管理システム**

<p align="center">
  <a href="./README.md">中文</a> | 
  <a href="./README.en.md">English</a> | 
  <a href="./README.fr.md">Français</a> | 
  <strong>日本語</strong>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/Calcium-Ion/new-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/Calcium-Ion/new-api?color=brightgreen" alt="license">
  </a>
  <a href="https://github.com/Calcium-Ion/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/Calcium-Ion/new-api?color=brightgreen&include_prereleases" alt="release">
  </a>
  <a href="https://github.com/users/Calcium-Ion/packages/container/package/new-api">
    <img src="https://img.shields.io/badge/docker-ghcr.io-blue" alt="docker">
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
</p>

<p align="center">
  <a href="#-クイックスタート">クイックスタート</a> •
  <a href="#-主な機能">主な機能</a> •
  <a href="#-デプロイ">デプロイ</a> •
  <a href="#-ドキュメント">ドキュメント</a> •
  <a href="#-ヘルプサポート">ヘルプ</a>
</p>

</div>

## 📝 プロジェクト説明

> [!NOTE]  
> 本プロジェクトは、[One API](https://github.com/songquanpeng/one-api)をベースに二次開発されたオープンソースプロジェクトです

> [!IMPORTANT]  
> - 本プロジェクトは個人学習用のみであり、安定性の保証や技術サポートは提供しません。
> - ユーザーは、OpenAIの[利用規約](https://openai.com/policies/terms-of-use)および**法律法規**を遵守する必要があり、違法な目的で使用してはいけません。
> - [《生成式人工智能服务管理暂行办法》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)の要求に従い、中国地域の公衆に未登録の生成式AI サービスを提供しないでください。

---

## 🤝 信頼できるパートナー

<p align="center">
  <em>順不同</em>
</p>

<p align="center">
  <a href="https://www.cherry-ai.com/" target="_blank">
    <img src="./docs/images/cherry-studio.png" alt="Cherry Studio" height="80" />
  </a>
  <a href="https://bda.pku.edu.cn/" target="_blank">
    <img src="./docs/images/pku.png" alt="北京大学" height="80" />
  </a>
  <a href="https://www.compshare.cn/?ytag=GPU_yy_gh_newapi" target="_blank">
    <img src="./docs/images/ucloud.png" alt="UCloud 優刻得" height="80" />
  </a>
  <a href="https://www.aliyun.com/" target="_blank">
    <img src="./docs/images/aliyun.png" alt="Alibaba Cloud" height="80" />
  </a>
  <a href="https://io.net/" target="_blank">
    <img src="./docs/images/io-net.png" alt="IO.NET" height="80" />
  </a>
</p>

---

## 🙏 特別な感謝

<p align="center">
  <a href="https://www.jetbrains.com/?from=new-api" target="_blank">
    <img src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.png" alt="JetBrains Logo" width="120" />
  </a>
</p>

<p align="center">
  <strong>感謝 <a href="https://www.jetbrains.com/?from=new-api">JetBrains</a> が本プロジェクトに無料のオープンソース開発ライセンスを提供してくれたことに感謝します</strong>
</p>

---

## 🚀 クイックスタート

### Docker Composeを使用（推奨）

```bash
# プロジェクトをクローン
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# docker-compose.yml 設定を編集
nano docker-compose.yml

# サービスを起動
docker-compose up -d
```

<details>
<summary><strong>Dockerコマンドを使用</strong></summary>

```bash
# 最新のイメージをプル
docker pull calciumion/new-api:latest

# SQLiteを使用（デフォルト）
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest

# MySQLを使用
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

> **💡 ヒント:** `-v ./data:/data` は現在のディレクトリの `data` フォルダにデータを保存します。絶対パスに変更することもできます：`-v /your/custom/path:/data`

</details>

---

🎉 デプロイが完了したら、`http://localhost:3000` にアクセスして使用を開始してください！

📖 その他のデプロイ方法については[デプロイガイド](https://docs.newapi.pro/ja/docs/installation)を参照してください。

---

## 📚 ドキュメント

<div align="center">

### 📖 [公式ドキュメント](https://docs.newapi.pro/ja/docs) | [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QuantumNous/new-api)

</div>

**クイックナビゲーション:**

| カテゴリ | リンク |
|------|------|
| 🚀 デプロイガイド | [インストールドキュメント](https://docs.newapi.pro/ja/docs/installation) |
| ⚙️ 環境設定 | [環境変数](https://docs.newapi.pro/ja/docs/installation/config-maintenance/environment-variables) |
| 📡 APIドキュメント | [APIドキュメント](https://docs.newapi.pro/ja/docs/api) |
| ❓ よくある質問 | [FAQ](https://docs.newapi.pro/ja/docs/support/faq) |
| 💬 コミュニティ交流 | [交流チャネル](https://docs.newapi.pro/ja/docs/support/community-interaction) |

---

## ✨ 主な機能

> 詳細な機能については[機能説明](https://docs.newapi.pro/ja/docs/guide/wiki/basic-concepts/features-introduction)を参照してください。

### 🎨 コア機能

| 機能 | 説明 |
|------|------|
| 🎨 新しいUI | モダンなユーザーインターフェースデザイン |
| 🌍 多言語 | 中国語、英語、フランス語、日本語をサポート |
| 🔄 データ互換性 | オリジナルのOne APIデータベースと完全に互換性あり |
| 📈 データダッシュボード | ビジュアルコンソールと統計分析 |
| 🔒 権限管理 | トークングループ化、モデル制限、ユーザー管理 |

### 💰 支払いと課金

- ✅ オンライン充電（EPay、Stripe）
- ✅ モデルの従量課金
- ✅ キャッシュ課金サポート（OpenAI、Azure、DeepSeek、Claude、Qwenなどすべてのサポートされているモデル）
- ✅ 柔軟な課金ポリシー設定

### 🔐 認証とセキュリティ

- 🤖 LinuxDO認証ログイン
- 📱 Telegram認証ログイン
- 🔑 OIDC統一認証



### 🚀 高度な機能

**APIフォーマットサポート:**
- ⚡ [OpenAI Responses](https://docs.newapi.pro/ja/docs/api/ai-model/chat/openai/create-response)
- ⚡ [OpenAI Realtime API](https://docs.newapi.pro/ja/docs/api/ai-model/realtime/create-realtime-session)（Azureを含む）
- ⚡ [Claude Messages](https://docs.newapi.pro/ja/docs/api/ai-model/chat/create-message)
- ⚡ [Google Gemini](https://doc.newapi.pro/ja/api/google-gemini-chat)
- 🔄 [Rerankモデル](https://docs.newapi.pro/ja/docs/api/ai-model/rerank/create-rerank)
- ⚡ [OpenAI Realtime API](https://docs.newapi.pro/ja/docs/api/ai-model/realtime/create-realtime-session)
- ⚡ [Claude Messages](https://docs.newapi.pro/ja/docs/api/ai-model/chat/create-message)
- ⚡ [Google Gemini](https://doc.newapi.pro/ja/api/google-gemini-chat)
- 🔄 [Rerankモデル](https://docs.newapi.pro/ja/docs/api/ai-model/rerank/create-rerank)（Cohere、Jina）

**インテリジェントルーティング:**
- ⚖️ チャネル重み付けランダム
- 🔄 失敗自動リトライ
- 🚦 ユーザーレベルモデルレート制限

**フォーマット変換:**
- 🔄 OpenAI ⇄ Claude Messages
- 🔄 OpenAI ⇄ Gemini Chat
- 🔄 思考からコンテンツへの機能

**Reasoning Effort サポート:**

<details>
<summary>詳細設定を表示</summary>

**OpenAIシリーズモデル:**
- `o3-mini-high` - 高思考努力
- `o3-mini-medium` - 中思考努力
- `o3-mini-low` - 低思考努力
- `gpt-5-high` - 高思考努力
- `gpt-5-medium` - 中思考努力
- `gpt-5-low` - 低思考努力

**Claude思考モデル:**
- `claude-3-7-sonnet-20250219-thinking` - 思考モードを有効にする

**Google Geminiシリーズモデル:**
- `gemini-2.5-flash-thinking` - 思考モードを有効にする
- `gemini-2.5-flash-nothinking` - 思考モードを無効にする
- `gemini-2.5-pro-thinking` - 思考モードを有効にする
- `gemini-2.5-pro-thinking-128` - 思考モードを有効にし、思考予算を128トークンに設定する
- Gemini モデル名の末尾に `-low` / `-medium` / `-high` を付けることで推論強度を直接指定できます（追加の思考予算サフィックスは不要です）。

</details>

---

## 🤖 モデルサポート

> 詳細については[APIドキュメント - 中継インターフェース](https://docs.newapi.pro/ja/docs/api)

| モデルタイプ | 説明 | ドキュメント |
|---------|------|------|
| 🤖 OpenAI GPTs | gpt-4-gizmo-* シリーズ | - |
| 🎨 Midjourney-Proxy | [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy) | [ドキュメント](https://doc.newapi.pro/ja/api/midjourney-proxy-image) |
| 🎵 Suno-API | [Suno API](https://github.com/Suno-API/Suno-API) | [ドキュメント](https://doc.newapi.pro/ja/api/suno-music) |
| 🔄 Rerank | Cohere、Jina | [ドキュメント](https://docs.newapi.pro/ja/docs/api/ai-model/rerank/create-rerank) |
| 💬 Claude | Messagesフォーマット | [ドキュメント](https://docs.newapi.pro/ja/docs/api/ai-model/chat/create-message) |
| 🌐 Gemini | Google Geminiフォーマット | [ドキュメント](https://doc.newapi.pro/ja/api/google-gemini-chat) |
| 🔧 Dify | ChatFlowモード | - |
| 🎯 カスタム | 完全な呼び出しアドレスの入力をサポート | - |

### 📡 サポートされているインターフェース

<details>
<summary>完全なインターフェースリストを表示</summary>

- [チャットインターフェース (Chat Completions)](https://docs.newapi.pro/ja/docs/api/ai-model/chat/openai/create-chat-completion)
- [レスポンスインターフェース (Responses)](https://docs.newapi.pro/ja/docs/api/ai-model/chat/openai/create-response)
- [イメージインターフェース (Image)](https://docs.newapi.pro/ja/docs/api/ai-model/images/openai/v1-images-generations--post)
- [オーディオインターフェース (Audio)](https://docs.newapi.pro/ja/docs/api/ai-model/audio/openai/create-transcription)
- [ビデオインターフェース (Video)](https://docs.newapi.pro/ja/docs/api/ai-model/videos/create-video-generation)
- [エンベッドインターフェース (Embeddings)](https://docs.newapi.pro/ja/docs/api/ai-model/embeddings/create-embedding)
- [再ランク付けインターフェース (Rerank)](https://docs.newapi.pro/ja/docs/api/ai-model/rerank/create-rerank)
- [リアルタイム対話インターフェース (Realtime)](https://docs.newapi.pro/ja/docs/api/ai-model/realtime/create-realtime-session)
- [Claudeチャット](https://docs.newapi.pro/ja/docs/api/ai-model/chat/create-message)
- [Google Geminiチャット](https://doc.newapi.pro/ja/api/google-gemini-chat)

</details>

---

## 🚢 デプロイ

> [!TIP]
> **最新のDockerイメージ:** `calciumion/new-api:latest`

### 📋 デプロイ要件

| コンポーネント | 要件 |
|------|------|
| **ローカルデータベース** | SQLite（Dockerは `/data` ディレクトリをマウントする必要があります）|
| **リモートデータベース** | MySQL ≥ 5.7.8 または PostgreSQL ≥ 9.6 |
| **コンテナエンジン** | Docker / Docker Compose |

### ⚙️ 環境変数設定

<details>
<summary>一般的な環境変数設定</summary>

| 変数名 | 説明 | デフォルト値 |
|--------|------|--------|
| `SESSION_SECRET` | セッションシークレット（マルチマシンデプロイに必須） | - |
| `CRYPTO_SECRET` | 暗号化シークレット（Redisに必須） | - |
| `SQL_DSN** | データベース接続文字列 | - |
| `REDIS_CONN_STRING` | Redis接続文字列 | - |
| `STREAMING_TIMEOUT` | ストリーミング応答のタイムアウト時間（秒） | `300` |
| `STREAM_SCANNER_MAX_BUFFER_MB` | ストリームスキャナの1行あたりバッファ上限（MB）。4K画像など巨大なbase64 `data:` ペイロードを扱う場合は値を増加させてください | `64` |
| `MAX_REQUEST_BODY_MB` | リクエストボディ最大サイズ（MB、**解凍後**に計測。巨大リクエスト/zip bomb によるメモリ枯渇を防止）。超過時は `413` | `32` |
| `AZURE_DEFAULT_API_VERSION` | Azure APIバージョン | `2025-04-01-preview` |
| `ERROR_LOG_ENABLED` | エラーログスイッチ | `false` |

📖 **完全な設定:** [環境変数ドキュメント](https://docs.newapi.pro/ja/docs/installation/config-maintenance/environment-variables)

</details>

### 🔧 デプロイ方法

<details>
<summary><strong>方法 1: Docker Compose（推奨）</strong></summary>

```bash
# プロジェクトをクローン
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# 設定を編集
nano docker-compose.yml

# サービスを起動
docker-compose up -d
```

</details>

<details>
<summary><strong>方法 2: Dockerコマンド</strong></summary>

**SQLiteを使用:**
```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

**MySQLを使用:**
```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

> **💡 パス説明:** 
> - `./data:/data` - 相対パス、データは現在のディレクトリのdataフォルダに保存されます
> - 絶対パスを使用することもできます：`/your/custom/path:/data`

</details>

<details>
<summary><strong>方法 3: 宝塔パネル</strong></summary>

1. 宝塔パネル（**9.2.0バージョン**以上）をインストールし、アプリケーションストアで**New-API**を検索してインストールします。

📖 [画像付きチュートリアル](./docs/BT.md)

</details>

### ⚠️ マルチマシンデプロイの注意事項

> [!WARNING]
> - **必ず設定する必要があります** `SESSION_SECRET` - そうしないとマルチマシンデプロイ時にログイン状態が不一致になります
> - **共有Redisは必ず設定する必要があります** `CRYPTO_SECRET` - そうしないとデータを復号化できません

### 🔄 チャネルリトライとキャッシュ

**リトライ設定:** `設定 → 運営設定 → 一般設定 → 失敗リトライ回数`

**キャッシュ設定:**
- `REDIS_CONN_STRING`：Redisキャッシュ（推奨）
- `MEMORY_CACHE_ENABLED`：メモリキャッシュ

---

## 🔗 関連プロジェクト

### 上流プロジェクト

| プロジェクト | 説明 |
|------|------|
| [One API](https://github.com/songquanpeng/one-api) | オリジナルプロジェクトベース |
| [Midjourney-Proxy](https://github.com/novicezk/midjourney-proxy) | Midjourneyインターフェースサポート |

### 補助ツール

| プロジェクト | 説明 |
|------|------|
| [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool) | キー使用量クォータ照会ツール |
| [new-api-horizon](https://github.com/Calcium-Ion/new-api-horizon) | New API高性能最適化版 |

---

## 💬 ヘルプサポート

### 📖 ドキュメントリソース

| リソース | リンク |
|------|------|
| 📘 よくある質問 | [FAQ](https://docs.newapi.pro/ja/docs/support/faq) |
| 💬 コミュニティ交流 | [交流チャネル](https://docs.newapi.pro/ja/docs/support/community-interaction) |
| 🐛 問題のフィードバック | [問題フィードバック](https://docs.newapi.pro/ja/docs/support/feedback-issues) |
| 📚 完全なドキュメント | [公式ドキュメント](https://docs.newapi.pro/ja/docs) |

### 🤝 貢献ガイド

あらゆる形の貢献を歓迎します！

- 🐛 バグを報告する
- 💡 新しい機能を提案する
- 📝 ドキュメントを改善する
- 🔧 コードを提出する

---

## 🌟 スター履歴

<div align="center">

[![スター履歴チャート](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)

</div>

---

<div align="center">

### 💖 New APIをご利用いただきありがとうございます

このプロジェクトがあなたのお役に立てたなら、ぜひ ⭐️ スターをください！

**[公式ドキュメント](https://docs.newapi.pro/ja/docs)** • **[問題フィードバック](https://github.com/Calcium-Ion/new-api/issues)** • **[最新リリース](https://github.com/Calcium-Ion/new-api/releases)**

<sub>❤️ で構築された QuantumNous</sub>

</div>
