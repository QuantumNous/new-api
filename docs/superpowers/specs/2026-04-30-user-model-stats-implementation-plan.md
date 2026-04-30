# 用户-模型统计功能实施方案（补齐与收敛）

## 1. 目标

将用户-模型统计能力收敛为可稳定上线版本，覆盖：

- 用户视角、模型视角、交叉矩阵
- 筛选、分页、导出联动
- 可观测与可维护

## 2. 当前状态

已具备：

- 基础接口：`/api/data/by-user`、`/api/data/by-model`、`/api/data/export`
- 矩阵能力基础：模型层已有矩阵聚合实现
- 前端三 Tab 页面已接入基础交互

待收敛项：

- 矩阵指标切换（count/token）与展示一致性
- 导出视图与页面视图的严格对齐
- 大数据量分页与性能保护验证

## 3. 功能范围

## 3.1 后端接口

- `GET /api/data/by-user`
- `GET /api/data/by-model`
- `GET /api/data/matrix`
- `GET /api/data/export?view_type=by_user|by_model|matrix`

统一参数：

- `start_timestamp`、`end_timestamp`
- `username`（逗号分隔）
- `model_name`（逗号分隔）

矩阵额外参数：

- `user_page`、`model_page`、`page_size`

## 3.2 前端页面

- Tab1 用户视角
- Tab2 模型视角
- Tab3 交叉矩阵（支持行列透视）

公共筛选：

- 时间范围
- 用户名列表
- 模型名列表
- 查询与导出

## 4. 数据与展示规范

## 4.1 指标

统一字段：

- `count`
- `token_used`
- `quota`

矩阵单元格：

- 主值支持切换：`count` / `token_used`
- Tooltip 固定展示完整三指标

## 4.2 透视规则

- `user_as_row`：行=用户，列=模型
- `model_as_row`：行=模型，列=用户

## 4.3 TopN 与 Others

- 默认 TopN 截断（受 page_size 控制）
- 非 TopN 合并到 `others`
- 用户显式筛选时不做 TopN 合并

## 5. 性能与兼容

- 时间跨度限制：最大 1 年
- 矩阵 page_size 上限：50
- 列表 page_size 上限：100
- SQL 仅使用 GORM 聚合与 group（保证多数据库兼容）

## 6. 导出策略

`view_type` 与当前 Tab 对齐：

- 用户视角 -> `by_user`
- 模型视角 -> `by_model`
- 矩阵 -> `matrix`

导出字段顺序固定，保证下游数据处理稳定。

## 7. 验收标准

- 三个 Tab 均可按筛选条件返回正确数据
- 矩阵透视切换后数据不丢失、不串位
- 导出内容与当前视角一致
- 大页数/空数据/非法时间参数有明确返回

## 8. 测试清单

- 后端：
  - 参数边界（空、非法时间、超上限）
  - 聚合正确性（用户、模型、矩阵）
  - 导出三视角一致性
- 前端：
  - Tab 切换与筛选联动
  - 分页联动
  - 矩阵透视与 Tooltip

## 9. 风险与回滚

- 风险：矩阵查询在大数据量场景响应慢
- 缓解：默认 TopN、分页、必要时加缓存
- 回滚：保留 `/by-user` `/by-model` 主链路，矩阵可独立降级隐藏

## 10. 实施顺序

1. 收敛后端矩阵/导出参数语义
2. 补齐前端矩阵指标切换与一致性
3. 完成接口与页面联调
4. 完成测试并发布
