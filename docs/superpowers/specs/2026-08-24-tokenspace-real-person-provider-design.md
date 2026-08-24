# TokenSpace 真人认证 Provider 接入设计

## 背景与问题

现有 `/v1/real-persons`、验证会话和真人素材接口已经具备本地档案、幂等、加密存储、轮询任务和素材生命周期管理，但上游实现只接受原生 BytePlus 渠道。渠道 106 当前保持 `DoubaoVideo` 类型，并通过显式素材配置使用 TokenSpace：

```json
{
  "provider": "tokenspace_material",
  "gateway_base_url": "https://api.tokenspace.net.cn",
  "group_id": "group-20260820100636-wrpk7"
}
```

因此渠道 106 调用真人认证时会在本地渠道能力检查阶段返回 `real_person_channel_unavailable`，请求尚未到达 TokenSpace。TokenSpace 文档实际提供了真人认证和真人素材所需接口，缺失的是 Flatkey 的 provider 适配，而不是上游能力。

TokenSpace 文档中的关键契约：

- `POST /api/material?Action=CreateVisualValidateSession`：空 JSON 请求，返回 `BytedToken`、有效期约 5 分钟的 `H5Link` 和 `QrCode`。
- `POST /api/material?Action=GetVisualValidateResult`：请求 `BytedToken`；认证完成后返回真人资产组 `GroupId`；未完成时通过错误消息表示，文档建议每 3 秒轮询、最长 5 分钟。
- 取得真人 `GroupId` 后，继续使用 `CreateAsset`、`GetAsset`、`ListAssets`、`DeleteAsset` 管理真人素材。
- `CreateVisualValidateSession` 创建的是真人资产组；普通 `CreateAssetGroup` 和渠道配置中的 `group_id` 是虚拟素材组，两者不能混用。

## 目标

- 不新增对外 API，继续使用现有 `/v1/real-persons` 接口、DTO、鉴权和错误格式。
- 渠道 106 保持 `DoubaoVideo` 类型，通过显式 `asset_materialization.provider=tokenspace_material` 启用 TokenSpace 真人认证。
- 把真人认证上游差异收口为可注册、可删除的 provider；原生 BytePlus 行为保持兼容。
- 支持 TokenSpace 认证创建、认证结果轮询、URL 素材创建、素材状态查询、素材列表和素材删除。
- 复用现有本地幂等账本、档案/会话/素材表、敏感字段加密和多实例后台任务，不引入数据库迁移。
- 通过指定渠道测试 key 的 `-106` 后缀把首次创建固定到渠道 106；档案创建后所有操作始终使用档案保存的 `ChannelId`。

## 非目标

- 本次不增加新的渠道类型；未来需要时只调整 provider 注册和选择条件。
- 不把 TokenSpace 的二维码或 `BytedToken` 暴露给客户端。
- 不使用 `CreateRealValidateH5` 代替现有验证会话流程；该接口是 TokenSpace 自带的综合管理页，不提供 Flatkey 所需的会话状态归属契约。
- 不删除、重命名现有带 `BytePlus` 前缀的数据库表、模型或公开 DTO。
- 不在本次接入中为 TokenSpace 增加 multipart 临时对象存储。TokenSpace `CreateAsset` 只接受公网 URL；URL 创建接口完整支持，multipart 在没有 BytePlus TOS 凭据时继续返回现有的存储不可用错误。
- 不自动给 TokenSpace 上游 key 开通模型权限；`seedance-2.5`、`seedance-2.0-fast`、`seedance-2.0-mini` 的 `TokenModelForbidden` 仍需上游授权处理。

## 方案选择

采用 provider 注册边界（方案 A），由通用真人服务负责状态机和持久化，由 provider 负责渠道识别、凭据绑定、验证会话和素材 API。

不采用以下方案：

- 在原生 BytePlus 客户端中按渠道 106 写条件分支：耦合具体渠道 ID，未来拆除和新增同类渠道都需要修改核心状态机。
- 立即新增渠道类型：变更面会扩大到后台表单、渠道路由、常量和迁移；当前显式 provider 配置已能稳定识别 TokenSpace。

## 架构边界

### 通用真人服务

现有 service 层继续拥有：

- 用户、分组和指定渠道校验；
- 创建和重新认证的幂等 claim/replay/resume；
- 档案、验证会话和素材的数据库状态机；
- `BytedToken`、H5 链接和回调 token 的加密存储；
- 多实例安全的租约、CAS、轮询、重试和删除任务；
- 对外 DTO、HTTP 状态码和稳定错误码。

通用服务不再假设每个 provider 都需要 BytePlus AK/SK 或回调 URL。

### Provider 契约

内部 provider 由渠道配置解析后绑定凭据，向状态机提供统一能力：

```text
CreateVerification(callbackURL?) -> token, verificationURL, requestID, expiresAt
PollVerification(token)          -> pending | completed(groupID)
CreateAsset(groupID, URL, type, name) -> assetID, requestID
GetAsset(assetID)                -> normalized asset status
ListAssets(groupID, page)        -> normalized asset list
DeleteAsset(assetID)             -> assetID
```

