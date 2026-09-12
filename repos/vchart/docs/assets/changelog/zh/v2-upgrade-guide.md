# v2 升级指南

## 变更

### 架构变更，VChart 不再依赖 VGrammar

![image.png](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/v2-upgrade/total.png)

### 部分图表挪到 @visactor/vchart-extension

#### bar3d

- Before

```js
import VChart from '@visactor/vchart';
const spec = {
  type: 'bar3d'
  // ...
};

const vchart = new VChart.default(spec, {
  dom: BUGSERVER_CONTAINER_ID,
  animation: false,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});

await vchart.renderAsync();
```

- 2.0.0

```js
import VChart from '@visactor/vchart';
import { registerBar3dChart } from '@viscator/vchart-extension';

registerBar3dChart();
const spec = {
  type: 'bar3d'
  // ...
};

// 3d 图表默认配置了 { options3d: {enable: true } }
const vchart = new VChart.default(spec, { dom: BUGSERVER_CONTAINER_ID, animation: false, disableDirtyBounds: true });

await vchart.renderAsync();
```

#### funnel3d

- Before

```js
import VChart from '@visactor/vchart';
const spec = {
  type: 'funnel3d'
  // ...
};

const vchart = new VChart.default(spec, {
  dom: BUGSERVER_CONTAINER_ID,
  animation: false,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});

await vchart.renderAsync();
```

- 2.0.0

```js
import VChart from '@visactor/vchart';
import { registerFunnel3dChart } from '@viscator/vchart-extension';

registerFunnel3dChart();
const spec = {
  type: 'funnel3d'
  // ...
};

// 3d 图表默认配置了 { options3d: {enable: true } }
const vchart = new VChart.default(spec, { dom: BUGSERVER_CONTAINER_ID, animation: false, disableDirtyBounds: true });

await vchart.renderAsync();
```

#### histogram3d

- Before

```js
import VChart from '@visactor/vchart';
const spec = {
  type: 'histogram3d'
  // ...
};

const vchart = new VChart.default(spec, {
  dom: BUGSERVER_CONTAINER_ID,
  animation: false,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});

await vchart.renderAsync();
```

- 2.0.0

```js
import VChart from '@visactor/vchart';
import { registerHistogram3dChart } from '@viscator/vchart-extension';

registerHistogram3dChart();
const spec = {
  type: 'histogram3d'
  // ...
};

// 3d 图表默认配置了 { options3d: {enable: true } }
const vchart = new VChart.default(spec, { dom: BUGSERVER_CONTAINER_ID, animation: false, disableDirtyBounds: true });

await vchart.renderAsync();
```

#### pie3d

- Before

```js
import VChart from '@visactor/vchart';
const spec = {
  type: 'pie3d'
  // ...
};

const vchart = new VChart.default(spec, {
  dom: BUGSERVER_CONTAINER_ID,
  animation: false,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});

await vchart.renderAsync();
```

- 2.0.0

```js
import VChart from '@visactor/vchart';
import { registerPie3dChart } from '@viscator/vchart-extension';

registerPie3dChart();
const spec = {
  type: 'pie3d'
  // ...
};

// 3d 图表默认配置了 { options3d: {enable: true } }
const vchart = new VChart.default(spec, { dom: BUGSERVER_CONTAINER_ID, animation: false, disableDirtyBounds: true });

await vchart.renderAsync();
```

#### rangeColumn3d

- Before

```js
import VChart from '@visactor/vchart';
const spec = {
  type: 'rangeColumn3d'
  // ...
};

const vchart = new VChart.default(spec, {
  dom: BUGSERVER_CONTAINER_ID,
  animation: false,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});

await vchart.renderAsync();
```

- 2.0.0

```js
import VChart from '@visactor/vchart';
import { registerRangeColumn3dChart } from '@viscator/vchart-extension';

registerRangeColumn3dChart();
const spec = {
  type: 'rangeColumn3d'
  // ...
};

// 3d 图表默认配置了 { options3d: {enable: true } }
const vchart = new VChart.default(spec, { dom: BUGSERVER_CONTAINER_ID, animation: false, disableDirtyBounds: true });

await vchart.renderAsync();
```

#### wordcloud3d

- Before

```js
import VChart from '@visactor/vchart';
const spec = {
  type: 'wordcloud3d'
  // ...
};

const vchart = new VChart.default(spec, {
  dom: BUGSERVER_CONTAINER_ID,
  animation: false,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});

await vchart.renderAsync();
```

- 2.0.0

```js
import VChart from '@visactor/vchart';
import { registerWordCloud3dChart, registerWordCloudShape3dChart } from '@viscator/vchart-extension';

registerWordCloud3dChart();
const spec = {
  type: 'wordcloud3d'
  // ...
};

// 3d 图表默认配置了 { options3d: {enable: true } }
const vchart = new VChart.default(spec, { dom: BUGSERVER_CONTAINER_ID, animation: false, disableDirtyBounds: true });

await vchart.renderAsync();
```

#### 直角坐标系的 3d 图表

- Before

```js
import VChart, { register3DPlugin } from '@visactor/vchart';

register3DPlugin();
const spec = {
  type: 'area',
  label: { visible: true },
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
  title: {
    visible: true,
    text: 'Unstacked area chart of cosmetic products sales'
  },
  stack: false,
  xField: 'type',
  yField: 'value',
  zField: 'country',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  axes: [
    {
      orient: 'bottom',
      mode: '3d'
    },
    {
      orient: 'left',
      mode: '3d'
    },
    {
      orient: 'z',
      mode: '3d',
      label: { visible: true },
      type: 'band',
      grid: { visible: true },
      width: 600,
      height: 200,
      depth: 200
    }
  ],
  crosshair: {
    xField: { visible: false }
  }
};

const vchart = new VChart.default(spec, {
  dom: BUGSERVER_CONTAINER_ID,
  animation: false,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});

await vchart.renderAsync();
```

