---
name: zhidou-eval-run
description: 跑知豆 Agent 的正例集评测,输出工具调对率、参数填全率、平均步数三个指标
when_to_use: 每期合并前,验证 Agent 的工具调用准确性
---

# Skill: zhidou-eval-run

## 作用

对知豆 Agent 跑正例集评测(用例清单在 `docs/agent/use_cases.md`),输出量化指标,判断 Agent 是否达到上线标准。

## 输入

- **评测集路径**:`docs/agent/use_cases.md`(或 `backend/tests/agent_evals/positive_cases.json`)

## 输出

评测报告,包含:
1. **工具调对率**:Agent 调用的工具是否与期望一致
2. **参数填全率**:工具参数是否都填对了
3. **平均步数**:完成任务平均需要几轮工具调用
4. **失败用例详情**

## 评测集格式

```json
[
  {
    "id": 1,
    "user_prompt": "查一下我的余额",
    "expected_tool": "get_balance",
    "expected_params": {"user_id": "<current_user>"},
    "max_steps": 2
  },
  {
    "id": 2,
    "user_prompt": "帮我创建一个名叫'测试'的 Token",
    "expected_tool": "create_token",
    "expected_params": {"name": "测试"},
    "max_steps": 3
  },
  ...
]
```

## 执行步骤

### 第 1 步:加载评测集

从 `docs/agent/use_cases.md` 或 JSON 文件读取用例。

### 第 2 步:逐条跑测试

对每条用例:
1. 调用 `POST /api/agent/chat`,发送 `user_prompt`
2. 观察 Agent 的工具调用序列
3. 判断:
   - **工具调对**:第一个工具调用是否与 `expected_tool` 一致
   - **参数填全**:工具参数是否包含 `expected_params` 的所有字段
   - **步数合理**:总步数是否 <= `max_steps`

### 第 3 步:计算指标

```
工具调对率 = (工具调对的用例数) / (总用例数) * 100%
参数填全率 = (参数填全的用例数) / (总用例数) * 100%
平均步数 = (所有用例的总步数) / (总用例数)
```

### 第 4 步:生成报告

```markdown
# Agent 评测报告 - <日期>

## 测试环境
- 模型:claude-haiku-4-5
- 评测集:docs/agent/use_cases.md (30 条)
- 测试时间:<时间戳>

## 核心指标

| 指标 | 值 | 目标 | 状态 |
|---|---|---|---|
| 工具调对率 | 85% | ≥80% | ✅ |
| 参数填全率 | 90% | ≥85% | ✅ |
| 平均步数 | 2.3 | ≤3 | ✅ |

## 详细结果

| ID | 用户 prompt | 期望工具 | 实际工具 | 参数填全 | 步数 | 状态 |
|---|---|---|---|---|---|---|
| 1 | 查一下我的余额 | get_balance | get_balance | ✅ | 1 | ✅ |
| 2 | 帮我创建一个名叫'测试'的 Token | create_token | create_token | ✅ | 2 | ✅ |
| 3 | 删除 Token『测试』 | delete_token | delete_token | ❌ (缺 token_id) | 3 | ❌ |
| ... | ... | ... | ... | ... | ... | ... |

## 失败用例详情

### 用例 3:删除 Token『测试』

**期望**:
- 工具:`delete_token`
- 参数:`{"token_id": <从 list_tokens 里查到的 ID>}`

**实际**:
- 工具:`delete_token` ✅
- 参数:`{"name": "测试"}` ❌ (应该传 token_id,不是 name)

**问题**:Agent 没有先调 `list_tokens` 查 ID,直接用 name 调了 `delete_token`。

**修复建议**:
- 在 system prompt 里强调:"删除 Token 前,必须先调 `list_tokens` 查到 token_id"
- 或者修改 `delete_token` 工具,支持按 name 删除

---

## 总结

- **通过率**:27/30 (90%)
- **结论**:✅ 达到上线标准(≥80%)

## 趋势对比(与上一期)

| 指标 | 上一期 | 本期 | 变化 |
|---|---|---|---|
| 工具调对率 | 80% | 85% | +5% ↑ |
| 参数填全率 | 85% | 90% | +5% ↑ |
| 平均步数 | 2.5 | 2.3 | -0.2 ↓ |
```

## 上线标准

| 指标 | 阈值 | 说明 |
|---|---|---|
| 工具调对率 | ≥80% | 低于 80% 说明 Agent 经常调错工具,用户体验差 |
| 参数填全率 | ≥85% | 低于 85% 说明 Agent 经常漏参数,导致工具执行失败 |
| 平均步数 | ≤3 | 超过 3 步说明 Agent 效率低,用户等待时间长 |

**硬性要求**:三个指标都达标,才能进入下一阶段。

## 注意事项

1. **评测集要覆盖所有工具**:每个工具至少 2 条用例(正常场景 + 边界场景)。
2. **定期更新评测集**:新增工具后,立即补充对应用例。
3. **对比基准**:第一次跑评测时,把结果存为"基准";后续每次跑,都与基准对比,看是否退化。
4. **失败即修**:任何一个指标低于阈值,立即停止开发,先修复再继续。

## 自动化建议(阶段 3 起)

把评测脚本写成 `backend/tests/agent_evals/run_positive_evals.go`,每次 PR 合入前自动跑。CI 配置:

```yaml
# .github/workflows/agent-evals.yml
name: Agent Evals
on: [pull_request]
jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: go test ./backend/tests/agent_evals/
      - run: |
          if [ $(jq '.tool_accuracy' evals_result.json) -lt 80 ]; then
            echo "❌ 工具调对率低于 80%"
            exit 1
          fi
```
