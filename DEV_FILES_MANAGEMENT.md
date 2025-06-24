# 开发辅助文件管理系统

## 📋 概述

为了保持main分支的干净和可发布状态，我们创建了一套开发辅助文件管理系统，可以自动检测和清理不应该出现在main分支中的开发文件。

## 🛠️ 组件说明

### 1. 配置文件：`dev-files.conf`
- **作用**：定义哪些文件属于开发辅助文件
- **格式**：简单的文本格式，每行一个文件名或模式
- **支持**：通配符匹配、例外规则
- **维护**：可以随时编辑添加新的文件模式

### 2. 检查脚本：`check-dev-files.sh`
- **作用**：扫描、检查和清理main分支中的开发辅助文件
- **功能**：自动检测、交互式清理、批量移动
- **安全**：移动前会确认，支持回滚

## 📁 文件分类

### 🚫 会被识别为开发辅助文件的类型：

#### 本地配置文件
- `*.local` - 本地环境配置
- `.env.local`, `.env.dev` - 本地环境变量
- `.env.development` - 开发环境配置

#### 开发脚本文件
- `*dev.sh`, `*-dev.sh`, `dev-*.sh` - 开发脚本
- `build-and-run.sh`, `simple-dev.sh` - 构建脚本
- `dev-manager.sh`, `check-env.sh` - 管理脚本

#### 开发配置文件
- `*.dev.*`, `*-dev.*` - 开发配置
- `.air.toml` - 热重载配置
- `Dockerfile.dev` - 开发Docker文件
- `docker-compose.dev.yml` - 开发Docker Compose

#### 构建产物和临时文件
- `*.tmp`, `*.temp`, `*.bak` - 临时文件
- `new-api`, `one-api` - 编译后的二进制文件
- `makefile` - 构建文件

#### 开发文档
- `DEV_*.md`, `*_DEV.md` - 开发文档
- `test_*.md`, `TEST_*.md` - 测试文档
- `LOCAL_BUILD_README.md` - 本地构建说明

#### 同步和管理工具
- `*sync*.sh` - 同步脚本
- `smart-sync.sh`, `sync-branches.sh` - 分支管理工具
- `check-dev-files.sh` - 本检查脚本

### ✅ 例外情况（会保留在main分支）：
- `web/package.json`, `web/package-lock.json` - 前端依赖
- `go.mod`, `go.sum` - Go模块文件
- `README.md`, `LICENSE`, `VERSION` - 项目文档
- `Dockerfile`, `docker-compose.yml` - 生产环境配置

## 🚀 使用方法

### 基本命令

```bash
# 扫描main分支中的开发辅助文件
./check-dev-files.sh scan

# 查看配置文件内容
./check-dev-files.sh config

# 交互式清理模式（推荐）
./check-dev-files.sh interactive

# 自动清理（直接移动到development分支）
./check-dev-files.sh clean

# 显示帮助信息
./check-dev-files.sh help
```

### 典型使用场景

#### 场景1：定期检查main分支
```bash
# 每次准备发布前检查
./check-dev-files.sh scan
```

#### 场景2：发现开发文件后清理
```bash
# 交互式处理（推荐）
./check-dev-files.sh interactive

# 选择选项2自动移动到development分支
```

#### 场景3：添加新的开发文件模式
```bash
# 编辑配置文件
vim dev-files.conf

# 添加新的模式，例如：
echo "my-dev-tool.sh" >> dev-files.conf

# 重新检查
./check-dev-files.sh scan
```

## ⚙️ 配置文件格式

### 基本语法
```bash
# 注释行以 # 开头
# 空行会被忽略

# 精确文件名
filename.txt

# 通配符模式
*.dev
*-dev.*
dev-*

# 例外规则（以 ! 开头）
!important-file.dev
```

### 分类注释
```bash
# === 分类名称 ===
# 用于组织和说明不同类型的文件
```

## 🔧 工作原理

### 检测逻辑
1. **读取配置**：从 `dev-files.conf` 读取文件模式
2. **扫描文件**：遍历main分支的所有文件
3. **模式匹配**：检查每个文件是否匹配开发文件模式
4. **例外处理**：排除标记为例外的文件
5. **结果报告**：显示发现的开发辅助文件

### 清理流程
1. **安全检查**：确认当前在main分支，检查是否有未提交更改
2. **文件收集**：收集所有需要移动的开发辅助文件
3. **临时提交**：创建临时提交保存这些文件
4. **从main删除**：从main分支删除开发辅助文件
5. **移动到development**：将文件恢复到development分支
6. **清理临时提交**：删除临时提交，保持历史干净

## 📊 示例输出

### 扫描结果
```
🔍 扫描main分支中的开发辅助文件...
⚠️  在main分支中发现 3 个开发辅助文件：
  🛠️  dev.sh
  🛠️  .env.local
  🛠️  makefile
```

### 清理过程
```
🚚 将开发辅助文件移动到development分支...
✅ 成功将 3 个开发辅助文件移动到development分支
Main分支文件数: 481
Development分支文件数: 484
```

## 🎯 最佳实践

### 1. 定期检查
- 在合并代码到main分支前运行检查
- 在准备发布前运行检查
- 在同步上游更新后运行检查

### 2. 配置维护
- 发现新的开发文件类型时及时添加到配置
- 定期审查配置文件，移除不再需要的模式
- 为新的文件模式添加清晰的注释说明

### 3. 团队协作
- 将配置文件纳入版本控制（在development分支）
- 团队成员共同维护配置文件
- 建立代码审查流程，确保开发文件不进入main分支

### 4. 安全操作
- 使用交互式模式进行首次清理
- 清理前确保重要文件已备份
- 了解例外规则，避免误删重要文件

## 🔄 与分支管理的集成

这个系统与我们的三分支管理策略完美集成：

1. **main分支**：使用此工具保持干净
2. **development分支**：接收移动过来的开发文件
3. **custom分支**：从干净的main分支同步更新

### 集成工作流
```bash
# 1. 开发完成后检查main分支
./check-dev-files.sh scan

# 2. 如有开发文件，清理到development分支
./check-dev-files.sh clean

# 3. 同步干净的main分支到custom分支
./sync-branches.sh main-to-custom
```

## 🆘 故障排除

### 常见问题

**Q: 脚本报告文件不存在错误**
A: 确保在项目根目录运行脚本，且配置文件存在

**Q: 某个重要文件被误识别为开发文件**
A: 在配置文件中添加例外规则，以 `!` 开头

**Q: 新的开发文件类型没有被检测到**
A: 在配置文件中添加相应的文件模式

**Q: 清理过程中出现Git错误**
A: 确保没有未提交的更改，且development分支存在

### 恢复操作
如果误删了重要文件，可以从Git历史中恢复：
```bash
# 查看最近的提交
git log --oneline -5

# 恢复特定文件
git checkout HEAD~1 -- filename

# 或者重置到之前的状态
git reset --hard HEAD~1
```
