# ModelTrace Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. 总控提供每个任务的完整指令；唯一实现子代理串行写入；每任务完成后先独立规格审查，再独立质量审查。Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在独立 smart-router 内交付 ModelTrace 的挑战、手动/主动分析、指纹库管理、Web/静态工作台、Go 数字证据桥接、持久化与 shadow 查询闭环。

**Architecture:** 固定上游 Python 数值核心，operator 平面独立采集，Go 只接收数字证据和保存归因摘要。原 routerd 的路由/结算合同不变；新 daemon/CLI 用独立鉴权和监听配置；所有实施、测试、缓存与审查在独立 worktree 进行。

**Tech Stack:** Go 1.23+、Python 3.11+、NumPy、Flask、stdlib unittest、SQLite/modernc、HMAC-SHA256、Dockerfile、浏览器测试。

---

## 状态、固定输入和范围

`APPROVED_AND_EXECUTING`。本计划不代表实现完成，不自动取得 P5、真实
provider、生产 Host、生产数据库、Docker/SSH 或发布权限。

- Spec：`docs/superpowers/specs/2026-10-12-modeltrace-integration-design.md`。
- 本地 base：`1259d424ac07976b596058d7fb3f011549617298`。
- 上游 base：`6cd4a8ff0f3f4e49d6d6969dd2fbadfa1569fde2`。
- 上游初始只读 clone：`/private/tmp/modeltrace-upstream-20261012`。
- 独立执行 worktree：`/private/tmp/smart-router-modeltrace-20261012`。
- 分支：`feat/modeltrace-integration-20261012`。
- 临时 evidence/venv/cache：`/private/tmp/smart-router-modeltrace-evidence-20261012`。
- 用户交付代码最终仍归属 `/Users/bytedance/newapi/smart-router` 子仓库；
  完成时保留独立分支供审阅，不自动合并 main。
- 已登记共享 handoff 独立标题：
  `2026-10-12 Smart Router ModelTrace Integration Planning Occupancy`。

当前恢复执行位置（2026-10-13）：临时 worktree 曾被外部清理，保留全部
Git 历史与旧注册，迁至持久 linked worktree
`/Users/bytedance/.local/share/trae-worktrees/smart-router-modeltrace-20261013-rescue3`，
分支 `feat/modeltrace-integration-20261013-rescue3`。中间证据/缓存放在
`/Users/bytedance/.local/share/modeltrace-evidence-20261013`；正式审查报告放在
`/Users/bytedance/newapi/modeltrace-evidence-rescue2-20261012/tasks`。

### 全任务共同的不可省略闭环

每个新增行为先写一个命名断言，运行并记录 exit code 和输出。RED 必须是
目标能力缺失导致的断言失败，不能以 import error、语法错或缺环境冒充。
必要时测试使用动态导入/能力探测并 `assert`，避免模块尚不存在时 collection error。
minimal GREEN 只实现当前断言要求；后续行为各自重复 RED/GREEN。
自审后固定任务 commit。规格 reviewer 独立读 code/test/evidence；PASS 后
才派质量 reviewer。所有 Critical/Important 均修复并重审为 PASS 才推进。

Go 单元测试使用 `GOWORK=off GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off
GOMAXPROCS=2 go test -p 2` 加各 task 列出的包，deps 在隔离 setup 预备。Python 使用隔离 venv，
`PYTHONDONTWRITEBYTECODE=1`，测试 tempdir。不并行跑三轮、不跑 NewAPI 测试。
测试日志不得记录 raw prompt/body/key，命令不得输出完整环境/完整进程命令行。

## 文件地图和分工

以下路径相对于执行 worktree；文档的初始两文件仅总控写。每个 task 开始前
总控登记本 task 精确占用，之前的 implementation 占用关闭；reviewers 只读，
报告归临时 evidence，最终汇总到新 `MODELTRACE-VERIFICATION.md`。

