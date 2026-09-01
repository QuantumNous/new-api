# 野菜API 桌面端接口 v1

本次只提供一个匿名、只读的启动握手接口，用于让桌面客户端确认“服务端认识这份契约”。它不是登录接口，也不会让客户端获得账户、余额、用量、模型价格或工具密钥能力。

## 启动握手

- 方法：`GET`
- 路径：`/api/desktop/v1/bootstrap`
- 鉴权：不需要
- 请求体：无
- 数据库：不读取、不写入

成功响应固定为：

```json
{
  "success": true,
  "data": {
    "schema_version": 1,
    "service": "yeschoy-desktop",
    "contract_id": "desktop-bootstrap-v1",
    "minimum_client_version": "0.1.0",
    "capabilities": {
      "device_authorization": false,
      "account_read": false,
      "usage_read": false,
      "models_read": false,
      "pricing_read": false,
      "tool_keys_manage": false
    }
  }
}
```

`capabilities` 全部为 `false` 是当前版本的正常状态，不是异常或降级。客户端只可据此确认响应格式兼容，不得创建登录态、显示虚构账户数据，或启用任何需要后端支持的操作。

## 闭合契约

v1 是闭合响应：不得私自增加、删除或改名字段，也不得将任何能力改成 `true`。需要扩展时，应先新增受版本控制的契约和验收夹具，再分别修改服务端与客户端。

- Schema：[`contracts/desktop-bootstrap.v1.schema.json`](contracts/desktop-bootstrap.v1.schema.json)
- 可识别夹具：[`contracts/fixtures/desktop-bootstrap/recognized.json`](contracts/fixtures/desktop-bootstrap/recognized.json)
- 不兼容版本夹具：[`contracts/fixtures/desktop-bootstrap/incompatible.json`](contracts/fixtures/desktop-bootstrap/incompatible.json)

## 本次明确不包含

- 设备授权、账户登录与会话
- 余额、用量、模型目录和价格投影
- 工具密钥管理或配置写入
- 支付、数据库、迁移和部署改动

这些能力必须在独立的接口计划、数据边界和测试通过后，才能逐项开放。
