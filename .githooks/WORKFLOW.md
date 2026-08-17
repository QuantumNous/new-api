# .wt 分支目录工作隔离规范

## 原则
所有开发/子代理改动必须在 `.wt/<编号>-<分支名>` worktree 中进行，根目录工作树不被修改污染。防止多 agent 共享工作区时的重叠冲突（Epic #185 事故：另一 agent 分支被 checkout，spec 值被覆盖导致 sub-issue 挂错 parent）。

## 流程

### 1. 创建 worktree
```bash
cd ~/projects/omenic
git fetch origin main
git worktree add .wt/<issue编号>-<分支名> -b <分支名> origin/main
```

示例：`git worktree add .wt/198-gate-hardening -b gate-hardening-198 origin/main`

### 2. 在 worktree 内开发
- `cd .wt/<issue编号>-<分支名>`
- 所有编辑、构建、测试都在此目录
- 根目录工作树不执行任何命令（避免影响其他 agent）

### 3. 提交并推送
```bash
cd .wt/<issue编号>-<分支名>
git add -A && git commit -m "..."
git push -u origin <分支名>
```

### 4. 完成后清理
```bash
cd ~/projects/omenic
git worktree remove .wt/<issue编号>-<分支名>
```

## 命名规范
- 目录：`.wt/<issue编号>-<短分支名>`（如 `.wt/198-gate-hardening`）
- 分支：`<type>/<描述>-<issue编号>`（如 `feat/gate-hardening-198`）
- type: feat / fix / chore / docs / refactor

## 检查
- 开发前：`git worktree list` 确认当前 worktree
- 完成后：根目录 `git status` 应保持干净（除用户自己的改动）
- 子代理任务：brief 中必须指定 worktree 路径，禁止在根目录操作

## 例外
- 根目录操作仅限：worktree 创建/移除、fetch、PR 操作
- 紧急修复已合并 main 的热点问题可直接在根目录，但需确认无其他 agent 活跃