| Task | 执行者 | Create / Modify |
| --- | --- | --- |
| 0 | 总控 | 独立 worktree/branch、临时 baseline evidence；仅更新自身 handoff |
| 1 | 来源封存实现代理 | `third_party/modeltrace/{PROVENANCE.json,SHA256SUMS,LICENSE,README.md,fingerprint.py,bank_builder.py,challenge_suite.py,enrollment.py,app.py,rebuild_unified_bank.py,requirements.txt,start.py,upstream-source.tar.gz}`；该目录 `data/`、`static/`、`templates/`；`modeltrace_runtime/__init__.py`；`modeltrace_runtime/tests/{__init__.py,test_distribution.py}` |
| 2 | 数值引擎实现代理 | `modeltrace_runtime/{engine.py,bank_validation.py,worker.py}`；`modeltrace_runtime/tests/{test_engine.py,test_bank_validation.py,test_worker.py}` |
| 3 | 建库实现代理 | `modeltrace_runtime/{bank_store.py,numeric_rows.py}`；`modeltrace_runtime/tests/{test_bank_store.py,test_numeric_rows.py}` |
| 4 | 主动采集实现代理 | `modeltrace_runtime/{transport.py,collection.py,operations.py}`；`modeltrace_runtime/tests/{test_transport.py,test_collection.py,test_operations.py}` |
| 5 | Go 桥接实现代理 | `modeltrace/{evidence.go,result.go,engine.go,process.go}` 和对应 `_test.go`；强化既有 `modeltrace/modeltrace_test.go`；`modeltrace_runtime/RUNTIME-MANIFEST.json` |
| 6 | 持久化实现代理 | `store/modeltrace.go`、`store/modeltrace_test.go`；`migrations/{sqlite,mysql,postgres}/003_modeltrace.sql`；`modeltrace/service.go`、`service_test.go` |
| 7 | CLI/daemon 实现代理 | `modeltraceapi/{types.go,auth.go,server.go}` 及测试；`cmd/{modeltrace,modeltraced}/main.go` 及测试；`config/modeltrace.go`、`modeltrace_test.go` |
| 8 | 工作台实现代理 | `modeltrace_runtime/workbench.py`、`modeltrace_runtime/tests/test_workbench.py`；`modeltrace_runtime/web/{index.html,app.js}`；`modeltrace_runtime/static-manual/` 使用受控上游静态页；`modeltrace_runtime/export.py`、`modeltrace_runtime/tests/test_export.py` |
| 9 | 集成/分发实现代理 | `tests/integration/modeltrace_test.go`；`modeltrace_runtime/tests/test_end_to_end.py`；`modeltrace_runtime/{requirements.in,requirements.lock}`；`Dockerfile.modeltrace-engine`、`Dockerfile.modeltrace-workbench`、`compose.modeltrace.yaml`；`README.md`、`integration-required.yaml`、`FINAL-MANIFEST.md`、`SHA256SUMS`、`MODELTRACE-VERIFICATION.md` |

不修改 `routing/`、`internal/catalog/`、`connectors/`、`fingerprint/`、
`cmd/probeworker/`、既有 `cmd/routerd/` 或 NewAPI 任意源码。
归因单独持久化，不搭载 synthetic observation 通道、不影响 breaker。
如新增依赖闭包或改动上述范围，先更新本任务设计/文件登记再写。

## Task 0：隔离、基线与写者注册

- [x] 在 smart-router 检查 `git status --short --branch`、`git rev-parse HEAD`、
  `git worktree list --porcelain`。必须保持已核对 base 和 clean；若有并发改动，
  记录发现并在不覆盖的独立 base 上继续，不 reset/stash/clean。
- [x] 检查是否有 native worktree tool；没有则执行：

```bash
git -C /Users/bytedance/newapi/smart-router worktree add \
  /private/tmp/smart-router-modeltrace-20261012 \
  -b feat/modeltrace-integration-20261012 \
  1259d424ac07976b596058d7fb3f011549617298
```

- [x] 在独立临时 root 创建 venv/cache。先检查 Go/Python 版本和可用依赖；
  只有 task-local 缺失依赖才安装。基线只运行 smart-router：

```bash
GOWORK=off GOTOOLCHAIN=local GOMAXPROCS=2 go test -p 2 ./...
GOWORK=off GOTOOLCHAIN=local GOMAXPROCS=2 go vet -p 2 ./...
```

预期 exit0；基线失败先定位是否环境/既有错误，不改 P5、不冒称 GREEN。

- [x] 记录原有 `/Users/bytedance/newapi/smart-router` HEAD、tracked diff、
  原始 schema 和 36×3 matrix 合同；P5 只记录 exclusion，禁止为本任务
  访问其 protected evidence 或调用其控制器。
- [x] 将两份审阅通过文档精确复制到 feature branch，定向 `git add` 两文件
  后提交 `docs: plan isolated ModelTrace integration`；不带入其他目录文件。

## Task 1：固定 upstream 分发和来源

**首个 RED，`modeltrace_runtime/tests/test_distribution.py`：**

```python
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

class DistributionTests(unittest.TestCase):
    def test_distribution_is_pinned_and_core_bytes_match(self):
        vendor = ROOT / "third_party" / "modeltrace"
        self.assertTrue((vendor / "PROVENANCE.json").is_file(),
                        "pinned upstream distribution is missing")
        manifest = json.loads((vendor / "PROVENANCE.json").read_text())
        self.assertEqual(manifest["commit"],
                         "6cd4a8ff0f3f4e49d6d6969dd2fbadfa1569fde2")
        self.assertEqual(
            hashlib.sha256((vendor / "fingerprint.py").read_bytes()).hexdigest(),
            "387fe5c44cc5f859995432267b0d3b462fc26e82419fc22e3ee7f36cc2502d98")
```

- [x] Run `python -m unittest modeltrace_runtime.tests.test_distribution -v`，
  预期 assertion “pinned upstream distribution is missing”。
- [x] minimal GREEN：从固定 clone **逐文件**复制 file map 的 source/data/web；
  `git archive` 固定 revision 到 `upstream-source.tar.gz`，Codex plugin 仅在
  inert archive 中，不产生被 skill/hook discovery 识别的文件。
  PROVENANCE 写 source URL、commit、license、完整 per-file SHA256。
- [x] 分别 RED/GREEN：
  `test_license_is_preserved`、`test_every_vendor_byte_is_manifested`、
  `test_archive_retains_optional_guard_without_installed_hooks`、
  `test_distribution_has_no_git_or_runtime_state`。校验 unified bank
  `f267d0513aa06981d024ec5394746fceddf44e4e8a75fa6bf8304255f4b32d6d`、
  LICENSE `238afb57e498990742f84b9ce6167b4e256ac06104a9938ce953bc41c14bea51`。
