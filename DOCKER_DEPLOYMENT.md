# Docker 部署指南 - 订阅套餐分组限制功能

## 镜像信息

- **镜像名称**: `new-api:subscription-group-restriction`
- **镜像大小**: 180MB
- **版本**: v0.0.0-subscription-group-restriction
- **构建时间**: 2026-03-01

## 快速启动

### 1. 使用 SQLite（最简单）

```bash
docker run -d \
  --name new-api \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  new-api:subscription-group-restriction
```

### 2. 使用 MySQL

```bash
docker run -d \
  --name new-api \
  -p 3000:3000 \
  -e SQL_DSN="user:password@tcp(mysql-host:3306)/dbname" \
  -v $(pwd)/data:/data \
  new-api:subscription-group-restriction
```

### 3. 使用 PostgreSQL

```bash
docker run -d \
  --name new-api \
  -p 3000:3000 \
  -e SQL_DSN="host=postgres-host user=user password=password dbname=dbname port=5432 sslmode=disable" \
  -v $(pwd)/data:/data \
  new-api:subscription-group-restriction
```

### 4. 使用 Docker Compose

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  new-api:
    image: new-api:subscription-group-restriction
    container_name: new-api
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - SQL_DSN=host=postgres user=postgres password=postgres dbname=new-api port=5432 sslmode=disable
      - REDIS_CONN_STRING=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15
    container_name: postgres
    environment:
      - POSTGRES_DB=new-api
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:latest
    container_name: redis
    restart: unless-stopped

volumes:
  postgres_data:
```

启动：

```bash
docker-compose up -d
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SQL_DSN` | 数据库连接字符串 | SQLite: `/data/new-api.db` |
| `REDIS_CONN_STRING` | Redis 连接字符串 | - |
| `SESSION_SECRET` | Session 密钥 | 随机生成 |
| `PORT` | 服务端口 | 3000 |

## 功能验证

### 1. 访问管理后台

```bash
# 浏览器访问
http://localhost:3000

# 默认管理员账号（首次启动后创建）
# 用户名: root
# 密码: 123456
```

### 2. 创建带分组限制的订阅套餐

通过管理后台 API 创建套餐：

```bash
curl -X POST http://localhost:3000/api/admin/subscription/plans \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "title": "VIP套餐",
      "subtitle": "仅限VIP和Premium分组",
      "price_amount": 99.99,
      "currency": "USD",
      "duration_unit": "month",
      "duration_value": 1,
      "upgrade_group": "vip",
      "allowed_groups": "vip,premium",
      "total_amount": 1000000,
      "enabled": true
    }
  }'
```

### 3. 测试分组限制

用户购买套餐后，尝试使用不同分组：

```bash
# 使用允许的分组（成功）
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# 使用不允许的分组（失败，返回403）
# 如果用户的 token 配置使用了不在 allowed_groups 中的分组
```

## 日志查看

```bash
# 查看实时日志
docker logs -f new-api

# 查看最近100行日志
docker logs --tail 100 new-api
```

## 数据备份

### SQLite

```bash
# 备份数据库
docker exec new-api cp /data/new-api.db /data/new-api.db.backup

# 从容器复制到主机
docker cp new-api:/data/new-api.db ./backup/
```

### PostgreSQL

```bash
# 备份数据库
docker exec postgres pg_dump -U postgres new-api > backup.sql

# 恢复数据库
docker exec -i postgres psql -U postgres new-api < backup.sql
```

## 更新镜像

```bash
# 停止并删除旧容器
docker stop new-api
docker rm new-api

# 重新构建镜像
docker build -t new-api:subscription-group-restriction .

# 启动新容器
docker run -d \
  --name new-api \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  new-api:subscription-group-restriction
```

## 故障排查

### 1. 容器无法启动

```bash
# 查看容器日志
docker logs new-api

# 检查容器状态
docker ps -a | grep new-api
```

### 2. 数据库连接失败

```bash
# 检查数据库连接字符串
docker exec new-api env | grep SQL_DSN

# 测试数据库连接
docker exec new-api ping -c 3 postgres-host
```

### 3. 端口冲突

```bash
# 检查端口占用
lsof -i :3000

# 使用其他端口
docker run -d -p 3001:3000 new-api:subscription-group-restriction
```

## 性能优化

### 1. 启用 Redis 缓存

```bash
docker run -d \
  --name new-api \
  -p 3000:3000 \
  -e REDIS_CONN_STRING="redis://redis:6379" \
  -v $(pwd)/data:/data \
  new-api:subscription-group-restriction
```

### 2. 调整资源限制

```bash
docker run -d \
  --name new-api \
  -p 3000:3000 \
  --memory="2g" \
  --cpus="2" \
  -v $(pwd)/data:/data \
  new-api:subscription-group-restriction
```

## 新功能说明

### 订阅套餐分组限制

此版本新增了订阅套餐分组限制功能：

1. **管理员配置**：在创建或编辑订阅套餐时，可以设置 `allowed_groups` 字段
2. **用户限制**：用户购买套餐后，只能使用套餐允许的分组
3. **实时验证**：API 请求时实时检查分组权限
4. **多语言支持**：支持中文、英文、繁体中文错误提示

### 配置示例

```json
{
  "allowed_groups": "vip,premium,enterprise"  // 只允许这三个分组
}
```

或

```json
{
  "allowed_groups": ""  // 空值表示不限制，允许所有分组
}
```

## 安全建议

1. **修改默认密码**：首次登录后立即修改管理员密码
2. **使用 HTTPS**：生产环境建议使用反向代理（Nginx/Caddy）配置 HTTPS
3. **限制访问**：使用防火墙限制管理后台访问
4. **定期备份**：定期备份数据库和配置文件
5. **更新镜像**：定期更新到最新版本

## 技术支持

- 功能文档：`SUBSCRIPTION_GROUP_RESTRICTION.md`
- 项目地址：https://github.com/QuantumNous/new-api
- 问题反馈：GitHub Issues

## 版本信息

- **功能版本**: v0.0.0-subscription-group-restriction
- **构建日期**: 2026-03-01
- **新增功能**: 订阅套餐分组限制
- **数据库兼容**: SQLite, MySQL 5.7.8+, PostgreSQL 9.6+
