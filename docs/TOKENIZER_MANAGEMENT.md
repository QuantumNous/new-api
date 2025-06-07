# 分词器管理功能使用指南

本文档详细介绍如何使用 New API 中的分词器管理功能，包括默认预下载、界面管理和更新操作。

## 功能概述

分词器管理功能为 Hugging Face TEI 重排序服务提供了完整的分词器生命周期管理：

- ✅ **默认预下载** - Docker 构建时自动下载所有支持的分词器
- ✅ **离线使用** - 支持完全离线运行，无需运行时下载
- ✅ **界面管理** - 通过 Web 界面查看和管理分词器状态
- ✅ **一键更新** - 支持单个或批量更新分词器
- ✅ **状态验证** - 实时验证分词器的可用性

## 默认预下载机制

### 构建时自动下载

在 Docker 镜像构建过程中，系统会自动下载以下所有分词器：

#### 重排序模型分词器
- `BAAI/bge-reranker-v2-m3` (多语言，推荐)
- `BAAI/bge-reranker-large`
- `BAAI/bge-reranker-base`
- `BAAI/bge-reranker-v2-gemma`
- `jinaai/jina-reranker-v2-base-multilingual`
- `jinaai/jina-reranker-v1-base-en`
- `jinaai/jina-reranker-v1-turbo-en`
- `cross-encoder/ms-marco-MiniLM-L-6-v2`
- `cross-encoder/ms-marco-MiniLM-L-12-v2`
- `mixedbread-ai/mxbai-rerank-large-v1`
- `mixedbread-ai/mxbai-rerank-base-v1`

#### 嵌入模型分词器
- `sentence-transformers/all-MiniLM-L6-v2`
- `sentence-transformers/all-MiniLM-L12-v2`
- `sentence-transformers/all-mpnet-base-v2`
- `BAAI/bge-small-en-v1.5`
- `BAAI/bge-base-en-v1.5`
- `BAAI/bge-large-en-v1.5`
- `BAAI/bge-small-zh-v1.5`
- `BAAI/bge-base-zh-v1.5`
- `BAAI/bge-large-zh-v1.5`

### 离线配置

构建完成后，系统会创建离线配置文件 `/data/cache/offline_config.json`：

```json
{
  "offline_mode": true,
  "cache_dir": "/data/cache",
  "downloaded_models": ["BAAI/bge-reranker-v2-m3", "..."],
  "download_timestamp": 1703123456.789
}
```

## 界面管理功能

### 访问分词器管理页面

1. 登录 New API 管理界面
2. 在左侧菜单中点击 **"分词器管理"**（仅管理员可见）
3. 查看所有已配置的分词器状态

### 界面功能说明

#### 分词器列表
- **模型名称**: 显示完整的模型路径
- **状态**: 显示分词器当前状态
  - 🟢 **可用**: 分词器正常可用
  - 🔵 **更新中**: 正在更新分词器
  - 🔴 **错误**: 分词器存在问题
- **渠道**: 显示关联的 TEI 服务渠道
- **最后更新**: 显示分词器最后更新时间
- **缓存大小**: 显示分词器占用的存储空间

#### 操作按钮
- **刷新**: 重新获取分词器状态
- **验证**: 验证单个分词器的可用性
- **更新**: 更新单个分词器
- **批量更新**: 更新选中的多个分词器
- **强制更新全部**: 强制重新下载所有分词器

## 更新操作详解

### 单个分词器更新

1. 在分词器列表中找到目标模型
2. 点击该行的 **"更新"** 按钮
3. 系统会调用 Docker 容器中的更新脚本
4. 更新完成后自动刷新状态

### 批量更新

1. 勾选需要更新的分词器
2. 点击 **"批量更新"** 按钮
3. 确认更新操作
4. 系统会按渠道分组并逐个更新
5. 显示更新进度和结果

### 强制更新全部

1. 点击 **"强制更新全部"** 按钮
2. 确认操作（这会重新下载所有分词器）
3. 等待更新完成（可能需要较长时间）

