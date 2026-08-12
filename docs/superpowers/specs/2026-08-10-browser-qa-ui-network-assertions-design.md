# Browser QA UI 与网络断言补全设计

**日期：** 2026-08-10
**状态：** 已批准，待实施
**目标环境：** Flatkey staging
**前置设计：** `2026-08-06-browser-qa-structured-regression-promotion-design.md`

## 1. 背景与问题

Browser QA 已经能够把 AI 发散发现转换为结构化 `proposed_case`，并经过三次独立验证后进入候选 PR。然而当前固定用例 DSL 只支持 `page_status_not` 和 `url_not_contains` 两种断言。它能够固化页面跳转和 404 类问题，却不能表达按钮状态、表单校验、输入值、元素数量或某个用户动作是否触发网络请求。

真实 staging 运行已经发现“API Key 创建弹窗空名称时仍可点击提交”。该场景具有高置信度和真实证据，但现有 DSL 无法精确描述预期行为，因此 AI 只能输出 `proposed_case: null`，候选固化流程不会启动。

本设计补齐 UI 和网络断言，使这类安全、可重复、无需额外清理的发散发现能够形成结构化候选用例。

## 2. 目标

1. 允许固定用例断言语义元素的可见、隐藏、启用和禁用状态。
2. 允许固定用例断言输入值和语义定位器匹配的元素数量。
3. 允许固定用例在显式监听边界后断言同源 HTTP 请求已发送或未发送。
4. 保持封闭 DSL，不引入任意 JavaScript、CSS、XPath、正则表达式或自由 HTTP 请求。
5. 保持现有候选 fingerprint、三次验证、Draft PR、人工合并和 cleanup 流程不变。
6. 让“空名称仍可提交”可以生成非空 `proposed_case` 并进入候选验证。

## 3. 非目标

- 不允许 AI 执行任意浏览器脚本或读取页面内部 JavaScript 状态。
- 不记录或匹配请求 Header、Cookie、Authorization、请求体或响应体。
- 不支持生产 Origin、跨 Origin 网络断言、任意 URL、正则 URL 或域名匹配。
- 不自动修复产品 Bug，也不自动合并候选 PR。
- 不改变 `core`、`normal`、cleanup 或钉钉终态通知的总体顺序。
- 不把网络断言扩展为通用 API 测试客户端。

## 4. 方案选择

采用“显式开始网络监听”的方案。固定用例在需要观察网络副作用前执行 `begin_network_capture: {}`，运行时清空该用例此前记录的请求。后续网络断言只检查该边界之后产生的请求。

未采用“从用例开始记录全部请求”，因为页面初始化、资源加载和 fixture 准备请求会污染判断。未采用“把网络断言绑定到 click 步骤”，因为它会把动作和验证耦合，无法表达多步骤触发或多个断言。

## 5. DSL 扩展

### 5.1 新增步骤

```yaml
- begin_network_capture: {}
```

语义：清空当前固定用例的网络观察缓冲区，并将此时刻作为后续网络断言的唯一监听起点。

约束：

- payload 必须是空对象。
- 单个用例最多执行一次。
- 使用任何网络断言的用例必须包含该步骤。
- 网络断言只能位于该步骤之后的断言阶段。

### 5.2 新增 UI 断言

```yaml
- element_visible:
    locator:
      by: role
      role: button
      name: 提交

- element_hidden:
    locator:
      by: text
      text: 创建成功

- element_enabled:
    locator:
      by: role
      role: button
      name: 提交

- element_disabled:
    locator:
      by: role
      role: button
      name: 提交

- element_value_equals:
    locator:
      by: label
      label: API Key 名称
    value: demo

- element_count_equals:
    locator:
      by: test_id
      test_id: api-key-row
    count: 1
```

所有定位器继续只允许 `role`、`label`、`text` 和 `test_id`。`element_value_equals` 的值使用现有受控字符串约束。`element_count_equals.count` 为 0 到 1000 的整数。

### 5.3 新增网络断言

```yaml
- network_request_sent:
    method: POST
    path: /api/token/
    timeout_ms: 1500

- network_request_not_sent:
    method: POST
    path: /api/token/
    timeout_ms: 1500
```

约束：

- `method` 只允许 `GET`、`POST`、`PUT`、`PATCH`、`DELETE`。
- `path` 必须使用现有相对 staging path 规则，不允许 scheme、host、query、fragment、反斜杠或控制字符。
- `timeout_ms` 为 0 到 5000 的整数。
- 匹配使用精确 HTTP 方法和精确 URL pathname；查询参数不参与匹配。
- 只记录并匹配当前 case 起始 Origin 的同源请求。
- `network_request_sent` 在超时前观察到匹配请求即通过。
- `network_request_not_sent` 必须等待完整 timeout；期间一旦观察到匹配请求立即失败。

## 6. 示例

### 6.1 空名称提交保护

```yaml
fixture: user_with_api_key
start:
  origin: staging_console
  path: /keys
steps:
  - click:
      locator:
        by: role
        role: button
        name: 创建 API Key
assertions:
  - element_disabled:
      locator:
        by: role
        role: button
        name: 提交
cleanup: not_required
```

该候选不需要点击提交，也不会为了复现缺陷制造额外 API Key。它在当前存在 Bug 的 staging 上应稳定失败，并以相同失败断言签名进入 `awaiting_product_fix`。产品修复后，同一候选连续三次通过才进入 `ready_for_review`。

### 6.2 打开弹窗不应提前创建资源

