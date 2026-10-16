---
category: examples
group: marker
title: 复合增长差异（CAGR）标注
keywords: marker,barChart
order: 33-10
cover: /vchart/preview/mark-line-CAGR_1.7.0.png
option: barChart#markLine
---

# 复合增长差异（CAGR）标注

使用 `markLine` 绘制复合增长差异（CAGR）标注

## 关键配置

- 声明 `markLine` 属性
- 声明 `coordinates` 属性配置对比的两个数据点

## 代码演示

```javascript livedemo
function calculateCAGR(EV, BV, n) {
  return Math.pow(EV / BV, 1 / n) - 1;
}

const data = [
  { year: '2017', value: 129 },
  { year: '2018', value: 150 },
  { year: '2019', value: 130 },
  { year: '2020', value: 126 },
  { year: '2021', value: 117 },
  { year: '2022', value: 180 },
  { year: 'Target', value: 200 }
];

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: data
    }
  ],
  xField: 'year',
  yField: 'value',
  label: {
    visible: true,
    dataFilter: items => {
      return [items[0], items[5], items[6]];
    },
    style: {
      fill: '#000'
    },
    formatMethod: val => `$${val}`,
    position: 'top',
    overlap: false,
    offset: 0
  },
  axes: [
    {
      orient: 'left',
      visible: false
    },
    {
      orient: 'bottom',
      domainLine: {
        style: {
          lineWidth: 2,
          stroke: '#000'
        }
      }
    }
  ],
  markLine: {
    coordinates: [data[0], data[5]],
    line: {
      style: {
        lineDash: [0],
        lineWidth: 2,
        stroke: '#000'
      }
    },
    label: {
      position: 'middle',
      text: `${(calculateCAGR(data[5].value, data[0].value, 5) * 100).toFixed(0)}% CARG`,
      labelBackground: {
        padding: 8,
        style: {
          fill: '#fff',
          fillOpacity: 1,
          stroke: '#3CC780',
          lineWidth: 2,
          cornerRadius: 8
        }
      },
      style: {
        fill: '#3CC780'
      }
    },
    endSymbol: {
      size: 12,
      refX: -4
    },
    offsetY: -40
  },
  bar: {
    style: {
      fill: datum => {
        return datum.year === 'Target' ? '#ccc' : '#1664FF';
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[scrollBar](link)
