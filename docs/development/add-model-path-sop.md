# 新增模型 Path / Endpoint Type SOP

本文档描述如何在 `new-api` 中新增一种新的模型调用 path，并让它同时体现在：

- 模型元数据
- `/api/pricing` 的 `supported_endpoint`
- 管理后台模型编辑页
- 必要时的真实请求转发链路

本文用当前已经接入的 `seedance-video-native` 作为示例。

它代表的不是一个模型名，而是一种“端点类型”：

- key: `seedance-video-native`
- 主路径：`POST /api/v3/contents/generations/tasks`
- 查询路径：`GET /api/v3/contents/generations/tasks/{task_id}`

## 1. 先分清你要加的是哪一种 path

新增 path 之前，先分清楚需求属于哪一类。

### A. 只需要“展示给用户看”

例如：

- 模型广场要显示这个模型支持哪个 endpoint
- 模型编辑页要能快速填一个 endpoint 模板

这种情况下，通常只需要新增一个 `EndpointType`，不一定需要真实接管该路径。

### B. 需要真正对外提供这个 path

例如：

- 用户真的要请求这个 URL
- 你的网关要接受这个 path
- 收到请求后还要做格式转换，再转发给内部 `new-api`

`seedance-video-native` 实际上属于这一类。

所以它不仅有“显示层定义”，还配了：

- 网关转发
- compatibility service
- adaptor 逻辑

## 2. 新增一个 EndpointType

第一步是定义新的 endpoint type 常量。

参考：

- `constant/endpoint_type.go`

示例：

```go
const (
    EndpointTypeSeedanceVideoNative EndpointType = "seedance-video-native"
)
```

命名建议：

- 字符串值用于 API 输出和前端配置，尽量稳定
- 不要轻易改，改了会影响已有元数据和前端保存值

## 3. 给这个 EndpointType 定义默认 path

第二步是在默认 endpoint map 里补路径和方法。

参考：

- `common/endpoint_defaults.go`

`seedance-video-native` 当前定义：

```go
constant.EndpointTypeSeedanceVideoNative: {
    Path:   "/api/v3/contents/generations/tasks",
    Method: "POST",
    Aliases: []EndpointInfo{
        {Path: "/api/v3/contents/generations/tasks/{task_id}", Method: "GET"},
    },
},
```

这里的作用是：

- `/api/pricing` 可以把该类型的默认 path 返回给前端
- 模型元数据没手写 endpoint 时，也能有默认值

如果你的新 path 还有查询、取消、下载等衍生接口，建议放进 `Aliases`。

## 4. 把它挂到渠道类型或模型类型上

第三步是决定哪些渠道、哪些模型应该声称自己支持这个 endpoint type。

参考：

- `common/endpoint_type.go`

`seedance-video-native` 当前做法：

```go
case constant.ChannelTypeDoubaoVideo:
    endpointTypes = []constant.EndpointType{
        constant.EndpointTypeOpenAIVideo,
        constant.EndpointTypeSeedanceVideoNative,
    }
```

这一步的效果是：

- 某渠道类型下的模型，`supported_endpoint_types` 会包含这个新类型
- `/api/pricing` 里能看到它

如果你的新 path 只属于某个特定渠道类型，挂这里最合适。

如果它只属于某个模型族，而不是整个渠道类型，就要再补模型级判断。

## 5. 补前端模板，方便后台录入

如果不补这一步，后台虽然能手写 JSON，但不好维护。

需要同时补两个地方：

- `web/src/components/table/models/modals/EditModelModal.jsx`
- `web/src/components/table/models/modals/EditPrefillGroupModal.jsx`

这两个文件里都有 `ENDPOINT_TEMPLATE`。

`seedance-video-native` 当前模板：

```json
{
  "seedance-video-native": {
    "path": "/api/v3/contents/generations/tasks",
    "method": "POST",
    "aliases": [
      {
        "path": "/api/v3/contents/generations/tasks/{task_id}",
        "method": "GET"
      }
    ]
  }
}
```

这样后台在编辑模型元数据或 endpoint 预填组时，可以一键插入模板。

## 6. 验证展示层是否生效

做到前 5 步后，先验证“展示链路”。

### 6.1 看 `/api/pricing`

检查返回里是否出现：

- `supported_endpoint.seedance-video-native`
- 目标模型的 `supported_endpoint_types` 包含 `seedance-video-native`

### 6.2 看后台模型编辑页

检查：

- 模型编辑弹窗的 endpoint 模板里能否看到新类型
- endpoint 预填组里能否插入该模板

如果这里只是“新增可展示 path”，做到这一步通常就够了。

## 7. 如果要真正支持该 path，再继续补转发链路

