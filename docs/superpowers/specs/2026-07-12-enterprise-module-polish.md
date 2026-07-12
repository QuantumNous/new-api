# 企业管理模块完善（邀请码/标签/成员详情/申请理由）

日期：2026-07-12
关联：`2026-07-12-enterprise-management-design.md`（初版设计）

## 背景

初版企业管理模块已上线，但存在数据契约 bug、信息展示不全、部分后端能力前端未接入等问题。本次为完善迭代，一次性修复 bug + 补齐信息展示 + 接入已有后端能力 + 少量新功能。

## 问题清单（来自用户反馈）

| # | 问题 | 类别 |
|---|---|---|
| 1 | 邀请码点"废弃"后仍显示在列表 | Bug |
| 2 | struct tag 写错，JSON 字段名变成 `max_uses;not null`，前端读不到值（列表显示 `/`） | Bug |
| 3 | 邀请码"最大使用次数"输入框默认 -1 无说明，看不懂 | 体验 |
| 4 | 邀请码列表的 `used_count / max_uses` 无表头，含义不明 | 体验 |
| 5 | 成员列表缺：加入时间、通过哪个邀请码、审批人 | 体验 |
| 6 | 加入申请不支持填写申请理由 | 功能缺失 |
| 7 | 标签不支持删除 | 功能缺失（后端已实现，前端未接入） |
| 8 | 不支持按标签筛选成员 | 功能缺失（后端已实现单标签，前端未接入） |

## 已确认的产品决策

1. **废弃邀请码**：默认隐藏，提供"显示已废弃"开关切换查看。
2. **成员加入流程**：邀请码直接加入（免审批，现状），申请理由为可选字段；理由在成员/申请详情可见。
3. **标签筛选**：成员表格上方加 chip 多选，多标签为**交集（AND）**关系。
4. **成员展示字段**：加入时间、邀请码、审批人、成员备注，全部展示。
5. **改造范围**：一次性重构到位（修 struct tag + 加字段 + 接入前端能力）。

## 后端改动

### 1. 修复 struct tag（`enterprise/models.go`）

`Invitation`、`JoinRequest`、`Tag`、`MemberTag` 的 json tag 误写为 `json:"xxx;not null"`，导致 JSON 字段名带 `;not null`。拆分为独立的 `gorm` 与 `json` tag：

```go
// 修复前
MaxUses int `json:"max_uses;not null"`
// 修复后
MaxUses int `json:"max_uses" gorm:"not null"`
```

涉及字段：`Invitation` 全部、`JoinRequest` 的 `InvitationId/Status/ReviewedBy/ReviewedAt/CreatedTime`、`Tag.CreatedTime`、`MemberTag.CreatedTime`。

### 2. 数据模型扩展（`enterprise/models.go`）

新增字段（GORM AutoMigrate 自动 ADD COLUMN，三种 DB 兼容；**不设 default tag**，由代码填零值）：

**Member**（`enterprise_members`）：
- `InvitationId int` — 通过哪个邀请码加入（0 = 企业创建时的初始管理员）
- `ReviewedBy int` — 审批人 user_id（0 = 邀请码免审批直接加入）
- `ReviewedAt int64` — 审批时间（0 = 免审批）

**JoinRequest**（`enterprise_join_requests`）：
- `Remark string` — 申请理由（可空，`gorm:"size:256"`）

### 3. 写入逻辑

- `joinEnterprise`（`enterprise/join_request.go`）：创建 JoinRequest 时写入 `Remark`（请求体新增可选 `remark` 字段，限 256 字符）。
- `joinEnterprise` approve 分支 / 邀请码直接加入路径：创建/恢复 Member 时填 `InvitationId`（来自申请或邀请码）、`ReviewedBy`、`ReviewedAt`。
  - 注意：当前 `joinEnterprise` 仅创建 pending 申请，真正入企业发生在 `reviewJoinRequest` 的 approve 分支。因此 `InvitationId/ReviewedBy/ReviewedAt` 在 approve 分支写入；免审批场景 ReviewedBy=0、ReviewedAt=0。

### 4. 查询/接口调整

