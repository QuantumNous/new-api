# ⚠️ 提交说明 / PR Notice
> [!IMPORTANT]
>
> - 请提供**人工撰写**的简洁摘要，避免直接粘贴未经整理的 AI 输出。
> - 提交前请先对照 `AGENTS.md`、`docs/ai/AI_TASK_TEMPLATE.md` 和 `docs/ai/AI_CHANGE_CHECKLIST.md` 自检。

## 📝 本次任务模板摘要 / Task Summary
- 任务目标：
- 成功标准：
- 本次明确不做什么：
- 影响模块：

## 🧭 遵循的项目规则 / Applied Rules
- 本次重点遵循的规则：
- 对应的 `KISS / YAGNI / DRY / SOLID` 落地说明：

## 📝 变更描述 / Description
(简述：做了什么？为什么这样改能生效？请基于你对代码逻辑的理解来写，避免粘贴未经整理的内容)

## 🚀 变更类型 / Type of change
- [ ] 🐛 Bug 修复 (Bug fix) - *请关联对应 Issue，避免将设计取舍、理解偏差或预期不一致直接归类为 bug*
- [ ] ✨ 新功能 (New feature) - *重大特性建议先通过 Issue 沟通*
- [ ] ⚡ 性能优化 / 重构 (Refactor)
- [ ] 📝 文档更新 (Documentation)

## 🔗 关联任务 / Related Issue
- Closes # (如有)

## 🧪 验证命令与结果 / Verification
- 执行命令：
- 关键结果：
- 手动验证：

## 🧩 影响面标记 / Impact Flags
- [ ] 涉及 SQLite / MySQL / PostgreSQL 兼容性
- [ ] 涉及 Relay / DTO 显式零值语义
- [ ] 涉及前端用户可见文案或 i18n
- [ ] 涉及 Docker / Compose / `.env.example`
- [ ] 涉及 upstream 同步

## ✅ 提交前检查项 / Checklist
- [ ] **人工确认:** 我已亲自整理并撰写此描述，没有直接粘贴未经处理的 AI 输出。
- [ ] **任务摘要:** 我已按仓库任务模板整理目标、范围、不做什么和验证方式。
- [ ] **规则遵循:** 我已阅读并遵守 `AGENTS.md`、`AI_TASK_TEMPLATE.md` 与 `AI_CHANGE_CHECKLIST.md`。
- [ ] **非重复提交:** 我已搜索现有的 [Issues](https://github.com/QuantumNous/new-api/issues) 与 [PRs](https://github.com/QuantumNous/new-api/pulls)，确认不是重复提交。
- [ ] **Bug fix 说明:** 若此 PR 标记为 `Bug fix`，我已提交或关联对应 Issue，且不会将设计取舍、预期不一致或理解偏差直接归类为 bug。
- [ ] **变更理解:** 我已理解这些更改的工作原理及可能影响。
- [ ] **范围聚焦:** 本 PR 未包含任何与当前任务无关的代码改动。
- [ ] **本地验证:** 已在本地运行并通过测试或手动验证，维护者可以据此复核结果。
- [ ] **编码规范:** 所有新增 / 修改文件均为 UTF-8（无 BOM）。
- [ ] **安全合规:** 代码中无敏感凭据，且符合项目代码规范。

## 📸 运行证明 / Proof of Work
(请在此粘贴截图、关键日志或测试报告，以证明变更生效)
