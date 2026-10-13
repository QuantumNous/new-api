# ModelTrace 接入设计

**状态：** 设计已获用户批准；正在独立 worktree 实施，尚未部署。
**目标仓库：** `/Users/bytedance/newapi/smart-router`。
**本地基线：** `1259d424ac07976b596058d7fb3f011549617298`，`main` 初始干净。
**上游：** <https://github.com/xqy2006/ModelTrace>。
**固定上游 revision：** `6cd4a8ff0f3f4e49d6d6969dd2fbadfa1569fde2`。
**许可：** MIT，保留 `Copyright (c) 2026 xqy2006` 及完整 LICENSE。

## 已核对的差距

本地 `modeltrace/modeltrace.go` 只有内存生命周期：
`pending -> running -> succeeded/failed/cancelled`，没有实际调用者、归因算法、
绑定关联或持久化。本地 `fingerprint.Compute` 是 provider capability 文档的
SHA-256 摘要，不是模型行为归因。不能把两者已有测试通过视为上游接入完成。

上游 `fingerprint.py` 提供 355 维 Hellinger 特征、74 维有序数字特征、
环境干扰投影、0.75/0.25 融合、按有效回答数选择校准温度、全局 softmax
和家族概率求和。`app.py` 提供挑战、手动分析、自动探测、自动测试、指纹库
查看/创建/采集；`bank_builder.py` 和 `rebuild_unified_bank.py` 提供拟合和重建。
固定 revision 的统一库有 18 个标签、2 个家族；这是候选库标签，
不是对真实供给或官方模型身份的证明。

上游自动测试目标是 3 份有效回答，最多生成 6 个挑战；内部还有网络重试
和 OpenAI/Anthropic 格式 fallback。自动建库包含 12 个环境的 36 个挑战、
每挑战重试及两线程采集，并保存 raw text 和 prompt。接入时必须改造这些
集成行为以符合既有单次提交、未知写入不重试、凭据与正文隔离要求。

## 方案选择

| 方案 | 收益 | 代价与结论 |
| --- | --- | --- |
| 固定 Python 核心 + 隔离工作台 + Go 数字证据桥接 | 保留算法和建库方法，能逐层做一致性验证；不引入 NewAPI 依赖 | 增加独立 Python 运行环境；推荐 |
| 将算法、校准、采集和 UI 全部改写为 Go | 单运行时 | 数值、解析和建库差异面大，验证成本高；不选 |
| 在 routerd 直接挂载上游 Web API | 接口迁移少 | routerd 会收到 Base URL、provider key 和 raw body，违反现有所有权；不选 |

## 完整接入的范围

| 上游能力 | 交付与验收 |
| --- | --- |
| 三挑战生成和手动分析 | 隔离工作台可生成挑战、解析粘贴输出、分析并导出数字证据 |
| 自动单挑战与三回答测试 | OpenAI Chat 与 Anthropic Messages 明确协议；独立主动探测，单槽一次请求 |
| 统一模型/家族归因 | 调用固定 Python 算法；与上游结果逐字段比较 |
| 指纹库查看、创建、模型采集、拟合和全局重建 | operator 独立状态目录；只保存数字和建库必要元数据，原子发布新 revision |
| 本地 Web 工作台和静态手动页面 | 保留上游页面能力；适配安全采集/数字导出，浏览器验证核心流程 |
| Go 生命周期、分析执行、持久化、查询 | 新 daemon/CLI 与 router-owned SQLite；可重启查询历史结果 |
| 路由关联 | 按 opaque binding + claimed model + protocol 记录 shadow 观察；不改变价格/资格/冷却 |
| 分发和可重复运行 | 两种镜像、开发启动说明、固定 revision/资产清单/依赖锁与最终 SHA256SUMS |
| Codex Guard 分发内容 | 保留在上游归档与来源说明中；不安装 hooks、不启动 fork/monitor、不控制当前或 P5 任务 |

“完整”指上述能力在独立 smart-router 范围内跑通，包括本地 fake provider 的
实际 HTTP 链路；真实 provider 的统计效果、真实 NewAPI Host 接入和生产切流
不在这次 P5 并行工作内。不得把这些未执行部分列为 PASS。
不对未收录模型、严重环境偏移或闭集最高概率给出确定身份结论。

## 组件与数据流

1. `third_party/modeltrace/` 固定上游源与原始数据，只读使用，带 LICENSE 和
   每文件来源哈希；不从运行时下载或执行上游 `start.py`/Codex hooks。
2. `modeltrace_runtime/` 包含 stdio 评分、bank 验证和 operator 工作台适配。
   评分 worker 只导入数值核心，不导入 `app.py` 或联网采集模块。
3. operator 平面取得专门生成的挑战响应。raw text 和 provider key 只在该
   平面的当前操作内存中存在，不进 Go 请求、数据库、日志或新采集 reference。
   不读取既有 NewAPI Key、业务正文或生产数据库。
4. Go `modeltrace` 接收带界限的数字数组，生成证据哈希并执行 Python worker。
   worker 的调用路径、脚本清单和 bank revision 在调用前校验。
