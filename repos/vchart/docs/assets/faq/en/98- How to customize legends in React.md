---
title: 48. How to custom VChart legend using React?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to custom VChart legend using React?</br>
## Description

In many scenarios, it is necessary to make legends more functional, such as adding abbreviations for long text and providing tooltips. Generally speaking, the legend feature provided by chart libraries by default cannot perfectly meet the needs of all users.</br>
## Solution

The solutions of different chart libraries are different. </br>
VChart provides the `getLegendSelectedDataByIndex` and `setLegendSelectedDataByIndex` interfaces by abstracting the legend function, which allows users to customize the legend through `html` and achieve the desired effect.</br>
You can quickly use `React` to apply legends to custom VChart charts. Here are the steps:</br>
1. Set the legend configuration to invisible, that is, `visible: false`;</br>
2. Use `getLegendSelectedDataByIndex` to determine if you need to select or deselect the legend;</br>
3. Use `setLegendSelectedDataByIndex` to operate the legend selection or deselection through the API.</br>
## Code Example

```
import { StrictMode, useEffect, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

import VChart from "@visactor/vchart";

const App = () => {
  const ref = useRef(null);
  const data = [
    { year: "2000", type: "A", sales: 22 },
    { year: "2000", type: "B", sales: 11 },

    { year: "2001", type: "A", sales: 22 },
    { year: "2001", type: "B", sales: 11 },
  ];
  const spec = {
    type: "bar",
    data: [
      {
        id: "barData",
        values: data,
      },
    ],
    legends: {
      visible: false,
    },
    xField: ["year", "type"],
    yField: "sales",
    seriesField: "type",
  };

  useEffect(() => {
    const vchart = new VChart(spec, { dom: "chart" });
    ref.current = vchart;
    vchart.renderSync();

    return () => {
      vchart.release();
    };
  }, []);

  const handleSelect = (value) => () => {
    const selected = ref.current.getLegendSelectedDataByIndex();

    if (selected.includes(value)) {
      // cancel
      const newSelected = [...selected];
      const index = newSelected.indexOf(value);
      newSelected.splice(index, 1);
      ref.current.setLegendSelectedDataByIndex(0, newSelected);
    } else {
      // select
      ref.current.setLegendSelectedDataByIndex(0, [...selected, value]);
    }
  };

  const customLegend = Array.from(new Set(data.map((d) => d.type))).map(
    (name) => {
      return (
        <div
          onClick={handleSelect(name)}
          style={{
            textAlign: "center",
            border: "1px solid gray",
            marginBottom: 8,
            cursor: "pointer",
          }}
        >
          {/* do any custom thing using html  */}
          {name + "...................................."}
        </div>
      );
    }
  );

  return (
    <div>
      <div id="chart"></div>
      {customLegend}
    </div>
  );
};

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
</br>
```
## Result

Online Demo: https://codesandbox.io/p/sandbox/vchart-react-tooltip-df558t?file=%2Fsrc%2Findex.js%3A58%2C1</br>
## Related Documentation

Legend Event API: https://visactor.io/vchart/api/API/vchart</br>
Github: https://github.com/VisActor/VChart</br>