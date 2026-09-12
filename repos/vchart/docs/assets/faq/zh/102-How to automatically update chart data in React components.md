# React 组件中如何自动更新图表数据？

## 问题描述

使用 React 封装的图表组件，如何实现自动更新图表数据？

## 解决方案

在 VChart 中，可以调用 updateSpec 或者 updateData 进行图表更新。
你可以在初始化图表实例时，在 React 组件中使用 ref 保存图表实例。随后使用 useEffect，将 deps 设置为数据更新的依赖项，在回调函数中调用图表实例的 updateData 实现数据更新。

VChart 还提供了 React-VChart 封装：
https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react
你可以参考下面的代码示例，使用 React-VChart 实现图表数据更新。

## 代码示例

点击 Update the data of bar chart 按钮，可以实现更新图表数据。

```javascript
import "./styles.css";
import { BarChart } from "./BarChart";
import { LineChart } from "./LineChart";
import { AreaChart } from "./AreaChart";
import { getBarData } from "./bar-data";
import { useState } from "react";

const colorMaps = {
  default: [
    "#6690F2",
    "#70D6A3",
    "#B4E6E2",
    "#63B5FC",
    "#FF8F62",
    "#FFDC83",
    "#BCC5FD",
    "#A29BFE",
    "#63C4C7",
    "#F68484"
  ],
  red: [
    "#c12e34",
    "#e6b600",
    "#0098d9",
    "#2b821d",
    "#005eaa",
    "#339ca8",
    "#cda819",
    "#32a487"
  ]
};

export default function App() {
  const [barData, setBarData] = useState<any[]>(getBarData());
  const [colors, setColors] = useState<string[]>(colorMaps.default);
  const handleUpdateBarData = () => {
    setBarData(getBarData());
  };

  const handleUpdateColors = () => {
    if (colors === colorMaps.default) {
      setColors(colorMaps.red);
    } else {
      setColors(colorMaps.default);
    }
  };

  return (
    <div className="App">
      <div>
        <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/logo_500_200_light.png" />
      </div>
      <button onClick={handleUpdateBarData}>
        Update the data of bar chart
      </button>

      <button onClick={handleUpdateColors}>update colors</button>

      <h2>A Bar Chart</h2>

      <BarChart data={barData} colors={colors} />

      <h2>A Line Chart</h2>
      <LineChart colors={colors} />

      <h2>A Area Chart</h2>
      <AreaChart colors={colors} />
    </div>
  );
}
```

## 结果展示

- [在线效果参考](https://codesandbox.io/s/visactor-vchart-react-demo-forked-jsqqjj)

## 相关文档

- [react-vchart](https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react)
- [github](https://github.com/VisActor/VChart)
