# 快速开始

> 来源：https://docs.codexzh.com/ai-hub-api/quick-start
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- 快速开始
  - 第一步：注册账号
  - 第二步：登录账号
  - 第三步：购买额度
  - 第四步：创建 API 令牌
    - 填写令牌信息
    - 复制令牌
  - 遇到问题？

## 原文内容

# 快速开始

从这里开始接入 AI HUB API 中转。

* * *

> **配置前建议先阅读 [模型分组介绍](https://docs.codexzh.com/ai-hub-api/model-groups)**，了解不同分组的用途，避免配置错误导致无法使用。

## 第一步：注册账号

访问注册页面：[https://api.xbai.top/register](https://api.xbai.top/register)

注册方式：邮箱注册，填写邮箱、用户名、密码完成注册。

> 妥善保管登录凭证，建议使用强密码（字母+数字+特殊字符）。

## 第二步：登录账号

登录入口：[https://api.xbai.top/login](https://api.xbai.top/login)

登录方式：邮箱/用户名 + 密码

## 第三步：购买额度

登录后进入控制台，在「钱包管理」页面完成充值。

![image-20260201191208451](https://docs.codexzh.com/assets/1.BnqWLpa7.jpg)

充值说明：

-   支持支付宝、微信支付
-   充值比例：1:1（1 元人民币 = 1 美元额度）
-   充值后即时到账

## 第四步：创建 API 令牌

进入「令牌管理」页面，点击「添加令牌」按钮。

![image-20260201191234368](https://docs.codexzh.com/assets/2.60F2g-2c.jpg)

### 填写令牌信息

![image-20260201191314257](https://docs.codexzh.com/assets/3.Cm5gFkwX.jpg)

必填项：

-   令牌名称：便于识别用途（如：生产环境、测试环境）
-   令牌分组：必须根据使用场景选择正确分组

可选项：

-   过期时间：留空则永久有效
-   额度限制：限制该令牌的最大消费额度
-   模型限制：限制可访问的模型列表

> 令牌分组一定要根据使用的工具选择：
>
> -   使用其他 API 或客户端调用 → 选择**默认分组**
> -   使用 Claude Code → 选择 **CC 分组**
> -   使用 Codex → 选择 **Codex 分组**
>
> 不确定选哪个？查看 [模型分组介绍](https://docs.codexzh.com/ai-hub-api/model-groups)

### 复制令牌

创建完成后复制令牌，用于你的程序或第三方客户端。

## 遇到问题？

-   先查看 [模型分组介绍](https://docs.codexzh.com/ai-hub-api/model-groups) 确认分组选择正确
-   联系客服获取帮助：[客服支持](https://docs.codexzh.com/ai-hub-api/support)

**最后更新**：2025-02-01
