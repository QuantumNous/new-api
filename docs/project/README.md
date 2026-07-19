# 项目功能与设计文档

本目录记录当前代码中已经实现的主要功能、关键链路和设计约束，供开发者与维护者在定位代码、评估改动影响和扩展功能时使用。

## 阅读顺序

| 文档 | 类型 | 用途 |
| --- | --- | --- |
| [features.md](features.md) | 参考 | 按业务领域查找功能、入口和主要实现目录 |
| [architecture.md](architecture.md) | 解释 | 理解进程结构、启动流程、分层、存储与后台任务 |
| [relay-pipeline.md](relay-pipeline.md) | 解释 | 理解一次模型请求从鉴权到结算的完整链路 |
| [billing-and-data.md](billing-and-data.md) | 解释 | 理解核心数据、钱包/订阅资金来源和计费生命周期 |
| [frontend-design.md](frontend-design.md) | 解释 | 理解默认前端的路由、功能模块、状态与权限设计 |
| [development-guide.md](development-guide.md) | 操作指南 | 新增或修改功能时确定改动位置与最小验证范围 |

新接手项目时，先读 `features.md` 和 `architecture.md`。修改转发、渠道或计费逻辑时，再读对应的专项文档。

## 文档边界

本目录不重复以下已有资料：

- HTTP 接口字段和响应结构：以 [管理 API OpenAPI](../openapi/api.json) 与 [Relay OpenAPI](../openapi/relay.json) 为准。
- 动态计费表达式语法和内部规则：以 [Billing Expression System](../../pkg/billingexpr/expr.md) 为准。
- 具体部署步骤：以根目录 README 和 [安装文档](../installation/) 为准。
- 单个渠道的供应商参数：以 `relay/channel/<provider>/`、`constant/channel.go` 和渠道设置界面为准。

代码、测试和迁移是可执行事实；本目录解释它们如何组成系统。发现文档与实现不一致时，应在同一改动中修正文档。

## 功能变更时如何使用

1. 在 `features.md` 找到业务领域及主要入口。
2. 阅读对应设计文档，确认跨层影响和必须保持的约束。
3. 修改代码并完成针对性验证。
4. 当用户可见行为、数据含义、核心链路或扩展方式变化时，同步更新本目录。

仅重命名局部变量、格式化代码或不改变行为的内部整理，不需要更新功能文档。
