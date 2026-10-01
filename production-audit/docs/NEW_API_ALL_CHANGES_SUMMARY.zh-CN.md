# New API 全部修改与迁移总结

## 1. 文档范围

本文汇总 2026 年 7 月 17 日至 2026 年 7 月 20 日期间，在 New API 生产环境、数据库、渠道、重试代理、并发配置、迁移工具、测试报告和 GitHub 仓库中完成的全部可确认修改。

信息来源：

- Trellis 历史任务和开发日志；
- 生产 PostgreSQL/SQLite 导出与脱敏清单；
- systemd、Docker 和 New API 运行配置导出；
- 并发测试、Messages API 测试和 Supabase 迁移报告；
- GitHub 仓库提交记录；
- New API 定制源码分支及自动测试。

本文不包含真实 API Key、Token、数据库密码、完整 DSN、用户密码哈希、SSH 私钥或生产服务器地址。

## 2. 最终系统结构

```text
客户端
  -> 对外重试/排队代理 :3000
  -> New API 内部服务 127.0.0.1:3001
  -> PostgreSQL 16
  -> Azure / OpenRouter / AWS Bedrock 等上游渠道
```

核心运行参数：

| 参数 | 最终配置 |
|---|---:|
| 重试次数 | 5 |
| 代理上游并发 | 800 |
| systemd `LimitNOFILE` | 65536 |
| PostgreSQL `max_connections` | 600 |
| `SQL_MAX_OPEN_CONNS` | 400 |
| `SQL_MAX_IDLE_CONNS` | 100 |
| `SQL_MAX_LIFETIME` | 60 秒 |
| 时区 | Asia/Shanghai |

## 3. Claude Fable 5 与 Sonnet 5 排障

### 3.1 已确认问题

- 渠道测试曾出现 `content=""`、`finish_reason="length"`、`completion_tokens=16`。
- Fable 5 的 adaptive reasoning 可能消耗过小的输出预算，导致没有可见文本。
- Bedrock 对部分采样参数有严格限制：
  - `temperature=0` 会失败；
  - `top_p=0.95` 会失败；
  - `top_k` 不受支持；
  - 同时发送 `temperature` 和 `top_p` 可能触发验证错误。
- `AWS-B` 渠道曾被手动停用，造成无可用渠道；排障后恢复启用。

### 3.2 已完成适配

对 `AWS-B` 和 `0718-OR` 的 `claude-fable-5` 请求配置条件参数覆盖：

- 删除 `temperature`；
- 删除 `top_p`；
- 删除 `top_k`；
- 当 `max_tokens < 512` 时设置为 `512`；
- 同时识别 `model` 和 `original_model`。

修复后，带不兼容参数和 `max_tokens=16` 的验证请求返回 HTTP 200 和正常文本；临时测试 Token 已删除。

## 4. Azure gpt-5.6-sol 参数兼容

生产渠道：

- `az-ch0718`；
- `07-19-AZ-COLIN-OF-001`。

两个渠道均启用，位于 `Azure-GPT` 组，并为 `gpt-5.6-sol` 设置条件参数覆盖：

- 删除 `temperature`；
- 删除 `top_p`；
- 仅当 `model` 或 `original_model` 包含 `gpt-5.6-sol` 时生效。

这些规则解决了 Responses API 对部分 Azure 兼容端点发送不支持采样参数的问题，避免参数验证失败。

## 5. Responses API 重试代理

### 5.1 HTTP 与非流式处理

独立 Python 代理实现：

- `/v1/responses` 请求重试；
- HTTP `500/502/503/504` 重试和线性退避；
- 非流式 SSE 内容中的 `response.failed` 或结构化 `error` 检测；
- 上游异常统一转换为结构化 HTTP 502；
- hop-by-hop header 过滤；
- `Connection: close`，避免连接和文件描述符长期占用。

### 5.2 流式早期失败处理

早期版本会立即转发 `response.created`，随后收到 `response.failed` 时客户端已经开始响应，无法透明重试。

最终版本会短暂缓冲：

- `response.created`；
- `response.in_progress`；
- SSE 心跳和注释。

如果有效输出开始前出现 `response.failed` 或错误事件，则丢弃本次前导事件并重试；一旦实际输出已经发送给客户端，就不重放，避免重复文本、重复计费或重复工具调用。缓冲上限为 64 KiB。

### 5.3 HTTP 501 后台操作修复

代理完整实现并转发：

- `GET`；
- `POST`；
- `PUT`；
- `PATCH`；
- `DELETE`；
- `OPTIONS`；
- `HEAD`。

