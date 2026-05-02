import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'

const ENDPOINT_BASE =
  typeof window !== 'undefined' ? window.location.origin : 'https://your.aikanhub.com'

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

const PYTHON_EXAMPLE = `import os, time, requests

BASE = "${ENDPOINT_BASE}"
TOKEN = os.environ["AIKANHUB_TOKEN"]
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# 1. submit
r = requests.post(f"{BASE}/v1/video/generations", json={
    "model": "doubao-seedance-2-0-fast-260128",
    "prompt": "一只橘猫慢慢走过夕阳下的东京街道，4K，电影感",
    "size": "720p",
    "duration": 5,
    "metadata": {"ratio": "16:9"},
}, headers=H).json()
task_id = r["task_id"]

# 2. poll
while True:
    time.sleep(5)
    s = requests.get(f"{BASE}/v1/video/generations/{task_id}", headers=H).json()
    status = s.get("status") or s.get("data", {}).get("status")
    if status in ("succeeded", "SUCCESS"):
        print("video:", s["data"]["data"]["content"]["video_url"]); break
    if status in ("failed", "FAILED"):
        print("failed:", s); break`

const NODE_EXAMPLE = `const BASE = "${ENDPOINT_BASE}";
const TOKEN = process.env.AIKANHUB_TOKEN;
const H = { Authorization: \`Bearer \${TOKEN}\`, "Content-Type": "application/json" };

const r = await fetch(\`\${BASE}/v1/video/generations\`, {
  method: "POST", headers: H,
  body: JSON.stringify({
    model: "doubao-seedance-2-0-fast-260128",
    prompt: "一只橘猫慢慢走过夕阳下的东京街道，4K，电影感",
    size: "720p", duration: 5, metadata: { ratio: "16:9" },
  }),
}).then((r) => r.json());

while (true) {
  await new Promise((res) => setTimeout(res, 5000));
  const s = await fetch(\`\${BASE}/v1/video/generations/\${r.task_id}\`, { headers: H }).then((r) => r.json());
  const status = s.status ?? s.data?.status;
  if (status === "succeeded" || status === "SUCCESS") { console.log("video:", s.data.data.content.video_url); break; }
  if (status === "failed" || status === "FAILED") { console.error("failed:", s); break; }
}`

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

