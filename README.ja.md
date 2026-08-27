<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 **次世代大規模モデルゲートウェイと AI 資産管理システム**

**二次開発版** — [QuantumNous/new-api](https://github.com/QuantumNous/new-api) をベースにしています

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-brightgreen" alt="ライセンス">
  </a><!--
  --><a href="https://github.com/ChinaToyHunter/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/ChinaToyHunter/new-api?color=brightgreen&include_prereleases" alt="バージョン">
  </a>
</p>

</div>

## 📝 プロジェクト説明

> [!IMPORTANT]
> - 本プロジェクトは、合法的に許可された AI API ゲートウェイ、組織レベルの認証、マルチモデル管理、利用量分析、コスト管理、プライベートデプロイのシナリオのみを対象としています。
> - ユーザーは上流の API キー、アカウント、モデルサービス、インターフェース権限を合法的に取得し、上流の利用規約と適用される法律・規制を遵守する必要があります。
> - 公衆に生成 AI サービスを提供する場合、ユーザーは管轄区域で求められる届出、ライセンス、コンテンツセキュリティ、本人確認、ログ保持、税務、上流認可などの義務を履行してください。

---

## 🔀 本バージョンについて

本リポジトリは [QuantumNous/new-api](https://github.com/QuantumNous/new-api) の二次開発版です。上流の `main` を追従し、本ページではこの fork が追加・変更した機能と修正のみを説明します。上流の完全なドキュメントは [docs.newapi.pro](https://docs.newapi.pro/ja/docs) を参照してください。

### 📌 Situation｜背景

- 上流のウォレットクォータには、チャージごとの制限（`MaxQuota`、上限 `math.MaxInt32`）しかありません。`QuotaPerUnit` を `500000` など高く設定すると、複数回のチャージ、引き換えコード、管理者による加算で単回操作の int32 境界を超える可能性があります。
- その場合、支払額が黙って `0` になる可能性があり、決済、引き換え、管理者加算の各経路に共有のウォレット総量上限がありませんでした。

### 🎯 Task｜タスク

- 高い `QuotaPerUnit` でもチャージ額を正しく保ち、既存の Epay / Stripe 決済フローを壊さない。
- すべてのクレジット経路に共通する厳格なウォレット総量上限を追加し、上限超過やオーバーフロー時は fail-closed とする。SQLite、MySQL、PostgreSQL に対応する。

### 🛠️ Action｜対応

- チャージごとの int32 制限（`MaxQuota`）を維持し、int64 の総量上限 `MaxWalletQuota`（$2,000,000 相当）を追加。クォータ変換は `common/quota_math.go` に集約しました。
- 決済の精算にはアトミックな条件付き更新を使用。引き換えコードと管理者の `add_quota` はウォレットの余裕を確認し、ラップアラウンドせず fail-closed で拒否します。
- Epay の価格と最低チャージ設定を Epay 設定タブに限定しました。
- fork 基盤として、チェックサム検証とアトミック置換を備えたワンクリック更新、Docker の pull-and-recreate、Compose イメージ同期、root 専用の更新 API/UI、サーバー側で制御する登録招待モード、GitHub OAuth の最低アカウント年齢、正確な tag からビルドするリリース CI を追加しました。

### 📈 Result｜結果

- `QuotaPerUnit=500000` でもチャージ額を正しく計算し、いかなるクレジットも `MaxWalletQuota` を超えません。
- クレジット経路はオーバーフローと競合状態から保護されます。引き換えコードの同時実行では 1 回だけ成功し、決済精算はアトミックに実行されます。
- [`v1.0.0-rc.25-th.13`](https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.25-th.13) としてリリース済みです（マージコミット `ea0ba918`）。

### 🆚 簡易比較

| 分野 | 上流（QuantumNous/new-api） | 本 fork |
|---|---|---|
| ウォレット容量 | チャージごとの int32 制限のみ | チャージごとの int32 + int64 総量上限（$2,000,000） |
| 高い `QuotaPerUnit` でのオーバーフロー | 支払額が黙って 0 になる可能性 | 正しい計算と fail-closed ガード |
| 引き換え / 管理者加算 | 共有の総量上限なし | アトミックなウォレット余裕確認 |
| Epay 設定 | 一般設定に配置 | Epay 設定タブに限定 |
| 自動更新 | 手動更新 | チェックサム検証、Docker 再作成、Compose 同期付きワンクリック更新 |
| 登録招待 | 単一のグローバルスイッチ | 任意 / 必須 / 非表示モード |
| バージョン形式 | 上流 tag | `v{upstream}-th.{x}` fork リリースライン |

### 🏷️ fork リリース

本 fork は [Releases](https://github.com/ChinaToyHunter/new-api/releases) で `v{upstream}-th.{x}` のリリースラインを公開しています。現在のリリースは [`v1.0.0-rc.25-th.13`](https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.25-th.13) です。

---

## 📜 ライセンス

このプロジェクトは [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE) の下でライセンスされています。

AGPLv3 セクション 7 の追加条件が適用されます。変更版は、適切な法的通知およびユーザーインターフェースに表示される目立つ概要、法的事項、フッター、帰属表示の場所に、作者の帰属表示 `Frontend design and development by New API contributors.` を保持する必要があります。

ユーザーインターフェースを提供する変更版は、元のプロジェクトへの目に見えるリンク <https://github.com/QuantumNous/new-api> も保持する必要があります。

本プロジェクトは [One API](https://github.com/songquanpeng/one-api)（MIT ライセンス）をベースに開発されたオープンソースプロジェクトです。

組織のポリシーで AGPLv3 ライセンスソフトウェアの使用が許可されていない場合、または AGPLv3 のオープンソース義務を避けたい場合は、[support@quantumnous.com](mailto:support@quantumnous.com) までお問い合わせください。

---

## 🌟 スター履歴

<div align="center">

[![スター履歴チャート](https://api.star-history.com/svg?repos=QuantumNous/new-api,ChinaToyHunter/new-api&type=Date)](https://star-history.com/#QuantumNous/new-api&ChinaToyHunter/new-api&Date)

</div>

この fork が役に立った場合は ⭐️ [ChinaToyHunter/new-api](https://github.com/ChinaToyHunter/new-api) に Star をお願いします。上流を直接利用している場合は [QuantumNous/new-api](https://github.com/QuantumNous/new-api) にも Star をお願いします。

---

<div align="center">

### 💖 New API をご利用いただきありがとうございます

<sub>Built with ❤️ by QuantumNous</sub>

<sub>二次開発メンテナンス：<a href="https://github.com/ChinaToyHunter">ChinaToyHunter</a></sub>

</div>
