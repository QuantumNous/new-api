# MegaByAI 渠道内嵌「过人脸」设计

日期：2026-07-21  
状态：已实现（含遮挡参数 UI）

## 1. 背景

MegaByAI 上游对真人图片敏感，直传参考图易被拦截。调试页 `seedance-debug.html` 已有「过人脸审核」勾选，但工作台/API 用户不会走调试页，需在 **megabyai 渠道服务端**内嵌同等能力。

Face API（`E:\OpenCV-Haar-eyes` / 生产 `https://face.83zi.com`）：

- `POST /api/detect`，`multipart/form-data`，字段 `image`
- 可选：`singleEye`（省略默认开）、`size`（1–10，省略默认 5）
- 服务端：长边 >1600 等比缩小，结果一律 WebP
- 成功返回 `{ "ok": true, "url": "..." }`（网关强制改写为 https）

## 2. 方案（选定）

### 2.1 渠道开关与遮挡参数

| 项 | 存储 | 默认 |
|----|------|------|
| 过人脸 | `MegabyaiFacePass *bool` | nil/true=开，false=关 |
| 单眼遮挡 | `MegabyaiFaceSingleEye *bool` | nil/true=单眼，false=双眼（`singleEye=0`） |
| 遮挡尺寸 | `MegabyaiFaceSize *int` | nil=5，夹到 1–10 |

UI（classic + default）：仅渠道类型 `megabyai`（65）；过人脸开启时显示「单眼遮挡」「遮挡尺寸」。

### 2.2 处理管道

位置：`relay/channel/task/megabyai`，在 `BuildRequestBody` 中、发往上游之前。

开关开启时：

1. 收集待处理图片（JSON URL / multipart 文件）
2. 本地预处理：最长边 >1600 等比缩小 → WebP
3. `POST https://face.83zi.com/api/detect`，传渠道配置的 `singleEye` / `size`
4. 用返回 url（https）写入 `referenceImages`，清除别名字段
5. `rejectUnsupportedFrames` + `normalizeCreateBody`

### 2.3 日志

前缀 `[megabyai_face_pass]`，输出：

- 入参全部图片 URL
- `facePass` / `singleEye` / `size`
- 每张处理结果（from → out）
- 最终提交上游的完整 `referenceImages`

### 2.4 失败策略

开启时任一张失败 → 整单失败（不静默回退原图）。

## 3. 非目标

- 不改其它视频渠道
- 不处理参考视频 / 音频
- Face API Base URL 固定 `https://face.83zi.com`

## 4. 代码落点

| 区域 | 变更 |
|------|------|
| `dto/channel_settings.go` | `MegabyaiFacePass` / `MegabyaiFaceSingleEye` / `MegabyaiFaceSize` |
| `relay/channel/task/megabyai/` | 预处理、上传参数、日志 |
| classic / default 渠道编辑 UI + i18n | 三项配置 |

## 5. 测试计划

- 单元：开关/参数默认与夹取；缩放与 WebP
- 联调：界面改 `singleEye=关` + `size=10` 后，图床日志应显示对应参数，且上游可通过真人参考图
