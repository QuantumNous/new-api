# CustomPass 配置指南

本文档详细说明CustomPass渠道的配置选项、环境变量设置和最佳实践。

## 渠道配置

### 基础配置

通过Web界面配置CustomPass渠道：

#### 必填字段

| 字段 | 说明 | 示例 |
|------|------|------|
| 渠道名称 | 渠道的显示名称 | `CustomPass测试渠道` |
| 渠道类型 | 选择"自定义透传渠道"(52) | `52` |
| Base URL | 上游API的基础地址 | `https://api.example.com` |
| API密钥 | 上游API的认证密钥 | `sk-1234567890abcdef` |
| 支持模型 | 渠道支持的模型列表 | `gpt-4,claude-3,custom-model/submit` |

#### 可选字段

| 字段 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| 自定义Token头名称 | 传递用户token的HTTP头名称 | `X-Custom-Token` | `X-User-Token` |
| 用户分组 | 可使用该渠道的用户分组 | `default` | `default,premium` |
| 渠道优先级 | 渠道选择优先级 | `0` | `10` |
| 渠道权重 | 负载均衡权重 | `0` | `100` |
| 自动禁用 | 是否自动禁用故障渠道 | `true` | `false` |

### 高级配置

#### 模型映射

将客户端请求的模型名称映射到上游API的模型名称：

```json
{
  "gpt-4": "gpt-4-0125-preview",
  "claude-3": "claude-3-sonnet-20240229",
  "custom-model": "upstream-custom-model"
}
```

#### 参数覆盖

覆盖或添加请求参数：

```json
{
  "temperature": 0.7,
  "max_tokens": 2000,
  "custom_param": "default_value"
}
```

#### 状态码映射

重写上游API返回的HTTP状态码：

```json
{
  "400": "500",
  "429": "503"
}
```

#### 状态映射配置

配置异步任务状态映射：

```json
{
  "success": ["completed", "success", "finished", "done"],
  "failed": ["failed", "error", "cancelled", "timeout"],
  "processing": ["processing", "pending", "running", "in_progress"]
}
```

### 渠道配置示例

#### 基础配置示例

```json
{
  "name": "CustomPass生产渠道",
  "type": 52,
  "base_url": "https://api.upstream.com",
  "key": "sk-prod-1234567890abcdef",
  "models": ["gpt-4", "claude-3", "custom-image-gen/submit"],
  "groups": ["default", "premium"],
  "priority": 10,
  "weight": 100,
  "auto_ban": true
}
```

#### 完整配置示例

```json
{
  "name": "CustomPass完整配置",
  "type": 52,
  "base_url": "https://api.upstream.com",
  "key": "sk-prod-1234567890abcdef",
  "models": ["gpt-4", "claude-3", "custom-image-gen/submit", "custom-video-gen/submit"],
  "groups": ["default", "premium", "enterprise"],
  "priority": 10,
  "weight": 100,
  "auto_ban": true,
  "other": "X-User-Token",
  "model_mapping": "{\"gpt-4\": \"gpt-4-0125-preview\", \"claude-3\": \"claude-3-sonnet-20240229\"}",
  "param_override": "{\"temperature\": 0.7, \"max_tokens\": 2000}",
  "status_code_mapping": "{\"400\": \"500\", \"429\": \"503\"}",
  "custompass_status_mapping": "{\"success\": [\"completed\", \"success\"], \"failed\": [\"failed\", \"error\"], \"processing\": [\"processing\", \"pending\"]}",
  "setting": "{\"timeout\": 30, \"retry_count\": 3}"
}
```

## 环境变量配置

### 核心配置

| 环境变量 | 说明 | 默认值 | 示例 |
|----------|------|--------|------|
| `CUSTOM_PASS_HEADER_KEY` | 自定义Token头名称 | `X-Custom-Token` | `X-User-Token` |
| `CUSTOM_PASS_POLL_INTERVAL` | 轮询间隔（秒） | `30` | `60` |
| `CUSTOM_PASS_TASK_TIMEOUT` | 任务查询超时（秒） | `15` | `30` |
| `CUSTOM_PASS_MAX_CONCURRENT` | 最大并发轮询数 | `100` | `200` |
| `CUSTOM_PASS_TASK_MAX_LIFETIME` | 任务最大生命周期 | `3600` | `7200` |
| `CUSTOM_PASS_BATCH_SIZE` | 批量查询大小 | `50` | `100` |

### 状态映射配置

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `CUSTOM_PASS_STATUS_SUCCESS` | 成功状态列表 | `completed,success,finished` |
| `CUSTOM_PASS_STATUS_FAILED` | 失败状态列表 | `failed,error,cancelled` |
| `CUSTOM_PASS_STATUS_PROCESSING` | 处理中状态列表 | `processing,pending,running` |

### 性能调优配置

