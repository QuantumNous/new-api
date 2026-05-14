# 分组 × 模型 隔离与可见性

## 背景

本实例同时接入了两条供应链：

- **自部署 GPUStack**（成本低、运营策略灵活）→ 挂在 `default` 分组
- **并行科技中转 API**（折扣有限、运营策略受限）→ 挂在 `premium` 分组

普通用户在「分组管理 → 分组特殊可用分组」中被追加了 `premium` 可用规则，因此每个普通用户实际可以同时使用 `default` 和 `premium` 两个分组的渠道。

但在改造前，系统在「分组 × 模型」组合上有语义不一致，导致用户在操练场或令牌设置中误选模型时只会得到一句 `分组 default 下模型 GLM-5 无可用渠道（distributor）`，完全摸不着头脑。本文档记录这次改造的设计与落地点。

## 根因

- `controller/pricing.go` 的 `GetPricing` 把**用户所有可用分组**的模型并集返回给前端
- `controller/user.go` 的 `GetUserModels`（`/api/user/models`）同样返回并集，且**不带 `enable_groups` 信息**
- `middleware/distributor.go` 路由时**只用当前选定的单一分组**查渠道（`service.CacheGetRandomSatisfiedChannel`）
- 结果：UI 让用户看到全部模型，但实际请求只在一个分组内寻找渠道，跨分组模型必然报"无可用渠道"

## 方案对比

| | A：合并到单一分组 | B：保留分组，UI 联动 |
|---|---|---|
| 用户认知 | 零负担 | 需理解"分组 = 价格档位" |
| 前端改造 | 0 | 令牌页 + 操练场需要按分组过滤 |
| 计费灵活度 | 仅模型粒度 | 分组 × 模型 双层 |
| 多供应商扩展 | 越加越乱 | 天然支持 |
| 风险隔离 | 弱 | 可按分组独立熔断/限速 |

**决定走 B**：自部署与并行科技的成本结构和运营策略长期不同，分组层是这种差异的天然承载。把"令牌选定分组"作为收敛所有模型相关 UI 选项的筛选轴。

## 三个触点

### 触点 1：令牌创建/编辑页（最关键）

每次用户创建令牌都要选分组，这里是从源头消灭"选错"的最佳时机。

- **令牌分组改为必填且不预填默认值**：上游"留空 = 跟随用户分组"的默认体验在多分组运营场景下容易让用户产生"忘选 = 走默认 = 报错"的陷阱。这里把分组语义从"可选覆盖"升级为"必须明确选择"，且**新建时不预选任何值**——预填会让用户跳过这个决策点，与"强制思考"的初衷矛盾
- 编辑老令牌时若库里存的是空 group，UI 仍展示为空，用户必须主动选一个才能保存；这一步顺势把存量空 group 升级为具体值
- 分组选择 → 模型限制白名单的 multiselect 选项联动
- 切换分组时已勾选但在新分组不可用的模型自动剔除并 Toast 提示
- 分组下方一行说明 + 模型广场链接

实现：`web/classic/src/components/table/tokens/modals/EditTokenModal.jsx`。`Form.Select` 加 `rules={[{ required: true }]}` 并移除 `showClear`，placeholder 改为"请选择令牌分组"；`getInitValues` 的 `group` 保持空字符串，新建/编辑空 group 老令牌都强制用户主动选择；原本调 `/api/user/models` 改为带 `?group=<token.Group>` 参数；`loadModels` 同时承担 model_limits 差集清理；`group` 选择器加 `onChange={handleGroupChange}` 与 `extraText` 提示模型数 + 模型广场链接。链接会把当前选中分组作为 `?group=` 参数带到模型广场（auto 时不带），模型广场页面收到该参数后自动应用筛选（见 `web/classic/src/hooks/model-pricing/useModelPricingData.jsx` 的 URL 同步 effect）。

后端兼容性：`middleware/auth.go` 处理 `token.Group=""` 的逻辑保留不动（老令牌仍正常工作），仅前端不再产生空值。

### 触点 2：操练场（Playground）

用户日常调试的入口，分组切换后模型下拉必须立即跟随。

- 模型下拉数据源按当前 `inputs.group` 过滤
- 当前选中的模型在新分组下不可用时自动切换并 `showWarning` 提示
- 分组标签旁加 HelpCircle Tooltip 说明联动行为

实现：`web/classic/src/hooks/playground/useDataLoader.js` 在 `loadModels` 里读 `inputs.group` 并作为 `?group=` 参数；依赖里加入 `inputs.group` 触发自动 refetch。`web/classic/src/components/playground/SettingsPanel.jsx` 在分组标签旁加 Tooltip。

### 触点 3：错误信息兜底

即便 UI 完善，仍有用户绕过 UI 直接通过 API 调用。distributor 错误信息要变成可执行的指引。

- distributor 抛 `MsgDistributorNoAvailableChannel` 或 `MsgDistributorGetChannelFailed` 前，反查模型实际可用的分组
- 非空 → 改用新 i18n key `MsgDistributorNoAvailableChannelHint` / `MsgDistributorGetChannelFailedWithHint`，文案附带"该模型可用分组：X"
- 空 → 退回旧文案（模型确实彻底没人挂载）

