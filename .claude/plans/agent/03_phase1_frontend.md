# Phase 1 前端改造点

> 调研报告 §4.4 强调：全局悬浮入口、过程可视化、场景化推荐、敏感操作弹窗确认。

---

## 1. 新增组件清单（仅在 `web/src/` 下增量）

| 路径 | 状态 | 作用 |
|---|---|---|
| `web/src/pages/Agent/index.jsx` | **新增** | 独立页面（侧边栏入口，可全屏聊天） |
| `web/src/components/agent/AgentLauncher.jsx` | **新增** | 全局悬浮按钮（右下角） |
| `web/src/components/agent/AgentDrawer.jsx` | **新增** | 抽屉式聊天容器（点击悬浮按钮弹出） |
| `web/src/components/agent/AgentChatArea.jsx` | **新增** | 消息流（仿 `playground/ChatArea.jsx`） |
| `web/src/components/agent/AgentMessageBubble.jsx` | **新增** | 单条消息气泡（区分 user/assistant/tool） |
| `web/src/components/agent/AgentToolCard.jsx` | **新增** | 工具调用结果卡片（如"已为您查询余额：¥XX.XX"） |
| `web/src/components/agent/AgentConfirmCard.jsx` | **新增** | 二次确认卡片（敏感操作） |
| `web/src/components/agent/AgentInput.jsx` | **新增** | 输入框 + 快捷指令按钮 |
| `web/src/components/agent/QuickActions.jsx` | **新增** | 空白对话框时显示「猜你想问」 |
| `web/src/components/agent/SessionList.jsx` | **新增** | 历史会话侧栏 |
| `web/src/hooks/agent/useAgentChat.js` | **新增** | SSE 消费 hook（参考 `useApiRequest.js`） |
| `web/src/hooks/agent/useAgentSession.js` | **新增** | 会话状态管理 |
| `web/src/services/agent.js` | **新增** | `/api/agent/*` 调用封装 |
| `web/src/i18n/locales/zh.json` | 现有，增量 key | Agent 文案 |
| `web/src/i18n/locales/en.json` | 现有，增量 key | Agent 英文文案 |
| `web/src/components/layout/SiderBar.jsx` | **修改** | 加 Agent 菜单项（已知会改） |
| `web/src/App.jsx` | **修改** | 注册 `/console/agent` 路由 + 注入悬浮按钮 |

---

## 2. 入口与可见性策略

### 2.1 三个入口（按调研报告 §4.4「全局悬浮入口」）

1. **全局悬浮按钮** `AgentLauncher`：登录后所有 console 页面右下角
2. **侧边栏菜单项**：`SiderBar.jsx` 顶部加「AI 管家」
3. **空状态引导**：充值页/Token 页等关键页，"遇到问题？让 AI 管家帮你"链接

### 2.2 灰度策略（详见 `07_open_questions.md` Q9）

读取后端 `/api/agent/config` 决定是否渲染：
- `enabled: false` → 完全不渲染，前端 0 影响
- `enabled: true, gray_strategy: "all"` → 全员可见
- `enabled: true, gray_strategy: "new_user"` → 仅注册 30 天内可见
- `enabled: true, gray_strategy: "whitelist"` → 仅白名单用户

---

## 3. 聊天 UI 关键交互

### 3.1 消息气泡

| 角色 | 显示 |
|---|---|
| `user` | 右侧，蓝底 |
| `assistant`（纯文本） | 左侧，灰底，Markdown 渲染（复用 `MarkdownRenderer.jsx`） |
| `tool_call_start` | 左侧，进度气泡：「🔧 正在调用工具：{tool.display_name}...」（不可关闭，1s 后变成 result） |
| `tool_call_result` | 左侧，结果卡片（结构化，比如表格 / 余额数字） |
| `confirm_required` | 左侧，**强提示卡**（红/橙边框），含「确认执行」「拒绝」按钮 |
| `error` | 左侧，黄底，大白话错误 + 一键重试按钮 |

### 3.2 SSE 流式细节

- 用 `sse.js`（已在依赖里）
- 后端 SSE 事件格式：

