# AI 二开 Git 工作流

> 适用于当前仓库的长期二开与官方同步协作。

这样做符合 `KISS` 和 `YAGNI`，直接收益是所有人都按一套最小但完整的分支模型工作，不需要引入更重的 Git Flow。

## 1. 角色定义

- `origin`：你们自己的仓库 / 当前实际开发仓库
- `upstream`：官方仓库，只用于同步官方更新
- `main`：你们自己的稳定主线，承接官方同步结果和已完成的二开功能
- `feature/*`：业务开发分支
- `sync/*`：同步官方更新的临时分支

## 2. 固定规则

1. 不直接在 `main` 上开发
2. 所有需求改动在 `feature/*` 上完成
3. 所有官方同步在 `sync/*` 上完成
4. `sync/*` 不允许夹带业务功能改动
5. 最终都通过 PR 合并回 `main`

## 3. 日常开发流程

### 3.1 新功能 / 修复

```bash
git checkout main
git pull origin main
git checkout -b feature/<task-name>
```

开发前先让 AI 阅读：

1. `AGENTS.md`
2. `docs/ai/AI_TASK_TEMPLATE.md`
3. `docs/ai/AI_CHANGE_CHECKLIST.md`

开发完成后：

```bash
git add .
git commit -m "feat: 用中文写清楚本次任务摘要"
git push origin feature/<task-name>
```

然后发 PR：

- 来源分支：`feature/<task-name>`
- 目标分支：`main`

### 3.2 功能分支开发中遇到主线更新

```bash
git checkout main
git pull origin main
git checkout feature/<task-name>
git merge main
```

这样做符合 `KISS`，直接收益是让功能分支站在最新主线上继续开发，减少最后合并时的大冲突。

## 4. 同步官方流程

### 4.1 获取官方更新

```bash
git fetch upstream
git fetch origin
```

### 4.2 创建同步分支

```bash
git checkout main
git pull origin main
git checkout -b sync/upstream-YYYY-MM-DD
```

### 4.3 合并官方更新

```bash
git merge upstream/main
```

如果有冲突，只在 `sync/*` 分支里解决。

### 4.4 验证后提交

```bash
git add .
git commit -m "sync: 合并 upstream/main 到本地主线"
git push origin sync/upstream-YYYY-MM-DD
```

然后发 PR：

- 来源分支：`sync/upstream-YYYY-MM-DD`
- 目标分支：`main`

## 5. 给 AI 的固定任务入口

建议每次都这样开头：

```md
请先阅读：
1. AGENTS.md
2. docs/ai/AI_TASK_TEMPLATE.md
3. docs/ai/AI_CHANGE_CHECKLIST.md
4. docs/ai/UPSTREAM_SYNC_RULES.md（如果本次是同步官方）

然后先按 AI_TASK_TEMPLATE 输出：
- 任务目标
- 成功标准
- 本次不做什么
- 影响模块
- 验证方式
- 需遵守的规则

确认后再开始改代码。
```

## 6. 合并前必须满足

- 本地 hooks 已启用
- `AI Guard` 和 `PR Check` 通过
- PR 模板填写完整
- 没有在 `main` 直接开发
- 同步官方的改动与业务改动分离
