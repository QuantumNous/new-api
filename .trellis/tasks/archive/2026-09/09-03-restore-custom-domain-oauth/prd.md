# 恢复 ui-domain 专属域名 OAuth

## Goal

在不改写共享分支历史的前提下，将被 `69837cf8` 删除的专属域名能力精确恢复到 `ui-domain`，保留现有 UI、Trellis 与后续修复，使从 `*.yeschoy.io` 发起的 GitHub/LinuxDO 登录经过固定主域名回调后安全返回原域名并建立独立 Session。

## Background

- `origin/codex/desktop-api-v2` 是 UI 分支，但曾通过 `41a942f6` 误合并专属域名分支。
- `69837cf8` 为恢复 UI 分支而删除专属域名实现，同时包含大量 Trellis 文件变更，因此不能整体 revert。
- `origin/feat/custom-domain-callback-flow` 保留完整专属域名实现；后续 `89caa020` 再次 merge 时，Git 仅带回了 `docker-compose.yml`，没有恢复已被 revert 的实现。
- 当前生产 OAuth state 可以创建并消费，`SESSION_COOKIE_TRUSTED_URL` 已生效；失败点是固定回调在 `yeschoy.com` 建立的 Host-only Session 无法交接回 `ai.yeschoy.io`。
- 原始需求与验收合同位于 `.trellis/tasks/09-01-custom-domain-callback-flow/` 和 `.trellis/spec/backend/custom-domain-callbacks.md`。

## Requirements

- R1：保留 `ui-domain` 当前 UI、Trellis、依赖和现有修复，不重写 `origin/codex/desktop-api-v2`、`origin/feat/custom-domain-callback-flow` 或 `origin/ui-domain` 的历史。
- R2：不能再次普通 merge 同一功能分支，也不能整体 revert `69837cf8`；恢复必须基于明确的文件/提交差异并审查所有冲突。
- R3：恢复后的 OAuth 流程必须继续使用 `yeschoy.com` 固定 callback，并通过短时、一次性、目标 Host 与发起浏览器绑定的 handoff 返回原专属域名。
- R4：主站与各专属域名继续使用独立 Host-only Session Cookie，不共享 Access/Refresh Token，不使用父域 Cookie。
- R5：功能关闭时保持当前单域行为；未知、非法、嵌套、apex 或停用专属域名保持 fail-closed。
- R6：所有数据库变化兼容 SQLite、MySQL 和 PostgreSQL，恢复已有迁移与回归测试。
- R7：恢复范围不得夹带无关格式化、构建产物、锁文件或历史重写。
- R8：恢复原专属域名完整能力，包括域名模型/CLI、Host 路由、邀请归属、GitHub/LinuxDO OAuth handoff、密码重置与易支付/Stripe 钱包回跳；不得交付仅 OAuth 的部分恢复状态。

## Acceptance Criteria

- [x] AC1：`ui-domain` 包含专属域名配置初始化、Host 中间件、模型/CLI 与所选业务回调实现，且现有 UI/Trellis 文件未被删除或回退。
- [x] AC2：从已启用的 `a.yeschoy.io` 发起 GitHub/LinuxDO 登录，主域 callback 后返回 A 并建立 A 的独立 Session。
- [x] AC3：OAuth ticket 对过期、重放、换域、binding 缺失/篡改和另一浏览器复制均拒绝；目标停用时安全回退主站。
- [x] AC4：域名 CLI 支持 assign/enable/disable/show/list，并保持 label 永久唯一、owner 不可改绑及一位 owner 最多一个启用域名。
- [x] AC5：专属域名无显式 `aff` 注册时使用当前有效 owner；非空显式 `aff` 完全保持上游语义；已有用户跨域登录不改变邀请关系。
- [x] AC6：专属域名密码重置安全返回原域，签名篡改/过期失败，目标停用时回退主站。
- [x] AC7：易支付与 Stripe 钱包订单保存可信来源 Host；服务端通知继续验签幂等入账，浏览器返回原域或在目标停用时回退主站。
- [x] AC8：主站 OAuth、密码登录、TOTP、Session 刷新/退出、显式邀请、钱包入账及历史数据兼容逻辑无回归。
- [x] AC9：功能关闭时主站行为保持当前基线；开启时 apex、未知、非法、嵌套与停用域名返回预期结果。
- [x] AC10：相关 Go 定向测试、race、根模块测试、前端类型检查/测试/lint/格式检查/生产构建以及跨层代码审查全部通过。
- [x] AC11：最终 Git diff 只包含经确认的恢复范围，不包含用户现有或无关变更。

## Out of Scope

- 改写或强制推送现有远端分支历史。
- 直接修改生产 DNS、证书、GitHub/LinuxDO OAuth App、Nginx、Redis 或生产数据库。
- 新增白标、多租户隔离、客户自助域名或新的 OAuth provider。
