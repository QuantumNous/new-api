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
| 内存 | 约 5.8GiB + 9GiB swap（含 `/swapfile-build` 6GiB 构建辅助 swap） |
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
| 2026-05-28 | upstream 合并 | 合并 origin/main 78 commits（channel 重构、gjson 优化、Claude fcIdx 修复、前端依赖升级等），仅 package.json 有冲突 |
| 2026-05-28 | Docker 重建 | `docker build -t new-api-local:coolify .` 成功，前端 (bun) + 后端 (go) 均编译通过 |
| 2026-05-28 | 容器重启 | Coolify service `running:healthy`，API status `success=true` |
| 2026-05-28 | 全模型回归 | 5 个视频模型真实验证完成（veo3.1-fast, xb-sora2, grok-imagine-1.0-video, ss-sora-2, veo3.1-4k），详见 [api-usage.md](./api-usage.md) |
| 2026-05-28 | Runway 状态 | 确认 Runway 渠道当前未配置，kling-3.0/o3 等新模型已注册在 constants.go 但未暴露给上游 |
| 2026-06-06 | SiliconFlow 图片渠道 | 已部署硅基流动渠道 `siliconflow-images`（channel id `13`，type `40`，base URL `https://api.siliconflow.cn`，group `default`）。模型 `baidu/ERNIE-Image-Turbo`、`Qwen/Qwen-Image`、`Tongyi-MAI/Z-Image`、`Qwen/Qwen-Image-Edit-2509` 已经通过远端 `/v1/images/generations` 或 `/v1/images/edits` 真实请求验证，均返回 HTTP 200 且 `data` 长度为 1。 |
| 2026-06-06 | SiliconFlow 部署备份 | 新增渠道前备份 SQLite 到 `/opt/new-api-data/one-api.db.before-siliconflow-20260606-064135`；API key 仅保存在远端数据库渠道配置中，不写入仓库文档。 |
| 2026-06-06 | upstream 同步部署 | 当前功能分支已 merge `origin/main` 最新提交 `adc390c5f`，解决 4 个冲突后远端 Docker/Coolify 构建成功，镜像 `new-api-local:coolify` 重建完成，容器状态 `healthy`。 |
| 2026-06-06 | 合并后 SiliconFlow 回归 | 远端公网入口复测 4 个 SiliconFlow 模型均返回 HTTP 200、`data` 长度 1 且包含 `url`：`baidu/ERNIE-Image-Turbo` 20.89s、`Qwen/Qwen-Image` 18.76s、`Tongyi-MAI/Z-Image` 12.20s、`Qwen/Qwen-Image-Edit-2509` 24.60s。 |
| 2026-06-07 | 图片路由修复与 xgapi 兜底 | 部署 URL 拼接去重和图片模型分类修复；新增 `xgapi-images`（channel id `14`，type `1`，priority `130`），使用 xgapi `gpt-image-2` 兜底 `gpt-image-2`、`gpt-image-2(线路XF)`、`gr-image-2`、`nano-banana-pro`，并从 Hongniao 视频渠道移除不支持标准 Images 的 `gr-image-2` / `gpt-image-2(线路XF)`。数据库变更前备份到 `/opt/new-api-data/one-api.db.before-image-fallback-20260606-190024`。 |
| 2026-06-07 | 图片模型稳定性回归 | 公网统一入口连续 2 轮验证 `gpt-image-2`、`gpt-image-2(线路XF)`、`gr-image-2`、`nano-banana`、`nano-banana-hd`、`nano-banana-pro`，共 12 次全部 HTTP 200，均返回标准 `data[0].url`。 |
| 2026-06-07 | xgapi 图片比例与参考图兼容 | 部署 xgapi 图片兼容逻辑：直接生图按 `size` / `aspect_ratio` 自动把比例补到上游 prompt；带 `image` / `images` / `referenceImages` 的请求避开 xgapi 直接生图线路并回退 ListenHub。远端复测 `gpt-image-2`：无比例 prompt + `size=1792x1024` 命中 channel 14，HTTP 200，46.33s，PNG `1659x948`；参考图请求命中 channel 12，HTTP 200，45.08s，PNG `2048x2048`。 |
| 2026-06-07 | 近期使用记录巡检 | 远端 `logs` 近 24h：成功消费 77 条，其中 `/v1/images/generations` 73 条、`/v1/images/edits` 4 条；部署后近 30 分钟错误日志 0 条。远端 `tasks` 近 30 天视频任务 121 条：103 成功、18 失败；失败集中在 2026-05-28 及以前的上游 token/429/旧尺寸格式问题，当前未发现新视频失败。 |
| 2026-06-07 | Apexer gpt-image-2 配置修剪 | 生产错误日志显示 `gpt-image-2` 在 Apexer channel 6/7 会触发上游 distributor 503 或 `only imagen models are supported`，已从 `apexer-images-openai` / `apexer-images-gemini` 移除，仅保留 xgapi 直接生图与 ListenHub 参考图 fallback。变更前备份 SQLite 到 `/opt/new-api-data/one-api.db.before-apexer-gpt-image2-prune-20260606-194956`。 |
| 2026-06-07 | 图片/视频生产自测 | 重新验证当前路径：`gpt-image-2` 直接生图 channel 14，46.51s，PNG `1659x948`；`gpt-image-2` 参考图 channel 12，93.63s，PNG `2048x2048`；`Qwen/Qwen-Image-Edit-2509` 编辑 channel 13，29.97s，PNG；`grok-video-3` channel 11 轮询到 `completed`，`/content` 返回 `200 video/mp4`。 |
| 2026-06-11 | quota 冷却机制部署 | 部署渠道 quota 冷却 + 可配置 quota 关键词（`UpstreamQuotaErrorKeywords`）+ 视频任务 quota 转移。生产验证：临时把 channel 12 调回 priority 140，请求 1 命中 12 → 400 → 日志 `channel #12 entered quota cooldown for 10m0s` → 转移 channel 14 成功（46.9s）；请求 2 在冷却期内直接命中 channel 14（53.4s），未再打 12。验证后 channel 12 恢复 priority 40（channels + abilities 双表）。冷却时长由 `QUOTA_ERROR_COOLDOWN_SECONDS` 控制（默认 600 秒）。详见 [channel-failover-review.md](./channel-failover-review.md) 第五节。 |
| 2026-06-10 | upstream 同步部署 | 合并 `origin/main` 最新提交 `59a93cf5c`（27 commits：images API 流式中继、image edit 支持、kimi k2.6 温度归一、模型定价编辑器重构等），仅 `relay/helper/stream_scanner.go` 冲突（保留本分支 `DefaultStreamingTimeout`，采纳上游 128MB SSE buffer）。远端 Docker/Coolify 重建成功，容器 `healthy`。 |
| 2026-06-10 | channel_info 扫描修复 | 合并部署后发现 `model/channel.go` 的 `ChannelInfo.Scan` 对空值（channel 11 `NULL`、channel 14 空字符串）报 `unexpected end of JSON input`，导致 channel 缓存每分钟刷新失败。已修复 Scan 容忍空值并兼容 string 类型；同时把存量空 `channel_info` 归一为 `{}`，变更前备份到 `/opt/new-api-data/one-api.db.before-channel-info-fix-*`。重新部署后观察 4 分钟无该错误。 |
| 2026-06-10 | 合并后图片生成回归 | 公网入口真实验证：`gpt-image-2` `1792x1024` 命中 channel 14，51.3s，PNG `1659x948`；`Qwen/Qwen-Image` 命中 channel 13，20.5s，返回 `url`；修复部署后复测 `gpt-image-2` `1024x1024`，88.7s，PNG `1254x1254`，下载抽检画面与 prompt 一致。生产日志确认 channel 12 余额不足（400）时自动故障转移到 channel 14 成功。 |
| 2026-06-10 | ListenHub 渠道降级 | 渠道 12（listenhub-images）上游 Marswave 余额自 2026-06-07 10:27 起耗尽，此后 3 天该渠道全部请求返回 `400 Insufficient credits`（最后一次成功 2026-06-07 10:17），且实际优先级为 140（高于 xgapi 的 130，文档原记录 120 已过时），导致 gpt-image-2 直接生图每次先空跑一跳。已将优先级降到 40 作兜底，变更前备份到 `/opt/new-api-data/one-api.db.before-listenhub-priority-drop-*`。注意：带参考图的 gpt-image-2 请求会避开 xgapi，ListenHub 是唯一候选——在上游充值前该路径会失败；充值恢复后建议把优先级调回 120。 |
| 2026-06-10 | 横线 gemini-3.x 图片模型修复 | 排查「已知问题 3」根因：`common.ImageGenerationModels` 缺少横线命名 `gemini-3-pro-image-preview` / `gemini-3.1-flash-image-preview`，导致 OpenAI 类型渠道不暴露 images 端点，该两模型实际只有 ListenHub 一个候选，ListenHub 断供即全挂。已（1）把两个横线名加入分类列表；（2）实测确认 bltcy 不支持该两模型（images/chat 均拒绝），从 channel 2/3 移除挂载；（3）channel 6（Apexer）通过 model_mapping 把横线名映射到 `gemini_3.0_pro_image_preview` / `gemini_3.1_flash_image_preview` 承接；（4）同步 `abilities.priority` 与 `channels.priority`（此前 abilities 仍是旧值 140/0，直改 channels 不生效）。变更前备份 `/opt/new-api-data/one-api.db.before-gemini-dash-remap-*`。 |
| 2026-06-10 | 降级与改造后图片回归 | 公网入口实测：`gpt-image-2` 直出直接命中 channel 14（50.9s，无 ListenHub 空跳）；`gemini-3-pro-image-preview` 命中 channel 6 Apexer 映射（48.7s，PNG 1024×1024，抽检画面符合 prompt）；`gemini-3.1-flash-image-preview` 命中 channel 6（41.8s，b64 约 1.97MB）。 |
| 2026-06-07 | LK888 模型列表能力补齐 | 发现 channel 11 的 `channels.models` 已有 `sora-2,grok-video-3`，但 `abilities` 缺失导致 `/v1/models` 不暴露裸 `grok-video-3`。已补齐 channel 11 的 `sora-2` / `grok-video-3` abilities，变更前备份到 `/opt/new-api-data/one-api.db.before-lk888-abilities-20260606-200036`；同步后 `/v1/models` 已确认包含 `grok-video-3`。 |

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

