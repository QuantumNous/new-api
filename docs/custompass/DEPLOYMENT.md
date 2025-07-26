# CustomPass 部署指南

本文档提供CustomPass渠道在生产环境中的完整部署指南，包括系统要求、安装步骤、配置优化和运维管理。

## 系统要求

### 硬件要求

#### 最低配置
- **CPU**: 2核心
- **内存**: 4GB RAM
- **存储**: 20GB SSD
- **网络**: 100Mbps

#### 推荐配置
- **CPU**: 4核心以上
- **内存**: 8GB RAM以上
- **存储**: 50GB SSD以上
- **网络**: 1Gbps以上

#### 生产环境配置
- **CPU**: 8核心以上
- **内存**: 16GB RAM以上
- **存储**: 100GB SSD以上
- **网络**: 10Gbps以上

### 软件要求

#### 操作系统
- **Linux**: Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **容器**: Docker 20.10+ / Kubernetes 1.20+

#### 数据库
- **PostgreSQL**: 12.0+（推荐14.0+）
- **Redis**: 6.0+（可选，用于缓存）

#### 运行时
- **Go**: 1.19+（如果从源码编译）
- **Node.js**: 16+（前端构建）

## 部署架构

### 单机部署

```
┌─────────────────────────────────────┐
│            Load Balancer            │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│            New API Server           │
│  ┌─────────────────────────────────┐│
│  │        CustomPass Module        ││
│  │  ┌─────────────────────────────┐││
│  │  │     Polling Service         │││
│  │  └─────────────────────────────┘││
│  └─────────────────────────────────┘│
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│           PostgreSQL DB             │
└─────────────────────────────────────┘
```

### 集群部署

```
┌─────────────────────────────────────┐
│            Load Balancer            │
└─────┬───────────────────────────┬───┘
      │                           │
┌─────▼─────┐               ┌─────▼─────┐
│ API Node 1│               │ API Node 2│
│ CustomPass│               │ CustomPass│
└─────┬─────┘               └─────┬─────┘
      │                           │
      └─────┬───────────────┬─────┘
            │               │
      ┌─────▼─────┐   ┌─────▼─────┐
      │PostgreSQL │   │   Redis   │
      │  Primary  │   │  Cluster  │
      └───────────┘   └───────────┘
```

## 安装部署

### 方式一：Docker部署

#### 1. 准备Docker Compose文件

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: newapi
      POSTGRES_USER: newapi
      POSTGRES_PASSWORD: your-secure-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  newapi:
    image: newapi:latest
    environment:
      # 数据库配置
      SQL_DSN: postgres://newapi:your-secure-password@postgres:5432/newapi?sslmode=disable
      REDIS_CONN_STRING: redis://redis:6379
      
      # CustomPass配置
      CUSTOM_PASS_POLL_INTERVAL: 30
      CUSTOM_PASS_TASK_TIMEOUT: 15
      CUSTOM_PASS_MAX_CONCURRENT: 100
      CUSTOM_PASS_BATCH_SIZE: 50
      CUSTOM_PASS_HEADER_KEY: X-Custom-Token
      
      # 性能配置
      CUSTOM_PASS_DB_MAX_OPEN_CONNS: 50
      CUSTOM_PASS_DB_MAX_IDLE_CONNS: 20
      CUSTOM_PASS_HTTP_TIMEOUT: 60s
      
      # 监控配置
      ENABLE_METRICS: true
      METRICS_PORT: 9090
      
    ports:
      - "3000:3000"
      - "9090:9090"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs
      - ./config:/app/config
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### 2. 初始化数据库

```sql
-- init.sql
-- CustomPass相关表结构已包含在主数据库迁移中
-- 这里添加CustomPass特定的索引优化

-- 优化CustomPass任务查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_custompass_polling 
ON tasks (platform, status, updated_at) 
WHERE platform = 'custompass' 
AND status IN ('submitted', 'processing', 'in_progress');

-- 优化用户quota查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_quota_custompass 
ON users (id, quota, used_quota) 
WHERE quota > 0;

-- 优化日志查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_custompass 
ON logs (channel_id, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '30 days';
```

#### 3. 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f newapi
```

### 方式二：Kubernetes部署

#### 1. 创建命名空间

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: newapi
```

#### 2. 配置ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: newapi-config
  namespace: newapi
data:
  # CustomPass配置
  CUSTOM_PASS_POLL_INTERVAL: "30"
  CUSTOM_PASS_TASK_TIMEOUT: "15"
  CUSTOM_PASS_MAX_CONCURRENT: "200"
  CUSTOM_PASS_BATCH_SIZE: "100"
  CUSTOM_PASS_HEADER_KEY: "X-Custom-Token"
  
  # 性能配置
  CUSTOM_PASS_DB_MAX_OPEN_CONNS: "100"
  CUSTOM_PASS_DB_MAX_IDLE_CONNS: "25"
  CUSTOM_PASS_HTTP_TIMEOUT: "60s"
  
  # 监控配置
  ENABLE_METRICS: "true"
  METRICS_PORT: "9090"
