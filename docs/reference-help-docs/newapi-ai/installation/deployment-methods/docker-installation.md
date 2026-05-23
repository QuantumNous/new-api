# Docker 部署

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/installation/deployment-methods/docker-installation.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/installation/deployment-methods/docker-installation.mdx

## 页面大纲

  - 基本要求
  - 直接使用Docker镜像部署
    - 使用SQLite数据库（不推荐）
    - 使用MySQL数据库
  - 访问系统

## 原文内容

---
title: Docker 部署
---
本文档提供了使用Docker部署New API的详细步骤。

<Callout type="warn" title="强烈推荐">
  我们强烈推荐使用 [Docker Compose
  安装方式](/zh/docs/installation/deployment-methods/docker-compose-installation)
  而不是手动启动Docker容器。Docker
  Compose方式提供了更好的配置管理、服务编排和部署体验。
</Callout>

## 基本要求

- 已安装Docker环境
- 端口: 默认使用3000端口

## 直接使用Docker镜像部署

### 使用SQLite数据库（不推荐）

```shell
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v /your/data/path:/data \
  calciumion/new-api:latest
```

<Callout type="warn" title="注意">
  请将 `/your/data/path` 替换为您想要存储数据的本地路径。
</Callout>

### 使用MySQL数据库

```shell
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="用户名:密码@tcp(数据库地址:3306)/数据库名" \
  -e TZ=Asia/Shanghai \
  -v /your/data/path:/data \
  calciumion/new-api:latest
```

<Callout type="warn" title="注意">
  请替换参数中的数据库连接信息。
</Callout>

## 访问系统

部署完成后，访问 `http://服务器IP:3000` 将自动引导到初始化页面。按照页面指引手动设置管理员账号和密码（仅首次安装需要），完成后即可使用新设置的管理员账号登录系统。
