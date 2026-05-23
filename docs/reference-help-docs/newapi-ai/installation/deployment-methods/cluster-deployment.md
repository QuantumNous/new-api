# 集群部署

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/installation/deployment-methods/cluster-deployment.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/installation/deployment-methods/cluster-deployment.mdx

## 页面大纲

  - 前置要求
  - 集群架构概述
  - 集群部署关键配置
  - 部署步骤
    - 步骤一：准备共享数据库和 Redis
    - 步骤二：配置主节点
    - 步骤三：配置从节点
    - 步骤四：配置负载均衡
  - 高级配置选项
    - 数据同步设置
    - Redis 高可用配置
    - 会话安全配置
  - 监控与维护
    - 健康检查
    - 日志管理
  - 扩容指南
  - 最佳实践
  - 故障排除
    - 节点无法同步数据
    - 负载不均衡
    - 会话丢失问题
  - 相关文档

## 原文内容

---
title: 集群部署
---
本文档提供了 New API 集群部署的详细配置步骤和最佳实践，帮助您构建高可用、负载均衡的分布式系统。

## 前置要求

- 多台服务器（至少两台，一主多从架构）
- 已安装 Docker 和 Docker Compose
- 共享的 MySQL 数据库（主从节点需访问同一数据库）
- 共享的 Redis 服务（用于节点间数据同步和缓存）
- 可选：负载均衡器（如 Nginx、HAProxy 或云服务商提供的负载均衡服务）

## 集群架构概述

New API 集群采用主从架构设计：

1. **主节点**：负责处理所有写操作和部分读操作
2. **从节点**：主要负责处理读操作，提高系统整体吞吐量

![集群架构](../../assets/cluster-architecture.svg)

## 集群部署关键配置

集群部署的关键在于所有节点必须：

1. **共享相同的数据库**：所有节点访问同一 MySQL 数据库
2. **共享相同的 Redis**：用于缓存和节点间通信
3. **使用相同的密钥**：`SESSION_SECRET` 和 `CRYPTO_SECRET` 必须在所有节点上相同
4. **正确配置节点类型**：主节点为 `master`，从节点为 `slave`

## 部署步骤

### 步骤一：准备共享数据库和 Redis

首先，您需要准备共享的 MySQL 数据库和 Redis 服务。这可以是：

- 单独部署的高可用 MySQL 和 Redis 服务
- 云服务商提供的托管数据库和缓存服务
- 独立的服务器上运行的 MySQL 和 Redis

对于 MySQL 数据库，您可以选择以下架构方案：

| 架构类型           | 组件构成                                          | 工作方式                                                           | 应用配置方式                 |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| **主从复制架构**   | 1个主库`<br />`N个从库                            | 主库处理写入`<br />`从库处理读取`<br />`主从数据自动同步           | 配置主库地址作为 `SQL_DSN`   |
| **数据库集群架构** | 多个对等节点`<br />`代理层(ProxySQL/MySQL Router) | 所有节点都可读写`<br />`通过代理层实现负载均衡`<br />`自动故障转移 | 配置代理层地址作为 `SQL_DSN` |

<Callout type="warn" title="重要提示">
  无论选择哪种架构，应用程序的 `SQL_DSN` 配置都只需要一个统一入口地址。
</Callout>

确保这些服务能够被所有节点访问，并具有足够的性能和可靠性。

### 步骤二：配置主节点

在主节点服务器上创建 `docker-compose.yml` 文件：

```yaml
services:
  new-api-master:
    image: calciumion/new-api:latest
    container_name: new-api-master
    restart: always
    ports:
      - '3000:3000'
    environment:
      - SQL_DSN=root:password@tcp(your-db-host:3306)/new-api
      - REDIS_CONN_STRING=redis://default:password@your-redis-host:6379
      - SESSION_SECRET=your_unique_session_secret
      - CRYPTO_SECRET=your_unique_crypto_secret
      - TZ=Asia/Shanghai
      # 以下是可选配置
      - SYNC_FREQUENCY=60 # 同步频率，单位秒
      # - FRONTEND_BASE_URL=https://<your-newapi-domain> # 前端基础 URL，用于邮件通知等功能
    volumes:
      - ./data:/data
      - ./logs:/app/logs
```

<Callout type="warn" title="安全提示">
  请使用强密码和随机生成的密钥字符串替换上述配置中的示例值。
</Callout>

启动主节点：

```bash
docker compose up -d
```

### 步骤三：配置从节点

在每个从节点服务器上创建 `docker-compose.yml` 文件：

