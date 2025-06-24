# 分支管理策略

本项目采用三分支管理策略，每个分支有不同的用途和管理方式。

## 分支结构

```
main (主分支)
├── development (开发分支)
└── custom (定制分支)
```

## 分支说明

### 1. main分支 - 发布版本
- **用途**: 存放干净的、用于发布的代码
- **特点**: 
  - 代码稳定，可直接用于生产环境
  - 不包含开发工具和调试文件
  - 与上游保持同步
- **操作**: 
  - 接收上游更新
  - 合并经过测试的功能

### 2. development分支 - 开发调试
- **用途**: 本地开发和调试main分支代码
- **特点**:
  - 包含大量开发辅助文件和工具
  - 包含调试配置和脚本
  - 不用于发布，仅本地使用
- **包含文件**:
  - 开发脚本: `dev.sh`, `build-and-run.sh`, `simple-dev.sh`
  - 配置文件: `.air.toml`, `.env.local`, `docker-compose.dev.yml`
  - 开发文档: `DEV_README.md`, `LOCAL_BUILD_README.md`
  - 测试文件: `test_*.md`

### 3. custom分支 - 定制版本
- **用途**: 基于main分支的特殊定制版本，用于自用
- **特点**:
  - 基于main分支进行功能定制
  - 需要与main分支保持同步
  - 包含自用的特殊功能

## 工作流程

### 日常开发流程

1. **开发新功能时**:
   ```bash
   # 切换到development分支进行开发
   git checkout development
   # 进行开发和调试
   # 测试完成后，将功能代码合并到main分支
   ```

2. **更新main分支**:
   ```bash
   # 切换到main分支
   git checkout main
   # 拉取上游更新
   git pull origin main
   # 或者从development分支合并稳定功能
   git merge development --no-ff
   ```

3. **同步custom分支**:
   ```bash
   # 当main分支有更新时，同步到custom分支
   git checkout custom
   git merge main --no-ff
   # 解决可能的冲突
   # 继续进行定制开发
   ```

## 详细同步策略

### 1. 从development分支同步功能到main分支

#### 问题场景
在development分支开发时，会创建很多开发辅助文件（如.env.local, dev.sh等），但只需要将功能代码同步到main分支。

#### 解决方案

**方法一：使用功能分支（推荐）**
```bash
# 1. 基于main分支创建临时功能分支
git checkout main
git checkout -b feature-temp

# 2. 手动复制development分支的功能代码
# 比较差异，选择需要的文件
git diff main development --name-only

# 3. 手动复制功能相关文件，避免开发辅助文件
cp path/to/feature/file.go .
# 或使用IDE进行选择性复制

# 4. 提交功能代码
git add .
git commit -m "feat: 添加新功能"

# 5. 合并到main分支
git checkout main
git merge feature-temp --no-ff

# 6. 删除临时分支
git branch -D feature-temp
```

**方法二：使用cherry-pick**
```bash
# 1. 查看development分支的提交
git log --oneline main..development

# 2. 切换到main分支
git checkout main

# 3. 选择性cherry-pick功能相关的提交
git cherry-pick <commit-hash>

# 注意：这种方法适用于提交比较干净的情况
```

**方法三：使用patch文件**
```bash
# 1. 在development分支创建patch
git checkout development
git diff main > feature.patch

# 2. 切换到main分支应用patch
git checkout main
git apply feature.patch

# 3. 手动编辑，移除不需要的开发文件更改
# 4. 提交更改
git add .
git commit -m "feat: 应用功能更新"
```

### 2. 从main分支同步更新到custom分支

#### 问题场景
main分支有上游更新或新功能时，需要同步到custom分支，同时保持custom分支的定制功能。

#### 解决方案

**标准合并流程**
```bash
# 1. 确保main分支是最新的
git checkout main
git pull origin main

# 2. 切换到custom分支
git checkout custom

# 3. 合并main分支更新
git merge main --no-ff

# 4. 如果有冲突，解决冲突
# 编辑冲突文件，保留custom分支的定制功能
git add .
git commit -m "resolve: 解决合并冲突，保持定制功能"
```

**处理复杂冲突的策略**
```bash
# 如果冲突太多，可以使用rebase
git checkout custom
git rebase main

# 或者使用merge策略
git merge main -X ours    # 优先使用custom分支的更改
git merge main -X theirs  # 优先使用main分支的更改
```

### 分支同步策略

#### main分支更新后同步到custom分支
```bash
# 1. 确保main分支是最新的
git checkout main
git pull origin main

# 2. 切换到custom分支并合并main的更新
git checkout custom
git merge main

# 3. 如果有冲突，解决冲突后提交
git add .
git commit -m "sync: 同步main分支更新"
```

#### 从development分支提取功能到main分支
```bash
# 1. 切换到main分支
git checkout main

# 2. 选择性合并development分支的特定提交
git cherry-pick <commit-hash>

# 或者创建临时分支进行功能提取
git checkout -b feature-extract development
# 移除开发工具文件，只保留功能代码
# 然后合并到main分支
```

## 注意事项

1. **development分支**:
   - 不要推送到远程仓库（包含敏感的本地配置）
   - 定期清理不需要的开发文件
   - 只用于本地开发和调试

2. **custom分支**:
   - 定期与main分支同步，避免分歧过大
   - 记录定制的功能，便于冲突解决
   - 可以推送到私有远程仓库备份

3. **main分支**:
   - 保持代码干净和稳定
   - 定期与上游同步
   - 所有合并都应该经过测试

## 常用命令

```bash
# 查看所有分支
git branch -a

# 查看分支差异
git diff main..custom
git diff main..development

# 查看分支提交历史
git log --oneline --graph --all

# 切换分支
git checkout main|development|custom

# 合并分支（保留合并历史）
git merge <branch-name> --no-ff

# 选择性合并提交
git cherry-pick <commit-hash>
```

## 备份策略

建议为custom分支创建远程备份：
```bash
# 添加私有远程仓库
git remote add custom-backup <your-private-repo-url>

# 推送custom分支到备份仓库
git push custom-backup custom
```
