# API 图片后台任务

目的：避免慢生图超过 Cloudflare 的单次同步请求等待上限。原 `/v1/images/generations` 同步行为保留；新增任务接口不会让客户原有的同步 fetch 自动变为异步，客户需要替换请求函数。

## 客户端最小接入

将 `docs/examples/image-client.mjs`、`docs/examples/image-task-client.mjs` 放在客户程序同一目录。保留原来构造 `body` 的代码，把 fetch 和响应读取部分替换成：

```js
import { randomUUID, webcrypto } from 'node:crypto';
import { requestImageTask } from './image-task-client.mjs';

// 同一次业务提交生成一次编号，持久化保存；恢复时继续使用这个编号。
const submissionId = randomUUID();
const data = await requestImageTask(
  'https://hardy777.top/v1/images/generations',
  apiKey, // 沿用客户安全配置里的 Key，不要把 Key 写入任务日志。
  body,   // 原来的 model、prompt、images、n、quality 等参数。
  {
    submissionId,
    crypto: webcrypto,
    onTask: (task) => {
      // 将 submissionId / taskId 保存到本次业务记录，方便断线后恢复。
      console.log('image task', task);
    },
  },
);
return data;
```

`data` 就是最终图片 JSON，仍用 `data.data[i].b64_json`，包含实测 size 和原 usage；不要再次 `.json()` 或 `.text()`。示例的 onTask 日志展示了需保存的字段，正式接入应保存到客户已有数据库/任务记录，不应仅依赖控制台日志。

网络报错会携带 `error.submissionId` 和已取得的 `error.taskId`。已知道 taskId 时，以 `{taskId}` 再调用同一个函数只查询，不 POST。只有 submissionId 时，传同一编号和原请求参数，函数先查询已接收的任务，并核对请求哈希；任务确实不存在时才提交。不要因报错生成新的编号自动重试。轮询 GET 可自动恢复临时网络故障，付费生成 POST 不自动重放。

需要支持 Web Crypto 的运行环境；建议使用仍受支持的 Node.js 版本。若客户自己的外层 HTTP 网关也有限时，应在客户前端/任务系统保存编号并分次查询，而不是把整个轮询过程包在另一个长同步 HTTP 请求中。

提交和状态查询的单次超时为 30 秒；结果下载（包括完整响应体读取）默认 180 秒，可通过 `resultTimeoutMs` 配置。结果下载遇到超时、断流、损坏的 JSON 或成功任务的临时服务端错误时，只重试同一任务的 `GET /result`，最多额外 2 次，默认分别等待 1 秒、2 秒（可通过 `resultRetryDelayMs` 设置固定间隔）。用户取消、权限错误、任务过期及已保存的上游失败不会自动重试生成。`maxWaitMs` 控制轮询等待，结果下载使用独立超时。

超时错误码为 `REQUEST_TIMEOUT`，底层异常保留在 `error.cause`，响应头中的请求编号保留在 `error.requestId`，任务编号仍在 `error.taskId`。排查时记录这些编号、错误码和底层异常的名称／代码，避免记录 Key、完整请求或图片 Base64。更新时需将两个 `.mjs` 文件一同替换到客户实际运行的程序并重新加载；仅更新中转站不会更新客户程序。

## HTTP 接口

所有接口使用同一 API Key。任务只能由创建它的同一用户、同一 Key 查询；禁用或删除 Key 后不再授权读取。已耗尽或过期但未禁用的 Key 可取回已有结果；仍检查用户状态和 Key 的 IP 限制。

- `POST /v1/images/tasks`：`Content-Type: application/json`、`Idempotency-Key: UUID`，body 与普通 JSON 生图参数相同，`stream` 必须为 false。立即返回 202 和任务元数据。
- `GET /v1/images/tasks/:id`：状态 `queued / running / succeeded / failed / unknown / expired`。
- `GET /v1/images/tasks/by-submission/:submission`：用于提交回应丢失时找回任务。返回 request_hash，可校验是否仍是同一请求。
- `GET /v1/images/tasks/:id/result`：未完成返回 202；完成后返回原图片 JSON 或保存的错误 JSON，保留实际 HTTP 状态码。结果未知返回 409，过期返回 410。查询不会重新生成或重新扣费。

支持 JSON 图片生成和带参考图的 JSON 图生图任务，暂不提供 multipart 任务上传。最多 32 MiB 输入、每任务 1–20 张；API 任务不另设单用户并发、全局绘图池并发或待处理任务/图片数上限；已受理且未过期的任务会持续派发，上游限流仍作为实际错误返回，不自动重复生图。实际吞吐由上游、网络及服务器资源共同决定，不代表已验证可承载 800 并发。最大后台执行时间 20 分钟，结果保留 24 小时，提交编号保留共 7 天防止重复。结果文件使用约 49 MiB 的写入上限，过大或写入中断会标记结果未知，不能自动重新生成。

## 图生图与按请求适配

客户统一传参考图 URL 数组：

```js
const body = {
  model: 'gpt-image-2',
  prompt: '保留参考商品外观，生成竖版商品展示图',
  images: ['https://客户可公开访问的图片地址/reference.jpg'],
  size: '960x1280',
  quality: 'low', // 每次请求自己选；其他客户可传 high，不全站写死。
  n: 1,
};
```

