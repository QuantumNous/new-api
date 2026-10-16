---
title: 51. How to limit Tootlip content width using VChart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to limit Tootlip content width</br>
## Description

The data in the chart has very long strings. In this case, the default `tooltip` display effect is not good, and its display effect needs to be optimized.</br>
## Solution

Solutions of different chart libraries vary. VChart's `tooltip` component allows users to customize the prompt information of the chart elements and dimensions by providing custom configurations for the `key` and `value`. In scenarios involving long texts, typically, just the formatting capabilities are required to format the indicators and abbreviate the dimensions. </br>
Here are the steps:</br>
1. Configure `tooltip.mark.content` to format the `value` and `key` in the chart element `tooltip` respectively.</br>
2. Configure `tooltip.dimension.content` to format the `value` and `key` in the dimension `tooltip` respectively.</br>
## Code Example

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
## Result

Online Demo: https://codesandbox.io/p/sandbox/vchart-large-tooltip-optimize-z5jpdn?file=%2Fsrc%2Findex.js%3A1%2C1-83%2C1</br>
## Related Documentation

Tooltip API: https://visactor.io/vchart/option/barChart#tooltip.mark.content(Object%7CObject%5B%5D)</br>
Tooltip Demo: https://visactor.io/vchart/demo/tooltip/format-method</br>
Github: https://github.com/VisActor/VChart</br>