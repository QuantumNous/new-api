---
category: examples
group: usage
title: 基础折线图
keywords: lineChart,comparison,trend,line
order: 0-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/line-chart/basic-line.png
option: lineChart
---

# 基础折线图

折线图通过将一系列数据点进行连接，构造出趋势。折线图用于分析事物随时间或有序类别而变化的趋势。如果有多组数据，则用于分析多组数据随时间变化或有序类别的相互作用和影响。折线的方向表示正/负变化。折线的斜率表示变化的程度。在这个例子中，我们创建了一个基础折线图用来展示一天的气温变化。

## 关键配置

- `xField` 属性声明为连续时间间隔或有序类别字段
- `yField` 属性声明数值字段

## 代码演示

```javascript livedemo template=openinula-vchart
const getData = () =>
  ['2:00', '4:00', '6:00', '8:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map(time => ({
    time,
    value: Math.random() * 10
  }));

const getSpec = () => ({
  type: 'line',
  data: {
    values: getData()
  },
  xField: 'time',
  yField: 'value'
});

const root = document.getElementById(CONTAINER_ID);
const { VChart } = InulaVChart;
const { useState, useRef, useEffect } = Inula;

const Card = () => {
  const [spec, setSpec] = useState(getSpec());
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const handleSwitchData = () => {
    setSpec(getSpec());
  };

  return (
    <div>
      <VChart ref={chartRef} spec={spec} />
      <button
        style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, 0)' }}
        onClick={handleSwitchData}
      >
        Switch Data
      </button>
    </div>
  );
};

Inula.render(<Card />, root);

// release openinula instance, do not copy
window.customRelease = () => {
  Inula.unmountComponentAtNode(root);
};
```

## 相关教程

[折线图](link)
