# Tooltip 提示信息

Tooltip 提示信息是我们在使用 VChart 图表时，用以显示在图表不同元素上的附加信息，通过鼠标悬停操作展示出来。本教程主要讲解提示信息组件的相关概念以及组成，关于组件更加详细的配置及示例，详见[配置项文档](../../../option)及[示例](../../../example)页面。

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a212.png" alt="tooltip">
</div>

## Tooltip 提示信息的组成

在 VChart 图表中，Tooltip 提示信息主要由两部分组成：

1.  标题（`title`）：显示当前鼠标悬停的数据分类或其他相关信息。
2.  内容（`content`）：显示当前鼠标悬停的详细数据及其属性信息。

在 VChart 上我们根据 tooltip 的显示数据提供了两种类型的 tooltip，分别为图元 tooltip（`'mark'`）和维度项 tooltip（`'dimension'`）。其中图元（`'mark'`）指的是单独某一个数据对应的图形（如下图中堆积柱图中的一个小方块）。`'dimension'` 指的是当前鼠标所在区域的维度值（如 x 值）对应的一组数据（如下图中堆积柱图中堆叠在一起的一组数据）:

![tooltip 内容类型图示](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a11.png)

## 样式配置

通过 `tooltip.style` 属性，我们可以对 tooltip 进行样式配置。下面的代码示例展示了常见的 tooltip 面板的样式配置，如调整背景色、圆角、边框阴影等配置。

```ts
tooltip: {
    style: {
      panel: {
        /** 背景色 */
        backgroundColor: 'rgba(24,144,255, 0.1)',
        /** tooltip边框 */
        border: {
          color: '#6690F2',
          width: 2,
          /** 圆角 */
          radius: 4
        },
        /** tooltip阴影 */
        shadow: {
          blur: 10,
          spread: 2,
          color: '#6690F2'
        }
      }
    }
  }
```

![Tooltip 样式配置结果图](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a213.png)

## 格式化

### 标题格式化

有时我们需要对 Tooltip 的标题进行特定的显示格式，此时我们可以通过在对应类型的 tooltip 下的 `title.value` 属性进行配置，如果配置该属性为字符串，则显示为对应的常量文本。也可配置为函数回调：`(datum: Datum) => string;` 其中 datum 为 tooltip 当前行所默认对应的数据项。

标题格式化示例：

```ts
{
  tooltip: {
    // 配置 mark 图元的标题内容
    mark: {
      title: {
        value: '标题'
      }
    },
    // 配置 dimension 维度项的标题内容
    dimension: {
      title: {
        value: datum => datum.value
      }
    },
  }
}
```

### 2. 内容格式化

除了标题，我们同样也可以对 Tooltip 的内容进行格式化处理。与标题格式化类似，我们可以通过在对应类型的 tooltip 下的 `content` 属性进行配置，Tooltip 的每一条 content 由如下部分组成：

- `shape`：数据项图形。
- `key`：数据项名称。
- `value`：数据项值。

当我们需要对内容进行格式化时，可以通过配置 `key`, `value` 属性进行，如果配置为字符串，则显示为对应的常量文本。也可配置为函数回调，也可配置为函数回调：`(datum: Datum) => string;` 其中 datum 为 tooltip 当前行所默认对应的数据项。

内容格式化示例：

```ts
{
  tooltip: {
    // 配置 mark 图元的内容
    mark: {
      content: {
        key: '数值',
        value: datum => datum.value
      }
    },
    // 配置 dimension 维度项的内容
    dimension: {
      content: {
        key: datum => datum.type,
        value: datum => datum.value
      }
    },
  }
}
```

## 自定义

