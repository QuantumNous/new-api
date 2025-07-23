# CustomPass 自定义透传渠道开发文档

## 1. 系统架构概览

CustomPass是New API中的一个特殊渠道类型，提供完全透传的API代理功能。它支持两种操作模式：

### 1.1 双模式设计

#### 直接透传模式（同步）
- **端点**: `/pass/{model}`
- **用途**: 实时API调用，立即返回结果
- **特点**: 直接转发请求到上游，同步返回响应

#### 异步任务模式（类似图像生成服务）
- **任务提交端点**: `/pass/{model}/submit` (model需要以`/submit`结尾)
- **任务查询端点**: `/pass/{model_base}/task/list-by-condition` (model_base是去掉`/submit`后的名称)
- **用途**: 长时间运行的任务处理
- **特点**: 参考异步任务处理模式，无重试机制，简单状态管理

**重要说明**: 
- **异步任务的模型名称必须包含 `/submit` 后缀**
- 这个完整的名称（含`/submit`）用于模型配置、计费和内部处理
- 只有在构建上游API查询URL时才会临时移除`/submit`后缀

**示例**:
- 模型配置: `custom-image-gen/submit` (完整模型名称)
- 任务提交: `POST /pass/custom-image-gen/submit`
- 任务查询: `POST /pass/custom-image-gen/task/list-by-condition`


model 是渠道配置中的模型

### 1.2 系统组件

```
客户端请求
    ↓
路由层 (/pass/*)
    ↓
认证&分发中间件
    ↓
CustomPass适配器
 ├── 进入预扣费流程（所有模型必经）
 ├── 按量计费模型：向上游发送带?precharge=true的请求
 ├── 判断响应中是否有type=precharge
 ├── 如果有：进行预扣费 → 第二次调用(真实请求)
 └── 如果没有：直接使用第一次调用结果
    ↓
响应处理&计费结算
    ↓
返回结果
```

**预扣费流程说明**：

预扣费是**New API系统内部的标准流程**，所有通过**CustomPass自定义透传渠道**的请求都会经过预扣费流程。

### 1.3 预扣费流程的完整事务边界

#### 1.3.1 事务边界的基本概念

**预扣费事务**是指从接收计费请求开始，到预扣费操作完成（成功或失败）为止的所有数据库操作的集合。这些操作必须作为一个不可分割的单元执行，要么全部成功，要么全部失败。

#### 1.3.2 同步请求的预扣费事务边界

**事务开始条件**：接收到需要预扣费的API请求，并且获取到预扣费的预估usage

**事务包含的原子操作**：
2. **余额查询与锁定**：查询用户当前quota余额，并对用户记录加锁防止并发修改
3. **预扣费金额计算**：根据模型配置和预估usage计算预扣费金额
4. **余额充足性验证**：检查用户余额是否足够支付预扣费
5. **执行预扣费扣除**：从用户quota中扣除预扣费金额
6. **请求状态记录**：记录请求的预扣费状态和金额
7. **释放锁定**：释放用户记录的锁定状态

**事务结束条件**：
- **成功**：所有操作完成，预扣费生效
- **失败**：任何操作失败，所有操作回滚

**事务失败的回滚机制**：

*回滚触发条件*：
- 用户token无效或过期
- 用户余额不足以支付预扣费
- 数据库操作失败（网络异常、锁超时等）
- 业务逻辑验证失败
- 系统内部错误

*回滚操作内容*：
1. **恢复用户余额**：撤销已扣除的quota金额
2. **清理临时记录**：删除已创建的预扣费相关记录
3. **释放资源锁**：释放所有获取的数据库锁
4. **记录失败日志**：记录预扣费失败的详细信息
5. **返回错误状态**：向客户端返回明确的错误信息

#### 1.3.3 异步请求的预扣费事务边界

**任务提交阶段的预扣费事务**：

*事务开始条件*：接收到异步任务提交请求，并且获取到预扣费的预估usage

*事务包含的原子操作*：
2. **余额查询与锁定**：查询用户quota余额并加锁
3. **预扣费金额计算**：根据第一次调用的usage计算预扣费金额
4. **余额充足性验证**：检查用户余额是否足够
5. **执行预扣费扣除**：从用户quota中扣除预扣费金额
6. **创建任务记录**：在任务表中创建新的任务记录
7. **记录预扣费信息**：在任务记录中记录预扣费金额和状态
8. **释放锁定**：完成所有操作后释放用户记录锁

*事务结束条件*：
- **成功**：任务创建完成，预扣费生效，返回task_id
- **失败**：任何操作失败，回滚所有操作

**任务完成阶段的结算事务**：

*事务开始条件*：轮询发现任务状态变为已完成

*事务包含的原子操作*：
1. **任务状态验证**：确认任务确实已完成
2. **最终usage提取**：从上游响应中提取实际usage信息
3. **实际费用计算**：根据实际usage计算最终费用
4. **费用差额计算**：计算预扣费与实际费用的差额
5. **用户余额调整**：退还多扣的quota或补扣不足的quota
6. **任务状态更新**：更新任务状态为已结算
7. **创建消费日志**：记录最终的消费日志到logs表
8. **更新用户统计**：更新用户的累计使用量统计

#### 1.3.4 事务边界的关键特性

**原子性保证**：
- **全部成功或全部失败**：预扣费事务中的所有操作要么全部完成，要么全部回滚
- **中间状态不可见**：其他并发操作不能看到事务的中间状态
- **操作顺序保证**：事务中的操作按照预定顺序执行

**一致性保证**：
- **余额一致性**：用户的quota余额始终正确反映实际可用金额
- **业务规则一致性**：所有预扣费操作都遵循相同的业务规则
- **数据关联一致性**：用户表、任务表、日志表之间的数据保持一致

**隔离性保证**：
- **用户级别隔离**：同一用户的多个请求串行处理，避免竞态条件
- **请求级别隔离**：不同用户的请求可以并发处理
- **读写隔离**：查询操作不会被预扣费操作阻塞

**持久性保证**：
- **预扣费记录持久化**：成功的预扣费操作必须持久化到数据库
- **失败记录持久化**：预扣费失败的详细信息也要记录保存
- **审计追踪**：所有预扣费操作都有完整的审计记录

#### 1.3.5 并发控制策略

**锁机制**：
- **行级锁**：对用户记录使用行级锁，防止并发修改余额
- **锁超时**：设置合理的锁超时时间（建议5秒），避免长时间等待
- **死锁检测**：数据库层面的死锁检测和自动回滚

**重试机制**：
- **事务重试**：对于可重试的失败（如锁超时），自动重试最多3次
- **重试间隔**：重试之间使用递增的等待时间（1秒、2秒、3秒）
- **重试条件**：只对特定类型的错误进行重试