| 接口 | 改动 |
|---|---|
| `GET /enterprise/me/members` | 响应 member 增 `invitation_id/reviewed_by/reviewed_at`；`tag_id` 参数升级为支持 `tag_ids`（逗号分隔多值，**交集 AND**） |
| `GET /enterprise/me/invitations` | 加 `status` 查询参数：默认/`active` 只返回 Enabled；`all` 返回全部 |
| `GET /enterprise/me/join-requests` | 响应增 `remark` |

**多标签交集实现**（`listMembers`，`enterprise/member.go`）：
- 解析 `tag_ids`（逗号分隔正整数），保留现有单个 `tag_id` 向后兼容。
- 多标签时用子查询：`members.id IN (SELECT member_id FROM enterprise_member_tags WHERE tag_id IN (?) GROUP BY member_id HAVING COUNT(DISTINCT tag_id) = N)`，三种 DB 通用。
- 单标签沿用现有 JOIN 逻辑。

**邀请码列表过滤**（`listInvitations`，`enterprise/invitation.go`）：
- `status` 缺省/`active` → `WHERE status = InvitationStatusEnabled`
- `status=all` → 不加过滤

### 5. DTO 调整（`enterprise/dto.go`）

- `enterpriseMemberResponse` 增 `InvitationId/ReviewedBy/ReviewedAt`，并在 `memberRecord`/`response()` 透传。
- `joinEnterpriseRequest` 增 `Remark string`。
- `joinRequestResponse` 增 `Remark`。

## 前端改动

### `types.ts`

- `EnterpriseMember` 增 `invitation_id/reviewed_by/reviewed_at`。
- `EnterpriseInvitation` 增 `enterprise_id/created_by/created_time`（修完 struct tag 后才有）。
- `JoinRequest` 已有 `remark`，确认对齐。
- `EnterpriseTag` 增 `created_time`（可选展示）。

### `api.ts`

- `listInvitations(status?)`：传 `status` query。
- `listMembers(params)`：支持 `tag_ids`（数组 → 逗号串）。
- 新增 `deleteTag(id)`：`DELETE /api/enterprise/me/tags/:id`。

### `index.tsx` → `EnterpriseAdminPanel` 重构

**邀请码区**：
- 创建表单：输入框加 label"最大使用次数" + helper"−1 表示无限次"。
- 列表改表格，列：邀请码（等宽，带复制按钮）、状态徽标（有效/已废弃）、使用情况 `used/max`（max=-1 显示 ∞）、创建时间、创建人、操作（复制/废弃）。
- 顶部加"显示已废弃"开关；关闭时只拉 `active`，打开时拉 `all`。

**成员表格**：
- 新增列：加入时间、邀请码（显示码后 6 位，无则 `-`）、审批人（user_id → username，0 显示"免审批"）、备注。
- 表格上方加标签筛选 chip 行：渲染所有 tags，多选高亮；选中后以 `tag_ids` 交集筛选成员列表。
- 现有"多选成员下发额度"逻辑保留，与筛选正交。

**标签区**：
- 每个标签 chip 加删除按钮（×），点击二次确认后调 `deleteTag` 并刷新。
- 复用现有 `createTag` 表单。

**加入申请区**：
- 每条申请展示申请理由 `remark`（空则显示"—"）。

## 错误处理 / 安全

- 所有 manager 接口已有 `EnterpriseAdminAuth()` 中间件，保持不变。
- `tag_ids` 解析失败返回 400。
- `remark` 超长（>256）后端截断或 400（选 400，提示用户）。
- 删除标签为级联删除绑定（已在 `deleteTag` 事务内），无软删除需求。

## 测试

- 后端：`listMembers` 多标签交集查询的表驱动测试（覆盖 0/1/2 标签、无匹配）。
- struct tag 修复后，用一个 marshal 断言测试锁住字段名（防止回退）。
- 不新增无意义的冒烟测试。

## 不做（YAGNI）

- 不加邀请码过期时间 UI（`expired_at` 字段保留但本轮不做选择器，保留输入 0=永不过期）。
- 不加成员备注的编辑接口（本轮只展示已有 remark；如需编辑下一轮）。
- 不加审批人 username 解析为独立接口；通过现有用户信息或冗余展示 user_id。
- 不引入软删除/审计日志。