5. `cmd/modeltraced` 在默认关闭、启用后 loopback 的独立监听器上提供签名
   数字证据提交与结果查询；`cmd/modeltrace` 支持数字文件/stdio 和 daemon
   客户端。工作台通过签名提交导出的数字证据，只有摘要回到 Go。
6. `store` 原子记录 probe、结果和最新投影。routerd 原有 route/outcome/
   snapshot wire contract 不变，主动归因始终为 shadow。

单个提交选择一个真实绑定及其 claimed model/protocol，不修改绑定模型名，
不由预测结果创建或映射模型。支持路由库外标签参与评分；无法对应候选的
claimed label 输出 `inconclusive`。匹配关系、统计置信度和“分析运行成功”
必须作为不同字段表示。

## 数字证据和结果合同

协议 `smart-router.modeltrace/v1`，strict JSON，拒绝未知字段和尾部 JSON。
提交包含：

```json
{
  "schema_version": 1,
  "probe_id": "probe-local-1",
  "binding_id": "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
  "claimed_model": "gpt-5.4",
  "protocol": "chat",
  "bank_revision": "f267d0513aa06981d024ec5394746fceddf44e4e8a75fa6bf8304255f4b32d6d",
  "samples": [
    {"challenge_id": "challenge-1", "expected_count": 300, "numbers": [1, 355]}
  ]
}
```

上例仅展示 shape；2 个数字不足以评分，必须在 admission 判定为不足证据。
生产字段中不存在 Base URL、provider、API Key、headers、prompt、raw text、
provider body 或自由 metadata。`numbers` 必须是整数 1..355；1..3 个 sample，
每 sample 最多 4096 个数；`expected_count` 为 0..4096。按原算法
`max(80, ceil(expected_count*0.55))` 判有效。全部无效拒绝；1/2 份有效
输出 `complete=false`，不伪称三挑战完成。挑战 ID 唯一，不能混合绑定/
模型/协议；绑定须已经存在并精确匹配存储模型/协议。

结果包含 probe/binding/model/protocol、engine revision、bank SHA256、
evidence SHA256、服务器观察时间、有效回答数、完整性、排序后的模型与
家族概率、最高预测、`matched/mismatched/inconclusive` 和固定
`closed_set=true`。概率与 score 只允许有限数，概率总和误差不超过 `1e-9`；
最多 256 个模型/32 个家族。不回传 numbers、样本文本或 provider error。

`matched/mismatched` 仅在 claimed label 存在、3 份有效且候选概率达到
显式阈值时生成；默认阈值 0.90，其余为 `inconclusive`。这是诊断标签，
不是平台权威或路由许可。达到条件且最高标签与 claimed label 一致为
`matched`，不一致为 `mismatched`。新 bank revision 由实际完整 bytes SHA256 标识。

## 执行与持久化

Go worker deadline 默认 20 秒，输入不超过 256 KiB，stdout 不超过 256 KiB，
stderr 捕获上限 8 KiB；对外仅返回稳定错误码，stderr 不公开。超过界限、
非零退出、解析/维度/NaN 错误、revision 不匹配都 fail closed。
取消/超时终止并回收 owned child，不遗留后台 worker。执行路径不拼 shell，
不导出完整进程环境，工作目录和状态目录都属于本任务。

vendor 来源 manifest 和运行时执行 manifest 分开：后者覆盖 worker/adapter
及其传递执行依赖，不递归包含自身哈希。Go 在启动 child 前验证两套清单。
评分可用固定 builtin bank 或 operator 的 current-generation manifest；
manifest 只能引用受控 state root 内的不可变 generation、文件名及 SHA256。
每个请求先锁定 generation/revision，worker 有界读取 bank bytes 一次并
验证请求指定 revision，不能在计算中再次读取 current。新发布只影响下一次
提交；历史结果保留各自 bank revision，旧 probe 重放只查询持久化结果。
库更新无需改 Go 业务代码或 P5 冻结值。

SQLite 新增 `modeltrace_probes`、`modeltrace_results`，以及按
binding/model/protocol 查询最新成功结果的索引。保存结构化结果和哈希，
不保存数字数组或原文。幂等键 `probe_id`；同 ID 同证据返回已有终态，
同 ID 不同证据冲突。一次完成事务同时更新 terminal state 与 result，
失败不留下 succeeded-only。观察时间由服务器 clock 给出，最新结果按
纳秒时间和 probe ID 稳定排序；重启后 running 变为 failed/interrupted，
不自动重新执行。旧内存状态机 API 保留。

迁移只加表/索引，SQLite 必须真实执行 fresh/upgrade/reopen；
MySQL/PostgreSQL 同步 schema，但未实际运行的矩阵标记 BLOCKED。
归因不调用 `SetObservation`、`RecordOutcomeAndApply` 或写健康/冷却/
价格/绑定资格，绝不以“分析成功”构造 provider success。

## operator 工作台与建库

