# 用户管理

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/user.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/user.mdx

## 页面大纲

  - 编辑用户
    - 打开编辑弹窗
    - 修改用户信息
    - 保存修改
  - 搜索用户
    - 使用搜索功能
    - 查看搜索结果

## 原文内容

---
title: 用户管理
description: 查看和管理平台所有注册用户
---
查看和管理平台所有注册用户，包括修改角色、配额、分组，以及账号状态控制。使用管理员账号登录后，左侧导航点击「用户」，或直接访问 `/console/user`。

![用户列表页](/assets/guide/feature-guide/user-list.png)

用户列表展示平台所有注册用户，包含用户名、邮箱、角色、分组、配额余额、状态等信息。

## 编辑用户

### 打开编辑弹窗

在用户列表中找到目标用户，点击右侧「编辑」按钮，弹出编辑弹窗

![编辑用户弹窗](/assets/guide/feature-guide/user-edit.png)

### 修改用户信息

可修改以下信息：
- **角色**：普通用户 / 管理员，修改后立即生效
- **分组**：指定用户所属的渠道分组
- **配额余额**：直接设置用户的配额数值
- **状态**：启用或禁用账号，禁用后该用户无法登录

### 保存修改

修改完成后点击「保存」

## 搜索用户

### 使用搜索功能

1. 在用户列表顶部找到搜索框
2. 输入用户名或邮箱关键词

![搜索框输入关键词后的过滤结果](/assets/guide/feature-guide/user-search.png)

### 查看搜索结果

列表实时过滤，显示匹配的用户记录
