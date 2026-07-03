# Seedance 视频模型接入说明

本文档说明当前 NewAPI 实例中 Seedance 视频模型的对外别名、上游映射、计费规则和维护注意事项。

本文档面向后续 Codex 维护和人工运维交接。

## 对外接口

创建视频任务：

```bash
curl --location --request POST 'https://token.mewinyou.shop/v1/video/generations' \
  --header 'Authorization: Bearer <用户 API Key>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "model": "seedance-720p-fast-c37",
    "prompt": "海边日落，镜头缓慢向前推进，电影感，柔和光线",
    "duration": 4,
    "resolution": "720p",
    "size": "16:9",
    "mode_type": "text2video",
    "n": 1
  }'
```

查询任务状态：

```bash
curl --location 'https://token.mewinyou.shop/v1/video/generations/<task_id>' \
  --header 'Authorization: Bearer <用户 API Key>'
```

用户只能请求下面列出的对外模型别名。不要让用户直接请求 `12:seedance-2.0-720p` 这种原始上游模型名。

## 对外模型列表

| 对外模型 | 上游映射模型 | 计费单位 | 当前售价 |
| --- | --- | --- | ---: |
| `seedance-720p-fast-c37` | `37:seedance-2.0-720p-fast` | 按条 | 3.90 |
| `seedance-720p-c37` | `37:seedance-2.0-720p` | 按条 | 5.20 |
| `seedance-480p-fast-c13` | `13:seedance-2.0-480p-fast` | 按秒 | 0.39 |
| `seedance-480p-c13` | `13:seedance-2.0-480p` | 按秒 | 0.47 |
| `seedance-480p-fast-c36` | `36:seedance-2.0-480p-fast` | 按秒 | 0.39 |
| `seedance-720p-fast-c12` | `12:seedance-2.0-720p-fast` | 按秒 | 0.58 |
| `seedance-720p-c12` | `12:seedance-2.0-720p` | 按秒 | 0.68 |
| `seedance-720p-c33` | `33:seedance-2.0-720p` | 按秒 | 0.68 |
| `seedance-720p-c29` | `29:seedance-2.0-720p` | 按秒 | 0.68 |
| `seedance-1080p-c30` | `30:seedance-2.0-1080p` | 按秒 | 1.04 |
| `seedance-720p-c31` | `31:seedance-2.0-720p` | 按条 | 9.75 |
| `seedance-720p-fast-c8` | `8:seedance-2.0-720p-fast` | 按条 | 8.19 |
| `seedance-720p-c8` | `8:seedance-2.0-720p` | 按条 | 9.75 |
| `seedance-720p-fast-c35` | `35:seedance-2.0-720p-fast` | 按条 | 8.19 |
| `seedance-720p-fast-4img-c18` | `18:seedance-2.0-720p-fast-4img` | 按条 | 6.24 |
| `seedance-720p-4img-c18` | `18:seedance-2.0-720p-4img` | 按条 | 7.80 |
| `seedance-720p-c17` | `17:seedance-2.0-720p` | 按秒 | 0.68 |

以上价格是当前配置给用户看的售价，包含 30% 加价。写入 `ModelPrice` 时不要再除以汇率。

## 计费规则

所有 Seedance 对外别名都使用 NewAPI 的 `ModelPrice`。

按秒模型不放进 `TASK_PRICE_PATCH`，最终计费为：

```text
ModelPrice * duration * group_ratio
```

按条模型必须放进 `TASK_PRICE_PATCH`，最终计费为：

```text
ModelPrice * group_ratio
```

当前 `TASK_PRICE_PATCH` 只应该包含按条别名：

```text
seedance-720p-fast-c37,
seedance-720p-c37,
seedance-720p-c31,
seedance-720p-fast-c8,
seedance-720p-c8,
seedance-720p-fast-c35,
seedance-720p-fast-4img-c18,
seedance-720p-4img-c18
```

不要把按秒模型加入 `TASK_PRICE_PATCH`。

## 模型广场展示

模型广场应把这 17 个对外模型都展示在供应商 `即梦` 下。

展示元数据：

- 供应商：`即梦`
- 图标：`Jimeng.Color`
- 对外别名模型设置 `sync_official = 0`
- 按条模型标签包含 `按条`
- 按秒模型标签包含 `按秒`

