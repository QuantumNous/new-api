# New API 部署与配置完整教程

> 本文档基于实际部署经验整理，涵盖从环境准备到上线运行的全流程，适合新手参考。

## 目录

1. [项目介绍](#项目介绍)
2. [环境准备](#环境准备)
3. [Docker 部署](#docker-部署)
4. [Nginx 反向代理配置](#nginx-反向代理配置)
5. [HTTPS 证书配置](#https-证书配置)
6. [初始配置](#初始配置)
7. [模型与渠道配置](#模型与渠道配置)
8. [支付配置（彩虹易支付）](#支付配置彩虹易支付)
9. [常见问题](#常见问题)
10. [进阶配置](#进阶配置)

---

## 项目介绍

New API 是基于 One API 二次开发的 AI 模型接口管理与分发平台，支持将 OpenAI、Claude、Gemini、DeepSeek、智谱 GLM、讯飞星火等多种主流大模型封装为统一的 OpenAI 兼容接口，并提供用户管理、额度计费、渠道管理、数据统计等功能。

**主要特性：**
- 支持 50+ 种大模型渠道
- 兼容 OpenAI / Claude / Gemini 接口格式
- 用户注册、登录、额度管理
- 渠道负载均衡、故障自动切换
- 在线充值、兑换码、会员系统
- 完整的调用日志和数据统计
- 支持 Docker 一键部署

**项目地址：** https://github.com/QuantumNous/new-api

---

## 环境准备

### 服务器要求

| 配置 | 最低要求 | 推荐配置 |
|------|---------|---------|
| CPU | 1 核 | 2 核及以上 |
| 内存 | 1 GB | 2 GB 及以上 |
| 硬盘 | 10 GB | 20 GB 及以上 |
| 系统 | Ubuntu 20.04 / Debian 11 | Ubuntu 22.04 LTS |
| 带宽 | 1 Mbps | 5 Mbps 及以上 |

### 需要准备的东西

1. 一台云服务器（国内服务器需要备案，海外服务器无需备案）
2. 一个域名（已解析到服务器 IP）
3. 至少一个大模型渠道的 API 密钥（用于测试）

### 安装 Docker 和 Docker Compose

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker 并设置开机自启
systemctl enable docker
systemctl start docker

# 安装 Docker Compose（新版 Docker 已自带 compose 插件，可跳过）
# 验证安装
docker --version
docker compose version
```

---

## Docker 部署

### 方式一：快速启动（推荐新手）

```bash
# 创建数据目录
mkdir -p /opt/new-api/data

# 启动容器
docker run -d \
  --name new-api \
  --restart always \
  -p 3000:3000 \
  -v /opt/new-api/data:/data \
  calciumion/new-api:latest
```

### 方式二：Docker Compose 部署（推荐生产环境）

创建 `docker-compose.yml` 文件：

```yaml
version: '3'

services:
  new-api:
    image: calciumion/new-api:latest
    container_name: new-api
    restart: always
    ports:
      - "127.0.0.1:3000:3000"  # 只监听本地，通过 Nginx 反代
    volumes:
      - ./data:/data
    environment:
      - TZ=Asia/Shanghai
      # 可选：设置 SQL_DSN 使用 MySQL 数据库（默认使用 SQLite）
      # - SQL_DSN=root:password@tcp(127.0.0.1:3306)/new_api?charset=utf8mb4&parseTime=True&loc=Local
```

启动：

```bash
docker compose up -d
```

### 验证部署

```bash
# 查看容器状态
docker ps | grep new-api

# 查看日志
docker logs -f new-api

# 测试访问
curl http://127.0.0.1:3000
```

如果看到 HTML 内容，说明部署成功。

---

## Nginx 反向代理配置

### 安装 Nginx

```bash
apt install nginx -y
```

### 配置反向代理

创建配置文件 `/etc/nginx/sites-available/new-api`：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置（流式输出需要较长超时）
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 60s;
        
        # 缓冲设置（流式输出建议关闭缓冲）
        proxy_buffering off;
        proxy_cache off;
    }
}
```

启用配置：

```bash
# 创建软链接
ln -s /etc/nginx/sites-available/new-api /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

---

## HTTPS 证书配置

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
apt install certbot python3-certbot-nginx -y

# 申请证书（会自动修改 Nginx 配置）
certbot --nginx -d your-domain.com

# 证书自动续期（Certbot 会自动配置定时任务）
certbot renew --dry-run
```

申请成功后，Nginx 配置会自动更新为 443 端口，并添加 80 端口跳转到 443。

---

## 初始配置

### 1. 登录管理员账号

访问 `https://your-domain.com`，默认管理员账号：

- 用户名：`root`
- 密码：`123456`

**⚠️ 首次登录后请立即修改密码！**

### 2. 修改管理员密码

右上角头像 → 个人设置 → 修改密码

### 3. 系统设置

进入 **管理后台** → **系统设置**，建议配置以下项：

| 设置项 | 建议值 | 说明 |
|--------|--------|------|
| 站点名称 | 你的平台名称 | 显示在页面标题和导航栏 |
| 站点描述 | 简短介绍 | 用于 SEO 和登录页展示 |
| 允许注册 | 开启 | 是否允许新用户注册 |
| 注册赠送额度 | 200（约2元） | 新用户注册时赠送的额度 |
| 密码登录 | 开启 | 是否允许邮箱密码登录 |
| 访问令牌有效期 | 7 天 | 用户登录态保持时间 |

---

## 模型与渠道配置

### 1. 添加渠道

进入 **管理后台** → **渠道** → **添加渠道**

以 DeepSeek 为例：

| 配置项 | 值 |
|--------|-----|
| 渠道类型 | DeepSeek |
| 名称 | DeepSeek 官方 |
| 密钥 | sk-xxxxxxxx（你的 DeepSeek API Key） |
| 模型 | deepseek-chat, deepseek-reasoner |
| 代理 | 留空（国内可直连） |
| 分组 | default |

点击「测试」验证渠道是否可用，测试通过后点击「提交」。

### 2. 配置模型价格

进入 **管理后台** → **模型** → **模型定价**

每个模型需要设置输入和输出价格（单位：美元/百万 token），建议参考官方价格，适当加价。

示例：

| 模型 | 输入价格 | 输出价格 |
|------|---------|---------|
| deepseek-chat | $0.0014 | $0.0028 |
| deepseek-reasoner | $0.0014 | $0.0028 |
| glm-4-flash | $0.0001 | $0.0001 |
| gpt-4o-mini | $0.00015 | $0.0006 |

**⚠️ 注意：只有配置了价格的模型才会在 `/v1/models` 接口中返回，用户才能调用。**

### 3. 验证模型调用

在 **管理后台** → **渠道** 页面，点击渠道的「测试」按钮，或者用 curl 测试：

```bash
curl https://your-domain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 你的API密钥" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

---

## 支付配置（彩虹易支付）

### 1. 注册彩虹易支付商户

访问彩虹易支付平台（如 https://pay.v8jisu.cn），注册商户账号，获取：

- 商户 ID（PID）
- 商户密钥（KEY）
- 接口地址

### 2. 在 New API 中配置

进入 **管理后台** → **计费与支付** → **支付网关**

找到「彩虹易支付（Epay）」，点击配置：

| 配置项 | 值 |
|--------|-----|
| 启用 | ✅ 开启 |
| 商户 ID | 你的 PID |
| 商户密钥 | 你的 KEY |
| 接口地址 | 易支付平台地址 |

### 3. 启用在线充值

进入 **管理后台** → **计费与支付** → **额度设置**

- 开启「启用在线充值」
- 设置最小充值金额（建议 1 元）
- 设置充值金额选项（1元、5元、10元、50元、100元）

### 4. 域名过白

在彩虹易支付商户后台，找到「域名管理」或「支付域名白名单」，添加你的域名：

- `your-domain.com`
- `www.your-domain.com`（如果使用）

等待审核通过后，支付功能即可正常使用。

### 5. 确认合规条款（兑换码功能）

进入 **管理后台** → **计费与支付** → **兑换码**，按提示阅读并确认合规条款，即可启用兑换码功能。

---

## 常见问题

### Q1：容器启动后访问 502 Bad Gateway

**原因：** Nginx 反代配置错误，或容器未正常启动。

**解决：**
```bash
# 检查容器状态
docker ps | grep new-api

# 查看容器日志
docker logs new-api

# 检查 Nginx 配置
nginx -t

# 确认端口监听
netstat -tlnp | grep 3000
```

### Q2：模型列表为空，调用提示「模型价格尚未由管理员配置」

**原因：** 模型没有配置价格。

**解决：** 进入管理后台 → 模型 → 模型定价，给所有需要使用的模型设置输入和输出价格。

### Q3：用户登录后提示「无权进行此操作，权限不足」

**原因：** 用户角色异常（role=0）。

**解决：** 进入管理后台 → 用户，找到对应用户，将角色修改为「普通用户」（role=1）。

### Q4：支付时提示「域名没过白」

**原因：** 支付域名未在易支付平台添加白名单。

**解决：** 登录易支付商户后台，在域名管理中添加你的域名，等待审核通过。

### Q5：SSH 连接超时/被拒绝

**原因：** 可能触发了服务器的 fail2ban 防护，或 SSH 服务异常。

**解决：**
- 等待一段时间（通常 10-30 分钟自动解封）
- 通过云服务商的 VNC/控制台登录服务器
- 检查 fail2ban 状态：`fail2ban-client status sshd`
- 解封 IP：`fail2ban-client set sshd unbanip 你的IP`

### Q6：流式输出卡顿或中断

**原因：** Nginx 缓冲或超时设置问题。

**解决：** 在 Nginx 配置中添加：
```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 300s;
```

### Q7：数据库锁定（SQLite busy）

**原因：** SQLite 并发写入限制，用户量较大时容易出现。

**解决：** 切换到 MySQL 数据库，在 docker-compose.yml 中添加 SQL_DSN 环境变量。

### Q8：忘记管理员密码

**解决：**
```bash
# 进入容器
docker exec -it new-api bash

# 重置 root 密码为 123456
./new-api --reset-root-password

# 退出容器
exit

# 重启容器
docker restart new-api
```

---

## 进阶配置

### 使用 MySQL 数据库

当用户量较大时，建议使用 MySQL 替代 SQLite：

1. 安装 MySQL 并创建数据库
2. 在 docker-compose.yml 中添加环境变量：
```yaml
environment:
  - SQL_DSN=用户名:密码@tcp(127.0.0.1:3306)/数据库名?charset=utf8mb4&parseTime=True&loc=Local
```
3. 重启容器

### 配置内容审核

为防止用户输入违规内容导致上游 API 被封，可以配置内容审核：

1. 部署一个内容审核服务（可基于讯飞星火、智谱 GLM 等免费模型）
2. 在 New API 前部署反向代理，对用户输入进行前置审核
3. 违规内容直接拦截，不转发到上游

### 配置完整日志

New API 默认只记录 token 用量，不记录对话内容。如需完整日志：

1. 部署独立的日志记录服务
2. 通过反向代理在请求转发前记录用户输入和模型输出
3. 日志包含：用户 ID、时间、模型、输入内容、输出内容、token 用量

### 定时备份

```bash
# 创建备份脚本 /opt/new-api/backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/new-api/backups

mkdir -p $BACKUP_DIR

# 备份数据库
cp /opt/new-api/data/one-api.db $BACKUP_DIR/one-api_$DATE.db

# 保留最近 30 天的备份
find $BACKUP_DIR -name "*.db" -mtime +30 -delete

echo "备份完成: $BACKUP_DIR/one-api_$DATE.db"
```

添加定时任务：
```bash
chmod +x /opt/new-api/backup.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/new-api/backup.sh") | crontab -
```

---

## 参考链接

- GitHub 仓库：https://github.com/QuantumNous/new-api
- 官方文档：https://docs.newapi.ai
- Docker Hub：https://hub.docker.com/r/calciumion/new-api
- One API（上游项目）：https://github.com/songquanpeng/one-api

---

**免责声明：** 本教程仅供学习交流使用，请遵守相关法律法规和所使用大模型平台的服务条款，不得用于违法违规用途。