export function Docs() {
  return (
    <PublicLayout>
      <div className='mx-auto max-w-4xl space-y-10 px-6 py-10'>
        <header className='space-y-2'>
          <h1 className='text-3xl font-semibold'>API 文档</h1>
          <p className='text-muted-foreground'>
            AIKanHub 视频生成 API · 异步任务接口
          </p>
        </header>

        <section className='space-y-4'>
          <h2 className='text-xl font-semibold'>快速开始</h2>
          <ol className='text-muted-foreground list-decimal space-y-2 pl-6 text-sm'>
            <li>
              进入 <span className='font-mono'>令牌</span> 创建一个 token，复制 <span className='font-mono'>sk-xxx</span>
            </li>
            <li>
              将 token 设置为环境变量 <span className='font-mono'>AIKANHUB_TOKEN</span>
            </li>
            <li>用下面任一语言调用接口，提交任务后轮询直到完成</li>
            <li>视频 URL 24 小时内有效，请及时下载或转存</li>
          </ol>
        </section>

        <section className='space-y-4'>
          <h2 className='text-xl font-semibold'>提交视频生成任务</h2>
          <p className='text-muted-foreground text-sm'>
            <span className='bg-muted rounded px-2 py-0.5 font-mono'>POST /v1/video/generations</span> · 异步：返回 task_id 后自行轮询
          </p>

          <Tabs defaultValue='curl' className='border rounded-lg overflow-hidden'>
            <TabsList className='bg-muted h-10 w-full justify-start rounded-none border-b px-2'>
              <TabsTrigger value='curl'>cURL</TabsTrigger>
              <TabsTrigger value='python'>Python</TabsTrigger>
              <TabsTrigger value='node'>Node.js</TabsTrigger>
            </TabsList>
            <TabsContent value='curl' className='m-0 space-y-4'>
              <CodeBlock code={CURL_SUBMIT} lang='shell' />
              <p className='text-muted-foreground px-4 text-xs'>轮询任务状态（替换 $TASK_ID）：</p>
              <CodeBlock code={CURL_POLL} lang='shell' />
            </TabsContent>
            <TabsContent value='python' className='m-0'>
              <CodeBlock code={PYTHON_EXAMPLE} lang='python' />
            </TabsContent>
            <TabsContent value='node' className='m-0'>
              <CodeBlock code={NODE_EXAMPLE} lang='javascript' />
            </TabsContent>
          </Tabs>
        </section>

        <section className='space-y-4'>
          <h2 className='text-xl font-semibold'>请求参数</h2>
          <div className='border rounded-lg overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-muted'>
                <tr className='text-left'>
                  <th className='px-4 py-2 font-medium'>字段</th>
                  <th className='px-4 py-2 font-medium'>类型</th>
                  <th className='px-4 py-2 font-medium'>说明</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                <tr><td className='px-4 py-2 font-mono'>model</td><td className='px-4 py-2'>string</td><td className='px-4 py-2'>必填，见下方"支持的模型"</td></tr>
                <tr><td className='px-4 py-2 font-mono'>prompt</td><td className='px-4 py-2'>string</td><td className='px-4 py-2'>必填，文本提示词，中文 ≤500 字 / 英文 ≤1000 词</td></tr>
                <tr><td className='px-4 py-2 font-mono'>size</td><td className='px-4 py-2'>string</td><td className='px-4 py-2'><code>480p</code> / <code>720p</code> / <code>1080p</code></td></tr>
                <tr><td className='px-4 py-2 font-mono'>duration</td><td className='px-4 py-2'>int</td><td className='px-4 py-2'>输出时长（秒），4-15</td></tr>
                <tr><td className='px-4 py-2 font-mono'>images</td><td className='px-4 py-2'>string[]</td><td className='px-4 py-2'>图生视频时传入参考图 URL（公网可访问）</td></tr>
                <tr><td className='px-4 py-2 font-mono'>metadata</td><td className='px-4 py-2'>object</td><td className='px-4 py-2'>透传给上游的额外参数（ratio、generate_audio 等）</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className='space-y-4'>
          <h2 className='text-xl font-semibold'>支持的模型</h2>
          <div className='border rounded-lg overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-muted'>
                <tr className='text-left'>
                  <th className='px-4 py-2 font-medium'>Model ID</th>
                  <th className='px-4 py-2 font-medium'>说明</th>
                  <th className='px-4 py-2 font-medium'>价格（720p / 5s）</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                <tr>
                  <td className='px-4 py-2 font-mono text-xs'>doubao-seedance-2-0-260128</td>
                  <td className='px-4 py-2'>Seedance 2.0 · 最高品质</td>
                  <td className='px-4 py-2'>$0.885 / video</td>
                </tr>
                <tr>
                  <td className='px-4 py-2 font-mono text-xs'>doubao-seedance-2-0-fast-260128</td>
                  <td className='px-4 py-2'>Seedance 2.0 fast · 速度优先</td>
                  <td className='px-4 py-2'>$0.712 / video</td>
                </tr>
                <tr>
                  <td className='px-4 py-2 font-mono text-xs'>pixverse-v5.5</td>
                  <td className='px-4 py-2'>Pixverse v5.5</td>
                  <td className='px-4 py-2 text-muted-foreground'>规划中</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className='text-muted-foreground text-xs'>
            当前为统一定价（基准：720p / 5s / 不含视频输入）。精确按分辨率/时长/视频输入维度计费正在开发中。
          </p>
        </section>

        <section className='space-y-4'>
          <h2 className='text-xl font-semibold'>任务状态</h2>
          <p className='text-muted-foreground text-sm'>轮询响应中的 <code className='bg-muted rounded px-1'>status</code> 字段：</p>
          <ul className='text-muted-foreground space-y-1 pl-6 text-sm list-disc'>
            <li><code className='bg-muted rounded px-1'>queued</code> / <code className='bg-muted rounded px-1'>NOT_START</code>：排队中</li>
            <li><code className='bg-muted rounded px-1'>IN_PROGRESS</code> / <code className='bg-muted rounded px-1'>processing</code>：生成中</li>
            <li><code className='bg-muted rounded px-1'>SUCCESS</code> / <code className='bg-muted rounded px-1'>succeeded</code>：完成，<code className='bg-muted rounded px-1'>data.data.content.video_url</code> 中是视频地址</li>
            <li><code className='bg-muted rounded px-1'>FAILED</code> / <code className='bg-muted rounded px-1'>failed</code>：失败，<code className='bg-muted rounded px-1'>fail_reason</code> 字段有原因</li>
          </ul>
          <p className='text-muted-foreground text-xs'>生成时间：720p / 5s 通常 90-120 秒。建议轮询间隔 5 秒。</p>
        </section>
      </div>
    </PublicLayout>
  )
}
