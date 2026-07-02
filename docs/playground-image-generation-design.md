# 操练场「图片操练场」设计方案（web/classic）

## 背景

当前操练场（`/console/playground`）只支持对话补全。遇到 image-generation / openai-video 类模型时，`web/classic/src/pages/Playground/index.jsx:268` 会拦截并弹 `UnsupportedModelModal`，提示用户自行调用 API（详见 `docs/playground-unsupported-model-design.md`）。

目标：补上这块能力。**先做图片生成**，参考并行智算云（Paratera）「图片模型」页的交互——左侧模型/尺寸参数、中间结果区、底部提示词输入、右侧历史记录。视频生成作为后续，本次只预留扩展接口。

## 决策

- 前端**仅 web/classic**（Semi Design）。default 适配延后到上游 v1.0.0 之后（项目约定）。
- 入口为**侧边栏独立菜单项**「图片操练场」，独立路由/页面，而非操练场页内 Tab。
- 鉴权**复用会话鉴权 `/pg`**，沿用 `controller.Playground` 的临时 token 模式，用户无需填 API key（不显示 key 输入框）。
- 本次交付图片生成，视频留接口（不建半成品页面 / 死菜单）。

## 现状链路（已完备，可直接复用）

图片中继：`POST /v1/images/generations` → `controller.Relay(c, types.RelayFormatOpenAIImage)` → `relay/image_handler.go: ImageHelper`。

DTO（`dto/openai_image.go`）：

- `ImageRequest`：`Model` / `Prompt`（必填）/ `N *uint` / `Size` / `Quality` / `ResponseFormat` / `Style` 等。
- `ImageResponse`：`Data []ImageData{ Url, B64Json, RevisedPrompt }` / `Created`。

会话操练场鉴权（`controller/playground.go:15-56`）：`UserAuth` 拿 session user id → `GetUserCache` 写 context → 构造临时 `Token` → `SetupContextForToken` → `Relay(...)`。路由组 `/pg`（`router/relay-router.go:65-71`）已带 `UserAuth + KYCRequired + Distribute` 中间件。

本次只需新增一条会话鉴权版 `/pg/images/generations` 复用上述图片中继。

## 后端改动

### 1. `controller/playground.go` — 新增图片处理器

当前 `Playground` 写死 `Relay(c, types.RelayFormatOpenAI)`（`playground.go:55`）。抽出共享逻辑：

- 提取私有函数 `playgroundRelay(c *gin.Context, format types.RelayFormat)`，把 `playground.go:16-55` 的逻辑（access token 拒绝、`GenRelayInfo(c, format, ...)`、user cache 写 context、临时 token `SetupContextForToken`、`Relay(c, format)`）参数化 `format`。
- `Playground` 改为 `playgroundRelay(c, types.RelayFormatOpenAI)`。
- 新增 `PlaygroundImage` → `playgroundRelay(c, types.RelayFormatOpenAIImage)`。

确保 `GenRelayInfo` 首参随 `format` 传入，使 image 走 `ImageHelper` 分支。

### 2. `router/relay-router.go` — 注册路由

在 playgroundRouter 组内（`relay-router.go:69-71`）加一行，沿用同组中间件：

```go
playgroundRouter.POST("/images/generations", controller.PlaygroundImage)
```

视频后续（本次不实现）：`POST /pg/videos` → `PlaygroundVideoSubmit`、`GET /pg/videos/:task_id` → `PlaygroundVideoFetch`，分别包装 `RelayTask / RelayTaskFetch` 的会话版。

## 前端改动（web/classic）

### 3. 新页面 `src/pages/ImagePlayground/index.jsx`

布局复用现有操练场骨架（`Layout.Sider` 左 + `Layout.Content` 中 + 右侧历史面板），内容改为图片生成：

- **左侧参数面板**（新建轻量 `ImageSettingsPanel`，参考 `components/playground/SettingsPanel.jsx`，**不含 API key 输入框**）：
  - 模型 `Select`：仅列出 image-generation 类模型（见第 6 点过滤）。
  - 图片尺寸 `Select`：常用尺寸（`1024x1024` 默认、`1024x1792`、`1792x1024`、`1344x768` 等），值作为 `size`。
  - 数量 `InputNumber`（N，默认 1）。
