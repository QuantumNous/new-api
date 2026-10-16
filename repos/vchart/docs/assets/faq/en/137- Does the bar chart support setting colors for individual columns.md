---
title: 97. How to set a single column color in a bar chart, using VChart？</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to set a single column color in a bar chart?</br>
## Description

How do I set the color of a specific column independently?</br>
## Solution

Different chart libraries have different solutions. VChart allows users to control styles through callback functions, including color, stroke, and other style configurations. </br>
Bar charts can control colors by configuring `bar.style.fill`. </br>
`fill` supports callback functions, which can modify the style of a certain column through `datum`, and other data can get the original grouped colors through the `seriesColor` interface.</br>
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
## Result

Online Demo: https://codesandbox.io/p/sandbox/vchart-single-bar-style-n9m6np?file=%2Fsrc%2Findex.js%3A7%2C39</br>
## Related Documentation

Bar Style API: https://visactor.io/vchart/option/barChart#bar.style.fill</br>
Github: https://github.com/VisActor/VChart</br>