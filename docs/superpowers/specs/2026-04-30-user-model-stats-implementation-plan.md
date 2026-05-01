# 用户-模型统计功能实施方案（补齐与收敛）

## 1. 目标

将用户-模型统计能力收敛为可稳定上线版本，覆盖：

- 用户视角、模型视角、用户模型消耗统计
- 筛选、分页、导出联动

## 2. 功能范围

## 2.1 后端接口

- `GET /api/data/by-user` — 用户视角汇总
- `GET /api/data/by-model` — 模型视角汇总
- `GET /api/data/by-detail` — 用户模型消耗明细
- `GET /api/data/export?view_type=by_user|by_model|by_detail`

统一参数：

- `start_timestamp`、`end_timestamp`
- `username`（逗号分隔）
- `model_name`（逗号分隔）
- `page`、`page_size`

## 2.2 前端页面

- Tab1 用户视角：用户、请求次数、总Token、额度消耗
- Tab2 模型视角：模型、请求次数、额度消耗
- Tab3 用户模型消耗：用户、模型、请求次数、额度消耗

三个视角均为表格列表 + 分页。

公共筛选：时间范围、用户名、模型名、查询与导出。

## 3. 数据与展示规范

### 3.1 用户视角（by_user）

| 字段 | 说明 |
|---|---|
| username | 用户名 |
| count | 请求次数 |
| token_used | 总 Token 数 |
| quota | 额度消耗 |

按用户汇总（GROUP BY username），按额度降序。

### 3.2 模型视角（by_model）

| 字段 | 说明 |
|---|---|
| model_name | 模型名 |
| count | 请求次数 |
| quota | 额度消耗 |

按模型汇总（GROUP BY model_name），按额度降序。

### 3.3 用户模型消耗（by_detail）

| 字段 | 说明 |
|---|---|
| username | 用户名 |
| model_name | 模型名 |
| count | 请求次数 |
| quota | 额度消耗 |

按用户+模型汇总（GROUP BY username, model_name），按额度降序。

## 4. 性能与兼容

- 时间跨度限制：最大 1 年
- 列表 page_size 上限：100
- SQL 仅使用 GORM 聚合与 group（保证多数据库兼容）

## 5. 导出策略

`view_type` 与当前 Tab 对齐：

- 用户视角 -> `by_user`
- 模型视角 -> `by_model`
- 用户模型消耗 -> `by_detail`

导出字段顺序与页面表格一致，分批读取全量数据写入 CSV。

## 6. 验收标准

- 三个 Tab 均可按筛选条件返回正确数据
- 导出内容与当前视角一致
- 大页数/空数据/非法时间参数有明确返回

## 7. 测试清单

- 后端：
  - 参数边界（空、非法时间、超上限）
  - 聚合正确性（用户汇总、模型汇总、用户模型明细）
  - 导出三视角一致性
- 前端：
  - Tab 切换与筛选联动
  - 分页联动

## 8. 风险与回滚

- 风险：明细查询在大数据量场景响应慢
- 缓解：分页、必要时加缓存
- 回滚：三个接口独立，可单独降级