这解决了后台创建分组、创建用户和修改密码经过旧代理时，由于缺少方法处理器而返回 HTTP 501 的问题。

### 5.4 Messages API

`/v1/messages` 保持原路径透明转发到 New API，不进入 Responses 专用重试转换逻辑。测试确认正确的 `/v1/messages` 路径支持 Anthropic SSE；曾使用的拼写错误路径返回 404，已在报告中纠正。

## 6. 并发、队列与文件描述符

### 6.1 代理并发控制

- `/v1/responses` 使用 `threading.BoundedSemaphore` 控制进入 New API 的并发；
- systemd 最终生产配置为 `--upstream-concurrency 800`；
- 该值是代理上限，不等于单条上游 Key 的真实并发能力；
- 双 Azure 渠道用于分担流量，不将所有负载固定在单一 Key。

### 6.2 Too many open files

针对 `<urlopen error [Errno 24] Too many open files>`：

- systemd 增加 `LimitNOFILE=65536:65536`；
- 代理响应强制 `Connection: close`；
- 测试后检查代理 FD 和线程数；
- 清理遗留的辅助测试代理和临时监听端口。

后续综合测试未再观察到 `Too many open files`。

## 7. 生产并发测试

### 7.1 单渠道/综合历史测试

- 并发档位：100 至 1000，每次增加 100；
- 总请求数：5500；
- 短请求：2750；
- 长请求：2750；
- 成功：5483；
- 失败：17；
- 成功率：99.69%；
- HTTP 429：0；
- HTTP 5xx：0；
- `response.failed`：0；
- `Too many open files`：0；
- 17 个失败均为客户端连接重置。

100 至 700 档全部成功。800 和 1000 档出现少量客户端连接重置，因此稳定生产基线不应仅凭一次 900 档全成功就提高到 900。

延迟报告保存的是每档 P95 的综合均值，不是全部单请求算术平均：

| 指标 | 短请求 | 长请求 |
|---|---:|---:|
| TTFT P95 均值 | 20.886 秒 | 23.272 秒 |
| 总耗时 P95 均值 | 24.023 秒 | 25.303 秒 |

### 7.2 PostgreSQL 与双 Azure 最终验证

- 最终 800 和 1000 客户端并发验证均为 100% 成功；
- 未出现 SQLite lock、PostgreSQL max-client、HTTP 500 或参数错误；
- 流量实际分配到两个 Azure 渠道；
- 测试日志中渠道 2 处理 1007 条、渠道 4 处理 793 条；
- 每轮测试后删除临时 Token。

### 7.3 外部 `/v1/messages` 5000 请求测试

- 并发档位：100、300、500、800、1000；
- 每档 1000 请求，总计 5000；
- 80% 短问题、20% 长问题；
- 总成功 1383，总失败 3617，成功率 27.66%；
- 3616 个失败发生在 HTTPS 建连阶段，仅观察到 1 个 HTTP 500，没有模型侧 HTTP 429；
- 并发 100 成功率 96.7%，约 1047 成功 RPM、17.14 万总 TPM；
- 300 及以上主要受测试机/公网出口突发建连限制影响，不能解释为单纯模型容量不足。

进一步使用持久连接测试后，确认网关存在约 120 请求/窗口的 HTTP 429 速率限制。后续压测必须复用连接、控制新建连接速率，并将 TCP/TLS 接入测试与模型 RPM/TPM 测试分开。

## 8. SQLite 迁移 PostgreSQL

生产数据库由 SQLite 切换到 PostgreSQL 16：

- 保留 SQLite 文件和停止状态的回滚容器；
- 使用 PostgreSQL canary 验证后再切换生产；
- 核对关键表数量；
- 验证登录、Token 生命周期、Responses、Chat Completions 和参数覆盖；
- 设置 PostgreSQL 连接池后再提升代理并发；
- 恢复 SQLite 中缺失的用户 ID 7、8；
- 调整用户序列，确保后续主键继续递增；
- 生产健康接口保持 HTTP 200。

最终导出时主要表记录数：

| 表 | 记录数 |
|---|---:|
| users | 8 |
| tokens | 33 |
| channels | 4 |
| logs | 41763 |
| quota_data | 203 |
| options | 17 |
| perf_metrics | 24 |

## 9. Supabase 数据迁移

最新生产 PostgreSQL 快照已迁移到 Supabase 的独立 schema：

