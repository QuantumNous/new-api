> [!IMPORTANT]
> 本 PR 由 AI 辅助生成（git user `GentleLijie` 非历史核心开发者），已人工整理描述如下。

## 📝 变更描述 / Description

新增「图片感知模型路由」：配置一个**虚拟入口模型名**（如 `auto-coder`），网关在 distributor 选渠道之前，解析请求体检测**最后一条 `role=user` 消息**是否含图片（同时支持 OpenAI `image_url` 与 Claude `image` 两种 content part），据此把模型名改写为配置好的**视觉模型**或**编程模型**。改写发生在渠道选择之前，因此真实模型名会参与渠道选择、亲和性、计费与重试。

由于网关每个请求无状态，“图片轮走视觉模型、后续纯文本轮回到编程模型”由客户端每轮携带的完整对话历史天然完成，网关无需存任何状态——仅看当前轮最后一条 user 消息，避免历史残留图片误触发。

可观测性：
- 响应头注入 `X-Routed-Model` / `X-Route-Entry-Model` / `X-Route-Reason`
- Token 级 `ModelRouteNotify` 开关（默认对新 token 开启）控制是否在**响应体内**注入提示文本（如 `> [Route: auto-coder → glm-4.6v (image detected)]`），覆盖 OpenAI/Claude 客户端格式 × 流式/非流式
- 日志 `Log.Other` 写入 `image_aware_entry_model`，用量日志 Model 列显示相机图标 + 入口模型 Popover

管理后台提供向导式 Drawer 配置路由规则（入口模型 + 视觉/编程模型下拉选择）。

## 🚀 变更类型 / Type of change
- [x] ✨ 新功能 (New feature)

## 🔗 关联任务 / Related Issue
- 无对应 Issue

## ✅ 提交前检查项 / Checklist
- [x] **非重复提交:** 已确认无重复 PR
- [x] **变更理解:** 见上方描述
- [x] **范围聚焦:** 排除了无关的 `__root.tsx`（devtools 注释）与 `pnpm-lock.yaml`（npm 误生成）
- [x] **本地验证:** 后端 `go build ./...` 通过；`go test ./middleware/`（图片检测表驱动单测 12 例）通过；前端 `tsc -b` 涉及文件无类型错误
- [x] **安全合规:** 无敏感凭据；JSON 统一走 `common.*`；配置仅写 options 表字符串，三库兼容

> 注：checklist 中「人工确认」项因本 PR 为 AI 辅助生成，未勾选，已在此如实标注。

## 📸 运行证明 / Proof of Work

带图请求被正确路由到视觉模型，纯文本请求回到编程模型（`record consume log` 的 `model_name` 字段）：
```text
model_name=glm-4.6v  prompt_tokens=41355  image_aware_entry_model=auto-coder   // 含图 → 视觉模型
model_name=glm-5     prompt_tokens=79     image_aware_entry_model=auto-coder   // 纯文本 → 编程模型
model_name=glm-5     prompt_tokens=41188  image_aware_entry_model=auto-coder   // 后续纯文本轮，仍回编程模型
```

路由决策日志（distributor，每请求一次，不刷屏）：
```text
image_aware_routing: entry=auto-coder has_image=true -> routed=glm-4.6v notify=true
```

Token 开启 `ModelRouteNotify` 后，响应流首个内容 delta 前置提示文本，客户端可见 `> [Route: auto-coder → glm-4.6v (image detected)]`。