- **中间结果区**：无记录时占位「请输入提示词生成图片」；生成中 loading；完成后图片网格，点击放大 / 下载。
- **底部输入**：提示词 `Input.TextArea` + 发送按钮（loading 禁用），参考 `components/playground/CustomInputRender.jsx`。
- **右侧历史面板**：「新对话」按钮 + 历史列表（提示词摘要、模型名、状态标签、时间、删除），localStorage 持久化。

### 4. 新 hook `src/hooks/playground/useImageGeneration.js`

- `POST /pg/images/generations`，非流式（`fetch` + JSON），headers 带 `New-Api-User`（同 `useApiRequest.jsx` 取 localStorage 用户 id）。
- 请求体 `{ model, prompt, size, n, response_format }`。**遵守 Rule 6**：可选标量省略空值，不下发零值假象。
- 解析 `ImageResponse.data[]`：优先 `url`，否则 `b64_json` 拼 `data:image/png;base64,` 展示。
- 返回 `{ generateImage, isGenerating }`；错误用 `Toast.error` 并把历史项标 `status: failed`。

### 5. 历史持久化

- localStorage key：`image_playground_history`，存数组 `{ id, prompt, model, size, n, status, images, createdAt }`。
- 复用现有 quota 超限处理思路（参考 `usePlaygroundState` 的 `quotaExceeded` 提示）：base64 结果可能很大，写入失败时提示并允许清空历史。优先存 url，b64 仅兜底。

### 6. 模型过滤 helper `src/helpers/playground.js`

- 已有 `isPlaygroundSupported` / `pickPrimaryUnsupportedEndpoint` / `modelEndpointTypes`（来自 `useDataLoader` 的 `/api/pricing`）。
- 新增 `isImageGenerationModel(model, modelEndpointTypes)`：endpoint 类型含 `image-generation` 即为真。
- 复用 `useDataLoader` 加载 models + endpoint types + groups，图片页用该 helper 过滤模型下拉。

### 7. 路由与侧边栏注册

- `src/App.jsx`：仿 `playground`（`App.jsx:160-167`）新增 lazy import + `<Route path='/console/image-playground'>` 包 `<PrivateRoute>`。
- `src/components/layout/SiderBar.jsx`：在 `chatMenuItems`（`SiderBar.jsx:217-238`）「操练场」后加 `{ text: t('图片操练场'), itemKey: 'image_playground', to: '/image-playground' }`；routerMap 加 `image_playground → /console/image-playground`；图标走 `getLucideIcon('image_playground', ...)`（`Image` 图标）；沿用 `isModuleVisible('chat', 'image_playground')` 门控。

### 8. i18n

- 新增中英文 key（`图片操练场`、`图片尺寸`、`请输入图片生成提示词`、`新对话`、`已完成` 等）。中文为 fallback，英文补 `web/classic` 对应 locale。

## 视频预留（本次不实现）

后端 `PlaygroundVideoSubmit/Fetch` 包 `RelayTask/RelayTaskFetch` 会话版；前端再加「视频操练场」菜单项与轮询 hook（poll `/pg/videos/:task_id` 至 `completed/failed`）。本次的页面/hook 拆分（settings / 结果区 / 历史）保持通用，便于复制。

## 约束遵守

- **Rule 1**：前端无 Go JSON 操作；后端新代码基本只转调 `Relay`，无新 marshal。
- **Rule 5**：不动 QuantumNous / new-api 任何标识。
- 新文件不加 AGPL 版权头，从 import/package 写起。
- 不动数据库文件；无 schema 改动。

## 验证

1. `cd web/classic && bun install && bun run dev`，后端按现有方式启动。
2. 侧边栏出现「图片操练场」→ 进入，左侧能选到 image-generation 模型与尺寸。
3. 输入提示词发送 → 确认 `POST /pg/images/generations` 200，中间区渲染出图，右侧历史新增「已完成」项。
4. 刷新历史保留；删除历史项生效；失败场景（选错模型 / 无渠道）有 `Toast` 报错且历史标 failed。
5. `go build ./...` 通过；图片模型在普通对话操练场仍被 `UnsupportedModelModal` 拦截（不回归）。

---

# 更新 v2：体验区「模型能力」精确过滤 + 能力标签（模型广场）

> 承接初版：图片体验区（`/console/image`，文生图）、视频体验区（`/console/video`，文生视频）已上线。本次解决「展示哪些模型」的过滤精度问题，并把「能力」作为一种标签在模型广场呈现。

