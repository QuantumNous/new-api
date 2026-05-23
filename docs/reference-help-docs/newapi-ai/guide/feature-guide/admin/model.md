# 模型管理

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/model.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/model.mdx

## 页面大纲

  - 添加 / 编辑模型
  - 同步上游模型

## 原文内容

---
title: 模型管理
description: 管理平台所有模型的元数据和定价
---
管理平台所有模型的元数据和定价,支持从上游服务商同步最新模型列表。使用管理员账号登录后,左侧导航点击「模型」,或直接访问 `/console/models`。

![模型列表页](/assets/guide/feature-guide/model-list.png)

模型列表展示平台所有已配置的模型,包含模型名称、类型、输入/输出定价、所属厂商等信息。

## 添加 / 编辑模型

1. 点击「添加模型」按钮,或点击已有模型右侧的「编辑」按钮

![添加/编辑模型弹窗](/assets/guide/feature-guide/model-edit.png)

2. 填写模型名称、输入价格、输出价格等信息
3. 点击「保存」完成配置

## 同步上游模型

同步功能可从各服务商获取最新模型列表,预览变更后再决定是否应用。

1. 在模型管理页点击「同步上游」按钮
2. 系统请求上游服务商的模型列表,弹出预览弹窗

![同步上游模型预览弹窗](/assets/guide/feature-guide/model-sync-preview.png)

3. 预览弹窗中分别列出「新增」「变更」「删除」的模型
4. 确认无误后点击「应用」,模型列表更新完成

![同步完成后的模型列表](/assets/guide/feature-guide/model-synced.png)
