# New API 部署指南（避坑记录）

> 记录日期：2026-01-30
> 部署环境：Windows 11 本地开发 → Debian 12 服务器

## 部署方式

本项目采用**本地编译 + 上传可执行文件**的方式部署，而非 Docker 镜像。

### 为什么选择这种方式？

| 方式 | 优点 | 缺点 |
|------|------|------|
| Docker 官方镜像 | 一键部署，简单 | 无法使用自定义修改的代码 |
| **本地编译上传** | 可部署自定义版本 | 需要手动处理依赖 |

## 遇到的问题及解决方案

### 1. SSH 密钥加载失败

**错误信息：**
```
Load key "xxx/id_ed25519": error in libcrypto
```

**原因：** Windows 系统的 SSH 密钥文件包含 CRLF 行尾符（`\r\n`），Linux 只认 LF（`\n`）。

**解决方案：**
```bash
# 去除 Windows 行尾符
cat /path/to/id_ed25519 | tr -d '\r' > /tmp/fixed_key
chmod 600 /tmp/fixed_key
ssh -i /tmp/fixed_key user@server
```

---

### 2. 编译成了 Windows 可执行文件

**错误信息：**
```
/www1/new-api/new-api: cannot execute binary file: Exec format error
```

**原因：** 在 Windows 上直接运行 `go build`，默认编译成 Windows PE 格式。

**解决方案：** 必须设置交叉编译环境变量：
```bash
# 正确的 Linux 编译命令
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "-s -w" -o new-api-linux .
```

**验证方法：**
```bash
file new-api-linux
# 应显示：ELF 64-bit LSB executable, x86-64
# 而不是：PE32+ executable (console) x86-64, for MS Windows
```

---

### 3. 前端组件缺少导入导致黑屏

**错误信息：**
```
ReferenceError: Space is not defined
```

**原因：** 某些组件使用了 `<Space>` 但忘记从 `@douyinfe/semi-ui` 导入。

**受影响文件：**
- `web/src/pages/Setting/Payment/SettingsPaymentGatewayCreem.jsx`
- `web/src/pages/Setting/Ratio/UpstreamRatioSync.jsx`

**解决方案：** 在导入语句中添加 `Space`：
```jsx
import {
  Button,
  // ... 其他组件
  Space,  // 添加这行
} from '@douyinfe/semi-ui';
```

**预防措施：**
- 使用 ESLint 的 `no-undef` 规则
- 提交前运行 `bun run build` 检查是否有错误

---

### 4. 上传文件时服务正在运行

**错误信息：**
```
scp: dest open "/www1/new-api/new-api": Failure
```

**原因：** Linux 下正在运行的可执行文件无法被覆盖。

**解决方案：** 先停止服务再上传：
```bash
ssh user@server "systemctl stop new-api"
scp new-api-linux user@server:/www1/new-api/new-api
ssh user@server "chmod +x /www1/new-api/new-api && systemctl start new-api"
```

---

## 完整部署流程

### 前置条件

- 本地安装 Go 1.20+
- 本地安装 Bun（用于前端构建）
- 服务器安装 Docker（用于 PostgreSQL 和 Redis）

### 步骤

```bash
# 1. 构建前端
cd web
bun install
bun run build

# 2. 编译后端（Linux 版本）
cd ..
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "-s -w" -o new-api-linux .

# 3. 上传到服务器
ssh user@server "systemctl stop new-api 2>/dev/null; mkdir -p /www1/new-api/logs"
scp new-api-linux user@server:/www1/new-api/new-api
ssh user@server "chmod +x /www1/new-api/new-api"

# 4. 首次部署：启动数据库
ssh user@server << 'EOF'
docker run -d \
  --name new-api-postgres \
  --restart always \
  -e POSTGRES_USER=newapi \
  -e POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD \
  -e POSTGRES_DB=newapi \
  -p 127.0.0.1:5433:5432 \
  -v /www1/new-api/pg_data:/var/lib/postgresql/data \
  postgres:15

docker run -d \
  --name new-api-redis \
  --restart always \
  -p 127.0.0.1:6380:6379 \
  redis:latest
EOF

# 5. 创建启动脚本
ssh user@server << 'EOF'
cat > /www1/new-api/start.sh << 'SCRIPT'
#!/bin/bash
cd /www1/new-api
export SQL_DSN="postgresql://newapi:YOUR_SECURE_PASSWORD@127.0.0.1:5433/newapi"
export REDIS_CONN_STRING="redis://127.0.0.1:6380"
export TZ=Asia/Shanghai
exec ./new-api --port 9527 --log-dir /www1/new-api/logs
SCRIPT
chmod +x /www1/new-api/start.sh
EOF

# 6. 创建 systemd 服务
ssh user@server << 'EOF'
cat > /etc/systemd/system/new-api.service << 'SERVICE'
[Unit]
Description=New API Service
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/www1/new-api
ExecStart=/www1/new-api/start.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE
systemctl daemon-reload
systemctl enable new-api
systemctl start new-api
EOF
```

---

## 常用运维命令

```bash
# 查看服务状态
systemctl status new-api

# 查看日志
tail -f /www1/new-api/logs/*.log
journalctl -u new-api -f

# 重启服务
systemctl restart new-api

# 数据库备份
docker exec new-api-postgres pg_dump -U newapi newapi > backup_$(date +%Y%m%d).sql
```

---

## 目录结构

```
/www1/new-api/
├── new-api          # 可执行文件
├── start.sh         # 启动脚本
├── logs/            # 日志目录
└── pg_data/         # PostgreSQL 数据目录
```