- 使用 Session Pooler 连接，绕过源服务器无 IPv6 出口的问题；
- 保持生产 New API 继续使用原 PostgreSQL，未直接切换 DSN；
- 源与目标关键表数量一致；
- 验证 31 张表、27 个序列、158 个索引、104 个约束；
- 用户 1 至 8、密码哈希、渠道 2/4、渠道 Key 存在性、模型和参数覆盖均通过验证；
- 创建目标 schema 重映射、恢复和验证脚本；
- 生成单文件加密 Supabase 迁移包并验证内部校验和。

## 10. 服务器镜像与完整迁移包

已导出并下载到本地：

- New API Docker 镜像；
- PostgreSQL 16 镜像；
- Python 3.12 镜像；
- PostgreSQL custom dump、plain SQL 和 globals；
- New API 应用数据；
- SQLite 回滚备份；
- 重试代理源码；
- systemd 主服务和 drop-in；
- Docker inspect、环境变量和网络配置；
- 用户、渠道和数据库私密配置；
- 脱敏 manifest 和 SHA-256 校验文件。

数据库 dump 已在临时 PostgreSQL 数据库执行完整恢复验证。完整数据包使用 AES-256-CBC、PBKDF2 和 200000 次迭代加密；密码只保存在本地私密目录，不进入 GitHub。

## 11. GitHub 仓库

### 11.1 迁移工具仓库

- 仓库：`jkjk02/new-api-server-migration`；
- 可见性：Private；
- 分支：`main`；
- 内容：导出、恢复、Supabase schema 重映射、校验脚本、中文部署文档和脱敏 manifest；
- 不包含明文数据库 dump、真实 Key 或密码。

主要提交：

| 提交 | 内容 |
|---|---|
| `6fb4c8e` | 初始服务器导出和恢复工具 |
| `9a49ccc` | 已验证导出 manifest |
| `ab3745f` | 导出包最终健康状态修复 |
| `6574236` | 完整中文部署说明 |
| `8ad6f8b` | 私密数据包内容说明 |
| `b6b894f` | Supabase schema 迁移工具 |
| `ec72824` | Supabase 恢复和验证流程 |
| `d5229c3` | Supabase 验证报告 |
| `5791684` | 忽略 Python 字节码产物 |

### 11.2 New API 定制 Fork

- 仓库：`jkjk02/new-api`；
- 上游：`QuantumNous/new-api`；
- 生产基线：`v1.0.0-rc.21`；
- 定制分支：`custom/production-20260719`；
- `main` 保持上游状态，未写入生产定制。

定制提交：

| 提交 | 内容 |
|---|---|
| `ee21ec8d44e4aa66cf2f2aa46b9bd0d2b252b09a` | 初始代理、systemd、连接池、参数模板、中文文档和测试 |
| `e337e23e6d49fbe880d0a1a33906c601481d727c` | 补齐 Fable/Azure 规则、流式早期失败重试、四渠道安装脚本和覆盖矩阵 |
| `4ae3f83b76f146919a163eb6e8b411d8f1006b41` | 严格 64 KiB 前导缓冲、输出后不重放测试、生产默认参数和分支内 Trellis 规范 |

公开 Fork 不能设为私有，因此只提交脱敏源码和模板，不提交生产数据或凭据。

## 12. 自动测试与质量检查

New API 定制分支最终验证：

- Python 单元测试：15/15 通过；
- Python 语法检查通过；
- New API `relay/common` 参数覆盖 Go 测试通过；
- Azure 和 Fable JSON 配置解析通过；
- SQL 安装脚本 Shell 语法检查通过；
- systemd unit 校验通过；
- Git whitespace/diff 检查通过；
- 已知密码、API Key、数据库主机、SSH 私钥、生产 IP 和通用密钥形态扫描通过；
- GitHub 远端分支、提交和文件存在性验证通过；
- `main` 分支推送前后提交一致。

### 12.1 2026-07-20 服务器与 GitHub 完整性审计

- 服务器当前代理文件与首个定制提交 `ee21ec8` 的 SHA-256 完全一致；
- GitHub `custom/production-20260719` 最新代理文件对应 `4ae3f83`，包含服务器旧版没有的流式前导缓冲、早期 `response.failed` 重试和严格 64 KiB 上限；
- GitHub 分支是服务器当前代理的功能超集，源码推送完整；
- 服务器 systemd 主文件加 drop-in 的有效参数与仓库模板一致：重试 5 次、代理并发 800、`LimitNOFILE=65536`；
- 线上历史直连备份容器占用了公网 3000 端口，导致代理持续因端口冲突重启，当前流量实际绕过代理；
- 服务器两个 Azure 渠道和 `AWS-B` 参数覆盖符合仓库模板，`0718-OR` 缺少按 `model` 匹配的 token 下限规则，仓库 SQL 脚本包含完整修正规则；
- 历史备份中曾存在 `/v1/messages -> /v1/chat/completions` 转换方案，该方案已回滚，最终契约为 `/v1/messages` 原路径透明透传，因此不应合入当前分支；
- 审计材料保存在 `server_code_audit_20260720/`，其中不包含 API Key、数据库密码、DSN、用户数据或数据库 dump。

