---
title: 94. How to customize the sector color of a pie chart using VChart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to customize the sector color of a pie chart ?</br>
## Description

I have a pie chart and I don't want to specify a domain. Instead, I want the colors to iterate from the range and be reused. How should I handle this?</br>
## Solution

Solutions vary among different chart libraries. </br>
VChart offers the 'ordinal color feature for customizing colors. </br>
*  `color.range` is used to define a color sequence, and the chart automatically assigns colors to each pie slice. When there are insufficient colors, they are recycled. Within `ordinal color`, `range` is discrete. </br>
*  `color.domain` is used to define the data value range that inputs data maps to the color scale. Within `ordinal color`, `domain` is discrete.</br>
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
      type: 'pie',
      data: [
        {
          id: 'id0',
          values: [
            { type: 'oxygen', value: '46.60' },
            { type: 'silicon', value: '27.72' },
            { type: 'aluminum', value: '8.13' },
            { type: 'iron', value: '5' },
            { type: 'calcium', value: '3.63' },
            { type: 'sodium', value: '2.83' },
            { type: 'potassium', value: '2.59' },
            { type: 'others', value: '3.5' }
          ]
        }
      ],
      outerRadius: 0.8,
      innerRadius: 0.5,
      padAngle: 0.6,
      valueField: 'value',
      categoryField: 'type',
      color: {
        type: 'ordinal',
        // optional domain
        // domain: [
        //   "oxygen",
        //   "silicon",
        //   "aluminum",
        //   "iron",
        //   "calcium",
        //   "sodium",
        //   "potassium",
        //   "others"
        // ],
        range: [
          "red",
          "green",
          "blue",
        ]
      },
      pie: {
        style: {
          cornerRadius: 10
        },
        state: {
          hover: {
            outerRadius: 0.85,
            stroke: '#000',
            lineWidth: 1
          },
          selected: {
            outerRadius: 0.85,
            stroke: '#000',
            lineWidth: 1
          }
        }
      },
      title: {
        visible: true,
        text: 'Statistics of Surface Element Content'
      },
      legends: {
        visible: true,
        orient: 'left'
      },
      label: {
        visible: true
      },
      tooltip: {
        mark: {
          content: [
            {
              key: datum => datum['type'],
              value: datum => datum['value'] + '%'
            }
          ]
        }
      }
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

Online Demo: https://codesandbox.io/p/sandbox/vchart-large-tooltip-optimize-forked-q6kr7p</br>
## Related documentation

Ordinal Color API: https://visactor.io/vchart/option/bar3dChart#color.type.ordinal</br>
Github: https://github.com/VisActor/VChart</br>