# gate 手册

> 本文件是 canon `manual/gate.md` 手册正本（2026-09-23 从 `.githooks/` 移出归并——`.githooks/` 只留运行时：hooks + spec + 兜底二进制）。
> 规则协议文档在 `.githooks/spec/docs/`；issue/PR 操作见 `GITHUB_ISSUE_PR.md`；开发流见 `PR_DEV_WORKFLOW.md` / `WORKFLOW.md`；任务书写法见 `task-brief` skill，收尾流程见 `closeout` skill。

gate 是仓库自带的质量门禁：读 `.githooks/spec/*.yaml` 规则 → 调外部命令/LLM → 收 finding → 按严重度放行或拦截。
**加规则只改 yaml，不改二进制。** 本文件是人能查的一手总览；每条规则的参数以对应 `.githooks/spec/quality/checklist_*.yaml` 为准。

## 三层 SLA

| 层 | 性质 | 成本 | 是否阻断 |
|---|---|---|---|
| **l1 结构层** | 确定性（grep / clippy / machete / wc） | 毫秒～分钟，零 token | FAIL 硬拦 |
| **l2 语义层** | 轻量语义（重复块 / 跨 crate 影响面） | 秒级 | FAIL 硬拦 |
| **l3 LLM 层** | 按需 LLM，输出 `score`/`confidence` 参考分 | 分钟级 | **不阻断**，开发 agent 自行判阈值 |

`gate check` 默认只跑 l1；`--sla l2` / `--sla l3` 解锁更高层。重规则设 `hooks: [merge]` 不拖日常提交。

## 规则清单（20 条）

严重度列：`FAIL`=硬拦截，`WARN`=提示不拦，`INFO`=仅参考。

| 规则 | SLA | 自动触发 | 严重度 | 查什么 |
|---|---|---|---|---|
| `hardcoded_secret` | l2 | pre-commit/push/merge | FAIL | 硬编码密钥/密码/Token：PCRE 出候选，jev 判「真凭证 vs 占位符/测试夹具」——占位符 FP 被滤；无 key 时候选降 WARN |
| `stale_api` | l1 | merge | WARN | 废弃 Rust API（`uninitialized`/`try!`/`ONCE_INIT`） |
| `slop_comment` | l2 | pre-commit/push/merge | FAIL | AI 风格注释：正则出候选，jev 判「是否真 slop」+ score 严重度（0 化妆品/1 叙述/2 误导）——实质 why 注释与转述变体分别幸存/被抓 |
| `ccn` | l1 | pre-commit/merge | **FAIL** | 函数 ccn 超天花板(默认 6)：新违规/恶化硬拦；存量记账 `ratchet.tsv` 容忍且只许降（`seed` 一次后记账进仓）；lizard 缺失静默跳过 |
| `antislop` | l2 | merge | WARN | AI slop 四类（Deferral/Hedging/搁置词/空桩；裸 TODO 归 `rust_todo_needs_issue` 专属）：词法正则出候选，jev 判「真 slop vs 合法用法」+ score 严重度 |
| `rust_no_process_cmd` | l1 | pre-commit/push/merge | **FAIL** | HTTP 走 reqwest，禁 subprocess 拉 curl/wget |
| `rust_tests_in_tests_dir` | l1 | merge | WARN | 测试放同层 `tests/`（架构偏好规则，降级为提示：存量大仓/bin 单测放 `src/` 会全仓命中，agent 只会学会忽略） |
| `rust_no_dead_code_allow` | l1 | merge | WARN | 合并前清理 `#[allow(dead_code)]`（同行带 `//` 理由放行） |
| `rust_no_empty_module` | l1 | merge | WARN | 微型空文件（≤2 行且无实现） |
| `rust_no_cfg_test_in_tests_dir` | l1 | merge | WARN | `tests/` 里不需要 `#[cfg(test)]` |
| `rust_test_no_assert` | l2 | pre-commit/push/merge | FAIL | 测试必须验证行为：无字面 assert 的 `#[test]` 出候选，jev 判「是否以其他方式验证」（mock expectations/should_panic）——spy 风格幸存，空跑被拦 |
| `rust_todo_needs_issue` | l1 | merge | WARN | TODO/FIXME 必须挂 issue 号（`// TODO(#N)` 或 `todo!("TODO(#N)")`） |
| `dep_hygiene` | l1 | merge | WARN | `cargo-machete` 未使用依赖（工具缺失则 WARN 跳过） |
| `clippy` | l1 | merge | **FAIL/WARN** | rustc 编译错误 + `unused_*`/`dead_code`→FAIL；`collapsible_if` 等风格→WARN |
| `file_size` | l1 | merge | WARN | 单 `.rs` >1500 行 或 >35KB → 提示按职责拆分（存量宽，清账后可升 FAIL） |
| `duplication` | l2 | merge | WARN | 复制漂移：本次变更内 4+ 连续行块(>80字符)重复出候选，jev 判「真漂移 vs 惯用相似」+ score |
| `crg_impact` | l2 | merge | WARN | diff 跨 3+ crate 改动，提示耦合 |
| `ferrite_oversize` | l3 | merge | INFO | 大文件/大函数参考分（wildtoken `fast-l`，带 `score`/`confidence`，不阻断） |
| `review_chain` | l3 | pre-push/merge | INFO（harness 透传 FAIL/WARN/INFO） | 模型审查层三档降级：jev（`TYPESAFE_API_KEY`）→ 小模型（`REVIEW_LLM_*`）→ 无（INFO）；每个问题带 per-question `fail`/`warn` 阈值，p≥fail FAIL 硬拦；finding 带 `tier`/`confidence` extra |

