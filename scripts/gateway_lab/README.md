# Gateway Lab

独立的本地网关诊断脚本。模拟请求客户端和上游厂商，中间经过你正在验证的真实网关：

```text
client.py → new-api / ferrite → upstream.py
           真实 HTTP         本地假上游
```

Python 3.11+，仅标准库，不安装依赖。复制整个 `gateway_lab/` 目录即可在其他项目使用，不导入仓库代码，也不自动修改网关、账户、渠道或数据库。

## Quick start

在这个目录运行，或使用 `gateway_lab.py` 的绝对路径：

```bash
python3 -B gateway_lab.py serve
```

启动输出为 `READY http://127.0.0.1:19090`。保持这个终端运行。

在**隔离的开发网关**配置专用渠道：

- 上游地址 `http://127.0.0.1:19090/nodes/a`，不附加 `/v1`。
- Chat / Responses 使用 OpenAI 兼容渠道，测试模型名 `gateway-lab`。
- 上游密钥可以填无敏感内容的测试值，mock 不验证厂商凭据。
- 为专用测试用户配置足够配额、模型计价和分组权限，创建只允许测试模型的令牌。
- 不要让测试模型同时匹配真实厂商渠道；否则网关重试可能访问真实厂商。

另开终端发送请求。下面输入的是**网关令牌**，不是上游密钥；输入内容不进入命令参数或 shell 历史。示例使用 Bash：

```bash
read -rs -p 'Lab gateway token: ' LAB_API_KEY; echo
export LAB_API_KEY
python3 -B gateway_lab.py run \
  --base-url http://127.0.0.1:3000 \
  --model gateway-lab --api-key-env LAB_API_KEY \
  --cases nonstream,stream,fragmented_sse \
  --output /tmp/gateway-lab-report.json
unset LAB_API_KEY
```

结果逐项显示 `PASS`、`FAIL`、`OBSERVED` 或 `SKIP`，最后输出 `run_id`、报告路径和汇总。HTTP 200 本身不算成功，正常用例必须同时满足完整协议、精确合成内容和上游场景回执。

不经过网关的连通性自检：

```bash
python3 -B gateway_lab.py run \
  --base-url http://127.0.0.1:19090 --model gateway-lab \
  --cases nonstream,stream,fragmented_sse \
  --output /tmp/gateway-lab-direct.json
```

这只能证明模拟器与请求驱动能互通，不能证明网关正确。

## Multiple gateways and models

复制并修改 [`targets.example.json`](targets.example.json)，分别指定多个 new-api、ferrite 地址及令牌环境变量，然后：

```bash
python3 -B gateway_lab.py run --targets /path/to/targets.json \
  --cases nonstream,stream,fragmented_sse \
  --repeat 3 --concurrency 2 --output /tmp/gateway-lab-matrix.json
```

每个目标包含 `name`、`base_url`、`model`、`protocol`、`api_key_env`、`mock_url`，可选 `max_cancel_delay_ms` 和 `expectations`。一个目标对应一个模型和客户端协议；多个模型就增加多个不同名称的目标。省略 `api_key_env` 仅适用于不需要鉴权的测试服务。

支持的客户端协议：

- `chat`：`/v1/chat/completions`。
- `responses`：`/v1/responses`。
- `claude`：`/v1/messages`，发送 `anthropic-version` 和 `x-api-key`。
- `gemini`：`/v1beta/models/{model}:generateContent` 或 `:streamGenerateContent?alt=sse`，发送 `x-goog-api-key`。

网关可以转换上下游协议；报告分别记录客户端协议和 mock 实际收到的上游协议。对应的网关路由、渠道类型、模型映射仍需要你配置。厂商形状的固定响应不是完整厂商服务，也不代表真实厂商兼容性认证。

## Scenarios

```bash
python3 -B gateway_lab.py list
python3 -B gateway_lab.py list --protocol chat
```

内置场景：

- 正常与请求大小：`nonstream`、`stream`、`long_context`、`long_context_stream`。
- 延迟与读取：`delayed_headers`、`delayed_first_chunk`、`long_stream`、`idle_stream`、`slow_reader`。
- 客户端断开：`cancel_before_headers`、`cancel_midstream`。
- 空回复：`empty_body`、`empty_content`、`role_only`、`usage_only`。
- 协议损坏：`malformed_json`、`malformed_sse`、`truncated_stream`、`fragmented_sse`。
- 错误与重试：`http_401`、`http_429`、`http_500`、`http_503`、`retry_503`。
- 特殊结束与有效无文本结果：`bare_done_hold`、`tool_only`、`reasoning_only`、`safety_block`。

Chat 专用的角色、用量、推理、裸 `[DONE]` 场景，以及 Gemini 专用的安全拦截，会在其他协议下显示 `SKIP`，不静默改成正常响应。普通 Chat 流使用 `data: [DONE]`；`bare_done_hold` 特意发送非标准裸 `[DONE]` 并保持 HTTP body 未结束，用来检查网关是否错误等待连接关闭。

默认长上下文填充为 131072 / 262144 个字符。它验证请求体大小和转发，不代表真实 tokenizer 的 token 数或自然语言上下文分布。响应包含固定标记、中文与 emoji，可检查 UTF-8 分片损坏。