当配置项无法满足 tooltip 的展示需求时，我们还提供了自定义 tooltip 的能力。可以通过配置 `TooltipHandler` 来覆盖默认 tooltip 展示逻辑。具体可以阅读 VChart 实例方法 [` setTooltipHandler`](/zh/api.html#VChart.方法.setTooltipHandler) 的使用。

```ts
  /**
   * 自定义 TooltipHandler。
   * @param tooltipHandler
   */
  setTooltipHandler: (tooltipHandler: ITooltipHandler) => void;
```

注意：

- 当给图表设置了自定义`TooltipHandler`后，内置的 tooltip 将不再起作用。
- VChart 不感知、不托管自定义 tooltip 的渲染，请按照需要自行实现 tooltip 渲染，包括**处理原始数据**、**tooltip 内容设计**，以及**根据项目环境创建组件并设置样式**。
- 当图表删除时会调用当前`TooltipHandler`的`release`函数，请按照需要删除。
- 由于自定义`TooltipHandler`会覆盖内置 tooltip 逻辑，**图表`spec`中的部分 tooltip 配置项便不再起作用**。但以下配置项作用于所有自定义`TooltipHandler`：
  - `tooltip.visible`
  - `tooltip.activeType`
  - `tooltip.trigger`
  - `tooltip.triggerOff`

`ITooltipHandler`接口定义如下：

```ts
interface ITooltipHandler {
  /** 显示 tooltip，可以选择返回是否遇到异常 */
  showTooltip: (
    activeType: TooltipActiveType,
    data: TooltipData,
    params: TooltipHandlerParams
  ) => TooltipResult | null | undefined;

  /** 隐藏 tooltip */
  hideTooltip: (params: TooltipHandlerParams) => void;

  /** 释放 tooltip */
  release: () => void;
}
```

其中`ITooltipHandler.showTooltip`有三个参数，意义分别为：

- `activeType`: 透出本次触发的 tooltip 类型，值为`'mark'`或`'dimension'`
- `data`: 透出本次触发的 tooltip 原始数据
- `params`: 透出本次触发的 tooltip 的鼠标事件

`data`参数的类型为`TooltipData`，类型定义为：

```ts
type TooltipData = IDimensionInfo[] | IDimensionData[];
```

如果用户触发了 mark tooltip，`TooltipData` 便为 `IDimensionData[]` 类型。`IDimensionData`的类型定义为：

```ts
interface IDimensionData {
  /** 图元上的原始数据（考虑到有多个图元的情况，实际为数组类型） */
  datum: Datum[];
  /** 图元所在的系列实例 */
  series: ISeries;
}
```

而如果用户触发了 dimension tooltip，`TooltipData` 便为 `IDimensionInfo[]` 类型。`IDimensionInfo`承载了鼠标所在整个维度项的信息，类型定义为：

```ts
interface IDimensionInfo {
  /** 维度项索引 */
  index?: number;
  /** 维度项标题 */
  value: string;
  /** 维度项所在轴 */
  axis?: AxisComponent;
  /** 维度项对应数据 */
  data: IDimensionData[];
}
```

用户可以选择使`ITooltipHandler.showTooltip`方法返回一个状态`TooltipResult`，用来表示 tooltip 是否成功显示（如果不返回，则默认当做成功）。这个返回值和缓存策略有关。`TooltipResult`是个枚举类型，定义为：

```ts
enum TooltipResult {
  /** tooltip 显示成功 */
  success = 0,
  /** tooltip 未成功显示 */
  failed = 1
}
```

`ITooltipHandler.showTooltip`方法的最后一个参数为`params`，其类型定义为：

```ts
type TooltipHandlerParams = (BaseEventParams | DimensionEventParams) & {
  changePositionOnly?: boolean;
};
```

其中暴露了一个很有用的参数：`changePositionOnly`，**代表这个 tooltip 是否仅仅是上一个 tooltip 挪用了下位置，而数据相同**。这个参数将帮助用户对 tooltip 渲染进行优化。

示例：在控制台打出用户鼠标 hover 的维度项标题、以及系列图元的填充颜色：

```ts
vchart.setTooltipHandler({
  showTooltip: (activeType, data, params) => {
    if (params.changePositionOnly) {
      return;
    }
    if (activeType === 'dimension' && data?.length) {
      console.log(data[0].value);
    } else if (activeType === 'mark') {
      const { datum, series } = data[0];
      const color = series.getSeriesStyle(datum[0])('fill');
      console.log(color);
    }
  }
});
```

也可参考另一个示例：

```javascript livedemo
const data = [
  { type: 'rail', value: 31.8, month: 'January' },
  { type: 'highway', value: 39.2, month: 'January' },
  { type: 'civil aviation', value: 24.1, month: 'January' },
  { type: 'rail', value: 46.4, month: 'February' },
  { type: 'highway', value: 38, month: 'February' },
  { type: 'civil aviation', value: 22.3, month: 'February' },
  { type: 'rail', value: 30.3, month: 'March' },
  { type: 'highway', value: 30.9, month: 'March' },
  { type: 'civil aviation', value: 23.4, month: 'March' },
  { type: 'rail', value: 60.8, month: 'April' },
  { type: 'highway', value: 26.8, month: 'April' },
  { type: 'civil aviation', value: 24.5, month: 'April' },
  { type: 'rail', value: 31.7, month: 'May' },
  { type: 'highway', value: 26.4, month: 'May' },
  { type: 'civil aviation', value: 27, month: 'May' },
  { type: 'rail', value: 38.7, month: 'June' },
  { type: 'highway', value: 36.7, month: 'June' },
  { type: 'civil aviation', value: 33.4, month: 'June' },
  { type: 'rail', value: 25.3, month: 'July' },
  { type: 'highway', value: 34.7, month: 'July' },
  { type: 'civil aviation', value: 28.2, month: 'July' },
  { type: 'rail', value: 45.3, month: 'August' },
  { type: 'highway', value: 25.3, month: 'August' },
  { type: 'civil aviation', value: 30.8, month: 'August' },
  { type: 'rail', value: 26.8, month: 'September' },
  { type: 'highway', value: 29.4, month: 'September' },
  { type: 'civil aviation', value: 20.9, month: 'September' },
  { type: 'rail', value: 39.8, month: 'October' },
  { type: 'highway', value: 38.5, month: 'October' },
  { type: 'civil aviation', value: 39, month: 'October' },
  { type: 'rail', value: 38.3, month: 'November' },
  { type: 'highway', value: 23.8, month: 'November' },
  { type: 'civil aviation', value: 29.4, month: 'November' },
  { type: 'rail', value: 62.8, month: 'December' },
  { type: 'highway', value: 35.8, month: 'December' },
  { type: 'civil aviation', value: 35.2, month: 'December' }
];
const dataFields = {
  month: {
    lockStatisticsByDomain: true,
    domain: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ]
  },
  type: {
    lockStatisticsByDomain: true,
    domain: ['rail', 'highway', 'civil aviation']
  }
};
const spec = {
  type: 'rose',
  data: [
    {
      id: 'id0',
      values: data,
      fields: dataFields
    }
  ],
  padding: {
    top: 30
  },
  radius: 0.8,
  innerRadius: 0,
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type',
  stack: true,
  rose: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  legends: {
    visible: true,
    orient: 'top',
    interactive: false
  },
  axes: [
    {
      orient: 'radius',
      visible: true,
      tick: { tickCount: 3 },
      grid: { visible: true, style: { lineDash: [0] } },
      max: 150
    },
    {
      orient: 'angle',
      visible: true,
      domainLine: { visible: true, smooth: false },
      grid: { visible: true, smooth: false },
      label: {
        visible: true,
        style: {
          fill: '#000'
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

const tooltipChartSpec = {
  type: 'pie',
  padding: 2,
  background: 'transparent',
  data: [
    {
      id: 'tooltipData',
      values: [],
      fields: dataFields
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  radius: 0.15,
  innerRadius: 0.11,
  pie: {
    style: {
      stroke: 'white',
      fillOpacity: 0.8,
      lineWidth: 2
    }
  },
  label: {
    visible: true,
    position: 'outside',
    style: {
      stroke: 'white',
      lineWidth: 4,
      text: datum => [datum['type'], `(${datum['value']}, ${datum['month']})`]
    }
  }
};

function initTooltip() {
  const createElement = (parentEl, tag, classList, style, id) => {
    const element = document.createElement(tag);
    if (classList) {
      element.classList.add(...classList);
    }
    if (style) {
      Object.keys(style).forEach(key => {
        element.style[key] = style[key];
      });
    }
    if (id) {
      element.id = id;
    }
    parentEl.appendChild(element);
    return element;
  };

  const tooltipContainer = createElement(
    document.getElementById(CONTAINER_ID),
    'div',
    [],
    {
      position: 'absolute',
      boxSizing: 'border-box',
      width: '100px',
      height: '100px',
      background:
        'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0) 26px, rgba(255, 255, 255, 0.65) 26px, rgba(255, 255, 255, 0.65) 100%)',
      //backdropFilter: 'blur(2px)',
      borderRadius: '50%',
      boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 12px 0px',
      visibility: 'hidden',
      pointerEvents: 'none',
      transform: 'translate(-50%, -50%)',
      top: 0,
      left: 0
    },
    'tooltip'
  );
  const tooltipChartContainer = createElement(
    tooltipContainer,
    'div',
    [],
    {
      width: '500px',
      height: '500px',
      transform: 'translate(-50%, -50%)',
      margin: '50%'
    },
    'tooltip-chart'
  );

  const tooltipChart = new VChart(tooltipChartSpec, { dom: 'tooltip-chart' });
  tooltipChart.renderSync();
  return tooltipChart;
}

const tooltipChart = initTooltip();
vchart.setTooltipHandler({
  showTooltip: (activeType, tooltipData, params) => {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.left = params.event.x + 'px';
    tooltip.style.top = params.event.y + 'px';
    if (params.changePositionOnly) {
      return;
    }
    let data = [];
    if (activeType === 'dimension') {
      data = tooltipData[0]?.data[0]?.datum ?? [];
    } else if (activeType === 'mark') {
      data = tooltipData[0]?.datum ?? [];
    }
    tooltipChart.updateData(
      'tooltipData',
      data.map(({ type, value, month }) => ({ type, value, month }))
    );
    tooltip.style.visibility = 'visible';
  },
  hideTooltip: () => {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.visibility = 'hidden';
  },
  release: () => {
    tooltipChart.release();
    const tooltip = document.getElementById('tooltip');
    tooltip.remove();
  }
});

vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
window['tooltipChart'] = tooltipChart;
```