**幂等性保证**：
- **请求标识**：每个请求都有唯一标识，避免重复处理
- **状态检查**：在执行预扣费前检查是否已经处理过
- **结果一致性**：相同请求的多次执行结果保持一致

### 1.4 预扣费流程业务逻辑

1. **流程入口**：
   - CustomPass渠道的所有模型请求都会进入预扣费流程
   - 这是系统内部的必经流程，不是可选的

2. **预扣费金额确定**：
   - **按量计费模型**：需要向上游发送带 `?precharge=true` 的请求获取预估usage
   - **按次计费模型**：直接使用模型配置的固定价格
   - **免费模型**：不执行扣费操作，不记录消费日志

3. **预扣费执行**：
   - **同步请求**：
     - 按量计费：根据第一次调用的响应决定预扣费金额
     - 如果返回 `type=precharge`：使用返回的usage作为预扣费
     - 如果没有 `type=precharge`：使用实际usage（预扣费=最终费用）
   - **异步请求**：
     - 按量计费：始终使用第一次调用返回的usage作为预扣费
     - `type=precharge` 只决定是否需要第二次调用提交真实任务

4. **最终结算**：
   - **同步请求**：
     - 支持预扣费：使用第二次调用的实际usage结算，多退少补
     - 不支持预扣费：预扣费即为最终费用
   - **异步请求**：
     - 任务成功：使用查询接口返回的最终usage结算，多退少补
     - 任务失败：自动退还全部预扣费

## 2. 核心组件分析

### 2.1 渠道适配器

#### 直接透传适配器
- **文件**: `relay/channel/custompass/adaptor.go`
- **功能**: 
  - 请求URL构建: `{base_url}/{model}`
  - 请求头设置: Authorization + 自定义token header
  - 预扣费处理: 按量计费模型发送带`?precharge=true`的请求
  - 响应处理: 自动提取usage信息进行结算计费
  - 透传支持: 完全透传上游响应

#### 异步任务适配器
- **文件**: `relay/channel/task/custompass/adaptor.go`
- **功能**: 
  - 预扣费处理: 使用第一次调用的usage作为预扣费
  - 任务提交: 解析请求并提交到上游
  - 状态查询: 定时轮询任务状态，任务完成后结算计费
  - 任务管理: 类似图像生成服务的简单状态机

### 2.2 请求处理器

#### CustomPass处理器
- **文件**: `relay/custompass_handler.go`
- **功能**:
  - 统一处理CustomPass请求
  - 适配器选择和初始化
  - 错误处理和响应返回


### 2.3 常量定义

```go
// 任务平台
TaskPlatformCustomPass = "custompass"
```

## 3. 异步任务处理机制（类似图像生成服务）

### 3.1 设计原则

基于异步任务处理机制，CustomPass遵循以下原则：

1. **无重试机制**: 任务提交后不会自动重试
2. **简单状态管理**: 提交 → 进行中 → 完成/失败
3. **失败即退款**: 任务失败时自动退还配额
4. **轮询更新**: 定时检查任务状态，无重试逻辑

### 3.2 任务生命周期

```
用户提交任务 (/pass/{model_without_submit}/submit)
    ↓
任务验证和预处理
    ↓
预扣费流程
 ├── 按量计费：向上游发送带?precharge=true的请求
 ├── 使用第一次调用返回的usage作为预扣费金额
 └── 如果返回type=precharge，再次调用提交真实任务
    ↓
返回task_id给用户
    ↓
后台轮询任务状态
    ↓
状态更新 (进行中/完成/失败)
    ↓
[最终结算] 多退少补，失败自动退还配额
```

### 3.3 任务状态管理

#### 状态映射配置
支持通过环境变量配置上游API的状态映射：

```bash
# 状态映射配置
CUSTOM_PASS_STATUS_SUCCESS=completed,success,finished
CUSTOM_PASS_STATUS_FAILED=failed,error,cancelled
CUSTOM_PASS_STATUS_PROCESSING=processing,pending,running
```

#### 状态转换逻辑
```go
func (a *TaskAdaptor) isSubmitAction(action string, responseBody []byte) bool {
    submitKeywords := []string{"submit"}
    actionLower := strings.ToLower(action)
    for _, keyword := range submitKeywords {
        if strings.Contains(actionLower, keyword) {
            return true
        }
    }
    return false
}
```

### 3.4 任务轮询机制

#### 3.4.1 轮询架构设计

CustomPass异步任务系统采用主动轮询模式，通过定期查询上游API来获取任务状态更新。系统设计了高效的轮询机制来平衡实时性和系统性能。

**轮询架构图**：
```
任务提交后
    ↓
后台轮询服务启动
    ↓
定时器触发 (CUSTOM_PASS_POLL_INTERVAL)
    ↓
批量查询任务状态
    ↓
状态解析与映射
    ↓
数据库状态更新
    ↓
计费结算处理
    ↓
回到定时器循环
```

#### 3.4.2 轮询策略配置

**环境变量配置**：
```bash
# 轮询间隔（秒）- 默认30秒
CUSTOM_PASS_POLL_INTERVAL=30

# 单次查询超时时间（秒）- 默认15秒
CUSTOM_PASS_TASK_TIMEOUT=15

# 最大并发查询数 - 默认100
CUSTOM_PASS_MAX_CONCURRENT=100

# 任务最大生命周期（秒）- 默认3600秒（1小时）
CUSTOM_PASS_TASK_MAX_LIFETIME=3600

# 批量查询任务数限制 - 默认50个
CUSTOM_PASS_BATCH_SIZE=50
```

**轮询策略说明**：
- **固定间隔轮询**：每30秒执行一次查询，确保状态及时更新
- **批量查询优化**：单次查询最多50个任务，提高查询效率
- **并发控制**：最多100个并发查询请求，防止上游API过载
- **超时保护**：单次查询15秒超时，避免长时间等待
- **生命周期管理**：任务超过1小时自动标记为超时失败

#### 3.4.3 轮询执行流程

**轮询服务架构说明**：

CustomPass异步任务轮询系统采用定时器驱动的轮询架构，通过配置的时间间隔定期检查任务状态。系统启动时会初始化轮询服务，创建定时器并开始轮询循环。

**轮询服务的核心组件**：
- 定时器管理：负责按配置的时间间隔触发轮询操作
- 任务筛选器：从数据库中获取需要轮询的任务
- 批量查询器：将任务按渠道分组并并发查询
- 状态处理器：处理查询结果并更新任务状态
- 结算处理器：处理完成任务的计费结算

**轮询执行步骤详解**：

1. **轮询触发**：
   - 定时器按配置的轮询间隔（默认15秒）触发轮询操作
   - 检查服务是否需要停止，如果需要则退出轮询循环
   - 开始新一轮的任务状态查询

