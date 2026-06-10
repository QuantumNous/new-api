# 视频任务结果转存 GCS：用户契约与部署指南

> 设计文档：`gcs-video-transfer-design.md`（仓库根目录）。本文是面向 API 用户与运维的对外说明，
> 与设计文档冲突时以设计文档为准。

开启转存（`GCS_TRANSFER_ENABLED=true`）后，视频生成任务成功时网关会把上游结果文件转存到
GCS，并向用户返回 **12 小时有效的 V4 签名链接**。转存完成后任务才对外标记为成功。

---

## 1. 对用户的 API 契约

### 1.1 任务状态语义

- 上游生成完成 ≠ 任务成功。任务会先停留在 `in_progress`（progress `95%`），**GCS 转存完成才置
  success**。对外成功时间 = 上游完成时间 + 转存耗时（大文件可达分钟级）。
- `FinishTime` / `completed_at` 的语义是**转存完成时刻**，不是上游生成完成时刻。

### 1.2 结果链接（签名 URL）

- 查询成功任务时返回的 URL 是**读取时现签**的 V4 签名链接，默认有效期 12 小时。
- 响应附带 `expires_at`（Unix 秒）：**真实的签名过期时刻，不虚标**。临近保留期截止时，
  签名有效期会按剩余保留期收口，`expires_at` 相应缩短。
- URL **不保证稳定，也不保证每次不同**（签名缓存命中期内会返回相同 URL）。客户端不要对
  URL 做等值比较或持久化依赖。
- **拿到链接即下载**：签名链接会过期，但在保留期内重新查询任务即可拿到新鲜链接。

### 1.3 多文件任务（`metadata.urls`）

- 多文件渠道（如 Vidu 的多视频 + 封面、Pollo 的 `videoNum` 1–4 个视频）会转存**全部**结果对象。
- 读取侧按对象序号（Index）升序重组：
  - `metadata.url`：主文件（index=0）；
  - `metadata.urls`：全部对象的签名 URL 数组（按 Index 升序，含主文件）。仅多文件任务出现该字段。
- Pollo 按上游全量 credit 结算，转存后「付 N 拿 N」。

### 1.4 结果保留期（30 天）

- 结果文件保留 **30 天**（自任务成功即转存完成时刻起），由 bucket 生命周期规则删除。
  保留期是对外 API 契约的一部分。
- 超过保留期后查询：
  - OpenAI 格式（`GET /v1/videos/{task_id}`）：不再返回 URL，返回明确的过期错误对象
    `error.code = "result_expired"`；
  - 视频代理端点（video_proxy）：返回 **HTTP 410 Gone**。
- 不会返回静默 404 的死链：网关在保留期截止前留有安全余量，余量内即按过期处理。

### 1.5 例外与降级

- **Midjourney 视频（mj_video）不适用本契约**：MJ 是独立任务系统，结果链接维持上游直链
  原样返回，「30 天保留 + 过期明确报错」对 MJ 视频不生效。
- 签名暂时失败时，JSON 出口会把 URL 降级为网关代理地址（`/v1/videos/{task_id}/content` 形态），
  访问该地址会得到 503（可重试）或 410（已过期）的明确语义，绝不会返回裸 `gs://` 路径。
- 紧急开关关闭期间（见 2.2），已转存任务（结果为 `gs://`）的读取同样降级为代理地址，
  代理访问返回 **503，待开关恢复后自动恢复签名链接**。

---

## 2. 配置与紧急开关

### 2.1 配置项（环境变量）

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `GCS_TRANSFER_ENABLED` | `false` | 总开关 / 紧急止血开关，**修改后需重启进程生效** |
| `GCS_RESULT_BUCKET` | `taluna-api-result` | 转存目标 bucket |
| `GCS_RESULT_PREFIX` | `api/video` | 对象前缀，对象名 `{prefix}/{task_id}_{index}.{ext}` |
| `GCS_SIGNED_URL_TTL` | `12h` | 签名链接有效期（V4 上限 7 天） |
| `GCS_RESULT_RETENTION_DAYS` | `30` | 结果保留期（天），**必须与 bucket 生命周期规则一致** |
| `GCS_TRANSFER_DEADLINE` | `2h` | 转存墙钟截止，超过则任务判失败并退款 |
| `GCS_TRANSFER_CONCURRENCY` | `4` | worker 并发转存数（建议 4–8） |
| `GCS_TRANSFER_TIMEOUT` | `10m` | 单次转存（整任务全部对象）超时 |
| `GCS_MAX_OBJECT_SIZE` | `2GiB` | 单对象体积上限，超限判转存失败 |
| `GCS_SIGN_CACHE_TTL` | `10m` | 签名缓存 TTL（Workload Identity/SignBlob 路径防签名调用放大） |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | SA key 文件路径 |

### 2.2 紧急开关切换语义（GCS 故障止血）

`GCS_TRANSFER_ENABLED=false` + 重启进程后：

- **新发现的上游成功任务**：恢复旧逻辑直链透传（写上游直链、直接置 success、正常结算）。
- **存量转存中任务**（progress 95%）：下一轮轮询用已暂存的上游直链**降级完成**
  （写直链 + 置 success + 正常结算），**不会走超时退款**——止血开关不会造成批量误退款。
  无直链渠道（Sora/Vertex）回退为网关代理 URL。
