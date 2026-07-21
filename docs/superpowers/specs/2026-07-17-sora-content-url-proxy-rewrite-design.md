# Sora / OpenAI Videos：鉴权 content URL 改写为本站代理

日期：2026-07-17  
状态：已批准

## 背景

59ai 等 OpenAI Videos 兼容上游（`POST/GET /v1/videos`）完成后会返回：

`https://{upstream}/v1/videos/{upstream_id}/content`

该地址需上游 Bearer。用户持本站二次分发 Key 无法直接下载。

本站已有 `GET /v1/videos/{公开task_id}/content`（VideoProxy），Sora/OpenAI 渠道会用渠道 Key 回源。缺口在查询响应未把地址改成代理 URL。

## 方案

仅改 `relay/channel/task/sora` 的 `ConvertToOpenAIVideo`：

1. 继续把 `id`（及存在的 `task_id`）换成公开 task id。
2. 对 `url` / `video_url` / `content_url` / `metadata.url` / `metadata.video_url` / `metadata.content_url`：
   - **仅当** URL path 匹配 `/v1/videos/{id}/content` 时，改写为 `BuildProxyURL(公开task_id)`。
   - 公网 CDN / 直链 `.mp4` / 签名 URL：**不改**。

## 非目标

- 不新建渠道类型；59ai 用 Sora（55）或 OpenAI（1）配置即可。
- 不改 83zi / Vyro / 豆包等其它适配器。
- 不改 VideoProxy 回源逻辑（已对 Sora/OpenAI 正确）。

## 风险与防护

| 风险 | 防护 |
|------|------|
| 误改 CDN 直链 | 仅匹配鉴权 content path |
| 影响其它厂商 | 改动范围仅 sora 包 |

## 配置说明（运维）

| 项 | 值 |
|----|-----|
| 渠道类型 | Sora（55）或 OpenAI（1） |
| Base URL | `https://59aiapi.com`（不要带 `/v1`） |
| 模型 | `seedance2.0` |
| Key | 上游 Bearer |

## 测试

- 上游 JSON 含 `https://59aiapi.com/v1/videos/task_up/content` → 改写为本站代理。
- 上游 JSON 含 `https://cdn.example.com/a.mp4` → 保持不变。
- `id` / `task_id` 替换为公开 id。
