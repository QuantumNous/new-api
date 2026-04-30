# 身份与订阅迁移设计方案（灰度到飞书-only）

## 1. 目标与范围

本方案覆盖两块：

1. 订阅套餐与分组、用户之间的双向联动
2. 飞书 OAuth 灰度迁移到飞书-only 登录

不包含前端 UI 精修，仅定义后端能力、数据迁移策略、接口与上线流程。

## 2. 需求确认结论

### 2.1 登录与身份规则

- 采用灰度切换：先支持“密码 + 飞书并行”，最终切飞书-only
- 一旦用户已有飞书关联 ID（union_id/open_id/provider_user_id），立即禁止密码登录，仅允许飞书授权登录
- 飞书身份键策略：同时存 `union_id` 与 `open_id`，`union_id` 为主键，`open_id` 为辅键
- 存量用户首次飞书登录后，平台用户名强制同步为飞书用户名

### 2.2 订阅与分组联动规则

- 用户分组变化时：自动匹配该分组绑定的订阅套餐并同步用户订阅
- 套餐绑定分组变化时：该分组下用户的订阅同步变更
- 联动需幂等、可追踪、可回滚（至少支持重放任务）

## 3. 现状评估

当前仓库已有部分基础：

- 订阅模型已有分组关联和用户分组变化处理雏形（`HandleUserGroupChange`）
- 已有管理端订阅绑定接口
- OAuth 已有 custom provider 与用户绑定结构（`user_oauth_bindings`）

缺口：

- 缺少“存量用户批量回填飞书绑定”接口
- 缺少“已绑定飞书即禁用密码登录”的强约束
- 缺少“套餐分组变更后批量同步用户订阅”的管理任务接口
- 缺少迁移审计与冲突处理规范

## 4. 总体方案

## 4.1 模块拆分

A. `Auth Policy`：登录策略控制（并行/飞书-only）
B. `Feishu Binding Migration`：存量用户绑定导入与自动关联
C. `Subscription Group Sync`：分组与套餐、用户订阅联动
D. `Audit & Replay`：迁移审计、失败重试与回放

## 4.2 状态机（身份迁移）

用户状态：

- `legacy_password_user`：无飞书绑定，允许密码
- `bound_feishu_user`：已有飞书绑定，禁止密码
- `feishu_only_enforced`：全局飞书-only 模式下用户

迁移动作：

1. 批量导入绑定：`legacy_password_user -> bound_feishu_user`
2. 首次飞书登录自动绑定：`legacy_password_user -> bound_feishu_user`
3. 全局开关切换：`* -> feishu_only_enforced`

## 5. 数据与约束设计

## 5.1 用户 OAuth 绑定数据

在 `user_oauth_bindings` 保证：

- `provider_slug = feishu`
- 主唯一键：`(provider_slug, union_id)`（建议通过 provider_user_id 承载 union_id）
- 辅助索引：`(provider_slug, open_id)`（可放 extra JSON 或扩展字段）

约束：

- 同一 `union_id` 只能绑定一个平台用户
- 一个用户可有一个飞书绑定（允许历史覆盖需审计）

## 5.2 用户名同步规则

当飞书登录返回用户名 `feishu_username` 时：

- 平台 `username` 强制更新为 `feishu_username`
- 若冲突，按规则自动生成安全后缀（如 `_fs_{uid尾号}`）
- 同步写入审计日志：旧用户名、新用户名、触发方式

## 5.3 订阅分组联动数据

新增或复用“分组-套餐映射”关系：

- 一个分组对应一个主套餐（MVP）
- 套餐改绑分组时，触发该分组用户订阅重算

## 6. 接口设计（MVP）

## 6.1 飞书绑定导入接口（管理员）

`POST /api/user/admin/oauth/feishu/import`

- 入参：数组 `{ user_id | username, union_id, open_id, feishu_username }`
- 行为：
  - 绑定写入/更新（幂等）
  - 用户名同步为飞书用户名（按冲突规则）
  - 返回成功/失败明细

## 6.2 飞书绑定查询接口（管理员）

`GET /api/user/admin/oauth/feishu/bindings`

- 支持分页、按 user_id/username/union_id 查询

## 6.3 飞书绑定修复重放接口（管理员）

`POST /api/user/admin/oauth/feishu/replay`

- 对失败记录按批次重试

## 6.4 分组联动重算接口（管理员）

`POST /api/subscription/admin/group-sync`

- 入参：`group_name` 或 `plan_id` 或 `full=true`
- 行为：重算并同步受影响用户订阅

## 6.5 登录策略开关接口（Root）

`PUT /api/option/auth-policy`

- `mode = parallel | feishu_only`
- 并行模式下：已绑定飞书用户仍禁密码
- 飞书-only：所有密码登录禁用

## 7. 关键流程

## 7.1 密码登录拦截

登录前检查：

- 若用户存在飞书绑定 -> 直接拒绝密码登录并返回“请使用飞书登录”
- 否则按既有逻辑

## 7.2 飞书登录自动绑定与用户名同步

- 按 `union_id` 先查绑定
- 未命中时，可按受控规则尝试匹配存量账号（仅灰度阶段开启）
- 成功后写绑定并同步用户名

## 7.3 套餐绑定分组变更同步

- 套餐更新事件触发异步任务
- 扫描受影响用户分组
- 执行订阅切换（幂等）
- 记录审计

## 8. 安全与审计

- 所有导入/重算接口仅 `AdminAuth` 或 `RootAuth`
- 批量接口必须写操作日志（操作者、批次号、影响行数、失败原因）
- 对 `union_id/open_id` 做最小化展示（脱敏）

## 9. 发布与灰度计划

阶段 1：并行 + 导入

- 上线导入接口与拦截逻辑
- 批量回填飞书绑定

阶段 2：观测

- 观测密码登录拒绝率、飞书登录成功率、用户名冲突率

阶段 3：切飞书-only

- 开启 `feishu_only`
- 保留回放接口一段时间

## 10. 验收标准

- 已绑定飞书的用户，密码登录必拒绝
- 存量用户导入绑定成功率可观测，可重放失败项
- 飞书登录后用户名完成同步且冲突可自动处理
- 分组变更与套餐分组变更均能触发用户订阅同步
- 关键链路有审计记录

## 11. 实施顺序

1. 登录拦截策略 + 配置开关
2. 飞书绑定导入/查询/回放接口
3. 首次飞书登录自动绑定与用户名同步
4. 套餐分组变更触发用户订阅同步
5. 灰度发布与监控
