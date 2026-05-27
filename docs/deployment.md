# 服务器部署与更新文档

## 当前生产部署（Coolify 管理）

2026-05-26 已将服务迁移到新服务器，并接入 Coolify 管理。当前对上游暴露的生产入口为：

| 项目 | 值 |
|------|-----|
| Base URL | `http://192.129.209.36:3001/v1` |
| 管理面板 | `http://192.129.209.36:3001` |
| Coolify 面板 | `http://192.129.209.36:8000` |
| Coolify 资源名 | `new-api-video-gateway` |
| Coolify UUID | `jssc8c4sc4gk80oo84ks480w` |
| Coolify 项目/环境 | `My first project / production` |
| 容器名 | `new-api-jssc8c4sc4gk80oo84ks480w` |
| 镜像 | `new-api-local:coolify` |
| 运行状态 | `running:healthy` |

### 新服务器信息

| 项目 | 值 |
|------|-----|
| 公网 IP | `192.129.209.36` |
| SSH 端口 | `22` |
| SSH 账号 | `root` |
| 系统 | Ubuntu 24.04 / Linux 6.8 |
| 磁盘 | 约 96G，部署时剩余约 76G |
| 内存 | 约 5.8GiB + 3GiB swap |
| 服务端口 | `3001 -> 3000` |

SSH 连接：

```bash
ssh root@192.129.209.36
```

本地私有连接备忘录存放在 `docs/deployment.local.md`，该文件已通过 `.gitignore` 排除，不提交到远端。

### Coolify 管理的运行架构

```
服务器 (192.129.209.36)
├── Coolify / Traefik
│   ├── coolify                    # 面板，映射 8000
│   ├── coolify-proxy              # 占用 80/443/8080
│   ├── coolify-db / coolify-redis
│   └── /data/coolify/services/jssc8c4sc4gk80oo84ks480w/
│       ├── docker-compose.yml     # Coolify 生成的 Compose
│       └── .env
├── /opt/new-api-src/              # 当前源码和 Dockerfile
├── /opt/new-api-data/
│   └── one-api.db                 # 从旧服务器迁移的 SQLite 数据库
├── /opt/new-api-logs/             # new-api 日志目录
└── new-api-jssc8c4sc4gk80oo84ks480w
    └── 0.0.0.0:3001 -> 3000/tcp
```

Coolify 使用的 Compose 由 Coolify 资源生成，核心配置如下：

| 配置 | 值 |
|------|-----|
| `build.context` | `/opt/new-api-src` |
| `build.dockerfile` | `Dockerfile` |
| `container_name` | `new-api-jssc8c4sc4gk80oo84ks480w` |
| `SQLITE_PATH` | `/data/one-api.db?_busy_timeout=30000` |
| 数据卷 | `/opt/new-api-data:/data` |
| 日志卷 | `/opt/new-api-logs:/data/logs` |
| `NODE_NAME` | `new-api-racknerd-coolify` |

### 新服务器验证记录

| 时间 | 项目 | 结果 |
|------|------|------|
| 2026-05-26 | HTTP 健康检查 | `GET http://192.129.209.36:3001/api/status` 返回 `success=true` |
| 2026-05-26 | Coolify 管理状态 | `service_applications.status=running:healthy`，容器 label `coolify.managed=true` |
| 2026-05-26 | 真实视频生成 | `grok-video-3` 任务 `task_kTOu1dhTCYZvSYtynESiQQz0rEqlHOjO` 完成 |
| 2026-05-26 | 视频下载 | `/v1/videos/task_kTOu1dhTCYZvSYtynESiQQz0rEqlHOjO/content` 返回 `200 video/mp4`，大小 `868422` 字节 |

### 新服务器常用命令

```bash
# 查看 Coolify 管理的 new-api 容器
docker ps --filter name=new-api --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

# 查看 Coolify 生成的 Compose
sed -n '1,220p' /data/coolify/services/jssc8c4sc4gk80oo84ks480w/docker-compose.yml

# 查看容器日志
docker logs -f new-api-jssc8c4sc4gk80oo84ks480w

# 查看服务健康
curl -sS http://127.0.0.1:3001/api/status

# 查看数据库渠道
sqlite3 /opt/new-api-data/one-api.db "SELECT id, name, type, status, base_url FROM channels ORDER BY id;"
```