```

#### 3. 创建Secret

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: newapi-secret
  namespace: newapi
type: Opaque
data:
  # Base64编码的数据库连接字符串
  SQL_DSN: cG9zdGdyZXM6Ly9uZXdhcGk6cGFzc3dvcmRAcG9zdGdyZXM6NTQzMi9uZXdhcGk=
  REDIS_CONN_STRING: cmVkaXM6Ly9yZWRpczozNjM5
```

#### 4. 部署PostgreSQL

```yaml
# postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: newapi
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:14
        env:
        - name: POSTGRES_DB
          value: newapi
        - name: POSTGRES_USER
          value: newapi
        - name: POSTGRES_PASSWORD
          value: your-secure-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: newapi
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

#### 5. 部署New API

```yaml
# newapi.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: newapi
  namespace: newapi
spec:
  replicas: 3
  selector:
    matchLabels:
      app: newapi
  template:
    metadata:
      labels:
        app: newapi
    spec:
      containers:
      - name: newapi
        image: newapi:latest
        ports:
        - containerPort: 3000
        - containerPort: 9090
        envFrom:
        - configMapRef:
            name: newapi-config
        - secretRef:
            name: newapi-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /api/status
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/status
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: newapi
  namespace: newapi
spec:
  selector:
    app: newapi
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9090
    targetPort: 9090
  type: ClusterIP
```

#### 6. 配置Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: newapi-ingress
  namespace: newapi
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: newapi-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: newapi
            port:
              number: 80
```

#### 7. 部署命令

```bash
# 应用所有配置
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f postgres.yaml
kubectl apply -f newapi.yaml
kubectl apply -f ingress.yaml

# 查看部署状态
kubectl get pods -n newapi
kubectl get services -n newapi
kubectl get ingress -n newapi

# 查看日志
kubectl logs -f deployment/newapi -n newapi
```

### 方式三：传统部署

#### 1. 系统准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要软件
sudo apt install -y wget curl git build-essential

# 创建用户
sudo useradd -m -s /bin/bash newapi
sudo mkdir -p /opt/newapi
sudo chown newapi:newapi /opt/newapi
```

#### 2. 安装PostgreSQL

```bash
# 安装PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 配置数据库
sudo -u postgres psql << EOF
CREATE DATABASE newapi;
CREATE USER newapi WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE newapi TO newapi;
\q
EOF

# 配置PostgreSQL
sudo vim /etc/postgresql/14/main/postgresql.conf
# 修改以下配置：
# shared_buffers = 256MB
# effective_cache_size = 1GB
# work_mem = 4MB
# maintenance_work_mem = 64MB
# max_connections = 200

sudo systemctl restart postgresql
sudo systemctl enable postgresql
```

#### 3. 安装Redis（可选）

```bash
# 安装Redis
sudo apt install -y redis-server

# 配置Redis
sudo vim /etc/redis/redis.conf
# 修改以下配置：
# maxmemory 1gb
# maxmemory-policy allkeys-lru

sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

#### 4. 部署New API

```bash
# 下载二进制文件
cd /opt/newapi
sudo -u newapi wget https://github.com/Calcium-Ion/new-api/releases/latest/download/new-api-linux-amd64
sudo -u newapi chmod +x new-api-linux-amd64
sudo -u newapi ln -s new-api-linux-amd64 new-api

# 创建配置文件
sudo -u newapi cat > /opt/newapi/.env << EOF
# 数据库配置
SQL_DSN=postgres://newapi:your-secure-password@localhost:5432/newapi?sslmode=disable
REDIS_CONN_STRING=redis://localhost:6379

# CustomPass配置
CUSTOM_PASS_POLL_INTERVAL=30
CUSTOM_PASS_TASK_TIMEOUT=15
CUSTOM_PASS_MAX_CONCURRENT=100
CUSTOM_PASS_BATCH_SIZE=50
CUSTOM_PASS_HEADER_KEY=X-Custom-Token

# 性能配置
CUSTOM_PASS_DB_MAX_OPEN_CONNS=50
CUSTOM_PASS_DB_MAX_IDLE_CONNS=20
CUSTOM_PASS_HTTP_TIMEOUT=60s

# 监控配置
ENABLE_METRICS=true
METRICS_PORT=9090
EOF

# 创建日志目录
sudo -u newapi mkdir -p /opt/newapi/logs
```

#### 5. 创建Systemd服务

