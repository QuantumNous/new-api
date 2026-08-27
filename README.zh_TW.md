<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 **新一代大模型閘道與 AI 資產管理系統**

**二次開發版本** —— 基於 [QuantumNous/new-api](https://github.com/QuantumNous/new-api)

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-brightgreen" alt="許可證">
  </a><!--
  --><a href="https://github.com/ChinaToyHunter/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/ChinaToyHunter/new-api?color=brightgreen&include_prereleases" alt="版本">
  </a>
</p>

</div>

## 📝 專案說明

> [!IMPORTANT]
> - 本專案僅面向合法授權的 AI API 閘道、組織內部鑑權、多模型管理、用量統計、成本核算和私有化部署場景。
> - 使用者必須合法取得上游 API Key、帳號、模型服務或介面權限，並遵守上游服務條款及適用法律法規。
> - 使用者應確保其使用方式符合上游服務條款及適用法律法規。
> - 面向公眾提供生成式人工智慧服務時，使用者應遵守適用監管要求，自行完成所在司法轄區要求的備案、許可、內容安全、實名、日誌留存、稅務和上游授權等合規義務。

---

## 🔀 本版本說明

本倉庫是 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 的二次開發版本，跟隨上游 `main`，本文檔只記錄本版本新增或修改的內容。完整的上游功能和使用文檔請參考 [docs.newapi.pro](https://docs.newapi.pro/zh/docs)。

### 📌 Situation｜背景

- 上游錢包額度使用單筆儲值限制（`MaxQuota`，上限為 `math.MaxInt32`）。當 `QuotaPerUnit` 設定為 `500000` 等較高值時，多次儲值、兌換碼和管理員加額可能超過單次 int32 邊界。
- 此時待支付金額可能靜默計算為 `0`，而支付結算、兌換碼和管理員加額路徑此前沒有統一的聚合錢包上限。

### 🎯 Task｜任務

- 在高 `QuotaPerUnit` 場景下保持儲值金額正確，同時不破壞 Epay、Stripe 等既有支付流程。
- 增加所有額度增加路徑共同遵守的聚合錢包上限；發生溢出或超過上限時必須 fail-closed，並相容 SQLite、MySQL、PostgreSQL。

### 🛠️ Action｜行動

- 保留單筆儲值的 int32 限制（`MaxQuota`），新增 int64 聚合上限 `MaxWalletQuota`（等值 $2,000,000），並在 `common/quota_math.go` 集中處理額度換算。
- 支付結算使用原子條件更新；兌換碼和管理員 `add_quota` 操作先檢查錢包餘量，失敗時拒絕寫入而不是發生數值回繞。
- 將 Epay 價格和最低儲值設定歸入 Epay 設定頁，明確其作用範圍。
- 增加二次開發基礎設施：帶校驗和驗證、原子替換的一鍵自更新，Docker 拉取並重建，Compose 映像同步，僅 root 可用的更新 API 與介面，伺服器權威的邀請碼模式，GitHub OAuth 最低帳號年齡，以及按精確 tag 建構的發布 CI。

### 📈 Result｜結果

- `QuotaPerUnit=500000` 時待支付金額可正確計算；任何額度增加都不能超過 `MaxWalletQuota`。
- 額度增加路徑具備溢出保護和並發安全，包括兌換碼並發時只成功一次、支付結算原子執行。
- 已發布 [`v1.0.0-rc.25-th.13`](https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.25-th.13)（合併提交 `ea0ba918`）。

### 🆚 快速對比

| 領域 | 上游（QuantumNous/new-api） | 本版本 |
|---|---|---|
| 錢包容量 | 僅有單筆 int32 限制 | 單筆 int32 + int64 聚合上限（$2,000,000） |
| 高 `QuotaPerUnit` 溢出 | 待支付金額可能靜默變為 0 | 金額正確計算並 fail-closed |
| 兌換碼 / 管理員加額 | 沒有統一聚合上限 | 原子錢包餘量檢查 |
| Epay 設定 | 通用設定位置 | 收歸 Epay 設定頁 |
| 自更新 | 手動升級 | 校驗和驗證的一鍵更新、Docker 重建、Compose 同步 |
| 註冊邀請碼 | 單一全域開關 | 可選 / 必填 / 隱藏 |
| 版本號 | 上游 tag | `v{upstream}-th.{x}` 二次開發版本線 |

### 🏷️ 版本發布

本版本使用 `v{upstream}-th.{x}` 版本線，發布於 [Releases](https://github.com/ChinaToyHunter/new-api/releases)。目前版本：[`v1.0.0-rc.25-th.13`](https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.25-th.13)。

---

## 📜 許可證

本專案採用 [GNU Affero 通用公共許可證 v3.0 (AGPLv3)](./LICENSE) 授權。

根據 AGPLv3 第 7 節的附加條款，修改版本必須在適當的法律聲明以及使用者介面展示的顯著關於、法律、頁腳或署名位置保留作者署名：`Frontend design and development by New API contributors.`。

包含使用者介面的修改版本還必須保留指向原專案的可見連結：<https://github.com/QuantumNous/new-api>。

本專案是在 [One API](https://github.com/songquanpeng/one-api)（MIT 許可證）的基礎上進行二次開發的開源專案。

如果您所在的組織政策不允許使用 AGPLv3 許可的軟體，或您希望規避 AGPLv3 的開源義務，請發送郵件至：[support@quantumnous.com](mailto:support@quantumnous.com)

---

## 🌟 Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=QuantumNous/new-api,ChinaToyHunter/new-api&type=Date)](https://star-history.com/#QuantumNous/new-api&ChinaToyHunter/new-api&Date)

</div>

如果本版本對你有幫助，歡迎為 ⭐️ [ChinaToyHunter/new-api](https://github.com/ChinaToyHunter/new-api) 點 Star；如果你直接使用上游專案，也歡迎為 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 點 Star。

---

<div align="center">

### 💖 感謝使用 New API

<sub>Built with ❤️ by QuantumNous</sub>

<sub>二次開發維護：<a href="https://github.com/ChinaToyHunter">ChinaToyHunter</a></sub>

</div>
