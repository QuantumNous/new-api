# Change Index

## 2026-06-13 - 令牌管理 CC Switch 导入功能

- 审查报告：`docs/codex/reviews/2026-06-13_cc-switch-import_main-to-master_review.md`
- 变更范围：`main...master`
- 影响类型：接口、导入配置格式、重要产品行为。
- 相关接口：
  - `GET /api/token/:id/ccswitch/import-options`
  - `POST /api/token/:id/ccswitch/import-link`
- 关键行为：后端生成 CC Switch 深链接，返回可导入的 provider/model/token 配置；前端导入弹窗调用上述接口并跳转到 `ccswitch://` URL。
- 审查结论：需修复后继续。
- 未关闭风险：见 `docs/codex/OPEN_RISKS.md` 中 2026-06-13 两项 CC Switch 导入风险。
