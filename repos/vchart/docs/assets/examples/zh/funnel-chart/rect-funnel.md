---
category: examples
group: funnel chart
title: 矩形转化漏斗图
keywords: funnelChart,composition,trend,strip
order: 8-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/ffc3a9b5518762d274121ff04.png
option: funnelChart
---

# 矩形转化漏斗图

## 关键配置

- `type: funnel` 指定图表类型为漏斗图
- `categoryField` 指定分类字段
- `valueField` 指定值字段
- `isTransform: true` 配置为转化漏斗图，图表中会显示转化层；
- `shape: rect` 指定漏斗层形状为矩形

## 代码演示

```javascript livedemo
const spec = {
  type: 'funnel',
  maxSize: '75%',
  minSize: '10%',
  isTransform: true,
  shape: 'rect',
  color: {
    type: 'ordinal',
    range: ['#00328E', '#0048AA', '#005FC5', '#2778E2', '#4E91FF', '#70ABFF', '#8FC7FF', '#AEE2FF']
  },
  funnel: {
    style: {
      cornerRadius: 4,
      stroke: 'white',
      lineWidth: 2
    },
    state: {
      hover: {
        stroke: '#4e83fd',
        lineWidth: 1
      }
    }
  },
  transform: {
    style: {
      stroke: 'white',
      lineWidth: 2
    },
    state: {
      hover: {
        stroke: '#4e83fd',
        lineWidth: 1
      }
    }
  },
  label: {
    visible: true,
    style: {
      lineHeight: 16,
      limit: Infinity,
      text: datum => [`${datum.name}`, `${datum.value}`]
    }
  },
  outerLabel: {
    visible: true,
    position: 'right',
    alignLabel: false,
    style: {
      text: datum => {
        return `${datum.percent * 100}%`;
      }
    },
    line: {
      style: {
        lineDash: [2, 2]
      }
    }
  },
  transformLabel: {
    visible: true,
    style: {
      fill: 'black'
    }
  },
  data: [
    {
      name: 'funnel',
      values: [
        {
          value: 100,
          name: 'Resume Screening',
          percent: 1
        },
        {
          value: 80,
          name: 'Resume Evaluation',
          percent: 0.8
        },
        {
          value: 50,
          name: 'Evaluation Passed',
          percent: 0.5
        },
        {
          value: 30,
          name: 'Interview',
          percent: 0.3
        },
        {
          value: 10,
          name: 'Final Pass',
          percent: 0.1
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[漏斗图](link)
