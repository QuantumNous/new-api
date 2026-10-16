# Indicator 指标卡

指标卡 (Indicator) 是用在饼图、玫瑰图以及雷达图等极坐标系下图表中的一种重要组件，它可以展示图表的重点数据信息，让图表更具有信息量和可读性。本教程主要讲解 indicator 的相关概念以及组成，关于 indicator 更加详细的配置及示例，详见[配置项文档](../../../option)及[示例](../../../example)页面。

## 组成

指标卡 (Indicator) 主要由以下几个部分组成：

1.  标题（Title）：用于展示标卡的主要信息。
2.  内容（Content）：用于展示指标卡的详细数据。
3.  交互触发器（Trigger）：用于配置指标卡更新的触发方式。

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a16.png" alt="Indicator 图示">
</div>

## 交互

指标卡 (Indicator) 组件提供了交互能力，随着用户 hover/click 的图元不同，指标卡的内容可以动态进行更新。通过配置触发方式，你可以定制指标卡在图表元素被鼠标悬停或点击等操作时的变化。

```ts
{
  indicator: {
    trigger: 'hover',
  }
}
```

## 示例

### 带指标卡的饼图

在这个示例中，我们使用了 `indicator` 配置来实现指标卡组件。现分析这个配置的详细内容：

1.  `visible: true`：指标卡可见。
2.  `trigger: 'hover'`：指定当鼠标悬停在图表上时更新指标卡数据。
3.  `limitRatio 0.4`：指定指标卡宽度占整个饼图宽度的最大比例。
4.  `title` 对象：指标卡的标题。其中：
    - `visible: true`：指定标题可见。
    - `autoFit true`：指定标题自动适应指标卡宽度。
    - `style` 对象：配置标题的样。包括字体、颜色等。
    - `text` 匿名函数：通过动态生成标题文本。
5.  `content` 数组：配置指标卡的内容。其中：
    - `visible: true`：指定内容可见。
    - `style` 对象：配置内容的样式包括文本内容、字体、颜色等。
    - `text` 匿名函数：通过数据动态生成内容文本。

通过以上配置，成功实现了一个带指标卡的饼图。以下是饼图实际效果的示例图片：

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  indicator: {
    visible: true,
    trigger: 'hover',
    limitRatio: 0.4,
    title: {
      visible: true,
      autoFit: true,
      style: {
        fontWeight: 'bolder',
        fontFamily: 'Times New Roman',
        fill: '#888',
        text: datum => {
          const d = datum ?? data[0];
          return d['formula'];
        }
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 20,
          fill: 'orange',
          fontWeight: 'bolder',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['type'];
          }
        }
      },
      {
        visible: true,
        style: {
          fontSize: 18,
          fill: 'orange',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['value'] + '%';
          }
        }
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'left',
    item: {
      shape: {
        style: {
          symbolType: 'circle',
          texture: datum => datum['texture']
        }
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```
