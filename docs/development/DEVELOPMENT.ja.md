# 開発ガイド

<p align="center">
  <a href="./DEVELOPMENT.zh_CN.md">简体中文</a> |
  <a href="./DEVELOPMENT.zh_TW.md">繁體中文</a> |
  <a href="./DEVELOPMENT.md">English</a> |
  <a href="./DEVELOPMENT.fr.md">Français</a> |
  <strong>日本語</strong>
</p>

このドキュメントは、開発者向けに new-api プロジェクトをローカルで実行・開発する方法を説明します。

## 必要な環境

- **Go**: 1.22+ (プロジェクトは 1.25.1 を使用)
- **Bun**: フロントエンドパッケージマネージャー (npm/yarn より優先)
- **Database**: SQLite (デフォルト) / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6
- **Docker** (オプション): コンテナ化された開発環境用

## クイックスタート

### 方法1: ローカル開発 (推奨)

> **前提条件**: Go は `//go:embed` を使用してフロントエンドファイルを埋め込むため、初回起動前に一度フロントエンドをビルドする必要があります。そうしないとエラーが発生します。

#### 1. 初回セットアップ

```bash
# フロントエンドをビルド (go:embed エラーを避けるため dist ディレクトリを生成)
cd web/default
bun install
bun run build
cd ../..

```

#### 2. バックエンドの起動

```bash
# Go の依存関係をインストール
go mod download

# バックエンドサービスを起動 (SQLite を使用)
go run main.go
```

バックエンドはデフォルトで `http://localhost:3000` で実行され、データは `one-api.db` に保存されます

#### 3. フロントエンドの起動

```bash
# フロントエンドディレクトリに移動
cd web/default

# 依存関係をインストール
bun install

# 開発サーバーを起動
bun run dev
```

フロントエンド開発サーバーは `http://localhost:5173` で実行され、バックエンドリクエストをポート 3000 に自動的にプロキシします。

### 方法2: Makefile の使用

```bash
# バックエンドとフロントエンドを同時に起動 (Docker + フロントエンド開発サーバー)
make dev

# バックエンドのみ起動 (Docker Compose)
make dev-api

# フロントエンドのみ起動
make dev-web

# クラシックフロントエンドを起動
make dev-web-classic
```

## フロントエンド開発

### 利用可能なコマンド

`web/default/` ディレクトリ内:

```bash
bun run dev          # 開発サーバーを起動 (http://localhost:5173)
bun run build        # プロダクションビルド
bun run preview      # プロダクションビルドをプレビュー
bun run typecheck    # TypeScript 型チェック
bun run lint         # ESLint コードチェック
bun run format       # Prettier コードフォーマット
bun run format:check # コードフォーマットをチェック
bun run i18n:sync    # 国際化翻訳を同期
```

### 技術スタック

- **React 19** + **TypeScript**
- **Rsbuild** - ビルドツール
- **Base UI** - コンポーネントライブラリ
- **Tailwind CSS** - スタイリング
- **TanStack Router** - ルーティング
- **TanStack Query** - データフェッチング
- **i18next** - 国際化 (en/zh/fr/ru/ja/vi をサポート)

### 国際化開発

翻訳ファイルは `web/default/src/i18n/locales/{lang}.json` にあります。翻訳を追加または修正した後、以下を実行してください:

```bash
bun run i18n:sync
```

## バックエンド開発

### データベース設定

#### SQLite (デフォルト)

設定は不要で、`go run main.go` を実行するだけです。

#### MySQL

```bash
# 環境変数を設定
export SQL_DSN="root:password@tcp(localhost:3306)/newapi"

# バックエンドを起動
go run main.go
```

#### PostgreSQL (Docker 開発環境)

```bash
# docker-compose.dev.yml を使用して起動
make dev-api
```

### プロジェクト構成

```
.
├── router/        # HTTP ルーティング
├── controller/    # リクエストハンドラ
├── service/       # ビジネスロジック
├── model/         # データモデル (GORM)
├── relay/         # AI API リレー/プロキシ
│   └── channel/   # プロバイダー固有のアダプター (openai/, claude/, gemini/, etc.)
├── middleware/    # ミドルウェア (認証、レート制限、CORS など)
├── setting/       # 設定管理
├── common/        # ユーティリティ関数
├── dto/           # データ転送オブジェクト
├── constant/      # 定数定義
├── i18n/          # バックエンド国際化 (en/zh)
└── web/           # フロントエンドプロジェクト
    ├── default/   # デフォルトフロントエンド (React 19)
    └── classic/   # クラシックフロントエンド (React 18)
```

### 開発ガイドライン

詳細は [CLAUDE.md](../../CLAUDE.md) を参照してください。重要なポイント:

1. **JSON 操作**: `common/json.go` のラッパー関数を使用する必要があります
2. **データベース互換性**: コードは SQLite/MySQL/PostgreSQL と互換性がある必要があります
3. **パッケージマネージャー**: フロントエンドは Bun を優先します

## プロダクションバージョンのビルド

```bash
# フロントエンドをビルド
make build-all-frontends

# バックエンドをビルド
go build -o new-api main.go

# または Docker を使用
docker build -t new-api .
```

## デバッグツール

### セットアップウィザードのリセット

```bash
make reset-setup
```

このコマンドは、データベース内の設定と管理者アカウントをクリアし、初期化ウィザードを再テストします。

## よくある問題

### go:embed エラー: no matching files found

**問題**: バックエンド起動時のエラー `pattern web/*/dist: no matching files found`

**原因**: `main.go` は `//go:embed` を使用してコンパイル時にフロントエンドファイルを埋め込みます。`dist` ディレクトリが存在しない場合、エラーが発生します。

**解決策**:
```bash
# まずフロントエンドをビルドして dist を生成
cd web/default && bun install && bun run build && cd ../..


# バックエンドを起動
go run main.go
```

### ポートの競合

- バックエンドのデフォルトポート: 3000
- フロントエンド開発サーバー: 5173
- クラシックフロントエンド: 5174

**問題**: フロントエンド起動時に `Port 3000 is occupied` と表示される

**原因**: Rsbuild はデフォルトでポート 3000 を使用しようとしますが、バックエンドによって占有されています。

**解決策**: `rsbuild.config.ts` で既に `port: 5173` が設定されているため、`bun run dev` を実行するだけです。

### データベースマイグレーション

GORM は自動的にマイグレーションを実行します。初回実行時にすべてのテーブルが自動的に作成されます。

### フロントエンドプロキシ設定

フロントエンド開発サーバーはプロキシが設定されており、API リクエストは自動的にバックエンド `http://localhost:3000` に転送されます。

## 関連ドキュメント

- [プロジェクト規約 (CLAUDE.md)](../../CLAUDE.md)
- [ユーザードキュメント](https://docs.newapi.pro/en/docs)
- [API ドキュメント](https://docs.newapi.pro/en/docs/api)

## 貢献ガイド

貢献を歓迎します! PR を送信する前に、以下を確認してください:

1. コードが lint チェックに合格すること
2. プロジェクト規約に従うこと (CLAUDE.md 参照)
3. テストが合格すること
4. 明確なコミットメッセージ

---

**技術サポート**: [support@quantumnous.com](mailto:support@quantumnous.com)
