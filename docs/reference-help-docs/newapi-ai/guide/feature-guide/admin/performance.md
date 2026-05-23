# 性能监控

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/performance.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/performance.mdx

## 页面大纲

  - 执行维护操作

## 原文内容

---
title: 性能监控
description: 查看服务器实时资源使用情况，并进行系统维护操作
---
查看服务器实时资源使用情况，并进行系统维护操作。使用 Root 账号登录后，进入系统设置页（`/console/setting`），找到「性能监控」标签页。

![性能监控标签页](/assets/guide/feature-guide/performance.png)

性能监控页展示服务器当前的 CPU 使用率、内存占用、请求量等实时指标。

## 执行维护操作

在性能监控页找到对应操作按钮，点击后系统立即执行：

![维护操作按钮区域](/assets/guide/feature-guide/performance-actions.png)

| 操作 | 说明 | 使用场景 |
| --- | --- | --- |
| 清除磁盘缓存 | 释放磁盘缓存空间 | 磁盘占用过高时 |
| 重置统计数据 | 清零性能计数器 | 需要重新统计时 |
| 强制 GC | 手动触发 Go 垃圾回收，释放内存 | 内存占用异常偏高时 |
| 清理日志文件 | 删除旧日志文件，释放磁盘空间 | 日志文件积累过多时 |

点击操作按钮后，页面提示操作结果，指标数据随即刷新。
