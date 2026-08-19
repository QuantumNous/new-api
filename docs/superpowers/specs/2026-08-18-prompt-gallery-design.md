# Prompt Gallery（awesome-gpt-image 并入 prompt-library）设计

日期：2026-08-18（2026-08-19 修订：并入现有 prompt-library，不再新建表）
状态：已与用户确认

## 背景与目标

把 [ZeroLu/awesome-gpt-image](https://github.com/ZeroLu/awesome-gpt-image)（GPT Image 2 提示词精选集，约 70 个案例）搬到 flatkey（new-api），以**公开只读 API** 的形式对外提供「提示词 + 示例图」数据。官网页面由其他人员对接，不在本设计范围。

## 关键修订：复用现有 prompt-library

调研发现 main 已有 `prompt-library` 模块（`model/prompt_library.go`、`controller/prompt_library.go`、`middleware/prompt_library_import_auth.go`）：

- `prompt_library_items` 表已含 slug（唯一）、category、model、prompt、title/summary（多语言 JSON）、tags、artifact（示例图 URL 在 `artifact.url`）、source（作者+出处）等字段，覆盖本需求全部数据。
- `POST /api/prompt-library/import` 批量导入已有：slug upsert、单条失败记 rejected 不中断、`PROMPT_LIBRARY_IMPORT_TOKEN` Bearer 鉴权、单批上限 100 条。
- staging 提交 `270740221` 已实现公开读端点（`GET /api/prompt-library`、`GET /api/prompt-library/:slug`）及测试，但未进 main。

因此**不新建表、不新建导入接口**，工作收敛为四项：

1. 移植 staging 公开读端点进 main（含分页增强）。
2. 表加 `enabled` 字段（下架不删数据）。
3. 新增 AdminAuth 管理 CRUD + `web/default` 管理页。
4. 搬运脚本：解析上游 → 图传 GCS → 转 import 格式灌入。

## 1. 数据模型变更

`PromptLibraryItem`（`model/prompt_library.go`）新增一列：

- `Enabled bool`，gorm tag `default:true`，JSON `enabled`。AutoMigrate 自动加列。

导入 upsert 的 `DoUpdates` 列表**不含** enabled——重跑脚本不会把后台手动下架的条目复活；新插入行走默认值 true。

查询函数：

- `ListPromptLibraryItems(category, keyword string, enabledOnly bool, startIdx, num int) ([]PromptLibraryItem, int64, error)` — 替换 staging 版签名，增加 keyword（LIKE 匹配 prompt/title_json）、enabledOnly、分页与 total。排序 `updated_time DESC, id DESC`。
- `GetPromptLibraryItemBySlug(slug string)` — 照搬 staging 版；公开端点上层过滤 enabled。
- `GetPromptLibraryItemById(id int)`、`(*PromptLibraryItem) Update()`、`DeletePromptLibraryItemById(id int)`、`CreatePromptLibraryItem(*PromptLibraryItem)` — 管理端用。

## 2. API 设计

响应统一 `{success, message, data}`。路由组 `/api/prompt-library`（gin 1.9.1 下 `/admin` 静态子组与 `/:slug` 参数路由可共存，已用探针测试验证）。

### 公开只读（匿名，现有全局限流）

- `GET /api/prompt-library` — 分页列表。参数：`category`（可选，白名单校验）、`keyword`（可选）、`p`/`page_size`（走 `common.GetPageQuery`，默认 20、上限 100）。仅返回 enabled。`data` 为 PageInfo（`{page, page_size, total, items}`）。item 结构沿用 staging 的 `promptLibraryPublicItem`（artifact/source/title/summary 解包为 JSON 对象）。
- `GET /api/prompt-library/:slug` — 单条详情，enabled=false 或不存在均返回 404。

### 管理端（`/api/prompt-library/admin` 子组，`middleware.AdminAuth()`）

- `GET /` — 分页列表（含 disabled），同公开列表参数，item 返回原始行（含 id、enabled、各 *JSON 字段原文）。
- `POST /` — 新建单条（字段校验同导入的 normalize 逻辑）。
- `PUT /:id` — 更新单条。
- `DELETE /:id` — 删除单条。

导入接口不动（管理面手工增删改走上述 CRUD；批量走既有 import）。

## 3. 搬运脚本

位置：`scripts/prompt-gallery-import/`，Python 3 单文件 + requests。

流程：

1. 拉上游 `README.md` raw，解析 `##` 分类 / `###` 案例（约 70 条）：标题、图片 src、` ```text ` prompt 块、English Translation、Comment、Source（作者+URL 列表）。
2. 下载示例图（pbs.twimg.com 为主，兼容 GitHub attachments 与仓库内 `assets/` 相对路径）→ `gcloud storage cp` 上传 `gs://<bucket>/prompt-gallery/<slug>.<ext>`（子进程调用，复用本机 gcloud 认证；`Cache-Control: public, max-age=31536000`；已存在跳过，`--force` 覆盖）。
3. 映射为 import 格式并调 `POST /api/prompt-library/import`（每批 ≤100）：
   - `category` = `"image"`（固定）；`model` = `"gpt-image-2"`（固定，满足导入的模型在售校验）
   - `title` = `{"en": 案例标题}`；`summary` = `{"en": Comment}`（有则填）
   - `tags` = `[上游分类 slug]`（photography / gaming / ui-ux / video-animation / typography-poster / infographic / character-consistency / image-editing）
   - `prompt` = prompt 原文（有 English Translation 时附在 output.translation）
   - `artifact` = `{"kind": "image", "url": GCS URL, "alt": 标题}`
   - `source` = `{"label": 作者, "platform": "X" 或 "WeChat" 或 "OpenNana", "url": 首个出处链接, "captured_at": 运行日期}`；多出处并入 output.extra_sources
4. 对比图案例只取 GPT Image 2 那张。slug 由标题 slugify（小写连字符，冲突加序号）。

参数：`--api-base`、`--token`（import token）、`--bucket`、`--dry-run`（只产 items.json 不上传不导入）。幂等可重跑。脚本目录 README 注明数据来源与 CC BY 4.0 许可。

## 4. 管理后台 UI

仅 `web/default`。仿 `features/redemption-codes` 建 `features/prompt-gallery/`（api.ts / types.ts / components/ / index.tsx），路由 `routes/_authenticated/prompt-gallery/index.tsx`（beforeLoad 校验 `role >= ROLE.ADMIN`），sidebar 管理组加入口（icon: Images）。

功能：缩略图列表（分类筛选/关键词搜索/分页）、enabled 开关、新建/编辑弹窗（全字段表单，image URL 为文本框）、删除确认。i18n 走 `i18n:sync` 流程。

不做：classic 主题；UI 批量导入；图片直传。

## 5. 错误处理与测试

- 管理端校验沿用 normalize 逻辑（slug/category/model/prompt/artifact/source 必填与格式）；错误统一 `common.ApiErrorMsg`。
- Go 测试：sqlite 内存库（照 `controller/prompt_library_test.go` 现有 harness）覆盖——enabled 过滤、分页 total、keyword 过滤、admin CRUD、公开端点 404、导入不复活 disabled 条目。
- 脚本：`--dry-run` 产物人工过目；单图失败跳过并汇总报告。
- 前端：`bun run typecheck` + `bun run lint` + `bun test`。
- 发布：23.173.152.247 验证环境按 PR 起实例验证，不直接动生产。

## 非目标

- 官网页面（他人对接，消费本 API）。
- 上游定时自动同步。
- classic 主题管理界面。
- 后端 GCS SDK / 图片直传。
- 修改既有 import 接口行为。
