# 提示词屏蔽按分组和模型生效开发方案

## 目标

当前提示词屏蔽是全局开关加全局词表。只要开启 `CheckSensitiveEnabled` 和 `CheckSensitiveOnPromptEnabled`，所有标准 Relay 请求都会扫描同一份 `SensitiveWords`。目标是把提示词屏蔽扩展为可按分组和模型生效：

- 管理员可以多选分组。
- 管理员可以多选模型。
- 分组和模型同时配置时按交集生效。
- 模型选项尽量从系统现有模型和可用渠道能力中自动获取，管理员日常只需要选择。
- 保留高级手动输入或正则能力，覆盖动态模型、规则模型和未来新增模型。
- 保持旧配置兼容，未配置细粒度规则时仍按现有全局行为运行。

## 现有逻辑分析

### 请求链路

标准 OpenAI/Claude/Gemini/Responses/Image/Audio/Embedding/Rerank Relay 的主链路为：

1. `middleware.TokenAuth()` 校验令牌，写入用户、令牌和分组上下文。
2. `middleware.Distribute()` 解析模型，选择渠道，写入 `original_model`、`group`、`auto_group`、渠道信息等上下文。
3. `controller.Relay()` 解析并校验请求体。
4. `relay/common.GenRelayInfo()` 从 Gin context 构造 `relayInfo`。
5. `controller.Relay()` 调用 `setting.ShouldCheckPromptSensitive()` 判断是否需要检查。
6. 如需检查，调用 `request.GetTokenCountMeta()` 生成 `TokenCountMeta.CombineText`。
7. 调用 `service.CheckSensitiveText(meta.CombineText)`，命中则拒绝。
8. 估算 token、计费预扣、进入重试和上游转发。

关键文件：

- `controller/relay.go`
- `setting/sensitive.go`
- `service/sensitive.go`
- `service/str.go`
- `middleware/auth.go`
- `middleware/distributor.go`
- `relay/common/relay_info.go`
- `relay/helper/price.go`

### 当前配置

`setting/sensitive.go` 当前只有：

- `CheckSensitiveEnabled`
- `CheckSensitiveOnPromptEnabled`
- `StopOnSensitiveEnabled`
- `SensitiveWords []string`

`model/option.go` 把这些配置加入 `OptionMap`，并在保存时更新内存变量。前端 `web/default/src/features/system-settings/request-limits/sensitive-words-section.tsx` 只提供全局开关和全局词表。

### 当前文本抽取范围

屏蔽检查复用 token 估算的 `GetTokenCountMeta()`，它不是严格意义上的“只扫描用户 prompt”，而是扫描请求文本集合：

- OpenAI Chat: prompt、input、message role、message name、text content、tool name、tool description、tool parameters。
- Responses: input text、instructions、metadata、text、tool_choice、prompt、tools 等 JSON 原文。
- Claude: system、message role/content、tool_use、tool_result、tools。
- Gemini: contents.parts.text。
- Image: prompt。
- Audio speech: input。
- Embedding/Rerank: input/query/documents。

这点要在产品文案中表达为“请求提示词/文本扫描”，避免管理员误解为只扫描 user message。

### 未覆盖或特殊入口

当前敏感词检查只在 `controller.Relay()` 中执行。以下路径不是同一套入口，默认不受这段检查覆盖：

- Midjourney 路由：`RelayMidjourney`。
- Task 路由：`RelayTask`，包括 Suno、视频生成等异步任务。
- Realtime WebSocket：进入 `Relay` 时请求体为空，后续帧内文本不在 `GetTokenCountMeta()` 中。

因此完整方案必须明确分阶段覆盖，不应只改标准 Relay 后宣称“全站提示词屏蔽”。

## 已有上下文能力

敏感词检查发生时已经能拿到模型和分组：

- 请求模型：`relayInfo.OriginModelName`，来自 `ContextKeyOriginalModel`。
- 用户原始分组：`relayInfo.UserGroup`。
- 当前使用分组：`relayInfo.UsingGroup`。
- 令牌指定分组：`relayInfo.TokenGroup`。
- `auto` 实际选中分组：`ContextKeyAutoGroup`。

注意：`relayInfo.UsingGroup` 在 `auto` 场景可能仍是 `"auto"`，实际落点需要优先读 `ContextKeyAutoGroup`。计费逻辑在 `relay/helper/price.go` 的 `HandleGroupRatio()` 里会修正，但提示词屏蔽发生在价格计算之前，不能直接依赖后续修正。