2. **任务筛选**：
   - 查询数据库中状态为非结束状态(这个不分需要补充说明会结束状态是哪几种)的任务

4. **状态处理**：
   - 接收上游API返回的任务状态信息
   - 根据环境变量配置的状态映射规则转换状态
   - 更新数据库中对应任务的状态字段
   - 记录状态变更的时间戳

5. **结算处理**：
   - 对于完成状态的任务，提取最终usage信息进行计费结算
   - 计算预扣费与实际费用的差额，执行多退少补
   - 对于失败状态的任务，自动退还所有预扣费用
   - 生成详细的计费日志记录，包含所有相关信息

#### 3.4.4 查询URL构建

**URL构建逻辑说明**：

CustomPass系统在查询异步任务状态时，需要根据模型名称和任务ID构建正确的查询URL。系统会自动处理模型名称的转换和URL拼接。

**URL构建步骤**：

1. **模型名称处理**：
   - **注意**: 异步任务的模型配置名称为完整的含`/submit`后缀的名称（如`custom-image-gen/submit`）
   - 在构建查询URL时，从模型名称中临时移除 `/submit` 后缀
   - 例如：`custom-image-gen/submit` → `custom-image-gen`
   - 确保查询URL使用正确的基础模型名称

2. **URL拼接**：
   - 使用渠道配置的基础URL作为前缀
   - 拼接处理后的模型名称
   - 添加固定的查询路径 `/task/list-by-condition`
   - 最终格式：`{base_url}/{model_without_submit}/task/list-by-condition`

3. **查询参数构建**：
   - 创建包含任务ID列表的查询数据结构
   - 将需要查询的任务ID放入 `task_ids` 字段
   - 支持批量查询多个任务的状态

4. **请求头设置**：
   - 设置Authorization头，使用渠道配置的API密钥
   - 添加Content-Type头，指定JSON格式
   - 包含自定义token头，传递用户身份信息

5. **请求发送**：
   - 使用HTTP POST方法发送查询请求
   - 携带构建好的查询数据和请求头
   - 设置适当的超时时间，避免长时间等待

#### 3.4.5 查询请求格式

**请求示例**：
```json
{
  "task_ids": ["task_id_1", "task_id_2", "task_id_3"]
}
```

**请求头设置**：
```http
POST /custom-model/task/list-by-condition HTTP/1.1
Host: upstream-api.example.com
Authorization: Bearer upstream_api_key
X-Custom-Token: sk-user_token
Content-Type: application/json
```

#### 3.4.6 轮询响应处理

**上游返回示例**：
```json
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "task_id": "task_id_1",
      "status": "completed",
      "progress": "100%",
      "error": null,
      "result": {
        "output": "任务执行结果",
        "metadata": {"duration": 120}
      },
      "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 20,
        "total_tokens": 30,
        "prompt_tokens_details": {
          "cached_tokens": 0,
          "text_tokens": 10,
          "audio_tokens": 0,
          "image_tokens": 0
        },
        "completion_tokens_details": {
          "text_tokens": 20,
          "audio_tokens": 0,
          "reasoning_tokens": 0
        }
      }
    },
    {
      "task_id": "task_id_2",
      "status": "processing",
      "progress": "50%",
      "error": null,
      "result": null,
      "usage": null
    },
    {
      "task_id": "task_id_3",
      "status": "failed",
      "progress": "0%",
      "error": "Invalid input parameters",
      "result": null,
      "usage": null
    }
  ]
}
```

#### 3.4.7 状态同步处理

**状态映射与更新流程**：

1. **状态映射转换**：
   - 系统接收到上游API返回的任务状态后，首先根据环境变量配置的状态映射规则进行转换
   - 将上游的自定义状态（如"success"、"finished"等）映射为系统标准状态（"completed"、"failed"、"processing"）
   - 如果上游状态不在映射列表中，则保持原状态不变，打印错误日志

2. **数据库状态更新**：
   - 更新任务的当前状态字段
   - 同步任务进度信息（如果上游提供）
   - 记录状态更新时间戳
   - 保持任务历史状态变更记录

3. **完成状态处理**：
   - 当任务状态为"completed"时，系统执行以下操作：
     - 记录任务完成时间
     - 保存上游返回的完整数据作为data
     - 提取最终的usage信息用于计费结算
     - 执行最终计费结算，计算实际消费金额
     - 如果有预扣费，计算差额并退还多扣部分
     - 生成完整的计费日志记录

4. **失败状态处理**：
   - 当任务状态为"failed"时，系统执行以下操作：
     - 记录任务失败时间
     - 保存错误信息到任务表以及上游返回的完整数据作为data
     - 自动退还所有预扣费用到用户账户
     - 生成失败日志记录，包含错误详情

5. **进行中状态处理**：
   - 当任务状态为"processing"时，系统执行以下操作：
     - 更新任务进度信息
     - 保持任务在轮询队列中
     - 检查任务是否超过最大生命周期
     - 如果超时，标记为失败并执行失败处理流程

6. **数据一致性保证**：
   - 所有状态更新操作在数据库事务中执行
   - 确保状态变更和计费操作的原子性
   - 在更新失败时进行回滚，保持数据一致性
   - 记录所有状态变更的审计日志

#### 3.4.8 错误处理与重试

**查询失败处理机制**：

CustomPass轮询系统采用分类错误处理策略，根据不同类型的错误采取相应的处理措施，确保系统的稳定性和可靠性。

**错误分类与处理策略**：

1. **错误处理**：
   - 打印详细的错误日志，包含渠道ID，接口url和错误信息
   - 跳过本次轮询，等待下一个轮询周期重新尝试
   - 任务超过60分钟没有变成完成状态（熏陶确认是那个几个映射状态），强行将任务设置为失败状态（须有走退费的流程）


## 4. 认证授权机制

CustomPass系统在与上游API通信时采用双重认证机制，确保请求的安全性和用户身份的正确传递。

### 4.1 认证流程

#### 4.1.1 请求认证
CustomPass系统在向上游API发送请求时，会在请求头中包含两个关键认证信息：

1. **Authorization Header**：
   - **格式**: `Authorization: Bearer {upstream_api_key}`
   - **用途**: 用于CustomPass系统本身向上游API的认证
   - **来源**: 来自渠道配置中的`key`字段
   - **说明**: 这是CustomPass系统作为客户端访问上游API的凭证

2. **自定义Token Header**：
   - **格式**: `{CUSTOM_PASS_HEADER_KEY}: {user_token}`
   - **默认Header名**: `X-Custom-Token`（可通过环境变量配置）
   - **用途**: 将实际使用服务的用户token传递给上游API
   - **来源**: 来自客户端请求中的用户token
   - **说明**: 上游API可以通过此header获取实际用户身份

