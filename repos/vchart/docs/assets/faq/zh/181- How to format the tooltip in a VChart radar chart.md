---
title: 95. VChart 雷达图如何格式化Tooltip?</br>
---
## 问题标题

雷达图如何格式化Tooltip?</br>
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
      type: "radar",
      data: [
        {
          values: [
            {
              month: "Jan.",
              value: 45,
              type: "A",
            },
            {
              month: "Feb.",
              value: 61,
              type: "A",
            },
            {
              month: "Mar.",
              value: 92,
              type: "A",
            },
            {
              month: "Apr.",
              value: 57,
              type: "A",
            },
            {
              month: "May.",
              value: 46,
              type: "A",
            },
            {
              month: "Jun.",
              value: 36,
              type: "A",
            },
            {
              month: "Jul.",
              value: 33,
              type: "A",
            },
            {
              month: "Aug.",
              value: 63,
              type: "A",
            },
            {
              month: "Sep.",
              value: 57,
              type: "A",
            },
            {
              month: "Oct.",
              value: 53,
              type: "A",
            },
            {
              month: "Nov.",
              value: 69,
              type: "A",
            },
            {
              month: "Dec.",
              value: 40,
              type: "A",
            },
            {
              month: "Jan.",
              value: 31,
              type: "B",
            },
            {
              month: "Feb.",
              value: 39,
              type: "B",
            },
            {
              month: "Mar.",
              value: 81,
              type: "B",
            },
            {
              month: "Apr.",
              value: 39,
              type: "B",
            },
            {
              month: "May.",
              value: 64,
              type: "B",
            },
            {
              month: "Jun.",
              value: 21,
              type: "B",
            },
            {
              month: "Jul.",
              value: 58,
              type: "B",
            },
            {
              month: "Aug.",
              value: 72,
              type: "B",
            },
            {
              month: "Sep.",
              value: 47,
              type: "B",
            },
            {
              month: "Oct.",
              value: 37,
              type: "B",
            },
            {
              month: "Nov.",
              value: 80,
              type: "B",
            },
            {
              month: "Dec.",
              value: 74,
              type: "B",
            },
            {
              month: "Jan.",
              value: 90,
              type: "C",
            },
            {
              month: "Feb.",
              value: 95,
              type: "C",
            },
            {
              month: "Mar.",
              value: 62,
              type: "C",
            },
            {
              month: "Apr.",
              value: 52,
              type: "C",
            },
            {
              month: "May.",
              value: 74,
              type: "C",
            },
            {
              month: "Jun.",
              value: 87,
              type: "C",
            },
            {
              month: "Jul.",
              value: 80,
              type: "C",
            },
            {
              month: "Aug.",
              value: 69,
              type: "C",
            },
            {
              month: "Sep.",
              value: 74,
              type: "C",
            },
            {
              month: "Oct.",
              value: 84,
              type: "C",
            },
            {
              month: "Nov.",
              value: 94,
              type: "C",
            },
            {
              month: "Dec.",
              value: 23,
              type: "C",
            },
          ],
        },
      ],
      categoryField: "month",
      valueField: "value",
      seriesField: "type",
      stack: true,
      percent: true,
      area: {
        visible: true, // show area
      },
      axes: [
        {
          orient: "radius",
          min: 0,
          domainLine: {
            visible: true,
          },
          label: {
            visible: true,
            formatMethod: (val) => {
              return val * 100 + "%";
            },
          },
          grid: {
            smooth: false,
            style: {
              lineDash: [0],
            },
          },
        },
        {
          orient: "angle",
          tick: {
            visible: false,
          },
          domainLine: {
            visible: false,
          },
          grid: {
            style: {
              lineDash: [0],
            },
          },
        },
      ],
      legends: {
        visible: true,
        orient: "top",
      },
      tooltip: {
        mark: {
          title: {
            value: "Mark Title",
          },
          content: [
            {
              key: "key",
              value: "value",
            },
            {
              key: (datum) => `${datum.type}-${datum.month}`,
              value: (datum) => `${datum.value.toFixed(2)} k`,
            },
          ],
        },
        dimension: {
          title: {
            value: "Dimension Radar Title",
          },
          content: [
            {
              key: "key",
              value: "value",
            },
            {
              key: (datum) => `${datum.type}-${datum.month}`,
              value: (datum) => `${datum.value.toFixed(2)} k`,
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

Online Demo: https://codesandbox.io/p/sandbox/vchart-pie-ordinal-color-forked-xpvnrq</br>
## 相关文档

Tooltip API: https://visactor.io/vchart/option/barChart#tooltip.mark.content(Object%7CObject%5B%5D)</br>
Github: https://github.com/VisActor/VChart</br>