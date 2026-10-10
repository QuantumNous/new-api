---
title: 50. 如何为柱状图每根柱子设置不同颜色？</br>
---
## 问题标题

如何为柱状图每根柱子设置不同颜色</br>
## 问题描述

柱状图需要给每个柱子设置不一样的颜色</br>
## 解决方案 

不同图表库的解决方案不一样，这本质上是将不同的数据映射到图形的颜色， VChart 提供 seriesField 配置，用户可以指定划分系列的分组字段， 从而对图形进行分组， 分组后的图形， 同组的内容会使用相同的颜色绘制， 不同组的内容， 会使用不同的颜色绘制。 </br>
步骤一： 用户需要在数据准备好需要分组的信息， 通常是给每一项数据增加一个特定的属性</br>
步骤二： 设置`seriesField`</br>
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
            { month: "Monday", sales: 22, index: 0 },
            { month: "Tuesday", sales: 13, index: 1 },
            { month: "Wednesday", sales: 25, index: 2 },
            { month: "Thursday", sales: 29, index: 3 },
            { month: "Friday", sales: 38, index: 4 },
          ],
        },
      ],
      seriesField: "index",
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

Online Demo: https://codesandbox.io/p/sandbox/vchart-bar-seriesfield-rqxv2d?file=%2Fsrc%2Findex.js%3A1%2C1-45%2C1</br>
## 相关文档

SeriesField API: https://visactor.io/vchart/option/barChart#seriesField</br>
Github: https://github.com/VisActor/VChart</br>