> 注意：Coolify API 默认保持关闭。2026-05-26 为自动创建 `new-api-video-gateway` 曾临时开启 API 并创建临时 token；接入完成后已删除 token，并将 `instance_settings.is_api_enabled` 恢复为 `false`。

---

## 旧服务器信息（历史/备用）

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
| `relay/channel/task/openaivideo/qilin.go` | 937qq / 麒麟 API Grok 视频适配 |
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
| 1 | bltcy-veo | 58 (OpenAI Video) | 100 | 开启 | https://api.bltcy.ai | veo2/veo3/veo3.1 视频模型 + MiniMax-Hailuo-02/2.3 |
| 2 | bltcy-openai-v2 | 1 (OpenAI) | 100 | 关闭 | https://api.bltcy.ai | 文本/兼容模型备用 |
| 3 | bltcy-images | 1 (OpenAI) | 100 | 关闭 | https://api.bltcy.ai | nano-banana, gemini image 系列 |
| 4 | apexer-veo | 58 (OpenAI Video) | 50 | 开启 | https://www.aiapexers.com | veo3.1/fast/pro、4K、components |
| 5 | xgapi-veo | 58 (OpenAI Video) | 10 | 开启 | https://xgapi.top | veo3.1-lite, sora-2（账号资源受限，详见已知问题） |
| 6 | apexer-images-openai | 1 (OpenAI) | 60 | 开启 | https://www.aiapexers.com | gemini_3.*_image_preview, gpt-image-2（OpenAI 图片/对话格式） |
| 7 | apexer-images-gemini | 24 (Gemini) | 50 | 开启 | https://www.aiapexers.com | gemini_3.*_image_preview, gpt-image-2（Gemini 原生格式） |
| 8 | qilin-grok-video | 58 (OpenAI Video) | 80 | 开启 | http://www.937qq.cn | grok-imagine-1.0-video, grok-imagine-1.0-video-20s, grok-imagine-1.0-video-30s |
| 9 | xb-sora2 | 58 (OpenAI Video) | 90 | 关闭 | https://open.hongniaoai.com/v1 | xb-sora2, ss-sora-2, sora-2(线路BF), sora-2-pro(线路BF), je-grok, grok-video-3(线路W), 全能视频2.0 等 |
| 10 | runway-explore | 58 (OpenAI Video) | 110 | 关闭 | http://127.0.0.1:8787 | seedance-2, gen4-turbo, wan-2.6-flash, kling-2.5-turbo-standard, gen4.5, happyhorse-1, wan-2.6, kling-2.5-turbo-pro, kling-2.6, wan-2.2-animate |
| 11 | ai-juhe-lk888 | 58 (OpenAI Video) | 35 | 关闭 | https://api.lk888.ai/api | sora-2, grok-video-3 |

### AI 聚合站 / LK888 验证记录

2026-05-24 已接入为 OpenAI Video 类型 58 的 `lk888Provider`。该平台实际能力发现返回 38 个视频模型，但当前仅注册 `sora-2` 与 `grok-video-3` 两个模型；Seedance、Veo、Kling、Vidu、Wan、PixVerse、HappyHorse、Hailuo 等其他模型先不接入。完整调用和参数映射见 [AI 聚合站 / LK888 视频渠道接入文档](./lk888-video-api.md)。

| 能力 | 结果 | 说明 |
|------|------|------|
| 模型发现 | ✅ | `GET https://api.lk888.ai/api/v1/skills/models?type=video` 返回 38 个视频模型 |
| 余额查询 | ✅ | `GET /v1/skills/balance` 可用，测试 key 当前余额为 10.3 算力 |
| Sora 生成 | ✅ | 临时将渠道优先级调到 95 后，通过本项目 `/v1/videos` 提交 `model=sora-2`，任务 `task_Iqqit0P2UcMJAYNbzyrqcK5OrSKSNSXW` 命中渠道 11 并完成；测试后优先级已恢复 35 |
| Sora 下载 | ✅ | `GET /v1/videos/task_Iqqit0P2UcMJAYNbzyrqcK5OrSKSNSXW/content` 返回 `200 OK`，`Content-Type: video/mp4` |
| Grok 生成 | ✅ | 通过本项目 `/v1/videos` 提交 `model=grok-video-3`，任务 `task_mtkqjxwQRWoherMjTEJx0qfyyCPKSeep` 完成 |
| Grok 下载 | ✅ | `GET /v1/videos/task_mtkqjxwQRWoherMjTEJx0qfyyCPKSeep/content` 返回 `200 OK`，`Content-Type: video/mp4` |

