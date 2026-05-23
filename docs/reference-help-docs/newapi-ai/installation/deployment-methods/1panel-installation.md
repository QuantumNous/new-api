# 1Panel 面板部署

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/installation/deployment-methods/1panel-installation.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/installation/deployment-methods/1panel-installation.mdx

## 页面大纲

  - 前置要求
  - 步骤一：安装 1Panel 面板
  - 步骤二：安装 New API
    - 搜索应用
    - 配置参数
    - 确认安装
  - 步骤三：配置环境变量（重要）
    - 必要环境变量
    - 配置方法
    - 生成随机密钥
- 生成 SESSION_SECRET
- 或使用 Linux 命令
  - 步骤四：访问 New API
  - 常见问题
    - 无法访问应用界面
    - 登录后提示会话失效
    - 如何更新版本
    - 数据如何持久化
  - 相关链接

## 原文内容

---
title: 1Panel 面板部署
---
本文档提供使用 1Panel 面板部署 New API 的图文教程。

## 前置要求

| 项目 | 要求 |
| --- | --- |
| 1Panel 面板 | 最新稳定版 |
| 推荐系统 | Linux (Ubuntu/CentOS/Debian 等) |
| 服务器配置 | 至少 1 核 2G 内存 |

## 步骤一：安装 1Panel 面板

<Callout type="info" title="安装 1Panel 面板">
  关于 1Panel 的安装部署与基础功能介绍，请参考 [1Panel 官方文档](https://1panel.cn/docs/)

  在完成了 1Panel 的安装部署后，根据提示网址打开浏览器进入 1Panel 面板
</Callout>

![1panel](/assets/1panel/1panel.jpg)

## 步骤二：安装 New API

### 搜索应用

<Callout type="info" title="搜索应用">
  进入应用商店应用列表，在【AI】分类下找到 New API 应用进行安装
</Callout>

![1panel-newapi](/assets/1panel/1panel-newapi.jpg)

### 配置参数

<Callout type="info" title="安装应用">
  在安装页面配置 New API 应用参数：
</Callout>

- **名称**：要创建的 New API 应用的名称
- **版本**：选择 New API 的版本
- **端口**：New API 应用的服务端口
- **时区**：输入服务器所在时区（默认 Asia/Shanghai）
- **高级设置**：务必勾选端口外部访问

![newapi-setting](/assets/1panel/newapi-setting.jpg)

### 确认安装

<Callout type="info" title="确认安装">
  点击确认开始安装，页面将自动跳转到已安装应用列表，等待 New API 应用状态变为已启动
</Callout>

![newapi-start](/assets/1panel/newapi-start.jpg)

## 步骤三：配置环境变量（重要）

安装完成后，建议配置以下关键环境变量：

### 必要环境变量

| 变量名 | 说明 | 是否必填 |
| --- | --- | --- |
| `SESSION_SECRET` | 会话密钥，多机部署必须一致 | **必填** |
| `CRYPTO_SECRET` | 加密密钥，使用 Redis 时必填 | 条件必填 |

### 配置方法

1. 在 1Panel 应用列表中，点击 New API 应用的 **参数** 按钮
2. 在环境变量区域添加：
   - `SESSION_SECRET=your_random_secret_key`
   - `CRYPTO_SECRET=your_crypto_secret_key`（可选）
3. 点击 **确认** 保存配置
4. 重启应用使配置生效

### 生成随机密钥

```bash
# 生成 SESSION_SECRET
openssl rand -hex 16

# 或使用 Linux 命令
head -c 16 /dev/urandom | xxd -p
```

## 步骤四：访问 New API

<Callout type="info" title="访问应用">
  - 在 `已安装` 页面，点击 `跳转` 即可进入 New API 的 WebUI 页面
  - 使用前建议在 `面板设置` 页面设置好 `默认访问地址`
</Callout>

![newapi-visit](/assets/1panel/newapi-visit.jpg)

首次访问将自动引导到初始化页面，按照页面指引设置管理员账号与密码。

## 常见问题

### 无法访问应用界面

1. 检查应用状态是否为"已启动"
2. 确认端口是否正确映射并开放
3. 检查服务器防火墙和云服务器安全组

### 登录后提示会话失效

确保设置了 `SESSION_SECRET` 环境变量，且值不为空。

### 如何更新版本

1. 登录 1Panel 面板，进入 **应用商店** → **可升级页面**
2. 找到 New API 应用，点击 **升级** 按钮
3. 选择目标版本，点击 **确认**

### 数据如何持久化

1Panel 应用默认会将数据存储在 Docker 卷中。如需自定义存储位置：

1. 在应用参数设置中，配置目录映射
2. 确保 `/data` 目录映射到持久化存储

## 相关链接

- [环境变量配置](/docs/installation/config-maintenance/environment-variables)
- [Docker Compose 部署](/docs/installation/deployment-methods/docker-compose-installation)
- [常见问题](/docs/support/faq)
- [GitHub 仓库](https://github.com/QuantumNous/new-api)
