---
title: 93. VChart 饼图label显示不全, 该如何处理?</br>
---
## 问题标题

VChart 饼图label显示不全, 该如何处理?</br>
## 问题描述

在使用VChart 饼图过程中, 图表比较窄时label会被隐藏，, 我想要其不被隐藏正常展示</br>
## 解决方案 

不同图表库的解决方案不一样，VChart图表宽度不够导致标签无法布局，这种情况下</br>
1. 通过调整扇区半径`outerRadius`, 预留更多的空间出来.</br>
1. 通过调整文字与连接线的间隔`spaceWidth`</br>
1. 调整一下标签连接线配置`line.line1MinLength` 、`line.line2MinLength`，隐藏连接线或者设置较短的连接线长度.</br>
1. 其它方式: 缩小文字fontSize、使用内部标签等</br>
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
      type: "pie",
      data: [
        {
          id: "id0",
          values: [
            { type: "oxygen", value: "46.60" },
            { type: "silicon", value: "27.72" },
            { type: "aluminum", value: "8.13" },
            { type: "iron", value: "5" },
            { type: "calcium", value: "3.63" },
            { type: "sodium", value: "2.83" },
            { type: "potassium", value: "2.59" },
            { type: "others", value: "3.5" },
          ],
        },
      ],
      outerRadius: 0.8,
      // Option 1: Set a smaller radius
      // outerRadius: 0.4,
      valueField: "value",
      categoryField: "type",
      title: {
        visible: true,
        text: "Statistics of Surface Element Content",
      },
      legends: {
        visible: true,
        orient: "bottom",
      },
      label: {
        visible: true,
        // Option2: Set a smaller space between text and line
        // spaceWidth: 0,

        // Option3: Set a smaller line1MinLength and line2MinLength for label line.
        // line: {
        //   visible: false, // `true` may be better
        //   line1MinLength: 0,
        //   line2MinLength: 0,
        // },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum["type"],
              value: (datum) => datum["value"] + "%",
            },
          ],
        },
      },
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

Online Demo: https://codesandbox.io/p/sandbox/vchart-large-tooltip-optimize-forked-k9vg2w?file=%2Fsrc%2Findex.js%3A1%2C1-80%2C1</br>
## 相关文档

PIE API: https://visactor.io/vchart/option/pieChart#label.line.line1MinLength</br>
Github: https://github.com/VisActor/VChart</br>