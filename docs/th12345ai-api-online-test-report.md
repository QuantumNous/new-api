# th12345ai 上游联调记录（sd.12345ai.net）

日期：2026-07-20  
结论：**通过**（创建 → 轮询 → 成片）

## 1. 环境

| 项 | 内容 |
|----|------|
| Base URL | `https://sd.12345ai.net` |
| 鉴权 | `Authorization: Bearer LD-...`（卡密不落库） |
| 测试图 | `https://face.83zi.com/data/in/2026-07-20/d9d2ca2628f2ead1.png` |
| 模型 | `videos_stable`（对外可映射为 `sd2-431`） |

## 2. 接口

| 步骤 | 方法 | 路径 | HTTP | 结果 |
|------|------|------|------|------|
| health | GET | `/api/health` | 200 | `{"ok":true}` |
| models | GET | `/api/models` | 200 | `videos_stable`(35/task)、`videos_stable_fast`(30/task) |
| create | POST | `/api/tasks` | 200 | `id` + `status=queued` |
| query | GET | `/api/tasks/{id}` | 200 | `queued`→`processing`→`succeeded` |

## 3. 本轮任务

| 项 | 值 |
|----|------|
| task id | `ca785792-2bba-407d-98b6-09ea49f902ce` |
| 创建时间 | 2026-07-20T11:01:44.392Z |
| 完成时间 | 2026-07-20T11:08:31.991Z |
| 耗时 | ≈7 分钟 |
| estimatedCost | 35.00 |
| 终态 | `succeeded` |
| video_url | OSS mp4（阿里云杭州） |

## 4. 状态字段

- 任务 ID：`id`
- 状态：`status`（`queued` / `processing` / `succeeded` / `failed`）
- 成片：`video_url`
- 错误：`errorMessage`

## 5. 平台接入

渠道类型 **64 / th12345ai**，适配器 `relay/channel/task/th12345ai`。

建议模型重定向：

```json
{
  "sd2-431": "videos_stable",
  "sd2-fast-431": "videos_stable_fast"
}
```

设计见 `docs/superpowers/specs/2026-07-20-th12345ai-video-channel-design.md`。
调试页：`/seedance-debug.html`（模型 `sd2-431` / `sd2-fast-431`）。
