# 英文环境下仍会出现中文的清单

## 最新状态

以下“最新状态”基于最近一轮修复后的重新扫描结果，并且已经按你的要求收窄到：

1. 只看普通用户会接触到的页面和接口。
2. 不再把管理后台的设置页、渠道页、模型页算进优先处理范围。

当前用户侧结论：

1. 前端仍有一批硬编码中文。
2. 前端 `t('中文 key')` 但 `en.json` 缺失的 key 已下降到 `6` 个。
3. 后端用户侧接口仍有不少直接返回中文的错误/消息。

本轮最值得关注的是：

1. 登录/注册入口仍有少量硬编码中文。
2. Topup/支付链路仍有不少中文状态和错误。
3. Passkey / 2FA / 签到 / 兑换码相关接口仍会把中文返回给前端。

## 用户侧剩余问题概览

### 1. 前端英文资源缺失：6 个

这些地方代码已经使用了 `t()`，但英文资源里仍没有对应项，所以英文环境会直接回退成中文：

1. `web/src/components/common/DocumentRenderer/index.jsx:155`
   - `管理员未设置`
2. `web/src/components/common/DocumentRenderer/index.jsx:185`
   - `访问`
3. `web/src/components/common/DocumentRenderer/index.jsx:188`
   - `访问`
4. `web/src/components/common/ui/ChannelKeyDisplay.jsx:139`
   - `共 {{count}} 个密钥`
5. `web/src/components/topup/index.jsx:212`
   - `管理员未开启 Waffo 充值！`
6. `web/src/hooks/redemptions/useRedemptionsData.jsx:265`
   - `已删除 {{count}} 条失效兑换码`

### 2. 前端仍存在的用户侧硬编码中文

以下中文没有经过 i18n，因此英文环境下会直接显示中文。

#### 2.1 登录 / 注册

1. `web/src/components/auth/LoginForm.jsx:74-76`
   - `使用 GitHub 继续`
   - `正在跳转 GitHub...`
   - `请求超时，请刷新页面后重新发起 GitHub 登录`
2. `web/src/components/auth/RegisterForm.jsx:72-74`
   - 同上三项。

#### 2.2 Topup / 支付

1. `web/src/components/topup/RechargeCard.jsx:560`
   - `管理员未开启在线充值功能，请联系管理员开启或使用兑换码充值。`
2. `web/src/components/topup/modals/TopupHistoryModal.jsx:45-48`
   - `成功`
   - `待支付`
   - `失败`
   - `已过期`
3. `web/src/components/topup/modals/TopupHistoryModal.jsx:56-57`
   - `支付宝`
   - `微信`

#### 2.3 Token / Redemption / Common 组件

1. `web/src/components/common/ui/ChannelKeyDisplay.jsx:237`
   - `检测到多个密钥，您可以单独复制每个密钥，或点击复制全部获取完整内容。`
2. `web/src/components/common/ui/ChannelKeyDisplay.jsx:269`
   - `请妥善保管密钥信息，不要泄露给他人。如有安全疑虑，请及时更换密钥。`
3. `web/src/hooks/chat/useTokenKeys.js:33`
   - `当前没有可用的启用令牌，请确认是否有令牌处于启用状态！`

#### 2.4 个人中心安全设置

1. `web/src/components/settings/personal/cards/AccountManagement.jsx:708`
   - `解绑后将无法使用 Passkey 登录，确定要继续吗？`
2. `web/src/components/settings/personal/components/TwoFASetting.jsx:400`
   - `两步验证（2FA）为您的账户提供额外的安全保护...`
3. `web/src/components/settings/personal/components/TwoFASetting.jsx:498`
   - `使用认证器应用（如 Google Authenticator、Microsoft Authenticator）扫描下方二维码：`
4. `web/src/components/settings/personal/components/TwoFASetting.jsx:570`
   - `警告：禁用两步验证将永久删除您的验证设置和所有备用码，此操作不可撤销！`
5. `web/src/components/settings/personal/components/TwoFASetting.jsx:631`
   - `我已了解禁用两步验证将永久删除所有相关设置和备用码，此操作不可撤销`
6. `web/src/components/settings/personal/components/TwoFASetting.jsx:666`
   - `重新生成备用码将使现有的备用码失效，请确保您已保存了当前的备用码。`

#### 2.5 个人中心通知与语言偏好

