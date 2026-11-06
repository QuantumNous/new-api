---
title: 98. 折线图如何设置一段虚线？</br>
---
## 问题标题

折线图如何设置一段虚线？</br>
## 问题描述

在特定场景下， 折线图可能需要表达“总计”， “预测”等信息， 这时候一条折线可能需要用另外一种样式来可视化这些特殊的信息， 将折线图改为虚线样式， 是一个很不错的方案。</br>
## 解决方案 

不同图表库的解决方案不一样，VChart 折线图提供 lineDash 配置， 允许用户通过设置回调函数控制一截线段的样式为虚线， 也包括其它的一些样式。</br>


折线图可以通过配置`line.style.lineDash`来根据控制虚线。</br>
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
      type: "line",
      data: {
        values: [
          {
            x: "1st",
            y: 0.012,
          },
          {
            x: "2nd",
            y: -0.01,
          },
          {
            x: "3rd",
            y: 0.005,
          },
          {
            x: "4th",
            y: 0.007,
          },
          {
            x: "5th",
            y: 0.01,
          },
          {
            x: "6th",
            y: 0.017,
          },
          {
            x: "7th",
            y: 0.022,
          },
          {
            x: "8th (prediction)",
            y: 0.033,
            isDash: true,
          },
        ],
      },
      xField: "x",
      yField: "y",
      line: {
        style: {
          lineDash: (data) => {
            if (data.isDash) {
              return [5, 5];
            }
            return [0];
          },
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

Online Demo: https://codesandbox.io/p/sandbox/vchart-single-bar-style-forked-86hvzw</br>
## 相关文档

LineDash API: https://visactor.io/vchart/option/lineChart#line.style.lineDash(number%5B%5D)</br>
Github: https://github.com/VisActor/VChart</br>