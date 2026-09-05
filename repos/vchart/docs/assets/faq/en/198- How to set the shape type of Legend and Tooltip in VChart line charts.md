---
title: 96. How to set the shape type of Legend and Tooltip for a line chart, using VChart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to set the shape type of Legend and Tooltip for a line chart?</br>
## Description

The default legend shape of the line chart and the default shape in the Tooltip are both circles. How to change their styles?</br>
## Solution

The solutions to different chart libraries are different. </br>
VChart's `tooltip` component and `legend` component provide the function of controlling the icon shape.</br>
The icon of `legend` is a standard mark element, and its shape and style can be configured through `shape.style`. </br>
`tooltip` provides a similar icon style. Due to the implementation of HTML and Canvas in `tooltip`, the supported style functions are slightly less.</br>


Supported Shape Type：</br>
`'circle'`, `'cross'`, `'diamond'`, `'square'`, `'arrow'`, `'arrow2Left'`, `'arrow2Right'`, `'wedge'`, `'thinTriangle'`, `'triangle'`, `'triangleUp'`, `'triangleDown'`, `'triangleRight'`, `'triangleLeft'`, `'stroke'`, `'star'`, `'wye'`, `'rect'`, `'arrowLeft'`,`'arrowRight'`, `'rectRound'`, `'roundLine'`</br>
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
            medalType: "Gold Medals",
            count: 40,
            year: "1952",
          },
          {
            medalType: "Gold Medals",
            count: 32,
            year: "1956",
          },
          {
            medalType: "Gold Medals",
            count: 34,
            year: "1960",
          },
          {
            medalType: "Gold Medals",
            count: 36,
            year: "1964",
          },
          {
            medalType: "Gold Medals",
            count: 45,
            year: "1968",
          },
          {
            medalType: "Gold Medals",
            count: 33,
            year: "1972",
          },
          {
            medalType: "Gold Medals",
            count: 34,
            year: "1976",
          },
          {
            medalType: "Gold Medals",
            count: null,
            year: "1980",
          },
          {
            medalType: "Gold Medals",
            count: 83,
            year: "1984",
          },
          {
            medalType: "Gold Medals",
            count: 36,
            year: "1988",
          },
          {
            medalType: "Gold Medals",
            count: 37,
            year: "1992",
          },
          {
            medalType: "Gold Medals",
            count: 44,
            year: "1996",
          },
          {
            medalType: "Gold Medals",
            count: 37,
            year: "2000",
          },
          {
            medalType: "Gold Medals",
            count: 35,
            year: "2004",
          },
          {
            medalType: "Gold Medals",
            count: 36,
            year: "2008",
          },
          {
            medalType: "Gold Medals",
            count: 46,
            year: "2012",
          },
          {
            medalType: "Silver Medals",
            count: 19,
            year: "1952",
          },
          {
            medalType: "Silver Medals",
            count: 25,
            year: "1956",
          },
          {
            medalType: "Silver Medals",
            count: 21,
            year: "1960",
          },
          {
            medalType: "Silver Medals",
            count: 26,
            year: "1964",
          },
          {
            medalType: "Silver Medals",
            count: 28,
            year: "1968",
          },
          {
            medalType: "Silver Medals",
            count: 31,
            year: "1972",
          },
          {
            medalType: "Silver Medals",
            count: 35,
            year: "1976",
          },
          {
            medalType: "Silver Medals",
            count: null,
            year: "1980",
          },
          {
            medalType: "Silver Medals",
            count: 60,
            year: "1984",
          },
          {
            medalType: "Silver Medals",
            count: 31,
            year: "1988",
          },
          {
            medalType: "Silver Medals",
            count: 34,
            year: "1992",
          },
          {
            medalType: "Silver Medals",
            count: 32,
            year: "1996",
          },
          {
            medalType: "Silver Medals",
            count: 24,
            year: "2000",
          },
          {
            medalType: "Silver Medals",
            count: 40,
            year: "2004",
          },
          {
            medalType: "Silver Medals",
            count: 38,
            year: "2008",
          },
          {
            medalType: "Silver Medals",
            count: 29,
            year: "2012",
          },
          {
            medalType: "Bronze Medals",
            count: 17,
            year: "1952",
          },
          {
            medalType: "Bronze Medals",
            count: 17,
            year: "1956",
          },
          {
            medalType: "Bronze Medals",
            count: 16,
            year: "1960",
          },
          {
            medalType: "Bronze Medals",
            count: 28,
            year: "1964",
          },
          {
            medalType: "Bronze Medals",
            count: 34,
            year: "1968",
          },
          {
            medalType: "Bronze Medals",
            count: 30,
            year: "1972",
          },
          {
            medalType: "Bronze Medals",
            count: 25,
            year: "1976",
          },
          {
            medalType: "Bronze Medals",
            count: null,
            year: "1980",
          },
          {
            medalType: "Bronze Medals",
            count: 30,
            year: "1984",
          },
          {
            medalType: "Bronze Medals",
            count: 27,
            year: "1988",
          },
          {
            medalType: "Bronze Medals",
            count: 37,
            year: "1992",
          },
          {
            medalType: "Bronze Medals",
            count: 25,
            year: "1996",
          },
          {
            medalType: "Bronze Medals",
            count: 33,
            year: "2000",
          },
          {
            medalType: "Bronze Medals",
            count: 26,
            year: "2004",
          },
          {
            medalType: "Bronze Medals",
            count: 36,
            year: "2008",
          },
          {
            medalType: "Bronze Medals",
            count: 29,
            year: "2012",
          },
        ],
      },
      xField: "year",
      yField: "count",
      seriesField: "medalType",
      invalidType: "link",
      tooltip: {
        dimension: {
          shapeType: "roundLine",
        },
      },
      legends: {
        visible: true,
        type: "discrete",
        item: {
          shape: {
            style: {
              symbolType: "roundLine",
            },
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

Online Demo: https://codesandbox.io/p/sandbox/vchart-pie-ordinal-color-forked-4qxnzf</br>
## Related Documentation

Legend Shape API: https://visactor.io/vchart/option/lineChart-legends-discrete#item.shape.style.symbolType</br>
Tooltip Shape API: https://visactor.io/vchart/option/lineChart#tooltip.dimension.shapeType</br>
Github: https://github.com/VisActor/VChart</br>