# .agents/CHANGE_POLICY.md

> 目标：平衡“记录所有 bug/需求变更”与“控制 token 消耗”。  
> 原则：记录可复用模式和关键决策，不记录流水账；使用索引 + 归档，不用无限长全文。

## 1. 不建议的做法

不要长期维护这些无限增长文件：

```text
docs/codex/ALL_BUGS.md
docs/codex/FULL_CHANGELOG.md
docs/codex/ALL_REQUIREMENTS.md
```

原因：它们会变成 token 黑洞，并且旧信息可能误导 Codex。

## 2. 推荐文件

由 Codex 在项目使用中按需创建：

```text
docs/codex/BUG_INDEX.md       # 只记录有复用价值的 bug 模式
docs/codex/CHANGE_INDEX.md    # 只记录影响产品/接口/数据/权限/架构的变更
docs/codex/DECISIONS.md       # 重要技术/产品决策
docs/codex/OPEN_RISKS.md      # 未关闭风险
docs/codex/archive/           # 旧记录归档
```

## 3. BUG_INDEX.md 格式

```md
# BUG_INDEX.md

| ID | Date | Module | Symptom | Root cause pattern | Fix pattern | Status | Archive |
|---|---|---|---|---|---|---|---|
| BUG-001 | 2026-06-13 | auth | token 过期后死循环 | refresh retry 无上限 | 增加 retry cap | resolved | archive/BUGS_2026-Q2.md |
```

只记录：

- 可能复发的 bug 模式。
- 影响多个模块的根因。
- 安全、权限、交易、数据一致性相关 bug。
- 修复方式对未来有参考价值的 bug。

不记录：一次性文案、小样式、纯拼写、无复用价值的小问题。

## 4. CHANGE_INDEX.md 格式

```md
# CHANGE_INDEX.md

| ID | Date | Area | Change | Reason | Impact | Decision | Archive |
|---|---|---|---|---|---|---|---|
| CHG-001 | 2026-06-13 | payment | refund flow 增加人工审核 | 风控要求 | 影响退款状态机 | accepted | archive/CHANGES_2026-Q2.md |
```

只记录：

- 影响产品行为的需求变更。
- 影响接口、数据、权限、支付、计费的变更。
- 影响后续开发规则的变更。
- 用户明确要求保留的变更。

## 5. 归档规则

- 最近 30 天：可以保留较详细记录。
- 超过 30 天：压缩为索引。
- 超过 90 天：归档到 `docs/codex/archive/`。
- 已关闭风险不要反复提醒，除非同类问题复发。
- `PROJECT_CONTEXT.md` 控制在可快速阅读的长度，过期内容必须删除或归档。

## 6. 任务总结与长期沉淀的区别

每次任务最终都要总结，但不等于都要写入长期文档。

写入长期文档前先判断：

- 未来是否会复用？
- 是否影响架构、接口、数据、权限、支付？
- 是否能减少未来 token 或误判？
- 是否已经被其他文档记录？

答案为否，则只在本次总结中说明。