- [x] 全 task GREEN、自审、定向提交 `build: pin ModelTrace source and license`；
  独立 spec -> quality 两审 PASS 后关闭占用。

## Task 2：数字评分与只读 stdio worker

**接口签名与职责：**

| 文件 | 签名 | 职责 |
| --- | --- | --- |
| `engine.py` | `analyze_samples(samples: list[dict], bank: dict) -> dict` | 数字输入，输出全局评分/家族/diagnostics，不联网 |
| `bank_validation.py` | `validate_bank(bank: dict) -> None` | 完整校验，失败抛稳定 `ValueError` |
| `worker.py` | `process(request: dict) -> dict` | 验证worker合同、bank revision，调用engine，封装稳定结果 |

输出结构沿用 spec 摘要，
worker 从配置读取受控 bank 路径，request 仅 `schema_version/bank_revision/
samples`；不允许 request 提供脚本、路径或自由环境变量。

**首个 RED：**

```python
import importlib.util
import unittest

class EngineTests(unittest.TestCase):
    def test_numeric_engine_exists_without_loading_web_or_transport(self):
        location = importlib.util.find_spec("modeltrace_runtime.engine")
        self.assertIsNotNone(location, "numeric engine is missing")
        from modeltrace_runtime import engine
        self.assertTrue(callable(getattr(engine, "analyze_samples", None)),
                        "numeric scoring adapter is missing")
```

- [x] Run `python -m unittest modeltrace_runtime.tests.test_engine -v`，
  预期 assertion。先具备空 package `__init__.py`，不以 import exception当 RED。
- [x] 存在性minimal GREEN只建立模块和可调用
  `analyze_samples`，调用时抛稳定 `NotImplementedError`，不实现评分。
- [x] 新测试将 vendor reference 已有 `text` 经原 `parse_numbers` 转数字，
  用原 `analyze_global_outputs` 作为 oracle；对 1/2/3 份输出比较全部
  model/family prediction、probabilities、scores、profile_similarity、
  calibration 和 diagnostics，浮点绝对误差<=`1e-10`。
- [x] 先运行 `test_one_sample_parity` 并观察缺失评分的assertion RED，
  然后只实现一份有效回答的 `robust_score_numbers/count_numbers`、原
  aggregation/softmax。再为 `test_two_sample_parity`、
  `test_three_sample_parity`、`test_family_probability_parity` 各自
  RED后扩展；不可在存在性RED后一次写完完整引擎。
- [x] 逐行为 RED/GREEN：`test_one_two_three_sample_parity`、
  `test_ordered_features_preserve_sequence`、
  `test_bank_rejects_wrong_dimension_or_model_order`、
  `test_bank_rejects_nonfinite_scale_centroids_and_calibration`、
  `test_no_valid_outputs_is_stable_error`、
  `test_worker_never_imports_app_or_enrollment`、
  `test_worker_output_omits_numbers_raw_text_and_prompt`。
- [x] Bank 校验固定 schema/range/355和74维、正 scale、finite beta、
  非空 unique model IDs、model_order一致、<=256 models/32 families、
  1/2/3 calibration；bank file<=16 MiB，解析时拒绝 NaN/Infinity。
  用实际 bytes SHA256，不对 reserialized JSON 算 revision。
- [x] worker 输入只请求revision，bank由受控配置/manifest选定；有界读取一次
  bank bytes、先验证SHA再parse，测试读取后原文件换版不影响本次计算。
- [x] Run `python -m unittest discover -s modeltrace_runtime/tests -v`，
  task GREEN 后提交 `feat: add numeric ModelTrace engine`，双审。

## Task 3：脱敏 reference 与原子 bank 管理

**接口签名与职责：**

| 单元 | 签名 | 职责 |
| --- | --- | --- |
| `numeric_rows.py` | `normalize_row(row: dict) -> dict` | 数字/标识白名单，派生counts/validity |
| `numeric_rows.py` | `read_numeric_rows(path) -> list[dict]` | 有界JSONL读取，无raw text依赖 |
| `BankStore` | `__init__(self, root)` | 精确独立state root |
| `BankStore` | `create(self, bank_id: str, label: str) -> dict` | 注册空bank，不加入active评分库 |
| `BankStore` | `enroll(self, bank_id: str, rows: list[dict]) -> dict` | 校验/追加数字reference，拟合family和global |
| `BankStore` | `rebuild(self) -> dict` | 汇合全部已有效建库family，原子发布 |
| `BankStore` | `summary(self) -> dict` | 只读model/family/counts/revision汇总 |

发布在单 writer lock 下：读 manifest -> 数字 reference -> vendor
`build_bank` -> 临时 generation -> verify -> 原子替换 current manifest。
manifest 关联完整 generation，读者不能看到 bank/ref 混合版本。
builtin public raw reference 由受控 loader 首次转成数字，不写回 vendor。

**首个 RED：**