LK888 的媒体生成协议与 OpenAI Video 不同：创建任务走 `POST /v1/media/generate`，模型特定参数必须放入 `params` 对象；状态轮询走 `GET /v1/skills/task-status?task_id=...`，以 `is_final` / `state` 判断终态。当前 Provider 会把调用方常见的 `duration` / `seconds`、`orientation` / `aspect_ratio`、`images` / `image` / `input_reference` 转为 LK888 所需的 `params` 格式。

### Runway API 适配器验证记录

2026-05-19 已部署 `runway-api` 为同机私有 systemd 服务：

| 项目 | 结果 | 说明 |
|------|------|------|
| 服务状态 | ✅ | `runway-api` 运行在 `127.0.0.1:8787`，不对公网暴露 |
| Token 状态 | ✅ | 使用 `/root/runway-api/.runwayml-token`，当前 token 到期时间为 2026-06-18 09:44:21 +08:00 |
| 可用性探测 | ✅ | `POST /can-start {"kind":"video","model":"seedance-2"}` 返回 `canStartNewTask=true` |
| new-api 接入 | ✅ | 新增 `runway-explore` 渠道，`other=runway`，通过 `X-API-Key` 调用本机适配器 |
| 模型暴露 | ✅ | `/v1/models` 已返回 Runway 渠道配置的 10 个视频模型 |

Runway 生成任务必须按异步任务使用。new-api 提交到适配器的上游任务 ID 是 runway-api 的本地 `jobId`，轮询走 `GET /jobs/{jobId}`；适配器返回的 `/files/...` 结果会由 new-api 视频代理转发，不直接暴露 `127.0.0.1:8787` 给外部用户。

### Hongniao AI / xb-sora2 验证记录

2026-05-18 已通过远端服务 `http://206.119.182.61/v1/videos` 验证：

| 能力 | 结果 | 说明 |
|------|------|------|
| 模型发现 | ✅ | `GET https://open.hongniaoai.com/v1/models` 返回 11 个真实模型；远端渠道注册 11 个真实模型 + 3 个文档兼容别名 |
| 文生视频 | ✅ | 通过本项目 `/v1/videos` 提交 `model=xb-sora2`，任务 `task_woE206uzgDCVrYTOkPhyyTtVP14GldbP` 完成，`progress=100`，返回视频 URL |
| 参考图字段 | ✅ | Provider 已把统一字段 `images` / `image` / `input_reference` / `image_url` 收敛为 Hongniao 下游 `images` 数组；带 1 张 `images` 参考图的任务 `task_A80f7CbmU4xxDSCn7Xi6fCLGJREpPW0C` 已完成，`progress=100`，返回视频 URL；Hongniao 文档说明最多 5 张 |

Hongniao 的真实服务地址是 `https://open.hongniaoai.com/v1`，不是文档顶部示例里的 `https://localhost:3000/v1`。认证使用 `X-API-Key`。本项目对外仍保持 OpenAI Video 风格的 `/v1/videos` 和 `/v1/videos/{task_id}`，内部 Provider 转发到 Hongniao 的 `/videos/generate` 与 `/videos/{task_id}`。

### 937qq / 麒麟 Grok 视频验证记录

2026-05-15 已通过远端服务 `http://206.119.182.61/v1/videos` 验证：

| 能力 | 结果 | 说明 |
|------|------|------|
| 多参数文生视频 | ✅ | JSON 直传 `seconds=6`、`size=1792x1024`、`quality=standard`，任务 `task_Hf8pVXgoCMlICXLRqIEHPPYbJQ4hIfZ3` 完成 |
| 单参考图 | ✅ | JSON `images` 数组 1 张，使用 base64 红底白圆参考图，任务 `task_RVKBuqOx4q9gWxPg2GWYSPMJv6UcoRyG` 完成；抽帧确认画面保留红底白圆 |
| 首尾帧 | ✅ | JSON `images` 数组 2 张，使用 base64 红圆首帧 + 蓝方块尾帧，任务 `task_9yHZfodDd4tVh6RWScooHkGUY59M6E9W` 完成；抽帧确认从红圆过渡到蓝方块 |