这一步是很多人会漏掉的。

“模型广场显示支持这个 path” 和 “服务真的能处理这个 path” 不是一回事。

### 7.1 适配器要真的会请求上游这个 path

参考：

- `relay/channel/task/doubao/adaptor.go`

`seedance-video-native` 相关实现包括：

- `BuildRequestURL()` 组装上游 `/api/v3/contents/generations/tasks`
- `FetchTask()` 组装上游查询路径
- `ConvertToOpenAIVideo()` 把上游任务结构转回系统统一格式

如果你的新 path 对应的是另一种原生协议，这里要补：

- 请求 URL
- Header
- Body 转换
- 结果解析
- 状态查询

### 7.2 如果对外 path 和系统内部 path 不一致，要补网关或 shim

参考：

- `deploy/newapi-local/gateway/nginx.conf`
- `deploy/newapi-local/seedance-compat/`

当前 `seedance-video-native` 的本地部署链路是：

1. 用户请求 `http://host/api/v3/contents/generations/tasks`
2. Nginx 把它转给 `seedance-compat`
3. `seedance-compat` 转成 `new-api` 能处理的内部请求
4. `new-api` 再走 Doubao 视频 adaptor 发上游

如果你的新 path 也需要“原生协议兼容”，通常要考虑是否单独做一个 shim service。

## 8. 什么时候只改 `EndpointType` 不够

以下情况，单改 `EndpointType` 一定不够：

- 用户会真的请求这个 path
- 请求体不是现有 OpenAI 兼容格式
- 返回体不是现有统一格式
- 有任务查询、状态轮询等附属接口

`seedance-video-native` 正好全中，所以除了 endpoint type，还补了：

- Doubao task adaptor
- gateway 路由
- compatibility service

## 9. 最小落地清单

新增一个新的模型 path，最少要检查下面这些点。

### 展示层最小集

1. `constant/endpoint_type.go`
2. `common/endpoint_defaults.go`
3. `common/endpoint_type.go`
4. `web/.../EditModelModal.jsx`
5. `web/.../EditPrefillGroupModal.jsx`

### 真实可调用最小集

在上面的基础上，再补：

6. 对应 adaptor 的请求/响应实现
7. 必要时的 router / gateway / shim service
8. 联调测试

## 10. `seedance-video-native` 现成示例

这次仓库里的实际落点如下。

### 定义与默认路径

- `constant/endpoint_type.go`
- `common/endpoint_defaults.go`
- `common/endpoint_type.go`

### 后台模板

- `web/src/components/table/models/modals/EditModelModal.jsx`
- `web/src/components/table/models/modals/EditPrefillGroupModal.jsx`

### 实际请求链路

- `relay/channel/task/doubao/adaptor.go`
- `deploy/newapi-local/gateway/nginx.conf`
- `deploy/newapi-local/seedance-compat/main.go`
- `deploy/newapi-local/seedance-compat/server.go`
- `deploy/newapi-local/seedance-compat/translate.go`

## 11. 验证 SOP

### 11.1 展示验证

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/pricing | Select-Object -ExpandProperty Content
```

重点检查：

- `supported_endpoint.seedance-video-native`
- 目标模型的 `supported_endpoint_types`

### 11.2 UI 验证

在后台：

1. 打开模型编辑
2. 打开 endpoint 模板
3. 确认能看到新类型

### 11.3 实际调用验证

如果这个 path 是真实可用的，对它发一条最小请求，确认：

- 网关能接收
- shim 或 adaptor 能正确转发
- 上游返回能正确落到系统统一任务结构

对于 `seedance-video-native`，至少要验证：

- `POST /api/v3/contents/generations/tasks`
- `GET /api/v3/contents/generations/tasks/{task_id}`

## 12. 常见坑

### 只改前端模板，没改后端默认 endpoint

后果：

- 模型编辑弹窗里能选
- `/api/pricing` 却没有这类 endpoint

### 只改 `supported_endpoint_types`，没补真实转发

后果：

- 模型广场看起来支持
- 用户实际请求直接 404 或格式不兼容

### 忘了别名接口

后果：

- 创建任务能用
- 查询任务状态不能用

### 把“模型名”当成“endpoint type”

后果：

- 元数据结构会混乱
- 后续扩展同类 path 难以维护

正确做法是：

- 模型名还是模型名
- path 类型单独用 `EndpointType`

## 13. 推荐顺序

建议按这个顺序做：

1. 先定义 `EndpointType`
2. 再补默认 path
3. 再决定挂到哪些渠道或模型上
4. 补后台模板
5. 先验证 `/api/pricing` 展示
6. 如果需要真实调用，再补 adaptor / gateway / shim
7. 最后做端到端请求验证
