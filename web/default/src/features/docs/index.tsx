import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'

const ENDPOINT_BASE =
  typeof window !== 'undefined' ? window.location.origin : 'https://your.aikanhub.com'

// ------------------------------------------------------------------
// Code samples
// ------------------------------------------------------------------

const CURL_SUBMIT = `curl -X POST ${ENDPOINT_BASE}/v1/video/generations \\
  -H "Authorization: Bearer $AIKANHUB_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "doubao-seedance-2-0-fast-260128",
    "prompt": "一只橘猫慢慢走过夕阳下的东京街道，4K，电影感",
    "size": "720p",
    "duration": 5,
    "metadata": { "ratio": "16:9" }
  }'`

const CURL_POLL = `curl ${ENDPOINT_BASE}/v1/video/generations/$TASK_ID \\
  -H "Authorization: Bearer $AIKANHUB_TOKEN"`

const CURL_DOWNLOAD = `curl -o video.mp4 ${ENDPOINT_BASE}/v1/videos/$TASK_ID/content \\
  -H "Authorization: Bearer $AIKANHUB_TOKEN"`

const PYTHON_FULL = `"""完整端到端示例：提交 → 轮询 → 下载视频"""
import os, time, requests
from pathlib import Path

BASE  = "${ENDPOINT_BASE}"
TOKEN = os.environ["AIKANHUB_TOKEN"]
H     = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def submit_video_task(prompt: str, *, model="doubao-seedance-2-0-fast-260128",
                      size="720p", duration=5, ratio="16:9") -> str:
    r = requests.post(f"{BASE}/v1/video/generations", headers=H, json={
        "model": model,
        "prompt": prompt,
        "size": size,
        "duration": duration,
        "metadata": {"ratio": ratio},
    })
    r.raise_for_status()
    body = r.json()
    return body["task_id"]


def wait_for_video(task_id: str, *, interval=5, timeout=600) -> str:
    """轮询直到完成；返回任务最终响应（含 video_url）。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(interval)
        r = requests.get(f"{BASE}/v1/video/generations/{task_id}", headers=H)
        r.raise_for_status()
        body = r.json()
        status = body.get("status") or body.get("data", {}).get("status")
        progress = body.get("data", {}).get("progress", "")
        print(f"  [{task_id[:12]}] status={status} progress={progress}")
        if status in ("succeeded", "SUCCESS"):
            return body["data"]["data"]["content"]["video_url"]
        if status in ("failed", "FAILED"):
            reason = body.get("data", {}).get("fail_reason", "unknown")
            raise RuntimeError(f"task failed: {reason}")
    raise TimeoutError(f"task {task_id} did not complete within {timeout}s")


def download_video(task_id: str, out_path: str) -> None:
    """通过 aikanhub 代理下载（24h 内有效）。"""
    r = requests.get(f"{BASE}/v1/videos/{task_id}/content",
                     headers={"Authorization": f"Bearer {TOKEN}"}, stream=True)
    r.raise_for_status()
    Path(out_path).write_bytes(r.content)


if __name__ == "__main__":
    task_id = submit_video_task("一只橘猫慢慢走过夕阳下的东京街道，4K，电影感")
    print(f"submitted: {task_id}")
    video_url = wait_for_video(task_id)
    print(f"video URL: {video_url}")
    download_video(task_id, "out.mp4")
    print("saved to out.mp4")`