## 命令行管理

### 容器内管理脚本

每个 TEI 容器都包含分词器管理脚本：

```bash
# 查看已下载的分词器
docker exec tei-container python3 /usr/local/bin/tokenizer_manager.py list

# 更新指定模型
docker exec tei-container python3 /usr/local/bin/tokenizer_manager.py update --model BAAI/bge-reranker-v2-m3

# 更新所有模型
docker exec tei-container python3 /usr/local/bin/tokenizer_manager.py update-all

# 验证缓存完整性
docker exec tei-container python3 /usr/local/bin/tokenizer_manager.py verify

# 清理缓存
docker exec tei-container python3 /usr/local/bin/tokenizer_manager.py clean
```

### 手动预下载

如果需要手动预下载分词器：

```bash
# 进入容器
docker exec -it tei-container bash

# 运行预下载脚本
python3 /tmp/preload_all_tokenizers.py

# 或者使用管理脚本更新
python3 /usr/local/bin/tokenizer_manager.py update-all
```

## 故障排除

### 常见问题

#### 1. 分词器状态显示错误

**症状**: 界面显示分词器状态为"错误"

**解决方案**:
```bash
# 验证分词器
docker exec tei-container python3 /usr/local/bin/tokenizer_manager.py verify

# 重新下载问题分词器
docker exec tei-container python3 /usr/local/bin/tokenizer_manager.py update --model MODEL_NAME
```

#### 2. 更新操作失败

**症状**: 点击更新按钮后显示失败

**可能原因**:
- 网络连接问题
- 容器资源不足
- 权限问题

**解决方案**:
```bash
# 检查容器状态
docker ps | grep tei

# 查看容器日志
docker logs tei-container

# 手动更新
docker exec tei-container python3 /usr/local/bin/tokenizer_manager.py update --model MODEL_NAME
```

#### 3. 缓存空间不足

**症状**: 更新时提示存储空间不足

**解决方案**:
```bash
# 检查磁盘使用情况
docker exec tei-container df -h

# 清理不需要的缓存
docker exec tei-container python3 /usr/local/bin/tokenizer_manager.py clean

# 或者扩展存储空间
```

### 日志调试

#### 查看更新日志

```bash
# 查看容器日志
docker logs -f tei-container

# 查看 New API 日志
tail -f /path/to/new-api.log | grep tokenizer
```

#### 启用调试模式

```bash
# 设置环境变量
export DEBUG=true

# 重启服务
docker-compose restart
```

## 性能优化

### 缓存管理

1. **定期清理**: 定期清理不需要的模型缓存
2. **存储监控**: 监控缓存目录的磁盘使用情况
3. **网络优化**: 使用 HuggingFace 镜像加速下载

### 更新策略

1. **增量更新**: 优先使用增量更新而非强制更新
2. **错峰更新**: 在业务低峰期进行批量更新
3. **分批更新**: 对于大量分词器，分批进行更新

## 最佳实践

### 部署建议

1. **预留存储**: 为分词器缓存预留足够的存储空间（建议 50GB+）
2. **网络配置**: 配置 HuggingFace 镜像以加速下载
3. **监控告警**: 设置分词器状态监控和告警

### 维护建议

1. **定期验证**: 每周验证一次分词器完整性
2. **版本管理**: 记录分词器版本变更
3. **备份恢复**: 定期备份分词器缓存

### 安全建议

1. **权限控制**: 仅允许管理员访问分词器管理功能
2. **操作审计**: 记录所有分词器管理操作
3. **网络安全**: 确保下载源的安全性

## 总结

分词器管理功能提供了完整的生命周期管理，确保 Hugging Face TEI 服务能够稳定运行：

- **开箱即用**: 默认预下载所有分词器，无需额外配置
- **可视化管理**: 通过 Web 界面轻松管理分词器
- **灵活更新**: 支持多种更新策略和操作方式
- **故障恢复**: 提供完善的故障排除和恢复机制

通过合理使用这些功能，可以确保重排序服务的高可用性和稳定性。
