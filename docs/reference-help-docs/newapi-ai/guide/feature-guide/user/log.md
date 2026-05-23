# 使用记录

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/user/log.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/user/log.mdx

## 页面大纲

  - 查看使用记录
  - 搜索与过滤
    - 设置过滤条件
    - 查看过滤结果
  - 数据统计
    - 访问数据看板
    - 查看统计图表

## 原文内容

---
title: 使用记录
description: 查看每次 API 调用的详细信息，支持按时间、模型、令牌等条件过滤
---
查看每次 API 调用的详细信息，支持按时间、模型、令牌等条件过滤。左侧导航点击「日志」，或直接访问 `/console/log`。普通用户只能看到自己的调用记录。

## 查看使用记录

![个人日志页](../../../assets/guide/feature-guide/log-list.png)

日志列表每行展示一次调用记录，包含调用时间、使用的模型、消耗的 Token 数量和配额、调用状态等信息。

## 搜索与过滤

### 设置过滤条件

1. 在日志页顶部点击「筛选」按钮，展开过滤条件区域

![日志筛选条件展开状态](../../../assets/guide/feature-guide/log-filter-open.png)

2. 可设置以下过滤条件：
   - **时间范围**：选择开始和结束日期
   - **模型**：输入模型名称关键词
   - **令牌名**：选择或输入令牌名称

### 查看过滤结果

设置完成后点击「查询」，列表自动刷新显示过滤结果

![过滤后的日志列表](../../../assets/guide/feature-guide/log-filtered.png)

## 数据统计

### 访问数据看板

左侧导航点击「数据看板」，或直接访问 `/console`

![个人数据统计图表](../../../assets/guide/feature-guide/dashboard-chart.png)

### 查看统计图表

数据看板页面以折线图或柱状图展示每日 API 调用量和配额消耗趋势。将鼠标悬停在图表上可查看具体日期的详细数据。