注意：937qq 的 `/v1/videos` 支持 JSON 请求体，`images` 必须保持数组格式直传；不要转换成 multipart 表单字符串。2026-05-16 对照下载目录里的 `video_plugin_麒麟API_v1.1.9` 后确认，麒麟插件实际会把参考图转成 grok2api 风格的 `image_reference`。当前 Qilin Provider 已在内部把上游的 `images` / `image` / `image_urls` / `reference_images` / `reference_image_urls` / `image_url` / `file_paths` 自动补成 `image_reference`，上游仍统一传 `images`。

2026-05-15 追加验证复杂医生参考图请求：

| 请求 | 结果 | 说明 |
|------|------|------|
| 仅传 `aspect_ratio=9:16` | ⚠️ | 任务 `task_TdDRc6FZeTOBvSWqWZS38zJ63OcKrBPp` 完成，但输出 688×464 横图，且人物身份未按参考图锁定 |
| 追加 `size=1024x1792` | ⚠️ | 任务 `task_iXjVIOUQei52gllPz8CwpJ49tok2YSMR` 完成，输出 464×688 竖图，但不是严格 9:16，人物身份仍未锁定 |

处理策略：Qilin Provider 会把调用方的 `aspect_ratio=9:16` 自动补成 `size=720x1280`，`aspect_ratio=16:9` 自动补成 `size=1280x720`，`aspect_ratio=1:1` 自动补成 `size=1024x1024`。`ratio` 字段按同一规则兼容。2026-05-20 对照 `video_plugin_麒麟API_v1.1.12` 后，`4:3`、`3:4`、`21:9` 也按插件映射补成 `1152x864`、`864x1152`、`1680x720`，但这三个比例还没有完成生产视频抽检。这能提升方向命中率，但 937qq/Grok 对人物身份一致性和严格画幅比例仍是软约束。

部署后回归：任务 `task_e50dCra8ZpNeaOTN21rFw36ArEAZSG06` 仅传 `aspect_ratio=9:16` 未显式传 `size`，输出 464×688 竖图，确认内部映射生效。

2026-05-15 追加比例矩阵测试：

| 请求参数 | 任务 | 结果 |
|----------|------|------|
| `aspect_ratio=9:16`（内部补 `size=1024x1792` 的旧映射） | `task_AwJVEUNCWCPhFgHhltKL4GgqWm7bhfk6` | 输出 464×688，约 2:3 |
| `size=1024x1792` | `task_e4Fa20yw4fviFLGGIwsxwy7eOzBUP8fI` | 输出 464×688，约 2:3 |
| `size=720x1280` | `task_VUWyg8YNg8B1v0dzSeaUCVziqfjLlSNw` | 输出 416×752，接近 9:16 |
| `size=1280x720` | `task_6xUfdSHpbEep7xk9ixLx2jsA0U1KY8dV` | 输出 752×416，接近 16:9 |
| `size=1080x1920` | - | 400 拒绝 |
| `size=576x1024` | - | 400 拒绝 |

基于矩阵测试，内部映射已从 `1024x1792` / `1792x1024` 改为 `720x1280` / `1280x720`。

结合 xAI 官方文档和新版麒麟插件，Grok Imagine 视频原生参数是 `duration`、`aspect_ratio`、`resolution`。Qilin Provider 现在会让 `seconds` 和 `duration` 互补，默认补 `resolution=720p`，并按 `resolution` 补 937qq/Grok 原生 `quality` 字段。`grok-imagine-1.0-video` 传 20 / 30 秒时会自动改用下游传输模型 `grok-imagine-1.0-video-20s` / `grok-imagine-1.0-video-30s`；直接请求这两个模型时会锁定对应时长。

同一复杂医生参考图 query 的多比例复测（2026-05-15）：

