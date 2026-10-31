# 使用 Midscene.js 通过 AI 简化测试

[Midscene.js](https://midscenejs.com/zh) 是一款由多模态 AI 驱动 UI 的自动化工具，Midscene.js 让 UI 自动化测试脚本变得更容易编写、更易维护。

<div style="width: 40%; text-align: center;">
  <video src="https://midscenejs.com/introduction/Midscene.mp4" controls style="width: 100%"></video>
</div>

在使用 VisActor 产品时，使用 Midscene.js 提供的 action 能力可以快速完成 UI 测试用例，Midscene.js 提供的 query 和 assert 也更加方便测试用例的编写。

## 使用 Chrome 插件体验

1. 参考 Midscene.js 站点教程完成插件安装：[https://midscenejs.com/zh/quick-experience.html](https://midscenejs.com/zh/quick-experience.html)

2. 参考说明文档配置模型参数：[https://midscenejs.com/zh/model-provider.html](https://midscenejs.com/zh/model-provider.html)（推荐使用 UI-TARS 或 Qwen-2.5-VL 模型，VisActor 组件都是基于 canvas 实现，所以没有办法使用 gpt-4o 模型）

3. 打开 playground：[https://www.visactor.com/vchart/playground](https://www.visactor.com/vchart/playground)，填充相应的测试用例，下面是一个简单例子：

示例代码：

```ts
const spec = {
  type: 'line',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
```

5. 输入指令，点击 Run 按钮，运行测试用例

- 执行交互命令：点击左侧折线图中的 USA 图例

<div style="width: 40%; text-align: center;">
  <video src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/preview/midscene-vchart-action.mp4" controls style="width: 100%"></video>
</div>

- 执行查询命令：左侧折线图中 Y 轴中的全部标签

<div style="width: 40%; text-align: center;">
  <video src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/preview/midscene-vchart-query.mp4" controls style="width: 100%"></video>
</div>

- 执行断言命令：左侧折线图中 Y 轴的最大标签为 20000

<div style="width: 40%; text-align: center;">
  <video src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/preview/midscene-vchart-assert.mp4" controls style="width: 100%"></video>
</div>

## 使用 puppeteer 编写自动化测试脚本

示例仓库：[https://github.com/VisActor/midscene-test-demo](https://github.com/VisActor/midscene-test-demo)

### 运行示例代码

1. 克隆仓库，运行`pnpm install`安装依赖
2. 新建`.env`文件，配置大模型

```
# replace by your own, example(qwen):
OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
OPENAI_API_KEY="YOUR_TOKEN"
MIDSCENE_MODEL_NAME="qwen-vl-max-latest"
MIDSCENE_USE_QWEN_VL=1
```

3. 运行测试

```
# run vchart demo
pnpm run start-test-vchart

# run vtable demo
pnpm run start-test-vtable
```

### 示例代码说明

测试代码在`test/vchart-test.ts`

1. 创建 browser & page，打开测试 url

```ts
const browser = await puppeteer.launch({
  headless: false, // 'true' means we can't see the browser window
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
await page.setViewport({
  width: 1280,
  height: 768,
  deviceScaleFactor: os.platform() === 'darwin' ? 2 : 1 // this is used to avoid flashing on UI Mode when doing screenshot on Mac
});

await page.goto(URL);
```

2. 插入运行 VChart 代码，创建图表

```ts
await page.evaluate(spec => {
  const CONTAINER_ID = 'visactor-container';

  // @ts-ignore
  const vchart = new window.VChart.default(spec, {
    dom: CONTAINER_ID,
    animation: false
  });
  vchart.renderSync();
}, spec);

// 等待canvas创建完成，图表完成渲染
await page.waitForSelector('canvas');
```

3. 创建 Midscene agent，执行测试命令

```ts
// init Midscene agent
const agent = new PuppeteerAgent(page);

// 点击折线图中的 USA 图例
await agent.aiAction('点击折线图中的 USA 图例');

// 获取折线图中Y轴中的全部标签
const items = await agent.aiQuery('折线图中Y轴中的全部标签');
console.log('Y轴中的全部标签', items);

// 断言折线图中Y轴的最大标签为20000。返回一个 Promise，当断言成功时解析为 void；若断言失败，则抛出一个错误，错误信息包含 errorMsg 以及 AI 生成的原因
await agent.aiAssert('折线图中Y轴的最大标签为20000');
```

4. 截图，对比标准图片

```ts
const screenshot = await page.screenshot();

// 对比标准图片
await diffImage('./test/images/vchart-test.png', screenshot, 'vchart-diff');
```
