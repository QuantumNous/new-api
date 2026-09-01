# 野菜API 桌面端接口 v2

v2 为官方桌面助手补齐网页登录授权和桌面会话，同时复用 NewAPI 已有的账户、用量、模型、价格、密钥与充值接口。v1 的闭合契约保持不变。

## 接入原则

- 桌面端不接收网站密码，也不复制浏览器 Cookie。
- 用户在网站登录后，核对短验证码并明确同意或拒绝。
- 待确认请求只在 Redis 保留 5 分钟；Redis 未启用时，启动握手会明确标记设备授权不可用。
- 授权成功后复用已有 `user_sessions` 会话表。没有新增业务表，也不需要数据库迁移。
- 服务端根据现有会话的 `login_method` 识别桌面会话；桌面访问令牌只允许调用本文列出的账户、用量、模型、价格、工具密钥与桌面退出接口，其他控制台接口统一返回 `AUTH_DESKTOP_SCOPE_DENIED`。
- 桌面端获得的访问令牌和刷新令牌只应保存到系统安全存储（macOS Keychain 或 Windows Credential Manager），不得写入日志、普通配置文件或崩溃报告。

## 1. 启动握手

- 方法：`GET`
- 路径：`/api/desktop/v2/bootstrap`
- 鉴权：不需要
- Schema：[`contracts/desktop-integration.v2.schema.json`](contracts/desktop-integration.v2.schema.json)

响应会公布服务端能力、客户端最低版本、固定官网价格换算汇率 `6.75`，以及后续接口路径。`device_authorization_available` 由 Redis 可用性决定；其余数据能力复用现有接口。

桌面端必须使用响应中的路径和钱包地址，不应在安装包里散落硬编码地址。

## 2. 网页授权登录

### 发起授权

- 方法：`POST`
- 路径：`/api/desktop/v2/device-authorizations`
- 鉴权：不需要
- 请求体：`{"client_name":"野菜API Desktop"}`

成功后返回：

```json
{
  "success": true,
  "data": {
    "device_code": "仅供桌面端轮询的高熵密文",
    "user_code": "ABCD-2345",
    "verification_uri": "https://yeschoy.com/desktop-authorize",
    "verification_uri_complete": "https://yeschoy.com/desktop-authorize?user_code=ABCD-2345",
    "expires_in": 300,
    "interval": 5
  }
}
```

桌面端打开 `verification_uri_complete`，同时在自己的界面显示 `user_code` 供用户核对。`device_code` 不得出现在可见界面或日志中。

### 网站确认

- 页面：`/desktop-authorize?user_code=ABCD-2345`
- 接口：`POST /api/desktop/v2/device-authorizations/decision`
- 鉴权：必须为正常网页登录会话；个人访问令牌不能确认授权
- 请求体：`{"user_code":"ABCD-2345","decision":"approve"}` 或 `deny`

相同决定可以安全重试；决定冲突返回 `decision_conflict`。网页只显示固定的官方桌面端身份和短验证码，不信任桌面端提交的名称作为授权依据。

### 兑换桌面会话

- 方法：`POST`
- 路径：`/api/desktop/v2/device-authorizations/token`
- 请求体：`{"device_code":"..."}`

桌面端应按 `interval` 轮询。可能收到：

- `authorization_pending`：用户尚未决定，按 `retry_after` 继续等待。
- `slow_down`：轮询过快，按新的 `retry_after` 延长间隔。
- `access_denied`：用户拒绝。
- `expired_token`：5 分钟已过，重新发起。
- `already_used`：此授权已经兑换，不能再次兑换。

成功响应：

```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "token_type": "Bearer",
    "access_expires_at": 1780000000,
    "refresh_token": "...",
    "refresh_expires_at": 1782000000,
    "session_id": "..."
  }
}
```

## 3. 会话续期与退出

### 续期

- 方法：`POST`
- 路径：`/api/desktop/v2/sessions/refresh`
- 请求体：`{"refresh_token":"...","session_id":"..."}`

每次成功都会轮换刷新令牌。客户端必须先安全写入新令牌，再丢弃旧令牌。
此接口只接受 `desktop_device` 会话的刷新令牌；浏览器会话的刷新令牌不会被轮换或消耗。

### 退出当前桌面会话

- 方法：`DELETE`
- 路径：`/api/desktop/v2/sessions/current`
- 鉴权：`Authorization: Bearer <access_token>`

退出会立即把当前 `user_sessions` 记录标记为撤销。它不影响用户在浏览器或其他电脑上的会话。

## 4. 复用的现有接口

桌面端登录后使用 Bearer 访问：

| 能力 | 路径 | 说明 |
| --- | --- | --- |
| 账户与余额 | `/api/user/self` | 账户资料、当前余额等现有字段 |
| 用量汇总 | `/api/log/self/stat` | 指定时间范围的汇总 |
| 用量明细 | `/api/log/self` | 分页账单与模型调用记录 |
| 可用模型 | `/api/user/models` | 当前用户实际可用的模型 ID |
| 模型价格 | `/api/pricing` | NewAPI 当前持续维护的实际价格 |
| 工具密钥 | `/api/token/` | 为 Claude、Codex、Pi、DSH 等工具创建和管理独立密钥 |
| 充值 | 启动握手中的 `wallet_url` | 在系统浏览器打开网站充值页 |

价格对比必须使用同一批实际用量：以用量记录中的模型、输入/输出 token、缓存和倍率计算野菜API实际费用，再以相同用量乘对应官网单价并按固定汇率 `6.75` 换算。不得拿不同时间段或不同模型估算“节省金额”。

## 5. 部署检查清单

本次代码不修改部署环境。技术人员上线时只需确认：

1. `ServerAddress` 为公开站点 `https://yeschoy.com`，用于生成授权页和充值页地址。
2. Redis 已启用且可写；否则账户、用量等接口仍可用，但桌面网页登录会被关闭。
3. 反向代理允许 `/api/desktop/v2/*` 和 `/desktop-authorize`，并保留 HTTPS。
4. 发布包含更新后的前端静态资源。
5. 先在测试账号完成“同意、拒绝、过期、重复兑换、刷新、退出”全流程，再开放最低版本为 `0.2.0` 的桌面客户端。

不需要新增表、不需要执行迁移，也不需要修改现有价格数据。
