# CustomPass 自定义透传渠道需求文档

## 简介

CustomPass是New API系统中的一个特殊渠道类型，提供完全透传的API代理功能。它支持同步直接透传和异步任务两种操作模式，具备完整的预扣费和计费结算机制。

## 需求

### 需求 1: 同步透传模式

**用户故事**: 作为API用户，我希望能够通过CustomPass渠道直接透传请求到上游API，以便实现实时的API调用和响应。

#### 验收标准

1. WHEN 用户发送请求到 `/pass/{model}` 端点 THEN 系统应该将请求直接转发到配置的上游API
2. WHEN 上游API返回响应 THEN 系统应该完全透传响应内容给客户端
3. WHEN 请求包含认证信息 THEN 系统应该同时发送Authorization头和自定义token头到上游
4. WHEN 模型配置为按量计费 THEN 系统应该先发送预扣费请求获取usage估算
5. WHEN 上游返回`type=precharge` THEN 系统应该执行预扣费后再发送真实请求
6. WHEN 上游不返回`type=precharge` THEN 系统应该直接使用第一次调用结果进行计费
7. WHEN 客户端请求包含`?precharge=true`参数 THEN 系统应该返回错误拒绝请求

### 需求 2: 异步任务模式

**用户故事**: 作为API用户，我希望能够提交长时间运行的任务到CustomPass渠道，并能够查询任务状态和结果。

#### 验收标准

1. WHEN 模型名称以`/submit`结尾 THEN 系统应该识别为异步任务模式
2. WHEN 用户提交任务到`/pass/{model}/submit` THEN 系统应该返回task_id并开始后台处理
3. WHEN 任务提交成功 THEN 系统应该使用第一次调用的usage进行预扣费
4. WHEN 系统轮询任务状态 THEN 应该调用`/task/list-by-condition`接口批量查询
5. WHEN 任务完成 THEN 系统应该使用最终usage进行结算，多退少补
6. WHEN 任务失败 THEN 系统应该自动退还所有预扣费用
7. WHEN 任务超过最大生命周期 THEN 系统应该标记为失败并退还费用

### 需求 3: 预扣费机制

**用户故事**: 作为系统管理员，我希望所有CustomPass请求都经过预扣费流程，以确保用户有足够余额并防止恶意使用。

#### 验收标准

1. WHEN 接收到CustomPass请求 THEN 系统必须进入预扣费流程
2. WHEN 用户余额不足 THEN 系统应该拒绝请求并返回余额不足错误
3. WHEN 预扣费操作失败 THEN 系统应该回滚所有相关操作
4. WHEN 最终结算时 THEN 系统应该计算差额并退还多扣的quota
5. WHEN 预扣费事务执行 THEN 应该使用行级锁防止并发修改用户余额
6. WHEN 事务超时或失败 THEN 系统应该自动重试最多3次
7. WHEN 同一用户并发请求 THEN 应该串行处理避免竞态条件

### 需求 4: 计费策略

**用户故事**: 作为系统管理员，我希望CustomPass支持多种计费方式，包括免费、按量计费和按次计费。

#### 验收标准

1. WHEN 模型未在ability中配置 THEN 系统应该按免费模式处理，不记录消费日志
2. WHEN 模型只配置倍率未配置固定价格 THEN 系统应该按量计费
3. WHEN 模型配置了固定价格 THEN 系统应该按次计费
4. WHEN 按量计费且上游未返回usage THEN 系统应该返回错误
5. WHEN 计算费用 THEN 应该按照基础价格→模型倍率→分组倍率→用户倍率的顺序
6. WHEN 计算结果包含小数 THEN 系统应该四舍五入到整数quota
7. WHEN 计费完成 THEN 系统应该记录详细的消费日志到logs表

### 需求 5: 认证授权

**用户故事**: 作为API用户，我希望CustomPass能够安全地传递我的身份信息到上游API。

#### 验收标准

1. WHEN 向上游发送请求 THEN 系统应该设置Authorization头使用渠道配置的API密钥
2. WHEN 向上游发送请求 THEN 系统应该设置自定义token头传递用户token
3. WHEN 环境变量配置了CUSTOM_PASS_HEADER_KEY THEN 应该使用配置的header名称
4. WHEN 未配置CUSTOM_PASS_HEADER_KEY THEN 应该使用默认的X-Custom-Token
5. WHEN 用户token无效 THEN 系统应该返回认证失败错误
6. WHEN 渠道API密钥无效 THEN 系统应该返回上游认证失败错误

### 需求 6: 任务轮询机制

**用户故事**: 作为系统管理员，我希望系统能够自动轮询异步任务状态并及时更新结果。

#### 验收标准

1. WHEN 系统启动 THEN 应该初始化任务轮询服务
2. WHEN 轮询间隔到达 THEN 系统应该查询所有非结束状态的任务
3. WHEN 批量查询任务 THEN 单次查询不应超过配置的批量大小限制
4. WHEN 查询上游API THEN 应该设置合理的超时时间防止长时间等待
5. WHEN 任务状态更新 THEN 应该根据环境变量配置进行状态映射
6. WHEN 任务超过最大生命周期 THEN 应该强制标记为失败状态
7. WHEN 轮询出现错误 THEN 应该记录详细日志并跳过本次轮询

### 需求 7: 错误处理

**用户故事**: 作为API用户，我希望在出现错误时能够收到清晰的错误信息和适当的HTTP状态码。

#### 验收标准

1. WHEN 上游API返回错误 THEN 系统应该透传错误信息给客户端
2. WHEN 预扣费失败 THEN 系统应该返回余额不足或系统错误信息
3. WHEN 配置错误 THEN 系统应该返回配置错误的详细说明
4. WHEN 网络超时 THEN 系统应该返回超时错误并记录日志
5. WHEN 数据库操作失败 THEN 系统应该回滚事务并返回系统错误
6. WHEN 并发冲突 THEN 系统应该自动重试或返回重试提示
7. WHEN 系统内部错误 THEN 应该记录详细错误日志便于排查

### 需求 8: 配置管理

**用户故事**: 作为系统管理员，我希望能够通过环境变量灵活配置CustomPass的各种参数。

#### 验收标准

1. WHEN 配置轮询间隔 THEN 系统应该使用CUSTOM_PASS_POLL_INTERVAL环境变量
2. WHEN 配置查询超时 THEN 系统应该使用CUSTOM_PASS_TASK_TIMEOUT环境变量
3. WHEN 配置并发限制 THEN 系统应该使用CUSTOM_PASS_MAX_CONCURRENT环境变量
4. WHEN 配置任务生命周期 THEN 系统应该使用CUSTOM_PASS_TASK_MAX_LIFETIME环境变量
5. WHEN 配置状态映射 THEN 系统应该使用CUSTOM_PASS_STATUS_*环境变量
6. WHEN 配置自定义header THEN 系统应该使用CUSTOM_PASS_HEADER_KEY环境变量
7. WHEN 环境变量未配置 THEN 系统应该使用合理的默认值