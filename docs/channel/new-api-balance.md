# New API 上游余额查询

该功能只为 `New API` 渠道（类型 `60`）补充余额查询，不改变其他渠道的查询逻辑，也不新增公共 API。

平台使用渠道中配置的 Bearer Token 请求上游：

- `GET {base_url}/api/usage/token/`：读取 Token 剩余额度与无限额度状态。
- `GET {base_url}/api/status`：读取额度单位和换算设置；不可用时按原始 `credits` 展示。

管理员仍通过现有接口刷新：

```http
GET /api/channel/update_balance/{channel_id}
```

结果保存在渠道的 `balance_info` 中，支持金额、`credits`、`tokens` 和无限额度。只有 USD 金额会同步到原有的 `channel.balance` 字段。与现有余额查询一致，多密钥渠道暂不支持。