| 环境变量 | 说明 | 默认值 | 推荐值 |
|----------|------|--------|--------|
| `CUSTOM_PASS_DB_MAX_OPEN_CONNS` | 数据库最大连接数 | `25` | `50` |
| `CUSTOM_PASS_DB_MAX_IDLE_CONNS` | 数据库最大空闲连接数 | `10` | `20` |
| `CUSTOM_PASS_HTTP_TIMEOUT` | HTTP请求超时 | `30s` | `60s` |
| `CUSTOM_PASS_RETRY_COUNT` | 重试次数 | `3` | `5` |
| `CUSTOM_PASS_RETRY_DELAY` | 重试延迟 | `1s` | `2s` |

### 配置示例

#### 开发环境配置

```bash
# .env.development
CUSTOM_PASS_HEADER_KEY=X-Dev-Token
CUSTOM_PASS_POLL_INTERVAL=10
CUSTOM_PASS_TASK_TIMEOUT=30
CUSTOM_PASS_MAX_CONCURRENT=50
CUSTOM_PASS_TASK_MAX_LIFETIME=1800
CUSTOM_PASS_BATCH_SIZE=25

# 状态映射
CUSTOM_PASS_STATUS_SUCCESS=completed,success,done
CUSTOM_PASS_STATUS_FAILED=failed,error,timeout
CUSTOM_PASS_STATUS_PROCESSING=processing,pending,running

# 性能配置
CUSTOM_PASS_DB_MAX_OPEN_CONNS=25
CUSTOM_PASS_DB_MAX_IDLE_CONNS=10
CUSTOM_PASS_HTTP_TIMEOUT=30s
CUSTOM_PASS_RETRY_COUNT=3
```

#### 生产环境配置

```bash
# .env.production
CUSTOM_PASS_HEADER_KEY=X-Custom-Token
CUSTOM_PASS_POLL_INTERVAL=30
CUSTOM_PASS_TASK_TIMEOUT=15
CUSTOM_PASS_MAX_CONCURRENT=200
CUSTOM_PASS_TASK_MAX_LIFETIME=3600
CUSTOM_PASS_BATCH_SIZE=100

# 状态映射
CUSTOM_PASS_STATUS_SUCCESS=completed,success,finished,done
CUSTOM_PASS_STATUS_FAILED=failed,error,cancelled,timeout,aborted
CUSTOM_PASS_STATUS_PROCESSING=processing,pending,running,in_progress,queued

# 性能配置
CUSTOM_PASS_DB_MAX_OPEN_CONNS=100
CUSTOM_PASS_DB_MAX_IDLE_CONNS=25
CUSTOM_PASS_HTTP_TIMEOUT=60s
CUSTOM_PASS_RETRY_COUNT=5
CUSTOM_PASS_RETRY_DELAY=2s
```

## 配置优先级

CustomPass配置遵循以下优先级顺序（从高到低）：

1. **渠道配置** - 通过Web界面设置的渠道特定配置
2. **环境变量** - 系统环境变量配置
3. **默认值** - 系统内置默认配置

### 示例说明

如果同时存在以下配置：

- 渠道配置：`other` = `X-User-Token`
- 环境变量：`CUSTOM_PASS_HEADER_KEY` = `X-Custom-Token`
- 默认值：`X-Custom-Token`

最终使用的配置将是：`X-User-Token`（渠道配置优先级最高）

## 模型配置

### 同步模型配置

同步模型直接透传请求和响应：

```json
{
  "models": [
    "gpt-4",
    "gpt-3.5-turbo",
    "claude-3-sonnet",
    "claude-3-haiku",
    "custom-text-model"
  ]
}
```

### 异步模型配置

异步模型名称必须以`/submit`结尾：

```json
{
  "models": [
    "custom-image-gen/submit",
    "custom-video-gen/submit",
    "custom-music-gen/submit",
    "custom-3d-model/submit"
  ]
}
```

### 混合模型配置

可以同时配置同步和异步模型：

```json
{
  "models": [
    "gpt-4",
    "claude-3",
    "custom-image-gen/submit",
    "custom-video-gen/submit"
  ]
}
```

## 计费配置

### 模型计费配置

在系统的模型管理中配置CustomPass模型的计费策略：

#### 免费模式

不在ability表中配置模型，系统将按免费模式处理。

#### 按量计费

```json
{
  "model": "gpt-4",
  "channel_type": 52,
  "ratio": 1.5,
  "group_ratio": {
    "default": 1.0,
    "premium": 0.8,
    "enterprise": 0.6
  }
}
```

#### 按次计费

```json
{
  "model": "custom-image-gen/submit",
  "channel_type": 52,
  "fixed_quota": 1000,
  "group_ratio": {
    "default": 1.0,
    "premium": 0.9,
    "enterprise": 0.8
  }
}
```

### 计费公式

#### 按量计费公式

