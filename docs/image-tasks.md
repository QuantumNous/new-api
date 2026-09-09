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

## HTTP 接口

所有接口使用同一 API Key。任务只能由创建它的同一用户、同一 Key 查询；禁用或删除 Key 后不再授权读取。已耗尽或过期但未禁用的 Key 可取回已有结果；仍检查用户状态和 Key 的 IP 限制。

- `POST /v1/images/tasks`：`Content-Type: application/json`、`Idempotency-Key: UUID`，body 与普通 JSON 生图参数相同，`stream` 必须为 false。立即返回 202 和任务元数据。
- `GET /v1/images/tasks/:id`：状态 `queued / running / succeeded / failed / unknown / expired`。
- `GET /v1/images/tasks/by-submission/:submission`：用于提交回应丢失时找回任务。返回 request_hash，可校验是否仍是同一请求。
- `GET /v1/images/tasks/:id/result`：未完成返回 202；完成后返回原图片 JSON 或保存的错误 JSON，保留实际 HTTP 状态码。结果未知返回 409，过期返回 410。查询不会重新生成或重新扣费。

仅支持 JSON 图片生成，暂不提供 multipart 编辑任务。最多 32 MiB 输入、每任务 1–20 张；API 任务不另设单用户并发、全局绘图池并发或待处理任务/图片数上限；已受理且未过期的任务会持续派发，上游限流仍作为实际错误返回，不自动重复生图。实际吞吐由上游、网络及服务器资源共同决定，不代表已验证可承载 800 并发。最大后台执行时间 20 分钟，结果保留 24 小时，提交编号保留共 7 天防止重复。结果文件使用约 49 MiB 的写入上限，过大或写入中断会标记结果未知，不能自动重新生成。

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