1. `web/src/components/settings/personal/cards/PreferencesSettings.jsx:174`
   - `提示：语言偏好会同步到您登录的所有设备，并影响API返回的错误消息语言。`
2. `web/src/components/settings/personal/cards/NotificationSettings.jsx`
   - `457`
   - `484`
   - `500`
   - `518`
   - `541`
   - `554`
   - `600`
   - `660`
   - `685`
   - `727`
   - `771`
   - `795`
   - 这一组都是用户个人通知设置中的说明文字，英文环境下仍会显示中文。

说明：

1. `PreferencesSettings` 中语言名称 `简体中文` / `繁體中文` / `日本語` 不一定算问题，因为语言列表通常允许展示母语名。
2. 如果你的目标是“英文界面所有可见文本都英文”，那这些语言名也应继续处理。

### 3. 后端用户侧接口仍直接返回中文

这部分会导致前端页面本身已经英文，但一旦接口报错，toast / modal / 表单提示仍出现中文。

#### 3.1 签到

1. `controller/checkin.go:19`
2. `controller/checkin.go:50`
3. `model/checkin.go:58`

典型文案：

1. `签到功能未启用`

#### 3.2 2FA

1. `middleware/secure_verification.go:28`
   - `未登录`
2. `controller/twofa.go`
   - `142`
   - `209`
   - `317`
   - `403`
   - `431`
   - 典型文案：`参数错误`、`用户不存在`
3. `model/twofa.go:80`
   - `用户不存在`

#### 3.3 Passkey

1. `controller/passkey.go`
   - `25`
   - `85`
   - `140`
   - `161`
   - `207`
   - `242`
   - `297`
   - `303`
   - `369`
   - `423`
   - `492`
2. `service/passkey/session.go`
   - `12`
   - `47`
3. `service/passkey/service.go`
   - `29`
   - `93`
   - `107`
   - `122`
   - `137`
   - `141`
4. `model/passkey.go`
   - `20`
   - `183`
   - `189`
   - `193`

典型文案：

1. `管理员未启用 Passkey 登录`
2. `Passkey 注册成功`
3. `Passkey 已解绑`
4. `Passkey 登录状态异常`
5. `Passkey 会话不存在或已过期`

其中有些是成功消息，也会直接显示给用户。

#### 3.4 充值 / 订阅支付

1. `controller/topup.go`
2. `controller/topup_stripe.go`
3. `controller/topup_creem.go`
4. `controller/topup_waffo.go`
5. `controller/topup_waffo_pancake.go`
6. `controller/subscription_payment_epay.go`
7. `controller/subscription_payment_stripe.go`
8. `controller/subscription_payment_creem.go`
9. `model/subscription.go:455`

典型文案：

1. `参数错误`
2. `充值金额过低`
3. `创建订单失败`
4. `拉起支付失败`
5. `用户不存在`
6. `已达到该套餐购买上限`

#### 3.5 兑换码

1. `model/redemption.go`
   - `117`
   - `132`
   - `135`
   - `138`

典型文案：

1. `未提供兑换码`
2. `无效的兑换码`
3. `该兑换码已被使用`
4. `该兑换码已过期`

## 当前建议

如果只看用户侧，建议下一轮按这个顺序处理：

1. 登录 / 注册页里 GitHub 按钮状态文案。
2. TopupHistoryModal 的状态和支付方式映射。
3. ChannelKeyDisplay / useTokenKeys / useRedemptionsData 这类用户直接可见提示。
4. 个人中心 TwoFA / Passkey / NotificationSettings 的说明文字。
5. 后端支付、Passkey、2FA、签到、兑换码这些用户侧接口的中文响应。

## 备注

文档后续大段“管理端”内容保留作为历史记录，但当前如果你的目标只是清理用户侧，可以优先看本页顶部这几个“最新状态”和“用户侧剩余问题概览”小节。

本文基于当前仓库代码的静态扫描结果整理，目标不是检查“是否用了 i18n”，而是检查：

1. 当前界面语言为 `en` 时，用户是否仍可能看到中文。
2. 这些中文来自哪里。
3. 哪些是确定问题，哪些是需要产品判断的“中文专有名词/品牌名”。

## 范围说明

本清单只关注“英文环境下仍会出现中文”的情况，分为三类：

