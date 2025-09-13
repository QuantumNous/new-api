# NodeLoc New-API Docker部署

这是NodeLoc版本的New-API，支持NodeLoc OAuth2登录。

## 快速开始

1. 下载docker-compose.yml文件：
```bash
curl -O https://raw.githubusercontent.com/nodeloc/new-api/main/docker-compose.yml
```

2. 启动服务：
```bash
docker-compose up -d
```

3. 访问 http://localhost:3000


### 其他配置
```yaml
environment:
  - SQL_DSN=root:123456@tcp(mysql:3306)/new-api
  - REDIS_CONN_STRING=redis://redis
  - TZ=Asia/Shanghai
  - ERROR_LOG_ENABLED=true
  - SESSION_SECRET=your_random_secret_key
```

## NodeLoc OAuth2设置

1. 访问 https://conn.nodeloc.cc/apps
2. 创建新应用
3. 设置回调URL: `https://your-domain.com/api/oauth/nodeloc`
4. 获取Client ID和Client Secret
5. 在环境变量中配置

## 版本

- `latest`: 最新版本
- `v1.x.x`: 具体版本号

## 支持

- 项目地址: https://github.com/nodeloc/new-api
- 问题反馈: https://github.com/nodeloc/new-api/issues