### 同步 upstream 最新代码流程

本仓库的业务改动集中在当前功能分支，`fork/main` 只作为 fork 的主分支镜像使用。同步官方 `origin/main` 时优先使用 merge，不使用 rebase，避免改写已部署和已推送的历史。

推荐流程：

```bash
# 1. 确认工作区干净
git status -sb

# 2. 拉取官方仓库和 fork 最新引用
git fetch origin --prune
git fetch fork --prune

# 3. 记录合并前备份点
git branch ccj/pre-origin-main-merge-$(date +%Y%m%d-%H%M%S) HEAD

# 4. 合并官方 main
git merge --no-ff origin/main

# 5. 解决冲突后做静态检查
git diff --check
rg -n "^(<<<<<<<|=======|>>>>>>>)" -g '!web/**/node_modules/**' -g '!tmp/**' -g '!logs/**' . || true

# 6. 提交并推送当前功能分支
git commit
git push fork feature/openai-video-failover
```

合并后不要在本地跑项目 test/build；如需验证，按本文档的新服务器 Coolify 流程远端构建部署，再用真实 API 请求验证关键自定义通道。

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
| 3 | bltcy-images | 1 (OpenAI) | 100 | 关闭 | https://api.bltcy.ai | nano-banana, gemini-2.5 image 系列（2026-06-10 移除横线 gemini-3.x：bltcy 实测不支持） |
| 4 | apexer-veo | 58 (OpenAI Video) | 50 | 开启 | https://www.aiapexers.com | veo3.1/fast/pro、4K、components |
| 5 | xgapi-veo | 58 (OpenAI Video) | 10 | 开启 | https://xgapi.top | veo3.1-lite, sora-2（账号资源受限，详见已知问题） |
| 6 | apexer-images-openai | 1 (OpenAI) | 60 | 开启 | https://www.aiapexers.com | gemini_3.*_image_preview（OpenAI 图片/对话格式）；2026-06-10 起通过 model_mapping 承接横线名 `gemini-3-pro-image-preview` / `gemini-3.1-flash-image-preview` |
| 7 | apexer-images-gemini | 24 (Gemini) | 50 | 开启 | https://www.aiapexers.com | gemini_3.*_image_preview（Gemini 原生格式） |
| 8 | qilin-grok-video | 58 (OpenAI Video) | 80 | 开启 | http://www.937qq.cn | grok-imagine-1.0-video, grok-imagine-1.0-video-20s, grok-imagine-1.0-video-30s |
| 9 | xb-sora2 | 58 (OpenAI Video) | 90 | 关闭 | https://open.hongniaoai.com/v1 | xb-sora2, ss-sora-2, sora-2(线路BF), sora-2-pro(线路BF), je-grok, grok-video-3(线路W), 全能视频2.0 等 |
| 10 | runway-explore | 58 (OpenAI Video) | 110 | 关闭 | http://127.0.0.1:8787 | seedance-2, gen4-turbo, wan-2.6-flash, kling-2.5-turbo-standard, gen4.5, happyhorse-1, wan-2.6, kling-2.5-turbo-pro, kling-2.6, wan-2.2-animate |
| 11 | ai-juhe-lk888 | 58 (OpenAI Video) | 35 | 关闭 | https://api.lk888.ai/api | sora-2, grok-video-3 |
| 12 | listenhub-images | 59 (ListenHub) | 40 | 开启 | https://api.marswave.ai/openapi | gemini-3-pro-image-preview, gemini-3.1-flash-image-preview, gpt-image-2（参考图 fallback；2026-06-10 因上游余额耗尽从 140 降到 40，充值后建议恢复 120） |
| 13 | siliconflow-images | 40 (SiliconFlow) | 0 | 开启 | https://api.siliconflow.cn | baidu/ERNIE-Image-Turbo, Qwen/Qwen-Image, Tongyi-MAI/Z-Image, Qwen/Qwen-Image-Edit-2509 |
| 14 | xgapi-images | 1 (OpenAI) | 130 | 关闭 | https://xgapi.top | gpt-image-2, gpt-image-2(线路XF), gr-image-2, nano-banana-pro（直接生图；后三者映射到上游 gpt-image-2） |
| 15 | manxiaobai-images | 1 (OpenAI) | 120 | 关闭 | https://api.manxiaobai.online | gpt-image-2（兜底）, gpt-image-2-1k/2k/4k（独家档位）；支持 /v1/images/edits 参考图（xgapi 被排除时本渠道为参考图首选） |
| 16 | manxiaobai-images-gemini | 24 (Gemini) | 55 | 关闭 | https://api.manxiaobai.online | gemini-3-pro-image-preview, gemini-3.1-flash-image-preview（Apexer 之后第二兜底） |
| 17 | manxiaobai-video | 58 (OpenAI Video) | 30 | 关闭 | https://api.manxiaobai.online | grok-imagine-video, grok-imagine-video-1.5-preview（独家）, grok-imagine-1.0-video（映射到 grok-imagine-video，作 Qilin 兜底）；`other=manxiaobai` |

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