const NODE_FULL = `// 完整端到端示例：提交 → 轮询 → 下载视频
import { writeFile } from "node:fs/promises";

const BASE  = "${ENDPOINT_BASE}";
const TOKEN = process.env.AIKANHUB_TOKEN;
const H     = { Authorization: \`Bearer \${TOKEN}\`, "Content-Type": "application/json" };

async function submitVideoTask(prompt, opts = {}) {
  const r = await fetch(\`\${BASE}/v1/video/generations\`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      model:    opts.model    ?? "doubao-seedance-2-0-fast-260128",
      prompt,
      size:     opts.size     ?? "720p",
      duration: opts.duration ?? 5,
      metadata: { ratio: opts.ratio ?? "16:9" },
    }),
  });
  if (!r.ok) throw new Error(\`submit failed: \${r.status} \${await r.text()}\`);
  const body = await r.json();
  return body.task_id;
}

async function waitForVideo(taskId, { interval = 5000, timeout = 600_000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const r = await fetch(\`\${BASE}/v1/video/generations/\${taskId}\`, { headers: H });
    const body = await r.json();
    const status = body.status ?? body.data?.status;
    console.log(\`  [\${taskId.slice(0, 12)}] status=\${status}\`);
    if (status === "succeeded" || status === "SUCCESS")
      return body.data.data.content.video_url;
    if (status === "failed" || status === "FAILED")
      throw new Error(\`task failed: \${body.data?.fail_reason ?? "unknown"}\`);
  }
  throw new Error(\`timeout after \${timeout}ms\`);
}

async function downloadVideo(taskId, outPath) {
  const r = await fetch(\`\${BASE}/v1/videos/\${taskId}/content\`, {
    headers: { Authorization: \`Bearer \${TOKEN}\` },
  });
  if (!r.ok) throw new Error(\`download failed: \${r.status}\`);
  await writeFile(outPath, Buffer.from(await r.arrayBuffer()));
}

const taskId = await submitVideoTask("一只橘猫慢慢走过夕阳下的东京街道，4K，电影感");
console.log("submitted:", taskId);
const videoUrl = await waitForVideo(taskId);
console.log("video URL:", videoUrl);
await downloadVideo(taskId, "out.mp4");
console.log("saved to out.mp4");`