```yaml
fixture: user_with_api_key
start:
  origin: staging_console
  path: /keys
steps:
  - begin_network_capture: {}
  - click:
      locator:
        by: role
        role: button
        name: 创建 API Key
assertions:
  - network_request_not_sent:
      method: POST
      path: /api/token/
      timeout_ms: 1500
cleanup: not_required
```

该用例在点击“创建 API Key”只打开弹窗的情况下，确认系统不会在用户填写并确认之前提前发送创建请求。它验证网络副作用，但本身不执行提交动作。

## 7. 执行器设计

浏览器 evidence helper 继续作为固定用例的确定性执行边界：

1. 在 case 执行开始时安装只记录最小元数据的 request 监听器。
2. 请求记录仅包含规范化后的 `method`、`origin` 和 `pathname`，不持久化敏感字段。
3. `begin_network_capture` 清空内存缓冲区并激活网络断言窗口。
4. UI 断言通过现有语义 locator 调用 Playwright 的可见性、启用状态、值和数量 API。
5. 网络断言通过受控轮询等待匹配结果；等待受 `timeout_ms` 和固定最大值约束。
6. case 完成或失败时移除监听器，避免跨 case 污染。
7. 失败仍走现有 screenshot、console、network evidence 捕获和脱敏流程。

Python loader、JSON Schema、模型 Structured Output Schema、Node helper 的第二层校验必须保持字段、枚举和边界完全一致。任何一层不认识的新 action/assertion 都必须 fail closed。

## 8. 候选与晋级兼容性

- `proposed_case` 继续只包含 `fixture`、`start`、`steps`、`assertions` 和 `cleanup`。
- 新增动作和断言参与现有 canonical fingerprint，因此语义不同的候选不会错误去重。
- `finding` 仍要求非 `info` severity、高置信度、真实证据和允许的 staging Origin。
- `coverage` 仍要求 `mutates_state: false` 和 `cleanup_requirement: not_required`。
- 网络监听本身不产生状态；断言也不执行请求。
- 三次验证、失败签名、flaky 判定、cleanup gate、Draft PR 和人工合并规则不变。

## 9. Prompt 行为

探索 Prompt 应明确告诉 AI：

- 优先使用 UI 状态断言表达客户端校验，不要为了验证 Bug 主动执行可能产生数据的提交操作。
- 只有在探索证据已经证明某动作的网络副作用，且候选可安全重放时才生成网络断言。
- 网络断言前必须包含 `begin_network_capture`。
- 如果无法用封闭 DSL 准确表达，继续输出 `proposed_case: null`，不得编造 selector、路径或请求。

## 10. 错误处理

- Schema 或 validator 不一致：拒绝整个模型结果或固定用例，不能降级执行未知字段。
- 缺少 `begin_network_capture`：候选校验失败，不进入三次验证。
- 出现多个 `begin_network_capture`：候选校验失败。
- 跨 Origin、绝对 URL、query/fragment 或未知 HTTP 方法：候选校验失败。
- UI locator 无匹配或匹配语义不满足：断言失败并保存现有失败证据。
- 网络监听器异常：断言失败，不能误报为“请求未发送”。
- 超时：`sent` 失败；`not_sent` 在完整观察窗口无匹配时通过。

## 11. 测试策略

### 11.1 Python DSL 与 Schema

- 每个新增步骤/断言的合法样例通过。
- unknown field、错误类型、越界 count/timeout、绝对 URL、query、fragment、控制字符全部拒绝。
- 网络断言缺少监听步骤或出现多个监听步骤时拒绝。
- fixed-case schema 与 proposed-case schema 保持语义一致。

### 11.2 Node 执行器

- UI 六类断言分别覆盖通过和失败。
- `begin_network_capture` 之前的请求不计入结果。
- 精确 method/path 匹配；query 被忽略；跨 Origin 请求被忽略。
- `sent` 在观察到请求时通过并在超时时失败。
- `not_sent` 必须等待完整窗口，无请求时通过，有匹配请求时失败。
- 网络监听异常不能变成假通过。
- case 结束后监听器被移除，连续 case 互不污染。

### 11.3 Promotion 与工作流回归

- 新断言参与 fingerprint。
- 三次 attempt 的相同新断言失败签名可以聚合。
- candidate payload、Draft PR YAML 和 GitHub artifact 保留新增 DSL。
- 原有 fixed cases、normal/core、cleanup、GCS、钉钉通知契约全部通过。

### 11.4 Staging 验收

1. 推送到远程 `staging` 并等待部署后 Browser QA 自动执行。
2. 确认 replay、fixed-case phase、exploration、cleanup 和钉钉通知均有终态。
3. 用受控候选验证新 UI 和网络断言能够被 Cloud Run candidate runner 执行。
4. 确认 GCS manifest 中候选 `proposed_case` 非空且没有敏感请求数据。
5. 确认 GitHub Run 和钉钉消息包含可点击的具体 Run 地址。

## 12. 验收标准

- 所有九项新增 DSL 能力均通过 Schema、Python、Node 和候选链路校验。
- “API Key 名称为空”能够使用 `element_disabled` 安全表达，不需要为了复现缺陷点击提交。
- 无副作用动作能够使用 `begin_network_capture` 和网络断言验证是否意外发送请求。
- 网络断言不会把监听边界之前的初始化请求计入结果。
- 任何报告、manifest、artifact 或日志都不包含 Header、Cookie、Authorization、请求体或完整敏感 URL。
- 现有 539 项 Browser QA 测试及新增测试通过，无原有用例回归。
- 远程 staging 自动 QA 完整结束，并发送中文钉钉终态报告。
