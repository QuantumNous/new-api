# PRD — 调用密钥"Allowed models"通配符鉴权修复

> **Status**: 🔧 eval · 方案 B 已实现 + 单测通过；待 PR review + 线上 live 验证
> **Author**: Kaitao Lai + Claude
> **Date**: 2026-06-27
> **Owner**: DeepRouter Platform + Frontend
> **Ticket**: DR-1001
> **Parent**: [`docs/PRD.md`](../PRD.md) · 关联 [`api-key-simple-advanced-prd.md`](./api-key-simple-advanced-prd.md)
> **范围**: 调用密钥的 per-key 模型白名单(`token.ModelLimits`)鉴权语义 + 创建/编辑表单(`web/default/src/features/keys/`)

---

## 1. 背景 / 问题

用户用一个已配置 Claude 权限的调用密钥(API Key)调用 `claude-opus-4-8`,网关返回:

```
This token has no access to model claude-opus-4-8
```

排查结论:**不是渠道(channel)问题,也不是账号权限问题**。该密钥的 "Allowed
models" 白名单里有一条 `claude-*`,用户预期它按前缀匹配所有 Claude 模型 —— 但
**后端鉴权是精确字符串匹配,不展开任何通配符**,所以 `claude-*` 只会匹配一个字面
名为 `claude-*` 的模型,永远命中不了 `claude-opus-4-8`。

## 2. 根因(代码定位)

1. `middleware/auth.go:421-423` — 密钥启用模型限制时,把 `token.ModelLimits`
   拆成 map 放入 context。
2. `model/token.go:349-362` — `GetModelLimits()` 只是
   `strings.Split(ModelLimits, ",")`;`GetModelLimitsMap()` 把每条原样当 key 存
   `map[string]bool`。**无通配符/前缀展开**。
3. `middleware/distributor.go:108-110` — 鉴权用
   `tokenModelLimit[FormatMatchingModelName(model)]` 做**精确 map 查找**;
   `FormatMatchingModelName`(`setting/ratio_setting/model_ratio.go:885`)只处理
   gemini-thinking / gpt-gizmo 几个特例,不处理 `claude-*` 这类前缀。
4. 同样的精确匹配也用在 `controller/model.go:128-130`(密钥可见模型列表展示)。

后果:UI **允许用户输入 `claude-*`、`gpt-4o*`、`deepseek-v3*` 这类带 `*` 的条
目,但后端根本不认**,等于给用户挖坑——白名单看起来配了,实际全部失效。截图里
只有不带星号的精确名(`deeprouter-auto`、`deeprouter-chat`…)真正生效。

## 3. 目标 / 非目标

**目标**
- 让 per-key 模型白名单的行为与 UI 呈现一致,消除"配了却用不了"的静默失败。
- 不引入任何"白名单意外放宽到账号无权访问模型"的安全回归。

**非目标**
- 不改账号/分组(group)层的模型可见性。
- 不改 `deeprouter-auto` 等虚拟模型的路由逻辑。
- 不改渠道(channel)层的 model 列表语义。

## 4. 方案(已定为 B)

### 方案 A — 前端禁止通配符,保持后端精确匹配
- `web/default/src/features/keys/` 在添加/保存白名单时拒绝含 `*` 的条目,改为引
  导用户从真实模型列表里多选精确模型名。
- 对存量已含 `*` 的密钥:保存时清洗 / 提示用户修正。
- **优点**:零鉴权逻辑改动,最安全,不可能放宽权限。
- **缺点**:用户必须逐个枚举模型名;每次上新 Claude 模型,所有密钥都要手动补;
  与"打个 `claude-*` 覆盖一类"的直觉相悖,体感差;存量带 `*` 的密钥需迁移。

### 方案 B —（已采纳）后端真正支持前缀/glob 匹配
- 在鉴权处把精确 `map` 查找改为:精确命中优先,未命中再对白名单里**含 `*` 的条
  目**做 glob/前缀匹配(`claude-*` → 前缀 `claude-`)。
- 关键安全语义:**per-key 白名单永远是"账号已可访问模型"的子集过滤器,不是授
  权来源**。即便 `*` 匹配了某模型,后续渠道选择仍按账号/分组的 ability 走
  (`model/channel_cache.go` `GetRandomSatisfiedChannel`),账号无权的模型依旧调
  不到——这把"放宽"风险限制在账号已有权限范围内。**该前提已于 2026-06-27 读码核
  实成立,见 §5。**
- 同步修正 `controller/model.go` 的可见模型列表,使展示与鉴权一致。
- **优点**:与 UI 既有的 `claude-*` chip 承诺一致;上新模型自动覆盖;无需迁移存
  量密钥。