```
最终费用 = 基础价格 × token数量 × 模型倍率 × 分组倍率 × 用户倍率
```

#### 按次计费公式

```
最终费用 = 固定价格 × 分组倍率 × 用户倍率
```

## 监控配置

### 日志配置

```bash
# 日志级别
LOG_LEVEL=info

# CustomPass专用日志
CUSTOM_PASS_LOG_LEVEL=debug
CUSTOM_PASS_LOG_FILE=/var/log/custompass.log

# 日志轮转
CUSTOM_PASS_LOG_MAX_SIZE=100MB
CUSTOM_PASS_LOG_MAX_BACKUPS=10
CUSTOM_PASS_LOG_MAX_AGE=30
```

### 监控指标配置

```bash
# Prometheus指标
ENABLE_METRICS=true
METRICS_PORT=9090
METRICS_PATH=/metrics

# CustomPass指标
CUSTOM_PASS_METRICS_ENABLED=true
CUSTOM_PASS_METRICS_INTERVAL=30s
```

## 安全配置

### 访问控制

```json
{
  "groups": ["default", "premium"],
  "ip_whitelist": ["192.168.1.0/24", "10.0.0.0/8"],
  "rate_limit": {
    "requests_per_minute": 1000,
    "burst": 100
  }
}
```

### 数据安全

```bash
# 加密配置
CUSTOM_PASS_ENCRYPT_LOGS=true
CUSTOM_PASS_ENCRYPT_KEY=your-encryption-key

# 数据保留
CUSTOM_PASS_LOG_RETENTION_DAYS=90
CUSTOM_PASS_TASK_RETENTION_DAYS=30
```

## 配置验证

### 配置检查脚本

```bash
#!/bin/bash
# check_custompass_config.sh

echo "检查CustomPass配置..."

# 检查必需的环境变量
required_vars=(
    "CUSTOM_PASS_POLL_INTERVAL"
    "CUSTOM_PASS_TASK_TIMEOUT"
    "CUSTOM_PASS_MAX_CONCURRENT"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "警告: 环境变量 $var 未设置，将使用默认值"
    else
        echo "✓ $var = ${!var}"
    fi
done

# 检查数据库连接
echo "检查数据库连接..."
if psql -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ 数据库连接正常"
else
    echo "✗ 数据库连接失败"
fi

# 检查Redis连接（如果使用）
if [ -n "$REDIS_URL" ]; then
    echo "检查Redis连接..."
    if redis-cli ping > /dev/null 2>&1; then
        echo "✓ Redis连接正常"
    else
        echo "✗ Redis连接失败"
    fi
fi

echo "配置检查完成"
```

### 配置测试

```bash
# 测试CustomPass配置
curl -X POST "http://localhost:3000/api/channel/test" \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": 1,
    "model": "gpt-4",
    "test_data": {
      "messages": [{"role": "user", "content": "test"}]
    }
  }'
```

## 故障排除

### 常见配置问题

#### 1. 模型名称配置错误

**问题**: 异步模型没有以`/submit`结尾
**解决**: 确保异步模型名称格式正确

```json
// 错误
"models": ["custom-image-gen"]

// 正确
"models": ["custom-image-gen/submit"]
```

#### 2. 状态映射配置错误

**问题**: 上游API状态无法正确映射
**解决**: 检查状态映射配置

```json
{
  "success": ["completed", "success", "finished"],
  "failed": ["failed", "error", "cancelled"],
  "processing": ["processing", "pending", "running"]
}
```

#### 3. 认证配置错误

**问题**: 上游API认证失败
**解决**: 检查API密钥和自定义Token头配置

```json
{
  "key": "correct-api-key",
  "other": "X-Custom-Token"
}
```

### 配置调试

```bash
# 查看当前配置
curl -X GET "http://localhost:3000/api/channel/1" \
  -H "Authorization: Bearer admin-token"

# 查看环境变量
env | grep CUSTOM_PASS

# 查看日志
tail -f /var/log/custompass.log
```

## 最佳实践

### 1. 生产环境配置

- 使用合理的轮询间隔（30-60秒）
- 设置适当的并发限制
- 配置完整的状态映射
- 启用监控和日志记录
- 设置合理的超时时间

### 2. 开发环境配置

- 使用较短的轮询间隔（10-30秒）
- 启用详细日志记录
- 使用测试用的API密钥
- 配置较小的批量大小

### 3. 安全配置

- 定期轮换API密钥
- 限制访问IP范围
- 启用请求速率限制
- 加密敏感日志数据
- 设置合理的数据保留期

### 4. 性能配置

- 根据负载调整数据库连接池
- 优化轮询批量大小
- 设置合理的HTTP超时
- 启用连接复用
- 监控资源使用情况

这个配置指南涵盖了CustomPass的所有配置选项和最佳实践，帮助用户正确配置和优化CustomPass渠道。