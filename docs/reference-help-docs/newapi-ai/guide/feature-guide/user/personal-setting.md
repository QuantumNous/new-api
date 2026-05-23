# 个人设置

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/user/personal-setting.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/user/personal-setting.mdx

## 页面大纲

  - 基本信息
    - 修改用户名
    - 绑定邮箱
    - 更改密码
  - 双因素认证（2FA）
    - 开启 2FA
  - Passkey 无密码登录
    - 注册 Passkey
  - 第三方账号绑定
    - 绑定第三方账号
  - 可用模型查看
    - 查看和复制模型
  - 通知设置
    - 邮件通知
    - Webhook 通知
  - 价格设置
    - 配置价格策略
  - IP 记录设置
    - 开启 IP 记录
  - 安全设置
    - 重置 API 密钥

## 原文内容

---
title: 个人设置
description: 管理账号基本信息、安全设置和第三方账号绑定
---
import { Callout } from 'fumadocs-ui/components/callout';

管理账号基本信息、安全设置和第三方账号绑定。登录后点击右上角头像，在下拉菜单中选择「个人设置」，或直接访问 `/console/personal`。

## 基本信息

![个人信息页](/assets/guide/feature-guide/personal.png)

### 修改用户名

在用户名输入框中输入新用户名，点击「保存」

### 绑定邮箱

填写邮箱地址，点击「发送验证码」，输入验证码后点击「绑定」

### 更改密码

依次填写当前密码、新密码、确认新密码，点击「修改密码」

## 双因素认证（2FA）

开启 2FA 后，每次登录时除密码外还需输入验证器 App 中的动态码，有效防止账号被盗。

![2FA 设置区域](/assets/guide/feature-guide/2fa-section.png)

### 开启 2FA

1. 在手机上安装验证器 App（推荐 Google Authenticator 或 Microsoft Authenticator）
2. 在个人设置页找到「双因素认证」区域，点击「开启 2FA」
3. 用验证器 App 扫描页面上显示的二维码，App 中会出现一个 6 位动态码

![2FA 二维码弹窗](/assets/guide/feature-guide/2fa-qrcode.png)

4. 将 App 中显示的 6 位动态码填入验证框，点击「确认开启」
5. 系统显示一组备用码，请立即截图或抄写保存，用于无法使用验证器时的紧急登录

<Callout type="warn">
  备用码只显示一次，关闭弹窗后无法再次查看。丢失备用码且无法使用验证器时，需联系管理员重置。
</Callout>

## Passkey 无密码登录

Passkey 支持使用设备指纹、面容识别或硬件安全密钥登录，无需输入密码。

![Passkey 设置区域](/assets/guide/feature-guide/passkey-section.png)

### 注册 Passkey

1. 在个人设置页向下滚动，找到「Passkey」区域
2. 点击「注册 Passkey」按钮
3. 浏览器弹出系统验证提示，按提示完成指纹、面容或安全密钥验证
4. 验证通过后 Passkey 注册完成，下次登录时可直接使用

## 第三方账号绑定

将 GitHub、Discord 等第三方账号与当前账号绑定后，可直接用第三方账号登录，无需输入密码。

![第三方账号绑定区域](/assets/guide/feature-guide/oauth-bind-section.png)

### 绑定第三方账号

1. 在个人设置页向下滚动，找到「第三方账号绑定」区域
2. 点击要绑定的平台对应的「绑定」按钮
3. 页面跳转至该平台的授权页面，登录并点击「授权」
4. 授权完成后自动跳回，绑定状态变为「已绑定」

## 可用模型查看

查看当前账户可以调用的所有模型，方便复制模型名称用于 API 调用。

![可用模型查看](/assets/guide/available-models.png)

### 查看和复制模型

1. 在个人设置页向下滚动，找到「可用模型」区域
2. 列表展示所有可用模型的名称
3. 点击模型名称即可复制到剪贴板
4. 可在搜索框中输入关键词快速筛选模型

## 通知设置

配置接收系统通知的方式，支持邮件和 Webhook 两种方式。

### 邮件通知

![邮件通知设置](/assets/guide/account-notification-mail.png)

1. 在个人设置页找到「通知设置」区域
2. 勾选「启用邮件通知」
3. 选择要接收通知的事件类型：
   - 配额不足提醒
   - 令牌即将过期
   - 系统公告
4. 点击「保存」完成配置

### Webhook 通知

![Webhook 通知设置](/assets/guide/account-notification-webhook.png)

1. 在通知设置区域勾选「启用 Webhook」
2. 填写 Webhook URL（接收通知的接口地址）
3. 选择要推送的事件类型
4. 点击「测试」验证 Webhook 是否可用
5. 点击「保存」完成配置

Webhook 推送的数据格式为 JSON，包含事件类型、时间戳和详细信息。

## 价格设置

控制是否允许调用未设置价格的模型。

![价格设置](/assets/guide/account-price.png)

### 配置价格策略

1. 在个人设置页找到「价格设置」区域
2. 选择以下策略之一：
   - **拒绝未定价模型**：只能调用已设置价格的模型（推荐）
   - **允许未定价模型**：可以调用所有模型，未定价模型按默认倍率计费
3. 点击「保存」

<Callout type="warn">
  允许未定价模型可能导致意外的高额消耗，建议保持默认的「拒绝未定价模型」设置
</Callout>

## IP 记录设置

控制是否在日志中记录 API 调用的来源 IP 地址。

![IP 记录设置](/assets/guide/account-ip-log.png)

### 开启 IP 记录

1. 在个人设置页找到「IP 记录」区域
2. 勾选「启用 IP 记录」
3. 点击「保存」
4. 开启后，在使用记录页面可以看到每次调用的来源 IP

IP 记录有助于：
- 监控异常访问
- 排查安全问题
- 分析流量来源

## 安全设置

### 重置 API 密钥

![安全设置区域](/assets/guide/account-security.png)

如果怀疑 API 密钥泄露，可以重置密钥：

1. 在个人设置页找到「安全设置」区域
2. 点击「重置 API 密钥」按钮
3. 确认操作后，系统生成新的密钥
4. 旧密钥立即失效，所有使用旧密钥的令牌需要重新创建

<Callout type="warn">
  重置 API 密钥后，所有现有令牌将失效，需要重新创建令牌
</Callout>