另一个重要边界是跨分组重试。`service.CacheGetRandomSatisfiedChannel()` 支持 `auto` 分组和 token 的 `CrossGroupRetry`，后续 retry 可能切换到另一个真实分组。如果只在首次进入 `Relay` 时按初始分组检查一次，会出现：

- 首次分组不限制。
- 上游失败后重试到另一个限制分组。
- 请求没有重新做提示词屏蔽。

所以最终实现需要让敏感词检查可以在“当前选中分组”发生变化时复检，或在 `auto` 跨分组场景采用所有候选分组的保守并集。推荐采用复检方案，避免过度拦截。

## 产品语义

### 多选分组

- 不选分组：规则适用于所有分组。
- 选择一个或多个分组：规则只适用于这些真实使用分组。
- 不建议保存 `"auto"` 作为规则分组。`auto` 是选择模式，不是最终执行分组。UI 可以展示 `auto` 的说明，但规则匹配应使用实际落到的分组。

### 多选模型

- 不选模型且不配置模型正则：规则适用于所有模型。
- 选择一个或多个模型：规则只适用于这些模型。
- 高级配置支持 `model_regex`，用于匹配动态模型、前缀模型、规则模型或未来新增模型。

### 分组和模型同时选择

分组条件与模型条件按交集生效：

```text
规则命中 = 分组匹配 && 模型匹配 && 规则启用
```

例子：

- 分组选择：`default`, `vip`
- 模型选择：`grok-4`, `gpt-4o-mini`
- 结果：只有 `default` 或 `vip` 分组调用 `grok-4` 或 `gpt-4o-mini` 时检查。

### 模型列表筛选

前端模型选择器应从后端获取可选模型，不要求管理员手写。

当选择了分组后，模型列表可以启用“仅显示所选分组可用模型”：

- 开启：模型列表过滤为所选分组可用模型的并集。
- 关闭：展示全部已知模型。
- 过滤只影响 UI 可选项，不改变后端规则语义。后端始终按保存的分组和模型做交集判断。

### 词表语义

保留全局 `SensitiveWords`，新增规则可以选择复用或扩展它。推荐规则结构支持：

- `include_global_words`: 是否使用全局词表。
- `words`: 规则专属词表。

有效词表为：

```text
include_global_words ? SensitiveWords : []
+ rule.words
```

如果规则命中但有效词表为空，应视为无效规则并在保存时拒绝，避免管理员以为规则生效。

## 后端设计

### 新增配置结构

新增 Option Key：

```text
SensitiveCheckRules
```

推荐 JSON 结构：

```json
{
  "version": 1,
  "rules": [
    {
      "id": "rule_default_grok",
      "name": "Default group Grok restriction",
      "enabled": true,
      "groups": ["default"],
      "models": ["grok-4"],
      "model_regex": [],
      "include_global_words": true,
      "words": []
    },
    {
      "id": "rule_all_claude_regex",
      "name": "All groups Claude family",
      "enabled": true,
      "groups": [],
      "models": [],
      "model_regex": ["^claude-.*"],
      "include_global_words": true,
      "words": ["custom_block_word"]
    }
  ]
}
```

结构建议：

```go
type SensitiveCheckRuleConfig struct {
    Version int                  `json:"version"`
    Rules   []SensitiveCheckRule `json:"rules"`
}

type SensitiveCheckRule struct {
    ID                 string   `json:"id"`
    Name               string   `json:"name"`
    Enabled            bool     `json:"enabled"`
    Groups             []string `json:"groups,omitempty"`
    Models             []string `json:"models,omitempty"`
    ModelRegex         []string `json:"model_regex,omitempty"`
    IncludeGlobalWords bool     `json:"include_global_words"`
    Words              []string `json:"words,omitempty"`
}
```

为兼容未来扩展，可保留 `version`。第一版不需要数据库迁移，继续复用 `options` 表。

### 配置读写

在 `setting/sensitive.go` 增加：

- `SensitiveCheckRules SensitiveCheckRuleConfig`
- `SensitiveCheckRulesToString() string`
- `SensitiveCheckRulesFromString(s string) error`
- `ValidateSensitiveCheckRules(s string) error`
- `GetSensitiveWordsCopy() []string`
- `GetSensitiveCheckRulesCopy() SensitiveCheckRuleConfig`

建议同时给 `SensitiveWords` 和新规则加 `sync.RWMutex` 或 `atomic.Value` 保护。当前全局 `SensitiveWords` 读写没有锁，在运行时保存设置和并发请求同时发生时存在数据竞争风险。新增功能会更频繁读取规则，应该借机补齐。

