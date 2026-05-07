# Feishu OAuth + Subscription + Key 管理 UAT 用例（2026-05-06）

## 测试目标

- 验证第 8 点：飞书应用机器人预警（百分比阈值 + 同用户每日一次）
- 验证第 12 点：用户管理页飞书批量初始化、明文 key 管理页、权限隔离
- 验证订阅统计与分组同步增强接口行为

## 前置条件

- 已配置 `feishu.app_id`、`feishu.app_secret`
- 测试账号：
  - `root_user`（RoleRootUser）
  - `admin_user`（RoleAdminUser）
  - `common_user`（RoleCommonUser，已绑定 feishu_open_id）
- 至少 1 个绑定分组套餐（`bind_group != ''`）

## 用例清单

1. 批量初始化（正向）
- 步骤：
  1) 进入用户管理页，点击 `Feishu Batch Init`
  2) 输入包含 `feishu_open_id` 或 `feishu_user_id` 的 JSON 数组
  3) 提交
- 预期：
  - 返回 `success/skipped/failed` 统计
  - 新用户可在用户表检索到
  - 指定分组用户可自动挂载 `bind_group` 套餐

2. 批量初始化（异常）
- 步骤：提交缺少飞书标识的 item
- 预期：该 item 失败并返回可读错误，不影响其他 item

3. 明文 key 权限（默认）
- 步骤：
  1) 用 `admin_user` 打开 `Feishu Keys`，尝试查询或创建
  2) 用 `root_user` 执行同样操作
- 预期：
  - `admin_user` 被拒绝（403）
  - `root_user` 可查询并创建，创建响应含明文 `key`

4. 明文 key 权限（放开 Admin）
- 步骤：设置 `feishu.allow_admin_manage_plaintext_tokens=true` 后重试
- 预期：`admin_user` 可查询/创建明文 key

5. 预警阈值百分比
- 步骤：
  1) 用户通知方式设为 `feishu_app`
  2) 阈值设为 `20`
  3) 触发请求使订阅剩余比例低于 20%
- 预期：
  - 用户收到飞书应用消息
  - 文案包含剩余额度与百分比

6. 预警频控（每日一次）
- 步骤：同一用户当天连续触发两次低额度告警
- 预期：
  - 第一次发送成功
  - 第二次被限流（不再发送）

7. 分组同步补齐
- 步骤：调用 `POST /api/user/group-sync`，`only_missing=true`
- 预期：
  - `updated` 仅统计缺失订阅用户
  - `skipped` 正确包含已生效/不适用用户

8. 订阅使用视图
- 步骤：
  1) 打开订阅页 `Usage View`
  2) 分别查询 Plan Usage、Org Usage、Inactive Users
- 预期：数据可加载、分页和筛选可用

## 本地自动化验证（本次已执行）

- `go test ./controller -run TestEnsureFeishuPlaintextTokenPermission -v`
- `go test ./service -run TestCheckNotificationLimit -v`
- `go test ./controller ./service ./setting/system_setting`
- `cd web/classic && bun run typecheck`

