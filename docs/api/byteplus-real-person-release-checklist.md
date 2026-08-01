# BytePlus 真人素材库发布检查清单

本清单门禁 `https://router.flatkey.ai` 的 certified-profile、certified-asset、本地上传、Seedance reference、delete 发布。任何失败项都不得延期处理；未运行、无数据、缺少授权或证据不完整均为发布 NO-GO。

## 发布身份

| 字段 | 值 |
| --- | --- |
| Release commit | 未指定（当前为 NO-GO；转为 GO 前必须由获授权发布者填写最终 release commit，并针对该精确提交重新运行和签署本清单全部门禁） |
| Local evidence snapshot | 当前条目为 `2026-08-01` 本地证据快照，不构成 release authorization |
| Staging revision | 不可用：本任务未部署、未查询外部 staging 修订 |
| Production router revision | 不可用：本任务禁止触碰生产 |
| Production console revision | 不可用：本任务禁止触碰生产 |
| Verification date/operator | `2026-08-01` / Codex Executor |

## A. 外部前置条件

- [ ] staging/prod 分别具备 BytePlus invited-only real-person asset library permission 和 Advanced Creation Rights。
- [ ] 每个启用 channel 都有同区域 private TOS bucket、最小权限 identity、24h lifecycle。
- [ ] staging/prod 分别配置独立 HTTPS `BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL`。
- [ ] 32-byte app encryption key 已通过 Secret Manager 注入所有 Go verifier/reconciler 节点。
- [ ] 仅已验证 channel 设置 `real_person_assets.enabled=true`，legacy keys 不会自动启用。
- [ ] DB account 可创建新表、nullable columns、indexes。

官方复核链接：

- ModelArk docs 2333589: <https://docs.byteplus.com/en/docs/ModelArk/2333589>
- ModelArk docs 2333602: <https://docs.byteplus.com/en/docs/ModelArk/2333602>
- ModelArk docs 2333587: <https://docs.byteplus.com/en/docs/ModelArk/2333587>
- ModelArk docs 2333588: <https://docs.byteplus.com/en/docs/ModelArk/2333588>
- ModelArk docs 2318271: <https://docs.byteplus.com/en/docs/ModelArk/2318271>
- ModelArk docs 2318278: <https://docs.byteplus.com/en/docs/ModelArk/2318278>
- ModelArk docs 2341606: <https://docs.byteplus.com/en/docs/ModelArk/2341606>
- ModelArk docs 2551760: <https://docs.byteplus.com/en/docs/modelark/2551760>
- Virtual guide 2333565: <https://docs.byteplus.com/en/docs/ModelArk/2333565>

发布证据只记录官方文档复核日期，不记录登录态页面内容、凭据或控制台敏感信息。本轮仅打开公开文档链接核对可达性和标题线索；未取得登录态权限证据。

## B. 自动化证据

