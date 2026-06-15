# Open Risks

## 2026-06-13 - CC Switch 导入链接硬编码第三方 endpoint 并嵌入完整 token

- 来源：`docs/codex/reviews/2026-06-13_cc-switch-import_main-to-master_review.md`
- 风险等级：中风险 / P2
- 影响范围：令牌管理 CC Switch 导入功能，`POST /api/token/:id/ccswitch/import-link`
- 风险描述：导入链接固定写入 `https://api.xistree.hk/`，同时把用户完整 token key 写入 `apiKey`。对 self-hosted 或非 Xistree 部署，导入后的本地客户端可能把当前部署签发的 token 发往错误的第三方 endpoint。
- 当前状态：未关闭。
- 建议处理：用当前部署 canonical endpoint 生成导入配置；配置缺失时 fail closed；若功能仅限 Xistree 专用部署，增加显式开关和测试覆盖。
- 是否阻塞发布：建议阻塞该功能发布或继续合并，直到部署边界和 endpoint 生成策略明确。

## 2026-06-13 - CC Switch 导入链接 model 字段未执行后端 allowlist 校验

- 来源：`docs/codex/reviews/2026-06-13_cc-switch-import_main-to-master_review.md`
- 风险等级：低风险 / P3
- 影响范围：令牌管理 CC Switch 导入功能，`POST /api/token/:id/ccswitch/import-link`
- 风险描述：`import-options` 返回按用户可用组过滤后的模型列表，但 `import-link` 仅校验主 `model` 非空，未要求请求值来自后端模型 allowlist；Claude alias 字段也会直接进入导入链接。
- 当前状态：未关闭。
- 建议处理：服务端复用模型选项 allowlist；若允许 custom model，明确长度、字符集、别名和枚举策略，并补充负向测试。
- 是否阻塞发布：不单独阻塞，但建议与 P2 问题同批修复。
