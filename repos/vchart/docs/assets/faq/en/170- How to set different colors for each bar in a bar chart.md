---
title: 50. How to set different colors for each bar in a bar chart using VChart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to set different colors for each bar in a bar chart</br>
## Description

Column charts need to set different colors for each column.</br>
## Solution

Different chart libraries have different solutions, which essentially map different data to the colors of the marks.</br>
VChart provides the `seriesField` configuration, which allows users to specify the grouping field for dividing the series, thereby grouping the marks. After grouping, the same content in the same group will be drawn with the same color and the different content in different groups will be drawn with different colors.</br>
Step 1: Users need to prepare the data and add grouping information, usually by adding a specific attribute to each data item.</br>
Step 2: Set `seriesField`.</br>
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
## Result

Online Demo: https://codesandbox.io/p/sandbox/vchart-bar-seriesfield-rqxv2d?file=%2Fsrc%2Findex.js%3A1%2C1-45%2C1</br>
## Related Documentation

SeriesField API: https://visactor.io/vchart/option/barChart#seriesField</br>
Github: https://github.com/VisActor/VChart</br>