```python
def test_numeric_rows_do_not_need_text(self):
    import importlib.util
    self.assertIsNotNone(importlib.util.find_spec("modeltrace_runtime.numeric_rows"),
                         "sanitized row loader is missing")
    from modeltrace_runtime.numeric_rows import normalize_row
    row = normalize_row({
        "row_id": "row-1", "source": "sample-model",
        "condition_id": "environment-01", "challenge_id": "query-01",
        "expected_count": 0, "numbers": [17] * 80})
    self.assertEqual(row["counts"][16], 80)
    self.assertNotIn("text", row)
```

- [x] Run `python -m unittest modeltrace_runtime.tests.test_numeric_rows -v`，
  确认目标缺失 assertion；minimal GREEN normalize 白名单：
  row/source/family_id/family_name/condition_id/nuisance_condition_id/
  challenge_id/expected_count/numbers/time。
  派生 counts/strict_valid，绝不要求上游 `read_rows` 的 raw text。
- [x] RED/GREEN：
  `test_sanitized_fit_matches_original_fit`、
  `test_custom_bank_is_included_in_unified_rebuild`、
  `test_model_label_collision_is_rejected_across_families`、
  `test_bank_id_traversal_is_rejected`、
  `test_failed_fit_preserves_manifest_and_previous_generation`、
  `test_concurrent_enrollment_has_one_writer`、
  `test_restart_loads_committed_generation`、
  `test_nuisance_conditions_and_calibration_groups_are_preserved`、
  `test_bank_storage_does_not_contain_raw_or_secret_sentinels`。
- [x] 将同一批真实 vendor reference 的数字输入 original/sanitized fit，
  忽略 `built_at` 后比较模型/robust/calibration；不宣称新真实采集。
  自定义 bank ID `^[a-z0-9][a-z0-9-]{0,63}$`，新增同名不覆盖，
  原子操作失败不自动重放，重启 reconcile committed manifest。
- [x] 运行本 task + engine 全 tests，定向提交
  `feat: add atomic numeric fingerprint banks`，双审。

Task 3 完成于 `218915253c3a34e7e8a112de7af229ee97c6e5eb`。最终 SPEC R10
PASS（fresh 30/30 + 独立 48/48）；QUALITY R3 Resume PASS（fresh 24/24 +
独立 8/8）；Critical 0 / Important 0。实现提交的全量 98/98 是先前证据，
不冒称本次质量审查重跑。外部丢失的原始 RED chronology 保留为已接受的
非阻塞 process Minor；后续纠正具有独立记录的行为 RED/GREEN，不伪造旧日志。
正式报告：`task3-spec-r10.md`、`task3-quality-r3-resume.md`。

## Task 4：operator 主动采集、协议和单次提交

**接口签名与职责：**

| 文件 | 签名 | 职责 |
| --- | --- | --- |
| `transport.py` | `request_once(target: dict, challenge: dict, transport) -> dict` | 单次请求，两协议decode，status/parsed数字 |
| `collection.py` | `test_model(target: dict, transport, bank: dict) -> dict` | 三独立slot的完整/partial分析 |
| `collection.py` | `collect_rows(target: dict, transport, sample_count: int) -> dict` | 3..36 distinct enrollment slots，数字row输出 |
| `operations.py` | `Operations.begin(operation_id: str, parameter_digest: str) -> dict` | durable操作去重/冲突，不存key/URL |
| `operations.py` | `Operations.claim_slot(operation_id: str, slot_id: str) -> bool` | 独占fsync intent；已有intent不再POST |
| `operations.py` | `Operations.finish_slot(operation_id: str, slot_id: str, result: dict) -> None` | 数字终态/稳定status，原子持久化 |

`target` 是 operator-only Base URL/API model/ephemeral key/explicit
openai|anthropic，不跨 Go 边界。`transport` 负责 validation、无 redirect/
proxy 和一次提交；responses 不全量打印。

**首个 RED：**

```python
def test_unknown_write_calls_transport_once_and_stops(self):
    import importlib.util
    self.assertIsNotNone(importlib.util.find_spec("modeltrace_runtime.transport"),
                         "one-shot transport is missing")
    from modeltrace_runtime.transport import request_once
    calls = []
    def interrupted(request):
        calls.append(request)
        raise TimeoutError("synthetic interruption")
    result = request_once(
        {"base_url": "https://provider.example", "api_model": "sample-model",
         "api_key": "test-sentinel", "api_format": "openai"},
        {"id": "challenge-1", "prompt": "controlled test", "expected_count": 300},
        interrupted)
    self.assertEqual(len(calls), 1)
    self.assertEqual(result["status"], "write_unknown")
```

- [ ] Run `python -m unittest modeltrace_runtime.tests.test_transport -v`，
  先建立仅callable的stub返回unsupported，使status/次数断言RED；
  minimal GREEN仅注入transport调用一次并捕获TimeoutError为write_unknown，
  不实现两协议。随后OpenAI request shape RED后只实现OpenAI，再Anthropic
  shape RED后实现Anthropic。禁止调用vendor retry/fallback。