> **2026-05-28 状态**：Runway 渠道当前未在 Coolify 新服务器上配置。`constants.go` 中已注册 Kling 3.0/O3 系列模型（`kling-3.0-pro`、`kling-3.0-standard`、`kling-3.0-4k`、`kling-o3-pro`、`kling-o3-standard`、`kling-o3-4k`、`kling-2.6-motion-control`、`qilin-video-storyboard-pro`）但 Runway 适配器未就绪，模型列表未暴露给上游。

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

### ListenHub 图片渠道

ListenHub 已新增为独立渠道类型，适合接入 `https://api.marswave.ai/openapi/v1/images/generation` 这类非标准 OpenAI Images 上游。后台新增渠道时配置：

| 配置项 | 值 |
|--------|----|
| 渠道 ID | 12 |
| 名称 | `listenhub-images` |
| 类型 | 59 (ListenHub) |
| 状态 | 手动禁用，待部署 `type=59` 代码后启用 |
| 优先级 | `120`，部署并启用后优先于现有图片渠道 |
| Base URL | `https://api.marswave.ai/openapi` |
| 支持模型 | `gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`, `gpt-image-2` |
| 对外入口 | `/v1/images/generations` |
| 返回格式 | OpenAI Images 兼容，图片在 `data[].b64_json` |

