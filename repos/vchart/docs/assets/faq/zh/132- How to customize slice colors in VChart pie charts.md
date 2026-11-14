---
title: 94. VChart 饼图如何自定义扇形颜色</br>
---
## 问题标题

饼图如何自定义扇形颜色？</br>
## 问题描述

我有一个饼图， 不想指定 domain，让颜色从从 range 中遍历，反复使用， 该怎么处理？</br>
## 解决方案 

不同图表库的解决方案不一样，VChart 提供`ordinal color`功能， 用于自定义颜色。</br>
`color.range`用于定义一个颜色序列， 图表会自动为每一个扇形图元分配颜色， 当颜色数量不足时， 则会循环分配， 在`ordinal color`内， `range`是离散的。 </br>
`color.domain` 用于定义输入数据映射到颜色比例尺的数据值范围。在`ordinal color`内， `domain`是离散的。 </br>
## 代码示例  

```
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

import VChart from "@visactor/vchart";

const App = () => {
  useEffect(() => {
    const spec = {
      type: 'pie',
      data: [
        {
          id: 'id0',
          values: [
            { type: 'oxygen', value: '46.60' },
            { type: 'silicon', value: '27.72' },
            { type: 'aluminum', value: '8.13' },
            { type: 'iron', value: '5' },
            { type: 'calcium', value: '3.63' },
            { type: 'sodium', value: '2.83' },
            { type: 'potassium', value: '2.59' },
            { type: 'others', value: '3.5' }
          ]
        }
      ],
      outerRadius: 0.8,
      innerRadius: 0.5,
      padAngle: 0.6,
      valueField: 'value',
      categoryField: 'type',
      color: {
        type: 'ordinal',
        // optional domain
        // domain: [
        //   "oxygen",
        //   "silicon",
        //   "aluminum",
        //   "iron",
        //   "calcium",
        //   "sodium",
        //   "potassium",
        //   "others"
        // ],
        range: [
          "red",
          "green",
          "blue",
        ]
      },
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
        text: 'Statistics of Surface Element Content'
      },
      legends: {
        visible: true,
        orient: 'left'
      },
      label: {
        visible: true
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
    const vchart = new VChart(spec, { dom: "chart" });
    vchart.renderSync();

    return () => {
      vchart.release();
    };
  }, []);

  return <div id="chart" style={{ width: 400 }}></div>;
};

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
</br>
```
## 结果展示 

Online Demo: https://codesandbox.io/p/sandbox/vchart-large-tooltip-optimize-forked-q6kr7p</br>
## 相关文档

Ordinal Color API: https://visactor.io/vchart/option/bar3dChart#color.type.ordinal</br>
Github: https://github.com/VisActor/VChart</br>