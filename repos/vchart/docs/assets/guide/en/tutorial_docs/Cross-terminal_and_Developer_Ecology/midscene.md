# Using Midscene.js to Simplify Testing with AI

[Midscene.js](https://midscenejs.com) is an automation tool powered by multimodal AI for UI testing. Midscene.js makes UI automation test scripts easier to write and maintain.

<div style="width: 40%; text-align: center;">
  <video src="https://midscenejs.com/introduction/Midscene.mp4" controls style="width: 100%"></video>
</div>

When using VisActor products, Midscene.js's action capabilities can help quickly complete UI test cases. The query and assert functionalities provided by Midscene.js also make writing test cases more convenient.

## Try it with Chrome Extension

1. Follow the Midscene.js site tutorial to install the plugin: [https://midscenejs.com/en/quick-experience.html](https://midscenejs.com/en/quick-experience.html)

2. Configure model parameters according to the documentation: [https://midscenejs.com/en/model-provider.html](https://midscenejs.com/en/model-provider.html) (UI-TARS or Qwen-2.5-VL models are recommended since VisActor components are implemented based on canvas, so gpt-4o model cannot be used)

3. Open the playground: [https://www.visactor.com/vchart/playground](https://www.visactor.com/vchart/playground) and fill in the test cases. Here's a simple example:

Example code:

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

5. Enter commands and click the Run button to execute test cases

- Execute interaction command: Click the USA legend in the line chart

<div style="width: 40%; text-align: center;">
  <video src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/preview/midscene-vchart-action.mp4" controls style="width: 100%"></video>
</div>

- Execute query command: Get all Y-axis labels in the line chart

<div style="width: 40%; text-align: center;">
  <video src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/preview/midscene-vchart-query.mp4" controls style="width: 100%"></video>
</div>

- Execute assertion command: Assert that the maximum Y-axis label in the line chart is 20000

<div style="width: 40%; text-align: center;">
  <video src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/preview/midscene-vchart-assert.mp4" controls style="width: 100%"></video>
</div>

## Writing Automated Test Scripts with Puppeteer

Example repository: [https://github.com/VisActor/midscene-test-demo](https://github.com/VisActor/midscene-test-demo)

### Running the Example Code

1. Clone the repository and run `pnpm install` to install dependencies
2. Create a `.env` file and configure the AI model

```
# replace by your own, example(qwen):
OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
OPENAI_API_KEY="YOUR_TOKEN"
MIDSCENE_MODEL_NAME="qwen-vl-max-latest"
MIDSCENE_USE_QWEN_VL=1
```

3. Run the tests

```
# run vchart demo
pnpm run start-test-vchart

# run vtable demo
pnpm run start-test-vtable
```

### Example Code Explanation

Test code is in `test/vchart-test.ts`

1. Create browser & page, open test URL

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

2. Insert VChart code to create chart

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

// Wait for canvas creation and chart rendering
await page.waitForSelector('canvas');
```

3. Create Midscene agent and execute test commands

```ts
// init Midscene agent
const agent = new PuppeteerAgent(page);

// Click the USA legend in the line chart
await agent.aiAction('Click the USA legend in the line chart');

// Get all Y-axis labels in the line chart
const items = await agent.aiQuery('Get all Y-axis labels in the line chart');
console.log('Y-axis labels:', items);

// Assert that the maximum Y-axis label in the line chart is 20000. Returns a Promise that resolves to void when assertion passes; throws an error with errorMsg and AI-generated reason if assertion fails
await agent.aiAssert('Assert that the maximum Y-axis label in the line chart is 20000');
```

4. Take screenshot and compare with baseline image

```ts
const screenshot = await page.screenshot();

// Compare with baseline image
await diffImage('./test/images/vchart-test.png', screenshot, 'vchart-diff');
```
