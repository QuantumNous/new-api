# 服务器部署与更新文档

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务商 | 衡天云 |
| 区域 | 日本/东京一区 |
| 配置 | 2C4G + 50G SSD |
| 系统 | Debian 12 |
| 公网 IP | 206.119.182.61 |
| SSH 端口 | 38554 |
| SSH 账号 | root |
| 服务端口 | 80 (HTTP) |

---

## 本地代码改动清单

以下文件是相对于上游 new-api 项目的自定义改动：

### 新增文件

| 文件 | 说明 |
|------|------|
| `relay/channel/task/openaivideo/adaptor.go` | OpenAI Video 任务适配器主文件 |
| `relay/channel/task/openaivideo/provider.go` | Provider 接口定义 + 自动检测逻辑 |
| `relay/channel/task/openaivideo/bltcy.go` | bltcy.ai / ablai.top 中转站适配 |
| `relay/channel/task/openaivideo/xgapi.go` | xgapi.top 中转站适配 |
| `relay/channel/task/openaivideo/newapi.go` | 通用 new-api 实例适配 |
| `relay/channel/task/openaivideo/constants.go` | 模型列表常量 |
| `docs/api-usage.md` | API 调用文档 |
| `docs/deployment.md` | 本文档 |

### 修改文件

| 文件 | 改动说明 |
|------|----------|
| `constant/channel.go` | 新增 `ChannelTypeOpenAIVideo = 58` |
| `relay/relay_adaptor.go` | 注册 openaivideo 任务适配器 |
| `setting/ratio_setting/model_ratio.go` | 新增 Veo/图片模型定价（含上游采购价注释） |
| `web/default/src/features/channels/constants.ts` | 前端新增渠道类型 58 |
| `web/default/src/features/channels/lib/channel-type-config.ts` | 前端渠道配置提示信息 |

---

## 服务器运行架构

```
服务器 (206.119.182.61)
├── /root/new-api/          # 项目源码目录
│   ├── new-api             # 编译好的二进制文件
│   ├── web/default/dist/   # 前端构建产物
│   └── web/classic/dist/   # 经典前端构建产物
├── /data/                  # 数据目录
│   ├── one-api.db          # SQLite 数据库
│   └── logs/               # 日志目录
├── /swapfile               # 4G Swap 分区
└── systemd service         # new-api.service (开机自启)
```

**运行方式：** 直接运行 Go 二进制文件（非 Docker），通过 systemd 管理。

**环境变量（在 /etc/systemd/system/new-api.service 中配置）：**

| 变量 | 值 | 说明 |
|------|-----|------|
| PORT | 80 | HTTP 端口 |
| TZ | Asia/Shanghai | 时区 |
| MEMORY_CACHE_ENABLED | true | 启用内存缓存 |
| BATCH_UPDATE_ENABLED | true | 批量更新 |
| NODE_NAME | new-api-tokyo | 节点名 |

---

## 同步远端代码 & 更新部署

### 方法一：rsync 同步代码 + 服务器编译（推荐）

```bash
# 1. 从本地同步代码到服务器（排除不需要的文件）
rsync -avz \
  -e "sshpass -p 'm0HLTSun1xE4' ssh -o StrictHostKeyChecking=no -p 38554" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='data/' \
  --exclude='logs/' \
  --exclude='.DS_Store' \
  /Users/bytedance/go/src/github.com/new-api/ \
  root@206.119.182.61:/root/new-api/

# 2. SSH 到服务器编译前端
sshpass -p 'm0HLTSun1xE4' ssh -p 38554 root@206.119.182.61
cd /root/new-api
export PATH=$PATH:/usr/local/go/bin:/root/.bun/bin

# 编译 default 前端
cd web/default && bun install && DISABLE_ESLINT_PLUGIN=true bun run build && cd ../..

# 编译 classic 前端
cd web/classic && bun install && VITE_REACT_APP_VERSION=$(cat ../../VERSION) bun run build && cd ../..

# 编译 Go 后端
CGO_ENABLED=0 GOEXPERIMENT=greenteagc go build -ldflags "-s -w" -o new-api .

# 重启服务
systemctl restart new-api
```

### 方法二：一键更新脚本

在本地创建快捷脚本：

