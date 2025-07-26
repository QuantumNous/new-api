# CustomPass 自定义透传渠道

CustomPass是New API系统中的一个特殊渠道类型，提供完全透传的API代理功能。它支持同步直接透传和异步任务两种操作模式，具备完整的预扣费和计费结算机制。

## 功能特性

- **双模式支持**: 同步直接透传和异步任务处理
- **预扣费机制**: 完整的预扣费和结算流程，防止恶意使用
- **多种计费策略**: 支持免费、按量计费和按次计费
- **参数透传**: 完整透传客户端请求参数到上游API
- **状态映射**: 灵活的任务状态映射配置
- **错误处理**: 完善的错误处理和重试机制
- **性能优化**: 高并发处理和资源优化

## 快速开始

### 1. 创建CustomPass渠道

通过Web界面创建渠道：

1. 进入渠道管理页面
2. 点击"创建渠道"
3. 选择"自定义透传渠道"（类型52）
4. 配置基本信息：
   - **渠道名称**: 自定义名称
   - **Base URL**: 上游API地址
   - **API密钥**: 上游API的认证密钥
   - **支持模型**: 配置同步和异步模型

### 2. 模型配置

#### 同步模型
直接透传，立即返回结果：
```
gpt-4
claude-3
custom-text-model
```

#### 异步模型
模型名称必须以`/submit`结尾：
```
custom-image-gen/submit
custom-video-gen/submit
custom-music-gen/submit
```

### 3. 使用示例

#### 同步API调用

```bash
curl -X POST "https://your-api.com/v1/chat/completions" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ],
    "temperature": 0.7
  }'
```

#### 异步任务提交

```bash
curl -X POST "https://your-api.com/v1/chat/completions" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "custom-image-gen/submit",
    "prompt": "A beautiful sunset over mountains",
    "size": "1024x1024"
  }'
```

## 详细文档

- [API文档](./API.md) - 完整的API接口说明
- [配置指南](./CONFIGURATION.md) - 详细的配置选项说明
- [部署指南](./DEPLOYMENT.md) - 生产环境部署指南
- [故障排除](./TROUBLESHOOTING.md) - 常见问题和解决方案
- [性能优化](../test/PERFORMANCE_OPTIMIZATION.md) - 性能调优指南

## 架构概览

```
客户端请求 → New API → CustomPass处理器 → 预扣费 → 上游API → 结算 → 响应返回
                                    ↓
                              异步任务轮询服务
```

## 支持与反馈

如有问题或建议，请通过以下方式联系：

- 提交Issue到项目仓库
- 查看[故障排除文档](./TROUBLESHOOTING.md)
- 参考[测试指南](../test/TESTING.md)进行问题诊断