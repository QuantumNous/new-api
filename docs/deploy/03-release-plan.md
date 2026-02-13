# 上线方案：兑换码支持订阅套餐

## 发布日期

2026-02-13

## 变更概述

兑换码（Redemption）新增订阅套餐类型支持。用户可通过兑换码直接激活订阅套餐，而非仅充值余额。同时优化了兑换成功/失败的提示文案。

## 变更范围

### 后端
- `redemptions` 表新增 `type`、`subscription_plan_id` 两个字段
- `Redeem` 接口返回结构从 `int` 改为 `RedeemResult` 对象
- 新增订阅套餐购买上限的独立错误处理和 i18n 消息
- 创建/编辑兑换码时支持指定类型和关联套餐

### 前端
- 兑换成功弹窗根据类型显示不同文案（余额 vs 订阅套餐）
- 兑换码管理页面支持选择兑换码类型和关联套餐
- 新增 i18n 翻译 key

## 上线步骤

### 第一步：数据备份

```bash
# 停止应用实例，避免数据写入
docker compose stop new-api-1 new-api-2

# 完整数据库备份
docker exec postgres pg_dump -U root new-api > backup_full_$(date +%Y%m%d_%H%M%S).sql

# 或仅备份受影响的表
docker exec postgres pg_dump -U root -t redemptions -t subscription_plans -t user_subscriptions new-api > backup_affected_$(date +%Y%m%d_%H%M%S).sql
```

也可以进入数据库执行 `02-backup.sql` 中的 SQL 备份方式。

### 第二步：DDL 变更

有两种方式：

**方式 A：自动迁移（推荐）**

应用启动时 GORM AutoMigrate 会自动添加新字段，无需手动执行 DDL。直接进入第三步。

**方式 B：手动执行 DDL**

如果需要 DBA 审核，手动执行 `01-ddl-changes.sql` 中的 SQL：

```bash
docker exec -i postgres psql -U root new-api < docs/deploy/01-ddl-changes.sql
```

### 第三步：构建新镜像

```bash
docker compose build --no-cache
```

### 第四步：滚动发布

```bash
# 先更新实例 1
docker compose up -d new-api-1
# 等待健康检查通过
docker compose ps  # 确认 new-api-1 状态为 healthy

# 再更新实例 2
docker compose up -d new-api-2
# 确认 new-api-2 也 healthy
docker compose ps
```

或一次性更新：

```bash
docker compose up -d
```

### 第五步：验证

1. 访问 http://localhost:3001/api/status 确认服务正常
2. 检查数据库字段是否存在：
   ```bash
   docker exec postgres psql -U root new-api -c "\d redemptions"
   ```
   确认 `type` 和 `subscription_plan_id` 字段存在
3. 功能验证：
   - 创建余额类型兑换码 → 兑换 → 弹窗显示"成功兑换额度：$x.xx"
   - 创建订阅套餐类型兑换码 → 兑换 → 弹窗显示"成功激活订阅套餐：xxx"
   - 订阅套餐兑换码达到次数上限 → 提示"已达到该套餐的兑换次数上限"

## 回滚方案

### 应用回滚

```bash
# 使用旧镜像重新部署
git checkout <上一个稳定 commit>
docker compose build --no-cache
docker compose up -d
```

### 数据回滚

新增的两个字段（`type` 默认值 1，`subscription_plan_id` 默认值 0）对旧代码无影响，旧代码不读取这两个字段，因此**通常不需要回滚数据库**。

如确需回滚 DDL：

```sql
ALTER TABLE redemptions DROP COLUMN IF EXISTS type;
ALTER TABLE redemptions DROP COLUMN IF EXISTS subscription_plan_id;
```

如需从备份恢复数据，参考 `02-backup.sql` 中的恢复 SQL。

## 影响评估

| 项目 | 说明 |
|------|------|
| 停机时间 | 滚动发布，无停机 |
| 数据兼容性 | 新字段有默认值，向后兼容 |
| API 兼容性 | `/api/user/topup` 返回结构从 `int` 变为对象，前端需同步更新 |
| 回滚风险 | 低，新字段不影响旧逻辑 |
