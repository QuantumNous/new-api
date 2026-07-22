# OpenAI / Sora 渠道「过人脸」设计

日期：2026-07-22  
状态：已实现

## 1. 背景

视频业务里，OpenAI（渠道类型 1）与 Sora（55）共用 `relay/channel/task/sora` 做 `/v1/videos` 任务。MegaByAI（65）已在渠道级内嵌「过人脸」：有参考图时经 `face.83zi.com` 处理后替换再上游。

OpenAI/Sora 渠道目前无此能力；调试页的客户端勾选不能覆盖工作台/API。需要在 **OpenAI + Sora 渠道服务端** 提供与 MegaByAI 同语义的渠道级开关与遮挡参数。

Face API（与 MegaByAI 相同）：

- `POST https://face.83zi.com/api/detect`，`multipart/form-data`，字段 `image`
- 可选：`singleEye`（省略默认开）、`size`（1–10，省略默认 5）
- 调用方本地：长边 >1600 等比缩小 → WebP 再上传
- 成功 `{ "ok": true, "url": "..." }`（强制 https）

## 2. 目标与非目标

### 2.1 目标

- 渠道级配置（非请求级参数）
- 作用于渠道类型 **OpenAI(1)** 与 **Sora(55)**
- 三项参数齐全：总开关、单眼遮挡、遮挡尺寸；默认与 MegaByAI 一致（开 / 单眼 / 5）
- 仅当请求含图片（URL 或 multipart 文件）且开关开时处理
- 抽取公共 face-pass 包，MegaByAI 迁移复用，避免双份实现

### 2.2 非目标

- 不增加客户端请求体 `face_pass` 等字段
- 不处理参考视频 / 音频
- 不改 Face API Base URL（固定 `https://face.83zi.com`）
- remix 路径首版不过人脸
- 非视频请求（聊天等）不走 sora adaptor，不受影响

## 3. 方案（选定：公共包 + sora 挂载）

### 3.1 公共包 `relay/channel/task/facepass/`

从 `megabyai` 抽出可复用逻辑：

| 能力 | 说明 |
|------|------|
| 参数解析 | singleEye / size 默认与钳制 |
| 收集图片 | JSON URL 键 + multipart 文件 blob |
| 预处理 | 最长边 ≤1600 → WebP |
| 上传 | `face.83zi.com`，返回 https URL |
| 选项结构 | `Options{ SingleEye, Size }` |

调用方负责：读渠道开关、决定收集哪些键、把处理后的 URL/字节写回各自上游协议。

MegaByAI adaptor 改为调用本包；行为与写回 `referenceImages` 保持不变。

### 3.2 渠道设置字段

`dto.ChannelOtherSettings` 新增（与 `megabyai_face_*` 并列，命名不混用）：

| JSON 字段 | 类型 | 默认（nil） | 含义 |
|-----------|------|-------------|------|
| `openai_face_pass` | `*bool` | 开 | 有参考图时是否过人脸 |
| `openai_face_single_eye` | `*bool` | 开（单眼） | `singleEye` |
| `openai_face_size` | `*int` | 5（钳制 1–10） | 遮挡尺寸 |

OpenAI(1) 与 Sora(55) **共用** 上述字段。

### 3.3 sora 处理管道

位置：`relay/channel/task/sora` 的 `BuildRequestBody`，在改写 model / duration 同步之后、发往上游之前。

```
请求进入 BuildRequestBody
  → 解析 JSON 或 multipart
  → openai_face_pass 开？且有图？
       是 → facepass 处理 → 写回 body/form
       否 → 原样
  → 继续现有 seconds/duration 同步与透传
```

**写回规则**

| 入站形态 | 写回 |
|----------|------|
| JSON（`images` / `input_reference` / `image` 等 URL） | 替换为处理后的 URL；清除已处理的别名字段时保持与现有 TaskSubmit 字段兼容（优先写回原有键；多 URL 用 `images`） |
| multipart 文件（如 `input_reference`） | 下载/使用处理后图重建对应 file part；其余字段原样 |
| 仅 URL、无文件的 multipart | 改写 URL 字段后重建 form |

无图：不调 Face API。

### 3.4 失败策略

开启时任一张失败（下载 / 预处理 / Face API）→ 整单失败，错误码形如 `openai_face_pass_failed`，**不**静默回退原图。

### 3.5 日志

前缀 `[openai_face_pass]`：

- `facePass` / `singleEye` / `size`
- 入参 URL 数与列表
- 每张 from → out
- 跳过原因（开关关 / 无图）

MegaByAI 继续用 `[megabyai_face_pass]`。

## 4. UI

| 主题 | 落点 |
|------|------|
| classic | `EditChannelModal.jsx`：type ∈ {1, 55} 展示三项，交互同 megabyai |
| default | `channel-mutate-drawer.tsx` + `channel-form.ts` + types；i18n 文案 |

文案示例：「参考图过人脸（有图时生效；满血/官方模型可关闭）」；开启后展开单眼 + 尺寸。

## 5. 代码落点

| 区域 | 变更 |
|------|------|
| `relay/channel/task/facepass/` | 新建公共包 |
| `relay/channel/task/megabyai/` | 改为调用 facepass，删除重复实现 |
| `relay/channel/task/sora/` | Init 读设置；BuildRequestBody 挂载 |
| `dto/channel_settings.go` | `OpenaiFacePass` / `OpenaiFaceSingleEye` / `OpenaiFaceSize` |
| classic / default 渠道编辑 UI + i18n | type 1/55 展示 |

## 6. 测试计划

- 单元：facepass 默认开/关、size 钳制、无图 skip、预处理 WebP
- sora：JSON / multipart 有图时 URL/文件被替换；开关关时 body 不变
- megabyai：迁移后现有 face-pass 单测仍通过
- 手工：渠道开过人脸 + 真人参考图可过上游；关开关后直传原图

## 7. 决策摘要

| 项 | 选择 |
|----|------|
| 开关层级 | 渠道级（A） |
| 渠道类型 | OpenAI(1) + Sora(55) |
| 参数 | 三项全要 |
| 默认 | 开 |
| 实现 | 公共 facepass 包 + sora 挂载 |
