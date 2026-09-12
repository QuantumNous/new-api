---
category: examples
group: customMark
title: 饼图扩展柱图
order: 40-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/custom-mark/pie-bar.png
option: pieChart#extensionMark
---

# 饼图扩展柱图

## 关键配置

- `extensionMark` 属性配置自定义 polygon 图元
  - `extensionMark.type` 属性配置图元的类型
  - `extensionMark.dataId` 属性配置图元的数据来源
  - `extensionMark.style` 属性配置图元的样式

## 代码演示

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  {
    type: 'silicon',
    value: '27.72',
    formula: 'Si',
    texture: 'horizontal-line'
  },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];
const pieData = [
  ...data.slice(0, 3),
  data.slice(3).reduce(
    (res, entry) => {
      res.value += Number(entry.value);

      return res;
    },
    { type: '其他', value: 0 }
  )
];
const barData = data.slice(3).map(entry => {
  return {
    ...entry,
    percent: Number(entry.value) / Number(pieData[pieData.length - 1].value)
  };
});

barData.forEach((entry, index) => {
  if (index >= 1) {
    entry.start = barData[index - 1].end;
    entry.end = barData[index - 1].end + entry.percent;
  } else {
    entry.start = 0;
    entry.end = entry.percent;
  }
});

const spec = {
  type: 'pie',
  data: [
    {
      id: 'pieData',
      values: pieData
    },
    ...barData.map((entry, index, arr) => {
      return {
        id: `barData-${index}`,
        values: [entry]
      };
    })
  ],
  name: 'pie',
  outerRadius: 0.5,
  innerRadius: 0.2,
  startAngle: 0,
  endAngle: 360,
  valueField: 'value',
  categoryField: 'type',
  pie: {
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
    text: 'Statistics of Surface Element Content'
  },

  extensionMark: [
    ...barData.map((entry, index) => {
      return {
        type: 'rect',
        id: `bar-${index}`,
        dataId: `barData-${index}`,
        visible: true,
        zIndex: 10000,
        key: 'type',
        state: {
          hover: {
            stroke: '#000'
          }
        },
        style: {
          fill: { field: 'type', scale: 'color' },
          x: (datum, ctx, elements, dataView) => {
            const rect = ctx.getRegion().getBoundsInRect();

            return rect.x2 - rect.x1 - 200;
          },
          width: (datum, ctx, elements, dataView) => {
            return 200;
          },
          y: (datum, ctx, elements, dataView) => {
            const rect = ctx.getRegion().getBoundsInRect();
            const totalHeight = rect.y2 - rect.y1;

            return totalHeight * datum.start;
          },
          height: (datum, ctx, elements, dataView) => {
            const rect = ctx.getRegion().getBoundsInRect();
            const totalHeight = rect.y2 - rect.y1;

            return totalHeight * datum.percent;
          }
        }
      };
    }),
    ...barData.map((entry, index) => {
      return {
        type: 'text',
        id: `text-${index}`,
        dataId: `barData-${index}`,
        visible: true,
        zIndex: 10001,
        key: 'type',
        style: {
          fill: 'white',
          x: (datum, ctx, elements, dataView) => {
            const rect = ctx.getRegion().getBoundsInRect();

            return rect.x2 - rect.x1 - 100;
          },

          y: (datum, ctx, elements, dataView) => {
            const rect = ctx.getRegion().getBoundsInRect();
            const totalHeight = rect.y2 - rect.y1;

            return totalHeight * datum.start + 0.5 * totalHeight * datum.percent;
          },
          text: (datum, ctx, elements, dataView) => {
            return `${datum.type}: ${datum.value} (${(datum.percent * 100).toFixed(2)}%) `;
          }
        }
      };
    }),
    {
      type: 'polygon',
      id: 'polygon',
      visible: true,
      zIndex: -1,
      key: 'type',
      style: {
        fill: 'blue',
        fillOpacity: 0.1,
        points: (datum, ctx, elements, dataView) => {
          const rect = ctx.getRegion().getBoundsInRect();
          return [
            { x: 0, y: 0 },
            { x: 0, y: 0 }
          ];
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top',
    select: false,
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
const drawJoint = instance => {
  const stage = instance.getStage();
  const arcs = stage.getElementsByType('arc');
  const rects = stage.getElementsByType('rect');
  const polygons = stage.getElementsByType('polygon');
  const lastArcAttrs = arcs[arcs.length - 1].attribute;
  const { x, y, startAngle, endAngle, outerRadius } = lastArcAttrs;
  let x1 = x + outerRadius * Math.cos(startAngle);
  let y1 = y + outerRadius * Math.sin(startAngle);
  let x2 = x + outerRadius * Math.cos(endAngle);
  let y2 = y + outerRadius * Math.sin(endAngle);

  if (y1 > y2) {
    [y1, y2] = [y2, y1];
    [x1, x2] = [x2, x1];
  }

  const x3 = rects[0].attribute.x;
  const y3 = rects[0].attribute.y;
  const x4 = rects[rects.length - 1].attribute.x;
  const y4 = rects[rects.length - 1].attribute.y + rects[rects.length - 1].attribute.height;

  polygons[0].setAttributes({
    points: [
      { x: x1, y: y1 },
      { x: x3, y: y3 },
      { x: x4, y: y4 },
      { x: x2, y: y2 }
    ]
  });
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
drawJoint(vchart);
vchart.on('animationFinished', () => {
  drawJoint(vchart);
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[自定义 mark](link)
