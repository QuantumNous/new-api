# Ali 视频模型族支持补充说明

本次改动在既有 `relay/channel/task/ali` 异步任务通道内，补充了 `HappyHorse` 与百炼 `Kling` 视频模型族支持，同时保留原有万相视频逻辑不变。

## 支持范围

- `HappyHorse`
  - `happyhorse-1.0-t2v`
  - `happyhorse-1.0-i2v`
  - `happyhorse-1.0-r2v`
  - `happyhorse-1.0-video-edit`
  - `happyhorse-1.1-t2v`
  - `happyhorse-1.1-i2v`
  - `happyhorse-1.1-r2v`
- `Kling on Bailian`
  - `kling/kling-v3-video-generation`
  - `kling/kling-v3-omni-video-generation`

## 适配方式

- 统一走阿里异步提交与轮询查询接口。
- 在 `relay/channel/task/ali/adaptor.go` 内按模型族分支构造请求：
  - 老万相继续使用原有请求结构。
  - `HappyHorse` 使用 `input.media` 结构适配文生、首帧、参考生、视频编辑。
  - `Kling` 使用独立的 `media / multi_shot / multi_prompt / element_list / parameters` 结构适配文生、首帧、首尾帧、参考生、视频编辑。

## 请求兼容性

- `TaskSubmitReq` 新增 `videos` 字段，用于视频编辑类任务。
- 继续兼容 `input_reference` 和单图 `image` 的归一化处理。
- `Kling` 结果中的 `watermark_video_url` 会透传为 OpenAI 视频结果 `metadata.watermark_url`。

## 关键校验规则

- `HappyHorse i2v` 允许空 `prompt`，但必须且只能传 1 张首帧图。
- `HappyHorse r2v` 必须传 `prompt`，参考图数量限制为 1 到 9 张。
- `HappyHorse video-edit` 必须传 1 个视频，参考图最多 5 张。
- `Kling standard` 仅支持：
  - 文生视频
  - `first_frame`
  - `first_frame + last_frame`
- `Kling omni` 额外支持：
  - `refer`
  - `feature`
  - `feature + refer`
  - `feature + first_frame`
  - `base`
  - `base + refer`
- `Kling` 开启 `multi_shot=true` 时必须传 `shot_type`。
- `Kling` 当 `shot_type=customize` 时必须传 `multi_prompt`，此场景可不传顶层 `prompt`。
- `Kling` 在包含 `base` 或 `feature` 视频素材时，`audio` 必须为 `false`。
- `Kling` 的 `element_list` 数量校验按百炼文档约束执行：
  - 首帧/首尾帧场景最多 3 个主体
  - `refer` 场景下参考图与主体数量总和不超过 7
  - `base+refer` / `feature+refer` 场景下参考图与主体数量总和不超过 4

## 验证

已补充 `relay/channel/task/ali/adaptor_test.go`，覆盖：

- HappyHorse `i2v / r2v / video-edit / seed`
- Kling Omni 请求构造
- Kling `customize` 模式空 `prompt`
- Kling 非法素材类型、缺失 `multi_prompt`、`audio` 非法值、`element_list` 超限
- `watermark_video_url` 透传

## 视频按秒计费

- 新增 `video_seconds` 计费模式，专门用于视频任务模型。
- 价格配置按模型级生效，不按模型族共享。
- 统一价格表结构为 `model -> tier -> price_key`：
  - `tier` 配置层支持任意标准化档位，classic 可视化编辑器当前内置 `480p`、`720p`、`1080p`、`2k`、`4k`
  - `price_key` 当前仅支持 `default`、`silent`
- 价格选择顺序：
  - 当请求显式 `audio=false` 且配置了 `silent` 时，使用 `silent`
  - 其他情况一律回退到 `default`
- HappyHorse 计费参数转换规则：
  - 优先从 `metadata.resolution` 解析档位
  - 若未显式传 `metadata.resolution`，回退按请求 `size` 推导档位，保持和阿里请求构造一致
  - `480P -> 480p`
  - `720P -> 720p`
  - `1080P -> 1080p`
  - 未命中时默认 `1080p`
- Kling on Bailian 计费参数转换规则：
  - 优先从顶层 `mode` 解析档位，未传时再回退到 `metadata.mode`
  - `std -> 720p`
  - `pro` 或缺省 -> `1080p`
  - `metadata.audio=false` 视为静音计费候选
- `video_seconds` 任务虽然走单价计费，但不会在任务落库时标记为 `PerCallBilling`，这样轮询阶段仍可在后续需要时执行差额结算。
- 最终额度公式：
  - `quota = unit_price_per_second * duration_seconds * QuotaPerUnit * group_ratio`