字段映射：`prompt` 原样透传；`gpt-image-2` 自动使用 `provider=openai`，其他模型默认 `provider=google`；`size` 会映射为 `imageConfig.aspectRatio`；`quality=1K/2K/4K` 会映射为 `imageConfig.imageSize`；`image` / `images` / `referenceImages` 会转换为 ListenHub 的 `referenceImages`。

当前部署检查：截至 2026-06-01，已创建线上渠道 `listenhub-images`（ID 12，`priority=120`），但保持手动禁用，因为当前线上运行版本尚未包含 `type=59` 适配代码。已使用 ListenHub Key 直连 Marswave 上游验证 3 个模型均成功返回 PNG base64；部署本次代码后启用渠道并执行 channel test。

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
3. **gemini-3.1-flash-image-preview 渠道选择异常（已修复 2026-06-10）**：根因是 `common.ImageGenerationModels` 缺少横线命名的 gemini-3.x，OpenAI 类型渠道对 `/v1/images/generations` 被端点过滤排除，实际只剩 ListenHub 一个候选。现已加入分类列表，并由 channel 6（Apexer）通过 model_mapping 承接横线名。
4. **web/classic dist 为空（上游兼容性）**：`web/classic/src/index.jsx:23` 显式导入 `@douyinfe/semi-ui/dist/css/semi.css`，但当前 `@douyinfe/semi-ui@2.97.0` 的 `package.json` `exports` 字段不再暴露该深路径，Vite 构建失败 → `dist/index.html` 为 0 字节。生产二进制嵌入的就是这个空文件。由于主使用 default 主题，不影响业务，但访问 `/?theme=classic` 会拿到空 HTML。修复路径：删除该冗余 import（`vitePluginSemi({cssLayer:true})` 本来就会接管 semi 样式）。
5. **4G 内存构建风险**：服务器只有 4G 内存，前端构建时可能 OOM。已添加 4G Swap 作为保护，但构建速度会变慢。**当前流程已固定为本地 cross-compile + rsync 二进制**，避开服务器构建。

