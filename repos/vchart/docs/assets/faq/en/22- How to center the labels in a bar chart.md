---
title: 15. How to center the label of a bar chart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question 

How to center the label of a bar chart?</br>
## Description

In a stacked bar chart, it is expected that each label will be centered.</br>
## Solution

Different chart libraries have different solutions. VChart provides label configuration options and supports various postion configurations.</br>
Optional  values are: `'outside'`、`'top'`、`'bottom'`、`'left'`、`'right'`、`'inside'`、`'inside-top'`、`'inside-bottom'`、`'inside-right'`·`'inside-left'`、`'top-right'`、`'top-left'`、`'bottom-right'`、`'bottom-left'`</br>
## Code example

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
      label: {
        visible: true,
        position: "inside",
      },
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

  return <div id="chart"></div>;
};

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);</br>
```
## Results show

Online Demo: https://codesandbox.io/p/sandbox/vchart-label-center-cz7wjm?file=%2Fsrc%2Findex.js%3A1%2C1-70%2C1</br>
## Related Documents

Label API: https://visactor.io/vchart/option/barChart#label</br>
Github: https://github.com/VisActor/VChart</br>