实现：`middleware/distributor.go` 新增 `availableGroupsHint(modelName, currentGroup)` 反查；i18n 新增两条 key，zh-CN / en / zh-TW 三个 locale 文件同步。

## 后端接口契约变化

### `/api/user/models` 支持按分组过滤

```
GET /api/user/models           # 老行为：返回用户所有可用分组的模型并集
GET /api/user/models?group=X   # 新增：返回单一分组 X 的模型，X 必须在用户可用分组内，否则 403
GET /api/user/models?group=auto # 新增：返回用户 auto_groups 的并集（与 distributor 行为一致）
```

向后兼容：未升级的客户端无 `group` 参数，行为完全不变。

### 令牌保存校验 `model_limits ⊂ group`

`AddToken` 与 `UpdateToken` 在保存前调用 `validateTokenModelLimits`：
- 若 `ModelLimitsEnabled=true && ModelLimits!=""`
- 解析 `token.Group`（空 → 单一 `user.Group`，与 `middleware/auth.go` 的运行时行为对齐，避免老令牌存量"空 group + 跨分组 model_limits"在校验时被并集误放行；`auto` → auto_groups 并集；具体值 → 必须在 `service.GetUserUsableGroups(user.Group)` 中）
- 检查每个限制项是否在该分组的可用模型集内，不在则 400 并列出非法模型名 + 它们实际可用的分组

这一道堵住"用户通过 API 直接 PATCH 改 model_limits 绕过前端"的兜底。

### 新增的 i18n key

| key | 用途 |
|---|---|
| `distributor.no_available_channel_with_hint` | 替代原 `no_available_channel`，当能反查到该模型可用分组时使用 |
| `distributor.get_channel_failed_with_hint` | 替代原 `get_channel_failed`，同上 |

文案占位符：`{{.Group}}`、`{{.Model}}`、`{{.Error}}`、`{{.AvailableGroups}}`（逗号分隔的分组名字符串）。

## 运维操作指引

管理员在以下三处需保持一致性约定：

1. **分组管理**：决定哪些分组在分组列表里存在、其倍率、是否「用户可选」
   - 「用户可选」决定用户能否在创建令牌时手动选中该分组
2. **分组特殊可用分组**：决定某个用户分组**额外**能用哪些（创建令牌时可选的）分组
   - 现配置：`default` 用户追加 `premium` 可用 → 普通用户既能开 default 令牌也能开 premium 令牌
3. **渠道分组挂载**：每个渠道在「分组」字段填写其归属
   - 自部署渠道 → `default`
   - 并行科技渠道 → `premium`

三者错位的常见症状：
- 渠道挂在 X 分组、但 X 不在用户可用分组里 → 用户根本看不到这个渠道挂载的模型
- 渠道挂在 X 分组、X 在用户可用、但用户拿 Y 令牌调 → 此次改造已用错误兜底友好提示

## 后续可扩展

- 新增第三家供应商（如火山引擎、智谱直连）：再开一个分组，挂上对应渠道；管理员决定要不要把这个分组加进现有用户的「分组特殊可用分组」追加规则；前端无需任何改动
- 想给 VIP 用户在 premium 上打折：用「分组特殊倍率」让 `vip` 用户使用 `premium` 时倍率 0.7，不影响普通用户
- 想停售并行：把 `premium` 从「分组特殊可用分组」追加规则里移除，所有普通用户立刻不可用，default 不受影响

## 已知限制

- 老令牌存量数据可能含跨分组 model_limits（迁移前已存在）：本次改造**不主动清理**，依赖错误兜底引导用户更新令牌。若需批量清理，做一次性迁移脚本
- web/default 主题暂未适配（按项目约定 default 适配延后到上游 v1.0.0 之后）
- model_limits 校验依赖 pricing 缓存（1 分钟刷新一次），刚改完渠道分组挂载后的短时窗口内可能有差错——发生频率极低，且管理员场景下重启服务即可
- 后端 i18n（`i18n/locales/*.yaml`）只覆盖 en / zh-CN / zh-TW 三种语言，与上游 new-api 一致；本次新增的 `distributor.no_available_channel_with_hint` 与 `distributor.get_channel_failed_with_hint` 也仅在这三个文件里补了翻译。fr / ru / ja / vi 用户调 API 出错时会拿到 go-i18n 的默认 fallback（en）。前端 i18n 七语言全覆盖

## 变更文件清单

后端：
- `controller/user.go` — `GetUserModels` 加 `?group=` 参数
- `controller/token.go` — `AddToken` / `UpdateToken` 加 `validateTokenModelLimits` 校验
- `middleware/distributor.go` — 错误信息加 `availableGroupsHint`
- `i18n/keys.go`、`i18n/locales/{en,zh-CN,zh-TW}.yaml` — 新增两条 i18n key

前端 classic：
- `web/classic/src/components/table/tokens/modals/EditTokenModal.jsx` — 令牌弹窗联动
- `web/classic/src/hooks/playground/useDataLoader.js` — Playground 模型按分组过滤
- `web/classic/src/components/playground/SettingsPanel.jsx` — 分组标签 Tooltip
- `web/classic/src/hooks/model-pricing/useModelPricingData.jsx` — 模型广场支持 `?group=` URL 参数同步

文档：
- `docs/group-model-isolation.md`（本文件）
