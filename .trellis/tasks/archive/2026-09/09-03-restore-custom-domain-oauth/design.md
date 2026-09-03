# 恢复 ui-domain 专属域名能力技术设计

## 1. 结论

采用“不改写共享历史、从已验证集成树选择性恢复”的方案。

- 恢复源固定为 `2bf6b850e4df6b01ce3a66adc40d7b8d23b2935b`，即 `69837cf8^`。
- 该提交已经包含 `41a942f6` 合入的完整专属域名能力，以及其后的 UI 修复，是当前历史中最后一个“UI + 专属域名”完整树。
- 当前 `ui-domain@89caa020` 相对 `69837cf8` 只有 `docker-compose.yml` 变化，因此除 Compose 外，恢复清单内没有后续代码需要手工三方合并。
- 只恢复 `69837cf8` 删除或反向修改的专属域名业务文件与 `.env.example`；保留当前 Trellis、AGENTS、`.gitignore`、Compose、分支历史和所有无关文件。
- 恢复完整原实现，不重新设计协议、不引入新依赖、不改生产基础设施。

## 2. 为什么不再次 merge/cherry-pick 整个分支

`41a942f6` 已把专属域名提交带入 `codex/desktop-api-v2` 的祖先图；`69837cf8` 只撤销树内容，没有移除祖先关系。因此再次 merge 只会带入功能分支在共同祖先后的新提交，已被删除的旧功能不会回来。

整体 revert `69837cf8` 也不可接受，因为该提交同时新增了 `.trellis/`、`.agents/`、`.codex/` 和 `.opencode/`，并调整 AGENTS/ignore 文件；整体反转会误删当前工程治理文件。

选择 `69837cf8^` 作为恢复源的优势：

1. 该树已经完成过 UI 与专属域名的冲突整合。
2. 无需重放一串已存在于祖先图中的提交。
3. 可通过显式路径白名单阻止 Trellis/治理文件回退。
4. 恢复后可对清单执行 `git diff 2bf6b850 -- <paths>`，机械证明内容与已知集成树一致。

## 3. 恢复边界

### 3.1 恢复的生产代码

```text
.env.example
common/custom_domain.go
common/init.go
controller/custom_domain.go
controller/domain_oauth_bridge.go
controller/domain_oauth_handoff.go
controller/misc.go
controller/oauth.go
controller/password_reset_return.go
controller/return_path.go
controller/topup.go
controller/topup_return.go
controller/topup_stripe.go
controller/user.go
main.go
middleware/auth_origin.go
middleware/custom_domain.go
middleware/logger.go
model/auth_flow.go
model/custom_domain.go
model/main.go
model/topup.go
model/user.go
router/api-router.go
router/web-router.go
service/custom_domain.go
service/custom_domain_cli.go
service/password_reset_return.go
service/registration_inviter.go
web/src/features/auth/constants.ts
web/src/features/auth/lib/domain-oauth-handoff.ts
web/src/features/profile/components/tabs/account-bindings-tab.tsx
web/src/routes/oauth/$provider.tsx
```

### 3.2 恢复的测试

```text
common/custom_domain_test.go
controller/custom_domain_oauth_test.go
controller/custom_domain_passkey_test.go
controller/custom_domain_password_reset_link_test.go
controller/custom_domain_password_reset_test.go
controller/custom_domain_registration_test.go
controller/custom_domain_topup_test.go
controller/domain_oauth_bridge_test.go
middleware/custom_domain_test.go
middleware/logger_test.go
model/custom_domain_test.go
model/task_cas_test.go
router/api_router_custom_domain_test.go
service/custom_domain_cli_test.go
service/custom_domain_test.go
service/password_reset_return_test.go
service/registration_inviter_test.go
web/src/features/auth/lib/__tests__/domain-oauth-handoff.test.ts
```

### 3.3 明确保留当前版本