## 怎么跑

**自动**（已挂在钩子上，本机 `core.hooksPath=.githooks/hooks`）：`git commit` → pre-commit；`git push` → pre-push；`gate merge <repo> <pr>` → merge（含 checklist 全量）。
`RESULT: FAIL` 且存在 FAIL 级 finding → 退出码 1 → 对应 git 操作被拦截。

**手动**（调试 / CI / 按需）：
```text
gate check                       # 列出当前 l1 层全部规则（列表，不执行）
gate check clippy file_size     # 只跑指定规则
gate check --sla l3             # 解锁到 l3（含 LLM 参考层）
gate check --sla l3 --json      # 机器可读，带 score/confidence extra，给开发 agent 消费
```

## 怎么加一条规则

拷一份模板到 `.githooks/spec/quality/checklist_<名字>.yaml`，填参数：

```yaml
enabled: true
hooks: [pre-commit, pre-push, merge]   # 重活写 [merge]
sla: l1                                  # l1 确定性 | l2 语义 | l3 LLM(带分参考)
fail_severity: WARN                      # 兜底严重度；FAIL 才阻断
mode: grep                               # diff | file | grep(静态,自己扫)
match:
  paths_include: ["**/*.rs"]
  paths_exclude: ["target/", ".wt/"]
harness:
  command: "sh"
  args: ["-c", "<扫仓库根 + 输出 finding JSON 数组>"]
optional: true                           # 工具缺失时 WARN 跳过
timeout: 30
```

stdout 必须是 finding JSON 数组：`{"id","severity","path","line","message"}`（L3 可多带 `score`/`confidence`）。

**可移植标准（强制遵守，见 `spec/docs/CHECKLIST_SPEC.md`「mode: grep 规则编写标准」）：**
1. 扫仓库根 `"$ROOT"`，**禁止**写死 `crates/*/src` 布局（换仓库会静默扫 0 文件、假绿）。
2. 扫描集用 `git ls-files` 跟踪文件集（gitignore 感知）；`grep -r`/`find` 走文件系统会扫进 gitignored 参考目录 → 假 FAIL。
3. find 用 `\( -name target -o -name .git -o -name .wt \) -prune -o ...`，**禁止** `-not -path "*/.wt/*"`（全路径 glob 在 `.wt/` worktree 下会把自己全排除）。
4. 跨语言测试文件命名一并 `--exclude`（`*_test.go`/`*.spec.ts` 等，`--exclude-dir=tests` 挡不住同目录测试）。

## jev cascade：正则管召回，jev 管判决

