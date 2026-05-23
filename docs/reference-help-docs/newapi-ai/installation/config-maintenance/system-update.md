# 系统更新指南

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/installation/config-maintenance/system-update.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/installation/config-maintenance/system-update.mdx

## 页面大纲

  - 更新前的准备工作
  - Docker部署的更新方法
    - 方法一：单容器部署更新
- 拉取最新镜像
- 停止并移除旧容器
- 使用相同的参数重新运行容器
    - 方法二：使用Docker Compose更新
- 进入项目目录
- 拉取最新镜像
- 停止并重启服务
    - 方法三：使用 1Panel 面板更新
    - 方法四：使用宝塔面板更新
  - 从源码编译的更新方法
- 进入项目目录
- 拉取最新代码
- 编译后端
- 更新并编译前端
- 重启服务
  - 多节点部署的更新策略
  - 更新后的检查事项
  - 版本回滚
    - Docker回滚
- 拉取特定版本的镜像
- 停止并移除当前容器
- 使用旧版本镜像重新创建容器
    - 源码回滚
- 进入项目目录
- 切换到特定版本
- 重新编译
- 更新并编译前端
- 重启服务
  - 常见问题
    - 更新后无法启动服务
    - 更新后功能异常
    - 数据库结构不兼容
  - 自动更新工具（谨慎使用）

## 原文内容

---
title: 系统更新指南
---
本文档提供了New API系统的更新方法和最佳实践，以确保您的系统平稳升级到最新版本。

## 更新前的准备工作

在更新系统之前，建议执行以下准备工作：

1. **备份数据**：备份数据库和重要配置文件
2. **查看更新日志**：在[GitHub Releases](https://github.com/Calcium-Ion/new-api/releases)查看最新版本的更新内容
3. **检查兼容性**：确认新版本与您现有的插件、集成或自定义配置是否兼容
4. **选择合适的时间**：在低峰期执行更新，减少对用户的影响

## Docker部署的更新方法

### 方法一：单容器部署更新

如果您使用单个Docker容器部署了New API，可以按照以下步骤更新：

```shell
# 拉取最新镜像
docker pull calciumion/new-api:latest

# 停止并移除旧容器
docker stop new-api
docker rm new-api

# 使用相同的参数重新运行容器
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v /your/data/path:/data \
  calciumion/new-api:latest
```

<Callout type="warn" title="请你注意">
  请确保使用与原容器相同的参数启动新容器，特别是数据卷挂载和环境变量配置。
</Callout>

### 方法二：使用Docker Compose更新

如果您使用Docker Compose部署（参见[Docker Compose配置说明](/zh/docs/installation/config-maintenance/docker-compose-yml)），更新过程更为简单：

```shell
# 进入项目目录
cd new-api

# 拉取最新镜像
docker compose pull

# 停止并重启服务
docker compose down
docker compose up -d
```

或使用更简洁的命令：

```shell
docker compose pull && docker compose down && docker compose up -d
```

### 方法三：使用 1Panel 面板更新

如果您使用 1Panel 面板部署，可以按照以下步骤更新：

1. 登录 1Panel 面板，进入 **应用商店** -> **可升级页面**
2. 找到 New API 应用，点击 **升级** 按钮
3. 选择 **要升级到的目标版本**
4. 点击 **确认** 按钮，系统将自动拉取最新镜像升级应用

### 方法四：使用宝塔面板更新

如果您使用宝塔面板部署，可以按照以下步骤更新：

1. 登录宝塔面板，进入 **Docker管理** -> **容器列表**
2. 找到New API容器，点击 **更多** -> **重新创建**
3. 勾选 **拉取最新镜像** 选项，确保其他配置保持不变
4. 点击 **提交** ，系统将自动拉取最新镜像并重新创建容器

## 从源码编译的更新方法

如果您是从源码编译部署的New API，更新步骤如下：

```shell
# 进入项目目录
cd new-api

# 拉取最新代码
git pull

# 编译后端
go build -o new-api

# 更新并编译前端
cd web
bun install
bun run build
cd ..

# 重启服务
./new-api --port 3000
```

## 多节点部署的更新策略

对于多节点部署的环境，建议采用以下更新策略：

1. **先更新从节点**：首先更新一个从节点，测试其稳定性
2. **逐步推进**：确认从节点稳定后，逐个更新其余从节点
3. **最后更新主节点**：所有从节点稳定运行后，更新主节点

这种策略可以最大限度地减少服务中断风险。

<Callout title="详细指南">
  有关集群部署的完整指南，请参考[集群部署文档](/zh/docs/installation/deployment-methods/cluster-deployment)。
</Callout>

## 更新后的检查事项

系统更新后，请检查以下事项以确保系统正常运行：

1. **访问管理界面**：确认可以正常登录和访问管理界面
2. **检查日志**：查看系统日志是否有错误或警告
3. **测试API调用**：测试一些API调用以确保功能正常
4. **检查数据库迁移**：确认数据库结构更新是否成功
5. **检查渠道状态**：确认所有渠道连接是否正常

## 版本回滚

如果更新后出现问题，可以回滚到之前的稳定版本：

### Docker回滚

```shell
# 拉取特定版本的镜像
docker pull calciumion/new-api:v1.x.x

# 停止并移除当前容器
docker stop new-api
docker rm new-api

# 使用旧版本镜像重新创建容器
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v /your/data/path:/data \
  calciumion/new-api:v1.x.x
```

### 源码回滚

```shell
# 进入项目目录
cd new-api

# 切换到特定版本
git checkout v1.x.x

# 重新编译
go build -o new-api

# 更新并编译前端
cd web
bun install
bun run build
cd ..

# 重启服务
./new-api --port 3000
```

## 常见问题

### 更新后无法启动服务

- 检查日志是否有错误信息
- 确认数据库连接是否正常
- 确认环境变量配置是否正确

### 更新后功能异常

- 查看是否有API格式变更
- 检查前端与后端版本是否匹配
- 确认新版本是否需要额外的配置

### 数据库结构不兼容

- 查看更新日志中是否有数据库迁移说明
- 检查是否需要手动执行数据库迁移脚本
- 联系开发者获取数据库升级指导

## 自动更新工具（谨慎使用）

对于希望自动更新的用户，可以使用Watchtower自动更新容器：

```shell
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  nickfedor/watchtower -c \
  --run-once new-api
```

<Callout type="warn" title="请你注意">
  自动更新可能导致意外问题，特别是数据库结构变更时。建议仅在测试环境使用自动更新，生产环境应手动控制更新过程。
</Callout>