继续使用 `requestImageTask`，不能改回直接等待最终结果的同步 fetch。函数可接受 `/v1/images/edits` 作为 endpoint 参数，实际仍通过任务接口提交和查询。后台检测到非空 images 后调用 `/v1/images/edits`；没有参考图时调用 `/v1/images/generations`。

普通 HTTPS 图片 URL 应能被上游直接读取，不依赖客户浏览器 Cookie。服务端也接受 `[{image_url: '...'}]` 形式。新版客户端把引用归一为 URL 数组；兼容的 Blob/File 会先转换为 data URL，不会序列化成空对象。GoEasy 文档明确的是 URL 数组，优先使用 HTTPS URL；data URL 能否被实际供应商接受仍以供应商为准。序列化后整个请求受 32 MiB 限制。

当前 OpenAI 类型渠道自动识别 GoEasy 官方域名（goeasyapi.xyz 及其子域名）并发送字符串数组；CPA/其他 OpenAI 兼容 JSON 编辑路径使用 image_url 对象数组。通道启用“原样透传”时会绕过适配；当前 GoEasy/CPA 通道未启用该选项。对新供应商或自定义 GoEasy 代理域名，应先核对其协议，不能假定完全通用。

`size` 和 `quality` 原样发给上游。**不把 960x1280 偷换成 1024x1365，不默认裁剪、拉伸或转码。** 新版不包含此前暂停的裁剪草稿。

返回 `size`/宽高/格式始终描述真实图片，Base64 图片内容保留。显式请求尺寸时增加：

- `requested_size`：请求尺寸。
- `data[i].size_matches_request`：是否精确匹配宽高；无法识别时为 null。
- `data[i].aspect_ratio_matches_request`：比例是否接近请求，允许 0.5% 的像素舍入误差；无法识别时为 null。
- `output_warnings`：可能包含 image_size_mismatch、image_aspect_ratio_mismatch 或 image_dimensions_unverified。

显式请求 quality 时增加 requested_quality 和 quality_report_matches_request；该匹配仅比较上游返回的质量声明，**不代表已经测量或证明画质**。上游未报告质量时为 null，不伪装成请求值；报告不同值时添加 image_quality_report_mismatch。

这些是附加提示，成功图片仍可使用，不会因尺寸/比例/质量声明不符而自动再生成或重复扣费。客户可将 output_warnings 展示在自己的界面。历史任务保持原结果；改变参数或增加参考图应创建新业务任务，不能复用旧任务编号要求重新生成。

## 计费与故障行为

后台仍走既有 API Key 鉴权、分组/模型限制、渠道选择、生成和计费。API Key 在执行时再次检查，没有在任务文件中保存 Key。任务提交时锁定代理图片价格，排队期间改价不影响该任务。

后台不继承提交 HTTP 请求的生命周期，客户端离线不取消已经排队的任务。队列在数据库中持久化，重启后未执行的任务可以继续；运行中断的任务不会自动重新生成，超过恢复窗口后标记 unknown，需核对用量。这个机制保证避免盲目重放，不声称在任意进程崩溃点都能实现上游和本地账本的分布式 exactly-once。

新增 SQL 表 `api_image_tasks`，请求与结果放在 `DRAWING_STORAGE_DIR/api-tasks` 私有目录，后台清理过期文件。回滚旧二进制不会自动删除新表或已存任务；有运行任务时不应直接回滚。

## 验证范围

回归测试覆盖立即受理、生成前不计费、同编号不重复生成、编号参数冲突、价格锁定、原 Base64/size/usage 保留、重复读取只扣一次、同用户不同 Key/不同用户隔离、额度耗尽后取结果、进程中断不重新调度、流式请求拒绝。客户端测试覆盖轮询、恢复、提交失败保留编号和只重试 GET。

任何上游拒绝、余额不足、网络全断等仍会产生明确失败；本功能解决的是慢生成超过入口同步等待时限。

## 已发布与实际链路验收

2026-09-08 经受限部署账号发布 `hardy-image-tasks-20260908-184008`，功能提交 `04ab30b2`。运行镜像 `sha256:1eeb2014db3bb0e7398f6a5ed33115b6fc5e7f3751942097761222ded72fce45`，二进制 SHA256 `133fb270bab7f26b5b85b1bc3b7004b6868a7f680dee08ac5b617513d921abe1`。公网状态返回该版本、应用 healthy、重启计数 0；任务路由未认证请求返回 401 JSON。

使用同一最终镜像、隔离生产数据库副本和等待 150 秒的模拟上游，经受限临时 Cloudflare Quick Tunnel 验收（非生产域名，不使用真实收费模型）：

| 场景 | 实测结果 |
| --- | --- |
| 原同步生图 | 126.553 秒，HTTP 524，HTML 错误页 |
| 新任务提交 | 2.202 秒受理并取得任务编号 |
| 后台任务结果 | 154.399 秒成功，完整 Base64、实测 3x4、usage 保留 |
| 恢复读取同一任务 | 返回相同结果；模拟上游该任务只调用 1 次 |
| 模拟上游 500 | 错误结果保留，不重试生成，该任务只调用 1 次 |

