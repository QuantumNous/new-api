# RunningHub 接口目录（知识文档）

> 来源：`https://www.runninghub.cn/runninghub-api-doc-cn/llms.txt` 对应文档目录（标准模型 API、应用 API、账号与资源 API）。
> 本目录用于 new-api 对接时的“接口地图 + 网关映射规则”。

## 1. 已在网关完成的对接能力

### 1.1 标准模型提交（统一）

- **网关入口**：`POST /v1/video/generations`（或现有 task 提交入口）
- **RunningHub 上游**：`POST /openapi/v2/{resource-path}`
- **映射方式**：
  - 默认取渠道模型映射后的 `upstream_model_name` 作为 `{resource-path}`
  - 若 `{resource-path}` 未带 `openapi/` 前缀，网关自动补全为 `openapi/v2/{resource-path}`
  - 请求体优先透传 `metadata`，并补充 `prompt/image/images/size/duration/seconds/input_reference`

### 1.2 查询任务结果（统一）

- **网关入口**：`GET /v1/video/generations/:task_id` 或 `GET /v1/videos/:task_id`
- **RunningHub 上游**：`POST /openapi/v2/query`
- **查询体**：`{"taskId":"..."}`（由网关把内部 task_id 映射为上游 taskId）
- **状态映射**：
  - `PENDING` -> `submitted`
  - `RUNNING` -> `in_progress`
  - `SUCCESS` -> `success`
  - `FAIL/FAILED/ERROR` -> `failure`

### 1.3 公共模型列表

- **网关入口**：渠道管理 `FetchModels`
- **RunningHub 上游**：`POST /openapi/v2/resource/list`
- **返回映射**：读取 `data.records[].resourceName` 作为可选模型名称

### 1.4 AI 应用三接口（已联调入口）

- **发起 AI 应用任务**  
  - 网关：`POST /api/channel/runninghub/ai_app/run`  
  - 上游：`POST /task/openapi/ai-app/run`  
  - 入参：`webapp_id`、`node_info_list`（与文档 `nodeInfoList` 对应），可选 `api_key`

- **获取 AI 应用 API 调用示例**  
  - 网关：`POST /api/channel/runninghub/ai_app/demo`  
  - 上游：`GET /api/webapp/apiCallDemo?apiKey&webappId`  
  - 入参：`webapp_id`，可选 `api_key`

- **获取公共模型列表（原始响应）**  
  - 网关：`POST /api/channel/runninghub/public_models`  
  - 上游：`POST /openapi/v2/resource/list`  
  - 入参：可选 `filter`（透传查询条件）

### 1.5 账户相关三接口（已联调入口）

- **获取账户信息**  
  - 网关：`POST /api/channel/runninghub/account/info`  
  - 上游：`POST /uc/openapi/accountStatus`  
  - 入参：可选 `api_key`（不传则默认使用渠道 key）

- **查询 APIKEY 列表**  
  - 网关：`POST /api/channel/runninghub/account/api_keys`  
  - 上游：`GET /openapi/v2/api-key/list`

- **查询指定 APIKEY 下队列状态**  
  - 网关：`POST /api/channel/runninghub/account/queue_status`  
  - 上游：`GET /openapi/v2/queue/status`

---

## 2. RunningHub 文档接口分组目录（按功能）

> 下面是对 llms 文档分组的“对接目录”。对于“标准模型 API”中的子接口，网关通过统一规则（`/openapi/v2/{resource-path}`）已覆盖，无需为每个子接口单独写一套 adaptor。

### 2.1 标准模型 API（已通过统一路径规则覆盖）

- 文生图 / 图生图 / 图像编辑
- 文生视频 / 图生视频 / 首尾帧视频
- 声音/音频相关模型
- 其他标准资源模型（以 `resourceName` 为准）

> 使用方法：在渠道模型映射中把模型名映射为 RunningHub 文档中的资源路径（如 `xxx/xxx`），网关会自动拼接到 `/openapi/v2/...`。

### 2.2 通用任务接口（已对接）

- 查询任务生成结果（V2）：`/openapi/v2/query`
- 公共资源列表：`/openapi/v2/resource/list`

### 2.3 AI 应用 API（目录层面已整理，按需走扩展映射）

- 获取公共模型列表
- 获取 AI 应用详情
- 提交 AI 应用任务
- 查询 AI 应用任务结果

### 2.4 账号/资源相关 API（目录层面已整理，按需走扩展映射）

- 上传文件
- 余额/套餐/用量相关
- 回调通知与任务管理相关接口

---

## 3. 网关配置建议（对接 RunningHub 子接口）

1. 新建渠道类型：`RunningHub`，`Base URL = https://www.runninghub.cn`
2. 在模型映射里把业务模型映射为 RunningHub 资源路径，例如：
   - `my-t2i-model -> youchuan/text-to-image-v61`
   - `my-video-model -> minimax/video-01`
3. 请求扩展字段全部放到 `metadata` 中（会透传到 RunningHub 上游请求体）
4. 通过统一任务查询接口轮询任务状态

---

## 4. 后续扩展位（已预留）

- 若你需要 **AI 应用 API / 上传 API / 回调管理 API** 在网关层有“独立入口路由”，可继续在 `controller` 中新增 RunningHub 专用路由，复用当前 adaptor 的 URL 拼接与鉴权逻辑。
