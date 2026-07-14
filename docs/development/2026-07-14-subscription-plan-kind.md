# 订阅套餐 `plan_kind` 标记

## 背景

桌面客户端（z-up-ai-client）此前通过本地配置的 `validSubscriptionPlanIds` / `boosterPlanIds` 区分主套餐与加量包，环境切换与生产发布都很脆弱。

现改为在 new-api 套餐实体上打类型标记，由平台配置、API 透出。

## 字段

`subscription_plans.plan_kind`（`varchar(16)`，默认 `base`）

| 值 | 含义 |
|----|------|
| `base` | 主订阅套餐（默认；兼容历史空值） |
| `booster` | 加量包 |
| `hidden` | 后台可用（绑定/编辑），**用户公开列表不返回** |

## API

- `GET /api/subscription/plans`：仅返回 `enabled=true` 且 `plan_kind != hidden` 的套餐；响应中 `plan.plan_kind` 会规范化（空 → `base`）。
- `GET /api/subscription/admin/plans`：返回全部套餐（含 hidden），并规范化 `plan_kind`。
- 创建：未传 `plan_kind` 时默认 `base`；非法值拒绝。
- 更新：未传 / 空字符串时**不覆盖**已有 `plan_kind`（兼容尚未支持该字段的 default 管理端）；显式传入合法值时更新。

## 前端范围

- **已改**：`web/classic` 订阅套餐管理（列表「类型」列 + 编辑表单「套餐类型」）。
- **未改（有意）**：`web/default` 管理端 UI 暂不增加该表单项。通过「更新时空值不覆盖」保证 default 编辑其它字段不会把 `plan_kind` 重置成 base。
- 用户侧充值页列表行为：hidden 套餐已在公开 API 过滤，无需前端再过滤。

## 客户端后续

z-up-ai-client 可改为读取 `plan.plan_kind` 分类，逐步废弃本地 plan id 白名单。

## 主套餐互斥

当前**不做**服务端 base 互斥：若用户连续支付多笔 base，可出现多个生效 base 共存。
（并发待支付单、后付冲突折算钱包等复杂处理暂不实现。）

客户端若需要「只能买一个主套餐」的体验，可自行用 UI 限制；平台侧仅提供 `plan_kind` 标记。

## 迁移

- MySQL / PostgreSQL：GORM `AutoMigrate(&SubscriptionPlan{})` 增列。
- SQLite：`ensureSubscriptionPlanTableSQLite` 的建表 DDL 与 `ADD COLUMN` 列表均包含 `plan_kind`。