- **存量已转存任务**（结果为 `gs://`）：读取侧无法签名，降级为代理地址，访问返回 503；
  重新打开开关后自动恢复签名链接。
- **重新打开**：不回溯已按直链完成的任务。

---

## 3. 部署 checklist（上线前必须逐项核对）

1. **SA 权限**：对目标 bucket 授予 `roles/storage.objectCreator` + `roles/storage.objectViewer`
   （或自定义角色含 `storage.objects.create` + `storage.objects.get`）。
   签名 GET URL 在服务端以签名 SA 的身份鉴权，**objectCreator 单独不够**（签出的链接全部 403）。
   不要授予 objectAdmin。
2. **SA 实签验证（放量前必做）**：用目标 SA 实签一个 GET URL 并 curl 验证 200：
   ```bash
   # 先用同一 SA 上传一个探针对象
   echo probe | gcloud storage cp - gs://taluna-api-result/api/video/deploy-probe_0.bin
   # 用网关同款方式签名（或 gcloud 辅助验证；--impersonate-service-account 需 token creator 权限）
   gcloud storage sign-url gs://taluna-api-result/api/video/deploy-probe_0.bin \
     --duration=10m --impersonate-service-account=<SA_EMAIL>
   curl -sf -o /dev/null -w '%{http_code}\n' '<signed_url>'   # 必须输出 200
   ```
   网关进程启动时也会做一次 V4 签名自检，凭证不可用会直接 fatal 退出（见第 5 条）。
3. **bucket 生命周期规则**：配置 30 天删除，且**必须与 `GCS_RESULT_RETENTION_DAYS=30` 保持一致**
   ——读取侧的过期判断完全依赖该一致性。不建议转 Coldline（302 直连签名 URL 会把取回费
   打到项目账上且无限流）。
4. **超时三方约束**（违反会导致在途转存被误杀退款）：
   - `TASK_TIMEOUT_MINUTES`（默认 1440）必须**显著大于**「最长上游生成时间 + `GCS_TRANSFER_DEADLINE`」；
   - `GCS_TRANSFER_DEADLINE`（默认 2h）必须远大于 `GCS_TRANSFER_TIMEOUT`（默认 10m）与最坏排队
     时间，且小于各渠道上游直链的最短时效。
5. **启动行为**：`GCS_TRANSFER_ENABLED=true` 时凭证缺失/格式错/签名自检失败会 **fatal 阻止进程
   启动**（转存是计费关键路径，不带病启动）。
6. **凭证部署到所有实例**：读取侧现签跑在每个副本上，不只 master。
7. **时钟**：V4 签名对本地时钟敏感（偏差 >15 分钟被 GCS 拒绝），所有实例需 NTP 保障。
8. **Workload Identity 环境**（无 SA key 文件时）：SA 需额外授予
   `roles/iam.serviceAccountTokenCreator`；每次签名是一次 IAM `SignBlob` 网络调用，
   保持 `GCS_SIGN_CACHE_TTL` 开启以抑制高频轮询客户端的放大。
9. **告警接入**：见第 4 节，至少接入卡死哨兵（恒为 0）、转存积压量与超截止退款 quota。

---

## 4. 可观测性（gcs-metrics 日志）

指标以结构化日志输出（进程内原子计数器 + 周期统计行），可被日志采集系统直接抽取：

- `gcs-metrics counters ...`：每分钟一行（有变化才打印），进程启动以来的累计计数器：
  `success / exists_reuse / download_fail / gcs_auth_fail / gcs_service_fail / internal_fail /
  oversize / corrupt_object / extract_fail / deadline_exhausted / deadline_refund_quota /
  cas_lost / degrade_complete / sign_fail_auth / sign_fail_service / result_expired /
  billing_adjust_fail`，及 gauge `inflight / poll_backlog` 与 `queue_wait_avg_ms / queue_wait_max_ms`。
- `gcs-metrics duration platform=<渠道> ...`：每渠道转存耗时直方图（桶 5s/15s/60s/5m/10m/+Inf，
  含 sum_ms/count）。
- `gcs-metrics sentinel ...`：master 节点每 5 分钟的 DB 哨兵：
  - `stuck_inprogress_100`：`status=IN_PROGRESS AND progress='100%'` 的任务数，**必须恒为 0**
    （非 0 = 任务永久卡死、资金悬置，error 级告警，需人工介入）；
  - `transfer_backlog_db`：转存阶段任务全量积压（轮询集合按 `TASK_QUERY_LIMIT` 截断，
    积压过多会饿死新任务轮询，需告警并考虑紧急开关止血）。
- 事件级日志：`gcs-transfer success/fail kind=<分类>/exists-reuse/extract-fail/deadline-exhausted/
  cas-lost/degrade-complete`、`gcs sign-fail`、`billing-adjust-fail`。

**告警建议**：`stuck_inprogress_100 > 0`（最高优先级）；`deadline_refund_quota` 增长（资损：上游已
成功却退款）；`gcs_auth_fail` 上升（凭证失效，与 `gcs_service_fail` 的 GCS 服务故障区分）；
`download_fail` 上升（上游 CDN 直链提前过期）；`transfer_backlog_db` 持续增长（GCS 故障积压）。