1. 前端硬编码中文，未经过 `t()` / `i18next.t()`。
2. 前端虽然调用了 `t('中文 key')`，但 `web/src/i18n/locales/en.json` 中缺少对应英文项，导致英文环境回退到中文 key。
3. 后端接口仍直接返回中文错误或中文消息，前端拿到后会在英文界面中直接展示。

不在本次清单内的内容：

1. `web/src/i18n/` 里的翻译资源文件本身。
2. 代码注释。
3. 数据库中管理员自行录入的公告、协议、关于页内容。
4. 上游服务原样返回的第三方错误文本。

## 当前结论

截至本次扫描，当前仓库还不能认为“英文环境已清理完成”。

已确认的残留类型如下：

1. 前端仍有大量硬编码中文字符串。
2. 前端仍有 `84` 个中文翻译 key 在 `en.json` 中缺失。
3. 后端 controller / model / service 里仍有大量直接返回中文的路径。

另外，前端粗扫还能扫出 `580` 个“可能直接显示中文”的候选点。这个数字是保守偏大的候选集，其中包含一部分说明性文本、中文品牌名和管理端长描述，但足以说明问题还不是零星遗漏。

## A. 前端硬编码中文

这类问题在英文环境下会直接显示中文，因为根本没有经过 i18n。

### A1. 用户侧常见路径

1. `web/src/constants/redemption.constants.js`
   - `30`: `未使用`
   - `34`: `已禁用`
   - `38`: `已使用`
   - 影响：兑换码状态文案。

2. `web/src/constants/playground.constants.js`
   - `117-124`
   - 例如：`此消息没有可复制的文本内容`、`复制失败，请手动选择文本复制`、`网络连接失败或服务器无响应`
   - 影响：Playground 错误提示和复制提示。

3. `web/src/constants/dashboard.constants.js`
   - `41-43`
   - `小时`、`天`、`周`
   - 影响：数据看板时间范围切换。

4. `web/src/components/topup/modals/TopupHistoryModal.jsx`
   - `45-48`: `成功`、`待支付`、`失败`、`已过期`
   - `56-57`: `支付宝`、`微信`
   - 影响：充值历史状态和支付方式标签。

5. `web/src/hooks/chat/useTokenKeys.js`
   - `33`
   - `当前没有可用的启用令牌，请确认是否有令牌处于启用状态！`
   - 影响：Chat2Link / token key 获取失败提示。

6. `web/src/hooks/redemptions/useRedemptionsData.jsx`
   - `231`: `已复制到剪贴板！`
   - `234`: `无法复制到剪贴板，请手动复制`
   - 影响：兑换码页面复制提示。

### A2. 管理端仍会直接显示中文的提示

1. `web/src/hooks/channels/useChannelsData.jsx`
   - `623`: `优先级必须是整数！`
   - `634`: `权重必须是非负整数！`
   - `644`: `更新成功！`
   - `923`: `通道 ${name} 测试成功，模型 ${model} 耗时 ${time.toFixed(2)} 秒。`

2. `web/src/hooks/common/useUserPermissions.js`
   - `42`: `获取权限失败`
   - `46`: `网络错误，请重试`

3. `web/src/pages/Setting/Dashboard/SettingsUptimeKuma.jsx`
   - `148`: `Uptime Kuma配置已更新`
   - `163`: `Uptime Kuma配置更新失败`
   - `201`: `分类已删除，请及时点击“保存设置”进行保存`
   - `209`: `请填写完整的分类信息`
   - `216`: `请输入有效的URL地址`
   - `221`: `Slug只能包含字母、数字、下划线和连字符`
   - `248-249`: `分类已更新...` / `分类已添加...`
   - `252`: `操作失败: ...`

4. `web/src/components/settings/RatioSetting.jsx`
   - `84`: `刷新失败`

5. `web/src/components/settings/RateLimitSetting.jsx`
   - `67`: `刷新失败`

### A3. 品牌/供应商中文名

这部分在英文环境下也会显示中文，但是否算问题需要产品判断。

1. `web/src/constants/channel.constants.js`
   - `64`: `百度文心千帆`
   - `69`: `百度文心千帆V2`
   - `74`: `阿里通义千问`
   - `79`: `讯飞星火认知`
   - `84`: `智谱 ChatGLM（已经弃用，请使用智谱 GLM-4V）`
   - `89`: `智谱 GLM-4V`
   - `125`: `知识库：FastGPT`
   - `130`: `知识库：AI Proxy`
   - `135`: `嵌入模型：MokaAI M3E`
   - `140`: `字节火山方舟、豆包通用`
   - `155`: `可灵`
   - `160`: `即梦`
   - `175`: `豆包视频`