## 背景

体验区当前过滤 = 「管理员在配置里声明的模型 ∪ 后端按模型名硬编码识别的模型」（`common/model.go` 的 `ImageGenerationModels`、以及 Sora 渠道 → `openai-video`）。后端能力粒度只有 `image-generation` / `openai-video` 两类，**无法区分文生图 vs 图生图、文生视频 vs 图生视频**。目前只实现了文生图/文生视频页面，图生图/图生视频等本应被过滤掉，却会以同一端点类型混进来。此外文本体验区（`/console/playground`）也应把图片/视频类模型排除。

## 目标（三件事）

1. **图片/视频体验区**：改由管理员在运营设置里**逐模型显式声明「能力」（多选）**，前端按当前页面代表的能力精确过滤；空分组沿用现有隐藏逻辑。
2. **文本体验区**：排除所有出现在图片/视频配置里的模型。
3. **能力标签（模型广场）**：管理员给模型勾选的能力，等于给该模型打了一个**额外标签**。该额外标签 **不写入、也不显示在「模型管理」的 `tags`** 里，但要在**模型广场**展示，并作为**独立的标签分类**参与筛选。

## 关键决策

- 体验区展示判断依据 = **只认配置里的能力声明**，丢弃后端按名字识别。
- 旧配置升级后**需重新勾选**：缺 `capabilities` 视为无能力、不展示（管理端仍能读到旧尺寸行，供补勾）。
- 能力枚举取**业内常用完整集**；**能力值直接用中文字符串**，既是配置存储值、又是体验区标签页名，`t('文生图')` 负责其它语言本地化。
- 能力标签**不落库到 `model_meta.tags`**：配置（option）是唯一真源，模型广场从配置派生展示。避免污染模型管理标签、避免自动创建 meta 行。
- 文本体验区排除**所有**图片/视频配置里的模型（不论勾了哪个能力）。

## 能力枚举（硬编码；JS 与 Go 两份需保持一致）

- 图片：`文生图`、`图生图`、`图像编辑`、`局部重绘`、`扩图`、`高清放大`
- 视频：`文生视频`、`图生视频`、`首尾帧`、`参考生视频`、`音频驱动`、`视频转视频`
  - `参考生视频` = R2V / Subject-to-Video（主体一致）；`音频驱动` = S2V 语音/音频驱动、数字人对口型（Wan-S2V、MiniMax）。刻意不用有歧义的 “S2V”。

页面绑定的能力（= 标签页名）：图片页 → `文生图`；视频页 → `文生视频`。其余能力可在配置勾选、可在广场显示为标签，但暂无对应体验区页面 → 体验区天然不展示（未来加页签即生效）。

## 配置结构升级（option JSON）

图片 `ImageModelSizeConfig`：`models[name]` 由「尺寸数组」升级为对象，兼容读旧数组：
```json
{ "default": ["1024x1024"],
  "models": { "gpt-image-1": { "sizes": ["1024x1024"], "capabilities": ["文生图", "图像编辑"] } } }
```
旧形态 `"dall-e-3": ["1024x1024"]` 仍可解析 → `{ sizes:[...], capabilities:[] }`（不展示、待补勾）。

视频 `VideoModelConfig`：`models[name]` 在既有 `{sizes,durations}` 上加 `capabilities`：
```json
{ "default": { "sizes": [], "durations": [] },
  "models": { "sora-2": { "sizes": [], "durations": [], "capabilities": ["文生视频"] } } }
```

## A. 图片/视频体验区能力过滤（前端 web/classic）

**常量 / 解析器**
- `src/constants/imagePlayground.constants.js`：新增 `IMAGE_CAPABILITIES = ['文生图','图生图','图像编辑','局部重绘','扩图','高清放大']`、`IMAGE_PAGE_CAPABILITY = '文生图'`；`parseImageSizeConfig` 兼容 `models[name]` 数组/对象，统一产出 `{ sizes:[], capabilities:[] }`；`getSizesForModel` 从对象 `.sizes` 取值；新增 `getCapabilitiesForModel(config, model) => string[]`。
- `src/constants/videoPlayground.constants.js`：新增 `VIDEO_CAPABILITIES = ['文生视频','图生视频','首尾帧','参考生视频','音频驱动','视频转视频']`、`VIDEO_PAGE_CAPABILITY = '文生视频'`；`parseVideoModelConfig` 的 `models[name]` 增 `capabilities:[]`；新增 `getVideoCapabilitiesForModel`。

