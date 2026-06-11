# 飞书批量初始化可视化与用户组织信息同步设计

## 背景

当前 default 前端的“飞书批量初始化”弹窗要求管理员直接录入 JSON，和 classic 前端已有的可视化表格录入方式不一致，测试与日常使用成本较高。

同时，系统已有飞书 OpenID 绑定能力，但缺少定期根据飞书 OpenID 同步用户组织信息的能力。需要先提供手动触发按钮，便于上线定时任务前验证同步准确性。

## 目标

1. 将 default 前端的飞书批量初始化改成可视化配置方式，不再要求手写 JSON。
2. 新增手动同步飞书用户组织信息功能，只处理系统内已有 `feishu_id`（飞书 OpenID）的用户。
3. 同步并保存：所在部门名称、所在部门 ID、上级部门名称、上级部门 ID、完整部门路径、一级组织名称、二级组织名称、飞书在职状态、最近同步时间。
4. 在用户详情中展示飞书组织信息。
5. 用户列表支持按当前筛选条件导出全部匹配用户，导出字段包含飞书组织信息。
6. 飞书接口调用优先使用飞书官方 Go SDK。

## 非目标

1. 本轮不处理只有 `feishu_union_id` 或 `feishu_user_id` 但缺少 OpenID 的用户补齐。
2. 本轮不同步禁用系统账号；飞书离职状态只记录，不改变系统用户状态。
3. 本轮先实现手动同步能力，定时任务复用同一同步 service，可后续再启用。

## 前端设计

### 飞书批量初始化弹窗

改造 `web/default/src/features/users/components/feishu-batch-init-dialog.tsx`：

- 表格逐行录入：
  - 工号
  - 手机号
  - 邮箱
  - 显示名
  - 分组下拉
- 打开弹窗时调用 `/api/group/` 获取最新分组。
- 支持新增行、删除行。
- 支持预览用户：调用 `POST /api/user/feishu/users/batch`，请求体传 `preview_only=true`。
- 支持勾选预览结果后确认初始化：同一接口传 `preview_only=false`，每个用户传 `confirmed=true`。
- 展示预览结果中的 OpenID、UnionID、UserID、姓名、组织、岗位、状态与错误信息。

### 手动同步按钮

在用户管理页主按钮区新增“同步飞书用户信息”：

- 调用 `POST /api/user/feishu/users/sync-info`。
- 完成后刷新用户列表。
- toast 展示总数、成功、跳过、失败。

### 用户详情展示

在用户详情或编辑抽屉中增加只读飞书组织信息区域：

- 所在部门：名称
- 上级部门：名称
- 部门路径：`一级组织/二级组织/.../当前部门`
- 飞书在职状态
- 最近同步时间

### 用户列表导出

新增导出按钮，导出当前筛选条件下的全部匹配用户：

- 保留当前搜索关键词、分组、状态、角色筛选条件。
- 触发后下载 CSV。
- 导出字段包含基础用户信息、飞书组织名称、部门路径、一级组织名称、二级组织名称；用户可见导出不包含部门 ID。

## 后端设计

### 数据模型

在 `model.User` 上新增字段：

- `FeishuDepartmentId` / `feishu_department_id`
- `FeishuDepartmentName` / `feishu_department_name`
- `FeishuParentDepartmentId` / `feishu_parent_department_id`
- `FeishuParentDepartmentName` / `feishu_parent_department_name`
- `FeishuEmploymentStatus` / `feishu_employment_status`
- `FeishuSyncedAt` / `feishu_synced_at`
- `OrgPath` / `org_path`
- `OrgLevel1Name` / `org_level1_name`
- `OrgLevel2Name` / `org_level2_name`

通过现有 GORM AutoMigrate 增量迁移，保持 SQLite、MySQL、PostgreSQL 兼容。

### 飞书同步 service

新增可复用同步逻辑：

1. 读取系统飞书配置 `feishu.app_id` 与 `feishu.app_secret`。
2. 使用飞书官方 Go SDK 创建 client。
3. 查询所有 `feishu_id <> ''` 的用户。
4. 按用户 OpenID 调用飞书通讯录用户接口获取部门 ID、用户状态等信息。
5. 获取所在部门详情，再获取父级部门详情。
6. 更新用户飞书组织字段。
7. 单用户失败不阻断整体同步，汇总返回。

### 手动同步接口

新增管理员接口：

`POST /api/user/feishu/users/sync-info`

返回：

```json
{
  "total": 10,
  "success": 8,
  "skipped": 1,
  "failed": 1,
  "errors": ["user 12: ..."]
}
```

### 用户导出接口

新增管理员接口：

`GET /api/user/export`

查询参数复用用户列表筛选：

- `keyword`
- `group`
- `role`
- `status`

返回 `text/csv` 附件。

### 部门维度用户模型统计

在用户模型统计页新增“部门视角”：

- 后端新增 `GET /api/data/by-department`。
- 按用户表中的 `org_level1_name`、`org_level2_name` 分组聚合。
- 返回一级组织名称、二级组织名称、请求次数、总 Tokens、额度消耗。
- 用户模型统计导出支持 `view_type=by_department`。
- 选择冗余一级/二级字段，是为了避免每次统计都解析完整部门路径，同时避免一次性新增一级到六级字段造成字段膨胀。

## 错误处理

- 飞书配置缺失：同步接口返回失败提示。
- 飞书单个用户查询失败：记录到结果 `errors`，继续处理其他用户。
- 部门信息缺失：允许保存空字段，不视为整批失败。
- 导出无数据：仍返回只包含表头的 CSV。

## 验证点

1. default 飞书批量初始化弹窗无需 JSON，可新增/删除行、预览、勾选确认。
2. 分组下拉来自 `/api/group/`。
3. 手动同步只处理已有 OpenID 用户。
4. 离职状态只记录，不禁用系统账号。
5. 用户详情能看到所在部门和上级部门。
6. 用户导出按当前筛选条件导出全部匹配用户，并包含飞书组织字段。
