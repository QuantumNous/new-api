# 日志与统计

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/log.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/log.mdx

## 页面大纲

  - 搜索与过滤
  - 日志统计面板
  - 全平台消耗趋势

## 原文内容

---
title: 日志与统计
description: 查看全平台 API 调用记录和消耗统计
---
查看全平台 API 调用记录和消耗统计，支持按用户、模型、渠道等多维度分析。使用管理员账号登录后，左侧导航点击「日志」，或直接访问 `/console/log`。

![全平台日志列表](/assets/guide/feature-guide/admin-log.png)

管理员视角的日志列表比普通用户多出「用户名」和「渠道名」两列，可查看所有用户的调用记录。

## 搜索与过滤

1. 在日志页顶部点击「筛选」按钮，展开过滤条件区域
2. 可设置以下过滤条件：
   - **时间范围**：选择开始和结束日期
   - **用户名**：输入用户名关键词
   - **模型**：输入模型名称关键词
   - **渠道**：选择特定渠道
   - **令牌名**：输入令牌名称
3. 点击「查询」，列表刷新显示过滤结果

![日志筛选条件展开状态](/assets/guide/feature-guide/admin-log-filter.png)

## 日志统计面板

在日志页顶部查看统计汇总区域，展示全平台的调用量汇总数据。

![日志统计面板（总调用次数、总消耗配额等）](/assets/guide/feature-guide/admin-log-stat.png)

## 全平台消耗趋势

1. 左侧导航点击「数据看板」，或直接访问 `/console`（管理员视角）

![全平台消耗趋势图](/assets/guide/feature-guide/admin-dashboard.png)

2. 管理员数据看板展示全平台的消耗趋势折线图，以及各用户的消耗占比分布
3. 将鼠标悬停在图表上可查看具体日期的详细数据
