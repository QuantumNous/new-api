---
category: examples
group: marker
title: markArea
keywords: marker,lineChart
order: 33-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/7b82fb013e7c6319c065b3d00.png
option: lineChart#markArea
---

# markArea 突出区间数据波动

当需要突出一个区间内的数据波动时，我们可以使用 `markArea` 数据标注组件。

## 关键配置

- 使用 `markArea.coordinates` 属性声明要标注的数据范围

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  xField: 'Date',
  yField: 'Price',
  point: {
    visible: false // disable point
  },
  line: {
    style: {
      lineWidth: 3,
      lineCap: 'round'
    }
  },
  axes: [
    {
      orient: 'left',
      min: 0.12,
      max: 0.18,
      tick: {
        visible: false
      },
      grid: {
        style: {
          lineDash: [0, 0]
        }
      },
      domainLine: {
        visible: false
      },
      label: {
        // format tick label, the last label add unit
        formatMethod: (value, datum) => {
          if (value === 0.18) {
            return `$${value}`;
          }
          return value;
        }
      }
    }, // configure y-axis 配置 y 轴
    {
      orient: 'bottom',
      label: {
        formatMethod: (value, datum) => {
          if (value.startsWith('Jan-')) {
            return `20${value.split('-')[1]}`;
          }

          return '';
        }
      }
    }
  ],
  markArea: [
    {
      coordinates: [
        {
          Date: 'Jan-20',
          Price: 0.18
        },
        {
          Date: 'Mar-23',
          Price: 0.18
        },
        {
          Date: 'Mar-23',
          Price: 0.12
        },
        {
          Date: 'Jan-20',
          Price: 0.12
        }
      ],
      label: {
        text: 'Electricite prices have surged since 2020',
        position: 'insideTop'
      }
    }
  ],
  data: {
    id: 'data',
    values: [
      { Date: 'Jan-13', Price: 0.129 },
      { Date: 'Feb-13', Price: 0.129 },
      { Date: 'Mar-13', Price: 0.128 },
      { Date: 'Apr-13', Price: 0.128 },
      { Date: 'May-13', Price: 0.131 },
      { Date: 'Jun-13', Price: 0.137 },
      { Date: 'Jul-13', Price: 0.137 },
      { Date: 'Aug-13', Price: 0.137 },
      { Date: 'Sep-13', Price: 0.137 },
      { Date: 'Oct-13', Price: 0.132 },
      { Date: 'Nov-13', Price: 0.13 },
      { Date: 'Dec-13', Price: 0.131 },
      { Date: 'Jan-14', Price: 0.134 },
      { Date: 'Feb-14', Price: 0.134 },
      { Date: 'Mar-14', Price: 0.135 },
      { Date: 'Apr-14', Price: 0.131 },
      { Date: 'May-14', Price: 0.136 },
      { Date: 'Jun-14', Price: 0.143 },
      { Date: 'Jul-14', Price: 0.143 },
      { Date: 'Aug-14', Price: 0.143 },
      { Date: 'Sep-14', Price: 0.141 },
      { Date: 'Oct-14', Price: 0.136 },
      { Date: 'Nov-14', Price: 0.134 },
      { Date: 'Dec-14', Price: 0.135 },
      { Date: 'Jan-15', Price: 0.138 },
      { Date: 'Feb-15', Price: 0.138 },
      { Date: 'Mar-15', Price: 0.136 },
      { Date: 'Apr-15', Price: 0.137 },
      { Date: 'May-15', Price: 0.137 },
      { Date: 'Jun-15', Price: 0.143 },
      { Date: 'Jul-15', Price: 0.142 },
      { Date: 'Aug-15', Price: 0.142 },
      { Date: 'Sep-15', Price: 0.141 },
      { Date: 'Oct-15', Price: 0.136 },
      { Date: 'Nov-15', Price: 0.134 },
      { Date: 'Dec-15', Price: 0.133 },
      { Date: 'Jan-16', Price: 0.134 },
      { Date: 'Feb-16', Price: 0.134 },
      { Date: 'Mar-16', Price: 0.134 },
      { Date: 'Apr-16', Price: 0.134 },
      { Date: 'May-16', Price: 0.133 },
      { Date: 'Jun-16', Price: 0.138 },
      { Date: 'Jul-16', Price: 0.139 },
      { Date: 'Aug-16', Price: 0.139 },
      { Date: 'Sep-16', Price: 0.139 },
      { Date: 'Oct-16', Price: 0.134 },
      { Date: 'Nov-16', Price: 0.131 },
      { Date: 'Dec-16', Price: 0.133 },
      { Date: 'Jan-17', Price: 0.134 },
      { Date: 'Feb-17', Price: 0.135 },
      { Date: 'Mar-17', Price: 0.134 },
      { Date: 'Apr-17', Price: 0.135 },
      { Date: 'May-17', Price: 0.137 },
      { Date: 'Jun-17', Price: 0.142 },
      { Date: 'Jul-17', Price: 0.143 },
      { Date: 'Aug-17', Price: 0.142 },
      { Date: 'Sep-17', Price: 0.142 },
      { Date: 'Oct-17', Price: 0.137 },
      { Date: 'Nov-17', Price: 0.136 },
      { Date: 'Dec-17', Price: 0.136 },
      { Date: 'Jan-18', Price: 0.135 },
      { Date: 'Feb-18', Price: 0.135 },
      { Date: 'Mar-18', Price: 0.135 },
      { Date: 'Apr-18', Price: 0.134 },
      { Date: 'May-18', Price: 0.136 },
      { Date: 'Jun-18', Price: 0.139 },
      { Date: 'Jul-18', Price: 0.139 },
      { Date: 'Aug-18', Price: 0.139 },
      { Date: 'Sep-18', Price: 0.138 },
      { Date: 'Oct-18', Price: 0.136 },
      { Date: 'Nov-18', Price: 0.134 },
      { Date: 'Dec-18', Price: 0.135 },
      { Date: 'Jan-19', Price: 0.135 },
      { Date: 'Feb-19', Price: 0.136 },
      { Date: 'Mar-19', Price: 0.135 },
      { Date: 'Apr-19', Price: 0.135 },
      { Date: 'May-19', Price: 0.136 },
      { Date: 'Jun-19', Price: 0.139 },
      { Date: 'Jul-19', Price: 0.14 },
      { Date: 'Aug-19', Price: 0.139 },
      { Date: 'Sep-19', Price: 0.139 },
      { Date: 'Oct-19', Price: 0.136 },
      { Date: 'Nov-19', Price: 0.133 },
      { Date: 'Dec-19', Price: 0.133 },
      { Date: 'Jan-20', Price: 0.134 },
      { Date: 'Feb-20', Price: 0.134 },
      { Date: 'Mar-20', Price: 0.134 },
      { Date: 'Apr-20', Price: 0.133 },
      { Date: 'May-20', Price: 0.134 },
      { Date: 'Jun-20', Price: 0.137 },
      { Date: 'Jul-20', Price: 0.137 },
      { Date: 'Aug-20', Price: 0.137 },
      { Date: 'Sep-20', Price: 0.137 },
      { Date: 'Oct-20', Price: 0.135 },
      { Date: 'Nov-20', Price: 0.136 },
      { Date: 'Dec-20', Price: 0.136 },
      { Date: 'Jan-21', Price: 0.136 },
      { Date: 'Feb-21', Price: 0.137 },
      { Date: 'Mar-21', Price: 0.138 },
      { Date: 'Apr-21', Price: 0.139 },
      { Date: 'May-21', Price: 0.14 },
      { Date: 'Jun-21', Price: 0.142 },
      { Date: 'Jul-21', Price: 0.143 },
      { Date: 'Aug-21', Price: 0.144 },
      { Date: 'Sep-21', Price: 0.144 },
      { Date: 'Oct-21', Price: 0.142 },
      { Date: 'Nov-21', Price: 0.142 },
      { Date: 'Dec-21', Price: 0.142 },
      { Date: 'Jan-22', Price: 0.147 },
      { Date: 'Feb-22', Price: 0.148 },
      { Date: 'Mar-22', Price: 0.15 },
      { Date: 'Apr-22', Price: 0.151 },
      { Date: 'May-22', Price: 0.154 },
      { Date: 'Jun-22', Price: 0.16 },
      { Date: 'Jul-22', Price: 0.164 },
      { Date: 'Aug-22', Price: 0.167 },
      { Date: 'Sep-22', Price: 0.167 },
      { Date: 'Oct-22', Price: 0.166 },
      { Date: 'Nov-22', Price: 0.163 },
      { Date: 'Dec-22', Price: 0.165 },
      { Date: 'Jan-23', Price: 0.168 },
      { Date: 'Feb-23', Price: 0.168 },
      { Date: 'Mar-23', Price: 0.166 }
    ]
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[scrollBar](link)