工作台默认仅 loopback，使用独立端口和独立 state root。原始 vendor
reference 保持来源封存；新增 reference 只保留 bank_builder 需要的
数字、counts、source/family/condition、nuisance condition、challenge ID、
row ID、有效性和时间等结构字段。保留原 `nuisance_condition_id`、family
和 calibration 分组语义，不能用普通 condition 隐式替换环境分组。
生成挑战模板属于只读程序资产；实际提交 prompt 和响应只存在内存。
拟合和发布受单写锁保护，临时目录生成完整库，验证后原子换 manifest；
失败保留原 revision。自定义库 ID 限制为安全 basename。

采集入口具有独立 durable `operation_id`/slot ledger，不依赖Go提交幂等：
operation ID 复用且参数相同只查询既有状态，不再POST；变更参数则409。
每slot提交前独占创建并fsync intent；进程崩溃、超时或未知结果将operation
标记 unknown，重启和入口重放均不补发。ledger保存操作哈希、slot ID、
次数/status和数字结果，不保存key/URL/prompt/raw text；已持久化终态
可以返回数字结果。新operation不得作为旧unknown的自动重试。

主动网络请求采用明确 `openai` 或 `anthropic` 格式；binding/Host 提供的
协议 metadata 可代替人工选择。没有 metadata 时不通过失败 POST 猜协议。
每 challenge 单次网络提交；timeout、连接中断、发送后失败或未知结果
停止当前操作，无 fallback、重放或补发。响应不足可保留 partial 结果，
新的任务必须使用新 probe ID。建库 3..36 个不同 challenge，默认串行，
每槽最多一次且总量预先显示，不激活后台无限监测。

不自动接受 HTTP redirects，不继承系统代理。实际目标必须显式配置为
HTTPS provider 目标，不接受 URL 内凭据或 local/private/metadata 地址；
测试用 loopback transport 只能通过测试注入。provider errors 不回显
响应正文/Authorization，API Key 不写日志、缓存或磁盘。
connect deadline 10秒，每slot端到端deadline 90秒（含DNS/TLS/读取），
响应最多256KiB，request最多64KiB，OpenAI/Anthropic max_tokens=4096。
超时/超限立即关闭并回收owned transport child、停止operation，不重试。
最多36slots/operation，只有1个采集operation可运行，满额返回busy。

容器分发中 engine镜像同时包含Go `modeltraced`、Python stdio worker、
两套manifest与只读bank。daemon在容器内以显式opt-in监听0.0.0.0:18086，
仅发布到host127.0.0.1:18086；同容器直接启动worker，无HTTP评分sidecar。
workbench镜像容器内显式opt-in监听0.0.0.0:18087，仅发布host loopback，
通过独立network的 `http://modeltraced:18086` 签名提交数字证据。
workbench拥有state唯一写权限；engine仅只读挂载该state的bank generations。
本机开发默认仍仅loopback，容器opt-in不能默认为公网部署。

## P5 隔离与协作

共享 `docs/mvp/handoff.md` 只操作本任务独立标题，保留其他条目，不能
独占或整体重写。设计/计划只写 smart-router 子仓库路径。
实施使用独立 worktree `/private/tmp/smart-router-modeltrace-20261012`，
分支 `feat/modeltrace-integration-20261012`。测试环境、venv、cache、结果
都在独立临时 root；Go `-p 2`、GOMAXPROCS=2，重回归串行。

P5 NewAPI worktrees、`/private/tmp/rc40-closeout-release-20261011`、
release assets、frozen hash/pins、CI、remote、Docker/SSH、provider 和业务 DB
全部排除。不开 shared 8080/7860/13000；测试使用动态 loopback 端口，
正式启动配置示例用独立 18086/18087 且先验证空闲。
不 reset/stash/clean，不合并 main，不把本分支加入 P5 发布包。

总控负责登记、接口冻结、按任务给唯一实现子代理完整指令、核对 RED/GREEN
和提交；每任务实现后依次独立规格审查、独立质量审查。
Important/Critical 未关闭不得进入下一任务。探索/审查代理只读，
实施代理不并行写。

## 验收

固定上游数值 parity 覆盖 1/2/3 输出、355/74 维特征、环境投影、排序、
probability/family/calibration，并从 vendor reference 的已有数字构造
有来源测试输入；不得把 synthetic 输出标成真实模型证据。
故障覆盖不足样本、恶意 bank/路径、巨大输入/输出、NaN、取消、重启、
幂等冲突、未知写入、泄露 sentinel、权限和 P5 排除。

本地 fake provider 通过真实 HTTP 验证 OpenAI/Anthropic 两路径、单槽
请求计数、finish_reason、三挑战、建库/重建/导出、Go ingestion、
SQLite 重启查询及 shadow route 等价。浏览器验证工作台与静态页。
最后同一干净 archive 三轮独立 Go/Python 全量、race、vet、build，
保持原 36×3 协议矩阵和既有 breaker/opaque/signature/retry 合同。

出口分别记录：离线完整接入、真实 provider 未测、真实 Host 未接入、
MySQL/PostgreSQL 执行状态、Codex hooks 未启用。不能统一宣称生产接入完成。
