# Label 数据标签

在使用 VChart 进行图表可视化时，不仅需要展示各种图形元素，还可以通过数据标签（Label）来展示更加详细的信息。数据标签可以让用户更直观地了解和分析图表中的数据点。

VChart 支持多种类型的图表，包括柱状图、折线图、饼图、面积图和散点图等，每种图表都可以通过配置标签（`label`）来实现数据标签的显示和样式设置。在本教程中，我们将详细介绍如何在 VChart 的各类图表中使用数据标签。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c613.png)

## 标签样式

在 VChart 中，数据标签的样式可以通过配置 `label.style` 来配置。以下是一个设置柱状图数据标签样式的示例：

```json
{
  "type": "line",
  "label": {
    "visible": true,
     "offset": 2,
    "style":{
      "fill": "#333",
      "fontSize": "14",
      "fontWeight": "bold"
    },
   ...
  }
}
```

在这个示例中，我们为折线图的数据标签设置了一些基本样式：

- `visible`：设置为 `true` 表示显示数据标签，默认不显示标签。
- `position`：设置数据标签的位置，这里设置为 `top`，表示标签位于图形的上方。
- `offset`: 设置标签和图形的间距。
- `style`：设置标签文本的样式。
  - `fill`：设置标签文本的填充色。
  - `fontSize`：设置标签文本的字体大小。
  - `fontWeight`：设置标签文本的字体粗细。

文字图元的支持的配置属性可以参考[配置项文档](../../../../option/lineChart#label.style)。

你可以在下面的例子中尝试编辑标签的样式：

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8,
        lowest: true
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17,
        highest: true
      },
      {
        time: '14:00',
        value: 17,
        highest: true
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  label: {
    visible: true,
    position: 'top',
    offset: 2,
    overlap: false,
    style: {
      fill: '#333',
      fontWeight: 'bold'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

类似地，您可以为其他类型的图表设置相应的数据标签样式。

## 自定义标签

VChart 支持通过自定义函数来配置标签内容。例如，可以将柱状图的数量显示为千分位形式，或者为饼图的百分比添加圆括号等。

以下是一个使用自定义标签函数将柱状图数值显示为千分位的示例：

```json
{
  "label": {
    "visible": true,
    "style":{
      "text": (datum) =>  datum.value.toLocaleString();
    }
  }
}
```

在这个示例中，我们为 `label.style` 添加了一个 `text` 属性，其值是一个 JavaScript 函数。该函数接受一个参数 `datum`，表示数据点的原始数据，并返回经过处理后的标签文本。

## 标签躲避

在某些情况下，数据标签可能会遇到重叠的问题，尤其是在数据点密集的图表中。为了解决这个问题，VChart 支持在折线图、面积图、柱状图、饼图、散点图等图表中通过配置项设置标签躲避策略。

```json
{
  "label": {
    "visible": true,
    "overlap": {
      // 标签发生重叠时是否隐藏
      "hideOnHit": false,
      "strategy": [{ "type": "position", "position": ["inside-top", "top"] }]
    },
    // 不进行标签躲避处理
    "overlap": false
  }
}
```

在这个示例中，我们为散点图的数据标签设置了以下选项：

- `overlap`：若设置为 `false` 表示关闭标签躲避功能。
  - `overlap.hideOnHit`：设置标签发生重叠时不隐藏。
  - `overlap.strategy`：设置标签发生重叠时的处理策略。详细策略配置可以参考[配置文档](../../../../option/scatterChart#label.overlap)

这里是一个柱状图自定义标签防重叠策略的示例：

```javascript livedemo
const spec = {
  stack: true,
  data: [
    {
      name: 'allData',
      values: [
        {
          name: 'A',
          value: 0.12,
          group: '7+'
        },
        {
          name: 'B',
          value: 0.34,
          group: '7+'
        },
        {
          name: 'C',
          value: 0.25,
          group: '7+'
        },
        {
          name: 'D',
          value: 0.48,
          group: '7+'
        },
        {
          name: 'E',
          value: 0.55,
          group: '7+'
        },
        {
          name: 'F',
          value: 0.42,
          group: '7+'
        },
        {
          name: 'A',
          value: 0.23,
          group: '6-7'
        },
        {
          name: 'B',
          value: 0.25,
          group: '6-7'
        },
        {
          name: 'C',
          value: 0.18,
          group: '6-7'
        },
        {
          name: 'D',
          value: 0.19,
          group: '6-7'
        },
        {
          name: 'E',
          value: 0.15,
          group: '6-7'
        },
        {
          name: 'F',
          value: 0.12,
          group: '6-7'
        },
        {
          name: 'A',
          value: 0.31,
          group: '4-5'
        },
        {
          name: 'B',
          value: 0.33,
          group: '4-5'
        },
        {
          name: 'C',
          value: 0.4,
          group: '4-5'
        },
        {
          name: 'D',
          value: 0.24,
          group: '4-5'
        },
        {
          name: 'E',
          value: 0.18,
          group: '4-5'
        },
        {
          name: 'F',
          value: 0.2,
          group: '4-5'
        },
        {
          name: 'A',
          value: 0.56,
          group: '2-3'
        },
        {
          name: 'B',
          value: 0.29,
          group: '2-3'
        },
        {
          name: 'C',
          value: 0.15,
          group: '2-3'
        },
        {
          name: 'D',
          value: 0.01,
          group: '2-3'
        },
        {
          name: 'E',
          value: 0.14,
          group: '2-3'
        },
        {
          name: 'F',
          value: 0.16,
          group: '2-3'
        },
        {
          name: 'A',
          value: 0.15,
          group: '1'
        },
        {
          name: 'B',
          value: 0.11,
          group: '1'
        },
        {
          name: 'C',
          value: 0.015,
          group: '1'
        },
        {
          name: 'D',
          value: 0.02,
          group: '1'
        },
        {
          name: 'E',
          value: 0,
          group: '1'
        },
        {
          name: 'F',
          value: 0.05,
          group: '1'
        }
      ]
    }
  ],
  color: ['#009DB5', '#F0B71F', '#EB6F02', '#1E5273', '#3BA140'],
  label: {
    visible: true,
    position: 'inside', // 期望标签放在图形内部
    style: {
      stroke: 'white',
      lineWidth: 2
    },
    overlap: {
      strategy: [
        {
          type: 'bound', // 图形内部放不下时的处理策略
          position: ['top'] // 放不下可以尝试将标签放在图形上方
        },
        {
          type: 'moveY', // 若尝试上一条策略后，发现任然会发生重叠，则向上寻找空白位置
          offset: [-2, -4, -8, -10, -12] // 尝试向上寻找的偏移量
        }
      ]
    }
  },
  type: 'bar',
  xField: 'name',
  yField: 'value',
  seriesField: 'group'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

通过本教程，您应该已经了解了如何在 VChart 的图表中使用数据标签。请继续探索 VChart 的其他功能以创建更丰富多样的图表可视化效果。