#### 4.1.2 认证示例
```bash
# CustomPass向上游API发送的请求示例
POST https://upstream-api.example.com/custom-model
Authorization: Bearer upstream_api_key_123456
X-Custom-Token: sk-user_token_789012
Content-Type: application/json

{
  "prompt": "用户的实际请求内容",
  "max_tokens": 1000
}
```

### 4.2 配置说明

#### 4.2.1 环境变量配置
```bash
# 自定义token header名称配置
CUSTOM_PASS_HEADER_KEY=X-Custom-Token

# 如果不设置，默认使用 X-Custom-Token
```


### 4.3 上游API要求

上游API需要能够处理双重认证：
1. **验证Authorization header**：确认CustomPass系统的访问权限
2. **获取用户token**：从`CUSTOM_PASS_HEADER_KEY`指定的header中获取实际用户token
3. **用户身份识别**：根据用户token进行用户身份识别和权限验证

### 4.4 安全考虑

- **Token安全**：用户token通过HTTPS安全传输
- **权限隔离**：上游API应当基于用户token进行权限控制
- **日志记录**：建议上游API记录实际用户的操作日志，而非CustomPass系统的日志

## 5. API接口规范

CustomPass要求上游API提供以下接口来支持不同的功能模式：

### 5.1 上游接口要求

#### 5.1.1 同步接口（必需）
- **接口**: `POST {base_url}/{model}`
- **用途**: 处理直接透传的同步请求
- **特点**: 立即执行任务并返回完整结果
- **请求格式**: 任意JSON数据，直接透传给上游
- **响应要求**: 立即返回处理结果和usage信息
- **适用场景**: 文本生成、图像分析、语音转换等实时处理任务

**预扣费支持（仅供CustomPass系统内部使用）**:
- **接口**: `POST {base_url}/{model}?precharge=true`
- **用途**: CustomPass系统内部用于获取预扣费信息
- **重要说明**: 该参数是系统保留的查询参数，仅供CustomPass系统内部使用，客户端请求中不允许包含此参数，否则系统将报错
- **请求格式**: 与同步接口相同的JSON数据
- **响应方式**: 
  - **支持预扣费**: 返回 `type=precharge` 和估算usage，不执行真实任务，CustomPass会再次调用不带precharge参数的接口执行真实任务
  - **不支持预扣费**: 忽略precharge参数，直接执行并返回结果

#### 5.1.2 异步任务接口（可选）
如果模型名称以 `/submit` 结尾，需要提供以下接口：
- **适用场景**: 视频生成、大模型训练、批量图像处理等长时间任务

**任务提交接口**:
- **接口**: `POST {base_url}/{model_without_submit}/submit`
- **用途**: 提交长时间运行的任务
- **请求格式**: 任意JSON数据，包含任务参数
- **特点**: 
  - 立即返回task_id，任务在后台异步执行
  - 适合耗时较长的任务处理
- **响应要求**: 返回task_id、初始状态和可选的预估usage

**预扣费支持（仅供CustomPass系统内部使用）**:
- **接口**: `POST {base_url}/{model_without_submit}/submit?precharge=true`
- **用途**: CustomPass系统内部用于获取预扣费信息
- **重要说明**: 该参数是系统保留的查询参数，仅供CustomPass系统内部使用，客户端请求中不允许包含此参数，否则系统将报错
- **请求格式**: 与任务提交接口相同的JSON数据
- **响应方式**: 
  - **支持预扣费**: 返回 `type=precharge` 和估算usage，不提交真实任务，CustomPass会再次调用不带precharge参数的接口提交真实任务
  - **不支持预扣费**: 忽略precharge参数，直接提交任务并返回task_id
- **注意**: 异步任务总是使用第一次调用返回的usage作为预扣费金额

**任务查询接口**:
- **接口**: `POST {base_url}/{model_without_submit}/task/list-by-condition`
- **用途**: 查询任务状态和结果
- **请求格式**: `{"task_ids": ["task_id_1", "task_id_2"]}`
- **特点**: 
  - 支持批量查询多个任务状态
  - 返回任务进度、状态和最终结果
  - CustomPass内部直接调用上游，定时轮询任务状态
- **响应要求**: 返回任务状态、进度和最终结果（含最终usage）



### 5.2 响应格式要求

***透传响应：***完全透传上游的响应给客户端。

上游响应基本格式：
```json
{
  "code": 0,
  "msg": "success",
  "data": dict | list | string | null,
  "type": "precharge",
  "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 20,
      "total_tokens": 30,
      "prompt_tokens_details": {
        "cached_tokens": 0,
        "text_tokens": 10,
        "audio_tokens": 0,
        "image_tokens": 0
      },
      "completion_tokens_details": {
        "text_tokens": 20,
        "audio_tokens": 0,
        "reasoning_tokens": 0
      }
    }
}
```

字段说明
- `code`: 必须，0表示成功，非0表示失败，可以是int 或 string
- `message | msg`: 必须，错误信息描述，优先获取message字段，如果不存在则获取msg字段
- `data`: 必须，响应数据，可以是dict、list、string或null
- `type`: 可选，响应类型，用于预扣费功能，必须是`precharge`
- `usage`: 可选，usage信息，必须符合CustomPass的usage格式规范
  - `prompt_tokens`: 必须，输入token数量
  - `completion_tokens`: 必须，输出token数量
  - `total_tokens`: 必须，总token数量



### 5.3 Usage格式规范

CustomPass要求上游API返回标准的usage信息用于计费。usage字段格式如下：

#### 5.3.1 基础必需字段
```json
{
  "usage": {
    "prompt_tokens": 10,        // 必须：输入token数量
    "completion_tokens": 20,    // 必须：输出token数量  
    "total_tokens": 30          // 必须：总token数量
  }
}
```

#### 5.3.2 完整可选字段
```json
{
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30,
    "prompt_cache_hit_tokens": 0,  // 可选：提示缓存命中token数
    "prompt_tokens_details": {     // 可选：输入token详细分类
      "cached_tokens": 0,          // 缓存token数量
      "text_tokens": 10,           // 文本token数量
      "audio_tokens": 0,           // 音频token数量
      "image_tokens": 0            // 图像token数量
    },
    "completion_tokens_details": { // 可选：输出token详细分类
      "text_tokens": 20,           // 文本输出token数量
      "audio_tokens": 0,           // 音频输出token数量
      "reasoning_tokens": 0        // 推理token数量
    },
    "input_tokens": 10,            // 可选：兼容其他格式
    "output_tokens": 20,           // 可选：兼容其他格式
    "cost": 0.001                  // 可选：第三方平台的成本信息
  }
}
```

#### 5.3.3 计费说明
- **必需字段**: 系统只需要`prompt_tokens`、`completion_tokens`、`total_tokens`即可进行计费
- **详细分类**: `prompt_tokens_details`和`completion_tokens_details`用于高级计费策略（如缓存折扣）
- **兼容性**: 系统同时支持标准格式和其他格式的usage字段
- **验证**: 对于按量计费的模型，如果上游未返回usage信息，系统将报错