- [ ] RED/GREEN：
  `test_openai_unary_text_and_content_parts`、
  `test_anthropic_text_blocks_and_refusal`、
  `test_length_content_filter_max_tokens_are_not_valid_samples`、
  `test_explicit_protocol_does_not_fallback_after_400`、
  `test_three_independent_challenges_use_exactly_three_posts`、
  `test_partial_samples_are_not_reported_complete`、
  `test_enrollment_uses_unique_suite_slots_once`、
  `test_target_rejects_private_metadata_and_url_credentials`、
  `test_redirect_and_proxy_are_disabled`、
  `test_response_limit_aborts_and_stops_operation`、
  `test_slot_deadline_includes_resolution_and_reads`、
  `test_operation_replay_does_not_repeat_provider_post`、
  `test_unknown_operation_survives_restart_without_retry`、
  `test_changed_operation_parameters_conflict`、
  `test_crash_after_slot_intent_never_reposts`、
  `test_transport_errors_do_not_echo_provider_body_or_key`。
- [ ] 自动 test 精确生成3独立 challenge，每slot一次；不足回答返回 partial，
  不套上游“最多6个挑战”补发。建库sample_count3..36，使用完整12环境36
  suite 的确定选样方式，串行、一次/slot；第一 unknown 停整个操作。
  失败/partial计数与实际POST数一致。
- [ ] transport固定connect10秒、slot总deadline90秒、request64KiB、
  response256KiB、两protocol输出上限4096tokens。用owned one-shot child
  实现总deadline，DNS阻塞也能取消；超时/超限关闭、回收child、operation
  unknown，不自动重试。只有1active operation，每operation<=36slots。
- [ ] `operation_id`在auto/probe/enroll入口必填，begin保存参数哈希；
  同ID同哈希返回ledger终态或running/unknown，不执行网络，
  不同hash409。每slot意图durable创建后才POST；恢复把残留intent标unknown。
  ledger只存hash/slot/status/counts/numbers，不存target secrets或raw text。
- [ ] fake transport unit + 真实 loopback fake-provider HTTP 集成均 PASS，
  使用 explicit test-only loopback 注入；日志只写 count/status，不写 key。
- [ ] 提交 `feat: add bounded operator-only model collection`，双审。

## Task 5：Go 合同、摘要分类和 Python process bridge

**冻结 Go 类型与接口（各文件职责按地图）：**

```go
type Sample struct {
    ChallengeID string `json:"challenge_id"`
    ExpectedCount int `json:"expected_count"`
    Numbers []int `json:"numbers"`
}
type Evidence struct {
    SchemaVersion int `json:"schema_version"`
    ProbeID string `json:"probe_id"`
    BindingID string `json:"binding_id"`
    ClaimedModel string `json:"claimed_model"`
    Protocol api.Protocol `json:"protocol"`
    BankRevision string `json:"bank_revision"`
    Samples []Sample `json:"samples"`
}
type ModelScore struct {
    Model string `json:"model"`
    Family string `json:"family"`
    Probability float64 `json:"probability"`
    Score float64 `json:"score"`
    ProfileSimilarity float64 `json:"profile_similarity"`
}
type FamilyScore struct {
    Family string `json:"family"`
    Probability float64 `json:"probability"`
}
type Result struct {
    Prediction string `json:"prediction"`
    Probability float64 `json:"probability"`
    UsedOutputs int `json:"used_outputs"`
    Complete bool `json:"complete"`
    ClosedSet bool `json:"closed_set"`
    Assessment string `json:"assessment"`
    BankRevision string `json:"bank_revision"`
    EngineRevision string `json:"engine_revision"`
    Models []ModelScore `json:"models"`
    Families []FamilyScore `json:"families"`
}
type Engine interface {
    Analyze(context.Context, Evidence) (Result, error)
}
```

`Evidence.Validate()`、`Evidence.Digest()`、`Result.Validate()`、
`Assess(claimed string,result Result,threshold float64) string`；
`ProcessEngine` 实现 Engine，配置 Python绝对路径、worker路径、manifest/
bank路径和固定 limits。不允许证据控制执行路径。

**首个 RED 使用可编译的既有 lifecycle 测试强化：**

```go
func TestTraceJSONRejectsRawEvidenceFields(t *testing.T) {
    typ := reflect.TypeOf(Trace{})
    for _, field := range []string{"Prompt", "ProviderBody", "APIKey", "Numbers"} {
        if _, present := typ.FieldByName(field); present {
            t.Fatalf("trace contains forbidden field %s", field)
        }
    }
    // 生命周期既有能力之外的新 admission 必须逐行为断言 RED；
    // 接口文件先用仅返回 ErrUnsupported 的最小可编译 stub，不能用编译错当 RED。
}
```

上述既有边界测试可能已GREEN，只作为回归；首个新增RED为
`TestEvidenceRejectsNonOpaqueBinding`：stub `Validate` 返回 nil，
断言非法 ID 必须error；再 minimal GREEN canonical ID校验。随后每个行为
新增失败断言，不写完整产品实现再补测试。

- [x] RED/GREEN：1..3 samples/4096 bounds/整数range、重复challenge、
  stable digest、NaN/probability总和/model排序、
  `TestCompleteAnalysisIsNotAuthoritativeMatch`、
  `TestMissingClaimedLabelIsInconclusive`、
  `TestBankRevisionChangesEvidenceDigest`。
- [x] Process tests：受控测试 child 写合理/巨大/错误JSON，deadline取消、
  stderr sentinel、不继承自由env、invalid hash拒绝启动、child回收。
  核对文件bytes/hash/realpath与manifest后 `exec.CommandContext`，
  有界 stdin/stdout/stderr，不使用 shell、不靠 `CombinedOutput` 无界读取。