```yaml
services:
  new-api-slave:
    image: calciumion/new-api:latest
    container_name: new-api-slave
    restart: always
    ports:
      - '3000:3000' # 可以与主节点使用相同端口，因为它们在不同服务器上
    environment:
      - SQL_DSN=root:password@tcp(your-db-host:3306)/new-api # 与主节点相同
      - REDIS_CONN_STRING=redis://default:password@your-redis-host:6379 # 与主节点相同
      - SESSION_SECRET=your_unique_session_secret # 必须与主节点相同
      - CRYPTO_SECRET=your_unique_crypto_secret # 必须与主节点相同
      - NODE_TYPE=slave # 关键配置，指定为从节点
      - SYNC_FREQUENCY=60 # 从节点与主节点同步频率，单位秒
      - TZ=Asia/Shanghai
      # 以下是可选配置
      # - FRONTEND_BASE_URL=https://<your-newapi-domain> # 需与主节点相同
    volumes:
      - ./data:/data
      - ./logs:/app/logs
```

启动从节点：

```bash
docker compose up -d
```

对每台从节点服务器重复此步骤。

### 步骤四：配置负载均衡

为了实现流量的均衡分配，您需要设置负载均衡器。以下是使用 Nginx 作为负载均衡器的配置示例：

```nginx
upstream new_api_cluster {
    server master-node-ip:3000 weight=3;
    server slave-node1-ip:3000 weight=5;
    server slave-node2-ip:3000 weight=5;
    # 可添加更多从节点
}

server {
    listen 80;
    server_name <your-newapi-domain>;

    location / {
        proxy_pass http://new_api_cluster;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

此配置将主节点权重设置为 3，从节点权重设置为 5，这意味着从节点将处理更多的请求。您可以根据实际需求调整这些权重。

## 高级配置选项

### 数据同步设置

集群节点间的数据同步依赖于以下环境变量：

| 环境变量                | 说明               | 推荐值 |
| ----------------------- | ------------------ | ------ |
| `SYNC_FREQUENCY`        | 节点同步频率（秒） | `60`   |
| `BATCH_UPDATE_ENABLED`  | 启用批量更新       | `true` |
| `BATCH_UPDATE_INTERVAL` | 批量更新间隔（秒） | `5`    |

### Redis 高可用配置

为提高 Redis 的可用性，可以配置 Redis 集群或哨兵模式：

```yaml
environment:
  - REDIS_CONN_STRING=redis://your-redis-host:6379
  - REDIS_PASSWORD=your_redis_password
  - REDIS_MASTER_NAME=mymaster # 哨兵模式下的主节点名称
  - REDIS_CONN_POOL_SIZE=10 # Redis 连接池大小
```

### 会话安全配置

确保集群中所有节点使用相同的会话和加密密钥：

```yaml
environment:
  - SESSION_SECRET=your_unique_session_secret # 所有节点必须相同
  - CRYPTO_SECRET=your_unique_crypto_secret # 所有节点必须相同
```

## 监控与维护

### 健康检查

配置定期健康检查以监控节点状态：

```yaml
healthcheck:
  test:
    [
      'CMD-SHELL',
      "wget -q -O - http://localhost:3000/api/status | grep -o '\"success\":\\s*true' | awk -F: '{print $$2}'",
    ]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 日志管理

对于大规模集群，建议使用集中式日志管理系统：

```yaml
environment:
  - LOG_SQL_DSN=root:password@tcp(log-db-host:3306)/new_api_logs # 独立的日志数据库
```

## 扩容指南

随着业务增长，您可能需要扩展集群规模。扩容步骤如下：

1. **准备新服务器**：安装 Docker 和 Docker Compose
2. **配置从节点**：按照"步骤三：配置从节点"的说明配置新的从节点
3. **更新负载均衡器配置**：将新节点添加到负载均衡器配置中
4. **测试新节点**：确保新节点能正常工作并参与负载均衡

## 最佳实践

1. **定期备份数据库**：即使在集群环境中，也应定期备份数据库
2. **监控资源使用情况**：密切关注 CPU、内存和磁盘使用情况
3. **采用滚动更新策略**：更新时，先更新从节点，确认稳定后再更新主节点
4. **配置告警系统**：监控节点状态，在问题发生时及时通知管理员
5. **地理分布部署**：如果可能，将节点部署在不同地理位置，提高可用性

## 故障排除

### 节点无法同步数据

- 检查 Redis 连接是否正常
- 确认 SESSION_SECRET 和 CRYPTO_SECRET 在所有节点上是否相同
- 验证数据库连接配置是否正确

### 负载不均衡

- 检查负载均衡器配置和权重设置
- 监控各节点的资源使用情况，确保没有节点过载
- 可能需要调整节点权重或增加更多节点

### 会话丢失问题

- 确保所有节点使用相同的 SESSION_SECRET
- 验证 Redis 配置正确且可访问
- 检查客户端是否正确处理 cookie

## 相关文档

- [环境变量配置指南](/zh/docs/installation/config-maintenance/environment-variables) - 包含多节点部署的所有相关环境变量
- [系统更新指南](/zh/docs/installation/config-maintenance/system-update) - 多节点环境下的系统更新策略
- [Docker Compose 配置说明](/zh/docs/installation/config-maintenance/docker-compose-yml) - 用于编写集群节点配置文件