### 5.4 直接透传接口

#### 请求格式
```
POST /pass/{model}
Authorization: Bearer {token}
Content-Type: application/json

{
  // 任意JSON数据，直接透传给上游
}
```

**重要说明**：`?precharge=true` 参数是系统保留的查询参数，仅供CustomPass系统内部使用。客户端请求中不允许包含此参数，否则系统将报错。客户端正常调用API，系统会自动处理预扣费逻辑。

#### 上游响应格式
```json
{
  "code": 0, // int 或 string
  "message": "success", // 优先获取message字段，如果不存在则获取msg字段
  "data": null | string | object | array,
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30,
    "prompt_tokens_details": {
      "cached_tokens": 0,
      "text_tokens": 10,
      "audio_tokens": 0,
      "image_tokens": 0
    },
    "completion_tokens_details": {
      "text_tokens": 20,
      "audio_tokens": 0,
      "reasoning_tokens": 0
    }
  }
}
```

**Usage字段说明**:
- `prompt_tokens`: 必须，输入token数量
- `completion_tokens`: 必须，输出token数量
- `total_tokens`: 必须，总token数量
- `prompt_tokens_details`: 可选，输入token详细分类
  - `cached_tokens`: 缓存命中的token数量
  - `text_tokens`: 文本token数量
  - `audio_tokens`: 音频token数量
  - `image_tokens`: 图像token数量
- `completion_tokens_details`: 可选，输出token详细分类
  - `text_tokens`: 文本输出token数量
  - `audio_tokens`: 音频输出token数量
  - `reasoning_tokens`: 推理token数量

**注意**: 只要有`prompt_tokens`、`completion_tokens`、`total_tokens`三个基础字段即可进行计费，详细分类字段为可选


### 5.5 异步任务接口

#### 任务提交
```
POST /pass/{model_without_submit}/submit
Authorization: Bearer {token}
Content-Type: application/json

{
  // 任务参数，透传给上游
}
```

**说明**: 
- `{model}` 必须以 `/submit` 结尾，如: `custom-image-gen/submit`
- 实际请求URL为: `/pass/custom-image-gen/submit`

#### 上游任务提交响应
```json
{ 
  "code": 0,
  "msg": "success",
  "data": {
    "task_id": "unique_task_id"
    "status": "processing"
    "progress": "0%"
  },
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30,
    "prompt_tokens_details": {
      "cached_tokens": 0,
      "text_tokens": 10,
      "audio_tokens": 0,
      "image_tokens": 0
    },
    "completion_tokens_details": {
      "text_tokens": 20,
      "audio_tokens": 0,
      "reasoning_tokens": 0
    }
  },
  
}
```

参数说明
- `code`,必须, 0表示成功，非0表示失败，可以使int或string
- `message | msg`,必须, 错误信息，优先获取message字段，如果不存在则获取msg字段，成功时可以为null
- `data`,必须, 任务数据，包括task_id, status, progress
  - `task_id`,必须, 任务id，用于查询任务状态
  - `status`,必须, 任务状态，参考3.2任务状态管理
  - `progress`,非必须, 任务进度，格式为百分比字符串，如"50%"
- `usage`,非必须, 任务消耗的token数，用于计费，如果没有预扣费，将此值作为预扣费计算
  - 格式与同步接口的usage格式相同
  - 最少需要包含`prompt_tokens`、`completion_tokens`、`total_tokens`
  - 详细分类字段为可选

#### 任务查询上游接口说明

**上游接口要求**：
- **接口路径**: `POST {base_url}/{model_without_submit}/task/list-by-condition`
- **功能**: 批量查询任务状态和结果
- **调用方**: CustomPass系统内部自动调用，如果用户需要调用可以配置模型

**上游接口请求格式**：
```json
{
  "task_ids": ["task_id_1", "task_id_2", "task_id_3"]
}
```

**请求参数说明**：
- `task_ids`: 必须，字符串数组，包含需要查询的任务ID列表
- 支持批量查询，提高查询效率
- CustomPass系统会定时调用此接口轮询任务状态

**上游接口响应格式**：
```json
{
  "code": 0,
  "msg": "success", 
  "data": [
    {
      "task_id": "task_id_1",
      "status": "completed",
      "progress": "100%",
      "error": null,
      "result": {
        "output": "任务执行结果",
        "metadata": {}
      },
      "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 20,
        "total_tokens": 30,
        "prompt_tokens_details": {
          "cached_tokens": 0,
          "text_tokens": 10,
          "audio_tokens": 0,
          "image_tokens": 0
        },
        "completion_tokens_details": {
          "text_tokens": 20,
          "audio_tokens": 0,
          "reasoning_tokens": 0
        }
      }
    },
    {
      "task_id": "task_id_2",
      "status": "processing",
      "progress": "50%",
      "error": null,
      "result": null,
      "usage": null
    },
    {
      "task_id": "task_id_3",
      "status": "failed",
      "progress": "0%", 
      "error": "Invalid input parameters",
      "result": null,
      "usage": null
    }
  ]
}
```

**响应字段说明**：
- `code`: 必须，整数或字符串，0表示接口调用成功，非0表示失败
- `message | msg`: 必须，字符串，接口调用的消息说明，优先获取message字段，如果不存在则获取msg字段
- `data`: 必须，数组，包含查询的任务信息
  - `task_id`: 必须，字符串，任务唯一标识
  - `status`: 必须，字符串，任务状态（参考3.3节状态映射配置）
  - `progress`: 可选，字符串，任务进度百分比，如"50%"
  - `error`: 可选，字符串，任务失败时的错误信息
  - `result`: 可选，任意类型，任务完成时的结果数据
  - `usage`: 可选，对象，任务的实际资源使用量
    - 完成的任务：必须提供usage用于最终结算
    - 进行中的任务：可以不提供usage
    - 失败的任务：不需要提供usage（系统自动退还预扣费）

**状态处理说明**：
- **已完成任务**（status=completed/success/finished）：
  - 必须提供`result`字段包含任务结果
  - 建议提供`usage`字段用于精确计费结算
  - 如果不提供usage，将使用提交时的预扣费作为最终费用
  
- **进行中任务**（status=processing/pending/running）：
  - 可选提供`progress`字段显示进度
  - `result`和`usage`字段应为null
  
- **失败任务**（status=failed/error/cancelled）：
  - 必须提供`error`字段说明失败原因
  - `result`和`usage`字段应为null
  - 系统将自动退还所有预扣费用

