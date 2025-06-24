# CustomPass 任务查询 API 文档

## 概述

为 CustomPass 系统添加了类似 Midjourney 的直接任务查询功能，现在支持：

1. **单个任务查询** - 通过 task_id 查询特定任务状态
2. **批量条件查询** - 通过 task_ids 列表批量查询多个任务状态

## 新增接口

### 1. 单个任务查询

**接口地址：** `GET /pass/{model}/task/{task_id}/fetch`

**请求示例：**
```bash
curl -X GET "https://your-domain.com/pass/your-model/task/task_12345/fetch" \
  -H "Authorization: Bearer your-token"
```

**响应格式：**
```json
{
  "task_id": "task_12345",
  "status": "completed",
  "progress": "100%",
  "result": {
    // 任务结果数据
  }
}
```

**状态说明：**
- `completed` - 任务完成
- `failed` - 任务失败
- `processing` - 任务处理中
- `pendding` - 任务等待中

### 2. 批量条件查询

**接口地址：** `POST /pass/{model}/task/list-by-condition`

**请求体：**
```json
{
  "task_ids": ["task_12345", "task_67890", "task_abcde"]
}
```

**请求示例：**
```bash
curl -X POST "https://your-domain.com/pass/your-model/task/list-by-condition" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "task_ids": ["task_12345", "task_67890"]
  }'
```

**响应格式：**
```json
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "task_id": "task_12345",
      "status": "completed",
      "progress": "100%",
      "result": {
        // 任务结果数据
      }
    },
    {
      "task_id": "task_67890",
      "status": "processing",
      "progress": "50%"
    }
  ]
}
```

## 实现细节

### 新增的 RelayMode 常量

```go
RelayModeCustomPassTaskFetch              // 单个任务查询
RelayModeCustomPassTaskFetchByCondition   // 批量条件查询
```

### 路径解析逻辑

- `GET /pass/{model}/task/{task_id}/fetch` → `RelayModeCustomPassTaskFetch`
- `POST /pass/{model}/task/list-by-condition` → `RelayModeCustomPassTaskFetchByCondition`

### 状态转换

内部任务状态到 CustomPass 格式的转换：

| 内部状态 | CustomPass 状态 |
|---------|----------------|
| SUCCESS | completed |
| FAILURE | failed |
| IN_PROGRESS, QUEUED, SUBMITTED | processing |
| NOT_START | pendding |
| 其他 | unknown |

## 与 Midjourney 的对比

| 功能 | Midjourney | CustomPass |
|------|-----------|------------|
| 单个任务查询 | `GET /mj/task/:id/fetch` | `GET /pass/{model}/task/{task_id}/fetch` |
| 批量条件查询 | `POST /mj/task/list-by-condition` | `POST /pass/{model}/task/list-by-condition` |
| 响应格式 | Midjourney 专用格式 | CustomPass 标准格式 |
| 模型支持 | 固定 Midjourney | 支持任意模型名称 |

## 使用场景

1. **实时查询**：客户端可以直接查询任务状态，无需等待后台定时更新
2. **批量监控**：一次请求查询多个任务状态，提高效率
3. **状态同步**：与上游服务保持状态同步，提供准确的任务信息

## 注意事项

1. 查询接口只返回当前用户的任务
2. 不存在的任务在批量查询中会被跳过
3. 响应格式与 CustomPass 后台定时更新保持一致
4. 支持所有 CustomPass 支持的模型名称
