# Passkey 多域名

管理员可在 Passkey 设置中配置一个主 RP ID、多个兼容 RP ID 和允许的 Origin；用户可在任一授权域名注册或登录。

- `passkey.rp_id`：主 RP ID。
- `passkey.legacy_rp_ids`：兼容 RP ID，每行一个。
- `passkey.origins`：允许的 Origin，每行一个。
- 域名设置必须通过 `PUT /api/option/passkey/domains` 保存；删除仍被凭证使用的域名返回 409，确认后携带响应中的 `confirmation` 重试。
- 凭证新增可空 `rp_id` 列；旧凭证首次成功认证后绑定当前 RP ID。
- begin 阶段选择的 RP ID 保存在服务端 session，finish 忽略客户端再次提交的 RP ID。
- 未配置多域名时保留原有单域名推导和 Origin 行为。
