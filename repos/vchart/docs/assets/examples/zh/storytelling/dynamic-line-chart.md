---
category: examples
group: storytelling
title: 动态线图
keywords: lineChart,comparison,trend,line,animation
order: 36-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/storytelling/dynamic-line-chart.gif
option: lineChart
---

# 动态线图

## 关键配置

- `xField` 属性声明为连续时间戳数据
- `yField` 属性声明数值字段
- `axes` 配置坐标轴
  - `axes.type` 属性配置为 `time` 即指定当前轴为时间轴
  - `axes.layer` 为时间轴的层级配置，支持配置时间格式等
- `markLine` 属性配置标注线
  - 通过`markLine.y`配置为 y 轴对应数值的标注线

## 代码演示

```javascript livedemo
function func(x) {
  x /= 20;
  return Math.cos(x + 1) * Math.sin(x + 1) * 50;
}

function generateData(i) {
  return {
    name: +now + minute * i,
    value: func(i)
  };
}

let now = new Date(2023, 5, 16);
const minute = 60 * 1000;
const data = [];
let i = 0;
for (; i < 1000; i++) {
  data.push(generateData(i));
}

const duration = 100;

const spec = {
  type: 'line',
  data: {
    id: 'id0',
    values: data
  },
  xField: 'name',
  yField: 'value',
  line: {
    style: {
      lineWidth: 2
    }
  },
  point: {
    visible: false
  },
  animationAppear: {
    line: {
      duration
    }
  },
  // FIXME: 字符串改为数字（目前会报错）
  markLine: [
    {
      y: '0', // FIXME: 字符串改为数字（目前会报错）
      line: {
        style: {
          lineDash: [0]
        }
      },
      endSymbol: {
        visible: false
      }
    }
  ],
  axes: [
    {
      orient: 'left',
      type: 'linear',
      visible: true,
      min: -50,
      max: 50,
      grid: {
        style: {
          lineDash: [0]
        }
      },
      label: {
        visible: true
      },
      animation: false
    },
    {
      orient: 'bottom',
      type: 'time',
      animation: true,
      nice: false,
      layers: [
        // 双层轴每层的配置
        {
          timeFormat: '%m-%d '
        },
        {
          timeFormat: '%H:%M'
        }
      ],
      label: {
        visible: true
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
setInterval(function () {
  for (let j = 0; j < 5; j++) {
    data.shift();
    data.push(generateData(++i));
  }
  vchart.updateData('id0', data);
}, duration);

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