**调用频率和超时**：
- CustomPass系统会根据`CUSTOM_PASS_POLL_INTERVAL`配置的间隔（默认30秒）定时调用
- 单次查询请求超时时间由`CUSTOM_PASS_TASK_TIMEOUT`配置（默认15秒）
- 上游接口应确保能够稳定响应批量查询请求





## 6. 计费机制

CustomPass支持三种计费方式：免费、按量计费、按次计费。系统根据模型在ability中的配置和定价设置来确定计费策略。

### 6.1 计费策略判断

#### 6.1.1 免费模式
- **条件**: 模型没有在ability中配置，或模型标记为免费
- **行为**: 不记录消费日志，不产生费用
- **使用场景**: 测试模型、公共服务模型

#### 6.1.2 按量计费 (Usage-based)
- **条件**: 模型在ability中配置，且只配置了倍率(multiplier)，没有固定价格
- **行为**: 根据实际token使用量计费
- **要求**: 上游API必须返回usage信息，否则报错
- **价格计算**: 
  - `提示价格 = 模型基础提示价格 × 模型倍率 × 模型分组倍率`
  - `补全价格 = 模型基础补全价格 × 补全倍率 × 模型分组倍率`
- **费用计算**: `费用 = (prompt_tokens × 提示价格 + completion_tokens × 补全价格) × 用户分组倍率`

#### 6.1.3 按次计费 (Per-request)
- **条件**: 模型配置了固定价格，无论是否配置倍率
- **行为**: 每次调用收取固定费用
- **费用计算**: `费用 = 固定价格 × 模型分组倍率 × 用户分组倍率`

#### 6.1.4 配置错误处理
- **条件**: 模型在ability中但既没有配置价格也没有配置倍率
- **行为**: 系统报错，拒绝请求

### 6.2 预扣费机制

预扣费是CustomPass渠道的内部标准流程，所有请求都会经过预扣费处理。

#### 6.2.1 预扣费流程
CustomPass系统内部会自动执行预扣费流程：

1. **确定预扣费金额**：
   - 按量计费：系统内部向上游发送带`?precharge=true`的请求获取预估usage
   - 按次计费：直接使用固定价格
   - 免费模型：跳过预扣费

2. **执行预扣费**：
   - 从用户`quota`中扣除相应金额
   - 确保用户有足够余额

3. **处理请求**：
   - 如果上游支持预扣费（返回`type=precharge`）：系统内部再次调用执行真实请求
   - 如果上游不支持预扣费：第一次调用即为真实请求

4. **最终结算**：
   - 根据实际消耗进行结算，多退少补

#### 6.2.2 预扣费响应判断
系统根据上游API响应中的`type`字段判断是否为预扣费：

**上游预扣费响应格式：**
```json
{
  "code": 0,
  "msg": "success",
  "type": "precharge",
  "usage": {
    "prompt_tokens": 100,        // 必须：预估输入token数
    "completion_tokens": 200,    // 必须：预估输出token数  
    "total_tokens": 300,         // 必须：预估总token数
    "prompt_tokens_details": {   // 可选：详细分类
      "cached_tokens": 0,
      "text_tokens": 100,
      "audio_tokens": 0,
      "image_tokens": 0
    },
    "completion_tokens_details": { // 可选：详细分类
      "text_tokens": 200,
      "audio_tokens": 0,
      "reasoning_tokens": 0
    }
  }
}

// CustomPass系统根据此usage进行预扣费：
// 预扣费用 = (100 × 提示价格 + 200 × 补全价格) × 分组倍率
```

**上游直接执行响应格式：**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    // 实际结果
  },
  "usage": {
    "prompt_tokens": 80,         // 必须：实际输入token数
    "completion_tokens": 150,    // 必须：实际输出token数
    "total_tokens": 230,         // 必须：实际总token数
    "prompt_tokens_details": {   // 可选：详细分类
      "cached_tokens": 10,
      "text_tokens": 70,
      "audio_tokens": 0,
      "image_tokens": 0
    },
    "completion_tokens_details": { // 可选：详细分类
      "text_tokens": 150,
      "audio_tokens": 0,
      "reasoning_tokens": 0
    }
  }
}

// CustomPass系统根据此usage进行最终结算：
// 最终费用 = (80 × 提示价格 + 150 × 补全价格) × 分组倍率
```

### 6.3 结算流程

**重要说明**：`?precharge=true`参数是**系统保留的查询参数**，仅供CustomPass系统内部向上游API发起请求时使用。如果客户端请求中包含此参数，系统将报错。

#### 6.3.1 同步接口结算

**客户端请求流程**：
```
客户端发起请求 → CustomPass系统内部处理 → 返回最终结果
POST /pass/{model}     (系统内部自动处理预扣费)    给客户端的响应
```

**CustomPass系统内部处理流程**：
```
1. 系统内部向上游发起预扣费请求（带precharge参数）
   ├── 返回type=precharge → 执行预扣费 → 发起真实请求 → 使用真实请求的usage结算
   └── 未返回type=precharge → 直接执行 → 使用返回的usage结算

2. 系统内部向上游发起真实请求（不带precharge参数）
   └── 直接执行 → 使用返回的usage结算
```

#### 6.3.2 异步接口结算

**客户端请求流程**：
```
客户端提交任务 → 系统返回task_id → 客户端查询任务状态
POST /pass/{model}/submit              POST /pass/{model}/task/list-by-condition
```

**CustomPass系统内部处理流程**：
```
1. 任务提交阶段（系统内部处理）
   ├── 向上游发起预扣费请求（带precharge参数）→ 如果返回type=precharge，使用usage进行预扣费
   └── 向上游发起真实请求（不带precharge参数）→ 使用返回的usage进行预扣费

2. 任务完成阶段（系统内部轮询）
   ├── 任务查询接口返回usage → 使用查询返回的usage作为最终结算
   ├── 任务查询接口无usage → 使用预扣费金额作为最终结算
   └── 任务失败 → 自动退还所有预扣费用
```

### 6.4 计费场景示例

#### 6.4.1 按量计费 + 预扣费
**倍率设定**：参考6.7.1节价格计算示例
- 模型倍率: 2.0
- 补全倍率: 1.5
- 用户分组倍率: 0.8

**计费计算**：基于系统内置基础价格（固定值）
- 基础价格 = 1.0 quota/token（对应 QuotaPerUnit=500,000 quota/1$）
- 提示单价 = 1.0 × 2.0 = 2.0 quota/token
- 补全单价 = 1.0 × 2.0 × 1.5 = 3.0 quota/token

```json
// 客户端正常调用（不带precharge参数）
POST /pass/custom-text-pro

// 系统内部处理流程（对客户端透明）：

// 1. CustomPass系统内部向上游发送预扣费请求
POST {upstream_baseurl}/custom-text-pro?precharge=true

// 2. 预扣费响应
{
  "type": "precharge",
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 80,
    "total_tokens": 100
  }
}