| Gate | 命令或证据 | 实际结果 / exit code | 发布影响 |
| --- | --- | --- | --- |
| Targeted race | `go test -race ...` | NOT RUN：用户明确禁止运行 `go test -race` | NO-GO |
| Targeted functional regression | `go test ./model ./service ./controller ./router ./middleware ./dto ./types ./pkg/perf_metrics ./relay/channel/task/byteplus -run 'APIIdempotency|BytePlus|RealPerson|AssetReference|Callback|SensitiveRequestPath|Multipart' -count=1` | PASS，exit 0；9 个 package 均 `ok` | 可作为局部功能证据 |
| Targeted vet | `go vet ./model ./service ./controller ./router ./middleware ./dto ./types ./pkg/perf_metrics ./relay/channel/task/byteplus` | PASS，exit 0 | 可作为局部静态证据 |
| Full vet | `go vet ./...` | FAIL，exit 1；首个相关失败：`main.go:46:12: pattern web/classic/dist: no matching files found` | NO-GO；该 root package 缺少 `web/classic/dist` 为本轮实际观察到的环境/基线问题，不在 feature diff 内 |
| Full build | `go build ./...` | FAIL，exit 1；首个相关失败：`main.go:46:12: pattern web/classic/dist: no matching files found` | NO-GO；同上，root embed failure 不在 feature diff 内 |
| Full tests | `go test ./... -count=1` | TIMEOUT，exit 124；原始 full suite 304040 ms 超时。120s guarded reproduction 先输出 `main.go:46:12: pattern web/classic/dist: no matching files found`，随后卡在长包；`go test ./controller -count=1 -timeout=30s -v` 超时定位到 pre-existing `TestListRecallAudienceUsersSearchesByKeywordWithBounds` -> `setupRecallControllerHarness` -> SQLite/GORM AutoMigrate（`controller/recall_campaign_test.go` 未由 feature 修改）；110s 后续定位到 pre-existing Stripe setup -> SQLite/GORM AutoMigrate（`controller/topup_stripe_test.go` 未由 feature 修改）；non-root/non-controller bounded batch 超时在 `service/recall_audience_test.go` setup AutoMigrate（未由 feature 修改）；legacy slices 单独可过但慢：controller Recall ~58.7s，Stripe ~62.1s；feature 证据 `go test ./controller -run '(BytePlus\|RealPerson)' -count=1 -timeout=60s -v` PASS，package 0.449s、wall ~5.1s | NO-GO；full-suite stall 归类为 baseline/environment-heavy legacy SQLite/GORM setup，未定位到 BytePlus real-person tests；feature 会增加总负载，不能声称 full suite 通过 |
| SQLite migration | `Remove-Item Env:TEST_MYSQL_DSN; Remove-Item Env:TEST_POSTGRES_DSN; go test ./model -run TestBytePlusRealPersonDialectMigrations -count=1 -v` | PASS，exit 0；`sqlite` PASS | 可作为 SQLite smoke 证据 |
| MySQL migration | 同上；随后仅检查 `TEST_MYSQL_DSN` 是否非空 | SKIP/NOT RUN；`TEST_MYSQL_DSN=missing` | NO-GO |
| PostgreSQL migration | 同上；随后仅检查 `TEST_POSTGRES_DSN` 是否非空 | SKIP/NOT RUN；`TEST_POSTGRES_DSN=missing` | NO-GO |
| OpenAPI router contract | `go test ./router -run TestBytePlusRealPersonOpenAPIContract -count=1` | PASS，exit 0 | 可作为 router contract 证据 |
| OpenAPI JSON UTF-8 parse | `Get-Content -Raw -Encoding UTF8 docs/openapi/relay.json,docs/openapi/api.json \| ConvertFrom-Json` | PASS，exit 0；两个 JSON 文件均可解析 | 可作为格式证据 |
| OpenAPI `api.json` remote-baseline diff | `git diff --quiet origin/main...HEAD -- docs/openapi/api.json` | PASS，exit 0；当前远端 baseline 无 `docs/openapi/api.json` diff。先前 `main...HEAD` 检查失败是因为本地 `main=2d1c941a445da943ea01f9bc889f25d264b269a4` 落后于 `origin/main=b96d2215a95748c5722bdfd158805c4fc5b9c470`，该证据无效 | 可作为 OpenAPI baseline 证据 |
| Secrets scan | 对 `git diff --diff-filter=ACMR --name-only origin/main...HEAD` 的每个文件逐个扫描 `(AKIA\|AKLT)[A-Za-z0-9]{16,}\|sk-[A-Za-z0-9_-]{24,}\|X-Tos-Signature=[A-Fa-f0-9]{16,}\|-----BEGIN (RSA \|EC \|OPENSSH )?PRIVATE KEY-----` | PASS，exit 0；0 matches。RED 为修复前 2 hits：`service/byteplus_asset_client_test.go:199,215`，均为测试用 fake leak sentinel；已替换为短占位符 `sk-mismatch-leak` | 可作为 secret-pattern gate 证据 |

本轮使用 `GOCACHE=E:\go-cache\build` 和 `GOTMPDIR=E:\go-cache\tmp-task13`。未观察到 Windows SQLite `TempDir` handle 问题；不得把受影响/新增 feature 失败标为 baseline。

## C. 受控 BytePlus/TOS 集成矩阵

证据只允许记录 Flatkey public IDs、HTTP status、redacted log queries；不得记录 tokens、callback token、BytedToken、signed URLs、GroupId、upstream AssetId 或 object keys。

