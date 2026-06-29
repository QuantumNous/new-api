# 渠道按选中项批量编辑 — 设计 Spec

日期：2026-06-29
模块：`web/default/`（控制台前端）、`controller/`、`model/`、`router/`（后端）
状态：已与用户确认设计，待编写实现计划

## 1. 背景与动机

渠道管理页（`web/default/src/features/channels/`）目前有两套批量能力：

- **按标签（tag）批量编辑**：`TagBatchEditDialog` + 后端 `PUT /api/channel/tag` →
  `model.EditChannelByTag`。可对同一 tag 下的所有渠道批量覆盖修改 模型 / 模型映射 /
  分组 / 标签名 / 优先级 / 权重 等。
- **按勾选 ID 批量操作**：`data-table-bulk-actions.tsx` 工具栏 + 后端
  `POST /api/channel/batch`（删除）、`POST /api/channel/batch/tag`（设标签）。目前仅支持
  启用 / 禁用 / 设置标签 / 删除。

**缺口**：用户无法对「任意勾选的一批渠道」批量修改 分组 / 模型 / 模型映射 / 优先级 /
权重。当前只有按 tag 才能做这类字段批量编辑，但很多时候需要批量改的是跨 tag 或未打 tag
的一组渠道。

**目标**：在批量操作工具栏新增「批量编辑」入口，弹窗内对选中渠道以**覆盖语义**批量修改
分组 / 模型 / 模型映射 / 优先级 / 权重，与现有「按标签批量编辑」的体验一致。

## 2. 需求

### 2.1 功能需求

1. 在渠道列表勾选 ≥1 条渠道后，批量操作工具栏出现「批量编辑」按钮。
2. 点击打开弹窗，标题/描述显示当前选中渠道数量。
3. 弹窗内可填写以下字段，全部为可选，**留空 = 不修改**（覆盖语义）：
   - 模型（models）：逗号分隔的模型名文本框。
   - 模型映射（model_mapping）：复用 `ModelMappingEditor`，必须为合法 JSON。
   - 分组（groups）：多选（复用 `MultiSelect`，数据源同 `getGroups`）。
   - 优先级（priority）：数字输入。
   - 权重（weight）：数字输入。
4. 提交后对所有选中渠道执行覆盖更新；成功 toast 提示更新数量，失败 toast 提示错误。
5. 成功后失效渠道列表查询（`channelsQueryKeys.lists()`）并清空勾选、关闭弹窗。
6. **不**包含 标签名 / param_override / header_override（设标签已有专门入口；后两者 YAGNI）。
7. **清空限制（与按标签批量编辑一致）**：`models` / `groups` 为非空字符串才覆盖，传空 = 不
   修改，因此**不能**通过批量编辑清空这两列；`model_mapping` / `priority` / `weight` 可清零
   （传空串 / 0）。此为 `EditChannelByTag` 既有行为，本功能对齐。

### 2.2 非功能需求 / 约束

- **覆盖语义**：与 `TagBatchEditDialog` 完全一致；弹窗顶部 Alert 明确提示。
- **跨 DB 兼容**（CLAUDE.md Rule 2）：仅用 GORM 抽象（`Updates` + `Where("id IN ?")`），
  不写方言 SQL。
- **多节点**（CLAUDE.md Rule 11）：采用与 `EditChannelByTag` 一致的非事务模式——`DB.Updates`
  先提交，再 `GetChannelsByIds` 读已提交的新值重建 abilities。**刻意不**用外层事务包裹
  abilities 重建，原因是 `GetChannelsByIds` 走全局 `DB`（独立连接），在 MySQL/PG 生产环境
  下读不到外层事务内未提交的写入，会用旧 models/group/priority/weight 重建 abilities（路由
  出错）。abilities 重建失败仅记日志、不回滚（与 `EditChannelByTag` 行为一致）。完成后调用
  `publishChannelsChanged()` 触发跨节点缓存同步。
- **i18n**（CLAUDE.md 强约束）：所有新增用户可见文案走 `t()`，新 key 必须写入
  `web/default/src/i18n/locales/` 下全部 8 个语言文件，改完跑 `bun run i18n:sync` 并核对
  `_reports/{lang}.untranslated.json`。
- **JSON 规范**（CLAUDE.md Rule 1）：后端若需校验 JSON 用现有方式（`json.Valid` /
  `common.*`），与 `EditTagChannels` 一致。

### 2.3 非目标（Out of Scope）

- 合并/追加语义（追加模型、移除模型等）。
- 批量修改 标签 / param_override / header_override / 状态 / 密钥。
- 按 tag 批量编辑的任何改动（保持现状）。

