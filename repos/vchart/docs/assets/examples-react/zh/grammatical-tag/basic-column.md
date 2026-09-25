---
category: examples
group: grammatical-tag
title: 基础柱状图
keywords: barChart,comparison,distribution,rank,rectangle
order: 0-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/bar-chart/basic-column.png
option: barChart
---

# 基础柱状图

最基础的柱形图，需要一个分类变量和一个数值变量，在这个例子中，我们创建了一个简单的柱形图用来展示一周的销售数据，其中分类变量为 `month`，数值变量为 `sales`。

## 关键配置

- `type: bar` 属性声明为柱形图
- `xField` 属性声明为分类字段或时序字段
- `yField` 属性声明为数值字段

## 代码演示

```javascript livedemo template=react-vchart
const getData = () =>
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(time => ({
    time,
    value: Math.random() * 40
  }));

const root = document.getElementById(CONTAINER_ID);
const { VChart, BarChart, Bar } = ReactVChart;
const { useState, useRef, useEffect } = React;

const Card = () => {
  const [data, setData] = useState(getData());
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const handleSwitchData = () => {
    setData(getData());
  };

  const handleBarClick = params => {
    console.log(params);
  };

  return (
    <div>
      <BarChart ref={chartRef} data={[{ id: 'id0', values: data }]}>
        <Bar
          xField="time"
          yField="value"
          bar={{
            state: {
              hover: {
                fill: 'black'
              }
            }
          }}
          onClick={handleBarClick}
        />
      </BarChart>
      <button
        style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, 0)' }}
        onClick={handleSwitchData}
      >
        Switch Data
      </button>
    </div>
  );
};

ReactDom.createRoot(root).render(<Card />);

// release react instance, do not copy
window.customRelease = () => {
  ReactDom.unmountComponentAtNode(root);
};
```

## 相关教程

[柱状图](link)
