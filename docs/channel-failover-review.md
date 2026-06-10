# 多渠道图片/视频生成故障转移 — 实现评审与接入指南

> 评审日期：2026-06-10。目标：多渠道互为 backup 生成图片/视频，自动切换或降级，并支撑后续接入更多下游平台。
> 本文评审当前分支（feature/openai-video-failover）+ 生产部署（192.129.209.36:3001）的实际形态。

## 一、当前架构总览

一次生成请求经过 4 层，每层都有故障转移参与：

```
请求 /v1/images/generations 或 /v1/videos
  │
  ├─ 1. 分发层（middleware/distributor.go）
  │     按 group+model 从渠道池选渠道；端点类型过滤
  │     （common/endpoint_type.go）；参考图请求排除 xgapi 直出渠道
  │
  ├─ 2. 选路层（model/channel_cache.go / model/ability.go）
  │     priority 桶降序：retry=0 取最高优先级桶，重试一次降一桶；
  │     同桶内按 weight 随机
  │
  ├─ 3. 重试层（controller/relay.go）
  │     同步请求：shouldRetry —— 渠道错误、可配置状态码、
  │     quota 关键词（isRetryableUpstreamQuotaError）→ 换渠道重试，
  │     最多 RetryTimes（生产=2，即最多 3 个优先级桶）
  │     视频任务：shouldRetryTaskRelay —— 429/5xx/307 重试，400 不重试
  │
  └─ 4. 适配层（relay/channel/）
        openai/ 同步图片；task/openaivideo/ 视频 provider 模式
        （8 方法接口 + 按 channel.Other/BaseURL 自动检测，已接 7 家）；
        ListenHub 独立渠道类型 59
```

渠道健康反馈（与请求路径并行）：
- `processChannelError` → `ShouldDisableChannel`（service/channel.go）：渠道级错误、可配置状态码、`AutomaticDisableKeywords` 文案匹配 → 自动禁用（渠道 AutoBan 开关可豁免）。
- `controller/channel-test.go`：定时探活（仅 Master 节点、需配置频率）成功后自动恢复 AutoDisabled 渠道。

## 二、评审结论：方向正确，骨架合理

以下设计与「多渠道 backup + 自动切换」目标契合，应保持：

1. **priority 桶 + 桶内 weight 随机 + RetryTimes 跳桶**是业界标准做法，且经生产验证有效（2026-06-10：channel 12 余额不足 400 → 自动转移 channel 14 成功出图）。
2. **quota 错误识别为「可重试」而非简单失败**（commit 48f8be86d）方向正确：余额不足是渠道级临时态，请求级转移让用户无感。
3. **视频 provider 模式**（relay/channel/task/openaivideo/provider.go）是本仓库最适合扩展的部分：新平台 = 新增一个文件实现 8 个方法 + 在 3 处检测函数注册，已用 bltcy/xgapi/qilin/hongniao/runway/lk888/newapi 七家验证。
4. **非标准上游独立渠道类型**（ListenHub type 59）避免把非 OpenAI 协议硬塞进 OpenAI 适配器。
5. **文档驱动运维**（deployment.md 验证记录 + 每次 DB 变更前备份）在多次升级/回归中起了实际作用。

## 三、风险与不合理点（按影响排序）

### P0-1 quota 错误「只重试、不反馈」，坏渠道持续吃首跳（✅ 已修复 2026-06-11，方案见第五节）

ListenHub 余额 2026-06-07 耗尽后，3 天内每个 gpt-image-2 请求都先打它白吃一跳（+2~3s 延迟），直到 06-10 人工降优先级。重试解决了「单请求最终成功」，但没有渠道健康反馈回路。

系统其实已有现成机制，只是没接上：
- `AutomaticDisableKeywords`（线上可配，无需改码）默认含 OpenAI/Anthropic 余额文案，但**不含**中转站常见文案（如 ListenHub 的 `Insufficient credits for Image generation`）。
- 自动恢复依赖**定时探活**（channel-test），生产未配置测试频率 → `AutomaticEnableChannelEnabled=true` 实际永远不会被触发。

**建议**：
1. 把 `insufficient credits` / `insufficient balance` / `余额不足` / `额度不足` 等加进管理后台的自动禁用关键词（与 controller/relay.go `isRetryableUpstreamQuotaError` 的关键词表对齐）——quota 错误于是变成「本请求换渠道重试 + 该渠道自动下线」。
2. 配置定时探活频率形成恢复闭环。注意：图片/视频渠道探活会产生真实生成费用，建议低频（如 4~6 小时）或对高价渠道关闭 AutoBan 用人工恢复。

### P0-2 双源 priority（channels 表 vs abilities 表）漂移

内存缓存路径用 `channels.priority` 排序，非缓存路径/桶计算用 `abilities.priority`。通过管理后台改渠道会同步两者；直接 SQL 改 `channels` 不会（2026-06-10 实际踩坑：abilities 仍是 140/0 旧值导致选路与预期不符）。