## 3. 设计

### 3.1 后端

#### 3.1.1 新增结构体（`controller/channel.go`，紧邻 `ChannelBatch`）

```go
type ChannelBatchEdit struct {
    Ids          []int   `json:"ids"`
    Models       *string `json:"models"`
    ModelMapping *string `json:"model_mapping"`
    Groups       *string `json:"groups"`
    Priority     *int64  `json:"priority"`
    Weight       *uint   `json:"weight"`
}
```

字段语义与现有 `ChannelTag` / `EditChannelByTag` 参数一一对应：

- `Groups`（JSON `groups`）→ 写入 `Channel.Group` 列（与按标签批量编辑一致，分组以逗号分隔
  的单字符串存储；前端多选后 `join(',')`）。
- `Models` → `Channel.Models`；变更需重建 abilities。
- `ModelMapping` → `Channel.ModelMapping`；不影响 abilities。
- `Priority` / `Weight` → 对应列；变更需同步 abilities 表。

#### 3.1.2 新增 handler（`controller/channel.go`）

`EditChannelBatch(c *gin.Context)`：

1. `ShouldBindJSON(&batchEdit)`；`len(Ids) == 0` → 返回参数错误。
2. 若 `ModelMapping != nil`：`TrimSpace` 后非空则校验 `json.Valid`，不合法返回错误（参照
   `EditTagChannels` 对 `ParamOverride` 的处理）。
3. 调用 `model.EditChannelsByIds(batchEdit.Ids, batchEdit.ModelMapping, batchEdit.Models,
   batchEdit.Groups, batchEdit.Priority, batchEdit.Weight)`；错误走 `common.ApiError`。
4. 成功：`model.InitChannelCache()` + 返回 `{success:true, data: len(Ids)}`。

#### 3.1.3 新增 model 函数（`model/channel.go`，紧邻 `EditChannelByTag`）

```go
func EditChannelsByIds(ids []int, modelMapping, models, group *string, priority *int64, weight *uint) error
```

逻辑**完全镜像 `EditChannelByTag`**（含其非事务模式），仅把 `WHERE tag = ?` 换成
`WHERE id IN (?)`：

1. 构造 `updateData := Channel{}`。
2. 按指针非 nil 填充字段（`modelMapping` / `models` / `group` / `priority` / `weight`）。
3. `DB.Model(&Channel{}).Where("id IN ?", ids).Updates(updateData)`（自动提交，与
   `EditChannelByTag` 一致）。
4. abilities 处理：当 `models`、`group`、`priority`、`weight` 任一变更时，
   `GetChannelsByIds(ids)` 读**已提交**的新值，逐个 `channel.UpdateAbilities(nil)`（各自独立
   事务）。`modelMapping` 单独变更不触发重建（无影响）。重建失败仅 `common.SysLog` 记录、不
   中断、不回滚（与 `EditChannelByTag` 完全一致）。
   - **不**用外层事务包裹：`GetChannelsByIds` 走全局 `DB` 独立连接，事务内读不到未提交写入，
     生产 MySQL/PG 会用旧值重建 abilities（详见 §2.2 多节点说明）。
   - 理由：选中渠道数量通常很小，逐个重建成本可忽略；`UpdateAbilities` 读取渠道最新的
     priority/weight/models/group，比手写按 ids 的能力更新更稳（当前不存在
     `UpdateAbilityByIds`）。
5. `publishChannelsChanged()`。

> 说明：`EditChannelByTag` 在仅改 priority/weight 时走轻量的 `UpdateAbilityByTag`；按 ids
> 没有等价函数，故统一走 `UpdateAbilities`，正确性优先。

#### 3.1.4 新增路由（`router/api-router.go`，紧邻 `channelRoute.POST("/batch/tag", ...)`）

```go
channelRoute.PUT("/batch", controller.EditChannelBatch)
```

> `POST /api/channel/batch` 已被「批量删除」占用，故批量编辑用 `PUT /api/channel/batch`，
> 语义贴切且不冲突。复用现有管理员鉴权中间件（与同组路由一致）。

### 3.2 前端

#### 3.2.1 API 层（`features/channels/api.ts`）

```ts
export interface BatchEditChannelsParams {
  ids: number[]
  models?: string
  model_mapping?: string
  groups?: string // 逗号分隔
  priority?: number
  weight?: number
}

export async function batchEditChannels(
  data: BatchEditChannelsParams
): Promise<{ success: boolean; message?: string; data?: number }> {
  const res = await api.put('/api/channel/batch', data, channelActionConfig())
  return res.data
}
```

