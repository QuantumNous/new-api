---
category: examples
group: component
title: React 组合图自定义 Tooltip
keywords: commonChart,composition,tooltip,legend
order: 0-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/theme/theme-switch.png
option: commonChart#theme
---

# React 组合图自定义 Tooltip

## 代码演示

```javascript livedemo template=react-vchart
const root = document.getElementById(CONTAINER_ID);
const { CommonChart } = ReactVChart;
const { useRef, useEffect } = React;

const data0 = [
  { time: '2:00', value: 8, type: 'Douyin' },
  { time: '4:00', value: 9, type: 'Douyin' },
  { time: '6:00', value: 11, type: 'Douyin' },
  { time: '8:00', value: 14, type: 'Douyin' },
  { time: '10:00', value: 16, type: 'Douyin' },
  { time: '12:00', value: 17, type: 'Douyin' },
  { time: '14:00', value: 17, type: 'Douyin' },
  { time: '16:00', value: 16, type: 'Douyin' },
  { time: '18:00', value: 15, type: 'Douyin' },
  { time: '2:00', value: 7, type: 'Bilibili' },
  { time: '4:00', value: 8, type: 'Bilibili' },
  { time: '6:00', value: 9, type: 'Bilibili' },
  { time: '8:00', value: 10, type: 'Bilibili' },
  { time: '10:00', value: 9, type: 'Bilibili' },
  { time: '12:00', value: 12, type: 'Bilibili' },
  { time: '14:00', value: 14, type: 'Bilibili' },
  { time: '16:00', value: 12, type: 'Bilibili' },
  { time: '18:00', value: 14, type: 'Bilibili' }
];

const data1 = [
  { time: '2:00', value: 15, type: 'Total' },
  { time: '4:00', value: 17, type: 'Total' },
  { time: '6:00', value: 20, type: 'Total' },
  { time: '8:00', value: 24, type: 'Total' },
  { time: '10:00', value: 25, type: 'Total' },
  { time: '12:00', value: 29, type: 'Total' },
  { time: '14:00', value: 31, type: 'Total' },
  { time: '16:00', value: 28, type: 'Total' },
  { time: '18:00', value: 29, type: 'Total' }
];

const spec = {
  type: 'common',
  data: [
    { id: 'id0', values: data0 },
    { id: 'id1', values: data1 }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      xField: ['time', 'type'],
      yField: 'value',
      seriesField: 'type'
    },
    {
      type: 'line',
      dataIndex: 1,
      xField: 'time',
      yField: 'value',
      seriesField: 'type'
    }
  ],
  axes: [
    {
      orient: 'bottom',
      type: 'band'
    },
    {
      orient: 'left',
      type: 'linear'
    }
  ],
  legends: {
    visible: true,
    orient: 'right'
  },
  tooltip: {
    visible: true,
    reserveDefaultTooltip: false,
    enterable: true,
    tooltipRender: actualTooltip => (
      <div style={{ textAlign: 'center', marginTop: 5 }}>
        <button>🔥 {actualTooltip.title.value}</button>
      </div>
    )
  }
};

const Card = () => {
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const handleLegendItemClick = params => {
    console.log(params);
  };

  return <CommonChart ref={chartRef} spec={spec} onLegendItemClick={handleLegendItemClick} />;
};

ReactDom.createRoot(root).render(<Card />);

window.customRelease = () => {
  ReactDom.unmountComponentAtNode(root);
};
```

## 交互说明

- 点击图例项会触发回调，可用于埋点或过滤系列
- Tooltip 使用自定义 React 组件渲染按钮

## 复制与卸载

复制代码到本地运行后，如需卸载示例，可调用 `window.customRelease()` 释放图表实例。

## 相关教程

[主题](link)