```
event: text_delta
data: {"delta": "您的余额是"}

event: tool_call_start
data: {"call_id": "xxx", "tool_name": "get_balance", "display": "查询余额"}

event: tool_call_result
data: {"call_id": "xxx", "ok": true, "data": {"balance": 12.34, "currency": "CNY"}}

event: confirm_required
data: {"confirm_token": "xxx", "tool_name": "create_token", "args_summary": "新建一个名为 'sora-test' 的 API Key"}

event: done
data: {"session_id": 123, "tokens_used": 456}
```

### 3.3 二次确认流程（详见 `05_safety_billing_audit.md` §3）

```
后端推 confirm_required
  → 前端弹 AgentConfirmCard
  → 用户点「确认执行」
  → 前端 POST /api/agent/confirm { confirm_token, accept: true }
  → 后端用 confirm_token 取出之前缓存的 tool_call，执行
  → 后端继续 SSE 推 tool_call_result + 后续文本
```

---

## 4. 快捷指令（空状态）

参考调研报告 §3.2 TOP10 场景，Phase 1 上线时空白聊天框展示 6 个快捷按钮：

| 快捷指令 | 触发的预置消息 |
|---|---|
| 💰 查我的余额 | "帮我看下当前余额还有多少？" |
| 🔑 新建一个 API Key | "我想新建一个 API Key 给 ChatBox 用" |
| 🤖 推荐合适的模型 | "我要写一篇 5000 字的小说，哪个模型性价比最高？" |
| 📊 看看最近用了啥 | "帮我看下最近 7 天的使用情况" |
| 💸 怎么充值？ | "我想充值 100 块，怎么操作？" |
| ❓ 我遇到了报错 | "我刚才请求一直 429，怎么回事？" |

---

## 5. 工具结果的可视化（`AgentToolCard` 分支）

不同工具结果走不同卡片渲染。Phase 1 至少实现：

| 工具 | 卡片样式 |
|---|---|
| `get_balance` | 大数字 + 单位 + 「去充值」按钮 |
| `list_tokens` | Semi `Table` 简表，Action 列：复制 Key / 删除 |
| `create_token` | 高亮的 Key 字符串 + 复制按钮 + 警示「Key 仅本次显示」 |
| `recommend_model` | 模型卡片列表，含价格/速度/适用场景，「选用」按钮调下一个工具 |
| `query_logs` | Mini 折线图（用 `@visactor/react-vchart`，已在依赖） |
| `get_topup_link` | 跳转卡片：「点击前往充值」 |
| `explain_error` | 文本 + 「一键修复」按钮（如重新请求） |

---

## 6. i18n key 命名规范

按现有约定（key 是中文源串，flat JSON）：

```json
{
  "AI 管家": "AI Butler",
  "正在为您查询余额": "Querying your balance",
  "等待您确认": "Waiting for your confirmation",
  "确认执行": "Confirm",
  "拒绝": "Cancel",
  "聊天历史": "Chat history",
  "新会话": "New chat",
  "AI 管家暂未开放": "AI Butler is not enabled yet"
}
```

写文案时统一用 `useTranslation` + `t('中文')`。

---

## 7. Semi UI 组件选用建议

| 用途 | Semi 组件 |
|---|---|
| 抽屉容器 | `Drawer`（位置 right） |
| 悬浮按钮 | 自绘 `Button`（圆形，shadow，固定 fixed bottom-right） |
| 消息列表滚动容器 | `ScrollableContainer`（已存在 `web/src/components/common/ui/ScrollableContainer.jsx`） |
| 输入区 | `TextArea` + 回车提交 |
| 工具结果表格 | `Table` |
| 二次确认 | `Card` 包裹自绘卡片，**不要**用 `Modal`（在抽屉里弹 Modal 体验差） |
| 进度提示 | `Spin` + 文字 |
| 加载骨架 | `Skeleton` |

---

## 8. 不在 Phase 1 做（防止前端范围蔓延）

- ❌ 拖拽多文件上传
- ❌ 语音输入
- ❌ 图片输入（Phase 2 配合多模态再加）
- ❌ Agent 个性化（自定义头像/名字）
- ❌ Agent 商店 UI
- ❌ Agent 使用记录详情页（暂时只在历史侧栏显示）
- ❌ 改造现有 Playground 页面（Agent 是独立的，**不要**和 Playground 合并）
