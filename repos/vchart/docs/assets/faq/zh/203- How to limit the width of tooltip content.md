---
title: 51. 如何限制 Tootlip 内容宽度？</br>
---
## 问题标题

如何限制 Tootlip 内容宽度</br>
## 问题描述

图表中的数据存在非常长的字符串， 这种场景下， 默认`tooltip`的展示效果并不好， 需要优化其显示效果</br>
## 解决方案 

不同图表库的解决方案不一样，VChart 的`tooltip`组件， 提供了对`key`与`value`的自定义配置， 允许用户对图元和维度的提示信息， 进行自定义设置。 </br>
在超长文本场景， 通常情况下只需要使用格式化能力， 对指标进行格式化， 对维度进行缩略显示。</br>
步骤一： 配置`tooltip.mark.content`， 分别对 图元`tooltip`中的`value` 和 `key`进行格式化。</br>
步骤二： 配置`tooltip.dimension.content`， 分别对维度`tooltip`中的`value`和`key`进行格式化。</br>
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
            {
              month: "Monday",
              sales: 22,
              type: "LongLong",
            },
            { month: "Tuesday", sales: 13, type: "LongLongLongLong" },
            { month: "Wednesday", sales: 25, type: "LongLongLongLongLongLong" },
            {
              month: "Thursday",
              sales: 29,
              type: "LongLongLongLongLongLongLongLong",
            },
            {
              month: "Friday",
              sales: 38,
              type: "LongLongLongLongLongLongLongLongLongLong",
            },
          ],
        },
      ],
      seriesField: "type",
      xField: "month",
      yField: "sales",
      tooltip: {
        mark: {
          position: "bottom",
          content: [
            {
              key: (datum) =>
                datum.type.length < 20
                  ? datum.type
                  : datum.type.slice(0, 20) + "...",
              value: (datum) => datum.sales,
            },
          ],
        },
        dimension: {
          visible: false,
          content: [
            {
              key: (datum) =>
                datum.type.length < 20
                  ? datum.type
                  : datum.type.slice(0, 20) + "...",
              value: (datum) => datum.sales,
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

Online Demo: https://codesandbox.io/p/sandbox/vchart-large-tooltip-optimize-z5jpdn?file=%2Fsrc%2Findex.js%3A1%2C1-83%2C1</br>
## 相关文档

Tooltip API: https://visactor.io/vchart/option/barChart#tooltip.mark.content(Object%7CObject%5B%5D)</br>
Tooltip Demo: https://visactor.io/vchart/demo/tooltip/format-method</br>
Github: https://github.com/VisActor/VChart</br>