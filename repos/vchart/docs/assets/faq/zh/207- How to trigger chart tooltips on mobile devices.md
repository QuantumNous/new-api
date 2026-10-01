---
title: 47. 如何在移动端触发图表 tooltip？</br>
---
## 问题标题

如何在移动端触发图表 tooltip？</br>
## 问题描述

移动端用户， 要查看图表的 tooltip， 需要在图元处长按， 才能触发。 这样的交互不利于用户使用图表， 更好的形式应该是点击图元时出现 tooltip。</br>


## 解决方案 

不同图表库的解决方案不一样， VChart 的 `tooltip` 提供** **`**trigger**`**配置，**支持 hover 与 click 的触发形式。</br>
在移动端， 可以设置`trigger:true`， 获得更好的交互体验。</br>
此外， 还有`triggerOff` 配置， 控制如何隐藏 tooltip。</br>
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
      type: "bar",
      data: [
        {
          id: "barData",
          values: [
            { month: "Monday", sales: 22 },
            { month: "Tuesday", sales: 13 },
            { month: "Wednesday", sales: 25 },
            { month: "Thursday", sales: 29 },
            { month: "Friday", sales: 38 },
          ],
        },
      ],
      tooltip: {
        // hover | click
        trigger: "click",
        // hover | click | none
        triggerOff: "none",
      },
      xField: "month",
      yField: "sales",
    };
    const vchart = new VChart(spec, { dom: "chart" });
    vchart.renderSync();

    return () => {
      vchart.release();
    };
  }, []);

  return <div id="chart"></div>;
};

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
</br>
```
## 结果展示 

Online Demo: https://codesandbox.io/p/sandbox/vchart-tooltip-trigger-s6359y</br>
## 相关文档

VChart Tooltip API: https://visactor.io/vchart/option/barChart#tooltip</br>
Github: https://github.com/VisActor/VChart</br>