- 2.0.0

```js
import VChart from '@visactor/vchart';
import { registerAxis3dPlugin } from '@visactor/vchart-extension';

registerAxis3dPlugin();

const spec = {
  type: 'area',
  label: { visible: true },
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
  title: {
    visible: true,
    text: 'Unstacked area chart of cosmetic products sales'
  },
  stack: false,
  xField: 'type',
  yField: 'value',
  zField: 'country',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  axes: [
    {
      orient: 'bottom',
      mode: '3d'
    },
    {
      orient: 'left',
      mode: '3d'
    },
    {
      orient: 'z',
      mode: '3d',
      label: { visible: true },
      type: 'band',
      grid: { visible: true },
      width: 600,
      height: 200,
      depth: 200
    }
  ],
  crosshair: {
    xField: { visible: false }
  }
};

// 3d 图表默认配置了 { options3d: {enable: true } }
const vchart = new VChart.default(spec, { dom: BUGSERVER_CONTAINER_ID, animation: false, disableDirtyBounds: true });

await vchart.renderAsync();
```

#### pictogram 象形图

##### 象形图注册方法从 vchart-extension 引入

- Before

```js
import VChart, { registerPictogramChart } from '@visactor/vchart';

registerPictogramChart();
const spec = {
  type: 'pictogram'
  // ...
};

const vchart = new VChart.default(spec, { dom: BUGSERVER_CONTAINER_ID });

await vchart.renderAsync();
```

- 2.0.0

```js
import VChart from '@visactor/vchart';
import { registerPictogramChart, getSVGSource } from '@visactor/vchart-extension';

registerPictogramChart();

const spec = {
  type: 'pictogram'
  // ...
};
const vchart = new VChart.default(spec, { dom: BUGSERVER_CONTAINER_ID });

await vchart.renderAsync();
```

##### 静态方法 VChart.getSVG() 被移除

- Before

```js
import VChart from '@visactor/vchart';
const mySvgSource = VChart.getSVG('name');
```

- 2.0.0

```js
import { getSVGSource } from '@visactor/vchart-extension';

const mySvgSource = getSVGSource('name');
```

#### imageCloud 图元（2.0 新增）

### Map-label 挪到 @visactor/vchart-extension

- Before

```js
const spec = {
  mapLabel: {
    visible: true,
    position: 'outer',
    seriesId: 'scatter',
    nameField: 'name',
    valueField: 'value',
    space: 6
    // ...
  }
};
```

- 2.0.0

```js
import { registerMapLabel } from '@visactor/vchart-extension';

registerMapLabel();

const spec = {
  mapLabel: {
    visible: true,
    position: 'outer',
    seriesId: 'scatter',
    nameField: 'name',
    valueField: 'value',
    space: 6
    // ...
  }
};
```

### 高级用法涉及到的 api 更新

#### vgrammar View 相关 api 删除

![image.png](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/v2-upgrade/compilier.png)

#### 事件的回调参数

变更： 事件参数中的 item 从 vgrammar 元素变成图元中触发事件的图形

![image.png](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/v2-upgrade/event.png)

- Before

```
vchart.on('dimensionClick', (e) => {
  e.item.graphicItem.setAttributes({ fill: 'red' });
})
```

- 2.0.0

```
vchart.on('dimensionClick', (e) => {
  e.item?.setAttributes({ fill: 'red' });
})##
```

#### 自定义 state 参数变更

####    变化 1: 根据 items 筛选，之前返回的是 vgrammar elements，现在返回的是 vrender 图元

####    变化 2: 自定义 filter 中，函数返回的第二个参数有更新

![image.png](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/v2-upgrade/state.png)

#### 获取图元对应的图形

- Before

```
const elements = mark.getProduct().elements;

elements.forEach(el => {
   const g = el.getGraphicItem();
   //
})
```

- 2.0.0

```
import type { IMarkGraphic } from '@visactor/vchart'

const graphics = mark.getGraphics();

graphics.forEach((g: IMarkGraphic) => {
  //
})
```

#### 注册自定义的图形组件

- Before

```
import { Factory } from '@viscator/vgrammar-core';


Factory.registerGraphicComponent(AxisEnum.lineAxis, (attrs: any, options: VRenderComponentOptions) => {
  return new LineAxis(attrs, options) as unknown as IGroup;
});
```

- 2.0.0

```
import { Factory } from '@viscator/vchart';


Factory.registerGraphicComponent(AxisEnum.lineAxis, (attrs: any, options: VRenderComponentOptions) => {
  return new LineAxis(attrs, options) as unknown as IGroup;
});
```

#### ManualTicker

- Before

```
const ticker = new VRender.ManualTicker([]);
ticker.mode = "manual";
const chart = new VChart.default(spec, {
  dom: "app",
  animation: true,
  ticker,
});
```

- 2.0.0

```
const chart = new VChart.default(spec, {
  dom: "app",
  animation: true,
});
const stage = chart.getStage();
ticker = new VChart.ManualTicker(stage);
stage.ticker = ticker;
```

#### 动画自定义插值

- Before

```
custom: (ratio, from, to，out) => {
  // 修改out
},
```

- 2.0.0

```
custom: (ratio, from, to，out, graphic) => {
  // 修改graphic.attribute
},
```

### vrender 1.x 版本涉及到的变更

- 删除了 `defaultTicker`