**体验区过滤 hook**
- `src/hooks/imagePlayground/useImageGeneration.js`：`imageModelSet` 改为「遍历 `sizeConfig.models`，仅纳入 `capabilities.includes('文生图')` 的模型」，删除对 `modelTypeMap`(supported_endpoint_types) 的并集依赖；`modelGroupsMap`(enable_groups)、`imageGroups`、`loadGroups`、`loadModels`（分组过滤 / 空分组隐藏）逻辑不变。
- `src/hooks/videoPlayground/useVideoGeneration.js`：同构，按 `'文生视频'` 过滤 `videoConfig.models`。

**管理端 UI（每行加「支持能力」多选）**
- `src/pages/Setting/Operation/SettingsImageSizes.jsx`：行 state 加 `capabilities`；初始化时读入；行内加 `Select multiple`（选项 = `IMAGE_CAPABILITIES`，非 allowCreate）；`onSubmit` 存 `models[name] = { sizes, capabilities }`，保存条件放宽为 `name && (sizes.length || capabilities.length)`。
- `src/pages/Setting/Operation/SettingsVideoModels.jsx`：同上，选项 = `VIDEO_CAPABILITIES`，`models[name]` 增 `capabilities`。

## B. 文本体验区排除图片/视频模型（前端 web/classic）

现状：`src/hooks/playground/useDataLoader.js:54-65` 已用 `isPlaygroundSupported`（endpoint 类型黑名单 `PLAYGROUND_UNSUPPORTED_ENDPOINTS`，见 `src/helpers/playground.js:10-15`）过滤。

改动：在 `loadModels` 过滤处叠加一层「排除图片/视频配置里的模型」——
- 解析 `statusState.status.ImageModelSizeConfig` + `VideoModelConfig`（复用 A 的 `parse*`）取 `models` 键，得 `mediaModelSet`。
- `list = list.filter(m => !mediaModelSet.has(m))`，与既有 `isPlaygroundSupported` 一并应用。
- `loadGroups`（L98-111）可同理排除仅含媒体模型的分组（可选；主要保证模型列表干净）。

## C. 能力标签在「模型广场」展示（不写入模型管理标签）

**核心：** 能力标签是从 option 配置**派生**的展示层标签，**不落库到 `model_meta.tags`**，因此模型管理（`EditModelModal`）看不到、也不会被覆盖；模型广场（Pricing 页）单独展示并作为独立分类筛选。

**标签冲突处理（关键）**：管理员可能在模型管理里**手工填了一个与能力同名的标签**（如手动打了 `文生图`）。为避免广场里同一个词出现两次、且分类归属不明，规则是——**按「能力词表」归类并去重，同一个词只显示一次，且永远归到「模型能力」分类**，无论它来自 option 配置还是手工标签：
- `pricing.CapabilityTags` = 配置声明的能力 ∪（手工 `tags` ∩ 能力词表），去重。
- `pricing.Tags`（广场「自定义标签」展示用）= 手工 `tags` **剔除**能力词表中的词。
- `model_meta.tags`（DB）**不变**：模型管理仍显示管理员手工输入的原文（含该词）。仅 `/api/pricing` 输出做展示层处理。
- **与体验区解耦（已定）**：手工打的 `文生图` 标签只影响**广场展示**，**不会**让该模型进入文生图体验区——体验区严格只读运营设置 option 里的 `capabilities`，从不读 meta 标签。

**后端（Go）**
- `model/pricing.go` `Pricing` 结构新增独立字段：`CapabilityTags []string` `json:"capability_tags,omitempty"`。
- 在 `updatePricing()` 构建循环（`pricing.go:288-341`）里，为每个 `pricing`：
  - 解析两份 option（`common.OptionMap["ImageModelSizeConfig"]` / `["VideoModelConfig"]`，在 `common.OptionMapRWMutex` RLock 下读取）得到 `model -> []capability`（新增轻量解析辅助，读 `models[*].capabilities`，用 `common.Unmarshal`）。图片 + 视频能力合并。
  - 按上面「标签冲突处理」规则计算 `CapabilityTags` 与广场用 `Tags`（能力词表来自 Go 侧 `ImageCapabilities`/`VideoCapabilities` 常量）。