在 `model/option.go`：

- 初始化 `common.OptionMap["SensitiveCheckRules"]`。
- `updateOptionMap` 增加 `SensitiveCheckRules` 分支。

在 `controller/option.go`：

- `UpdateOption` 中对 `SensitiveCheckRules` 调用 `setting.ValidateSensitiveCheckRules()`。
- 校验失败时不写数据库。

校验要求：

- JSON 必须合法。
- `version` 为空时默认 1，非 1 暂时拒绝或兼容解析。
- `rules` 可为空。
- `id` 为空时前端保存前生成，后端允许但建议补齐。
- `groups` 去空白、去重。
- `models` 去空白、去重。
- `model_regex` 必须能被 `regexp.Compile` 编译。
- `include_global_words == false && len(words) == 0` 时拒绝。
- `words` 去空白、去重。

### 匹配服务

在 `service/sensitive.go` 扩展，不建议让 `setting` 包直接依赖 `relay/common`，避免引入包循环。可以定义独立 scope：

```go
type SensitiveCheckScope struct {
    EffectiveGroups []string
    ModelCandidates []string
    Path string
}

type SensitiveMatchResult struct {
    ShouldCheck bool
    Words []string
    RuleIDs []string
    RuleNames []string
}
```

新增函数：

```go
func ResolveSensitiveCheckScope(c *gin.Context, info *relaycommon.RelayInfo) SensitiveCheckScope
func ResolveSensitiveWords(scope SensitiveCheckScope) SensitiveMatchResult
func CheckSensitiveTextWithWords(text string, words []string) (bool, []string)
```

`EffectiveGroups` 计算规则：

1. 如果 context 有 `ContextKeyAutoGroup`，优先使用它。
2. 否则用 `relayInfo.UsingGroup`。
3. 为空时回退 `relayInfo.TokenGroup`。
4. 再为空时回退 `relayInfo.UserGroup`。
5. 如果当前使用分组是 `"auto"`，但还没有真实 `auto_group`，可以用 `service.GetUserAutoGroup(relayInfo.UserGroup)` 作为候选集合。

`ModelCandidates` 计算规则：

1. 原始模型：`relayInfo.OriginModelName`。
2. 归一化模型：`ratio_setting.FormatMatchingModelName(origin)`。
3. 如果是 `/v1/responses/compact` 产生的 `-openai-compact` 后缀，额外加入去掉该后缀的基础模型名。
4. 去重后用于 exact 匹配。

模型正则默认对原始模型和基础模型都尝试匹配。这样既支持精确模型选择，也兼容 compact suffix 和已有定价归一化逻辑。

### 检查时机

推荐把检查封装为控制器内的私有函数：

```go
func checkPromptSensitiveForRelay(c *gin.Context, info *relaycommon.RelayInfo, meta *types.TokenCountMeta) *types.NewAPIError
```

主流程：

1. `CheckSensitiveEnabled && CheckSensitiveOnPromptEnabled` 为 false 时直接跳过。
2. 解析当前 scope。
3. 若 `SensitiveCheckRules` 为空，走旧行为，使用全局 `SensitiveWords`。
4. 若规则不为空，只使用命中规则合并出的有效词表。
5. 命中后返回明确错误，状态码建议 `400 Bad Request` 或 `403 Forbidden`，并设置 `ErrOptionWithSkipRetry()`。

错误构造建议修正当前潜在问题。现有代码命中时使用 `types.NewError(err, ...)`，此处 `err` 可能为 nil，最终容易形成不清晰的 500。建议改为：

```go
types.NewErrorWithStatusCode(
    errors.New("sensitive words detected"),
    types.ErrorCodeSensitiveWordsDetected,
    http.StatusBadRequest,
    types.ErrOptionWithSkipRetry(),
)
```

日志可以记录 `rule_ids`、`rule_names`、命中词数量和命中词列表。不要记录完整 prompt。

### 跨分组重试处理

为了避免 `auto` 跨分组重试绕过限制，推荐：

1. 首次在 token 估算前后执行一次检查，覆盖当前选中分组。
2. 在 retry loop 内 `getChannel()` 之后、调用上游之前再次执行一次检查。
3. 用 `checkedScopeKey` 记录已检查过的 `group + model + rules_version`，相同 scope 不重复扫描。
4. 如果 retry 复检命中，设置 `newAPIError` 并跳出循环。已有 defer 会处理预扣退款。

