# 注册与登录

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/user/auth.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/user/auth.mdx

## 页面大纲

  - 登录
    - 账号密码登录
    - 第三方 OAuth 登录
    - 忘记密码
  - 注册
    - 注册流程

## 原文内容

---
title: 注册与登录
description: 支持账号密码注册,以及多种第三方 OAuth 一键登录
---
支持账号密码注册,以及多种第三方 OAuth 一键登录。首次使用请先完成注册。

## 登录

### 账号密码登录

1. 打开平台首页,点击右上角「登录」按钮,或直接访问 `/login`

![登录页](../../../assets/guide/feature-guide/login.png)

2. 在登录页输入用户名和密码,点击「登录」完成登录

### 第三方 OAuth 登录

如需使用第三方账号登录,点击页面下方对应平台的图标(GitHub、Discord、LinuxDO 等),跳转至第三方授权页面完成授权后自动登录

### 忘记密码

忘记密码时,点击登录页的「忘记密码」链接,输入注册邮箱后系统会发送重置链接,点击链接设置新密码,原密码随即失效。

## 注册

### 注册流程

1. 在登录页点击「注册」链接,或直接访问 `/register`

![注册页](../../../assets/guide/feature-guide/register.png)

2. 填写用户名、密码
3. 填写邮箱地址,点击「发送验证码」,将收到的验证码填入输入框
4. 点击「注册」完成账号创建,注册成功后自动跳转至首页