// ------------------------------------------------------------------
// Reusable bits
// ------------------------------------------------------------------

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className='relative'>
      <div className='bg-muted text-muted-foreground border-b px-4 py-2 text-xs font-medium uppercase tracking-wider'>
        {lang}
      </div>
      <pre className='bg-card overflow-x-auto p-4 text-sm leading-relaxed'>
        <code>{code}</code>
      </pre>
      <div className='absolute right-2 top-10'>
        <CopyButton value={code} variant='ghost' size='sm' />
      </div>
    </div>
  )
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className='scroll-mt-20 space-y-4'>
      <div className='space-y-1'>
        <h2 className='text-2xl font-semibold tracking-tight'>{title}</h2>
        {description && (
          <p className='text-muted-foreground text-sm'>{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function EndpointCard({
  method,
  path,
  description,
}: {
  method: 'GET' | 'POST'
  path: string
  description: string
}) {
  const methodColor =
    method === 'POST'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
      : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  return (
    <div className='border bg-card flex items-start gap-3 rounded-md p-3'>
      <span
        className={`shrink-0 rounded px-2 py-0.5 text-xs font-mono font-semibold ${methodColor}`}
      >
        {method}
      </span>
      <div className='space-y-1'>
        <code className='text-sm font-mono'>{path}</code>
        <p className='text-muted-foreground text-xs'>{description}</p>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Reusable param table builder
// ------------------------------------------------------------------

interface Param {
  name: string
  type: string
  required?: boolean
  desc: React.ReactNode
}

function ParamTable({ params }: { params: Param[] }) {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <table className='w-full text-sm'>
        <thead className='bg-muted'>
          <tr className='text-left'>
            <th className='px-4 py-2 font-medium w-44'>字段</th>
            <th className='px-4 py-2 font-medium w-28'>类型</th>
            <th className='px-4 py-2 font-medium w-20'>必填</th>
            <th className='px-4 py-2 font-medium'>说明</th>
          </tr>
        </thead>
        <tbody className='divide-y'>
          {params.map((p) => (
            <tr key={p.name}>
              <td className='px-4 py-2 font-mono text-xs'>{p.name}</td>
              <td className='px-4 py-2 text-xs'>{p.type}</td>
              <td className='px-4 py-2 text-xs'>
                {p.required ? (
                  <span className='font-medium text-red-600 dark:text-red-400'>是</span>
                ) : (
                  <span className='text-muted-foreground'>否</span>
                )}
              </td>
              <td className='px-4 py-2 text-xs'>{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

const TOC: Array<{ id: string; label: string }> = [
  { id: 'overview', label: '概述' },
  { id: 'quick-start', label: '快速开始' },
  { id: 'endpoints', label: 'API 端点一览' },
  { id: 'submit', label: '提交任务' },
  { id: 'poll', label: '查询状态' },
  { id: 'download', label: '下载视频' },
  { id: 'full-example', label: '完整示例' },
  { id: 'models', label: '支持的模型' },
  { id: 'pricing', label: '定价' },
  { id: 'limits', label: '限流与配额' },
  { id: 'errors', label: '错误码' },
  { id: 'best-practices', label: '最佳实践' },
  { id: 'faq', label: '常见问题' },
]

export function Docs() {
  return (
    <PublicLayout>
      <div className='mx-auto max-w-5xl px-6 py-10'>
        <header className='space-y-3 border-b pb-8'>
          <h1 className='text-3xl font-semibold tracking-tight'>API 文档</h1>
          <p className='text-muted-foreground'>
            AIKanHub 视频生成 API 参考 · OpenAI 风格异步任务接口
          </p>
        </header>

        <div className='grid gap-12 py-10 lg:grid-cols-[1fr_180px]'>
          {/* Main content */}
          <article className='space-y-14 min-w-0'>
            <Section
              id='overview'
              title='概述'
              description='一句话：用一个 sk- key 调通 Seedance、Pixverse 等主流视频生成模型。'
            >
              <p className='text-sm leading-relaxed'>
                AIKanHub 是一个统一的视频生成 API 网关。所有支持的模型都通过同一套接口调用——
                只需一个 token，无需在每个上游平台分别注册、维护多套 SDK 或对账多个账单。
              </p>
              <ul className='text-muted-foreground list-disc space-y-1 pl-6 text-sm'>
                <li>异步任务模型：提交后拿 <code className='bg-muted rounded px-1'>task_id</code>，轮询直到完成</li>
                <li>OpenAI 风格的鉴权（<code className='bg-muted rounded px-1'>Authorization: Bearer sk-...</code>）</li>
                <li>视频通过我们代理流式返回，避免暴露上游签名 URL</li>
                <li>统一计费，按视频条数扣费（详见<a href='#pricing' className='text-primary hover:underline'>定价</a>）</li>
              </ul>
            </Section>

            <Section id='quick-start' title='快速开始' description='三步跑通第一个视频生成请求。'>
              <ol className='space-y-6'>
                <li className='space-y-2'>
                  <h3 className='font-medium'>1. 创建 API 密钥</h3>
                  <p className='text-muted-foreground text-sm'>
                    登录后进入 <a href='/keys' className='text-primary hover:underline'>令牌</a> 页面，点击「创建 API 密钥」，复制以 <code className='bg-muted rounded px-1'>sk-</code> 开头的字符串。
                  </p>
                </li>
                <li className='space-y-2'>
                  <h3 className='font-medium'>2. 设置环境变量</h3>
                  <CodeBlock
                    lang='shell'
                    code={`export AIKANHUB_TOKEN=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
                  />
                </li>
                <li className='space-y-2'>
                  <h3 className='font-medium'>3. 提交一个文生视频任务</h3>
                  <CodeBlock lang='shell' code={CURL_SUBMIT} />
                  <p className='text-muted-foreground text-xs'>
                    成功响应包含 <code className='bg-muted rounded px-1'>task_id</code>，下一步用它查询进度。完整代码见<a href='#full-example' className='text-primary hover:underline'>下方完整示例</a>。
                  </p>
                </li>
              </ol>
            </Section>

            <Section id='endpoints' title='API 端点一览'>
              <div className='space-y-2'>
                <EndpointCard method='POST' path='/v1/video/generations' description='提交视频生成任务，返回 task_id' />
                <EndpointCard method='GET' path='/v1/video/generations/:task_id' description='查询任务状态、进度与最终视频 URL' />
                <EndpointCard method='GET' path='/v1/videos/:task_id/content' description='代理下载/预览视频文件（24 小时内有效）' />
              </div>
              <p className='text-muted-foreground text-xs'>
                所有端点均要求 <code className='bg-muted rounded px-1'>Authorization: Bearer $AIKANHUB_TOKEN</code> header。
              </p>
            </Section>

            <Section
              id='submit'
              title='提交任务'
              description='POST /v1/video/generations · 异步：返回 task_id 后自行轮询'
            >
              <h3 className='text-base font-medium'>请求参数</h3>
              <ParamTable
                params={[
                  { name: 'model', type: 'string', required: true, desc: <>模型 ID，见<a href='#models' className='text-primary hover:underline'>支持的模型</a></> },
                  { name: 'prompt', type: 'string', required: true, desc: '文本提示词。中文 ≤500 字 / 英文 ≤1000 词' },
                  { name: 'size', type: 'string', desc: <><code className='bg-muted rounded px-1'>480p</code> · <code className='bg-muted rounded px-1'>720p</code> · <code className='bg-muted rounded px-1'>1080p</code>（默认 720p）</> },
                  { name: 'duration', type: 'int', desc: '输出时长（秒）。Seedance 2.0 支持 4–15s（默认 5）' },
                  { name: 'images', type: 'string[]', desc: '图生视频时的参考图 URL 列表（公网可访问，1–9 张）' },
                  { name: 'metadata.ratio', type: 'string', desc: <>宽高比：<code className='bg-muted rounded px-1'>16:9</code> · <code className='bg-muted rounded px-1'>9:16</code> · <code className='bg-muted rounded px-1'>1:1</code> · <code className='bg-muted rounded px-1'>4:3</code> · <code className='bg-muted rounded px-1'>3:4</code> · <code className='bg-muted rounded px-1'>21:9</code></> },
                  { name: 'metadata.generate_audio', type: 'boolean', desc: '是否生成音轨（仅 Seedance 2.0 支持）' },
                  { name: 'metadata.seed', type: 'int', desc: '随机种子，相同 seed + 参数会得到相似输出' },
                ]}
              />
              <h3 className='pt-2 text-base font-medium'>请求示例</h3>
              <CodeBlock lang='shell' code={CURL_SUBMIT} />
              <h3 className='pt-2 text-base font-medium'>响应字段</h3>
              <ParamTable
                params={[
                  { name: 'task_id', type: 'string', desc: '任务 ID。形如 task_xxxx，用于后续查询' },
                  { name: 'status', type: 'string', desc: <>初始状态，通常为 <code className='bg-muted rounded px-1'>queued</code></> },
                  { name: 'created_at', type: 'int', desc: 'Unix 时间戳（秒）' },
                ]}
              />
            </Section>

            <Section
              id='poll'
              title='查询状态'
              description='GET /v1/video/generations/:task_id · 建议轮询间隔 5 秒'
            >
              <h3 className='text-base font-medium'>请求示例</h3>
              <CodeBlock lang='shell' code={CURL_POLL} />
              <h3 className='pt-2 text-base font-medium'>状态值</h3>
              <div className='overflow-hidden rounded-lg border'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted'>
                    <tr className='text-left'>
                      <th className='px-4 py-2 font-medium'>status</th>
                      <th className='px-4 py-2 font-medium'>含义</th>
                      <th className='px-4 py-2 font-medium'>是否终态</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y text-xs'>
                    <tr><td className='px-4 py-2 font-mono'>queued / NOT_START</td><td className='px-4 py-2'>排队中</td><td className='px-4 py-2 text-muted-foreground'>否</td></tr>
                    <tr><td className='px-4 py-2 font-mono'>IN_PROGRESS / processing</td><td className='px-4 py-2'>生成中</td><td className='px-4 py-2 text-muted-foreground'>否</td></tr>
                    <tr><td className='px-4 py-2 font-mono'>SUCCESS / succeeded</td><td className='px-4 py-2'>完成；<code className='bg-muted rounded px-1'>data.data.content.video_url</code> 中是视频地址</td><td className='px-4 py-2'>✅</td></tr>
                    <tr><td className='px-4 py-2 font-mono'>FAILED / failed</td><td className='px-4 py-2'>失败；<code className='bg-muted rounded px-1'>fail_reason</code> 含原因</td><td className='px-4 py-2'>✅</td></tr>
                  </tbody>
                </table>
              </div>
              <p className='text-muted-foreground text-xs'>
                720p / 5s 任务通常 90–120 秒完成。请勿低于 5 秒间隔轮询，否则可能触发限流。
              </p>
            </Section>

            <Section
              id='download'
              title='下载视频'
              description='GET /v1/videos/:task_id/content · 代理下载，避免暴露上游签名 URL'
            >
              <CodeBlock lang='shell' code={CURL_DOWNLOAD} />
              <p className='text-muted-foreground text-sm'>
                这个端点会从上游对象存储拉取视频流，加上鉴权后返回给你。响应 <code className='bg-muted rounded px-1'>Content-Type: video/mp4</code>，可以直接 <code className='bg-muted rounded px-1'>{'<video src=...>'}</code> 嵌入网页。
              </p>
              <p className='text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 rounded-md p-3 text-xs'>
                ⚠️ <strong>视频有效期 24 小时</strong>。生成成功后请尽快下载或转存到自己的对象存储；过期后该端点会返回 502。长期保留计划见后续版本。
              </p>
            </Section>

            <Section
              id='full-example'
              title='完整示例'
              description='提交 → 轮询 → 下载，开箱即用，含错误处理。'
            >
              <Tabs defaultValue='python' className='border rounded-lg overflow-hidden'>
                <TabsList className='bg-muted h-10 w-full justify-start rounded-none border-b px-2'>
                  <TabsTrigger value='python'>Python</TabsTrigger>
                  <TabsTrigger value='node'>Node.js</TabsTrigger>
                </TabsList>
                <TabsContent value='python' className='m-0'>
                  <CodeBlock lang='python' code={PYTHON_FULL} />
                </TabsContent>
                <TabsContent value='node' className='m-0'>
                  <CodeBlock lang='javascript' code={NODE_FULL} />
                </TabsContent>
              </Tabs>
            </Section>

            <Section id='models' title='支持的模型'>
              <div className='overflow-hidden rounded-lg border'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted'>
                    <tr className='text-left'>
                      <th className='px-4 py-2 font-medium'>Model ID</th>
                      <th className='px-4 py-2 font-medium'>说明</th>
                      <th className='px-4 py-2 font-medium'>能力</th>
                      <th className='px-4 py-2 font-medium'>状态</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y text-xs'>
                    <tr>
                      <td className='px-4 py-2 font-mono'>doubao-seedance-2-0-260128</td>
                      <td className='px-4 py-2'>Seedance 2.0 · 最高品质</td>
                      <td className='px-4 py-2'>文生视频 / 图生视频 / 首尾帧 / 多模态参考 / 有声视频</td>
                      <td className='px-4 py-2'>✅ 可用</td>
                    </tr>
                    <tr>
                      <td className='px-4 py-2 font-mono'>doubao-seedance-2-0-fast-260128</td>
                      <td className='px-4 py-2'>Seedance 2.0 fast · 速度优先</td>
                      <td className='px-4 py-2'>同上（不支持 1080p）</td>
                      <td className='px-4 py-2'>✅ 可用</td>
                    </tr>
                    <tr>
                      <td className='px-4 py-2 font-mono'>pixverse-v5.5</td>
                      <td className='px-4 py-2'>Pixverse v5.5</td>
                      <td className='px-4 py-2 text-muted-foreground'>—</td>
                      <td className='px-4 py-2 text-muted-foreground'>🚧 规划中</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id='pricing' title='定价' description='按视频条数扣费，币种 USD。'>
              <div className='overflow-hidden rounded-lg border'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted'>
                    <tr className='text-left'>
                      <th className='px-4 py-2 font-medium'>模型</th>
                      <th className='px-4 py-2 font-medium'>规格</th>
                      <th className='px-4 py-2 font-medium'>单价</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y text-xs'>
                    <tr><td className='px-4 py-2 font-mono'>doubao-seedance-2-0-260128</td><td className='px-4 py-2'>720p / 5s</td><td className='px-4 py-2'>$0.885 / video</td></tr>
                    <tr><td className='px-4 py-2 font-mono'>doubao-seedance-2-0-fast-260128</td><td className='px-4 py-2'>720p / 5s</td><td className='px-4 py-2'>$0.712 / video</td></tr>
                  </tbody>
                </table>
              </div>
              <p className='text-muted-foreground text-xs'>
                当前为统一定价（基准：720p / 5s / 不含视频输入）。按 resolution / duration / 视频输入维度的精确计费正在开发中。失败任务不计费。
              </p>
            </Section>

            <Section id='limits' title='限流与配额'>
              <ParamTable
                params={[
                  { name: 'RPM', type: '600', desc: '每分钟提交请求数。超出会返回 429。' },
                  { name: '并发任务数', type: '10', desc: '同时进行中的视频生成任务上限。超出会被排队。' },
                  { name: '单任务超时', type: '5 分钟', desc: '通常 90–120 秒完成。超过 5 分钟自动标记 FAILED。' },
                  { name: '账户额度', type: '$', desc: <>每次成功扣减；额度耗尽会返回 403。可在 <a href='/wallet' className='text-primary hover:underline'>钱包</a> 充值。</> },
                ]}
              />
            </Section>

            <Section id='errors' title='错误码'>
              <div className='overflow-hidden rounded-lg border'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted'>
                    <tr className='text-left'>
                      <th className='px-4 py-2 font-medium'>HTTP</th>
                      <th className='px-4 py-2 font-medium'>含义</th>
                      <th className='px-4 py-2 font-medium'>处理</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y text-xs'>
                    <tr><td className='px-4 py-2 font-mono'>400</td><td className='px-4 py-2'>请求参数错误</td><td className='px-4 py-2'>检查 model/prompt 字段；查看 message 详情</td></tr>
                    <tr><td className='px-4 py-2 font-mono'>401</td><td className='px-4 py-2'>未鉴权</td><td className='px-4 py-2'>检查 Authorization header 格式</td></tr>
                    <tr><td className='px-4 py-2 font-mono'>403</td><td className='px-4 py-2'>额度不足或模型未授权</td><td className='px-4 py-2'>充值或检查 token 的模型范围限制</td></tr>
                    <tr><td className='px-4 py-2 font-mono'>404</td><td className='px-4 py-2'>task_id 不存在或不属于你</td><td className='px-4 py-2'>检查 ID 拼写</td></tr>
                    <tr><td className='px-4 py-2 font-mono'>429</td><td className='px-4 py-2'>触发限流</td><td className='px-4 py-2'>降低 RPM 或减少并发；响应 header 含 Retry-After</td></tr>
                    <tr><td className='px-4 py-2 font-mono'>502</td><td className='px-4 py-2'>视频代理失败（通常是上游 URL 已过期）</td><td className='px-4 py-2'>24h 内重新调用，或转存视频到自己的存储</td></tr>
                    <tr><td className='px-4 py-2 font-mono'>500</td><td className='px-4 py-2'>服务器错误</td><td className='px-4 py-2'>稍后重试；若持续，联系支持</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id='best-practices' title='最佳实践'>
              <ul className='space-y-3 text-sm leading-relaxed'>
                <li>
                  <strong className='font-medium'>轮询策略</strong>：固定 5 秒间隔即可。短于 5 秒会触发限流，但也无法换来更快的结果——任务在上游侧的处理时间是固定的。建议加上指数退避：失败时倍增间隔到最多 30 秒。
                </li>
                <li>
                  <strong className='font-medium'>立即下载视频</strong>：成功后第一时间 GET <code className='bg-muted rounded px-1'>/v1/videos/:task_id/content</code> 并保存到自己的对象存储或 CDN，不要依赖 24 小时窗口。
                </li>
                <li>
                  <strong className='font-medium'>并发控制</strong>：当前并发上限 10。批量任务建议自己用 semaphore 限流，比无脑提交后撞 429 更友好。
                </li>
                <li>
                  <strong className='font-medium'>Prompt 工程</strong>：中文不超过 500 字，包含主体 / 动作 / 镜头 / 风格 4 要素效果最好。过长的 prompt 反而会让模型忽略细节。
                </li>
                <li>
                  <strong className='font-medium'>失败重试</strong>：FAILED 任务不会计费。建议判断 <code className='bg-muted rounded px-1'>fail_reason</code>：如果是内容审核类，重试也没用；其他原因可以最多重试 2 次。
                </li>
              </ul>
            </Section>

            <Section id='faq' title='常见问题'>
              <div className='space-y-5'>
                <div className='space-y-1'>
                  <h3 className='font-medium text-sm'>视频生成需要多久？</h3>
                  <p className='text-muted-foreground text-sm'>
                    720p / 5s 通常 90–120 秒。1080p 或更长视频会更慢。同一时间多个任务在排队也会影响。
                  </p>
                </div>
                <div className='space-y-1'>
                  <h3 className='font-medium text-sm'>能用 OpenAI SDK 调用吗？</h3>
                  <p className='text-muted-foreground text-sm'>
                    视频任务是异步任务模型，不是 OpenAI 的 chat/completion 端点。SDK 调用对应的 <code className='bg-muted rounded px-1'>video.generate</code> 接口暂不兼容。请直接用 HTTP 请求或我们的官方 SDK（规划中）。
                  </p>
                </div>
                <div className='space-y-1'>
                  <h3 className='font-medium text-sm'>视频可以保存多久？</h3>
                  <p className='text-muted-foreground text-sm'>
                    通过 <code className='bg-muted rounded px-1'>/v1/videos/:task_id/content</code> 拉取的视频在 24 小时内可用。永久存储计划在后续版本中提供（迁移到我们自有的对象存储）。
                  </p>
                </div>
                <div className='space-y-1'>
                  <h3 className='font-medium text-sm'>如何查看消费？</h3>
                  <p className='text-muted-foreground text-sm'>
                    进入 <a href='/usage-logs/task' className='text-primary hover:underline'>任务日志</a> 查看每个任务的扣费；<a href='/wallet' className='text-primary hover:underline'>钱包</a> 页可看到余额变化。
                  </p>
                </div>
                <div className='space-y-1'>
                  <h3 className='font-medium text-sm'>失败的任务会扣费吗？</h3>
                  <p className='text-muted-foreground text-sm'>
                    不会。只有 SUCCESS 状态的任务会扣减额度。
                  </p>
                </div>
                <div className='space-y-1'>
                  <h3 className='font-medium text-sm'>支持 Webhook 回调吗？</h3>
                  <p className='text-muted-foreground text-sm'>
                    暂未提供。当前需要客户端轮询。Webhook 透传计划在后续版本。
                  </p>
                </div>
              </div>
            </Section>

            <div className='border-t pt-8 space-y-2 text-sm'>
              <h2 className='font-semibold'>相关资源</h2>
              <ul className='text-muted-foreground space-y-1'>
                <li>· <a href='/keys' className='text-primary hover:underline'>令牌管理</a> · 创建和管理 API key</li>
                <li>· <a href='/wallet' className='text-primary hover:underline'>钱包</a> · 查看余额与充值</li>
                <li>· <a href='/usage-logs/task' className='text-primary hover:underline'>任务日志</a> · 历史任务和扣费记录</li>
                <li>· <a href='https://github.com/NekoAIKan/aikanhub' target='_blank' rel='noreferrer noopener' className='text-primary hover:underline'>GitHub 仓库</a></li>
              </ul>
            </div>
          </article>

          {/* TOC sidebar */}
          <aside className='hidden lg:block'>
            <div className='sticky top-20 space-y-2'>
              <h3 className='text-muted-foreground text-xs font-medium uppercase tracking-wider'>
                目录
              </h3>
              <nav className='flex flex-col gap-1.5'>
                {TOC.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className='text-muted-foreground hover:text-foreground border-l-2 border-transparent pl-3 text-sm transition-colors hover:border-primary'
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </PublicLayout>
  )
}