```text
AGENTS.md
.gitignore
.agents/**
.trellis/**
.codex/**
.opencode/**
docker-compose.yml
web/package.json
web/bun.lock
web/node_modules/**
web/dist/**
```

`docker-compose.yml` 保留 `0a13dee0`/`89caa020` 中已经补齐的 Session、Custom Domain 环境映射与带合法 Host 的健康检查。

## 4. 恢复机制

恢复分为测试与实现两批，并始终使用显式路径清单：

1. 先从 `2bf6b850` 恢复测试文件。
2. 运行定向测试，记录因生产符号缺失导致的稳定失败，形成 TDD RED 证据。
3. 再从同一提交恢复生产代码。
4. 使用 `gofmt`、项目前端格式工具处理恢复清单，不做全仓格式化。
5. 对恢复清单比较 `2bf6b850`，任何非预期差异必须解释；对保留清单比较操作前状态，确保未回退。

恢复动作是已知提交到显式文件集的机械还原，不执行 `git reset`、`git checkout .`、整体 revert、历史重写、force push 或远端操作。

## 5. 恢复后的运行时架构

```text
yeschoy.com ───────────────┐
a.yeschoy.io ──────────────┼─> Preserve Host ─> CustomDomainContext ─> shared New API
b.yeschoy.io ──────────────┘

a.yeschoy.io
  ─> GitHub/LinuxDO
  ─> yeschoy.com/oauth/{provider}
  ─> domain_login_handoff ticket in URL fragment
  ─> a.yeschoy.io/oauth/handoff
  ─> same-origin ticket consume
  ─> Host-only Session on a.yeschoy.io
```

核心安全合同继续以 `.trellis/spec/backend/custom-domain-callbacks.md` 为准：

- 请求身份只来自规范化 `Request.Host`，不信任 `X-Forwarded-Host`。
- OAuth callback 固定在主站；回跳目标来自服务端 state/domain 记录。
- ticket 短时、单次消费并绑定目标 Host、用户/Session 版本与发起浏览器 binding。
- ticket 只进入 fragment 和同源 POST body；Access/Refresh Token 不跨域传递。
- Refresh Cookie 保持 Host-only、Secure、HttpOnly、SameSite=Strict。
- 未知、apex、嵌套、非法、停用域名 fail closed；停用域名只开放最小 fallback 路径。

## 6. 数据与兼容性

- 恢复 `custom_domains` 模型与迁移；现有生产表可被 AutoMigrate 幂等识别。
- 恢复 `top_ups.origin_host`；历史空值继续按主站解释。
- `auth_flows` 不新增列，只恢复 domain handoff Purpose 与 JSON payload。
- SQLite、MySQL、PostgreSQL 均使用原实现中的 GORM/兼容约束。
- 功能开关默认关闭；关闭时保持当前单域行为。

本任务不执行生产迁移或数据修改。发布时必须先备份并由用户单独授权生产部署。

## 7. 冲突与偏差处理

执行前再次检查：

```text
git diff --name-status 69837cf8..HEAD
```

若恢复清单内出现 `docker-compose.yml` 之外的后续修改，停止机械恢复，逐文件进入三方差异审查。不得覆盖用户工作区变更。

若已知源测试在当前依赖/编译器下失败：

- 先判断是恢复缺失、当前分支兼容差异还是原实现缺陷。
- 只在恢复清单内做最小兼容修复并补/更新对应测试。
- 不通过删除测试、降低安全校验或扩大信任范围换取通过。

## 8. 发布与回滚边界

本任务只交付本地代码和验证结果，不自动 push、部署或修改生产配置。

建议发布顺序：数据库备份 → 新镜像默认关闭功能 → 主站回归 → 开启功能 → A 域名 OAuth/密码/支付验收 → 扩大域名。

运行时回滚优先设置 `CUSTOM_DOMAIN_ENABLED=false`；数据库新增表/列保留，不做破坏性 down migration。代码回滚由独立提交完成，不重写历史。
