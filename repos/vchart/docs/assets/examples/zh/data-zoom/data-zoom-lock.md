---
category: demo
group: data-zoom
title: 缩略轴支持范围锁定
keywords: barChart,dataZoom
order: 29-4
cover: /vchart/preview/data-zoom-lock_1.5.0.png
option: barChart#dataZoom
---

# 缩略轴支持范围锁定

在缩略轴中可以配置是否锁定当前选中的区域大小，一旦配置，则意味着范围区间的大小不再变化。

## 关键配置

- `zoomLock`属性声明为是否锁定选择区域（或叫做数据窗口）的大小

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/cars.json');
const data = await response.json();
const spec = {
  type: 'scatter',
  xField: 'Miles_per_Gallon',
  yField: 'Horsepower',
  seriesField: 'Origin',
  data: [
    {
      id: 'data',
      values: data.filter(d => d['Horsepower'] && d['Miles_per_Gallon'])
    }
  ],
  dataZoom: [
    {
      orient: 'bottom',
      start: 0,
      end: 0.4,
      zoomLock: true,
      filterMode: 'axis'
    }
  ],
  axes: [
    {
      title: {
        visible: true,
        text: 'Horse Power'
      },
      orient: 'left',
      type: 'linear'
    },
    {
      title: {
        visible: true,
        text: 'Miles Per Gallon'
      },
      orient: 'bottom',
      label: { visible: true },
      type: 'linear'
    }
  ],
  legends: [{}]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