- [x] 新建 `modeltrace_runtime/RUNTIME-MANIFEST.json` 覆盖受控worker/adapter
  传递依赖，来源vendor manifest单独校验。bank选择支持固定路径或受控
  current-generation manifest；只引用immutable generation basename/SHA256，
  root containment/无symlink验证。新增
  `TestBankPublicationAffectsOnlyNextSubmission`、
  `TestBankManifestTraversalFailsBeforeChildLaunch`、
  `TestOldProbeKeepsItsOriginalBankRevision`，不复用vendor来源manifest
  假装worker自身已封存。
- [x] Run `go test -p 2 ./modeltrace -count=1` 与
  `go test -race -p 2 ./modeltrace -count=1`；再真实Python worker parity。
- [x] 提交 `feat: add typed ModelTrace process bridge`，双审。

Task5 补齐完成，固定源码 `8a223ed3292e010a945c073e15f463f77a413ca1`。
四源码、四测试、runtime manifest 与既有 Trace 边界回归已提交。实现者
完整 package/race 各 46 顶层/191 子测试 PASS；fresh SPEC R5 full 46/191
PASS，QUALITY R2 focused race 6/49 PASS 并复跑原 JSON alias probe；
两审 Critical 0 / Important 0。custom labels、conclusive partial、
empty-array snapshot 与 JSON field aliases 四项实际问题均已关闭。
正式报告在当前 Volume workspace 的 `modeltrace-evidence/tasks/`
下：`TASK5-VERIFICATION.md`、`task5-spec-r5.md`、`task5-quality-r2.md`。
Go1.23/Linux 未实跑；历史中间 minimal-body 证据限制、固定本机 Python、
可信 stdlib/NumPy 安装和受控 publication fixture 限制保留。
本次用户请求只关闭 Task5；Task4 独立审查仍待完成，Task6+ 未开始，
不代表完整 ModelTrace 集成通过。

## Task 6：durable probes、幂等和原子完成

**接口，`modeltrace/service.go` 只依赖 interface，避免 import cycle：**

```go
type Record struct {
    ProbeID string
    BindingID string
    ClaimedModel string
    Protocol api.Protocol
    EvidenceSHA256 string
    State State
    ObservedAt time.Time
    Result *Result
    ErrorCode string
}
type Repository interface {
    BeginProbe(context.Context, Evidence, string, time.Time) (Record, bool, error)
    CompleteProbe(context.Context, string, Result, time.Time) error
    FailProbe(context.Context, string, string, time.Time) error
    GetProbe(context.Context, string) (Record, error)
    LatestAttribution(context.Context, string, string, api.Protocol) (Record, error)
    RecoverInterrupted(context.Context, time.Time) error
}
type Service struct { Repository Repository; Engine Engine; Now func() time.Time }
```

Service 的公开签名为 `Submit(ctx context.Context, e Evidence) (Record, error)`；
实现必须在 RED 后写入。
`*store.DB` 实现 Repository；错误明确 duplicate-conflict/binding-mismatch/
not-found/interrupted，与既有 store 错误区分。

**首个 RED：** `TestProbeSurvivesSQLiteReopen` 用t.TempDir新DB，先
`BeginProbe`/`CompleteProbe`，关闭再开后查询应返回成功与相同摘要；
首次仅可编译 stub ErrUnsupported 导致目标 assertion RED。

- [ ] migrations add `modeltrace_probes`（probe ID PK、binding FK、model/
  protocol/digest/state/observed_ns/error）与 `modeltrace_results`（probe FK
  PK、bounded validated result JSON、completed_ns），latest composite index。
  不加列到health/fingerprints，数据库约束state/ID长度，不保存samples。
- [ ] 逐行为RED/GREEN：
  `TestProbeCompletionIsAtomic`（事务中失败时没有成功状态）、
  `TestSameEvidenceReplaysWithoutEngineExecution`、
  `TestChangedEvidenceConflicts`、
  `TestBindingModelProtocolMustMatch`、
  `TestInterruptedProbeIsNotRestarted`、
  `TestLatestOrdersByTimeThenProbeID`、
  `TestCancelledProbeCannotComplete`、
  `TestAttributionNeverChangesBreakerPricesOrProviderFingerprint`、
  `TestConcurrentIdenticalSubmissionRunsOneEngine`。
- [ ] `Service.Submit` validate -> digest -> BeginProbe 返回created标记；
  duplicate直接返回record。仅created执行一次Engine；取消/失败记录稳定
  terminal错误码，unknown不得启动第二worker；success原子Complete。
- [ ] Run `go test -p 2 ./store ./modeltrace -count=1`、race；
  SQLite fresh/old schema upgrade/reopen必跑；MySQL/PG schema static验证，
  有独立测试实例才能真跑，不能启动或接触P5容器。
- [ ] 提交 `feat: persist ModelTrace probes atomically`，双审。

## Task 7：独立鉴权 daemon 与 CLI