```bash
# 创建服务文件
sudo cat > /etc/systemd/system/newapi.service << EOF
[Unit]
Description=New API Server with CustomPass
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=newapi
Group=newapi
WorkingDirectory=/opt/newapi
ExecStart=/opt/newapi/new-api
Restart=always
RestartSec=5

# 环境变量
EnvironmentFile=/opt/newapi/.env

# 资源限制
LimitNOFILE=65535
LimitNPROC=65535

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/newapi/logs

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable newapi
sudo systemctl start newapi

# 检查状态
sudo systemctl status newapi
```

## 配置优化

### 数据库优化

#### PostgreSQL配置优化

```sql
-- postgresql.conf 优化配置
shared_buffers = 256MB                    -- 25% of RAM
effective_cache_size = 1GB                -- 75% of RAM
work_mem = 4MB                           -- Per-operation memory
maintenance_work_mem = 64MB              -- Maintenance operations
max_connections = 200                     -- Connection limit
wal_buffers = 16MB                       -- WAL buffer size
checkpoint_completion_target = 0.9       -- Checkpoint target
random_page_cost = 1.1                   -- SSD optimization
effective_io_concurrency = 200           -- SSD optimization

-- 启用查询统计
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

-- 日志配置
log_min_duration_statement = 1000        -- Log slow queries
log_checkpoints = on
log_connections = on
log_disconnections = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

#### 连接池配置（PgBouncer）

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
newapi = host=localhost port=5432 dbname=newapi

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3

# Performance settings
server_reset_query = DISCARD ALL
server_check_delay = 30
server_check_query = SELECT 1
```

### 系统优化

#### Linux内核参数优化

```bash
# /etc/sysctl.conf
# 网络优化
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_max_tw_buckets = 400000

# 内存优化
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# 文件描述符限制
fs.file-max = 2097152

# 应用配置
sudo sysctl -p
```

#### 文件描述符限制

```bash
# /etc/security/limits.conf
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535

# 验证设置
ulimit -n
ulimit -u
```

## 监控和日志

### Prometheus监控

#### 1. 安装Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'newapi'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: /metrics
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
```

#### 2. 配置Grafana仪表板

```json
{
  "dashboard": {
    "title": "CustomPass Performance Dashboard",
    "panels": [
      {
        "title": "CustomPass Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(custompass_requests_total[5m])",
            "legendFormat": "{{type}} - {{status}}"
          }
        ]
      },
      {
        "title": "CustomPass Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(custompass_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "CustomPass Active Tasks",
        "type": "stat",
        "targets": [
          {
            "expr": "custompass_tasks_in_queue",
            "legendFormat": "{{status}}"
          }
        ]
      }
    ]
  }
}
```

### 日志管理

#### 1. 日志配置

```bash
# 创建日志轮转配置
sudo cat > /etc/logrotate.d/newapi << EOF
/opt/newapi/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 newapi newapi
    postrotate
        systemctl reload newapi
    endscript
}
EOF
```

#### 2. 结构化日志

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "component": "custompass",
  "operation": "sync_request",
  "user_id": 123,
  "channel_id": 1,
  "model": "gpt-4",
  "request_id": "req-123456",
  "duration_ms": 1500,
  "status": "success",
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

## 安全配置

### SSL/TLS配置

#### 1. 使用Let's Encrypt

```bash
# 安装Certbot
sudo apt install -y certbot

# 获取证书
sudo certbot certonly --standalone -d api.yourdomain.com

# 配置自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

#### 2. Nginx反向代理

```nginx
# /etc/nginx/sites-available/newapi
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # 安全头
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    # 代理配置
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓冲配置
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # 监控端点
    location /metrics {
        proxy_pass http://127.0.0.1:9090;
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
    }
}
```

### 防火墙配置

```bash
# 配置UFW防火墙
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许必要端口
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 限制数据库访问
sudo ufw allow from 10.0.0.0/8 to any port 5432
sudo ufw allow from 127.0.0.1 to any port 5432

# 查看状态
sudo ufw status verbose
```

## 备份和恢复

### 数据库备份

#### 1. 自动备份脚本

```bash
#!/bin/bash
# /opt/newapi/scripts/backup.sh

BACKUP_DIR="/opt/newapi/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="newapi"
DB_USER="newapi"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 数据库备份
pg_dump -h localhost -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/newapi_$DATE.sql.gz

# 保留最近30天的备份
find $BACKUP_DIR -name "newapi_*.sql.gz" -mtime +30 -delete

# 上传到云存储（可选）
# aws s3 cp $BACKUP_DIR/newapi_$DATE.sql.gz s3://your-backup-bucket/
```

#### 2. 配置定时备份

```bash
# 添加到crontab
sudo -u newapi crontab -e
# 添加：0 2 * * * /opt/newapi/scripts/backup.sh
```