provider 同时声明是否需要回调 URL。原生 BytePlus provider 需要 HTTPS 回调，继续使用 `BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL`；TokenSpace provider 为纯轮询，不读取也不验证该环境变量。

provider 返回统一的本地状态：

- TokenSpace `Pending`、`Processing` 映射为本地 `processing`；
- TokenSpace `Active` 映射为本地 `active`；
- TokenSpace `Failed` 映射为本地 `failed`；
- 未完成认证映射为 `pending`，不当作最终失败。

### Provider 注册与选择

选择顺序是确定性的：

1. 首次创建带指定渠道 ID 时，加载该渠道并检查分组和真人素材能力。
2. 若渠道显式配置 `asset_materialization.provider=tokenspace_material`，使用 TokenSpace provider。
3. 否则仅当渠道满足现有原生 BytePlus 条件时使用 BytePlus provider。
4. 首次创建没有指定渠道 ID 时，本版本仍只参与现有 BytePlus 自动路由；TokenSpace 不进入随机候选，防止不同上游 provider 被意外选中。
5. 档案建立后，重新认证、轮询、素材状态和删除任务只加载档案或素材记录中的固定 `ChannelId`，不重新路由。

渠道 106 因此通过测试 key 的 `<key>-106` 形式进入 TokenSpace provider，而不是在代码中硬编码 `106`。

### 凭据一致性

真人认证生成的 `GroupId` 与创建会话时使用的 TokenSpace API key 绑定。现有档案只保存 `ChannelId`，没有 key 索引，因此本版本要求 TokenSpace 真人渠道恰好有一个启用 key：

- 单 key：provider 绑定该 key，并用于认证、轮询和后续素材操作。
- 零 key或多 key：渠道能力检查失败并返回现有的渠道不可用错误，不随机选择、不静默降级。

这避免新增数据库字段和迁移，也避免轮询或后台任务因 key 轮换到另一上游账号而找不到真人资产组。未来若要支持多 key，应单独设计并持久化稳定 key 身份。

## TokenSpace 传输实现

TokenSpace provider 使用渠道显式配置解析出的 `gateway_origin`，固定请求路径 `/api/material`，通过 `Action` 查询参数选择操作，使用 `Authorization: Bearer <channel-key>` 和 JSON 请求体。

操作映射：

| 通用操作 | TokenSpace Action | 请求关键字段 | 成功结果 |
| --- | --- | --- | --- |
| 创建验证 | `CreateVisualValidateSession` | `{}` | `BytedToken`、`H5Link`、`QrCode` |
| 查询验证 | `GetVisualValidateResult` | `BytedToken` | `GroupId` |
| 创建素材 | `CreateAsset` | `GroupId`、`URL`、`Name`、`AssetType` | `Id` |
| 查询素材 | `GetAsset` | `Id` | 素材详情和状态 |
| 列出素材 | `ListAssets` | `Filter.GroupType=LivenessFace`、`Filter.GroupIds=[GroupId]`、分页 | `Items`、`TotalCount` |
| 删除素材 | `DeleteAsset` | `Id` | `Id` |

现有普通素材 provider 的 HTTP、代理、响应解码和安全错误分类逻辑应复用或提取为共享 transport，避免复制 Bearer 请求实现。所有 JSON 编解码继续使用仓库 `common` 包装函数。

响应必须同时检查 HTTP 状态和业务错误。日志只记录稳定上游错误码、HTTP 状态和 request ID，不记录 API key、`BytedToken`、H5 签名链接、二维码或用户素材 URL。

## 数据与生命周期

### 创建和认证

1. 客户端携带 `Idempotency-Key` 调用 `POST /v1/real-persons`，并通过测试 key 的 `-106` 后缀指定渠道。
2. 通用服务完成本地幂等 claim，创建档案和验证会话。
3. TokenSpace provider 创建认证会话；回调 URL 为空且不会校验回调基础地址。
4. `BytedToken` 和 H5 链接分别写入现有加密字段；`QrCode` 丢弃；会话过期时间按文档设置为创建后 300 秒。
5. 首次响应只返回现有一次性 `verification_url` 和 `verification_expires_at`。
6. 用户本人在 H5 页面完成认证；Flatkey 的读取接口和后台任务用加密保存的 `BytedToken` 轮询。
7. `GetVisualValidateResult` 返回 `GroupId` 后，用现有 CAS 激活档案并保存到 `UpstreamGroupId`。

### 真人素材

- 创建素材始终将档案的 `UpstreamGroupId` 传给 `CreateAsset`。
- 渠道配置中的普通素材 `group_id` 永远不进入真人素材请求。
- 列表请求同时指定 `GroupType=LivenessFace` 和档案 `GroupId`，并继续由本地公共 ID 游标控制外部分页语义。
- 状态同步和删除后台任务使用素材记录保存的 `ChannelId`，provider 将 TokenSpace 状态和 not-found 语义归一化到现有任务逻辑。
- URL 上传支持 `Image`、`Video`、`Audio`，保持现有校验；实际能否作为 Seedance 真人参考素材由上游审核状态和模型能力决定。

