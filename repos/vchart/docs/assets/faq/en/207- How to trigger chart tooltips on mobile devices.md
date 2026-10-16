---
title: How to trigger chart tooltips on the mobile end?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to trigger chart tooltips on the mobile end?</br>
## Description

Users who want to view the tip of a chart need to long press on the graphic to trigger it on their mobile phone. </br>
This interaction is not conducive to users using charts, and a better interaction would be to show tips through clicking.</br>
## Solution

Different chart libraries have different solutions. VChart's `tooltip` provides `trigger` configuration and supports the triggering forms of `hover` and `click`.</br>
In the mobile end, you can set `trigger: true` for a better interaction experience.</br>
In addition, there is a `triggerOff` configuration that controls how tooltips are hidden.</br>
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
## Result

Online Demo: https://codesandbox.io/p/sandbox/vchart-tooltip-trigger-s6359y</br>
## Related Documentation

VChart Tooltip API: https://visactor.io/vchart/option/barChart#tooltip</br>
Github: https://github.com/VisActor/VChart</br>