前置检查仅确认存在性，不输出值：

| 变量/素材 | 状态 |
| --- | --- |
| `FLATKEY_TOKEN_USER_A` | missing |
| `FLATKEY_TOKEN_USER_B` | missing |
| `PERSON_A1_ID` | missing |
| `PERSON_A2_ID` | missing |
| `REAL_PERSON_HTTPS_URL` | missing |
| `REAL_PERSON_IMAGE_FILE` | missing |
| `REAL_PERSON_VIDEO_FILE` | missing |
| `REAL_PERSON_AUDIO_FILE` | missing |

本任务没有 staging 变更授权；即使素材齐全也不得执行真实外部变更调用。本轮所有适用集成行均 NOT RUN，发布 NO-GO。

| 场景 | 期望结果 | 本轮证据 |
| --- | --- | --- |
| User A person 1 | Active，唯一 `rph_` | NOT RUN：缺少凭据/素材/授权 |
| User A person 2 | Active，且 `rph_` 与 person 1 不同 | NOT RUN：缺少凭据/素材/授权 |
| User B query/reference A | 404 | NOT RUN：缺少凭据/素材/授权 |
| HTTPS URL Image | Active | NOT RUN：缺少凭据/素材/授权 |
| local Image <30 MiB success and 30 MiB reject | 小于 30 MiB 成功；30 MiB 拒绝 | NOT RUN：缺少凭据/素材/授权 |
| local Video <=50 MiB success and oversize reject | 小于等于 50 MiB 成功；超限拒绝 | NOT RUN：缺少凭据/素材/授权 |
| local Audio <=15 MiB success and oversize reject | 小于等于 15 MiB 成功；超限拒绝 | NOT RUN：缺少凭据/素材/授权 |
| wrong MIME/format and multiple faces | 稳定 public error，不透传 upstream text | NOT RUN：缺少凭据/素材/授权 |
| same-person multiple assets | Seedance submit | NOT RUN：缺少凭据/素材/授权 |
| same-channel virtual + one real | submit | NOT RUN：缺少凭据/素材/授权 |
| two real profiles | pre-upstream 409 `asset_profile_conflict` | NOT RUN：缺少凭据/素材/授权 |
| first/repeated DELETE | 204 且仅一次 upstream delete | NOT RUN：缺少凭据/素材/授权 |
| after delete new reference | 立即拒绝 | NOT RUN：缺少凭据/素材/授权 |
| TOS cleanup success | 删除 object | NOT RUN：缺少凭据/素材/授权 |
| cleanup failure | outbox 重试 + 24h lifecycle | NOT RUN：缺少凭据/素材/授权 |
| callback lost/duplicate/out-of-order | 收敛，old session 不能覆盖 new session | NOT RUN：缺少凭据/素材/授权 |
| logs/API | 不含 sensitive field/full source URL | NOT RUN：缺少凭据/素材/授权 |

## D. 部署建议

- Router deploy required。
- `newapi-console` same version required，因为共享 Go binary、DB、migrations、reconcilers。
- 先 staging；remote `staging` branch 触发 `gcp-deploy-staging.yml`。
- website not required；本发布没有 website changes。
- Terraform/Cloudflare not required；TOS 是外部前置条件。
- production only after authorized user merges feature PR to `main`；push 触发 `gcp-deploy.yml`；console + router 均需 approvals；`workflow_dispatch` 仅用于二者 manual rerun；automated agent never merges/pushes `main`。

本任务未触发部署、workflow、push、merge 或生产操作。

## E. 观测门禁

完成 C 且清除故障后，等待一个 30s scrape；第 1 分钟用 random-nonexistent-token 对 GET + POST callback probes 取证；随后至少观察 30 分钟。custom metrics 使用 Grafana Google-Prometheus；Cloud Run 使用 Cloud Monitoring PromQL。Counters 用 `sum(increase(...))`，gauges/last-success 用 `max(...)`。每项必须记录 start/end time、data source、可复现 query、value、link/redacted screenshot。missing、no-data、series missing 均为 NO-GO，不能当作 0。

本轮没有授权 staging window，未等待 30 分钟，未调用 staging probes；以下全部 NOT RUN/NO-GO。