**HTTP 合同：** `POST /v1/modeltrace/probes` 提交 Evidence；
`GET /v1/modeltrace/probes/{id}` 查询 Record；
`GET /v1/modeltrace/bindings/{id}?model=gpt-5.4&protocol=chat` 查询 latest；
`GET /healthz` 无敏感内容。模型结果按json tags命名，Record必须用独立
wire projection，不把Go public fields/default uppercase当合同。

daemon默认disabled，启用默认127.0.0.1:18086。配置只有
`SMART_ROUTER_MODELTRACE_ENABLED/LISTEN/DATABASE/PYTHON/WORKER/
RUNTIME_MANIFEST/VENDOR_MANIFEST/BANK/INGEST_KEY/ALLOW_NON_LOOPBACK`，
key>=32 bytes，不能复用provider或router signing key。仅容器显式设置
ALLOW_NON_LOOPBACK=true允许0.0.0.0，本机默认false。
bank/worker revision进入本daemon健康摘要和配置hash，key排除。

**auth：** raw JSON bytes<=256KiB；HMAC-SHA256输入
`METHOD + "\n" + exactPathAndQuery + "\n" + timestamp + "\n" + nonce +
"\n" + sha256(body)`；常量时间比较，timestamp±60s、nonce合法且不重复。
提交幂等由probe ID/digest约束；nonce replay不允许重复执行；GET也鉴权。
nonce cache严格有限，满时fail closed，不无限分配。keys只在内存。

**首个 RED：** `TestProbeIngressRequiresSignature` 注入可计数fake backend，
无签名有效JSON应401且calls0；stub handler处理未鉴权会触发assertion。

- [ ] RED/GREEN：未知字段/尾部/巨大body/非opaque/secret字段、
  签名改body或method/path、expired timestamp、nonce replay、bounded
  replay cache、binding不存在、stable409conflict、不含internalstderr。
- [ ] CLI命令固定（路径示例使用任务独立目录）：
  `modeltrace analyze -input /private/tmp/modeltrace-evidence.json -python /private/tmp/smart-router-modeltrace-evidence-20261012/venv/bin/python -bank third_party/modeltrace/data/unified_bank.json -runtime-manifest modeltrace_runtime/RUNTIME-MANIFEST.json -vendor-manifest third_party/modeltrace/PROVENANCE.json`；
  `modeltrace submit -input /private/tmp/modeltrace-evidence.json -url http://127.0.0.1:18086`；
  `modeltrace get -probe-id probe-local-1 -url http://127.0.0.1:18086`。无provider key参数，不从env dump取值，
  提交签名key从明确配置lookup只读内存，输出仅record/result。
- [ ] daemon `build` 注入Service/clock，SQLite recovery只在启动执行一次，
  shutdown回收engine，listener不与routerd共享；CLI stdout/error sentinel测试。
- [ ] Run `go test -p 2 ./modeltraceapi ./cmd/modeltrace ./cmd/modeltraced ./config`，
  `go build -p 2 ./cmd/modeltrace ./cmd/modeltraced`；双审后提交。

## Task 8：完整 operator 工作台与静态页面

**接口：** `create_app(bank_store,transport,operations,export_client)`；Flask factory
不在import期间联网/rebuild/启动server。GET挑战、POST手动analyze、
POST单probe/auto、GETbank(s)、POSTbank、POSTenroll、
POSTrebuild、POSTexport接口由注入依赖执行。
auto/probe/enroll强制operation_id并使用Task4 durable ledger；浏览器重复提交
同ID不重发provider，unknown只显示原状态，新ID不得自动生成重试。
export_client输出 Evidence，只包含numbers/opaque binding/model/protocol/
bank revision，经Task7 HMAC投递；返回Record，不回显key或raw provider body。

**首个 RED：**

```python
def test_workbench_manual_analyze_can_export_numeric_evidence(self):
    import importlib.util
    self.assertIsNotNone(importlib.util.find_spec("modeltrace_runtime.workbench"),
                         "integrated workbench is missing")
    # 下一行为使用Flask test_client和固定reference数字：
    # 手动text->parse_numbers->analyze->export；captured Go payload无text/key/prompt。
```

- [ ] 每个能力写独立行为测试，不能仅断言函数存在算完成：
  `test_manual_parity_and_partial_status`、
  `test_bank_create_enroll_rebuild_and_restart`、
  `test_automatic_openai_and_anthropic_complete`、
  `test_export_has_only_signed_numeric_contract`、
  `test_export_does_not_accept_provider_name_as_binding`、
  `test_invalid_request_returns_bounded_stable_error`、
  `test_factory_import_has_no_network_or_threads`。
- [ ] UI以vendor templates/static为基线复制到受控适配层：
  manual、explicit protocol auto、bank create/enroll、概率/闭集解释、
  partial清晰展示、opaque binding export。保留上游静态手动页面与统一库；
  不新增图片资源；不启用Codex Guard/无限后台监测。
- [ ] operator本机监听仅loopback；容器显式opt-in才允许0.0.0.0，
  fresh csrf/session token、同源Origin检查、
  JSON strict、正文限额；provider key表单不进localStorage、cookie、URL、
  logs、HTML渲染回显。只允许生成挑战响应；不收集业务prompt。
- [ ] 浏览器插件优先，使用动态本地端口和mock provider，验证三页流程：
  manual分析+export；auto两protocol+partial/unknown stop；bank create/enroll/
  rebuild+reload。静态页离线数字分析与Python结果parity。console无错误。
