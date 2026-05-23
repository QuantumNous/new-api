# 宝塔面板部署

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/installation/deployment-methods/bt-docker-installation.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/installation/deployment-methods/bt-docker-installation.mdx

## 页面大纲

  - 前置要求
  - 步骤一：安装宝塔面板
  - 步骤二：安装 Docker
  - 步骤三：安装 New API
    - 方法一：使用宝塔应用商店（推荐）
    - 方法二：使用 Docker Compose
    - 方法三：使用自定义镜像
  - 环境变量配置
    - 必要环境变量
    - 生成随机密钥
- 生成 SESSION_SECRET
- 或使用 Linux 命令
  - 访问与初始化
  - 常见问题
    - 无法访问 3000 端口
    - 登录后提示会话失效
    - 数据如何持久化
    - 如何更新版本
- 拉取最新镜像
- 使用 Docker Compose 重启
- 或使用宝塔容器管理重启容器
  - 相关链接

## 原文内容

---
title: 宝塔面板部署
---
本文档提供使用宝塔面板 Docker 功能部署 New API 的图文教程。

## 前置要求

| 项目 | 要求 |
| --- | --- |
| 宝塔面板 | ≥ 9.2.0 版本 |
| 推荐系统 | CentOS 7+、Ubuntu 18.04+、Debian 10+ |
| 服务器配置 | 至少 1 核 2G 内存 |

## 步骤一：安装宝塔面板

1. 前往 [宝塔面板官网](https://www.bt.cn/new/download.html) 下载适合您系统的安装脚本
2. 运行安装脚本安装宝塔面板
3. 安装完成后，使用提供的地址、用户名和密码登录宝塔面板

## 步骤二：安装 Docker

1. 登录宝塔面板后，在左侧菜单栏找到并点击 **Docker**
2. 首次进入会提示安装 Docker 服务，点击 **立即安装**
3. 按照提示完成 Docker 服务的安装

## 步骤三：安装 New API

### 方法一：使用宝塔应用商店（推荐）

1. 在宝塔面板 Docker 功能中，点击 **应用商店**
2. 搜索并找到 **New-API**
3. 点击 **安装**
4. 配置以下基本选项：
   - **容器名称**：可自定义，默认为 `new-api`
   - **端口映射**：默认为 `3000:3000`
   - **环境变量**：
     - `SESSION_SECRET`：会话密钥（**必填**，多机部署时必须一致）
     - `CRYPTO_SECRET`：加密密钥（使用 Redis 时必填）
   - **目录映射**：确保将 `/data` 目录映射到主机目录
5. 点击 **确认** 开始安装
6. 等待安装完成后，访问 `http://您的服务器IP:3000` 即可使用

### 方法二：使用 Docker Compose

适合需要更多自定义配置的场景。

1. 在宝塔面板中创建网站目录，如 `/www/wwwroot/new-api`
2. 创建 `docker-compose.yml` 文件：

```yaml
version: '3'
services:
  new-api:
    image: calciumion/new-api:latest
    container_name: new-api
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - SESSION_SECRET=your_session_secret_here  # 请修改为随机字符串
      - TZ=Asia/Shanghai
```

3. 通过 SSH 终端进入目录并启动：

```bash
cd /www/wwwroot/new-api
docker-compose up -d
```

### 方法三：使用自定义镜像

<Callout type="warn" title="高级用法">
  强烈建议通过"应用商店"安装。本节为高级用法，适合熟悉 Docker 的用户。
</Callout>

1. 在宝塔面板 Docker 功能中，点击 **镜像管理**
2. 点击 **获取镜像** → **拉取镜像**
3. 输入镜像名称：`calciumion/new-api:latest`
4. 点击 **提交**，等待镜像拉取完成
5. 拉取完成后，进入 **容器列表**，点击 **创建容器**
6. 填写以下信息：
   - **容器名称**：`new-api`（可自定义）
   - **镜像**：选择刚刚拉取的 `calciumion/new-api:latest`
   - **端口映射**：添加 `3000:3000`
   - **目录映射**：添加 `/your/host/path:/data`（替换为您的主机路径）
   - **环境变量**：根据需要添加
7. 点击 **提交**，完成安装

## 环境变量配置

### 必要环境变量

| 变量名 | 说明 | 是否必填 |
| --- | --- | --- |
| `SESSION_SECRET` | 会话密钥，多机部署必须一致 | **必填** |
| `CRYPTO_SECRET` | 加密密钥，使用 Redis 时必填 | 条件必填 |
| `SQL_DSN` | 数据库连接字符串（使用外部数据库时） | 可选 |
| `REDIS_CONN_STRING` | Redis 连接字符串 | 可选 |

### 生成随机密钥

```bash
# 生成 SESSION_SECRET
openssl rand -hex 16

# 或使用 Linux 命令
head -c 16 /dev/urandom | xxd -p
```

## 访问与初始化

安装完成后，访问 `http://服务器IP:3000`

首次访问将自动引导到初始化页面，按照页面指引设置管理员账号与密码。

## 常见问题

### 无法访问 3000 端口

1. 检查服务器防火墙是否开放 3000 端口
2. 在宝塔面板 **安全** 中放行 3000 端口
3. 检查云服务器安全组是否开放端口

### 登录后提示会话失效

确保设置了 `SESSION_SECRET` 环境变量，且值不为空。

### 数据如何持久化

使用 Docker 卷映射数据目录：

```yaml
volumes:
  - ./data:/data
```

### 如何更新版本

```bash
# 拉取最新镜像
docker pull calciumion/new-api:latest

# 使用 Docker Compose 重启
docker-compose down && docker-compose up -d

# 或使用宝塔容器管理重启容器
```

## 相关链接

- [环境变量配置](/docs/installation/config-maintenance/environment-variables)
- [Docker Compose 部署](/docs/installation/deployment-methods/docker-compose-installation)
- [常见问题](/docs/support/faq)
- [GitHub 仓库](https://github.com/QuantumNous/new-api)