- **缺点**:鉴权路径热代码改动,需充分测试;必须明确并测试纯 `*`(全通配)、空
  白名单、`a-*-b` 这类 pattern 的语义。

**决策(2026-06-27)= B**:UI 早已把 `claude-*` 当合法输入呈现,B 是"让承诺兑
现";A 是"收回承诺并要求用户做更繁琐的事"。B 的安全前提已读码核实(§5),无权
限提升风险。

## 5. 权限放开风险(已核实关闭 ✅)
- **风险假设**:若 per-key 白名单被误当成授权来源,通配符可能让密钥访问账号本不该
  用的模型。
- **核实结论(2026-06-27,已读代码确认)**:**交集语义成立 —— TRUE**。token 白名
  单是纯"子集过滤器",不是授权来源:
  1. `middleware/distributor.go:95-113` 白名单只做**单向 gate**(命中放行/未命中
     403),通过后不再参与任何授权。
  2. 通过后选渠道走 `service.CacheGetRandomSatisfiedChannel(... TokenGroup ...)`
     → `model/channel_cache.go:96` `GetRandomSatisfiedChannel(group, model, retry)`
     —— **函数签名只有 group/model/retry,白名单根本不传入**。
  3. 渠道查找用 `group2model2channels[group][model]`(channel_cache.go:106),该
     map 仅由"启用渠道 × 其配置的 group/model"和 Ability 表构建
     (`model/ability.go` `AddAbilities`),**与 token 白名单无关**;查不到即
     `return nil`(channel_cache.go:114-115)→ 上游 503/forbidden。
  4. grep 确认无任何路径用白名单去 populate ability / 选 channel / 创建 virtual
     ability / 绕过 group 校验。
- **结论**:即便方案 B 让 `claude-*` 命中,账号/分组无对应 channel-ability 的模型
  仍调不到。B 的放开面被严格限制在"账号已有权限"内,**无权限提升风险**。
- **仍需在实现中定义**:纯 `*`(全通配)语义——是"放行账号全部可访问模型(由
  ability 兜底,安全)",还是前端禁止输入裸 `*`。建议允许,因兜底已在 ability 层。

## 6. 验收标准
- [x] 白名单含 `claude-*` 的密钥可成功调用 `claude-opus-4-8` / `claude-sonnet-4-6`
      / `claude-haiku-4-5-20251001`(方案 B,gate 改用 `model.MatchModelLimit`)。
      ⏳ 线上 live 调用待验证(CLAUDE.md §0 rule 3)。
- [x] 账号无权访问的模型,即使被某 `*` 命中,仍返回原有 forbidden / channel 不可
      用错误(不放宽权限)——交集语义 §5,gate 通过后仍走 ability 选 channel。
- [x] 空白名单 = 不限制(维持现状,`ModelLimitsEnabled` 逻辑未改)。
- [x] `controller/model.go` 密钥可见模型列表与鉴权结果一致:精确条目按原契约直接
      列出;wildcard 条目按账号/分组 enabled models 展开(best-effort,group 解析
      失败则跳过展开,不影响列表)。
- [x] 新增回归测试:`model.MatchModelLimit` 15 例(exact/wildcard/纯 `*`/空/混合)
      + `controller` wildcard 列表展开用例;原 token-limit 列表契约测试仍通过。
- [x] `CHANGELOG.md` 记录(Rule 10)。

**实现说明**:trailing-`*` 前缀匹配(对齐 `setting/operation_setting/tools.go`
既有约定),覆盖 UI 全部 chip(`claude-*`/`gpt-4o*`/…);裸 `*` = 放行账号全部
可访问模型(由 ability 兜底)。改动文件:`model/token.go`(新增 `MatchModelLimit`)、
`middleware/distributor.go`(gate)、`controller/model.go`(列表 + `resolveGroupEnabledModels`
helper)。前端 §7 的"禁/提示 `*`"在方案 B 下非必需(`*` 现已真实生效),暂不动。

## 7. 涉及文件(实现时)
- 鉴权:`middleware/distributor.go`、`model/token.go`(新增匹配 helper)
- 列表一致性:`controller/model.go`
- 前端:`web/default/src/features/keys/`
- 测试:对应 `_test.go`

## 8. 开放问题
1. ~~选 A 还是 B?~~ **已定:方案 B**(2026-06-27)。理由:UI 早已把 `claude-*`
   当合法输入,B 兑现承诺且无需迁移存量;B 的安全前提已读码核实(§5)。
2. (B)纯 `*` 的精确语义?**倾向允许**——放行账号全部可访问模型,由 ability 层
   兜底(§5),实现时确认。
3. 存量已含 `*` 的密钥如何处理?**B 自动生效**(`claude-*` 立即开始按前缀匹配),
   无需数据迁移;只需回归测试覆盖存量形态。
