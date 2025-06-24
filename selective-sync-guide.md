# 选择性同步指南

从development分支同步功能代码到main分支，避免同步开发辅助文件的完整方法。

## 🎯 核心问题

在development分支开发时会产生两类文件：
- **功能代码文件**：需要同步到main分支的业务逻辑代码
- **开发辅助文件**：只在开发时使用，不应该进入main分支

## 🛠️ 解决方案

### 方法一：使用智能同步脚本（推荐）

我已经创建了 `smart-sync.sh` 脚本，可以自动识别和过滤文件：

```bash
# 预览将要同步的文件
./smart-sync.sh preview

# 执行智能同步
./smart-sync.sh sync
```

**脚本特点**：
- ✅ 自动识别功能代码文件（.go, .js, .json等）
- 🚫 自动过滤开发辅助文件（dev.sh, .env.local等）
- ❓ 交互式确认不确定的文件
- 📋 详细的同步报告

### 方法二：使用Git Pathspec过滤

```bash
# 1. 创建临时功能分支
git checkout main
git checkout -b feature-temp

# 2. 只同步特定类型的文件
git checkout development -- '*.go' '*.js' '*.json'
git checkout development -- 'controller/' 'relay/' 'model/'

# 3. 排除开发文件
git reset HEAD -- '*dev*' '*.local' '*.sh'
git checkout -- '*dev*' '*.local' '*.sh'

# 4. 提交并合并
git add .
git commit -m "feat: 同步功能代码"
git checkout main
git merge feature-temp --no-ff
git branch -D feature-temp
```

### 方法三：使用.gitattributes和filter

创建 `.gitattributes` 文件来标记开发文件：

```bash
# 在development分支创建.gitattributes
cat > .gitattributes << 'EOF'
# 开发辅助文件标记
*.local filter=dev-only
*dev* filter=dev-only
docker-compose.dev.yml filter=dev-only
.air.toml filter=dev-only
Dockerfile.dev filter=dev-only
EOF
```

### 方法四：分离提交策略

在development分支开发时，将功能代码和开发文件分开提交：

```bash
# 在development分支
# 1. 只提交功能代码
git add controller/ relay/ model/ *.go
git commit -m "feat: 添加CustomPass功能"

# 2. 单独提交开发文件
git add dev.sh .env.local docker-compose.dev.yml
git commit -m "dev: 添加开发辅助工具"

# 3. 同步时只cherry-pick功能提交
git checkout main
git cherry-pick <功能提交的hash>
```

## 📋 开发辅助文件清单

以下文件类型通常不应该同步到main分支：

### 🚫 绝对不同步的文件
```
.env.local          # 本地环境变量
.air.toml          # 热重载配置
*dev.sh            # 开发脚本
docker-compose.dev.yml  # 开发Docker配置
Dockerfile.dev     # 开发Dockerfile
makefile           # 开发用构建文件
new-api            # 编译后的二进制文件
```

### 📚 文档文件（需要判断）
```
DEV_README.md      # 开发文档（不同步）
LOCAL_BUILD_README.md  # 本地构建说明（不同步）
test_*.md          # 测试文档（不同步）
API_*.md           # API文档（可能需要同步）
```

### ✅ 通常需要同步的文件
```
*.go               # Go源代码
*.js               # JavaScript代码
*.json             # 配置文件（非本地）
controller/        # 控制器代码
relay/             # 中继代码
model/             # 模型代码
web/src/           # 前端源代码
```

## 🔧 实际操作示例

### 场景：您在development分支完成了CustomPass功能开发

1. **查看当前更改**：
   ```bash
   git checkout development
   git diff --name-only main development
   ```

2. **使用智能同步脚本**：
   ```bash
   ./smart-sync.sh preview  # 预览分类结果
   ./smart-sync.sh sync     # 执行同步
   ```

3. **手动方法**：
   ```bash
   # 创建功能分支
   git checkout main
   git checkout -b custompass-feature
   
   # 只同步功能相关文件
   git checkout development -- relay/channel/task/custompass/
   git checkout development -- controller/task.go
   git checkout development -- controller/relay.go
   # ... 其他功能文件
   
   # 提交并合并
   git add .
   git commit -m "feat: 添加CustomPass自定义透传功能"
   git checkout main
   git merge custompass-feature --no-ff
   git branch -D custompass-feature
   ```

## ⚠️ 注意事项

1. **始终预览**：同步前先预览要同步的文件
2. **分类明确**：明确区分功能代码和开发辅助文件
3. **测试验证**：同步后在main分支测试功能是否正常
4. **保持记录**：记录同步了哪些文件，便于后续维护

## 🎯 最佳实践

1. **开发时分离关注点**：
   - 功能代码放在标准目录（controller/, relay/, model/）
   - 开发工具放在根目录或dev/目录

2. **提交时分类**：
   - 功能提交：只包含业务逻辑代码
   - 开发提交：只包含开发辅助文件

3. **定期同步**：
   - 功能稳定后及时同步到main分支
   - 避免development分支与main分支差异过大

4. **使用工具**：
   - 优先使用智能同步脚本
   - 复杂情况下使用手动方法