本部署中有一个本地展示补丁：模型广场使用 `quota_type = 2` 表示固定价格的按秒模型。这个字段只影响模型广场展示，不驱动真实运行时计费。

原始上游 Seedance 模型必须隐藏：

```text
12:seedance-2.0-720p
12:seedance-2.0-720p-fast
13:seedance-2.0-480p
13:seedance-2.0-480p-fast
17:seedance-2.0-720p
18:seedance-2.0-720p-4img
18:seedance-2.0-720p-fast-4img
19:seedance-2.0-720p
19:seedance-2.0-720p-fast
26:seedance-2.0
29:seedance-2.0-1080p
29:seedance-2.0-720p
30:seedance-2.0-1080p
31:seedance-2.0-720p
33:seedance-2.0-720p
33:seedance-2.0-720p-fast
35:seedance-2.0-720p-fast
36:seedance-2.0-480p-fast
37:seedance-2.0-720p
37:seedance-2.0-720p-fast
8:seedance-2.0-720p
8:seedance-2.0-720p-fast
```

这些原始模型不应该出现在 `/v1/models` 或 `/api/pricing`。

## Channel 17 维护说明

视频渠道名称为 `video`，渠道 ID 为 `17`。

关键要求：

- `channels.models` 中保留对外别名。
- `channels.model_mapping` 中保留对外别名到原始上游模型的映射。
- 原始上游 Seedance 模型不要保留在 `abilities` 中。
- 原始上游 Seedance 模型在模型广场元数据中应设置 `models.status = 0`。
- Channel 17 的上游模型自动同步应保持关闭，否则原始上游模型可能重新出现，或者对外别名会被误判为上游已删除模型。

## AistarsLab 配置同步

可通过 AistarsLab 配置接口同步 Seedance 对外别名、价格、计费单位、模型广场元数据和 Channel 17 的 `models` / `model_mapping`。

手动预览变更：

```bash
curl -sS 'https://token.mewinyou.shop/api/ratio_sync/aistarslab/sync' \
  -H 'Authorization: Bearer <Root API Key>' \
  -H 'Content-Type: application/json' \
  -d '{"dry_run":true}'
```

确认后写入：

```bash
curl -sS 'https://token.mewinyou.shop/api/ratio_sync/aistarslab/sync' \
  -H 'Authorization: Bearer <Root API Key>' \
  -H 'Content-Type: application/json' \
  -d '{"dry_run":false}'
```

默认配置：

```text
AISTARSLAB_CONFIG_URL=https://api.video.aistarslab.com/openapi/generation/config
AISTARSLAB_CONFIG_SYNC_CHANNEL_ID=17
AISTARSLAB_CREDIT_RATE=100
AISTARSLAB_MARKUP_RATE=1.3
AISTARSLAB_CONFIG_SYNC_ENABLED=false
AISTARSLAB_CONFIG_SYNC_INTERVAL_MINUTES=30
```

接口密钥优先从 `AISTARSLAB_API_KEY` 读取；未设置时使用同步渠道的 API Key。
自动同步默认关闭，设置 `AISTARSLAB_CONFIG_SYNC_ENABLED=true` 后仅主节点按间隔执行。

## 验证命令

检查原始上游 Seedance 模型没有暴露：

```bash
curl -sS 'https://token.mewinyou.shop/api/pricing' \
  | jq -r '.data[]? | select(.model_name|test("^[0-9]+:seedance-2\\\\.0")) | .model_name'
```

期望输出：空。

检查 17 个对外别名都能看到：

```bash
curl -sS 'https://token.mewinyou.shop/api/pricing' \
  | jq -r '.data[]? | select(.model_name|test("^seedance-.*-c[0-9]+$")) | [.model_name, .quota_type, .model_price] | @tsv' \
  | sort
```

期望数量：17。

本部署中的 `quota_type` 含义：

```text
0 = token 或倍率计费
1 = 按条计费
2 = 按秒计费，仅用于模型广场展示
```

检查用户可见模型列表：

```bash
curl -sS 'https://token.mewinyou.shop/v1/models' \
  --header 'Authorization: Bearer <用户 API Key>' \
  | jq -r '.data[]?.id' \
  | grep -E 'seedance|^[0-9]+:seedance' \
  | sort
```

期望结果：只出现 `seedance-...-cXX` 对外别名，不出现原始上游模型名。