这样比“auto 时按所有候选组保守并集”更准确，不会因为某个备选分组限制而提前拦截本来落到非限制分组的请求。

### 标准 Relay 覆盖范围

第一阶段接入 `controller.Relay()` 后，可覆盖：

- `/v1/chat/completions`
- `/v1/completions`
- `/v1/messages`
- `/v1/responses`
- `/v1/responses/compact`
- `/v1/images/generations`
- `/v1/images/edits`
- `/v1/embeddings`
- `/v1/audio/speech`
- `/v1/audio/translations`
- `/v1/audio/transcriptions`
- `/v1/rerank`
- `/v1/moderations`
- Gemini generateContent 路由

但实际文本覆盖取决于各 request DTO 的 `GetTokenCountMeta()`。

### Task 和 Midjourney 入口

完整方案应在后续阶段覆盖异步任务入口：

- `controller.RelayTask()`
- `relay.RelayTaskSubmit()`
- `controller.RelayMidjourney()`
- `relay.RelayMidjourneySubmit()`

建议不要在 controller 层手写多套 prompt 抽取逻辑，而是在 task adaptor 层增加可选接口：

```go
type SensitivePromptExtractor interface {
    GetSensitivePromptText(c *gin.Context, info *relaycommon.RelayInfo) string
}
```

如果 adaptor 未实现，则降级为从原始 body 中读取常见字段：

- `prompt`
- `gpt_description_prompt`
- `input`
- `text`
- `message`
- `metadata.negative_prompt`

但降级逻辑只能作为兜底，不能替代各 task 平台的明确实现。

Realtime WebSocket 不建议纳入第一版。它需要解析客户端后续 WS frame，成本和风险独立，应单独设计。

## 前端设计

### 数据来源

新增 Admin API：

```text
GET /api/sensitive/scope_options
```

返回：

```json
{
  "success": true,
  "data": {
    "groups": [
      {"value": "default", "label": "default", "desc": "default", "ratio": 1}
    ],
    "models": [
      {
        "value": "gpt-4o-mini",
        "label": "gpt-4o-mini",
        "enable_groups": ["default", "vip"],
        "vendor": "OpenAI",
        "endpoints": ["chat_completions", "responses"]
      }
    ]
  }
}
```

后端生成方式：

- groups: 来自 `ratio_setting.GetGroupRatioCopy()` 和 `setting.UserUsableGroups` 的描述。
- models: 优先来自 `model.GetPricing()`，因为它反映运行时 enabled abilities 和分组可用性。
- 补充来自 `models` 元数据表的模型名，避免尚未绑定渠道但已配置的模型不可选。
- `enable_groups` 来自 `model.Pricing.EnableGroup` 或 `model.GetModelEnableGroups()`。

不要依赖 `/api/pricing` 直接作为系统设置页数据源，因为它会按当前用户可用分组过滤，不适合作为管理员配置全集。

### UI 位置

继续放在：

```text
web/default/src/features/system-settings/request-limits/sensitive-words-section.tsx
```

保留现有全局开关和全局词表。新增“规则列表”区域：

- 规则启用开关。
- 规则名称。
- 分组多选。
- 模型多选。
- “仅显示所选分组可用模型”开关。
- 高级模型正则 textarea。
- 是否包含全局词表开关。
- 规则专属词表 textarea。
- 删除、复制、保存。

组件复用建议：

- `web/default/src/components/multi-select.tsx` 可作为基础多选控件。
- 可能需要扩展为支持搜索过滤、空态、虚拟列表或自定义输入。
- 模型数量可能很大，超过数千时需要限制渲染或使用分页搜索。

### 保存方式

前端表单内部使用结构化对象，保存前序列化为 `SensitiveCheckRules` 字符串，通过现有 `updateSystemOption` 写入。

需要在类型中增加：

```ts
SensitiveCheckRules: string
```

涉及文件：

- `web/default/src/features/system-settings/types.ts`
- `web/default/src/features/system-settings/security/index.tsx`
- `web/default/src/features/system-settings/security/section-registry.tsx`
- `web/default/src/features/system-settings/request-limits/sensitive-words-section.tsx`
- `web/default/src/features/system-settings/api.ts`

新增 UI 文案必须进入 i18n。项目要求前端语言包括 `en`, `zh`, `fr`, `ja`, `ru`, `vi`，新增文案后需要运行或补齐 i18n 同步。

## 兼容性

### 旧行为兼容

必须满足：

