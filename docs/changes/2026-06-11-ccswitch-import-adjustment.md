# Change: CC Switch 导入搜索与表逻辑调整

## 背景

“导入 CC Switch”弹窗内模型搜索此前会按输入频繁请求 `GET /api/token/:id/ccswitch/models`。该路由使用共享 `SearchRateLimit`，短时间多次搜索会触发 429，并可能临时影响同一用户的其它搜索接口。

本次调整不放宽限流，而是让导入弹窗打开时一次读取导入所需模型快照，后续搜索全部在前端内存中完成。

## 修改目标

- 移除导入模型搜索接口，避免占用共享搜索限流。
- 新建/维护只供 CC Switch 导入使用的服务内模型缓存。
- 默认应用固定为 Codex，默认模型从同一份用户可用模型数据中选择。
- 停用导入审计表和用户偏好表的代码使用与 AutoMigrate 注册，不自动删除旧数据库表。
- 调整默认前端和经典前端弹窗文案与样式，并对“导入 CC Switch”弹窗做限定范围内的 UI 调衡。

## 修改文件

| 文件 | 修改内容 |
|---|---|
| `router/api-router.go` | 移除 `GET /api/token/:id/ccswitch/models` 路由 |
| `controller/ccswitch_import.go` | 移除旧模型搜索 Controller |
| `dto/ccswitch.go` | `import-options` 增加 `models`，移除 Claude 默认模型偏好字段和旧搜索响应 DTO |
| `service/ccswitch_import.go` | `import-options` 返回默认 Codex、默认模型和模型列表；导入链接供应商名固定为 `Xistree`；不再写偏好/审计 |
| `service/ccswitch_model_cache.go` | 改为导入专用模型缓存：启动刷新、整点刷新、用户组过滤、渠道分组排序、默认模型选择 |
| `model/main.go`、`model/ccswitch_import.go` | 移除旧表 AutoMigrate 注册并删除旧表 Model 文件 |
| `controller/model_meta.go`、`controller/vendor_meta.go` | 移除模型/供应商写操作后对旧导入缓存的即时失效调用，缓存改由启动和整点刷新 |
| `controller/token_test.go`、`service/ccswitch_model_cache_test.go` | 更新测试断言到新缓存、固定供应商名和不写旧表逻辑 |
| `web/default/src/features/keys/` | 默认前端改为只请求一次 `import-options`，本地筛选模型，调整令牌名称/API Key 样式，并优化应用分段选择、模型列表和信息层级 |
| `web/classic/src/components/table/tokens/modals/CCSwitchModal.jsx` | 经典前端同样改为本地筛选模型，默认 Codex，调整文案与样式，并优化弹窗内视觉层级 |
| `web/classic/src/i18n/locales/*.json` | 补充经典前端 `当前令牌` 翻译 |
| `docs/change-log.md`、`docs/project-map.md`、`docs/windows-docker-development.md`、`docs/changes/2026-06-10-ccswitch-token-import.md` | 更新活跃维护文档，并标注旧表逻辑已废弃 |
| `docs/changes/2026-06-11-ccswitch-import-adjustment-plan.md` | 保存执行计划 |

## 行为变化

- 打开“导入 CC Switch”弹窗时只调用一次 `GET /api/token/:id/ccswitch/import-options`。
- 模型搜索不再请求后端，因此不会再因连续输入触发共享搜索限流 429。
- `import-options` 返回当前用户可用模型列表，模型项包含名称、添加时间、渠道商。
- 模型缓存启动时刷新一次，之后按本地时间每个整点刷新；刷新失败保留旧快照。
- 默认模型优先选择 OpenAI/Anthropic 中添加时间最新的模型，同时间优先 OpenAI；没有这两类渠道时选择全量最新；没有模型时使用 `gpt-5.5`。
- 导入到 CC Switch 的供应商名称固定为 `Xistree`，不再使用令牌名称。
- 默认前端和经典前端的导入弹窗视觉更统一：令牌信息使用浅底信息区，应用选择使用分段控件，模型选择区保持浅底和更清晰的选择层级。
- 旧的 `ccswitch_import_logs` 与 `user_ccswitch_preferences` 表不再由当前代码读写或迁移；已存在旧表不自动删除。

## 验证结果

- `git diff --check`：通过。
- classic locale JSON 解析检查：通过。
- 残留运行时代码引用检查：未发现旧表 Model/Service、`/ccswitch/models`、旧搜索 API、旧 Claude 默认模型偏好字段。

## 未验证内容

- `gofmt`、`go test ./service`、`go test ./controller`、`go test ./...` 未能运行：当前环境没有 `go`/`gofmt` 命令。
- 默认前端 `bun run typecheck`、`bun run lint`、`bun run build:check`、`bun run format:check`、`bun run i18n:sync` 未能运行：当前环境没有 `bun`，且本地未安装前端 `node_modules`。
- 经典前端 `bun run lint`、`bun run build`、`bun run i18n:sync` 未能运行：同上。
- 浏览器交互验证未执行：无法启动前端开发服务。

## 风险与维护入口

- Go 代码尚需在安装 Go 工具链的环境运行 `gofmt` 和测试，确认新测试与缓存实现编译通过。
- 前端尚需在安装 Bun 和依赖后运行 default/classic 验证命令。
- 后续若要求模型元数据变更立即反映到导入弹窗，可在模型/供应商写操作后恢复只针对本导入缓存的失效调用；当前实现按用户要求采用启动和整点刷新。
- 维护入口：`service/ccswitch_import.go`、`service/ccswitch_model_cache.go`、`web/default/src/features/keys/components/dialogs/cc-switch-dialog.tsx`、`web/classic/src/components/table/tokens/modals/CCSwitchModal.jsx`。
