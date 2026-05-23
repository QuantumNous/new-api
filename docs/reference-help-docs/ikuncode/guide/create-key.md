# 创建专属 Key

> 来源：https://docs.ikuncode.cc/zh/guide/create-key
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- 创建专属 Key
  - 创建步骤
  - 安全建议
  - 保存 Key
  - 下一步

## 原文内容

# 创建专属 Key

注册登录后，点击创建专属 Key。

## 创建步骤

1.  登录 IKunCode 平台
2.  访问"[令牌管理](https://api.ikuncode.cc/console/token)"
3.  点击"添加令牌"按钮
4.  创建需要使用的令牌，不要选择用户分组，请根据[监测站](https://status.ikuncode.cc/)的模型状态和令牌说明、倍率综合选择适合您的分组。
5.  保存并复制 Key

💡 小提示

**模型限制列表**留空即可，不需要配置。除非您看懂了它的作用。

## 安全建议

🔐 安全提醒

-   **不要**将 Key 分享给他人
-   **不要**将 Key 提交到代码仓库
-   **不要**在公开场合展示 Key
-   询问配置是否正确时，给Key打码
-   使用环境变量或配置文件存储 Key
-   定期更换 Key 提高安全性

## 保存 Key

创建成功后，请立即保存好您的 Key：

bash

```
# 示例 Key（请替换为您的实际 Key）
sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 下一步

-   [修改令牌设置](https://docs.ikuncode.cc/guide/modify-token) - 调整令牌参数
-   [配置环境变量](https://docs.ikuncode.cc/deploy/claude-code#%E9%85%8D%E7%BD%AE%E7%8E%AF%E5%A2%83%E5%8F%98%E9%87%8F) - 在工具中使用 Key