**建议**：运维优先走管理后台改优先级；必须 SQL 直改时，固定执行
`UPDATE abilities SET priority=(SELECT priority FROM channels WHERE channels.id=abilities.channel_id);`
更彻底的做法是启动时做一次一致性校验/自动同步。

### P1-1 厂商特例散落在通用层，新平台会持续放大

- `middleware/distributor.go` 用 base_url/渠道名字符串匹配识别 xgapi（`isXGAPIChannel`），排除参考图请求；
- `relay/channel/openai/adaptor.go` 内嵌 xgapi 专属的「比例写入 prompt」逻辑；
- 每接一个有怪癖的新平台，都要往通用分发/适配层加 `if 是某厂商`。

**建议**：把这类差异改成**渠道能力标签**（channel `setting`/`param` JSON 中声明，如 `{"supports_reference_image": false, "aspect_ratio_via_prompt": true}`），分发层和适配层只读标签不认厂商。接入新平台变成纯配置动作，也消除字符串匹配误伤（任何名字含 "xgapi" 的渠道都会被当成星光）。

### P1-2 图片模型分类靠硬编码列表，加模型要发版

`common/model.go` `ImageGenerationModels` 决定 OpenAI 型渠道是否暴露 images 端点。2026-06-10 实际踩坑：横线命名 gemini-3.x 不在列表 → 只剩 ListenHub 一个候选 → ListenHub 断供即整个模型不可用（即文档旧「已知问题 3」的根因）。每新增一个图片模型名都要改代码+重新构建部署。

**建议**：模型→端点的归类下放到配置（渠道配置或 abilities 增加端点维度），代码列表只作兜底。短期至少把该列表挪进 operation_setting 做成线上可配。

### P1-3 quota 错误识别靠关键词，新平台文案漏判（✅ 已可线上配置 2026-06-11）

`isRetryableUpstreamQuotaError` 的关键词硬编码在 controller/relay.go。下游平台文案五花八门（英文变体/结构化 error.code/其他语言），漏判即退化为「不重试直接对外失败」。

**建议**：关键词表挪到 operation_setting（与自动禁用关键词同级、线上可配）；有 error.code 的上游优先按 code 匹配。

### P1-4 参考图路径是单点，未达成 backup 目标

`gpt-image-2` 带参考图仅 ListenHub 支持（xgapi 被能力排除）。当前 ListenHub 断供 → 该路径完全不可用，无任何 backup。这是「多渠道互备」目标下最明显的未覆盖场景。

**建议**：接入新平台时优先补「支持参考图的图片渠道」≥2 家；ListenHub 充值后恢复优先级 120 only 解决单点的「活着」，不解决单点本身。

### P2-1 视频任务对 quota 错误不转移（✅ 已修复 2026-06-11）

`shouldRetryTaskRelay` 把 400 一律视为不可重试，且不含 quota 关键词判断。视频上游若以 400 返回余额不足（中转站常见），不会故障转移。

**建议**：把 `isRetryableUpstreamQuotaError` 同样接入 shouldRetryTaskRelay。

### P2-2 RetryTimes 全局唯一

`RetryTimes=2` 意味着最多覆盖 3 个优先级桶。图片模型当前正好 3 桶（130/100/40 类），再加平台分层后会出现「桶比重试次数多」→ 最低优先级桶永远轮不到。

**建议**：渠道分层控制在 RetryTimes+1 桶内；或后续支持按端点/模型差异化重试次数。

## 四、新平台接入 Checklist

### 接入图片平台（同步 /v1/images/*）

1. **协议判断**：OpenAI Images 兼容 → 直接用 type 1（OpenAI）渠道；非兼容 → 参考 ListenHub（type 59）新建渠道类型 + relay 适配器。
2. **模型分类**：所有新模型名确认命中 `common.ImageGenerationModels`（含别名/带后缀名），否则 OpenAI 型渠道不会暴露 images 端点（P1-2 的坑）。
3. **能力确认**：是否支持参考图（`image`/`images`）、是否支持 `size`/`aspect_ratio`、流式（upstream merge 后已支持 images 流式中继）；不支持的能力确认分发层不会把这类请求路由过去。
4. **StreamOptions**：按 CLAUDE.md Rule 4 确认是否加入 `streamSupportedChannels`。
5. **配置渠道**：priority 放进现有分层（首选 130 / 主力 100 / 兜底 ≤40），开 AutoBan；改完用管理后台或同步 abilities（P0-2）。
6. **quota 文案**：拿到该平台「余额不足」的真实报错文案，确认命中 `isRetryableUpstreamQuotaError` 关键词表，并加进自动禁用关键词（P0-1/P1-3）。
7. **真实验证**：经公网入口直出 + 参考图（如支持）各打一发，确认 HTTP 200、`data[0].url/b64_json` 有效、日志命中预期 channel；故意打一发会失败的请求验证转移路径。
8. **登记文档**：deployment.md 渠道表 + 验证记录 + api-usage.md 模型表。

