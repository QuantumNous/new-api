# New API 服务器与 GitHub 完整性审计报告

## 1. 审计结论

审计日期：2026-07-20。

结论分为两部分：

1. **GitHub 源码完整**：`custom/production-20260719` 最新提交 `4ae3f83` 是服务器当前代理代码的功能超集，包含最终确定的流式早期失败重试、严格 64 KiB 前导缓冲、输出后不重放、HTTP 方法转发、连接关闭、并发和参数兼容配置。
2. **生产部署未同步完整**：服务器当前代理文件仍停留在首个定制提交 `ee21ec8`，并且公网 3000 端口被历史直连容器占用，systemd 代理持续重启，实际流量绕过代理。

因此，问题不是最新代码没有进入 GitHub，而是生产服务器没有部署 GitHub 的最新版本，并存在端口占用导致的运行时漂移。

## 2. 审计范围

已核对：

- GitHub Fork：`jkjk02/new-api`；
- 分支：`custom/production-20260719`；
- 基线：New API `v1.0.0-rc.21`；
- 服务器代理源码和全部历史备份；
- systemd 主 unit、并发 drop-in 和文件描述符 drop-in；
- New API 与 PostgreSQL 容器运行形态；
- PostgreSQL 连接池参数；
- 四个目标渠道的脱敏 `param_override`；
- GitHub 分支部署模板、测试和 Trellis 规范；
- 本地总技术文档。

未导出或记录：API Key、Token、数据库密码、完整 DSN、用户数据、渠道密钥、数据库 dump 和 SSH 私钥内容。

## 3. 代码哈希对比

| 对象 | SHA-256 | 结论 |
|---|---|---|
| 服务器当前代理 | `ed52b12e3bc2cfc6994945cc32642ba75a6abf92503e790b99a3921c430e7964` | 与 `ee21ec8` 完全一致 |
| Git 提交 `ee21ec8` 代理 | `ed52b12e3bc2cfc6994945cc32642ba75a6abf92503e790b99a3921c430e7964` | 服务器已部署的旧版 |
| Git 提交 `e337e23` 代理 | `291c6f52a02ec1f40a5f0bbb29f4d9ed9d9183d0a491fe4aa168296cea63232a` | 增加流式早期失败处理 |
| Git 提交 `4ae3f83` 代理 | `ea5f7fd8b06156b268ed8f5762151676f82e22f51a37a1551aff376a0cacbc9e` | GitHub 当前最终版 |

服务器代理不是未知分叉，也没有发现只在线上存在但未进入 GitHub 的最终功能。服务器当前文件可由 Git 提交 `ee21ec8` 精确复现。

## 4. 功能完整性矩阵

| 功能 | 服务器当前版 | GitHub 最新版 | 判断 |
|---|---:|---:|---|
| HTTP 500/502/503/504 有限重试 | 有 | 有 | 完整 |
| 非流式 `response.failed` 重试 | 有 | 有 | 完整 |
| 七种 HTTP 方法转发，修复后台 501 | 有 | 有 | 完整 |
| `/v1/messages` 原路径透明透传 | 有 | 有 | 完整 |
| 连接主动关闭，降低 FD 泄漏 | 有 | 有 | 完整 |
| 服务 backlog 128 | 有 | 有 | 完整 |
| 流式前导事件暂存 | 无 | 有 | 服务器未部署 |
| 输出前检测 `response.failed` 并重试 | 无 | 有 | 服务器未部署 |
| 首个有效输出时才提交下游响应 | 无 | 有 | 服务器未部署 |
| 输出后不重放的显式回归测试 | 无 | 有 | GitHub 已补齐 |
| 严格 64 KiB 前导缓冲硬上限 | 无 | 有 | GitHub 已补齐 |
| 默认重试 5 次、默认并发 800 | 无 | 有 | GitHub 已补齐；服务器靠 systemd 参数覆盖 |

## 5. 历史备份核对

