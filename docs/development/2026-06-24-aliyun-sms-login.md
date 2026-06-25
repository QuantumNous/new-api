# 阿里云短信登录接入说明

## 背景

本次新增手机号短信验证码登录能力，短信服务使用阿里云短信平台。功能默认关闭，管理员需要先配置阿里云短信参数，再开启短信登录。

实现目标：

- 支持中国大陆手机号短信验证码登录。
- 手机号不存在时，允许在全站注册开启的前提下自动创建用户。
- 已存在用户通过手机号登录后继续复用原有登录会话、2FA、用户状态校验和默认令牌创建逻辑。
- 对普通用户隐藏阿里云上游错误细节，避免泄露短信模板、签名、AccessKey 等内部信息。

## 配置项

新增系统选项：

- `SmsLoginEnabled`：是否启用短信验证码登录。
- `AliyunSmsAccessKeyId`：阿里云 AccessKey ID。
- `AliyunSmsAccessKeySecret`：阿里云 AccessKey Secret。
- `AliyunSmsSignName`：已审核通过的短信签名。
- `AliyunSmsTemplateCode`：已审核通过的短信模板 Code。
- `AliyunSmsEndpoint`：阿里云短信 Endpoint，默认 `dysmsapi.aliyuncs.com`。

管理后台会隐藏 `AliyunSmsAccessKeyId` 和 `AliyunSmsAccessKeySecret`。启用 `SmsLoginEnabled` 前，后端会校验 AccessKey、签名和模板 Code 是否已配置。

当前阿里云 SDK 使用 V2 OpenAPI client，发送短信时只配置 Endpoint，不需要额外配置 `RegionId`。

## 阿里云模板要求

短信模板参数固定发送为：

```json
{"code":"123456"}
```

因此阿里云短信模板变量必须包含 `code`，并且变量规则需要允许 6 位数字验证码。

验证码生成逻辑：

- 6 位数字。
- 使用 `crypto/rand` 生成。
- 登录成功消费后立即删除，不能重复使用。
- 有效期沿用现有验证码有效期配置。

## 接口

新增接口：

- `POST /api/sms/verification`
  - 请求体：`{"phone":"13812345678"}`
  - 用于发送短信验证码。
  - 经过 `CriticalRateLimit` 和 `TurnstileCheck`。

- `POST /api/user/phone/login`
  - 请求体：`{"phone":"13812345678","code":"123456"}`
  - 用于手机号短信验证码登录。
  - 经过 `CriticalRateLimit` 和 `TurnstileCheck`。

手机号会统一规范化为 `+86` 格式保存，例如 `13812345678` 保存为 `+8613812345678`。发送给阿里云时会去掉 `+86`。

## 数据库

`users` 表新增字段：

- `phone`
  - 类型：`varchar(32)`
  - 可空
  - 唯一索引：`idx_users_phone_unique`

设计原因：

- 老用户没有手机号，应保持 `NULL`，这样唯一索引允许多个老用户并存。
- 不能用空字符串表示未绑定手机号，否则唯一索引下多个空字符串会冲突。
- 手机号一旦存在，应保证全局唯一，避免同一个手机号登录到不同账户。

如果是全新数据库或功能未上线，GORM `AutoMigrate` 会自动创建字段和唯一索引，不需要单独迁移脚本。

如果本地或测试库之前运行过早期版本，可能已经留下普通索引 `idx_users_phone`。这种情况下可以补唯一索引：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON public.users USING btree (phone);
```

补索引前建议检查数据：

```sql
SELECT COUNT(*) AS total_users,
       COUNT(phone) AS non_null_phone,
       COUNT(*) FILTER (WHERE phone = '') AS blank_phone
FROM users;

