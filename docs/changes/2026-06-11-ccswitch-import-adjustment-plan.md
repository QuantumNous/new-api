# CC Switch 导入搜索与表逻辑调整执行计划

## Summary

- 429 的直接原因是“导入 CC Switch”模型搜索频繁请求 `/api/token/:id/ccswitch/models`，命中项目默认 `SearchRateLimit`。
- 修复方向是不放宽限流，而是让导入弹窗一次获取导入专用模型缓存，后续搜索全部前端本地筛选。
- 完成后写变更记录到 `docs/changes/2026-06-11-ccswitch-import-adjustment.md`。

## Key Changes

- 移除 `GET /api/token/:id/ccswitch/models` 路由、Controller、前端 API 调用。
- 扩展 `GET /api/token/:id/ccswitch/import-options`，一次返回 token 信息、默认应用、默认模型、targets、当前用户可用模型列表。
- `POST /api/token/:id/ccswitch/import-link` 不再写偏好/审计表；CC Switch 参数 `name` 固定为 `Xistree`。
- 维护 `service` 内的 CC Switch 专用内存缓存，只供导入功能使用；启动后刷新一次，之后每个整点刷新一次。
- 缓存包含模型名称、添加时间、渠道商/供应商名称；内部保留可用分组用于按用户过滤。
- 缓存排序为渠道分组，组内按模型添加时间倒序，组间按每组最新模型时间倒序，平局按渠道名稳定排序。
- 默认模型从同一份用户可用模型数据中选：优先 OpenAI/Anthropic 中添加时间最新者，同时间优先 OpenAI；否则选全量最新；无可用模型时保留 `gpt-5.5`。
- 只移除旧表代码使用和 AutoMigrate 注册，不自动 `DROP TABLE`。
- 默认前端和经典前端都改为打开弹窗时只请求一次 `import-options`，输入搜索时只过滤内存数据。
- “应用”默认 Codex；“名称”改为“令牌名称”；不展示单独“供应商名称”；令牌名称/API Key 区域去掉单独框线，改为与下方设置项一致的浅底色信息块。
- 所有逻辑修改完成后，对“导入 CC Switch”弹窗做一次 UI 调衡：只优化该弹窗内部的视觉层级、间距、底色、控件排列和模型选择体验，让默认前端与经典前端都更符合大众审美；不借此重做令牌管理其它页面，不改变导入流程和后端语义。

## Tests

- 后端：`gofmt`；`go test ./service`；`go test ./controller`；`go test ./...`。
- 默认前端：`bun run typecheck`；`bun run lint`；`bun run build:check`；`bun run format:check`；`bun run i18n:sync`。
- 经典前端：`bun run lint`；`bun run build`；`bun run i18n:sync`。
- 回归检查：用 `rg` 确认运行时代码不再引用旧表和 `/ccswitch/models`；浏览器验证弹窗多次搜索不再发起模型搜索请求。

## Assumptions

- 不做破坏性数据库删除；旧表若已存在，仅作为遗留空表或旧数据留在数据库中。
- 只更新活跃维护文档和本次变更记录；历史需求/demo 归档若仍提到旧表，在新变更记录中标注为已废弃，不作为当前实现依据。
- 保留当前 Codex/Claude Code 导入能力；本次只把默认应用固定为 Codex，并移除持久化偏好。