服务器保留了 FD、stream、backlog 等阶段的代理备份，均已拉取到本地
`server/retry-proxy-history/`。

其中一份早期备份包含 `/v1/messages -> /v1/chat/completions` 的非流式转换。该方案有以下问题：

- 改变 Anthropic Messages 协议语义；
- 不支持流式 Messages；
- 需要手工映射 thinking、usage 和 stop reason；
- 可能丢失原生字段或产生转换兼容问题。

最终生产契约已改为 `/v1/messages` 透明透传，所以这段历史代码属于已回滚实验，不应加入 GitHub 最终分支。除该已回滚方案外，没有发现应保留但遗漏于 GitHub 的服务器定制逻辑。

## 6. systemd 与运行时配置

服务器 systemd 主 unit 仍写并发 1，但 `concurrency.conf` 覆盖为 800；
`limits.conf` 设置 `LimitNOFILE=65536:65536`。合并后的有效参数与 GitHub 模板一致：

```text
attempts=5
upstream-concurrency=800
LimitNOFILE=65536
```

GitHub 最新 unit 已把 800 和 `LimitNOFILE` 直接写入主文件，同时保留 drop-in 模板，迁移时更容易看清最终值。

## 7. 当前线上部署漂移

在线检查发现：

- 主 New API 运行在 `127.0.0.1:3001`；
- 历史直连备份容器占用 `0.0.0.0:3000`；
- retry proxy 尝试监听 3000 时收到 `Address already in use`；
- systemd 已累计大量自动重启；
- 公网 3000 当前进入历史直连容器，绕过 retry proxy。

这意味着流式早期失败重试、代理并发信号量和代理级错误分类当前没有作用于公网流量。

## 8. 数据库与渠道配置核对

生产连接池与 GitHub 模板一致：

```text
SQL_MAX_OPEN_CONNS=400
SQL_MAX_IDLE_CONNS=100
SQL_MAX_LIFETIME=60
```

渠道覆盖核对结果：

- 两个 Azure 渠道均按 `model` 和 `original_model` 删除 `temperature`、`top_p`；
- `AWS-B` 包含完整 Fable 删除规则和两个 token 下限规则；
- `0718-OR` 包含三个删除规则，但只保留按 `original_model` 匹配的 token 下限规则，缺少按 `model` 匹配的同类规则；
- GitHub 的 SQL 安装脚本和 Fable JSON 配置包含完整规则，可用于消除该数据库漂移。

## 9. 文档完整性核对

审计前文档缺少：

- 最新提交 `4ae3f83`；
- 测试数量从 13 增加到 15；
- 服务器在线哈希复核；
- 历史直连容器占用 3000；
- 代理持续重启并被绕过；
- 已回滚的 Messages 转换方案；
- `0718-OR` 当前数据库规则漂移。

上述内容已补入：

- `NEW_API_ALL_CHANGES_SUMMARY.zh-CN.md`；
- `new-api-custom/CUSTOM_DEPLOYMENT.zh-CN.md`；
- 本审计报告。

## 10. 建议部署顺序

1. 保存当前容器、systemd、代理文件和渠道覆盖的回滚信息；
2. 停止历史直连备份容器，确认 3000 端口释放；
3. 将 GitHub 最新代理安装到 `/opt/gpt56-retry-proxy/`；
4. 安装最新 systemd unit 和 drop-in，执行 daemon-reload；
5. 启动代理并确认监听 3000、上游指向 3001；
6. 执行渠道 SQL 安装脚本，统一四个渠道参数规则；
7. 验证 `/api/status`、后台写操作、Responses 非流式、Responses 流式和 Messages；
8. 运行小并发、长请求和短请求综合测试，再逐步增加负载；
9. 确认日志中不再出现端口冲突、FD 耗尽或早期流式失败泄漏。

本次审计仅执行只读服务器检查和代码拉取，没有停止容器、修改数据库或切换线上流量。
