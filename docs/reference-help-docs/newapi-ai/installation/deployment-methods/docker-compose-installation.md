# Docker Compose 部署

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/installation/deployment-methods/docker-compose-installation.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/installation/deployment-methods/docker-compose-installation.mdx

## 页面大纲

  - 前置要求
  - 使用Docker Compose部署
    - 方法一：使用Git克隆项目（推荐）
- 下载项目源码
- 进入项目目录
- 根据需要编辑 docker-compose.yml 文件
- 使用nano编辑器
- 或使用vim编辑器
- vim docker-compose.yml
    - 方法二：手动创建配置文件
- 使用nano编辑器
- 或使用vim编辑器
  - 启动服务
- 使用Docker Compose启动服务
  - 查看日志
- 或仅启动并跟随某个服务
  - 停止服务
- 停止服务
  - 访问系统

## 原文内容

---
title: Docker Compose 部署
---
本文档提供了使用Docker Compose部署New API的详细步骤。

## 前置要求

- 已安装Docker和Docker Compose
- 推荐系统: Linux (Ubuntu/CentOS/Debian等)

## 使用Docker Compose部署

### 方法一：使用Git克隆项目（推荐）

如果您能够正常访问GitHub，推荐使用此方法。项目中已包含完整的 `docker-compose.yml` 配置文件：

```shell
# 下载项目源码
git clone https://github.com/QuantumNous/new-api.git

# 进入项目目录
cd new-api

# 根据需要编辑 docker-compose.yml 文件
# 使用nano编辑器
nano docker-compose.yml
# 或使用vim编辑器
# vim docker-compose.yml
```

<Callout type="info" title="提示">
  项目自带的 `docker-compose.yml` 文件已经配置好了所有必要的服务（包括 MySQL 和
  Redis），您只需根据实际情况修改端口、密码等参数即可使用。
</Callout>

### 方法二：手动创建配置文件

如果无法访问GitHub或克隆仓库，可以手动创建配置文件：

1. 创建一个目录用于New API部署：

```shell
mkdir new-api
cd new-api
```

1. 在该目录中创建`docker-compose.yml`文件

   您可以参考[Docker Compose配置说明](/zh/docs/installation/config-maintenance/docker-compose-yml)文档中的配置示例，根据您的需求选择：
   - 生产环境推荐使用完整配置（包含MySQL和Redis）
   - 测试环境可以使用简化配置

1. 使用文本编辑器创建文件：

```shell
# 使用nano编辑器
nano docker-compose.yml

# 或使用vim编辑器
vim docker-compose.yml
```

将选择的配置内容复制到该文件中，并根据需要进行自定义修改。

## 启动服务

配置文件准备好后，无论您是通过Git克隆还是手动创建，都可以使用以下命令启动服务：

```shell
# 使用Docker Compose启动服务
docker compose up -d
```

该命令会自动拉取所需镜像并在后台启动服务。

## 查看日志

- **全部服务实时日志**

```bash
docker compose logs -f
```

- **指定服务日志**（示例：`new-api`、`mysql`、`redis`）

```bash
docker compose logs -f new-api
docker compose logs -f mysql
docker compose logs -f redis
```

- **仅查看最近 N 行**

```bash
docker compose logs --tail=100 new-api
```

- **查看最近一段时间内的日志**

```bash
docker compose logs --since=10m new-api
```

- **显示时间戳**

```bash
docker compose logs -f -t new-api
```

- **前台模式调试（随启动实时输出日志）**

```bash
docker compose up
# 或仅启动并跟随某个服务
docker compose up new-api
```

按 Ctrl+C 退出前台模式（会停止相应服务）。后台运行请使用 `-d`。

- **查看服务列表/状态**

```bash
docker compose ps
```

- **使用容器名查看日志**（当 `container_name` 已设置，如配置里的 `new-api`）

```bash
docker logs -f new-api
```

## 停止服务

```shell
# 停止服务
docker compose down
```

## 访问系统

服务启动成功后，访问`http://服务器IP:3000`将自动引导到初始化页面。按照页面指引手动设置管理员账号和密码（仅首次安装需要）。完成初始化后即可使用所设置的管理员账号登录系统。