- [ ] Run workbench/export全test与浏览器验证，提交
  `feat: integrate ModelTrace operator workbench`，双审。

## Task 9：端到端、分发、三轮与封存

**首个 RED，`tests/integration/modeltrace_test.go`：**
`TestModelTraceShadowFlowPreservesSignedRoutes` 新建router-owned SQLite，
预置两opaque bindings/一条price route，取route和snapshot；运行
operator fake-provider三挑战->数字worker->daemon signedsubmit->SQLite
reopen->GET record；记录成功且原route bindings/order、breaker、fingerprint
和snapshot bytes不变。缺任一接入环节必须assertion失败。

- [ ] 对两protocol real HTTP fake providers验证POST真实次数、无fallback，
  断链unknown calls1、partial不是complete；全部key/body sentinel在捕获
  请求中只出现operator-to-provider，Go requests/db/logs/assets中为0。
- [ ] original lifecycle、36models×3protocols108cells、签名、expired route、
  Retry-After、5attempts、breaker、SQLite legacy migration全部回归。
- [ ] 分发：requirements.in采用已核对upstream范围
  Flask>=3,<4、click>=8.1.3,<9、numpy>=1.26,<3；在隔离venv解析一次，
  输出**精确版本及wheel/hash lock**，记录Python版本。可复装后关网络测试；
  不读系统完整pip/env，不“latest”运行时安装。
- [ ] engine镜像entrypoint是Go modeltraced，包含同容器Python stdio
  worker/vendor numeric core、两manifest和bank，无provider env；
  daemon显式opt-in监听0.0.0.0:18086，发布host127.0.0.1:18086。
  workbench容器显式opt-in监听0.0.0.0:18087，发布host127.0.0.1:18087，
  通过独立network http://modeltraced:18086 HMAC数字提交。
  workbench独占state写权限，daemon只读挂载bank-generation state；
  router-owned SQLite由daemon独占写。compose默认关闭profiles，
  独立network/volumes，不引用NewAPI/P5service/db/config。
  stdioworker没有HTTPport。只写Dockerfiles/compose并静态验证；
  共享Docker不得为本任务build/run。
- [ ] 更新README运行方式、完整能力矩阵、closed-set限制；
  integration-required增加numeric attribution独立hook，保留
  Host integration `not-integrated` 与provider/secret ownership。
  FINAL-MANIFEST改写为新候选实际状态，不能遗留“已在main完成”描述。
- [ ] 从同一最终candidate `git archive`到3个干净临时目录；每轮下列命令
  逐条执行并分别保存exitcode，不串联掩盖失败：

```bash
GOWORK=off GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off GOMAXPROCS=2 go test -p 2 ./... -count=1
GOWORK=off GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off GOMAXPROCS=2 go test -race -p 2 ./... -count=1
GOWORK=off GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off GOMAXPROCS=2 go vet -p 2 ./...
GOWORK=off GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off GOMAXPROCS=2 go build -p 2 ./...
python -m unittest discover -s modeltrace_runtime/tests -v
```

每轮独立tempDB/state，deps/toolchain/bank相同hash。任一失败关闭该缺口并
固定新SHA后重新开始三轮，不把旧轮次跨版本拼起来。

- [ ] 全分支spec PASS -> 全分支quality PASS；Important0；总控核对改动
  只有登记路径，新计划/规格/所有vendor/locks/manifest进本分支。
  原main仍1259d42，tracked业务源码未改；共享handoff其他条目完整保留。
- [ ] `SHA256SUMS`按相对path排序，除自身外覆盖交付文件；
  MODELTRACE-VERIFICATION写source tree、每轮实际数量/skip/blocked、
  数值parity、浏览器、单次HTTP与P5隔离、两审报告摘要。
  禁止将checksum文件hash递归包含自身。
- [ ] 最终提交保留feature branch。交付代码、计划、spec、状态和hash；
  用 finishing-a-development-branch 明确待集成状态，不自动merge/push/
  Deploy，除非已有明确授权。

## 完成清单与结果口径

- [ ] pinned源/License、schema/hash、评分1/2/3 parity、数字建库parity。
- [ ] 三挑战manual与两protocol主动采集、single-write/partial/unknown测试。
- [ ] bank查看/创建/新增模型/自定义family/global重建/失败原子性。
- [ ] Go evidence/process、durable lifecycle、重启/幂等/绑定精确合同。
- [ ] 签名daemon/CLI、工作台/静态页、export->persist->query end-to-end。
- [ ] shadow不改route/breaker、0provider secrets/raw data进入Go。
- [ ] 三轮固定candidate全量/race/vet/build/Python、浏览器、checksum双审。
- [ ] SQLite真实fresh/upgrade/reopen，MySQL/PG实际状态明确；
  Docker运行未测明确，真实provider/Host/生产接入未测明确。
- [ ] P5源/发布包/冻结值/资源未改，本feature不进入P5发布。

只有上面本地完整能力满足才能写“离线完整接入完成”；外部未执行项单列，
不能写“已验证真实模型身份”或“生产接入完成”。本次先交付可审阅计划与
设计，并已登记文件占用；设计审阅通过后按Task0->9连续执行，不逐任务询问。