l1 形式检查的两类角色拆开：**确定性正则只做候选生成**（毫秒级、高召回、零成本），
**语义判决交给 jev**（`verify_chain.py`，l2）。每个候选一条 noul（"真违规？"）+
score（"多严重"），阈值在 `harness/jev_questions_verify.json` 按后果标定；
p < warn 直接丢弃——这个丢弃就是假阳性过滤器。

降级链：有 key 走 Jev；无 key 自动落 small model；kernel 外/全失败时候选**原样降
WARN**（召回不丢、处置照常），绝不静默清零。score 返回值是 0 起始连续值
（3 档题实测 1.43），不是 0-9。

已转换：`hardcoded_secret` / `slop_comment` / `rust_test_no_assert`（实测三路径：
占位符 FP 消失、实质 why 注释幸存、spy 风格幸存、空跑 FAIL）。

## hook 路由（dispatch.yaml）

- **pre-commit / pre-push（快路径）**：code（六语言 lint）+ checklist 精选——FAIL 型
  （`rust_no_process_cmd`、`ccn`）+ jev 级联（`hardcoded_secret`/`slop_comment`/
  `rust_test_no_assert`）。干净树毫秒级，有候选才付 jev 的钱。
- **merge（完整把关）**：workspace（WS-01/WS-02，工作区干净是合并标准）+
  github PR/Review 规则 + cleanup + 全部 checklist（含提示型与 l2/l3 重量项）。
  提示型 l1 规则（stale_api/todo_needs_issue 等 6 条）只在 merge 提示，不拖慢提交。
- **commit-msg**：CM-01/02/03 标题检查（读 git 传入的消息文件，不读残留的
  COMMIT_EDITMSG）。
- GT-04/06（Done when/epic sub-issues）保持硬拦：没有配置逃生门，想跳过就把活
  干完——勾掉 checkbox 或写明完成说明。

## 自定义 spec（jev_rule：项目自配规范，零代码）

适合**语义判断型**规范——"这段代码/文档好不好"正则抓不住、需要理解上下文的。
语法/计数/存在性检查**不要**放这里：那是确定性 checklist（sh harness）的活，
零方差且免费。判据：如果一个问题可以让 `grep`/`wc`/`test -f` 直接回答，就别问 jev。

### 四件套

| 件 | 位置 | 作用 |
|---|---|---|
| 规则本体 | `spec/custom/<name>.json` | intent + 信息范围 + 问题（三种原语）+ 阈值 |
| 接线 | `spec/quality/checklist_<name>.yaml` | mode:file → jev_rule.py --config |
| 验证 | fixture（含"该抓的"和"该幸存的"） | 真判决 + 无 key 降级两条路径 |
| 分发 | canon 仓 `scripts/agent-sync push <项目>` | 按 `agent-sync.yaml` 同步给成员仓 |

完整可抄的现成示例：`.githooks/spec/custom/example_spec.json`（含 noul+score 与
choice+fail_labels 两种形态）和 `example_checklist.yaml`（接线模板，文件名不以
`checklist_` 开头所以引擎不加载它，复制改名后才生效）。

### json 字段

```jsonc
{
  "<rule-id>": {                       // finding id = 它的 uppercase
    "intent": "规则原文，原样进 jev state —— 写成给新同事看的规范条文",
    "paths_include": ["**/*.rs"],      // 细过滤（在引擎 yaml 粗过滤之内）
    "paths_exclude": ["target/"],
    "state": {
      "file": true,                    // 变更文件全文进 state
      "diff": false,                   // true 则附变更 hunks
      "context_files": ["docs/spec.md"] // 仓内规范文档内联（每个截 8k 字符）
    },
    "questions": {
      "<qid>": {
        "type": "noul",                // noul(是非) | choice(分类) | score(程度)
        "instructions": "问什么",
        "criteria": {                  // noul: true/false；每条=一句可观察证据
          "true": "什么情况算违规（引用文件里能看到的证据）",
          "false": "什么情况合法（含豁免条件，如测试代码/带 issue 号）"
        },
        "fail_labels": ["placeholder"],// 仅 choice：哪些选项算违规
        "fail": 0.85,                  // ≥fail → FAIL 硬拦
        "warn": 0.6                    // ≥warn → WARN 须处置；两者之间以下→丢弃
      }
    }
  }
}
```