SELECT phone, COUNT(*) AS count
FROM users
WHERE phone IS NOT NULL AND phone <> ''
GROUP BY phone
HAVING COUNT(*) > 1;
```

生产环境如果已经有历史 `phone = ''` 或重复手机号，必须先清理数据，再创建唯一索引。

## 安全处理

已覆盖的安全边界：

- 短信登录总开关默认关闭。
- 发码接口和登录接口都走 `CriticalRateLimit`。
- Turnstile 开启时，两个接口都必须通过校验。
- 单手机号发码限制：
  - 60 秒冷却。
  - 24 小时最多 10 次。
- 验证码只接受 6 位数字。
- 验证码登录成功后原子删除，防止重复使用。
- 已禁用用户不能通过短信登录。
- 已启用 2FA 的用户仍然需要完成 2FA。
- 阿里云发送失败时，前端只看到通用失败文案。
- 后端日志中手机号会打码，上游错误会走敏感信息脱敏。
- 注册关闭时，不会给不存在的手机号真实发送短信。
- 禁用用户手机号请求发码时，也不会真实发送短信。
- 上述两种“不发码”场景仍返回成功响应，避免手机号枚举。

## 自动注册逻辑

短信登录时如果手机号不存在：

- `RegisterEnabled = false`：拒绝登录，不创建用户。
- `RegisterEnabled = true`：自动创建普通用户。

自动创建用户时：

- 走 `model.User.Insert`，复用普通注册的新用户额度、AffCode、默认设置和默认侧边栏初始化。
- 用户名格式为 `u` + 手机号后四位 + 随机字符串。
- 如果系统启用了默认令牌创建，会为新用户创建默认令牌。

短信登录不依赖 `PasswordRegisterEnabled`。这与 OAuth 注册类似：只受全站 `RegisterEnabled` 控制。

## 兼容性影响

对已有功能的影响：

- 密码登录仍走原有 `Login` 和 `setupLogin`。
- OAuth、Passkey、2FA 登录链路未改变。
- 用户禁用状态仍在登录后统一校验。
- 用户管理编辑接口没有把 `phone` 纳入可编辑字段，因此旧前端或管理员编辑用户时不会误清空手机号。
- 用户缓存新增 `phone` 字段，但旧消费者可以忽略该字段。
- 用户搜索增加手机号匹配，不影响原有用户名、邮箱、展示名和 ID 搜索。

需要注意：

- `phone` 字段新增后，所有数据库都需要支持 nullable unique index。SQLite、MySQL、PostgreSQL 均支持多条 `NULL` 与唯一索引共存。
- 如果历史库里已经有非空重复手机号，唯一索引创建会失败。

## 多副本部署注意事项

当前验证码存储和手机号级发码限制都在进程内存中。

单容器或单副本部署没有问题；多副本部署时会有两个限制：

- A 节点发送验证码，B 节点处理登录时，B 节点可能找不到验证码。
- 多个副本会分别计算手机号发码次数，成本限制会被分摊。

如果要多副本上线，建议后续把以下状态迁移到 Redis：

- 短信验证码。
- 单手机号冷却时间。
- 单手机号每日发送次数。

## 已验证内容

后端验证：

```bash
go test ./common ./model ./service ./controller ./router -run "TestGenerateNumericVerificationCode|TestNormalizeMainlandPhone|TestMaskMainlandPhone|TestVerifyAndDeleteCodeWithKeyConsumesCodeOnce|TestUserPhoneUniqueIndex|TestShouldSendSmsVerificationHonorsRegistrationAndStatus|^$"
git diff --check
```

覆盖内容：

- 手机号规范化。
- 6 位数字验证码生成。
- 手机号脱敏。
- 验证码一次性消费。
- `phone` 唯一索引允许多条 `NULL`。
- `phone` 唯一索引拒绝重复手机号。
- 注册关闭、禁用用户、启用用户三种发码判断。

前端验证：

- default/classic 改动文件已做 TSX/JSX 语法解析。
- i18n JSON 文件已做 JSON 解析。

当前本地 default 前端完整 `typecheck` 会因为本地依赖环境缺少一批 `@types/d3*` 等类型包失败，该失败与短信登录改动无关。