- `SensitiveCheckRules` 为空或 `{ "version": 1, "rules": [] }` 时，行为与当前版本一致。
- 全局开关关闭时，无论规则如何都不检查。
- 全局词表为空且规则无自定义词时，不检查。
- 已有 `SensitiveWords` 文本格式不变，仍是一行一个词。

### 数据库兼容

只新增 option key，不新增表，不需要迁移。SQLite、MySQL、PostgreSQL 都继续走现有 `options` 表。

### JSON 包规范

后端 marshal/unmarshal 必须使用 `common.Marshal`、`common.Unmarshal`、`common.UnmarshalJsonStr`、`common.DecodeJson`。不要新增业务代码直接调用 `encoding/json` 的 marshal/unmarshal。

注意：当前部分旧文件已有 `encoding/json` 用法，本功能新增代码应遵守项目规则，不扩大不一致。

### 性能

当前敏感词匹配使用 AC 自动机，`service/str.go` 通过词表 hash 缓存 machine。新增规则后会出现多个有效词表组合：

- 需要对合并后的词表去重、排序或复用当前 `acKey` 逻辑，确保相同词表命中同一缓存。
- 不要每次请求重复编译正则。规则加载时预校验，运行时可使用 `sync.Map` 缓存正则。
- 大词表场景下不要在日志中输出完整词表。

### 并发

新增规则和全局词表都应通过 copy-on-read 或锁保护：

- 保存设置时构造新 config，再一次性替换。
- 请求读取时拿配置快照，不持锁执行 AC 搜索和正则匹配。

## 自我审查

### 是否符合需求

符合。方案支持多选分组、多选模型，分组和模型按交集生效。模型列表由后端提供，管理员默认只需选择，同时保留正则和手动扩展能力。

### 是否完善

基本完善。方案覆盖了配置存储、后端匹配、前端选择、旧行为兼容、跨分组重试、Task/MJ 旁路、测试和性能。Realtime WebSocket 明确不纳入第一版，因为它不是请求体检查问题，而是流式帧解析问题。

### 是否完整

对标准 Relay 是完整的。对异步任务是分阶段完整设计，但不应在第一阶段承诺已经覆盖。最终发布说明必须区分“标准 Relay 已覆盖”和“Task/MJ 已覆盖”。

### 是否正确

核心正确性取决于两点：

- effective group 必须使用真实分组，不能把 `"auto"` 当成最终分组。
- retry 时如分组变化必须复检，否则存在规则绕过。

方案已把这两点列为实现要求。

### 是否规范一致

符合项目现有约定：

- 配置继续走 `OptionMap` 和 `options` 表。
- 后端 JSON 使用 `common` 包封装。
- 前端继续放在 system-settings/security/request-limits。
- 前端使用 Bun 脚本验证。
- 不引入数据库专有 SQL。

### 方案自身可能缺陷

- 如果模型数量非常大，简单 `MultiSelect` 会有性能问题，需要搜索分页或虚拟滚动。
- 如果管理员使用 `auto`，并且不同真实分组规则完全不同，retry 复检会使请求在上游失败后才被屏蔽。体验上略晚，但语义准确。
- 如果某些 provider adaptor 在转发前改写 prompt，屏蔽检查扫描的是原始请求文本，不一定等同于最终上游文本。需要在特定 provider 后续补充最终请求体检查。
- 如果规则自定义词表很多，会产生更多 AC 缓存项。需要观察内存，但通常可接受。

### 上下设计冲突

- 与全局 `SensitiveWords` 不冲突，新规则可复用或扩展它。
- 与 token 模型限制不冲突。token 模型限制决定能否访问模型，敏感规则决定访问时是否扫描文本。
- 与渠道选择不冲突，但与 `auto` 跨分组重试有关，已要求重试复检。
- 与计费预扣顺序有轻微交互。若 retry 复检发生在预扣之后，命中时必须走已有 refund defer。实现时要确保 `newAPIError` 被设置，不能直接 `return` 丢失退款。

## 开发清单

### 阶段 1：后端配置结构和校验

任务：

- 在 `setting/sensitive.go` 新增规则配置结构和读写函数。
- 给 `SensitiveWords` 和 `SensitiveCheckRules` 增加并发安全快照读取。
- 在 `model/option.go` 注册和加载 `SensitiveCheckRules`。
- 在 `controller/option.go` 保存前校验规则 JSON。
- 增加 `setting/sensitive_test.go`。

自检：