### 三种原语怎么选

- **noul**："是不是违规"——过滤正则候选、判真伪。≈0.5 表示"是和非差不多可能"，
  不是"中等程度"。
- **choice**：分桶。标签必须穷尽（留兜底标签如 `not_docs`）；单元可能横跨时加
  `mixed`。用 `fail_labels` 指出哪些桶算违规。
- **score**：程度/严重度。每档必须描述具体处境（"启动路径可被打挂"），不是裸的
  "低/中/高"。

### criteria 写法（决定判决质量）

- 每条 = 一句话**可观察证据**（读文件能核对的），不是判决词（`bad`/`suspicious`）。
- 把豁免条件写进 `false`/合法档：测试代码、带 issue 号的 TODO、文档示例——否则
  全被误报。
- 一个问题一个判断。想同时知道"违不违规"和"多严重"，拆成 noul + score 两个问题
  （同 state 一次调用并行出）。

### 阈值与代价

- `fail` 是拦截线、`warn` 是处置线；**判决低于 warn 直接丢弃——这个丢弃就是假阳性
  过滤器**。起步用 0.85/0.6（noul）、2/1（score），按误报/漏报实据调。
- 每个命中文件一次 jev 调用（100-500ms，并发 8）。**挂 pre-push/merge**，别放
  pre-commit 热路径；`timeout: 300`。
- 无 key/断网：候选原样 WARN（召回不丢、处置照常），绝不静默清零。
- state 截 16k 字符（超出带截断标记）；单次最多 20 个文件。

### 上线前验证（SOP）

1. 造 fixture：至少一个"该抓的"和一个"该幸存的"（豁免形态各一）。
2. 有 `TYPESAFE_API_KEY`：真判决，核对"该抓的"出 FAIL/WARN、"该幸存的"消失。
3. `unset TYPESAFE_API_KEY` 再跑：确认降级输出 WARN-candidates-raw（召回没丢）。
4. `gate check <名字> --sla l2` 过一遍引擎接线。
5. 核对 `hooks`：每个命中文件都要付一次 jev 调用——挂 pre-push/merge，**不放 pre-commit**。
6. `context_files` 逐个确认存在：缺失会被静默内联 `<missing>`（harness 会在 finding
   里标 `context-missing`，但最好在 fixture 阶段就发现）。验证脚本用完删掉，不留仓根。

### 常见坑

- `intent` 写成口号（"代码要规范"）→ jev 没有判据可依，判决发散。写成条文。
- criteria 里只有判决词没有证据描述 → 等于让 jev 猜。
- choice 忘了 `fail_labels` → 所有桶都不算违规，永远静默。
- 语法类检查（缺 alt 属性这种正则可抓的）塞进来 → 又慢又不确定；先正则后 jev。
- paths 粗细两层都配了但互相矛盾 → 引擎粗过滤先进不来，json 细过滤永远空转。

分发/收集用 canon 仓的 `scripts/agent-sync`（`backport` 把项目本地修正回流 canon）。

## 怎么豁免

**原则：要不要拦截全部在 spec yaml 里配，不改代码。**

