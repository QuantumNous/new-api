---
title: 95. How to format Tooltip in Radar charts, using VChart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to format Tooltip in Radar charts?</br>
## Description

The data in the chart contains very long strings, and in this case, the default `tooltip` display effect is not good, so its display effect needs to be optimized.</br>
## Solution

Solutions to different chart libraries vary. The `tooltip` component in VChart allows users to custom configure both `key` and `value`, providing the flexibility to customize the tooltip information of chart elements and dimensions.</br>
In long-text scenarios, typically only the formatting capabilities are needed to format the indicators and abbreviate the dimensions.</br>
1. Configure `tooltip.mark.content` to format the `value` and `key` in the chart element's `tooltip` respectively.</br>
2. Configure `tooltip.dimension.content` to format the `value` and `key` in the dimension's `tooltip` respectively.</br>
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
## Result

Online Demo: https://codesandbox.io/p/sandbox/vchart-pie-ordinal-color-forked-xpvnrq</br>
## Related Documentation

Tooltip API: https://visactor.io/vchart/option/barChart#tooltip.mark.content(Object%7CObject%5B%5D)</br>
Github: https://github.com/VisActor/VChart</br>