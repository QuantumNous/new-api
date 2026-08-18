# Prompt Gallery（GPT 图像提示词图库）设计

日期：2026-08-18
状态：已与用户逐节确认

## 背景与目标

把 [ZeroLu/awesome-gpt-image](https://github.com/ZeroLu/awesome-gpt-image)（GPT Image 2 提示词精选集，约 70 个案例）搬到 flatkey（new-api），以**公开只读 API** 的形式对外提供「提示词 + 示例图」数据，供前端（flatkey 官网，由其他人接入，不在本设计范围内）请求展示。

## 范围决策（澄清结论）

- 消费方：官网灵感图库页；**官网页面本身不做**，只交付 API。
- 数据获取：一次性搬运 + 脚本可重跑（幂等），不做定时自动同步。
- 图片托管：自家 GCS 公共读 bucket；bucket 名作为脚本参数，**后端不引入 GCS SDK**。
- 接口层：Go 后端（new-api 主服务）提供 API。
- 存储：数据库表（GORM AutoMigrate）。
- 管理：控制台管理后台 CRUD（仅 `web/default` 新主题）。
- 内容量：上游全量搬运（不做版权/肖像预筛）。
- 灌库方式：脚本 → JSON → AdminAuth 批量导入接口（按 slug upsert），不直连 DB。

## 1. 数据模型（Go / GORM）

新表 `prompt_gallery_items`，模型文件仿 `model/custom_oauth_provider.go` 模式，加入 `model/main.go` 的 AutoMigrate 列表：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int PK 自增 | |
| `slug` | varchar(128) uniqueIndex not null | 稳定标识，upsert 键（如 `rice-grain-micro-typography`） |
| `title` | varchar(256) not null | 案例标题（英文原题） |
| `category` | varchar(64) index | 上游 8 分类之一：`photography` / `gaming` / `ui-ux` / `video-animation` / `typography-poster` / `infographic` / `character-consistency` / `image-editing` |
| `prompt` | text not null | 提示词原文 |
| `prompt_en` | text | 英文翻译（原文为中文时才有，可空） |
| `comment` | text | 上游点评（可空） |
| `image_url` | varchar(512) not null | 示例图完整绝对 URL（指向 GCS）。DB 只存 URL、不感知存储位置——这是脚本与后端的边界 |
| `source_author` | varchar(128) | 原作者（如 `@adonis_singh`） |
| `source_urls` | text | 出处链接，JSON 数组字符串。上游内容许可要求署名，API 原样返回该字段即满足 |
| `enabled` | bool default true | 下架不删数据 |
| `sort_order` | int default 0 | 脚本按 README 原序编号，后台可调 |
| `created_at` / `updated_at` | | GORM 常规时间戳 |

列表默认排序：`sort_order ASC, id ASC`。

## 2. API 设计

响应统一用仓库现有 `{success, message, data}` 包裹。

### 公开只读（匿名，走现有全局限流）

- `GET /api/prompt-gallery` — 分页列表。参数：`category`（可选）、`page`（默认 1）、`page_size`（默认 20，上限 100）、`keyword`（可选，匹配 title/prompt）。仅返回 `enabled=true` 条目。`data` 为 `{list, total, page, page_size}`。
- `GET /api/prompt-gallery/categories` — 分类列表及各分类数量（仅统计 enabled）。
- `GET /api/prompt-gallery/item/:slug` — 单条详情。detail 挂在 `/item/` 下是刻意设计，避免与同级静态路由（`categories`、`admin`）产生 gin 路由通配冲突。

### 管理端（`/api/prompt-gallery/admin` 分组，`middleware.AdminAuth()`，仿 custom-oauth-provider 分组写法）

- `GET /` — 全量列表（含 disabled），支持与公开列表相同的筛选参数。
- `POST /` — 新建单条。
- `PUT /:id` — 更新单条。
- `DELETE /:id` — 删除单条。
- `POST /import` — 批量导入。body：`{items: [...]}`；**按 slug upsert**；返回 `{created, updated, failed: [{slug, reason}]}`；单条校验失败记入 failed，不中断整批。

## 3. 搬运脚本

位置：`scripts/prompt-gallery-import/`，Python 3 单文件 + requests（与上游仓库自身脚本风格一致）。

流程：

1. 拉取上游 `README.md`（raw），按 `##` 分类 / `###` 案例结构解析出约 70 个条目：标题、图片 src、` ```text ` prompt 代码块、English Translation、Comment、Source 链接（作者 + URL 列表）。
2. 下载示例图（多数在 `pbs.twimg.com` X CDN，少数为 GitHub attachments 或仓库内 `assets/` 相对路径）→ 上传 GCS：`gs://<bucket>/prompt-gallery/<slug>.<ext>`，设 `Cache-Control: public, max-age=31536000`；对象已存在则跳过，`--force` 强制覆盖。上传通过子进程调用 `gcloud storage cp`（复用操作者本机 gcloud 认证，脚本不引入 google-cloud-storage 依赖）。
3. 产出 `items.json`（结构与导入接口 body 对齐，可先人工过目）→ 调 `POST /api/prompt-gallery/admin/import` 灌库。

参数（CLI/env）：`--api-base`、`--token`（admin token）、`--bucket`、`--dry-run`（只产 JSON，不上传不导入）。整条链路幂等可重跑。

约定：

- 对比图案例（GPT Image 1.5 vs 2 两张图）只取 GPT Image 2 那张。
- slug 由标题 slugify 生成（小写、连字符），冲突时追加序号。
- GCS bucket 需公共读（复用现有静态资源桶或新建均可），脚本只拿名字当参数。
- 脚本目录 README 注明数据来源仓库与许可，条目级署名靠 `source_author`/`source_urls` 字段保留。

## 4. 管理后台 UI

仅 `web/default` 新主题。仿 `features/redemption-codes` 结构新建 `features/prompt-gallery/`（`api.ts` / `types.ts` / `components/` / `index.tsx`），路由挂 `routes/_authenticated/` 下，admin 角色可见。

功能：

- 缩略图列表：分类筛选、关键词搜索、分页。
- 启用/停用开关（对应 `enabled`）。
- 编辑/新建弹窗：全字段表单；`image_url` 为普通文本输入框（手动新增条目时自行传图后贴 URL）。
- 删除（带确认）。
- `sort_order` 调整（表单字段即可，不做拖拽）。
- i18n 中英文案跟现有模式。

不做：classic 老主题；UI 内批量导入按钮（脚本已覆盖）；图片直传/GCS 集成。

## 5. 错误处理与测试

- 导入接口校验：slug 格式（`^[a-z0-9-]+$`）、必填字段（slug/title/prompt/image_url/category）；单条失败记入 `failed` 不炸整批。
- 脚本：单图下载/上传失败跳过该条并在汇总中报告，不中断。
- Go 测试：model 层 CRUD 与 import upsert 逻辑、controller 层公开接口的 enabled 过滤与分页（沿用仓库现有 sqlite 内存库测试模式）。
- 前端：跟随 `web/default` 现有 lint/typecheck/build 门槛。
- 发布：先 23.173.152.247 验证环境按 PR 起实例验证，不直接动生产。

## 非目标（Out of Scope）

- 官网图库页面（由其他人基于本 API 接入）。
- 上游定时自动同步。
- classic 主题管理界面。
- 后端 GCS SDK 集成 / 图片直传。
- 多语言 prompt 翻译（仅保留上游已有的英文翻译字段）。