## 错误与重试

- 配置缺失、provider 不支持、多 key 或渠道能力不匹配：返回现有 `real_person_channel_unavailable` / `asset_channel_unavailable`。
- 创建会话、创建素材已进入上游但结果不确定：沿用现有 `idempotency_outcome_unknown`，防止自动重复创建。
- 可判定的上游 4xx 业务拒绝：沿用现有 `verification_upstream_error` 或 `asset_upstream_error`。
- 认证未完成：provider 返回 `pending`，读取路径不向用户暴露 TokenSpace 原始错误消息，后台任务按既有退避继续轮询。
- 超时、网络和上游 5xx：按现有重试/租约规则处理，不在请求内无限轮询。
- TokenSpace H5 超过 300 秒后，现有过期流程将档案标为可重新认证状态。

## 安全边界

- API key 只从渠道配置读取，不写入档案、任务、报告或日志。
- `BytedToken` 和 H5 链接继续使用现有敏感字段 cipher 加密；响应重放仅在有效期内解密 H5。
- 认证必须由用户本人在 TokenSpace H5 完成，不代填、不伪造、不上传未经授权的人脸或证件。
- 所有读取和素材操作继续校验档案归属用户，不能通过公共 ID 跨用户访问。
- gateway 必须来自通过现有校验的 HTTPS origin，路径固定为 `/api/material`，避免用户输入任意请求路径。

## 测试策略

先增加失败测试，再实现 provider：

- provider 选择：显式 TokenSpace 配置可用；无显式配置不误选；非指定渠道不进入 TokenSpace 自动路由；多 key 拒绝；原生 BytePlus 回归不变。
- 回调差异：TokenSpace 在未设置 BytePlus 回调环境变量时仍能创建会话；BytePlus 仍要求合法 HTTPS 回调。
- TokenSpace transport：六个 Action、Bearer 鉴权、请求字段、业务错误、HTTP 错误、缺失字段、敏感值不泄漏。
- 会话生命周期：300 秒过期、加密持久化、幂等 replay/resume、未完成轮询、完成后保存真人 `GroupId`。
- 真人素材：`CreateAsset` 使用档案 `GroupId` 而非配置 `group_id`；`ListAssets` 使用 `LivenessFace`；状态映射和删除 not-found 幂等。
- 后台任务：认证、素材状态和删除任务能重新解析 TokenSpace provider，并保持租约/CAS 行为。
- multipart：TokenSpace 无 TOS 凭据时维持明确的存储不可用响应；URL 创建成功路径不受影响。
- 回归：现有 BytePlus 真人认证、普通 TokenSpace 素材物化、controller 和 model 测试全部通过。

实现后进行两层验证：

1. 本地 targeted Go tests、相关 package tests 和可运行的 build/test 检查。
2. 部署到可测试环境后，用 `Seedance Domestic` 测试 key 指定 `-106` 创建认证会话；只检查返回结构和 URL 域名，不记录完整 URL。真人完成认证后，再验证 profile 变为 `active`、URL 素材创建/查询/列表/删除，以及 `asset://<id>` 能进入 Seedance 请求。

## 部署、回滚与拆除

本次后端 `/v1` 行为变化需要部署 router 服务。数据库无迁移，回滚只需回滚代码版本。

拆除 TokenSpace 支持时：

1. 移除 TokenSpace 真人 provider 文件及其注册项。
2. 保留通用 provider 接口和原生 BytePlus adapter；现有 BytePlus 行为不受影响。
3. 渠道上的 `asset_materialization.provider=tokenspace_material` 仍可继续服务普通素材；只有真人认证能力恢复为不可用。

若未来新增 TokenSpace 专用渠道 type，只需让该 type 注册到同一 TokenSpace provider，并按迁移策略逐步替换显式配置选择；对外 API、档案数据和真人 `GroupId` 不需要改写。

## 验收标准

- 渠道 106 保持 `DoubaoVideo`，无需硬编码渠道 ID，即可通过指定渠道 key 创建 TokenSpace 真人验证链接。
- 返回给客户端的地址是 TokenSpace `H5Link`，仅在有效期内出现；不返回 `BytedToken` 或二维码。
- 完成认证后，档案保存 TokenSpace 返回的真人 `GroupId` 并变为 `active`。
- 真人素材 CRUD 使用该真人 `GroupId`，从不使用渠道配置的虚拟 `group_id`。
- 认证轮询、素材状态和删除后台任务在多实例下继续满足现有租约/CAS 约束。
- TokenSpace 多 key 渠道失败关闭，原生 BytePlus 和普通素材物化测试无回归。
- 删除 TokenSpace provider 注册后，核心真人状态机仍可编译并由 BytePlus provider 工作。
