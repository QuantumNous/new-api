# modelroute 独立测试栈（VPS）

与生产 `snew-new-api`（`127.0.0.1:3000` / `/opt/new-api`）隔离：

| 项 | 测试栈 | 生产 |
|----|--------|------|
| 目录 | `/opt/new-api-modelroute-test` | `/opt/new-api` |
| 端口 | `127.0.0.1:3010` | `127.0.0.1:3000` |
| 容器前缀 | `modelroute-test-*` | `snew-new-api*` |
| 数据库/卷 | 独立 | 独立 |

## 风险（jp279-cpa）

- 机器内存约 **900MB**，再生产 5 个容器后再开 PG+Redis+API **可能 OOM**
- 本栈已压 PG/Redis 内存；仍建议先看 `free -h`，不够就加内存或换独立测试机
- **禁止**改写生产 compose / 域名 / 3000 端口

## 本机脚本

见仓库 `scripts/modelroute-vps-*.sh`
