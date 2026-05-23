# 文档与关于页配置

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/docs-config.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/docs-config.mdx

## 页面大纲

  - 配置文档链接
  - 配置关于页

## 原文内容

---
title: 文档与关于页配置
description: 配置左侧导航的文档链接和关于页内容
---
import { Callout } from 'fumadocs-ui/components/callout';

对于左侧导航栏的「文档」按钮和「关于」页面，Root 均可在系统设置中自定义配置。使用 Root 账号登录后，访问 `/console/setting`。

## 配置文档链接

1. 在系统设置页点击「运营设置」标签页
2. 找到「文档地址」输入框

![文档地址输入框](../../../assets/guide/feature-guide/setting-docs-url.png)

3. 在输入框中填写文档网站的完整 URL（如 `https://docs.example.com`）
4. 点击「保存」
5. 返回首页，左侧导航栏出现「文档」按钮，点击后跳转到填写的地址

![首页左侧导航出现「文档」按钮的效果](../../../assets/guide/feature-guide/setting-docs-effect.png)

<Callout type="info">
  文档地址留空时，左侧导航不会显示「文档」按钮。
</Callout>

## 配置关于页

1. 在系统设置页点击「其它设置」标签页
2. 找到「关于」内容编辑区域

![关于内容编辑区](../../../assets/guide/feature-guide/setting-about-editor.png)

3. 在文本框中填写 Markdown 格式的内容（支持标题、链接、图片、列表等）
4. 点击「保存」
5. 用户点击左侧导航「关于」后将看到配置的内容

![关于页展示效果](../../../assets/guide/feature-guide/setting-about-effect.png)