- checklist 系（checklist_*.yaml）：改该文件的 `fail_severity`（如把 `slop_comment` 从 WARN 降 INFO）。
- 模型审查开关（review_chain）：配环境变量选档——`TYPESAFE_API_KEY`(+`TYPESAFE_API_BASE`/`JEV_MODEL`)启用 jev，`REVIEW_LLM_BASE_URL`/`REVIEW_LLM_API_KEY`/`REVIEW_LLM_MODEL` 启用小模型降级，都不配则 INFO 跳过；问题集/阈值改 `.githooks/spec/harness/jev_questions_review.json`（每问题 `fail`/`warn`）。
- 检查能力选择（`checks:` 白名单）：各 family yaml（github_*.yaml / cleanup_*.yaml / workspace_*.yaml / code_*.yaml）顶部可加 `checks: [ID或前缀]`——只启用列出的检查项；缺省 = 全部启用。
- 家族严重度（`fail_severity`）：CL/WS 系 family yaml 的 `fail_severity: WARN|FAIL|INFO` 统一改本家族检查项严重度（INFO 不可被提升）。
- github 系（github_issues.yaml / github_pull_requests.yaml / github_reviews.yaml）：改各文件的 `severity_overrides:` 段，按 `规则ID` 覆盖严重度，如 `IS-16: "WARN"`。检查开关也在这：`garbled_content_check: false` 直接关掉 IS-16，`ci_check_mode` / `done_when_check_mode` 控制 PR 检查是 FAIL 还是 WARN。
- gh 拦截闸门（GT-* 现在产出 Finding，可覆盖/可关）：
  - `github_issues.yaml` 开关：`close_requires_comment`（GT-COMMENT）/ `close_done_when_gate`（GT-04）/ `done_when_judge.enabled`（DWJ 模型评审，见下）/ `epic_sub_issue_gate`（GT-06）/ `merge_fixes_gate`（GT-05）——false = 整块跳过
  - `github_pull_requests.yaml` 开关：`merge_requires_body`（GT-BODY）/ `merge_checkbox_gate`（GT-CHK）/ `merge_title_gate`（CM-01/02 squash 标题）
  - `github_reviews.yaml`：`merge_review.required: false` 关掉 RV-07 的 CRG+ocr 强制；`merge_review.ocr_timeout_secs` 调 ocr 超时
  - 严重度降级：GT-*/CM-*/RV-07 在 `dispatch.yaml` 的 `severity_overrides:` 段或全局 `severity_overrides.yaml` 按 ID 覆盖（如 `GT-06: "WARN"`）
  - 数据解析/子查询失败仍 fail-closed 硬拦（安全属性，不可配）
- commit 检查（CM-01/02/03）：`dispatch.yaml` 的 `severity_overrides:` 段。
- 全仓统一兜底：`.githooks/spec/severity_overrides.yaml`（全局最后发言权，按 `规则ID` 覆盖一切来源的 finding）。
- 单条放行：`git commit --no-verify`（不推荐，绕过全部钩子）。

规则 yaml 缺失或写坏（键名拼错）时 gate 直接 FAIL 报错（`gate.setup`），不会静默放行——「没有规范/规范坏掉」本身是错误状态。

### 严重度取谁说了算（降级时必读）

每条 checklist finding 的最终严重度 = `min(yaml fail_severity, harness 报告的 severity)`
（序：`FAIL < WARN < INFO`，取更严的一档；见 `engine.rs` `merge_severity`）。
**含义：只把 yaml 的 `fail_severity` 从 FAIL 改成 WARN 是无效降级**——只要 harness 的
输出 JSON 里还写着 `severity: "FAIL"`，finding 依然硬拦。降级必须同时改两处：
1. 该规则的 `fail_severity:`
2. harness 命令输出 JSON 里的 `severity` 字段（`checklist_*.yaml` 的 jq 片段里写死）

已降级记录：`rust_tests_in_tests_dir` FAIL→WARN（架构偏好规则；`bin/*/src/*.rs` 的内嵌
单测在存量大仓会全仓命中，agent 只会学会忽略；finding 仍打印，仍需按
`specs/agents/_discipline.md` 逐条处置）。

### 拦截点全清单（26 处）