| Gate | Query / threshold | 本轮证据 |
| --- | --- | --- |
| unknown outcome | `sum(increase(newapi_byteplus_real_person_outcome_unknown_total[30m]))` = 0 | NOT RUN/NO-GO |
| reconcile error | `sum(increase(newapi_byteplus_real_person_reconcile_total{result="error"}[30m]))` = 0 | NOT RUN/NO-GO |
| callback bad statuses | `sum(increase(newapi_byteplus_real_person_callback_total{status=~"429|other_4xx|5xx"}[30m]))` = 0 | NOT RUN/NO-GO |
| callback 2xx probes | `sum(increase(newapi_byteplus_real_person_callback_total{status="2xx"}[30m]))` >= 2，明确覆盖 GET+POST probes | NOT RUN/NO-GO |
| reconcile freshness | `time() - max(newapi_byteplus_real_person_reconcile_last_success_unixtime)` < 90s | NOT RUN/NO-GO |
| ending backlog | ending `max by (kind) (newapi_byteplus_real_person_backlog{kind=~"deleting|tos_cleanup_due"})` both 0 | NOT RUN/NO-GO |
| oldest age | `max_over_time((max by (kind) (newapi_byteplus_real_person_backlog_oldest_update_age_seconds{kind=~"deleting|tos_cleanup_due"}))[30m:])` both kinds < 300s | NOT RUN/NO-GO |
| staging Cloud Run 5xx | `sum(increase(run_googleapis_com:request_count{monitored_resource="cloud_run_revision",service_name="newapi-staging",response_code_class="5xx"}[30m]))` threshold 0 | NOT RUN/NO-GO |

## F. 回滚

Capability-level rollback first：

1. disable `real_person_assets.enabled` on all channels to block new creates；
2. keep callback/query/delete/poll/outbox cleanup alive；
3. preserve tables/columns/indexes, upstream groups, tombstones/outbox/idempotency ledger；
4. drain sessions/Deleting/assets/temp objects；
5. only severe binary fault after drain permits gcp-rollback router+console；never revive legacy newapi。

Drill evidence fields：

| 字段 | 本轮证据 |
| --- | --- |
| disabled time | NOT RUN |
| new creates blocked | NOT RUN |
| convergence paths healthy | NOT RUN |
| drained | NOT RUN |
| re-enable decision | NOT RUN |

回滚演练未执行，发布 NO-GO。以下仅为 runbook 示例，未执行：

```powershell
# Example only: disable capability for each verified channel, then keep workers alive.
# Do not drop tables, clear tombstones, clear outbox, or revive legacy newapi.
# Example only, not executed:
gh workflow run gcp-rollback.yml -f rollback_target=router -f revision=$env:PREVIOUS_ROUTER_REVISION
gh workflow run gcp-rollback.yml -f rollback_target=console -f revision=$env:PREVIOUS_CONSOLE_REVISION
```

## G. 发布决定

- [ ] 自动化门禁全部通过
- [ ] 受控 BytePlus/TOS 集成矩阵全部通过
- [ ] 回滚演练完成且证据齐全
- [ ] router + console same-version plan 明确，且 website no deploy

仅当以上四项全部满足时允许 GO。本轮发布决定：`NO-GO`。

阻塞项：

- Targeted race 未运行：用户明确禁止 `go test -race`。
- Full vet/full build 失败：`web/classic/dist` 缺失导致 root package embed pattern 失败；该环境/基线问题不在 feature diff 内，但本地 full gates 仍失败。
- Full tests 超时：`go test ./... -count=1` 304040 ms 后 exit 124；bounded localization 指向 pre-existing legacy SQLite/GORM AutoMigrate stalls（Recall/Stripe/controller 与 `service/recall_audience_test.go`），BytePlus/RealPerson controller slice 通过，但 full suite 仍未通过。
- MySQL/PostgreSQL dialect migration 未运行：`TEST_MYSQL_DSN`、`TEST_POSTGRES_DSN` 缺失。
- BytePlus/TOS/staging 凭据、测试素材、staging 变更授权缺失；受控集成矩阵未运行。
- 30 分钟观测窗口、callback probes、metrics/Grafana/Cloud Run 证据未运行。
- rollback drill 未运行。