如果目标是“完整英文后台”，这些也需要处理；如果允许显示中文品牌名，则可以单独归类为可接受项。

## B. 已走 `t()` 但英文资源缺失

这类问题更隐蔽，因为代码看起来已经“接入 i18n”，但英文资源里没有对应 key，英文环境仍会直接显示中文。

本次扫描确认 `en.json` 还缺 `84` 个中文 key。

### B1. 典型问题

1. `web/src/components/auth/RegisterForm.jsx`
   - `222`: `密码长度不得小于 8 位！`
   - `249`: `注册成功！`

2. `web/src/components/common/ui/ChannelKeyDisplay.jsx`
   - `139`: `共 {{count}} 个密钥`

3. `web/src/components/table/model-deployments/modals/ViewLogsModal.jsx`
   - `529`: `共 {{count}} 条日志`
   - `533`: `(筛选后显示 {{count}} 条)`

4. `web/src/components/table/models/components/SelectionNotification.jsx`
   - `48`: `已选择 {{count}} 个模型`

5. `web/src/hooks/redemptions/useRedemptionsData.jsx`
   - `265`: `已删除 {{count}} 条失效兑换码`

6. `web/src/pages/Setting/Chat/SettingsChats.jsx`
   - `98`: `已添加 {{count}} 个模板`

7. `web/src/components/table/models/ModelsActions.jsx`
   - `199`: `确定要删除所选的 {{count}} 个模型吗？`

8. `web/src/components/table/tokens/modals/DeleteTokensModal.jsx`
   - `39`: `确定要删除所选的 {{count}} 个令牌吗？`

### B2. 英文资源缺失较多的页面

以下页面虽然普遍已经在调用 `t()`，但英文资源仍有明显缺口：

1. 支付设置相关
   - `web/src/components/settings/PaymentSetting.jsx`
     - `173`: `易支付设置`
     - `201`: `Waffo Pancake 设置`
   - `web/src/pages/Setting/Payment/SettingsPaymentGateway.jsx`
     - `33`: `易支付设置`
     - `179`: `更新易支付设置`
   - `web/src/pages/Setting/Payment/SettingsPaymentGatewayStripe.jsx`
   - `web/src/pages/Setting/Payment/SettingsPaymentGatewayWaffo.jsx`
   - `web/src/pages/Setting/Payment/SettingsPaymentGatewayWaffoPancake.jsx`
   - 特点：大量 label / placeholder / helpText 已接入 `t()`，但 `en.json` 仍缺英文文案。

2. 模型部署 / 日志 / 选择类弹窗
   - `web/src/components/table/model-deployments/modals/ExtendDurationModal.jsx`
     - `531`: `点击`
   - `web/src/components/table/model-deployments/modals/UpdateConfigModal.jsx`
     - `329`: `例如: /bin/bash -c `
   - `web/src/components/table/usage-logs/components/ParamOverrideEntry.jsx`
     - `40`: `{{count}} 项操作`
   - `web/src/components/table/usage-logs/modals/ParamOverrideModal.jsx`
     - `148`: `{{count}} 项操作`

3. 渠道编辑 / 标签编辑
   - `web/src/components/table/channels/modals/EditChannelModal.jsx`
     - `1953`: `已新增 {{count}} 个模型：{{list}}`
   - `web/src/components/table/channels/modals/EditTagModal.jsx`
     - `363`: `已新增 {{count}} 个模型：{{list}}`

### B3. 动态 key 导致的英文缺失

有些代码不是单纯“没翻译”，而是写法本身就不利于提取和维护英文资源。

1. `web/src/components/common/DocumentRenderer/index.jsx`
   - `155`: `t('管理员未设置' + title + '内容')`
   - `185`: `t('访问' + title)`
   - `188`: `t('访问' + title)`

这类动态拼接 key 有两个问题：

1. `i18next-cli` 很难稳定提取。
2. 英文资源通常不会自然补全这种拼接后的 key。

这部分在英文环境下非常容易回退成中文。

## C. 后端仍直接返回中文

这类问题会导致：