### 接入视频平台（异步 /v1/videos）

1. 在 `relay/channel/task/openaivideo/` 新建 `<platform>.go`，实现 provider 接口 8 方法（submitURL/queryURL/parseSubmitResponse/parseQueryResponse/buildSubmitResponseBody/needsMultipart/mapModelForImages 等）。
2. 在 provider.go 的 `getProviderByHint` / BaseURL 检测 / `getProviderForRelayInfo` 三处注册识别特征（建议用渠道 `other` 字段显式 hint，少用 URL 推断）。
3. 统一参数收敛：把调用方的 `images`/`image`/`input_reference`、`seconds`/`duration`、`aspect_ratio`/`size` 映射成平台原生参数（参考 qilin.go/lk888.go 的处理与比例映射表）。
4. 渠道 type 58（OpenAI Video），priority 放层级，注意 `channels.models` 与 `abilities` 同时补齐（2026-06-07 LK888 的坑：只有 models 没有 abilities → /v1/models 不暴露）。
5. 真实验证：提交→轮询→`/content` 下载 200 video/mp4；记录 task_id 进文档。

## 五、改进路线图（建议顺序）

| 优先级 | 事项 | 改动面 | 效果 | 状态 |
|--------|------|--------|------|------|
| 1 | quota 错误渠道冷却（替代探活闭环） | 小 | 坏渠道自动跳过/到期自动恢复，零探活成本 | ✅ 2026-06-11 已实现并部署 |
| 2 | abilities/channels priority 一致性 | SOP | 消除选路与配置不一致 | ✅ SOP 见下文 |
| 3 | quota 关键词表挪 operation_setting；接入视频任务重试 | 小 | 新平台文案可配，视频也能转移 | ✅ 2026-06-11 已实现并部署 |
| 4 | 渠道能力标签化（参考图/比例注入等），替换厂商字符串匹配 | 中 | 接新平台零通用层改动 | 待做（下批平台接入前） |
| 5 | ImageGenerationModels 配置化 | 中 | 加模型不发版 | 待做 |
| 6 | 补第二家参考图渠道 | 配置+验证 | 消除参考图单点 | ◐ 2026-06-11 漫小白渠道 15 已接入（支持 /v1/images/edits 参考图，xgapi 被排除时为参考图首选），待上游账号充值后真实验证 |

### 已实现机制说明（2026-06-11）

**quota 冷却**（P0-1 的最终方案，未采用「关键词自动禁用 + 定时探活」，因为定时探活对图片/视频渠道会发真实生成请求持续产生费用）：

- 上游返回 400/402/403 且文案命中 quota 关键词 → 该渠道进入冷却（`QUOTA_ERROR_COOLDOWN_SECONDS` 环境变量控制，默认 600 秒），本次请求照常换渠道重试。
- 冷却期内选路把该渠道整体移出候选（优先级桶随之重排）；该模型全部候选都在冷却时放行兜底，保证不出现「全员冷却无渠道可用」。
- 冷却到期自动恢复；期间第一个放行/到期请求天然充当被动探活。人工启用渠道也会立即解除冷却。
- 实现：`model/channel_cooldown.go`（注册表）、`model/channel_cache.go`（选路过滤）、`controller/relay.go` `processChannelError`（触发）。
- 限制：冷却过滤只作用于内存缓存选路路径（`MEMORY_CACHE_ENABLED=true`，生产默认）；DB 直查路径未接入。

**quota 关键词线上可配**：运营设置项 `UpstreamQuotaErrorKeywords`（按行分隔，默认含 insufficient credits/balance、quota exceeded、余额不足、额度不足等）。同步/视频两条重试路径与冷却触发共用这份关键词。接入新平台时把其真实余额错误文案补进该设置即可，无需发版。

**视频任务 quota 转移**：`shouldRetryTaskRelay` 现在对 400/402/403 + quota 文案的任务错误执行换渠道重试（此前 400 一律不重试）。

**priority 双源一致性 SOP**：渠道优先级一律通过管理后台修改（自动同步 abilities）；必须 SQL 直改时，改完执行：

```sql
UPDATE abilities SET priority=(SELECT priority FROM channels WHERE channels.id=abilities.channel_id);
```

或调用管理后台「修复数据库一致性」（`model.FixAbility`，会全量重建 abilities 并刷新缓存）。

## 六、一句话结论

骨架（priority 桶选路 + 跳桶重试 + provider 适配模式）是合理且已被生产验证的，可以放心在其上加平台。反馈回路已于 2026-06-11 通过 quota 冷却机制接通（坏渠道自动跳过、到期自动恢复）；剩余主要欠账是**厂商特例没有配置化**（路线图 4/5），它决定接入第 10 家平台时的边际成本，建议在下一批平台接入前完成；以及**参考图路径单点**（路线图 6），接新平台时优先补。
