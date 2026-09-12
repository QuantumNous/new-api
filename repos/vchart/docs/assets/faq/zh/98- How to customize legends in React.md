---
title: 48. 如何以 React 的方式， 自定义图例？</br>
---
## 问题标题

如何以 React 的方式， 自定义图例？</br>
## 问题描述

很多场景下， 需要让图例拥有更丰富的效果， 例如在长图例存在时， 添加...缩略， 并提供 Tooltip， 通常情况下， 图表库默认提供的图例功能， 并不能完美满足用户的需求。</br>
## 解决方案 

不同图表库的解决方案不一样， VChart 对图例功能进行了抽象， 提供`getLegendSelectedDataByIndex` 与 `setLegendSelectedDataByIndex` 接口， 让用户通过`html` 自定义图例， 实现预期的效果。</br>
可以迅速使用 react 将自定义 VChart 图表的图例。</br>
步骤一： 将图例配置设置为不可见， 即`visible: false`</br>
步骤二： 通过`getLegendSelectedDataByIndex` 判断图例需要选中或取消选中</br>
步骤三： 通过`setLegendSelectedDataByIndex` 使用 API 操作图例的选中或取消。</br>
## 代码示例  

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
## 结果展示 

Online Demo: https://codesandbox.io/p/sandbox/vchart-react-tooltip-df558t?file=%2Fsrc%2Findex.js%3A58%2C1</br>
## 相关文档

Legend Event API: https://visactor.io/vchart/api/API/vchart</br>
Github: https://github.com/VisActor/VChart</br>