1. 前端本身已经是英文界面；
2. 但接口失败时，toast / modal / 表单错误提示仍显示中文。

### C1. 直接在 controller 中返回中文

1. 微信登录/绑定
   - `controller/wechat.go`
   - 例如：`无效的参数`、`验证码错误或已过期`、`管理员未开启通过微信登录以及注册`、`该微信账号已被绑定`

2. 自定义 OAuth
   - `controller/custom_oauth.go`
   - 例如：`未找到该 OAuth 提供商`、`请先填写 Discovery URL 或 Issuer URL`、`Discovery URL 无效，仅支持 http/https`

3. 充值 / 支付
   - `controller/topup.go`
   - `controller/topup_stripe.go`
   - `controller/topup_creem.go`
   - `controller/topup_waffo.go`
   - `controller/topup_waffo_pancake.go`
   - `controller/subscription_payment_epay.go`
   - `controller/subscription_payment_stripe.go`
   - `controller/subscription_payment_creem.go`
   - 例如：`参数错误`、`创建订单失败`、`拉起支付失败`、`充值金额过低`、`套餐未启用`

4. Passkey / 安全验证
   - `controller/secure_verification.go`
   - `controller/passkey.go`
   - 例如：`用户未启用2FA或Passkey`、`验证码不能为空`、`Passkey 登录状态异常`

5. 其他后台接口
   - `controller/channel.go`
   - `controller/model_sync.go`
   - `controller/checkin.go`
   - `controller/model_meta.go`
   - `controller/vendor_meta.go`
   - `controller/prefill_group.go`
   - `controller/codex_usage.go`
   - `controller/codex_oauth.go`
   - `controller/ratio_sync.go`

### C2. model / service 层错误会通过 `common.ApiError(c, err)` 直接透传

这类问题更难靠前端修，因为 controller 并没有做 i18n 包装，而是直接把 `err.Error()` 发给前端。

确认仍存在中文错误的文件包括：

1. `model/user.go`
   - 例如：`邮箱地址或密码为空！`、`邀请额度不足！`

2. `model/token.go`
   - 例如：`搜索令牌失败`、`令牌数量超过上限，仅允许精确搜索，请勿使用 % 通配符`

3. `model/topup.go`
   - 例如：`充值订单不存在`、`充值订单状态错误`、`充值失败，请稍后重试`

4. `model/redemption.go`
   - 例如：`无效的兑换码`、`该兑换码已被使用`、`该兑换码已过期`

5. `model/checkin.go`
   - 例如：`签到功能未启用`、`今日已签到`

6. `model/passkey.go`
   - 例如：`Passkey 保存失败，请重试`

7. `model/twofa.go`
   - 例如：`验证码或备用码不正确`、`账户已被锁定，请在...后重试`

8. `common/totp.go`
   - 例如：`验证码必须是6位数字`

9. `service/channel_affinity.go`
   - 例如：`rule_name 不能为空`、`未知规则名称`

10. `service/billing_session.go`
   - 例如：`订阅额度不足或未配置订阅`

## D. 优先级建议

如果目标是先把“普通用户英文界面”尽快清干净，建议优先处理：

1. `web/src/constants/playground.constants.js`
2. `web/src/constants/redemption.constants.js`
3. `web/src/components/topup/modals/TopupHistoryModal.jsx`
4. `web/src/hooks/chat/useTokenKeys.js`
5. `web/src/hooks/redemptions/useRedemptionsData.jsx`
6. `controller/wechat.go`
7. `controller/secure_verification.go`
8. `controller/passkey.go`
9. `controller/topup*.go`
10. `controller/subscription_payment_*.go`

如果目标是“连管理后台英文环境也不出现中文”，还需要继续处理：

1. 支付设置整组页面
2. Ratio / GroupRatio / ModelRatio 相关说明和校验文案
3. Uptime Kuma / Dashboard / Channels / Param Override / Model 管理页
4. `en.json` 里缺失的 84 个 key

## E. 后续建议

建议按下面顺序清理：

1. 先处理前端硬编码中文。
2. 再补 `en.json` 里缺失的 key。
3. 最后把后端 controller / model / service 的中文错误统一收口到 `ApiErrorI18n` / `ApiSuccessI18n` / `i18n.T`。

否则即便前端页面都变英文了，接口报错时仍会“夹杂中文”。
