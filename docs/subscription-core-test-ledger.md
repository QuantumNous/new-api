# 订阅核心业务测试台账

## 状态说明

| 状态 | 含义 |
| --- | --- |
| ✅ 通过 | 已有自动化测试并在 MySQL `TEST_SQL_DSN` 环境执行通过 |
| ❌ 不通过 | 自动化测试执行失败，需修复后重跑 |
| ⏳ 未测试 | 尚未用自动化或端到端方式验证 |

## 本轮验证环境

| 项目 | 值 |
| --- | --- |
| 日期 | 2026-07-01 |
| 数据库 | MySQL 8.0 docker 容器，测试库 `new_api_test` |
| DSN | `TEST_SQL_DSN=root:password@tcp(127.0.0.1:3306)/new_api_test?parseTime=true&charset=utf8mb4&loc=Local` |
| SQLite | 禁止使用。`AGENTS.md` 已写入 Rule 0，本轮所有通过项均未使用 SQLite |

## 本轮执行命令

| 命令 | 结果 |
| --- | --- |
| `go test ./model -run 'Test(CreateSubscription\|PreConsume\|RefundSubscription\|AdjustSubscription\|GetAllUserSubscriptions\|PostConsumeUserSubscriptionDelta\|Subscription\|Probe)' -count=1 -v -timeout 180s` | ✅ 通过 |
| `go test ./model -run '^TestGroupRestriction' -count=1 -v -timeout 120s` | ✅ 通过 |
| `go test ./model -run '^Test(ResolveUserGroup\|Scenario_)' -count=1 -v -timeout 120s` | ✅ 通过 |
| `go test ./controller -run 'Test(UpdateSubscriptionPriority\|ToggleSubscriptionDisabled\|GetSubscriptionSelf\|UpdateSubscriptionPreference\|UserCancelSubscription\|AdminCreateSubscriptionPlan)' -count=1 -v -timeout 120s` | ✅ 通过 |
| `go test ./service -run 'Test(Settle\|CASGuardedSettle\|RefundTaskQuota\|ConsumeTaskQuota)' -count=1 -v -timeout 180s` | ✅ 通过 |
| `go test ./service -run 'Test(Recalculate\|CASGuardedRefund\|NonTerminalUpdate)' -count=1 -v -timeout 180s` | ✅ 通过 |
| `go test ./model -count=1 -timeout 240s` | ✅ 通过 |
| `go test ./controller -count=1 -timeout 240s` | ✅ 通过 |
| `go test ./service -count=1 -timeout 240s` | ✅ 通过 |
| `docker run ... go test ./model && go test ./controller && go test ./service` with PostgreSQL DSN | ✅ 通过 |
| `docker build -t new-api:test .` | ✅ 通过 |
| `docker compose up -d --force-recreate new-api` | ✅ 通过 |
| `curl -fsS http://localhost:3000/api/status` | ✅ 通过 |
| HTTP E2E: one-time admin/user access tokens, create plan -> bind user -> self query -> preference update -> cleanup | ✅ 通过 |
| Playwright E2E: `/console/subscription` create plan with different total/window quotas -> cleanup | ✅ 通过 |

## 核心业务台账

