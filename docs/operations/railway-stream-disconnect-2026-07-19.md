# Railway Responses 流断开事件记录（2026-07-19）

## 状态

- 记录范围：上线前最近 3 小时的 Railway 生产流日志。
- 影响现象：客户端报错 `stream disconnected before completion: stream closed before response.completed`。
- 修复状态：代码修复和本地定向验证已完成；生产部署及上线后验证为 **pending**。

## 生产样本

最近 3 小时共观察到 608 个流式请求：

| 结束原因 | 数量 | 占比 |
| --- | ---: | ---: |
| `done` | 589 | 96.875% |
| `client_gone` | 19 | 3.125% |

这 19 个 `client_gone` 样本均来自 Codex Desktop，应用侧连接为 HTTP/1.1。相关请求的上游响应均为 HTTP 200，断开前仍有持续输出。断开前最后一段数据后的空闲时间分布为：p50 约 63 ms，p95 约 385 ms。

典型样本（时间为 Asia/Singapore）：

| 时间 | 上游状态 | elapsed | first | last | idle | 响应字节 | chunks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 18:49:36 | 200 | 7224 ms | 136 ms | 7159 ms | 65 ms | 184689 | 178 |
| 18:56:00 | 200 | 4187 ms | 59 ms | 4168 ms | 18 ms | 155791 | 80 |

其中 `first` 为首个上游数据到达时间，`last` 为最后一个已记录数据块时间，`idle = elapsed - last`。这两个样本的首字时间分别为 136 ms 和 59 ms，不支持“首字等待导致断开”的判断。

## 根因判断

现有日志更支持以下判断：连接在服务到边缘网络再到客户端的下游链路中提前关闭，客户端因此没有收到协议终止事件 `response.completed`。依据如下：

- 上游已返回 HTTP 200，并持续产生数据；
- 断开前最后一个数据块距连接结束仅数十到数百毫秒，不符合长时间无数据超时；
- 日志结束原因为 `client_gone`，而不是上游超时或上游错误；
- 该现象集中于 Codex Desktop 的 HTTP/1.1 连接。

当前证据不能进一步确定断开发生在 Railway 边缘、客户端本地网络还是客户端自身。需要上线后结合新的结束原因和终止事件日志继续缩小范围。

## 协议边界

一旦服务确认真实 `client_gone`，下游连接已经不可写，服务端无法再向该连接补发 `response.completed` 或 `response.failed`。因此，本次修复能保证的是：

- 在连接仍可写时，所有已知正常、上游失败、解析失败和本地失败路径都生成合法的 Responses 终止事件；
- 检查终止事件的实际写入结果，避免仅在内存中生成但未写出的假成功；
- 准确区分 `client_gone`、上游失败、客户端协议错误和本地内部错误；
- 避免流已开始后退回非流式 JSON 错误或触发不安全重试。

它不能恢复已经断开的 TCP/HTTP 连接，也不能保证客户端在边缘网络丢弃最后数据时收到终止事件。

## 本次代码修复范围

- OpenAI 原生 Responses 流：统一规范化 `response.completed`、`response.failed` 和顶层错误，并保留 response ID、状态、模型、输出、usage 和错误信息。
- Chat Completions 转 Responses：覆盖无类型错误包、空响应、仅 `[DONE]`、扫描错误、超时、转换失败、panic 和终止事件写入失败。
- Gemini 转 Responses：覆盖空 body、空候选、提示词拦截、畸形数据、扫描异常和终止事件写入失败。
- 终止事件写入器：只有在完整 SSE 数据块成功写入后才标记协议终止；连接仍可写时允许重试待发送的准确终止 payload。
- 流结束状态：协议终止状态可纠正提前记录的 scanner EOF/`[DONE]`；真实 `client_gone` 可覆盖非协议结束状态；本地内部失败单独标记为 `internal_error`，不作为上游渠道健康惩罚依据。
- 回归测试：覆盖失败终止、空流、畸形 JSON、usage 累积、写入失败、客户端断开和渠道健康分类。

## 验证记录与上线计划

已完成：

- 定向包测试：OpenAI、Gemini、流状态和渠道健康相关测试通过。
- Relay 与 service 测试集通过。
- 相关 Go 包 `go vet` 通过。
- 新增流路径的定向 race 测试通过。

生产验证（**pending**）：

1. 部署包含本次修复的提交，并记录生产 deployment ID 和对应 Git commit。
2. 确认容器启动、数据库连接、健康检查和基础 API 无新增错误。
3. 检查上线后 Responses 请求是否都记录明确的结束原因，并确认正常路径实际发送 `response.completed`。
4. 检查 `response.failed`、`internal_error`、`upstream_failed`、`terminal_client_error` 和合成终止事件日志，确认分类与响应一致。
5. 持续观察 `client_gone` 数量、占比、客户端类型、HTTP 版本、首字时间、最后输出空闲时间和响应大小；与本记录的 3.125% 基线比较。
6. 若仍出现同一客户端错误，关联同一请求的服务端结束原因：真实 `client_gone` 继续归因到下游连接；非 `client_gone` 则检查是否存在遗漏的终止事件路径。