## 13. 问题与处理结果总表

| 问题 | 分类 | 最终处理 |
|---|---|---|
| Fable 5 空输出 | 参数/输出预算 | 删除三个采样参数，最小 `max_tokens=512` |
| gpt-5.6-sol 参数不兼容 | 渠道参数 | 条件删除 `temperature`、`top_p` |
| `response.failed` 非流式 | 代理 | 检测事件并重试 |
| `response.created` 后立即失败 | 流式代理 | 有效输出前缓冲并重试 |
| HTTP 400 参数验证错误 | 请求/渠道参数 | 在进入上游前按模型删除不兼容参数，不进行盲目重试 |
| HTTP 500/502/503/504 | 代理 | 有限重试和退避 |
| 后台操作 HTTP 501 | HTTP 方法 | 补齐七种方法转发 |
| `Too many open files` | 系统资源 | 关闭连接、提高 `LimitNOFILE`、清理辅助服务 |
| SQLite 写锁/容量 | 数据库 | 切换 PostgreSQL，显式连接池 |
| 单 Azure 渠道压力 | 路由 | 启用双渠道并验证分流 |
| PostgreSQL 缺失用户 | 数据一致性 | 从 SQLite 恢复用户 7、8 并调整序列 |
| 401 Invalid token | 凭据 | 识别为 Token/上游鉴权问题，不伪装成代码修复 |
| 402 Insufficient credits | 上游余额 | 识别为余额问题，不切换错误渠道掩盖 |
| 503 无可用渠道 | 数据状态 | 检查渠道状态、组、模型和 Key，不作为源码错误 |
| 高并发 HTTPS 超时 | 接入网络 | 连接复用、限速建连、HTTP/2、多出口压测 |
| 固定窗口 HTTP 429 | 网关限速 | 单独记录站点/IP 限流，不与模型 RPM 混淆 |

### 13.1 空回问题专项处理记录

项目期间确认了两类表现相似、但根因不同的“空回”问题。排查时必须先根据日志和 SSE 事件区分，不能用同一种修复方式处理。

#### Claude Fable 5 返回空内容

典型日志：

```text
content: ""
finish_reason: "length"
completion_tokens: 16
```

根因：

- `max_tokens=16` 过小，可能被 Fable 5 的 adaptive reasoning 消耗完，导致没有剩余预算生成可见文本；
- 请求同时携带了模型不兼容或受严格限制的 `temperature`、`top_p`、`top_k`；
- Bedrock 实测会拒绝部分参数值或拒绝同时发送 `temperature` 与 `top_p`。

最终修复：

- 对 `AWS-B` 和 `0718-OR` 的 `claude-fable-5` 请求删除 `temperature`；
- 删除 `top_p`；
- 删除 `top_k`；
- 当 `max_tokens < 512` 时自动设置为 `512`；
- 同时检查 `model` 和 `original_model`，避免模型映射后规则失效；
- 所有规则只针对 `claude-fable-5`，不能影响同渠道其他模型。

当前配置文件：

```text
new-api-custom/deploy/channel-overrides/claude-fable-5.json
```

验证时使用包含 `temperature=0`、`top_p=0.95`、`top_k=40`、`max_tokens=16` 的请求，修复后返回 HTTP 200 和正常文本，不再出现空内容；临时验证 Token 已删除。

#### HTTP 400 参数验证错误

历史测试确认 HTTP 400 主要是确定性的请求参数错误，不是瞬时上游故障。

Claude Fable 5 已确认的触发条件：

| 请求参数 | 上游结果 |
|---|---|
| 同时发送 `temperature=1.0`、`top_p=0.99` | Bedrock HTTP 400，两个采样参数不能同时指定 |
| `temperature=0` | Bedrock HTTP 400，该参数值不受支持/已弃用 |
| `top_p=0.95` | Bedrock HTTP 400，该参数值不受支持/已弃用 |
| `top_k=40` | Bedrock HTTP 400，模型不支持 `top_k` |

