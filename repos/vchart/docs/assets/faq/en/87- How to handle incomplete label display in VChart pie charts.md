---
title: 93. How to solve the problem of pie chart labels not being fully displayed using VChart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to solve the pie chart labels not being fully displayed using VChart?</br>
## Description

When using a VChart pie chart label is hidden when the chart is narrow, I want it to be displayed without being hidden.</br>
## Solution

The solutions for different chart libraries are different. In the case of VChart, the width of the chart is not enough to layout the labels. You can try the following solutions:</br>
1. Adjust the sector radius `outerRadius` to reserve more space.</br>
2. Adjust the spacing between the text and the connection line `spaceWidth`.</br>
3. Adjust the label connection line configuration `line.line1MinLength`, `line.line2MinLength`, hide the connection line or set a shorter connection line length.</br>
4. Other solutions: set a smaller `fontSize`, or use internal labels, etc.</br>
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
      type: "pie",
      data: [
        {
          id: "id0",
          values: [
            { type: "oxygen", value: "46.60" },
            { type: "silicon", value: "27.72" },
            { type: "aluminum", value: "8.13" },
            { type: "iron", value: "5" },
            { type: "calcium", value: "3.63" },
            { type: "sodium", value: "2.83" },
            { type: "potassium", value: "2.59" },
            { type: "others", value: "3.5" },
          ],
        },
      ],
      outerRadius: 0.8,
      // Option 1: Set a smaller radius
      // outerRadius: 0.4,
      valueField: "value",
      categoryField: "type",
      title: {
        visible: true,
        text: "Statistics of Surface Element Content",
      },
      legends: {
        visible: true,
        orient: "bottom",
      },
      label: {
        visible: true,
        // Option2: Set a smaller space between text and line
        // spaceWidth: 0,

        // Option3: Set a smaller line1MinLength and line2MinLength for label line.
        // line: {
        //   visible: false, // `true` may be better
        //   line1MinLength: 0,
        //   line2MinLength: 0,
        // },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum["type"],
              value: (datum) => datum["value"] + "%",
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
## Result

Online Demo: https://codesandbox.io/p/sandbox/vchart-large-tooltip-optimize-forked-k9vg2w?file=%2Fsrc%2Findex.js%3A1%2C1-80%2C1</br>
## Related Documentation

PIE API: https://visactor.io/vchart/option/pieChart#label.line.line1MinLength</br>
Github: https://github.com/VisActor/VChart</br>