### 恢复流程

```bash
# 停止服务
sudo systemctl stop newapi

# 恢复数据库
gunzip -c /opt/newapi/backups/newapi_20240101_020000.sql.gz | psql -h localhost -U newapi -d newapi

# 启动服务
sudo systemctl start newapi

# 验证恢复
curl -s http://localhost:3000/api/status
```

## 运维管理

### 健康检查

```bash
#!/bin/bash
# /opt/newapi/scripts/health_check.sh

# 检查服务状态
if ! systemctl is-active --quiet newapi; then
    echo "ERROR: New API service is not running"
    exit 1
fi

# 检查API响应
if ! curl -s -f http://localhost:3000/api/status > /dev/null; then
    echo "ERROR: API health check failed"
    exit 1
fi

# 检查数据库连接
if ! pg_isready -h localhost -p 5432 -U newapi > /dev/null; then
    echo "ERROR: Database connection failed"
    exit 1
fi

# 检查CustomPass功能
if ! curl -s -f http://localhost:9090/metrics | grep -q custompass; then
    echo "WARNING: CustomPass metrics not found"
fi

echo "OK: All health checks passed"
```

### 性能监控脚本

```bash
#!/bin/bash
# /opt/newapi/scripts/performance_monitor.sh

# 获取系统资源使用情况
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
MEM_USAGE=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
DISK_USAGE=$(df -h /opt/newapi | awk 'NR==2 {print $5}' | sed 's/%//')

# 获取数据库连接数
DB_CONNECTIONS=$(psql -h localhost -U newapi -d newapi -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='newapi';" | xargs)

# 获取CustomPass任务数量
ACTIVE_TASKS=$(psql -h localhost -U newapi -d newapi -t -c "SELECT count(*) FROM tasks WHERE platform='custompass' AND status IN ('submitted', 'processing');" | xargs)

# 输出监控数据
echo "$(date): CPU=${CPU_USAGE}%, MEM=${MEM_USAGE}%, DISK=${DISK_USAGE}%, DB_CONN=${DB_CONNECTIONS}, TASKS=${ACTIVE_TASKS}"

# 发送告警（如果需要）
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "ALERT: High CPU usage: ${CPU_USAGE}%"
fi

if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
    echo "ALERT: High memory usage: ${MEM_USAGE}%"
fi
```

### 故障排除

#### 常见问题诊断

```bash
# 检查服务状态
sudo systemctl status newapi

# 查看最新日志
sudo journalctl -u newapi -f

# 检查端口占用
sudo netstat -tlnp | grep :3000

# 检查数据库连接
psql -h localhost -U newapi -d newapi -c "SELECT version();"

# 检查CustomPass配置
curl -s http://localhost:3000/api/channel | jq '.data[] | select(.type == 52)'

# 检查CustomPass任务
psql -h localhost -U newapi -d newapi -c "SELECT platform, status, count(*) FROM tasks WHERE platform='custompass' GROUP BY platform, status;"
```

## 升级和维护

### 升级流程

```bash
#!/bin/bash
# /opt/newapi/scripts/upgrade.sh

# 备份当前版本
sudo -u newapi cp /opt/newapi/new-api /opt/newapi/new-api.backup

# 下载新版本
cd /opt/newapi
sudo -u newapi wget https://github.com/Calcium-Ion/new-api/releases/latest/download/new-api-linux-amd64 -O new-api-new

# 停止服务
sudo systemctl stop newapi

# 备份数据库
/opt/newapi/scripts/backup.sh

# 替换二进制文件
sudo -u newapi mv new-api-new new-api
sudo -u newapi chmod +x new-api

# 启动服务
sudo systemctl start newapi

# 验证升级
sleep 10
if curl -s -f http://localhost:3000/api/status > /dev/null; then
    echo "Upgrade successful"
else
    echo "Upgrade failed, rolling back..."
    sudo systemctl stop newapi
    sudo -u newapi mv new-api.backup new-api
    sudo systemctl start newapi
fi
```

### 维护任务

```bash
# 清理过期任务
psql -h localhost -U newapi -d newapi -c "DELETE FROM tasks WHERE platform='custompass' AND created_at < NOW() - INTERVAL '7 days' AND status IN ('completed', 'failed');"

# 清理过期日志
psql -h localhost -U newapi -d newapi -c "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '90 days';"

# 更新统计信息
psql -h localhost -U newapi -d newapi -c "ANALYZE;"

# 重建索引（如果需要）
psql -h localhost -U newapi -d newapi -c "REINDEX DATABASE newapi;"
```

这个部署指南提供了CustomPass在各种环境中的完整部署方案，包括配置优化、监控设置、安全配置和运维管理，确保CustomPass能够在生产环境中稳定高效地运行。