Azure `gpt-5.6-sol` 的兼容端点也可能因携带不支持的 `temperature`、`top_p` 返回参数验证错误。

处理原则：

1. 在 New API 渠道参数覆盖层按目标模型清理不兼容字段；
2. Fable 5 删除 `temperature`、`top_p`、`top_k`，并为小输出预算设置 `max_tokens=512`；
3. Azure `gpt-5.6-sol` 删除 `temperature`、`top_p`；
4. 条件同时检查 `model` 和 `original_model`，避免模型映射前后规则失效；
5. HTTP 400 不加入代理重试列表，因为相同请求重试仍会产生相同验证错误；
6. 只有修正请求或渠道参数后才重新调用上游。

修复后，原本携带错误采样参数的验证请求返回 HTTP 200 和正常文本。

#### gpt-5.6-sol 流式创建后失败

典型 SSE 顺序：

```text
response.created
response.failed
```

旧代理在收到 `response.created` 后立即向客户端提交响应。一旦下一事件是 `response.failed`，响应已经开始，代理无法丢弃本次失败结果并透明重试。

最终修复：

1. 暂存 `response.created`、`response.in_progress`、SSE 心跳和注释；
2. 在有效输出开始前出现 `response.failed` 或结构化错误时，丢弃本次前导事件并重试；
3. 收到第一个有效输出事件后才向客户端提交流；
4. 输出一旦发给客户端就不再重放，避免重复文本、重复工具调用或重复计费；
5. 前导缓冲限制为 64 KiB，防止异常上游无限占用代理内存。

当前代码：

```text
new-api-custom/deploy/retry-proxy/gpt56_retry_proxy.py
```

对应测试会模拟第一次请求返回 `response.created -> response.failed`、第二次请求正常输出，并断言客户端只能看到成功请求的一份 `response.created` 和输出内容。

#### 快速判断方法

| 表现 | 优先检查 | 处理方式 |
|---|---|---|
| `content=""`、`finish_reason="length"` | 模型参数和输出预算 | 应用 Fable 参数配置并将小预算提高到 512 |
| `response.created -> response.failed` | 流式上游早期失败 | 使用输出前 SSE 缓冲重试 |
| HTTP 400 | 不兼容请求参数 | 按模型清理参数，不进行盲目重试 |
| HTTP 401 | Token/Key | 修复鉴权，不增加盲目重试 |
| HTTP 402 | 上游余额 | 补充余额或使用获批的有余额渠道 |
| HTTP 503 无可用渠道 | 渠道状态、组、模型和 Key | 修复数据库路由状态，不修改空回逻辑 |

## 14. 安全边界

- GitHub 只保存源码、脚本、脱敏配置和文档；
- 完整数据库、用户、渠道 Key、密码和 DSN 只存在本地加密包；
- 私密环境文件权限应为 `600`；
- 临时测试 Token 使用后必须删除；
- 报告中只记录 Key 是否存在，不记录 Key 内容；
- 公开 Fork 提交前必须扫描生产 IP 和凭据形态；
- 数据迁移完成不等于生产 DSN 已切换，切换必须单独执行健康验证和回滚检查。

## 15. 本地关键文件

| 文件/目录 | 用途 |
|---|---|
| `new-api-custom/` | New API Fork 和生产定制分支 |
| `new-api-custom/CUSTOM_DEPLOYMENT.zh-CN.md` | 定制部署说明 |
| `server_code_audit_20260720/SERVER_GITHUB_COMPLETENESS_AUDIT.zh-CN.md` | 服务器与 GitHub 分支完整性审计报告 |
| `server_migration/` | 迁移、恢复、Supabase 和验证工具 |
| `comprehensive_server_concurrency_test_report_2026-07-19.md` | 生产综合并发报告 |
| `hfapis_v1_messages_benchmark_report_2026-07-19.md` | Messages API 并发和根因报告 |
| `.private/server_exports/` | 本地私密导出、数据库和加密包 |
| `share/` | 可交付镜像和加密迁移文件 |

## 16. 后续操作原则

1. 修改代理前先运行 15 项回归测试，并新增对应失败场景测试。
2. 修改渠道覆盖时同时检查 `model` 与 `original_model`，并验证不会影响同渠道其他模型。
3. 压测必须分别记录客户端并发、代理并发、渠道分流、RPM、TPM、TTFT、完整延迟和错误分类。
4. 数据库切换必须保留可执行回滚点，并核对表数量、用户、渠道、序列、索引和约束。
5. 公开 GitHub 只能提交脱敏内容；真实恢复材料继续使用本地加密包。