- **缓存刷新**：`controller/option.go` `UpdateOption` 在 `model.UpdateOption` 成功后，对 `ImageModelSizeConfig` / `VideoModelConfig` 两个 key 调用 `model.InvalidatePricingCache()`（`pricing.go:80-87`），下次 `/api/pricing` 重建即带上最新能力标签。纯读派生，无写库、无副作用。

**前端广场展示（web/classic）**——因归类/去重已在后端完成，前端只需渲染两份现成列表，无需感知能力词表：
- 卡片视图 `components/table/model-pricing/view/card/PricingCardView.jsx`、表格视图 `.../view/table/PricingTableColumns.jsx`、详情弹窗 `.../modal/components/ModelBasicInfo.jsx`：在现有 `record.tags` 徽标旁，追加渲染 `record.capability_tags` 徽标，用**区别于自定义标签的样式/配色**，以体现「能力」分类。
- 筛选分类 `.../filter/PricingTags.jsx`：在原「标签」筛选区之外，新增 **「模型能力」分类区**，选项来自所有模型 `capability_tags` 的并集；选中能力时按 `capability_tags` 匹配，选中自定义标签时按 `tags` 匹配。筛选逻辑在 `hooks/model-pricing/useModelPricingData.jsx` 相应扩展（区分两类过滤源）。

**放弃的旧方案：** 早期设想把能力写进 `model_meta.tags`（经 `PUT /api/models/` / `SyncModelCapabilityTags`）。因为会污染模型管理标签、需 find-or-create meta 行、且要处理取消勾选后的标签回收，改为上述「派生展示」方案：更简单、单向、无副作用。

## D. i18n（web/classic，key 为中文，须置于顶层 `translation` 内）

- 能力中文值本身即 i18n key；管理端多选、体验区标签、广场徽标均以 `t('文生图')` 等展示。
- 补英文（及其它语言按需）翻译键：12 个能力词 + `支持能力`（列名/占位）+ `模型能力`（广场筛选分类标题）。classic i18n 规则见 CLAUDE.md（必须放进顶层 `translation` 对象，否则回落中文）。

## 约束遵守

- **Rule 1**：Go 侧 JSON 走 `common.Unmarshal`；前端无 Go JSON。
- **Rule 2**：无 schema / 迁移改动（`CapabilityTags` 仅内存派生，不落库）。
- **Rule 5**：不动 QuantumNous / new-api 标识；新文件不加版权头。
- 不改模型广场既有 `tags` 展示与 `/api/pricing` 其它字段；不改 `common/model.go`、`common/endpoint_type.go`（体验区不再依赖）。

## 不在范围

- 新增图生图 / 图生视频等体验区页面（本次只做数据模型 + 过滤 + 广场标签，页面后续）。
- 标签 → 配置反向同步（仅单向：配置 → 展示）。

## 验证

1. `cd web/classic && bun install && bun run dev`；`go build ./...` 通过。
2. 运营设置 → 图片模型尺寸配置：模型 A 勾「文生图」，模型 B 只勾「图生图」，保存。
3. `/console/image`：只见 A；B 不见；未配置的模型不见；无合格模型的分组不出现在分组下拉。
4. 视频配置同理验证 `/console/video` 按「文生视频」过滤。
5. 文本操练场 `/console/playground`：A、B 均不出现在模型下拉（被排除）。
6. 模型广场（Pricing 页）：A 出现「文生图」能力标签、B 出现「图生图」，「模型能力」分类筛选可用；**模型管理里 A/B 的 `tags` 不含这些能力词**（未被污染）。取消勾选并保存后，广场对应能力标签消失。
7. 旧配置回归：造旧形态（图片模型存成尺寸数组）→ 升级后体验区不展示、广场无能力标签；管理端仍见其尺寸行，补勾「文生图」保存后恢复展示并在广场出现能力标签。
8. 标签冲突：给某模型在模型管理里手工加标签「文生图」→ 广场该模型只显示**一个**「文生图」徽标、且归在「模型能力」分类（不重复、不出现在自定义标签里）；模型管理里该模型 `tags` 仍保留手工的「文生图」原文；该模型**不**因此进入文生图体验区（除非在图片配置里也勾了「文生图」）。
