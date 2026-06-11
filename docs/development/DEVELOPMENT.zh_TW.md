# 開發指南

<p align="center">
  <a href="./DEVELOPMENT.zh_CN.md">简体中文</a> |
  <strong>繁體中文</strong> |
  <a href="./DEVELOPMENT.md">English</a> |
  <a href="./DEVELOPMENT.fr.md">Français</a> |
  <a href="./DEVELOPMENT.ja.md">日本語</a>
</p>

本文件面向開發者，說明如何在本地運行和開發 new-api 項目。

## 環境要求

- **Go**: 1.22+ (項目使用 1.25.1)
- **Bun**: 前端套件管理器 (優先使用，而非 npm/yarn)
- **Database**: SQLite (預設) / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6
- **Docker** (可選): 用於容器化開發環境

## 快速開始

### 方式一：本地開發 (推薦)

> **前置條件**: 由於 Go 使用 `//go:embed` 嵌入前端檔案，首次啟動前必須先構建一次前端，否則會報錯。

#### 1. 首次設置

```bash
# 構建前端 (生成 dist 目錄以避免 go:embed 錯誤)
cd web/default
bun install
bun run build
cd ../..

```

#### 2. 啟動後端

```bash
# 安裝 Go 依賴
go mod download

# 啟動後端服務 (使用 SQLite)
go run main.go
```

後端預設運行在 `http://localhost:3000`，數據儲存在 `one-api.db`

#### 3. 啟動前端

```bash
# 進入前端目錄
cd web/default

# 安裝依賴
bun install

# 啟動開發伺服器
bun run dev
```

前端開發伺服器運行在 `http://localhost:5173`，會自動代理後端請求到 3000 埠。

### 方式二：使用 Makefile

```bash
# 同時啟動後端和前端 (Docker + 前端開發伺服器)
make dev

# 僅啟動後端 (Docker Compose)
make dev-api

# 僅啟動前端
make dev-web

# 啟動經典版前端
make dev-web-classic
```

## 前端開發

### 可用命令

在 `web/default/` 目錄下：

```bash
bun run dev          # 啟動開發伺服器 (http://localhost:5173)
bun run build        # 生產環境構建
bun run preview      # 預覽生產構建
bun run typecheck    # TypeScript 類型檢查
bun run lint         # ESLint 代碼檢查
bun run format       # Prettier 代碼格式化
bun run format:check # 檢查代碼格式
bun run i18n:sync    # 同步國際化翻譯
```

### 技術棧

- **React 19** + **TypeScript**
- **Rsbuild** - 構建工具
- **Base UI** - 組件庫
- **Tailwind CSS** - 樣式
- **TanStack Router** - 路由
- **TanStack Query** - 數據獲取
- **i18next** - 國際化 (支援 en/zh/fr/ru/ja/vi)

### 國際化開發

翻譯檔案位於 `web/default/src/i18n/locales/{lang}.json`。新增或修改翻譯後，運行：

```bash
bun run i18n:sync
```

## 後端開發

### 數據庫配置

#### SQLite (預設)

無需配置，直接運行 `go run main.go`。

#### MySQL

```bash
# 設置環境變數
export SQL_DSN="root:password@tcp(localhost:3306)/newapi"

# 啟動後端
go run main.go
```

#### PostgreSQL (Docker 開發環境)

```bash
# 使用 docker-compose.dev.yml 啟動
make dev-api
```

### 項目結構

```
.
├── router/        # HTTP 路由
├── controller/    # 請求處理器
├── service/       # 業務邏輯
├── model/         # 數據模型 (GORM)
├── relay/         # AI API 中繼/代理
│   └── channel/   # 供應商特定適配器 (openai/, claude/, gemini/, etc.)
├── middleware/    # 中間件 (認證、限流、CORS 等)
├── setting/       # 配置管理
├── common/        # 工具函數
├── dto/           # 數據傳輸物件
├── constant/      # 常量定義
├── i18n/          # 後端國際化 (en/zh)
└── web/           # 前端項目
    ├── default/   # 預設前端 (React 19)
    └── classic/   # 經典版前端 (React 18)
```

### 開發規範

詳見 [CLAUDE.md](../../CLAUDE.md)，重點：

1. **JSON 操作**: 必須使用 `common/json.go` 中的包裝函數
2. **數據庫兼容性**: 代碼必須兼容 SQLite/MySQL/PostgreSQL
3. **套件管理器**: 前端優先使用 Bun

## 構建生產版本

```bash
# 構建前端
make build-all-frontends

# 構建後端
go build -o new-api main.go

# 或使用 Docker
docker build -t new-api .
```

## 調試工具

### 重置設置嚮導

```bash
make reset-setup
```

此命令會清除數據庫中的設置和管理員帳號，用於重新測試初始化嚮導。

## 常見問題

### go:embed 錯誤: no matching files found

**問題**: 後端啟動報錯 `pattern web/*/dist: no matching files found`

**原因**: `main.go` 使用 `//go:embed` 在編譯時嵌入前端檔案，如果 `dist` 目錄不存在會報錯。

**解決方案**:
```bash
# 先構建前端生成 dist
cd web/default && bun install && bun run build && cd ../..


# 啟動後端
go run main.go
```

### 埠衝突

- 後端預設埠: 3000
- 前端開發伺服器: 5173
- 經典版前端: 5174

**問題**: 前端啟動顯示 `Port 3000 is occupied`

**原因**: Rsbuild 預設嘗試使用 3000 埠，但被後端佔用。

**解決方案**: 已在 `rsbuild.config.ts` 中配置 `port: 5173`，直接運行 `bun run dev` 即可。

### 數據庫遷移

GORM 會自動執行遷移。首次運行時所有表會自動創建。

### 前端代理配置

前端開發伺服器已配置代理，API 請求會自動轉發到後端 `http://localhost:3000`。

## 相關文件

- [項目規範 (CLAUDE.md)](../../CLAUDE.md)
- [用戶文件](https://docs.newapi.pro/en/docs)
- [API 文件](https://docs.newapi.pro/en/docs/api)

## 貢獻指南

歡迎貢獻！提交 PR 前請確保：

1. 代碼通過 lint 檢查
2. 遵循項目規範 (見 CLAUDE.md)
3. 測試通過
4. 清晰的 commit 訊息

---

**技術支援**: [support@quantumnous.com](mailto:support@quantumnous.com)