| 类别 | 位置 | 规则 | 可否配置 |
|---|---|---|---|
| 数据错误 | `engine.rs` run_all/run_named | `gate.setup`（无 `.githooks/`、无 `checklist_*.yaml`、yaml 损坏） | **否**，fail-closed 硬拦 |
| 数据错误 | `shared.rs` `load_spec_yaml` | 缺 `dispatch.yaml` / `github_*.yaml`（pre-commit、pre-push、merge） | **否**，fail-closed |
| git commit | `pre_commit.rs:113` / `:118` / `:141` | `CM-01` 非 conventional / `CM-02` 标题含 CJK / `CM-03` commit type 与 PR type 不一致 | 是（`dispatch.yaml` `severity_overrides`） |
| git push | `pre_commit.rs` 之后的 l1/l2 链 | 任一 checklist `FAIL`（含 `code_*` 六条工具链、`checklist_ccn`、`rust_no_process_cmd`） | 是（yaml + `severity_overrides.yaml`） |
| git merge | `merge.rs:140-170` | `RV-07` CRG/ocr 强制（`merge_review.required`） | 是（`github_reviews.yaml` 开关 + override） |
| git merge | `cleanup.rs:47-90` | `CL-01` 分支已合并/孤儿/临时前缀需清理 | 是（`cleanup_branch_cleanup.yaml`） |
| gh issue create | `gh_wrap.rs:371-553` | `GT-01`/`GT-03` 标题/正文/label/父子关联（映射 `IS-*`） | 是（`github_issues.yaml` + override） |
| gh issue close | `gh_wrap.rs:555-731` | `GT-04` Done when 未勾 / `GT-05` 缺 Fixes / `GT-06` epic 子 issue / `GT-07` 关联 PR | 是（同上，含 `done_when_judge`） |
| gh pr create | `gh_wrap.rs:733-805` | `GT-02` PR 标题/正文/head/label（映射 `PR-*`） | 是（`github_pull_requests.yaml` + override） |
| gh pr merge | `gh_wrap.rs:807-950` | PR 内容复检 + 关联 issue 的 GT-04/05/06 | 部分（正文类可覆盖；数据解析失败仍 fail-closed） |
| 旁路审计 | `audit.rs:140-145` | 打印 `IS-*`/`PR-*` 的 FAIL finding（不改变退出码语义） | 是 |

**原则**：policy 类（可配）才是降级候选；数据错误类（fail-closed）是安全属性，不动。

## DWJ：Done-when 模型评审（issue close 时）

`gh issue close` 在 GT-04（checkbox 全勾的机械门）过后，把 **Done when 每一条** 拿给模型评审是否真被证据满足——和 `review_chain` 同一套三档降级（jev → 小模型 → 跳过），证据 = 关联 PR diff，缺失时退化为 `--comment` 文本。

- 配置：`github_issues.yaml` → `done_when_judge:`（`enabled` / `command` / `args` / `timeout_secs`）；问题集 = `harness/jev_questions_done_when.json`（`default_fail: 0.85`）
- 语义：某条 p(未达标) ≥ 0.85 → **FAIL 硬拦**；否则 WARN/INFO 带 `tier`/`confidence` extra
- 降级：harness 缺失/超时/输出不可解析/两个模型档都不可用 → `DWJ-SKIPPED` INFO，**永不因基础设施阻断**——GT-04 机械门 + 工具检查仍是兜底
- 三档互斥与 review_chain 相同：jev 在就只跑 jev，小模型只兜底

## 路线图（已知短板，未启用）

| 项 | 工具 / 做法 | 状态 |
|---|---|---|
| 注释存在性门禁 | `RUSTFLAGS="-W missing_docs"`（public 59 处存量）；`clippy::missing_docs_in_private_items`（更严） | 存量清账前按 crate 灰度启用 |
| 测试强度 | `cargo-mutants` nightly（验证 agent 测试是否真在检验，抓自证测试）；轻量方案已落地：`done_when_judge`（close 时 jev 逐条判 p(未达标)，≥0.85 硬拦） | 轻量方案已上线；mutants 待接入 |
| 质量曲线 | `gate check --json` 每次 commit 落 jsonl（clippy 数/LOC/CRG risk/findings 分布） | 待接入 |
| 函数复杂度 | 已上线 `ccn` checklist（ccn 天花板 6 + ratchet 记账：`ccn_gate.py` 进 `rules/harness/`，`ratchet.tsv` 进仓）；余 lizard 进 CI 镜像 | 已接入 |
| AI slop 二进制 | `cargo install antislop` 进 CI 镜像（未装时 `antislop` 规则静默跳过） | 待接入 |
| 模块循环依赖 | `cargo-modules dependencies --lib --acyclic`（工具未装） | 待装 |
