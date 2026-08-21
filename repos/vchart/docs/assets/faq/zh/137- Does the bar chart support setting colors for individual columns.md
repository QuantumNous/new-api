---
title: 97. 柱状图支持对某一列单独设置颜色吗？</br>
---
## 问题标题

柱状图支持对某一列单独设置颜色吗？</br>
## 问题描述

想单独设置某一个柱子的颜色， 该如何实现？</br>
## 解决方案 

不同图表库的解决方案不一样，VChart 的允许用户通过回调函数的方式控制样式， 包括颜色、描边等多种样式配置。</br>
柱状图可以通过配置`bar.style.fill`来根据控制颜色， `fill`支持配置回调函数， 可以通过 datum 对某一个柱子进行样式修改， 其余数据可以通过`seriesColor`接口， 获取到原始的分组颜色。</br>
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
            { type: "Autocracies", year: "1930", value: 129 },
            { type: "Autocracies", year: "1940", value: 133 },
            { type: "Autocracies", year: "1950", value: 130 },
            { type: "Autocracies", year: "1960", value: 126 },
            { type: "Autocracies", year: "1970", value: 117 },
            { type: "Autocracies", year: "1980", value: 114 },
            { type: "Autocracies", year: "1990", value: 111 },
            { type: "Autocracies", year: "2000", value: 89 },
            { type: "Autocracies", year: "2010", value: 80 },
            { type: "Autocracies", year: "2018", value: 80 },
            { type: "Democracies", year: "1930", value: 22 },
            { type: "Democracies", year: "1940", value: 13 },
            { type: "Democracies", year: "1950", value: 25 },
            { type: "Democracies", year: "1960", value: 29 },
            { type: "Democracies", year: "1970", value: 38 },
            { type: "Democracies", year: "1980", value: 41 },
            { type: "Democracies", year: "1990", value: 57 },
            { type: "Democracies", year: "2000", value: 87 },
            { type: "Democracies", year: "2010", value: 98 },
            { type: "Democracies", year: "2018", value: 99 },
          ],
        },
      ],
      xField: ["year", "type"],
      yField: "value",
      seriesField: "type",
      bar: {
        style: {
          fill: (datum, chart) => {
            if (datum["year"] === "2000") {
              return "red";
            }
            // origin color
            return chart.seriesColor(datum["type"]);
          },
        },
      },
      legends: {
        visible: true,
        orient: "top",
        position: "start",
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

Online Demo: https://codesandbox.io/p/sandbox/vchart-single-bar-style-n9m6np?file=%2Fsrc%2Findex.js%3A7%2C39</br>
## 相关文档

Bar Style API: https://visactor.io/vchart/option/barChart#bar.style.fill</br>
Github: https://github.com/VisActor/VChart</br>