隔离账本：成功任务 1 条消费、quota=10000（2 分）；失败任务 1 条 quota=0 错误记录。原始请求和结果未复制到公开验收页面，临时入口只接受测试 Key 和指定路径。验证未重新配置生产网络或修改生产 Tunnel。

发布前数据库恢复点及镜像配置位于 `/var/lib/hardy-task-check-184008/`（root 私有），其中 `production-before-activate.dump` 是紧邻发布的数据库备份。回滚镜像为前一版 `sha256:ebbe10b60ba984cb1aaa9d28769dfa6fa94832b75806b77bb596d19c690d7509`；回滚前必须处理运行中的新任务。

## 2026-09-09：取消额外并发和待处理限额

按用户要求移除 API 任务层的单用户 2 并发、沿用绘图池的全局并发限制，以及每用户 10 个待处理任务/20 张待处理图片的限制。调度器持续领取待执行任务，保留原子领取、幂等校验和禁止自动重放生成的机制。单次请求的输入大小/张数、鉴权和任务保留期不属于此次并发调整。

发布版本 `hardy-image-tasks-20260909-120441`，功能提交 `c8199f65`；运行镜像 `sha256:97189230501047dccd7ace673d12201f117cd3e854e47efdfa53387942bcd667`，二进制 SHA256 `d3a284913d2a84f4922c57cff8cdfd624bf5bbc195f49ec399eb16b25a5b036f`。公网版本已核实，容器 healthy、重启计数 0。

回归用例先复现旧版第 11 个待处理任务被拒绝，再验证新版同用户 21 个任务都可领取且不重复领取。最终发布镜像在隔离 PostgreSQL 副本中验收：同一用户 21 个请求同时进入模拟上游（实测峰值 21），21 个结果均返回 Base64 和实测尺寸；21 条消费记录，每任务仅收费一次，重复提交不再次生成。未调用收费上游，未进行 800 并发容量压测。

公开搜索、现有配置及 GoEasy 公开状态接口没有提供可确认的“此账号/模型允许 800 并发”信息。本次移除额外限制，不把 800 写成已确认额度或实际承载承诺。已使用任务接口的客户无需更改接入代码。

发布前恢复点和隔离验收报告：`/var/lib/hardy-task-check-120441/`。原版本回滚镜像为 `sha256:1eeb2014db3bb0e7398f6a5ed33115b6fc5e7f3751942097761222ded72fce45`。

## 2026-09-09：后台图生图与参考图适配发布

版本 `hardy-image-tasks-20260909-142342`，功能提交 `8c794c00`。运行镜像 `sha256:309025ea1defd1c492a1f3cd27ff84cd314e2daaef21d7e97fcd244ac80911e8`，二进制 SHA256 `b3ce582c1339aefec9e79fa61a544544f05e4e88d30b844630bae9c62d465f1d`。公网版本、容器 healthy 和重启计数 0 已核实。

最终镜像在隔离 PostgreSQL 副本与模拟上游验证：GoEasy 主机名场景收到 URL 字符串数组和 low，CPA 主机名场景收到 image_url 对象数组和 high，两者均走 /v1/images/edits，均原样收到 size=960x1280。模拟上游故意返回 120x120 PNG/quality=low，结果图片字节与上游文件逐字节相同，报告尺寸/比例不符；high 请求还报告上游质量声明不符。两个任务均只有一条消费记录；重复提交未再生成。没有调用实际收费模型，因此未宣称已验证供应商的原生尺寸/画质效果。

相关 Go 回归测试及 14 项客户端示例测试通过。先前暂停的裁剪/转码草稿已移除，其旧隔离环境已清理，本版不包含该处理。旧后台任务不重放，历史结果保持原样。

发布前数据库备份与验收报告保留在 `/var/lib/hardy-task-check-142342/`（root 私有）；前一镜像为 `sha256:97189230501047dccd7ace673d12201f117cd3e854e47efdfa53387942bcd667`。本次没有修改主网卡、生产 Tunnel、余额或价格配置。


## 2026-09-15：生图额外校验与错误处理对齐

对照官方 QuantumNous/new-api main `69a50029819a26c53e6babd276d49cfe2f8880ad`，删除本地图片 content_policy_violation 文案替换、日志展示替换及 original_error 额外字段。官方的错误敏感信息遮蔽、敏感词开关、数量上限和鉴权计费保持原行为，并非删除官方保护。

参考图保留既有供应商结构适配，但不再校验 URL 协议/域名，不提前拦截未知参考图结构；无法适配时原样交给上游。后台任务取消额外的 20 张上限，复用官方图片请求数量校验。未新增参考图下载、内容审核或请求摘要诊断。模型及提示词行为不变。

后台任务的 JSON/非流式协议、存储大小边界，以及 GPU 扩展的运行条件仍是对应功能的契约，没有把本站扩展伪称为官方完全相同的实现。已于 2026-09-15 发布，版本 hardy-relay-align-20260915。
