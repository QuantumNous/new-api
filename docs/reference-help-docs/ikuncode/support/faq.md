# 常见问题（FAQ）

> 来源：https://docs.ikuncode.cc/zh/support/faq
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- 常见问题（FAQ）
  - 账号与 Key
    - 1. Key 无效/鉴权失败怎么办？
    - 2. 如何查看余额和消费记录？
  - 网站访问
    - 网站进入为什么白屏？
  - 环境与安装
    - npm 安装很慢/失败？
    - Node.js 版本过低怎么办？
    - 环境变量设置后不生效？
  - 工具使用
    - CC-Switch 无法启动？
    - Claude Code 提示连接失败？
    - CodeX 和 Claude Code 的令牌不通用？
  - 计费相关
    - 如何计费？
    - 余额不足会怎样？
    - 支持退款吗？
  - 技术问题
    - 代码会被保存吗？
    - 是否支持企业使用？
    - 如何获得技术支持？
  - 更多问题
    - 遇到技术难题？
    - 仍未解决？

## 原文内容

# 常见问题（FAQ）

## 账号与 Key

### 1\. Key 无效/鉴权失败怎么办？

-   检查是否复制了多余空格
-   检查 Key 是否过期/被禁用
-   检查请求是否使用了正确的 Header/参数
-   确认使用了对应工具的专用令牌组

### 2\. 如何查看余额和消费记录？

登录控制台即可查看：

-   当前余额
-   充值记录
-   消费明细
-   账单详情

## 网站访问

### 网站进入为什么白屏？

很有可能是你的广告过滤插件导致，请手动将我们的域名添加到白名单。

常见的广告过滤插件：

-   AdBlock
-   uBlock Origin
-   AdGuard

解决方法：

1.  打开插件设置
2.  添加 `api.ikuncode.cc` 到白名单
3.  刷新页面
4.  尝试浏览器强制刷新（Windows：`Ctrl + Shift + R`，macOS：`Cmd + Shift + R`）

## 环境与安装

### npm 安装很慢/失败？

可以使用国内镜像：

bash

```
# 设置淘宝镜像
npm config set registry https://registry.npmmirror.com

# 验证配置
npm config get registry
```

### Node.js 版本过低怎么办？

Claude Code、CodeX 和 Gemini CLI 都需要 Node.js 18+ 版本。

升级方法：

-   Windows: 重新下载安装最新版本
-   macOS: `brew upgrade node`
-   Linux: 使用 nvm 或 NodeSource 仓库

### 环境变量设置后不生效？

-   Windows: 重启终端窗口或重启电脑
-   macOS/Linux: 执行 `source ~/.bashrc` 或 `source ~/.zshrc`

## 工具使用

### CC-Switch 无法启动？

1.  检查是否有权限问题
2.  尝试以管理员身份运行
3.  查看是否有杀毒软件拦截
4.  重新下载安装最新版本

### Claude Code 提示连接失败？

检查项：

-   网络连接是否正常
-   API 密钥是否正确
-   环境变量是否设置正确
-   余额是否充足

### CodeX 和 Claude Code 的令牌不通用？

是的，不同工具需要不同的令牌组：

-   Claude Code: 使用 Claude Code 令牌组
-   CodeX: 使用 "codex测试" 令牌组
-   Gemini CLI: 使用 Gemini 令牌组

请在 IkunCode 平台创建对应的专用令牌。

## 计费相关

### 如何计费？

-   按实际使用量计费
-   不同模型价格不同
-   详细计费规则请查看控制台

### 余额不足会怎样？

-   服务会暂停
-   请及时充值以继续使用
-   充值后立即恢复服务

### 支持退款吗？

-   未使用的余额可以申请退款
-   已使用的部分不支持退款
-   具体政策请咨询客服

## 技术问题

### 代码会被保存吗？

不会。我们不会存储您的代码内容，仅转发请求和响应。

### 是否支持企业使用？

支持。企业用户可以：

-   联系客服获取企业方案
-   支持大额充值
-   可能享受优惠价格

### 如何获得技术支持？

请查看[售前售后](https://docs.ikuncode.cc/support/after-sales)页面获取联系方式。

## 更多问题

### 遇到技术难题？

如果遇到启动失败、报错、超时等技术问题，请查看：

👉 **[疑难杂症排查指南](https://docs.ikuncode.cc/support/troubleshooting)** - 详细的错误排查和解决方案

### 仍未解决？

如果上述问题没有解决您的疑问，请：

-   如需获取帮助，请发送邮件至 [\[email protected\]](https://docs.ikuncode.cc/cdn-cgi/l/email-protection#7605030606190402361f1d031815191213581515)
-   查看[售前售后](https://docs.ikuncode.cc/support/after-sales)联系客服