| Case ID | 模块 | 场景 | 自动化测试 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| SUB-ACT-01 | 创建/激活 | `on_first_use` 购买后为 `pending_activation` | `TestCreateSubscription_OnFirstUse_CreatesPendingActivation` | ✅ 通过 | 首次使用前不设置结束时间 |
| SUB-ACT-02 | 创建/激活 | `immediate` 购买后立即 active | `TestCreateSubscription_Immediate_CreatesActive` | ✅ 通过 | 创建时设置有效期 |
| SUB-ACT-03 | 创建/激活 | `pending_activation` 首次预扣时激活并消费 | `TestPreConsume_PendingActivation_GetsActivated` | ✅ 通过 | 验证首次使用激活 |
| SUB-ACT-04 | 创建/激活 | 禁用的 `pending_activation` 不激活 | `TestPreConsume_DisabledPending_NotActivated` | ✅ 通过 | 禁用优先于激活 |
| SUB-ACT-05 | 创建/激活 | 激活窗口过期后自动 expired 并跳过 | `TestPreConsume_ActivationWindowExpired_Skipped` | ✅ 通过 | 消费链路按需处理 |
| SUB-ACT-06 | 创建/激活 | 激活窗口为 0 时永不过期，首次使用激活 | `TestPreConsume_ActivationWindowZero_AlwaysActivates` | ✅ 通过 | 边界值 |
| SUB-PER-01 | 周期刷新 | 查询订阅时刷新到期周期并清空 `amount_used` | `TestGetAllUserSubscriptions_RefreshesDuePeriod` | ✅ 通过 | 按需刷新，不依赖后台扫描 |
| SUB-PER-02 | 周期刷新 | 退款旧周期明细不影响当前周期已用额度 | `TestRefundSubscriptionPreConsume_SkipsAmountUsedAcrossPeriod` | ✅ 通过 | 明细含 `period_start/period_end` |
| SUB-LIM-01 | 额度 | 多订阅按优先级消费 | `TestPreConsume_PriorityOrdering` | ✅ 通过 | `priority desc, end_time asc, id asc` |
| SUB-LIM-02 | 额度 | 禁用 active 订阅被跳过 | `TestPreConsume_DisabledActive_Skipped` | ✅ 通过 | 禁用不参与扣费 |
| SUB-LIM-03 | 额度 | 多订阅连续拆分扣费 | `TestPreConsume_MultipleSubsWithQuota` | ✅ 通过 | 单请求可跨订阅拆分 |
| SUB-LIM-04 | 额度 | 第一订阅余额不足时部分扣费并落到下一订阅 | `TestPreConsume_InsufficientQuotaFallthrough` | ✅ 通过 | 验证部分扣费拆分 |
| SUB-LIM-05 | 额度 | 所有订阅额度不足时报错且不完成扣费 | `TestPreConsume_AllInsufficient` | ✅ 通过 | 不足路径 |
| SUB-LIM-06 | 窗口 | 5h 窗口剩余额度不足时按剩余额度拆分 | `TestGroupRestriction_Case8_5hWindowExhausted_Skips` | ✅ 通过 | 当前规则是部分扣到窗口剩余，再拆分 |
| SUB-LIM-07 | 窗口 | 窗口限制为 0 表示不限 | `TestGroupRestriction_Case12_WindowLimitZero_NoRestriction` | ✅ 通过 | 0 不参与限制 |
| SUB-GRP-01 | 分组限制 | `vip` 命中 A，A 可用时优先 A | `TestGroupRestriction_Case1_BothActive_RequestVip_HitsA` | ✅ 通过 | A、B 都支持 vip 时按优先级 |
| SUB-GRP-02 | 分组限制 | `default` 只命中 A | `TestGroupRestriction_Case5_BothActive_RequestDefault_HitsA` | ✅ 通过 | B 不支持 default |
| SUB-GRP-03 | 分组限制 | `svip` 只命中 B | `TestGroupRestriction_Case6_BothActive_RequestSvip_HitsB` | ✅ 通过 | A 不支持 svip |
| SUB-GRP-04 | 分组限制 | 不存在分组时无订阅可用 | `TestGroupRestriction_Case7_BothActive_RequestNonexistent_Fails` | ✅ 通过 | 全部跳过 |
| SUB-GRP-05 | 分组限制 | 仅 A active 时命中 A | `TestGroupRestriction_Case2_OnlyAActive_RequestVip_HitsA` | ✅ 通过 | 状态过滤 |
| SUB-GRP-06 | 分组限制 | 仅 B active 时命中 B | `TestGroupRestriction_Case3_OnlyBActive_RequestVip_HitsB` | ✅ 通过 | 状态过滤 |
| SUB-GRP-07 | 分组限制 | A、B 都 disabled 时失败 | `TestGroupRestriction_Case4_BothDisabled_RequestVip_Fails` | ✅ 通过 | 无可用订阅 |
| SUB-GRP-08 | 分组限制 | 空 `allowed_groups` 允许所有分组 | `TestGroupRestriction_Case31_EmptyAllowedGroups_AllowsAll` | ✅ 通过 | 空值语义 |
| SUB-GRP-09 | 分组限制 | disabled 优先跳过 | `TestGroupRestriction_Case15_DisabledSkipped` | ✅ 通过 | 和分组限制组合 |
| SUB-GRP-10 | 分组限制 | 用户调整优先级后消费顺序改变 | `TestGroupRestriction_Case32_PriorityChange_AffectsConsumption` | ✅ 通过 | 拖拽排序持久化 |
| SUB-IDM-01 | 幂等 | 同一 `request_id` 重复预扣只扣一次 | `TestPreConsume_Idempotent` | ✅ 通过 | 串行幂等 |
| SUB-IDM-02 | 幂等/并发 | 同一 `request_id` 并发预扣全部成功且只扣一次 | `TestPreConsume_Concurrent_SameRequestIdIdempotent` | ✅ 通过 | 本轮修复 MySQL 并发唯一键冲突后的重试 |
| SUB-CON-01 | 并发 | 多请求并发激活只激活一次且不超扣 | `TestPreConsume_Concurrent_ActivatesOnceAndConsumesCorrectly` | ✅ 通过 | MySQL `FOR UPDATE` 验证 |
| SUB-CON-02 | 并发 | 并发场景仍按高优先级订阅扣费 | `TestPreConsume_Concurrent_PriorityRespected` | ✅ 通过 | MySQL `FOR UPDATE` 验证 |
| SUB-CON-03 | 锁语义 | GORM v1 `query_option` 不生效，v2 `clause.Locking` 生成 `FOR UPDATE` | `TestProbe_GormV1QueryOptionIgnored` | ✅ 通过 | 防回退探针 |
| SUB-SPLIT-01 | 拆分明细 | 单次请求跨订阅拆分生成明细 | `TestPreConsume_SplitsAcrossSubscriptionsByPriority` | ✅ 通过 | `SubscriptionPreConsumeDetail` |
| SUB-REF-01 | 退款 | 拆分扣费按明细退款 | `TestRefundSubscriptionPreConsume_RefundsSplitDetails` | ✅ 通过 | 多订阅恢复已用额度 |
| SUB-REF-02 | 退款 | 单订阅预扣退款恢复额度 | `TestRefundSubscriptionPreConsume_RestoresQuota` | ✅ 通过 | 基础退款 |
| SUB-ADJ-01 | 调整 | 正负向调整拆分明细 | `TestAdjustSubscriptionPreConsume_AdjustsSplitDetails` | ✅ 通过 | 差额结算入口依赖 |
| SUB-ADJ-02 | 调整 | 直接调整订阅用量 | `TestPostConsumeUserSubscriptionDelta_AdjustsUsage` | ✅ 通过 | legacy 路径 |
| SUB-ADJ-03 | 调整 | 负向调整最低归零 | `TestPostConsumeUserSubscriptionDelta_ClampsNegativeToZero` | ✅ 通过 | 防负数 |
| SUB-GUP-01 | 分组升级 | 无订阅返回 base level | `TestResolveUserGroup_NoSubscription_ReturnsBaseLevel` | ✅ 通过 | 分组状态机 |
| SUB-GUP-02 | 分组升级 | 单 active 订阅升级分组 | `TestResolveUserGroup_SingleActiveSubscription` | ✅ 通过 | 分组状态机 |
| SUB-GUP-03 | 分组升级 | 多 active 订阅按最新开始时间决定 | `TestResolveUserGroup_MultipleActiveSubscriptions_LatestStartWins` | ✅ 通过 | 分组状态机 |
| SUB-GUP-04 | 分组升级 | active 订阅无升级分组时回 base level | `TestResolveUserGroup_ActiveSubscriptionNoUpgradeGroup` | ✅ 通过 | 分组状态机 |
| SUB-GUP-05 | 分组升级 | disabled 订阅不参与分组解析 | `TestResolveUserGroup_FiltersDisabled` | ✅ 通过 | 禁用过滤 |
| SUB-GUP-06 | 分组回退 | 链式订阅结束回退 base level | `TestScenario_ChainedSubscription_RollbackToBaseLevel` | ✅ 通过 | 场景测试 |
| SUB-GUP-07 | 分组回退 | 管理员手动分组不被订阅覆盖 | `TestScenario_AdminManualGroup_NotOverridden` | ✅ 通过 | 场景测试 |
| SUB-GUP-08 | 分组回退 | 高低等级订阅按最新开始时间决定 | `TestScenario_HighThenLow_LatestStartWins` | ✅ 通过 | 场景测试 |
| SUB-GUP-09 | 分组回退 | 两轮不连续订阅解析正确 | `TestScenario_TwoRoundsDisconnected` | ✅ 通过 | 场景测试 |
| SUB-GUP-10 | 分组回退 | 管理员取消订阅后回退 | `TestScenario_AdminCancelSubscription` | ✅ 通过 | 场景测试 |
| SUB-GUP-11 | 分组回退 | 管理员取消一个订阅后仍保留另一个 active 分组 | `TestScenario_AdminCancelOne_OtherActive` | ✅ 通过 | 场景测试 |
| SUB-API-01 | 用户 API | 用户调整订阅优先级 | `TestUpdateSubscriptionPriority` | ✅ 通过 | Controller |
| SUB-API-02 | 用户 API | 用户启停订阅 | `TestToggleSubscriptionDisabled` | ✅ 通过 | Controller |
| SUB-API-03 | 用户 API | 非本人不能启停订阅 | `TestToggleSubscriptionDisabled_WrongUser` | ✅ 通过 | Controller |
| SUB-API-04 | 用户 API | 查询订阅返回进度 | `TestGetSubscriptionSelf_ReturnsProgress` | ✅ 通过 | Controller |
| SUB-API-05 | 用户 API | 查询订阅包含 pending 可用订阅 | `TestGetSubscriptionSelf_IncludesPendingInUsable` | ✅ 通过 | Controller |
| SUB-API-06 | 用户 API | 更新计费偏好 | `TestUpdateSubscriptionPreference` | ✅ 通过 | Controller |
| SUB-API-07 | 用户 API | 用户取消 pending 订阅 | `TestUserCancelSubscription_PendingActivation` | ✅ 通过 | Controller |
| SUB-API-08 | 用户 API | 空订阅查询 | `TestGetSubscriptionSelf_Empty` | ✅ 通过 | Controller |
| SUB-API-09 | 用户 API | 空优先级列表 | `TestUpdateSubscriptionPriority_EmptyList` | ✅ 通过 | Controller |
| SUB-API-10 | 用户 API | 非法启停 ID | `TestToggleSubscriptionDisabled_InvalidID` | ✅ 通过 | Controller |
| SUB-API-11 | 用户 API | active 订阅可禁用 | `TestToggleSubscriptionDisabled_ActiveCanBeDisabled` | ✅ 通过 | Controller |
| SUB-API-12 | 用户 API | 已取消订阅再次取消 | `TestUserCancelSubscription_AlreadyCancelled` | ✅ 通过 | Controller |
| SUB-ADM-01 | 管理 API | 创建套餐允许 30d 窗口额度不同于总额度 | `TestAdminCreateSubscriptionPlan_AllowsWindowDifferentFromTotal` | ✅ 通过 | 已放开强校验 |
| SUB-ADM-02 | 管理 API | 创建套餐拒绝负数窗口额度 | `TestAdminCreateSubscriptionPlan_RejectsNegativeWindowLimit` | ✅ 通过 | 后端校验 |
| SUB-ADM-03 | 管理 API | 创建套餐拒绝非法时长单位 | `TestAdminCreateSubscriptionPlan_RejectsInvalidDurationUnit` | ✅ 通过 | 后端校验 |
| SUB-ADM-04 | 管理 API | 自定义时长必须大于 0 秒 | `TestAdminCreateSubscriptionPlan_RejectsInvalidCustomDuration` | ✅ 通过 | 后端校验 |
| SUB-BIL-01 | 结算 | 钱包预扣退款 | `TestRefundTaskQuota_Wallet` | ✅ 通过 | Service |
| SUB-BIL-02 | 结算 | 订阅预扣退款 | `TestRefundTaskQuota_Subscription` | ✅ 通过 | Service |
| SUB-BIL-03 | 结算 | 零额度退款跳过 | `TestRefundTaskQuota_ZeroQuota` | ✅ 通过 | Service |
| SUB-BIL-04 | 结算 | 无 token 退款路径 | `TestRefundTaskQuota_NoToken` | ✅ 通过 | Service |
| SUB-BIL-05 | 结算 | 正向差额结算 | `TestRecalculate_PositiveDelta` | ✅ 通过 | Service |
| SUB-BIL-06 | 结算 | 负向差额结算 | `TestRecalculate_NegativeDelta` | ✅ 通过 | Service |
| SUB-BIL-07 | 结算 | 零差额不调整 | `TestRecalculate_ZeroDelta` | ✅ 通过 | Service |
| SUB-BIL-08 | 结算 | 实际额度为 0 的边界 | `TestRecalculate_ActualQuotaZero` | ✅ 通过 | Service |
| SUB-BIL-09 | 结算 | 订阅负向差额结算 | `TestRecalculate_Subscription_NegativeDelta` | ✅ 通过 | Service |
| SUB-BIL-10 | 结算 | CAS 退款成功路径 | `TestCASGuardedRefund_Win` | ✅ 通过 | Service |
| SUB-BIL-11 | 结算 | CAS 退款失败路径 | `TestCASGuardedRefund_Lose` | ✅ 通过 | Service |
| SUB-BIL-12 | 结算 | CAS 结算成功路径 | `TestCASGuardedSettle_Win` | ✅ 通过 | Service |
| SUB-BIL-13 | 结算 | 非终态任务不计费 | `TestNonTerminalUpdate_NoBilling` | ✅ 通过 | Service |
| SUB-BIL-14 | 结算 | 按次计费跳过 adaptor 差额调整 | `TestSettle_PerCallBilling_SkipsAdaptorAdjust` | ✅ 通过 | Service |
| SUB-BIL-15 | 结算 | 按次计费跳过 total tokens 差额调整 | `TestSettle_PerCallBilling_SkipsTotalTokens` | ✅ 通过 | Service |
| SUB-BIL-16 | 结算 | 非按次计费执行 adaptor 差额调整 | `TestSettle_NonPerCall_AdaptorAdjustWorks` | ✅ 通过 | Service |

