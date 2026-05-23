# 速率限制设置

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/console/settings/rate-limit-settings.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/console/settings/rate-limit-settings.mdx

## 页面大纲

- 本页未识别到标题层级。

## 原文内容

---
title: 速率限制设置
---
这里可以配置模型请求速率限制相关设置

分组速率限制示例：

```json
{
  "default": [200, 100],
  "vip": [0, 1000]
}
```

![速率限制设置](/assets/guide/rate-limit-setting.png)
