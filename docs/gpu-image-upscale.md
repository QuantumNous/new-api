# GPT Image 2.5 超分模型

新增本站模型别名 `gpt-image-2.5-2k`、`gpt-image-2.5-4k`。渠道模型映射指向已验证可用的 `gpt-image-2.5`。这两个名称表示本站提供的后处理超分，不表示上游原生生成该分辨率。

约定售价：2K **0.07 元/张**、4K **0.08 元/张**。上线时通过现有模型价格设置配置；底层 ModelPrice 以 USD 计价，须按站点当前汇率换算并核对 default 分组实际扣费，不可把人民币数值直接当 USD 写入。

## 客户请求

```json
{
  "model": "gpt-image-2.5-4k",
  "prompt": "一座海边的小屋",
  "size": "4096x2304",
  "n": 1,
  "stream": false,
  "output_format": "png"
}
```

可用于 `/v1/images/generations` 和现有 JSON 图片后台任务。较慢的请求请使用 [图片任务接口](image-tasks.md)，POST `/v1/images/tasks` 后查询结果；同步请求仍受 Cloudflare 和客户自身超时限制。本功能不通过提前返回 HTTP 200 或空白流来掩盖超时。

首版只支持单张、非流式 JSON 请求及 PNG/WebP 输出；不支持 multipart、透明输出或渠道参数覆盖/原样透传。未指定 `output_format` 时默认返回 WebP，以减少 4K 传输等待；显式指定 PNG 时仍返回 PNG。普通模型行为不变。模型决定长边为 2048 或 4096，保持上游实际原图比例；size 用于指定期望比例，上游阶段缩放为长边 1024。若上游没有遵守比例，原有 output_warnings 如实报告，不拉伸或裁剪。

结果仍在 `data[0].b64_json`，尺寸与格式字段按实际文件测量。`data[0].upscale` 记录处理方法、源尺寸、目标长边，以及排队、GPU、编码、上传耗时和传输字节数。上游 usage 保留用于原有账本；成功只结算一次新模型价格。GPU 离线在调用上游前失败；生成后超分失败不自动重新生图、不冒充高清成功，按现有失败路径退回预扣。

## GPU 节点

API 服务器保存短期超分任务；节点主动通过 HTTPS 心跳、领取、下载原图、执行 Real-ESRGAN、上传结果。节点凭据只授权这些接口，不是管理员令牌。首次初始化自动建立凭据，重启不更换；显式清空 ImageUpscaleWorkerToken 可禁用。只有站长能在渠道页下载节点配置。

在已安装 Real-ESRGAN 的 Windows 目录下建立 `relay-worker`，放入 `worker.py`、`run-worker.ps1`、`install-worker.ps1` 和下载后命名为 `config.json` 的私有配置。父目录应有 `upscale.py`、`.venv` 和 `engine`。

管理员 PowerShell 执行 `install-worker.ps1`。任务名 `HardyImageUpscaleWorker`，使用当前用户的受限 S4U 任务，开机启动、退出重启，允许单实例。运行时阻止自动休眠，显示器可关闭；不更改永久电源计划。

网络失败时保留当前任务和结果文件，重新上传不会重新生图。节点用 WebP quality 100 做高质量传输压缩；实测汉库克壁纸从 5.92 MiB 无损 WebP 降至 0.80 MiB，PSNR 46.46 dB。服务器验证完整解码和准确尺寸；客户请求 PNG 时再还原为 PNG，请求 WebP 时直接返回 WebP。该传输压缩为有损编码，响应的 `data[0].upscale.transport` 会如实标记 `webp-quality-100`。服务器端任务最多等待 10 分钟，过期数据在节点领取时清理。进程在上游生成、计费等任意边界崩溃时，仍受原图片任务的 unknown 状态约束，不承诺分布式 exactly-once。

## 验证证据

- API 回归：强制 1K 上游参数、保留提示词、拒绝未授权/错误租约/错误尺寸、上传确认丢失后幂等返回、失败退款且上游只调用一次。
- 真实 RTX 5070 Ti：S4U 计划任务在 SSH 启动会话结束后仍能领取任务；隔离端点输出 2048×1152 和 4096×2304 已验证，不调用收费生图。
- 优化前隔离隧道全链路耗时约 56 秒和 148 秒；WebP quality 100 优化后分别为 19.01 秒和 28.06 秒。均包含网络，不是纯 GPU 推理性能。
- 完整 service 套件存在既有渠道亲和缓存测试的共享状态失败，干净 HEAD 也复现；相关图片测试、controller/model/router/relay/openai 测试通过。

不得提交 config.json、凭据、客户图片或运行日志。线上模型、价格与常驻工作程序的最终启用状态应以实际发布验收为准。

## 2026-09-11 发布记录

发布版本 `hardy-gpu-upscale-20260911`，二进制 SHA256 `868c223ff74ee187460442674dd0a4093b99be18bbfe88329c3373a36be832ff`，镜像 `sha256:52b57699184ed5a503936590e2049fcaa4293784eb1c18c1dce399be03ed4a8a`。通过 hardy-app 受限入口构建和激活，公网版本一致，应用 healthy、重启计数 0。

GoEasy生图渠道保留 gpt-image-2.5，新增两个超分别名并映射到 gpt-image-2.5。公开 pricing 接口确认 default 分组按次价格分别为 0.07、0.08；站点现有显示币种为元、汇率为 1，所以对应用户指定人民币售价。没有改变原 1K 的 0.06 价格或全站汇率。

首版每请求 n=1，每进程最多四个在途超分请求，满载会在调用上游之前返回 429。Windows 节点已安装为 HardyImageUpscaleWorker 计划任务，使用受限用户 abc\31782，配置开机启动。HTTP 客户端标识为 Hardy-GPU-Worker/1.0，解决默认 Python 标识被 Cloudflare 1010 拒绝的问题，没有修改主机网络或 Cloudflare 防火墙。

计费回归按实际配置校验：2K 扣 35000 quota、4K 扣 40000 quota，失败退款。线上验证没有额外发起收费生图；真实 GPU 输出和应用链路通过隔离测试验证。生产同步调用仍受代理超时影响，客户端应优先使用持久化图片任务接口。
