---
title: 98. How to set a dashed line in a line chart, using VChart? </br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to set a dashed line in a line chart?</br>
## Description

In certain scenarios, line charts may need to convey information like "total" and "forecast", in which case a single line may need to be styled differently to visualize these special messages. Changing the line chart to a dashed style is a great solution.</br>
## Solution

Different chart libraries have different solutions. The line chart provided by VChart offers `lineDash` configuration, allowing users to control the style of a section of the line as a dashed line by setting a callback function, as well as other styles.</br>
The dashed line of a line chart can be controlled based on the configuration of `line.style.lineDash`.</br>
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
## Result

Online Demo: https://codesandbox.io/p/sandbox/vchart-single-bar-style-forked-86hvzw</br>
## Related Documentation

LineDash API: https://visactor.io/vchart/option/lineChart#line.style.lineDash(number%5B%5D)</br>
Github: https://github.com/VisActor/VChart</br>