// 3. 系统预扣费: 
//    基础token费用 = (20 × 2.0 + 80 × 3.0) = (40 + 240) = 280 quota
//    最终费用 = 280 × 0.8 = 224 quota
//    系统四舍五入: 224.0 → 224 quota
//    估算费用 = 224 / 500,000(QuotaPerUnit) = $0.000448

// 4. CustomPass系统内部向上游发送真实请求
POST {upstream_baseurl}/custom-text-pro

// 5. 真实响应
{
  "data": {...},
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 60,
    "total_tokens": 80
  }
}

// 6. 最终结算: 
//    基础token费用 = (20 × 2.0 + 60 × 3.0) = (40 + 180) = 220 quota
//    最终费用 = 220 × 0.8 = 176 quota
//    系统四舍五入: 176.0 → 176 quota
//    实际费用 = 176 / 500,000(QuotaPerUnit) = $0.000352
//    退还quota = 224 - 176 = 48 quota
//    退还费用 = 48 / 500,000(QuotaPerUnit) = $0.000096
```

#### 6.4.2 按次计费
**倍率设定**：
- 模型固定价格: 5.0 美元
- 用户分组倍率: 0.8

```json
// CustomPass系统向上游发送请求
POST {upstream_baseurl}/custom-image

// 响应
{
  "data": {...}
}

// 结算: 
//    最终费用 = 5.0 × 0.8 = 4.0 美元
//    计算quota = 4.0 × 500,000(QuotaPerUnit) = 2,000,000 quota
//    系统四舍五入: 2,000,000 → 2,000,000 quota (已是整数)
```

#### 6.4.3 异步任务计费
**倍率设定**：
- 模型倍率: 1.0
- 补全倍率: 1.0
- 用户分组倍率: 0.9

```json
// 1. CustomPass系统向上游提交任务
POST {upstream_baseurl}/custom-image-gen/submit

// 2. 提交响应
{
  "data": {"task_id": "abc123"},
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 40,
    "total_tokens": 50
  }
}

// 3. 预扣费: 
//    基础token费用 = (10 × 1.0 + 40 × 1.0) = 50 quota
//    预扣费用 = 50 × 0.9 = 45 quota
//    系统四舍五入: 45.0 → 45 quota

// 4. 任务查询（完成后）
{
  "data": [{
    "task_id": "abc123", 
    "status": "completed",
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 35,
      "total_tokens": 45
    }
  }]
}

// 5. 最终结算: 
//    基础token费用 = (10 × 1.0 + 35 × 1.0) = 45 quota
//    实际费用 = 45 × 0.9 = 40.5 quota
//    系统四舍五入: 40.5 → 41 quota
//    退还quota = 45 - 41 = 4 quota
```

### 6.5 费用计算公式

#### 6.5.1 按量计费倍率计算顺序

**第一步：计算单价**
```
提示单价 = 基础价格 × 模型倍率 × 模型分组倍率
补全单价 = 基础价格 × 补全倍率 × 模型分组倍率
```

**第二步：计算基础token费用**
```
基础提示费用 = prompt_tokens × 提示单价
基础补全费用 = completion_tokens × 补全单价
基础token费用 = 基础提示费用 + 基础补全费用
```

**第三步：处理特殊token（如有）**
```
缓存token费用 = cache_tokens × 基础价格 × 模型倍率 × 缓存倍率 × 模型分组倍率
图像token费用 = image_tokens × 基础价格 × 模型倍率 × 图像倍率 × 模型分组倍率
音频token费用 = audio_tokens × 基础价格 × 模型倍率 × 音频倍率 × 模型分组倍率
```

**第四步：应用用户分组倍率**
```
最终费用 = (基础token费用 + 缓存token费用 + 图像token费用 + 音频token费用) × 用户分组倍率
```

**第五步：转换为quota并四舍五入**
```
计算quota = 最终费用 × QuotaPerUnit
实际quota = Round(计算quota)  // 系统四舍五入到整数
```

**详细说明**:
- **倍率计算顺序**: 严格按照 `基础价格 → 模型倍率 → 模型分组倍率 → 用户分组倍率` 的顺序执行
- **基础价格**: 系统内置固定值，当前为 1.0 quota/token（对应 QuotaPerUnit=500,000）
- **模型倍率**: 针对特定模型设置的倍率，影响该模型的基础价格
- **补全倍率**: 针对输出token的额外倍率，通常大于1.0
- **用户分组倍率**: 用户分组的计费倍率，影响不同用户的最终价格
- **特殊token倍率**: 缓存、图像、音频等特殊token的专用倍率
- **四舍五入精度**: 所有quota计算结果都会四舍五入到整数，确保数据库存储的一致性

#### 6.5.2 按次计费倍率计算顺序

**第一步：应用倍率**
```
最终费用 = 模型固定价格 × 模型分组倍率 × 用户分组倍率
```

**第二步：转换为quota并四舍五入**
```
计算quota = 最终费用 × QuotaPerUnit
实际quota = Round(计算quota)  // 系统四舍五入到整数
```

**详细说明**:
- **倍率计算顺序**: 严格按照 `模型固定价格 → 模型分组倍率 → 用户分组倍率` 的顺序执行
- **模型固定价格**: 在模型配置中设置的固定价格（单位：美元）
- **用户分组倍率**: 影响不同用户的最终价格
- **四舍五入精度**: 所有quota计算结果都会四舍五入到整数

### 6.6 Quota机制与数据库存储

#### 6.6.1 Quota计算和存储
系统中所有费用都以**quota**为单位存储在数据库中，quota是系统内部的计费单位。

**重要说明**: 系统中quota字段在数据库中为`int`类型，所有计算结果都会进行**四舍五入**处理后存储。

**Quota转换关系**:
```
1 美元 = 500,000(QuotaPerUnit) quota
1 quota = 0.000002 美元
```

**费用转quota公式**:
```
计算quota = 费用(美元) × 500,000(QuotaPerUnit)
实际存储quota = Round(计算quota)  // 四舍五入到整数
```

#### 6.6.2 数据库存储结构
系统使用以下表结构来存储quota相关数据：

```sql
-- 用户配额表 (users)
用户ID: id (INT)
用户名: username (VARCHAR)
当前剩余quota: quota (INT DEFAULT 0)
已使用quota: used_quota (INT DEFAULT 0)
请求次数: request_count (INT DEFAULT 0)
用户分组: group (VARCHAR DEFAULT 'default')

