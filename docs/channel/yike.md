# 万镜一刻（Yike）渠道

本渠道把 new-api 视频任务协议转换为万镜一刻 `2026-07-07` RPC API。管理员配置阿里云 AK/SK，终端用户仍使用 new-api 地址和 Bearer Token。

## 渠道配置

| 配置项 | 值 |
| --- | --- |
| 类型 | `Yike` |
| API 地址 | 上海：`https://yike.cn-shanghai.aliyuncs.com`；新加坡：`https://yike.ap-southeast-1.aliyuncs.com` |
| 密钥 | `AccessKeyId\|AccessKeySecret` |
| 模型 | `Wonder-Pro,Wonder-Standard,happyhorse-1.1,happyhorse-1.0,wan2.7` |

账号需开通万镜一刻、拥有可用点数及 Yike 调用权限。自定义地址必须使用 HTTPS；适配器始终请求 RPC 根路径 `/`。

密钥必须把 ID 和 Secret 写在同一行，中间使用英文半角竖线 `|`，竖线两侧不要加空格：

```text
AccessKeyId|AccessKeySecret
```

- **单密钥**：填写一行，创建一个渠道；支持单独查询该账号积分。
- **批量添加**：每行填写一组完整凭证；系统按行创建多个独立渠道，每个渠道都可单独查询积分。这是多个账号或多组凭证的推荐方式。
- **多密钥模式**：每行填写一组完整凭证，但所有凭证保存在同一个渠道，按随机或轮询策略调用；该模式只用于请求轮换，不支持查询或合计多组凭证的积分。

多 Key 渠道的任务轮询会继续使用提交时选中的 Key，不会在任务执行中切换凭证。

适配器负责阿里云 V3 签名、`SubmitVideoGenerationJob` 提交、`GetVideoGenerationJob` 轮询及状态和结果转换。后台“测试渠道”使用选中的一组凭证调用免费只读的 `GetYikeAccountCredit`；单密钥渠道的“更新余额”也调用该接口，不会生成视频。余额为会员计划、加油包和赠送积分三类可用积分之和，刷新响应同时返回 `unit=credits`，渠道列表按“积分”展示，不把积分解释为美元。

## 用户调用

`$NEW_API_KEY` 是 new-api 发给用户的 Token，不是阿里云 AK/SK。

```bash
curl "$NEW_API_URL/v1/videos" \
  -H "Authorization: Bearer $NEW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7",
    "prompt": "一只橘猫在雨后的上海街道散步，电影感镜头",
    "duration": 5,
    "size": "1280x720"
  }'
```

图生视频可增加公网图片字段：

```json
{"image":"https://example.com/source.jpg"}
```

首尾帧和参考生视频通过 `metadata` 指定任务类型及素材：

```json
{
  "metadata": {
    "job_type": "first_last_frame",
    "medias": [
      {"type":"image","url":"https://example.com/first.jpg"},
      {"type":"image","media_id":"imported-last-frame"}
    ],
    "resolution": "720P",
    "aspect_ratio": "16:9"
  }
}
```

每个素材必须在 `url` 和 `media_id` 中二选一。素材类型可为 `image`、`video`、`audio`，实际能力取决于模型和任务类型。

## 查询和结果

提交后使用返回的公共任务 ID 查询或下载：

```bash
curl "$NEW_API_URL/v1/videos/task_xxx" \
  -H "Authorization: Bearer $NEW_API_KEY"

curl -L "$NEW_API_URL/v1/videos/task_xxx/content" \
  -H "Authorization: Bearer $NEW_API_KEY" \
  --output result.mp4
```

标准查询的 `metadata.url` 指向需鉴权的 `/content` 代理，不暴露上游签名地址。兼容路径 `/v1/video/generations/{task_id}` 则返回现有任务结构：成功后 `data.result_url` 是 Yike 官方临时 OSS 地址，`data.data` 保留脱敏后的 Yike 轮询响应及 `VideoGenerationJob.Output`，但移除 `Input`、`UserData` 和 `JobParameters`。`Output` 是 JSON 字符串，可继续解析 `Medias[].OutputUrl`。

| Yike 状态 | 视频状态 |
| --- | --- |
| `Created`、`Queuing` | `queued` |
| `Executing` | `in_progress` |
| `Finished` | `completed` |
| `Failed` | `failed` |

## 参数与限制

- `duration`：4～15 秒，默认 5 秒。
- `resolution`：`720P`、`1080P`。
- `aspect_ratio`：`16:9`、`9:16`、`4:3`、`3:4`、`1:1`；`size` 会转换为对应分辨率和宽高比。
- `job_type`：`text_to_video`、`image_to_video`、`first_last_frame`、`reference_to_video`。无媒体或单张图片可自动推断，多媒体必须显式指定。
- 当前固定 `metadata.n=1`，不透传 `metadata.job_parameters` 或 `user_data`。
- 不支持 remix、multipart 二进制文件、Base64/data URI 和明显的私网素材地址。
- Wonder 真人参考素材需先通过 Yike `ImportMedia` 获得 `MediaId`；本渠道不负责导入素材。
- HappyHorse 参考任务最多 9 个素材且不支持音频；Wonder 最多 15 个素材。
- `wan2.7` 当前拒绝尚未完成真实联调的 `reference_to_video`。
- OSS 结果地址可能过期；`/content` 只做代理，不负责长期归档。

## 验证

```bash
go test ./relay/channel/task/yike ./relay/common ./controller
```

主要实现位于 `relay/channel/task/yike`。计费复用 new-api 现有任务定价配置，生产启用前还应确认账号区域、模型权限和价格。