---

### 漫小白 / manxiaobai 渠道接入（2026-06-11）

上游 `https://api.manxiaobai.online`（new-api 同构站，OpenAI 兼容 + Gemini 原生双入口）。账号 `vipergw2026`（凭据在 `docs/deployment.local.md`），**当前余额为 0，待充值激活**（支付宝最低 ¥1，约 $1.02/单位；管理面板登录后充值，或使用兑换码）。

| 能力 | 模型 | 上游采购价 | 接入方式 |
|------|------|-----------|----------|
| 图片直出/编辑 | gpt-image-2 / -1k / -2k / -4k | $0.03 / 0.05 / 0.06 / 0.07 | channel 15（type 1），标准 `/v1/images/generations` + `/v1/images/edits` |
| Gemini 图片 | gemini-3-pro-image-preview, gemini-3.1-flash-image-preview | $0.125 / $0.1 | channel 16（type 24），Gemini 原生 `/v1beta/...:generateContent` |
| Grok 视频 | grok-imagine-video（10s，文生+参考图）, grok-imagine-video-1.5-preview（必须参考图，10/15s） | $0.2 / $0.35 | channel 17（type 58），`manxiaobaiProvider`（JSON `/v1/videos`，seconds 必须字符串） |

接入要点：

- quota 报错文案与众不同：images 端点 403 + `insufficient_user_quota` +「当前模型暂时不可用，请稍后重试或联系管理员」；videos/gemini 端点 403 +「用户额度不足」。已把 `insufficient_user_quota` 和「当前模型暂时不可用」补进运营设置 `UpstreamQuotaErrorKeywords`。
- 视频协议细节：`seconds` 传数字会被 400 拒绝（必须字符串）；尺寸仅支持 `1792x1024` / `1024x1792`；任务流程 POST `/v1/videos` → GET `/v1/videos/{id}` → GET `/v1/videos/{id}/content`。`manxiaobaiProvider` 已做 seconds 字符串化与尺寸归一。
- `grok-imagine-video-1.5-preview` 必须带参考图，上游另有 `/v1/video-reference-images` 预上传接口（base64 带 `data:image/png;base64,` 前缀）——充值后实测确认 provider 是否需要补预上传逻辑。
- 图片/视频结果 URL（`/generated/...`）只保留约 2 小时，下游需及时转存。
- 充值后建议执行：渠道 15/16/17 的 channel test 真实验证 + 考虑把 channel 15 提到 130 与 xgapi 同桶做权重轮换。

## 多渠道故障转移评审

多渠道互备/自动切换的实现评审、风险清单和新平台接入 Checklist 见 [channel-failover-review.md](./channel-failover-review.md)（2026-06-10）。接入新图片/视频平台前请先过一遍其中的 Checklist。

## 后续优化建议

1. **绑定域名 + HTTPS**：使用 Let's Encrypt 免费证书
2. **安装 Redis**：提升缓存性能，`apt install redis && systemctl enable redis`
3. **切换 PostgreSQL**：流量增长后可升级数据库
4. **添加更多中转站**：在 Provider 模式下，只需在 `relay/channel/task/openaivideo/` 下新增一个 provider 文件即可