| 请求比例 | 任务 | 输出尺寸 | 结论 |
|----------|------|----------|------|
| `9:16` | `task_YQuoXWC21lI0fcP4zY9Ot4rpsfzO4YrM` | 416×752 | 接近 9:16，竖屏有效 |
| `16:9` | `task_6865jHA2i9bCQxaXJFG2OC3dLEkAB1fU` | 752×416 | 接近 16:9，横屏有效 |
| `1:1` | `task_PI8UQctgkRTUBmwx5814KAuH2ZFzkmSh` | 688×464 | 未按 1:1，落到默认横屏 |
| `2:3` | `task_NIQcraAEhz7gC5QpomT1bo6SzfXWJv41` | 688×464 | 未按 2:3，落到默认横屏 |
| `3:2` | `task_3weOBgVkdI02WLENxzpL13SWN2tQNL3N` | 688×464 | 未按 3:2，落到默认横屏 |
| `3:4` | `task_WsNdQrTNhz7VHG0ter4uVU5jyNHXuOno` | 688×464 | 未按 3:4，落到默认横屏 |
| `4:3` | `task_KnOMhWcX8GA3RsjxFlBWNNWY3QCgi2jU` | 688×464 | 未按 4:3，落到默认横屏 |

结论：937qq/Grok 当前在本服务路径下只验证出 `9:16` 和 `16:9` 两个方向有效；官方其他比例桶没有被下游兼容层正确映射。

2026-05-16 部署后参考图转换回归：

| 请求 | 任务 | 输出尺寸 | 结论 |
|------|------|----------|------|
| 只传上游统一字段 `images`，由 Qilin Provider 自动补 `image_reference` | `task_QFcwttd20S49mJUdM9Y7wTDNM5XhBdtM` | 720×1280 | 抽帧确认参考图身份、黑色服装、诊室场景和指膝腿动作生效 |
| `aspect_ratio=1:1`，由 Qilin Provider 自动补 `size=1024x1024` | `task_EocEzfLxfQGPZ04Y7nYKgga7l0hYnpZ6` | 960×960 | 方形比例生效，抽帧确认居中绿球画面正常 |
| 用户真实医生讲解 query 参考图优先改造 | `task_k6Id9R1pS3LbK22GHLLnDbUHFVPfsF5x` | 720×1280 | 抽帧确认灰发老年女性、黑色中式服装、诊室环境和指背/指脸/指膝腿动作保留较好 |

比例当前结论：调用方优先传结构化参数，不要只写在 prompt 中。竖屏传 `aspect_ratio=9:16` 或 `size=720x1280`；横屏传 `aspect_ratio=16:9` 或 `size=1280x720`；方形传 `aspect_ratio=1:1` 或 `size=1024x1024`。`4:3`、`3:4`、`21:9` 已按新版插件映射透传，但暂不做生产视频效果承诺。

### Apexer 图片接口策略

Apexer 图片生成同时支持 Google 原生格式和 OpenAI 兼容格式，本服务拆成两个渠道以保持上游入口统一：

| 上游入口 | 渠道 | 说明 |
|----------|------|------|
| `/v1beta/models/{model}:generateContent` | `apexer-images-gemini` | 透传 Gemini 原生 `contents` / `generationConfig.imageConfig` |
| `/v1/chat/completions` | `apexer-images-openai` | OpenAI 对话格式，支持多张 `image_url` 参考图 |
| `/v1/images/generations` | `apexer-images-openai` | OpenAI 图片格式，支持单张 `image` 参考图 |

`/v1/images/generations` 的 `extra_body.google.image_config` 已在后端保留并透传，用于 Apexer 的 `aspect_ratio` / `image_size` 参数控制。

### 渠道优先级策略

当前视频生成的优先级策略：

1. **第一优先级：bltcy / 柏拉图**，`priority=100`
2. **Grok 专用：937qq / 麒麟 API**，建议 `priority=80`，注册 `grok-imagine-1.0-video`、`grok-imagine-1.0-video-20s`、`grok-imagine-1.0-video-30s`
3. **第二优先级：Apexer**，`priority=50`
4. **其他平台：兜底**，建议 `priority=10`

系统配置：

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| RetryTimes | 2 | 单次提交失败后最多重试 2 次，可覆盖 3 个优先级层级 |
| AutomaticDisableChannelEnabled | true | 渠道连续失败时自动禁用 |
| AutomaticEnableChannelEnabled | true | 渠道恢复后自动启用 |

Apexer 的 OpenAI 视频格式模型名与本服务对外模型名不同，当前通过渠道 `model_mapping` 做转换：