默认填充是连续的 `x`，某些网关的按词估算会把整段视作一个拉丁词。不能据此推断长请求正文丢失或要求 token 随字符数线性增长；核对计量时应另发固定输出、带空格的自然语言或 CJK 请求，并按网关既有计数规则比较日志。

mock 的 usage 只用于验证网关是否保留上游计量，不代表真实模型计费。非流式输入按收到的请求字节数除以 4 生成合成 token 数；普通 Chat 流不发送 usage，用于观察网关自己的回退估算。响应正文包含每次请求独立的 request_id，所以跨次请求并非相同文本；比较 completion token 的确定性时，需要固定请求标识或使用固定输出夹具，不能只比较字符数。

长请求和自定义参数见 [`scenarios.example.json`](scenarios.example.json)。**服务端和客户端需要加载同一份文件**：

```bash
python3 -B gateway_lab.py serve --scenarios /path/to/scenarios.json
# 另一个终端
python3 -B gateway_lab.py run --targets /path/to/targets.json \
  --scenarios /path/to/scenarios.json \
  --cases long_context,long_context_stream,delayed_headers,delayed_first_chunk,long_stream \
  --output /tmp/gateway-lab-long.json
```

`delay_s` 在响应头前等待；`first_chunk_delay_s` 在流响应头后、第一条事件前等待；`gap_s` 控制事件间隔；`read_delay_s` 控制客户端读取速度。还有 `context_chars`、`chunks`、`fragment_bytes`、`timeout_s`、`cancel_after_s`、`hold_s` 和 `expect`。时间单位为秒。JSON 文件按 `name` 覆盖内置配置，也可以增加完整定义的新场景。非法类型、未知字段和越界参数会在执行前报错。

## Verdicts and evidence

- `PASS`：满足该场景的明确契约，不是整个网关通过。
- `FAIL`：契约失败，或者未找到匹配的上游场景回执，进程退出码为 1。
- `OBSERVED`：记录网关策略结果，不宣称正确。空回复、损坏协议、慢读、空闲超时默认采用此状态。
- `SKIP`：该协议不支持所选场景；全部跳过也返回 1。
- 配置或 mock 健康检查失败返回 2，Ctrl-C 返回 130。

可以在目标配置中固定策略，例如：

```json
"expectations": {
  "empty_body": "rejected",
  "malformed_json": "rejected",
  "truncated_stream": "rejected"
}
```

`expect` / `expectations` 可选 `complete`、`cancel`、`recovered`、`rejected`、`observed`、`bare_done`、`tool`、`reasoning`、`safety`。先观察实际策略，再按产品契约选择期望；不要只为把结果变绿而覆盖。

报告包含状态码、TTFB（首个 body 字节）、TTFT（首个语义内容）、事件间隔、耗时、终止事件、文本长度和 SHA-256、用量、请求字节数、关联响应头、上游尝试次数及节点、取消延迟。不会记录令牌、请求正文或原始错误响应。

`retry_503` 对同一个请求标记首次返回 503，再次返回正常内容；驱动本身**不重试**。需要启用网关重试并配置两个测试渠道，例如 `/nodes/a` 和 `/nodes/b`。报告观察尝试和节点，不能推断内部权重、渠道健康、实际扣费是否正确。

取消通过要求 mock 观察到网关上游连接实际关闭，默认阈值 1000ms。`--cancel-grace-s` 控制等待回执的时间；如果提高取消阈值，也要留足回执等待时间。延迟比较使用客户端和 mock 的墙上时钟，优先在同一主机运行；跨主机时必须同步时钟。

## Networking and safety

- 默认只监听 `127.0.0.1:19090`。远程机器或容器需要可访问的 mock 地址，`--mock-url` 指的是驱动访问回执的地址，不是网关的 API 地址。
- Linux Docker 的容器内 `127.0.0.1` 不是宿主机。可将 mock 绑定到隔离开发网络可达地址，给容器配置 `host.docker.internal:host-gateway`，渠道使用 `http://host.docker.internal:19090/nodes/a`。不要暴露到公共网络。
- `/healthz`、`/events?run=...`、`/v1/models` 不鉴权。`--events-file /path/to/receipts.ndjson` 可追加安全元数据；文件不自动轮转。
- HTTP 401/429/5xx 可能触发网关自动禁用渠道或熔断。只使用隔离实例、专用模型、假上游和可丢弃账户，不运行在生产路由上。
- `slow_reader` 是应用层暂停读取，小响应可能被 socket 缓冲吸收；不保证制造真实背压。延迟、断开、分片也不等于真实丢包、带宽限制、DNS、TLS、HTTP/2 故障。
- 连接拒绝、响应头前 TCP RST、DNS、TLS 与 HTTP/2 错误不在内置场景中。可以另建指向关闭端口或专用故障服务的隔离渠道，再检查真实网关返回和错误日志；这类故障没有 mock 场景回执，不会被本工具自动判为 PASS。
- 自定义长度、时间、并发和回执数量有上限。默认串行；这不是无界压测工具。结束后 Ctrl-C 关闭 mock，清理你创建的测试账户和渠道。

## Continuous integration

`Gateway Lab` 工作流直接启动假上游并通过 CLI 检查四种原生协议。它只验证工具自身的协议契约，不代表 new-api 或 ferrite 已验证。真实网关验证仍需将同一客户端指向隔离实例；日志中的渠道、错误重试、token 及扣费需要按请求标识另行对账。
