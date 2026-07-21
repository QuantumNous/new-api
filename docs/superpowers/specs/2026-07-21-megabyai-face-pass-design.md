# MegaByAI 渠道内嵌「过人脸」设计

日期：2026-07-21  
状态：已确认设计，待实现

## 1. 背景

MegaByAI 上游对真人图片敏感，直传参考图易被拦截。调试页 `seedance-debug.html` 已有「过人脸审核」勾选，但工作台/API 用户不会走调试页，需在 **megabyai 渠道服务端**内嵌同等能力。

Face API（`E:\OpenCV-Haar-eyes` / 生产 `https://face.83zi.com`）：

- `POST /api/detect`，`multipart/form-data`，字段 `image`
- 服务端：长边 >1600 等比缩小，结果一律 WebP
- 成功返回 `{ "ok": true, "url": "https://face.83zi.com/data/out/..." }`

## 2. 方案（选定）

### 2.1 渠道开关

| 项 | 值 |
|----|-----|
| 存储 | `dto.ChannelOtherSettings.MegabyaiFacePass *bool` |
| 默认 | `nil` / 未设置 → **开启** |
| 显式 `false` | 关闭 |
| 显式 `true` | 开启 |

UI（classic + default）：仅渠道类型 `megabyai`（65）显示开关「过人脸」，文案说明：开启后参考图经 face.83zi.com 处理再提交上游；**默认勾选**。

### 2.2 处理管道

位置：`relay/channel/task/megabyai`，在 `BuildRequestBody` 中、发往上游之前。

开关开启时：

1. 收集待处理图片：
   - JSON：`images` / `image` / `input_reference` / `referenceImages` 中的 http(s) URL
   - multipart：图片 file part（及表单里的 URL 字段）
2. 对每张图：
   - URL：下载字节（遵守项目现有 SSRF / fetch 设置）
   - 文件：直接读 buffer
   - **网关本地预处理**：解码图片 → 最长边 >1600 时等比缩小（不放大）→ 编码为 **WebP**（建议质量约 80）
   - 将预处理后的 WebP 以 `POST https://face.83zi.com/api/detect` 上传，字段名 `image`，文件名可用 `*.webp`
3. 用返回 `url` 替换，统一写入 `referenceImages`，清除别名字段
4. 再执行现有 `rejectUnsupportedFrames` + `normalizeCreateBody`（含去掉 `seconds` 等）

关闭开关：跳过本管道，行为与现网一致。

本地预处理目的：减小上传体积、统一格式，避免超大原图打满带宽；face 服务仍会再做一次兜底缩放。

### 2.3 失败策略

开启时任一张图下载/过人脸失败 → **整单失败**，返回明确 `TaskError`（不静默回退原图）。

### 2.4 配置读取

Adaptor `Init` / `BuildRequestBody` 从 `info.ChannelOtherSettings.MegabyaiFacePass` 判断是否启用；`nil` 视为 `true`。

## 3. 非目标

- 不改 Sora / 豆包 / th12345ai 等其它渠道
- 不处理参考视频 / 音频
- 不做可配置 Face API Base URL（首版固定 `https://face.83zi.com`）
- 不在本地做人脸/眼睛遮挡（遮挡仍由 face.83zi.com 完成）

## 4. 代码落点

| 区域 | 变更 |
|------|------|
| `dto/channel_settings.go` | 新增 `MegabyaiFacePass *bool` |
| `relay/channel/task/megabyai/` | 本地 1600+WebP 预处理、face-pass 上传/替换 + 单测 |
| 依赖 | 复用项目已有 `golang.org/x/image/webp` 等图片编解码能力（见 `service/image.go`） |
| `web/classic/.../EditChannelModal.jsx` + i18n | 开关 UI，默认勾选 |
| `web/default/.../channel-mutate-drawer` 等 | 开关 UI，默认勾选 |

## 5. 测试计划

- 单元：`nil`/`true`/`false` 开关语义；本地缩放（长边>1600 缩小 / ≤1600 不放大）；WebP 输出；URL 列表替换后只剩 `referenceImages`；失败时返回错误
- 联调：开启时带真人参考图创建任务应能过上游；关闭时直传（可能被上游挡）