-- 消费记录表 (logs)
记录ID: id (INT)
用户ID: user_id (INT)
用户名: username (VARCHAR)
令牌名称: token_name (VARCHAR)
模型名称: model_name (VARCHAR)
消费quota: quota (INT DEFAULT 0)  -- 本次消费的quota
输入token数: prompt_tokens (INT DEFAULT 0)
输出token数: completion_tokens (INT DEFAULT 0)
使用时长: use_time (INT DEFAULT 0)
渠道ID: channel_id (INT)
令牌ID: token_id (INT DEFAULT 0)
用户分组: group (VARCHAR)
创建时间: created_at (BIGINT)
日志类型: type (INT)
其他信息: other (TEXT)
```

**重要说明**：
- 系统**没有单独的预扣费记录表**
- 预扣费操作直接在 `users.quota` 字段上进行临时扣除
- 最终结算时根据实际消费进行补扣或退还
- 所有预扣费和最终结算的详细信息记录在 `logs` 表中

#### 6.6.3 Quota操作流程

**预扣费流程**:
```sql
-- 1. 计算预扣费quota
SET @precharge_quota = @estimated_cost * 500000(QuotaPerUnit);

-- 2. 检查余额
SELECT quota FROM users WHERE id = @user_id;

-- 3. 预扣费
UPDATE users SET quota = quota - @precharge_quota WHERE id = @user_id;
```

**最终结算流程**:
```sql
-- 1. 计算实际费用quota
SET @actual_quota = @actual_cost * 500000(QuotaPerUnit);
SET @refund_quota = @precharge_quota - @actual_quota;

-- 2. 退还差额(如果预扣费大于实际费用)
UPDATE users SET quota = quota + @refund_quota WHERE id = @user_id;

-- 3. 记录消费日志
INSERT INTO logs (user_id, model_name, prompt_tokens, completion_tokens, quota) 
VALUES (@user_id, @model, @prompt_tokens, @completion_tokens, @actual_quota);
```

### 6.7 价格计算示例

#### 6.7.1 倍率价格计算
假设模型custom-text-pro的倍率配置为:
- 模型倍率: 2.0
- 补全倍率: 1.5
- 用户分组倍率: 0.8

基于系统内置基础价格:
- 系统基础价格: 1.0 quota/token（固定值：500,000 quota/1美元）

**按照修正后的计算顺序**:

**第一步：计算单价**
```
提示单价 = 1.0 × 2.0 × 1.0 = 2.0 quota/token  # 基础价格 × 模型倍率 × 模型分组倍率
补全单价 = 1.0 × 1.5 × 1.0 = 1.5 quota/token  # 基础价格 × 补全倍率 × 模型分组倍率
```

**第二步：计算基础token费用**
```
使用量: prompt_tokens=1000, completion_tokens=500
基础提示费用 = 1000 × 2.0 = 2000 quota
基础补全费用 = 500 × 1.5 = 750 quota
基础token费用 = 2000 + 750 = 2750 quota
```

**第三步：应用用户分组倍率**
```
最终费用 = 2750 × 0.8 = 2200 quota
系统四舍五入: 2200.0 → 2200 quota (已是整数)
```

### 6.8 消费日志记录

#### 6.8.1 记录条件
- **按量计费**: 必须记录消费日志（写入数据库logs表）
- **按次计费**: 必须记录消费日志（写入数据库logs表）  
- **免费模式**: 不记录消费日志（不写数据到数据库）

#### 6.8.2 数据库日志内容
写入数据库logs表的记录内容：

```json
{
  "id": 12345,
  "user_id": 123,
  "username": "user123",
  "token_name": "sk-xxx",
  "model_name": "custom-text-pro",
  "quota": 324,                    // 本次消费的quota (四舍五入后的整数)
  "prompt_tokens": 1000,
  "completion_tokens": 500,
  "use_time": 1500,               // 处理时间(毫秒)
  "is_stream": false,
  "channel_id": 51,               // CustomPass渠道ID
  "token_id": 456,
  "group": "default",             // 用户分组
  "ip": "192.168.1.1",
  "type": 2,                      // LogTypeConsume=2
  "content": "消费描述信息",
  "other": "{\"model_ratio\":0.864,\"model_group_ratio\":0.72,\"completion_ratio\":1.5,\"model_price\":0.0,\"user_group_ratio\":0.8,\"frt\":1200,\"admin_info\":{\"use_channel\":[\"channel_51\"]}}", // JSON字符串，存储计费详情
  "created_at": 1672531200        // Unix时间戳
}
```

**字段说明**：
- `quota`: 本次实际消费的quota（四舍五入后的整数）
- `other`: JSON字符串，存储计费详情和管理信息：
  - `model_ratio`: 模型倍率
  - `model_group_ratio`: 模型分组倍率  
  - `completion_ratio`: 补全倍率
  - `model_price`: 模型固定价格
  - `user_group_ratio`: 用户分组倍率
  - `frt`: 首次响应时间(毫秒)
  - `admin_info`: 管理信息（使用的渠道等）
- `type`: 日志类型，消费记录为 `LogTypeConsume=2`
- 所有token相关字段为实际消费的token数量


## 7. 配置管理

### 7.1 环境变量配置

#### 7.1.1 基础配置
```bash
# 自定义token header名称
CUSTOM_PASS_HEADER_KEY=X-Custom-Token
```

#### 7.1.2 状态映射配置
```bash
# 状态映射配置
CUSTOM_PASS_STATUS_SUCCESS=completed,success,finished
CUSTOM_PASS_STATUS_FAILED=failed,error,cancelled
CUSTOM_PASS_STATUS_PROCESSING=processing,pending,running
```

#### 7.1.3 轮询机制配置
```bash
# 轮询间隔（秒）- 默认30秒
CUSTOM_PASS_POLL_INTERVAL=30

# 单次查询超时时间（秒）- 默认15秒
CUSTOM_PASS_TASK_TIMEOUT=15

# 最大并发查询数 - 默认100
CUSTOM_PASS_MAX_CONCURRENT=100

# 任务最大生命周期（秒）- 默认3600秒（1小时）
CUSTOM_PASS_TASK_MAX_LIFETIME=3600

# 批量查询任务数限制 - 默认50个
CUSTOM_PASS_BATCH_SIZE=50

# 轮询服务启动延迟（秒）- 默认5秒
CUSTOM_PASS_POLL_START_DELAY=5

# 查询失败重试次数 - 默认3次
CUSTOM_PASS_QUERY_RETRY_COUNT=3

# 查询失败重试间隔（秒）- 默认10秒
CUSTOM_PASS_QUERY_RETRY_DELAY=10

# HTTP连接池大小 - 默认100
CUSTOM_PASS_HTTP_POOL_SIZE=100

# HTTP连接超时时间（秒）- 默认30秒
CUSTOM_PASS_HTTP_TIMEOUT=30

# 数据库连接池大小 - 默认50
CUSTOM_PASS_DB_POOL_SIZE=50

# 缓存过期时间（秒）- 默认300秒
CUSTOM_PASS_CACHE_EXPIRE=300