#### 3.2.2 Action 层（`features/channels/lib/channel-actions.ts`）

新增 `handleBatchEdit(ids, payload, queryClient, onSuccess)`，与 `handleBatchSetTag` 形态
一致：空选 toast 报错；成功 toast `{{count}} channel(s) updated`，失效
`channelsQueryKeys.lists()`，调 `onSuccess`。

#### 3.2.3 新弹窗（`features/channels/components/dialogs/batch-edit-channels-dialog.tsx`）

复用 `TagBatchEditDialog` 的表单结构，关键差异：

- props：`{ open, onOpenChange, ids: number[] }`（不依赖 `useChannels().currentTag`）。
- 移除「标签名」字段；保留 模型 / 模型映射 / 分组 / 优先级 / 权重。
- 提交调用 `batchEditChannels`；构造 payload 时：`groups = groups.join(',')`，仅包含非空
  字段，model_mapping 走 JSON 合法性校验（与 `TagBatchEditDialog.handleSave` 一致）。
- 顶部 Alert：覆盖语义提示。
- 依赖 `getGroups`（queryKey `['groups']`）与 `ModelMappingEditor`、`MultiSelect`，全部已有。

#### 3.2.4 工具栏入口（`features/channels/components/data-table-bulk-actions.tsx`）

在「设标签」按钮之后、「删除」按钮之前新增「批量编辑」按钮：

- 图标 `PencilLine`（lucide-react）。
- 受控 `showEditDialog` state；点击打开 `BatchEditChannelsDialog`，传入 `selectedIds`。
- 与现有按钮一致的 `variant='outline' size='icon'` + Tooltip。

#### 3.2.5 i18n

新 key（示例，最终以 `t()` 内英文原文为准）写入全部 8 个语言文件：
`en/zh/fr/ru/ja/vi/es/pt`：

- `'Batch Edit'`
- `'Batch edit selected channels'`
- `'Batch edit {{count}} selected channel(s)'`
- `'Edit all selected channels. Filled fields overwrite; empty fields are left unchanged.'`
- `'{{count}} channel(s) updated'`
- 优先级 / 权重 字段 label（如未存在）
- （其余如「模型」「模型映射」「分组」已存在，复用）

完成后在 `web/default/` 跑 `bun run i18n:sync`，核对
`locales/_reports/{lang}.untranslated.json` 不含本次新增 key。

### 3.3 错误处理

- 前端：空选 / model_mapping 非法 JSON → 阻止提交 + toast；接口失败 → toast 错误信息。
- 后端：空 ids / 非法 JSON → `{success:false, message}`；DB 失败 → `common.ApiError`；
  abilities 重建失败 → 仅 `common.SysLog` 记录、不回滚（与 `EditChannelByTag` 一致）。

## 4. 测试与验证

- **后端单测**（参考 `model/` 现有测试模式）：
  - 改 `models` 后 abilities 反映新模型集合。
  - 改 `groups` 后 abilities 的 group 维度正确更新。
  - 仅改 `model_mapping` 不触发 abilities 重建（数量不变）。
  - 仅改 `priority/weight` 后 abilities 表对应列更新。
  - 跨 DB（至少 SQLite 默认跑通；MySQL/PG 走 GORM 抽象保证）。
- **前端**：手动验证勾选 → 批量编辑 → 各字段覆盖生效；i18n 切换语言无英文回退。
- **多节点**：`publishChannelsChanged()` 触发缓存同步（与现有 `EditChannelByTag` 同路径）。

## 5. 部署影响（CLAUDE.md Rule 12，待实现后最终确认）

- **Router deploy：required**。新增 `PUT /api/channel/batch` 路由 + relay/渠道管理相关 model
  与 controller，影响渠道与 abilities 数据（router 节点按 group/model 选路依赖这些）。
- **Other targets**：`newapi-console`、`newapi-router`、legacy `newapi` 三类 Go 节点均需部署
  （同一 Go 二进制，都受路由注册与 abilities 重建逻辑影响）；`newapi-web` 不涉及。
- **Risk / validation**：批量覆盖 models/groups 会重建 abilities，需验证选中渠道路由正确；
  生产发布前在 staging 跑一次批量编辑并确认调用结果与 abilities 一致。

## 6. 影响面 / 风险

- 仅新增接口与 UI 入口，不改动现有按标签批量编辑、单渠道编辑、设标签等逻辑，回归风险低。
- 主要风险：覆盖语义误操作（已用 Alert 提示 + 留空不动缓解）；abilities 重建在选中量大时
  有一定开销（手动勾选场景可接受）。