```bash
#!/bin/bash
# deploy.sh - 一键部署脚本

SSH_HOST="root@206.119.182.61"
SSH_PORT="38554"
SSH_PASS="m0HLTSun1xE4"
LOCAL_DIR="/Users/bytedance/go/src/github.com/new-api/"
REMOTE_DIR="/root/new-api/"

echo "=== 1. 同步代码 ==="
sshpass -p "$SSH_PASS" rsync -avz \
  -e "ssh -o StrictHostKeyChecking=no -p $SSH_PORT" \
  --exclude='.git' --exclude='node_modules' \
  --exclude='data/' --exclude='logs/' --exclude='.DS_Store' \
  "$LOCAL_DIR" "$SSH_HOST:$REMOTE_DIR"

echo "=== 2. 编译 & 重启 ==="
sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no -p $SSH_PORT "$SSH_HOST" << 'REMOTE_SCRIPT'
export PATH=$PATH:/usr/local/go/bin:/root/.bun/bin
cd /root/new-api

# 前端
cd web/default && bun install && DISABLE_ESLINT_PLUGIN=true bun run build && cd ../..
cd web/classic && bun install && VITE_REACT_APP_VERSION=$(cat ../../VERSION 2>/dev/null || echo "dev") bun run build && cd ../..

# 后端
CGO_ENABLED=0 GOEXPERIMENT=greenteagc go build -ldflags "-s -w" -o new-api .

# 重启
systemctl restart new-api
sleep 3
systemctl status new-api --no-pager | head -10
REMOTE_SCRIPT

echo "=== 部署完成 ==="
```

---

## 服务器管理命令

```bash
# SSH 连接
sshpass -p 'm0HLTSun1xE4' ssh -o StrictHostKeyChecking=no -p 38554 root@206.119.182.61

# 查看服务状态
systemctl status new-api

# 重启服务
systemctl restart new-api

# 停止服务
systemctl stop new-api

# 查看实时日志
journalctl -u new-api -f

# 查看最近 50 行日志
journalctl -u new-api -n 50 --no-pager

# 查看文件日志
tail -f /data/logs/*.log

# 查看数据库
sqlite3 /data/one-api.db "SELECT id, name, status FROM channels;"

# 查看内存使用
free -h

# 查看磁盘使用
df -h /
```

---

## 管理面板

| 项目 | 值 |
|------|-----|
| 地址 | http://206.119.182.61/ |
| 用户名 | admin |
| 密码 | Admin@2026 |

---

## 已配置的渠道

| 渠道 ID | 名称 | 类型 | 优先级 | AutoBan | 上游 | 主要模型 |
|---------|------|------|--------|---------|------|----------|
| 1 | bltcy-veo | 58 (OpenAI Video) | 100 | 开启 | https://api.bltcy.ai | veo2/veo3/veo3.1 视频模型，含 frames/components |
| 2 | bltcy-openai-v2 | 1 (OpenAI) | 100 | 关闭 | https://api.bltcy.ai | 文本/兼容模型备用 |
| 3 | bltcy-images | 1 (OpenAI) | 100 | 关闭 | https://api.bltcy.ai | nano-banana, gemini image 系列 |
| 4 | apexerapi-veo | 58 (OpenAI Video) | 50 | 开启 | https://apexerapi.top | veo3.1, veo3.1-fast, veo3.1-pro |

### 渠道优先级策略

当前视频生成的优先级策略：

1. **第一优先级：bltcy / 柏拉图**，`priority=100`
2. **第二优先级：apexerapi**，`priority=50`
3. **其他平台：兜底**，建议 `priority=10`

系统配置：

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| RetryTimes | 2 | 单次提交失败后最多重试 2 次，可覆盖 3 个优先级层级 |
| AutomaticDisableChannelEnabled | true | 渠道连续失败时自动禁用 |
| AutomaticEnableChannelEnabled | true | 渠道恢复后自动启用 |

apexerapi 的模型名与本服务对外模型名不同，当前通过渠道 `model_mapping` 做转换：

```json
{
  "veo3.1": "veo3.1_relaxed",
  "veo3.1-fast": "veo3.1_fast",
  "veo3.1-pro": "veo3.1_pro"
}
```

自动故障转移已验证：

1. 正常情况下 `veo3.1-fast` 走 bltcy 渠道。
2. 禁用 bltcy 后，同一模型会自动切换到 apexerapi 渠道。
3. apexerapi 当前账号余额不足时会返回上游额度错误，说明路由已正确到达 apexerapi，但需要给 apexerapi 账号充值后才能实际生成。

---

## 已知问题

1. **apexerapi 余额不足**：故障转移路由已验证成功，但 apexerapi 账号当前余额不足，需要充值后才能作为稳定备用渠道使用。
2. **gemini-3.1-flash-image-preview 渠道选择异常**：该模型在渠道中已配置，缓存中也能找到，但请求时偶尔报"无可用渠道"。建议使用 `nano-banana-pro` 或 `gemini-3-pro-image-preview` 替代。
3. **4G 内存构建风险**：服务器只有 4G 内存，前端构建时可能 OOM。已添加 4G Swap 作为保护，但构建速度会变慢。建议优先在本地编译后上传二进制文件。

---

## 后续优化建议

1. **绑定域名 + HTTPS**：使用 Let's Encrypt 免费证书
2. **安装 Redis**：提升缓存性能，`apt install redis && systemctl enable redis`
3. **切换 PostgreSQL**：流量增长后可升级数据库
4. **添加更多中转站**：在 Provider 模式下，只需在 `relay/channel/task/openaivideo/` 下新增一个 provider 文件即可