## 未完成验证项

| Case ID | 模块 | 场景 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| SUB-E2E-01 | 端到端 | Docker 镜像重建并重启后服务健康检查 | ✅ 通过 | `new-api:test` 已重建，容器 `new-api` healthy，`/api/status` 返回 success |
| SUB-E2E-02 | 端到端 | 真实 HTTP 管理端创建套餐、绑定用户订阅、用户查询、更新偏好 | ✅ 通过 | 使用一次性 E2E admin/user access token，验证后已清理测试用户、订阅和套餐 |
| SUB-FE-01 | 前端 | 前端生产构建 | ✅ 通过 | `docker build -t new-api:test .` 中 `bun run build` 通过 |
| SUB-E2E-03 | 前端 | 套餐编辑弹窗保存不同总额度/窗口额度 | ✅ 通过 | Playwright 真实页面点击“新建套餐”，保存 `total_amount != window_limit_30d` 且窗口额度按填写值落库，验证后已清理测试套餐 |
| SUB-DB-01 | 数据库 | PostgreSQL 环境 `model/controller/service` 自动化 | ✅ 通过 | 使用 Docker 网络内 `postgres` 服务顺序执行三包测试。多包不能共用同一测试库并发跑，否则清理表会互相影响 |
| SUB-CTRL-ALL-01 | Controller | `controller` 全包测试 | ✅ 通过 | 已改造旧测试入口，使用 MySQL `TEST_SQL_DSN`，不再打开 SQLite |
| SUB-PAY-01 | 支付 | Stripe/Creem/Waffo 等真实回调完成订阅订单 | ⏳ 未测试 | 当前仅单测订单完成与结算资金源 |
