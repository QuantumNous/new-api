# Change: 初始化项目维护文档

## 背景

项目已有 README、安装说明、OpenAPI 和专题文档，但缺少统一的当前结构地图、重要变更索引和单次变更记录入口。此次按 `.agents/PROJECT_DOCS_WORKFLOW.md` 初始化最小可用维护文档。

## 修改目标

- 建立当前项目结构、核心模块和功能入口的快速索引。
- 建立按日期倒序维护的重要变更索引。
- 提供后续由 Codex 自动刷新文档的中文使用说明。
- 只记录本次文档初始化，不虚构业务变更。

## 修改文件

| 文件 | 修改内容 |
|---|---|
| `docs/project-map.md` | 新增目录职责、技术概览、前后端入口、核心调用链和常见维护入口 |
| `docs/change-log.md` | 新增重要变更索引并登记本次初始化 |
| `docs/how-to-read.md` | 新增维护文档阅读与刷新说明 |
| `docs/changes/2026-06-10-docs-bootstrap.md` | 记录本次文档初始化的依据、范围和风险 |

## 行为变化

无运行时行为变化。新增文档只影响开发者和维护者理解项目的方式。

## 保持不变的行为

- 未修改 Go、TypeScript、JavaScript 或配置业务逻辑。
- 未修改 API、数据库结构、认证、计费、Provider 或前端页面行为。
- 未新增或升级依赖。
- 未改动项目名称、品牌、作者、许可证或归属信息。

## 验证方式

- 检查四个维护入口均存在。
- 检查 Markdown 链接和目录引用。
- 使用 `git diff --check` 检查空白错误。
- 使用 `git diff -- docs/project-map.md docs/change-log.md docs/how-to-read.md docs/changes/2026-06-10-docs-bootstrap.md` 审阅实际变更。

## 测试结果

- 四个维护入口均已创建并可读取。
- 相对 Markdown 链接检查通过。
- 文档空白检查通过。
- 本次未运行 Go 或前端构建测试，因为未修改业务代码。

## 风险

- 结构地图是关键入口的摘要，不是全量函数或文件清单。
- 项目持续演进后文档可能过期，需要在重要功能变更后刷新。

## 后续维护入口

- 当前结构：`docs/project-map.md`
- 重要变更索引：`docs/change-log.md`
- 单次变更详情：`docs/changes/`
- 工作流规则：`.agents/PROJECT_DOCS_WORKFLOW.md`

## 待确认

- 本次没有穷举每个 Provider、支付渠道和系统设置子项；后续按真实 Git diff 增量补充。
