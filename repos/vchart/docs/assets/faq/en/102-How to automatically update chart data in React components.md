# How to automatically update chart data in React components?

## Question Description

How can we achieve automatic updating of chart data in a chart component wrapped with React?

## Solution

In VChart, you can update the chart by calling either updateSpec or updateData.

To update the chart data, you can save the chart instance using ref when initializing the chart instance in a React component. Then, use useEffect to set the dependencies to the data that needs to be updated, and call the chart instance's updateData method in the callback function.

VChart also provides a React-VChart wrapper:
https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react

You can refer to the code example below to update the chart data using React-VChart.

## Code Example

Clicking the "Update the data of bar chart" button allows for the updating of the chart's data.

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

## Results

- [Online demo](https://codesandbox.io/s/visactor-vchart-react-demo-forked-jsqqjj)

## Quote

- [react-vchart Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react)

- [github](https://github.com/VisActor/VChart)