- 空规则保持旧行为。
- 非法 JSON 不写入数据库。
- 非法正则不写入数据库。
- `include_global_words=false` 且无自定义词时拒绝。
- 保存配置后内存配置立即生效。
- 并发测试或 `go test -race` 无新增明显数据竞争。
- 检查新增注释和文案没有乱码。

### 阶段 2：标准 Relay 规则匹配

任务：

- 在 `service/sensitive.go` 增加 scope 解析和按词表检查函数。
- 在 `controller/relay.go` 替换现有全局检查调用。
- 修正敏感词命中错误构造，返回明确状态码并 skip retry。
- 加入 rule id/name 的安全日志，不记录完整 prompt。
- 保留 legacy fallback。

自检：

- 全局开关关闭时不检查。
- 无规则时仍按 `SensitiveWords` 全局检查。
- 有规则但当前分组和模型不匹配时不检查。
- 分组匹配、模型不匹配时不检查。
- 模型匹配、分组不匹配时不检查。
- 分组和模型都匹配时检查。
- `groups=[]` 覆盖所有分组。
- `models=[]` 且 `model_regex=[]` 覆盖所有模型。
- compact 模型后缀能按基础模型匹配。
- 命中返回码不是 500。

### 阶段 3：跨分组重试复检

任务：

- 在 `controller.Relay()` retry loop 中 `getChannel()` 后、调用上游前复检当前 scope。
- 用 scope key 避免同一分组模型重复扫描。
- 确保复检命中后 `newAPIError` 设置正确，预扣会退款。

自检：

- `auto` 初始真实分组匹配规则时会拦截。
- `auto` 初始真实分组不匹配，但 retry 切换到匹配分组时会在转发前拦截。
- 复检命中不会继续请求上游。
- 复检命中后预扣退款逻辑仍执行。
- 普通非 auto 分组不会重复产生额外行为。

### 阶段 4：前端规则管理

任务：

- 新增 admin scope options API 或前端 API 封装。
- 在 `SensitiveWordsSection` 增加规则编辑 UI。
- 使用多选分组和多选模型。
- 支持“仅显示所选分组可用模型”。
- 支持高级 `model_regex`。
- 支持规则专属词表和是否包含全局词表。
- 更新 `SecuritySettings` 类型和默认值。
- 补齐 i18n。

自检：

- 分组选中后模型列表过滤符合预期。
- 过滤开关不会偷偷修改已保存模型。
- 模型可搜索。
- 大模型列表下输入不卡顿。
- 空规则保存为合法 JSON。
- 编辑、复制、删除规则不会丢失其他设置。
- `bun run build` 通过。
- `bun run i18n:sync` 或等价检查后各语言无缺失 key。
- 页面在移动端不出现按钮文字溢出或控件重叠。

### 阶段 5：Task、MJ、视频、Suno 入口覆盖

任务：

- 为 task adaptor 增加 prompt 抽取接口。
- 在 `RelayTask` 或 `RelayTaskSubmit` 中接入同一套规则匹配。
- 为 Midjourney submit 路径接入 prompt 抽取。
- 对 remix/fetch/notify 这类非新 prompt 入口明确跳过或只检查新增字段。
- 增加单元测试或 handler 级测试。

自检：

- Suno prompt 能检查。
- 视频生成 prompt 能检查。
- Midjourney imagine prompt 能检查。
- fetch/notify 不误拦截。
- 规则仍按真实分组和模型生效。
- 错误格式符合各 task API 的响应约定。

### 阶段 6：回归测试和文档

任务：

- 后端运行相关 Go 测试。
- 前端运行 typecheck/build。
- 更新用户文档或设置页说明。
- 检查 OpenAPI 如有新增管理接口是否需要补充。

自检：

- SQLite、MySQL、PostgreSQL 无新增数据库差异。
- `common/json.go` 规则没有被违反。
- 没有修改受保护项目标识。
- 没有引入不相关重构。
- 没有乱码。
- 旧全局敏感词配置可继续使用。
- 新规则删除后系统回到旧行为。

## 建议优先级

推荐先做阶段 1 到阶段 3，保证后端能力正确，再做前端。原因是分组、模型、auto retry 的语义必须由后端兜底，前端过滤只能提升操作体验，不能作为权限或屏蔽判断依据。

第一版可以发布为：

- 标准 Relay 已支持按分组和模型屏蔽。
- Task/MJ/Realtime 在发布说明中列为暂未覆盖或实验覆盖。

最终完整版再补齐 Task/MJ，并单独评估 Realtime WebSocket。