```json
{
  "veo3.1": "veo3.1_relaxed",
  "veo3.1-fast": "veo3.1_fast",
  "veo3.1-pro": "veo3.1_pro",
  "veo3.1-4k": "veo3.1_relaxed_4k",
  "veo3.1-fast-4k": "veo3.1_fast_4k",
  "veo3.1-pro-4k": "veo3.1_pro_4k",
  "veo3.1-components": "veo3.1_relaxed",
  "veo3.1-fast-components": "veo3.1_fast",
  "veo3.1-components-4k": "veo3.1_relaxed_4k",
  "veo3.1-fast-components-4k": "veo3.1_fast_4k"
}
```

Apexer 新版 `/v1/videos` 需要 `type` 参数；本服务在 Provider 层自动推断并补齐：

| 调用方请求 | Apexer type |
|-----------|-------------|
| 不传 `images` | 1（文生视频） |
| 传 1-2 张 `images` | 2（首帧/首尾帧） |
| components 模型或 3 张 `images` | 3（垫图参考） |

调用方不需要显式传 Apexer 的 `type`，也不需要知道下游模型名使用下划线。

自动故障转移已验证（2026-05-13）：

1. `veo3.1-fast` 在 bltcy 侧因上游 BUG 返回 503 → 自动重试落到 Apexer #4，生成 1280×720 视频成功（82s，扣 1,200,000 额度）。
2. `MiniMax-Hailuo-02` 直接走 bltcy #1，108s 生成 1366×768 视频成功（扣 1,600,000 额度）。
3. Apexer 余额已于 2026-05-12 充值，恢复可用。

---

## 已知问题

1. **bltcy 上游 `.→_` 路由 BUG（高优先）**：bltcy 内部 distributor 在模型名查找前会把 `.` 替换为 `_`，但其注册表里的同名条目并未做对应处理，导致 `veo3.1*` / `sora-2` 等含点号或形如 `sora-2` 的模型在 bltcy 上游均返回 `model_not_found: veo_3_1-* / sora_2`。当前对策：
   - **无点号视频模型走 bltcy**：`MiniMax-Hailuo-02`、`MiniMax-Hailuo-2.3*`、`doubao-seedance-*` 等可直接生成。
   - **`veo3.1*` 走 Apexer**：通过 RetryTimes=2 自动从 bltcy → Apexer 故障转移；Apexer 模型名映射在渠道 `model_mapping` 内（`veo3.1`→`veo3.1_relaxed` 等）。
2. **xgapi 账号资源受限**：xgapi #5 已配置但当前账号：
   - `veo3.1-lite` 在 xgapi 内部也存在 `.→_` 距离形变（`veo_3_1-lite`），返回 `无可用渠道（distributor）`。
   - `sora-2` 模型可达后端但其 sora 反代会话获取失败（`无法获取有效的 SessionID 尝试了 6 次`）。
   - 暂作占位/兜底，不建议放主路径。
3. **gemini-3.1-flash-image-preview 渠道选择异常**：该模型在渠道中已配置，缓存中也能找到，但请求时偶尔报"无可用渠道"。建议使用 `nano-banana-pro` 或 `gemini-3-pro-image-preview` 替代。
4. **web/classic dist 为空（上游兼容性）**：`web/classic/src/index.jsx:23` 显式导入 `@douyinfe/semi-ui/dist/css/semi.css`，但当前 `@douyinfe/semi-ui@2.97.0` 的 `package.json` `exports` 字段不再暴露该深路径，Vite 构建失败 → `dist/index.html` 为 0 字节。生产二进制嵌入的就是这个空文件。由于主使用 default 主题，不影响业务，但访问 `/?theme=classic` 会拿到空 HTML。修复路径：删除该冗余 import（`vitePluginSemi({cssLayer:true})` 本来就会接管 semi 样式）。
5. **4G 内存构建风险**：服务器只有 4G 内存，前端构建时可能 OOM。已添加 4G Swap 作为保护，但构建速度会变慢。**当前流程已固定为本地 cross-compile + rsync 二进制**，避开服务器构建。

---

## 后续优化建议

1. **绑定域名 + HTTPS**：使用 Let's Encrypt 免费证书
2. **安装 Redis**：提升缓存性能，`apt install redis && systemctl enable redis`
3. **切换 PostgreSQL**：流量增长后可升级数据库
4. **添加更多中转站**：在 Provider 模式下，只需在 `relay/channel/task/openaivideo/` 下新增一个 provider 文件即可
