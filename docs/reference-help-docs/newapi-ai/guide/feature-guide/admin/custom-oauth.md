# 自定义 OAuth 提供商

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/custom-oauth.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/custom-oauth.mdx

## 页面大纲

  - 添加自定义 OAuth 提供商

## 原文内容

---
title: 自定义 OAuth 提供商
description: 添加任意符合 OIDC 标准的自定义登录方式
---
除内置的 OAuth 提供商外,Root 可以添加任意符合 OIDC 标准的自定义登录方式。使用 Root 账号登录后,进入系统设置页(`/console/setting`),找到「自定义 OAuth」区域。

![自定义 OAuth 提供商列表](../../../assets/guide/feature-guide/custom-oauth-list.png)

## 添加自定义 OAuth 提供商

1. 点击「添加提供商」按钮,弹出配置弹窗

![添加自定义 OAuth 弹窗](../../../assets/guide/feature-guide/custom-oauth-add.png)

2. 在「Discovery URL」输入框中填写 OIDC 提供商的 Discovery 地址(通常以 `/.well-known/openid-configuration` 结尾),点击「自动发现」,系统自动填充 Authorization Endpoint、Token Endpoint 等配置

![自动发现填充后的配置项](../../../assets/guide/feature-guide/custom-oauth-filled.png)

3. 填写 Client ID 和 Client Secret(从 OAuth 提供商的应用管理页面获取)
4. 填写显示名称(用户在登录页看到的按钮文字)
5. 点击「保存」,配置完成后用户登录页出现该提供商的登录入口
