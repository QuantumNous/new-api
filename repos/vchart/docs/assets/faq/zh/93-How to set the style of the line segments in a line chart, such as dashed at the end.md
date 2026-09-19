# 如何设置折线的分段样式，比如 末尾虚线？

## 问题描述

我有一个折线图的需求，折线的最后一个数据点是预测数据，所以想要折线最后一段能显示成虚线，类似下面这张图。这个要怎么实现更方便？
![demo](/vchart/faq/19-0.png)

## 解决方案

推荐你使用 VChart，官网 demo 正有你需要的效果：https://visactor.io/vchart/demo/line-chart/dash-line
可以在 line 的图元样式回调里，根据数据返回不同的样式。

- `lineDash`：虚线模式。它使用一组值来指定描述模式的线和间隙的交替长度。

```js
line: {
  style: {
    stroke: (data) => data.latest ? 'blue': 'green',
    lineDash: data => data.latest ? [5, 5]: [0]
  }
},
point: {
  style: {
    fill: (data) => data.latest ? 'blue': 'green',
  }
}
```

## 代码示例

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        x: '1st',
        y: 0.012
      },
      {
        x: '2nd',
        y: -0.01
      },
      {
        x: '3rd',
        y: 0.005
      },
      {
        x: '4th',
        y: 0.007
      },
      {
        x: '5th',
        y: 0.01
      },
      {
        x: '6th',
        y: 0.017
      },
      {
        x: '7th',
        y: 0.022
      },
      {
        x: '8th (prediction)',
        y: 0.033,
        latest: true
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  line: {
    style: {
      stroke: data => (data.latest ? 'blue' : 'green'),
      lineDash: data => (data.latest ? [5, 5] : [0])
    }
  },
  point: {
    style: {
      fill: data => (data.latest ? 'blue' : 'green')
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [更多示例](https://visactor.io/vchart/demo/line-chart/dash-line)
- [相关 API](https://visactor.io/vchart/option/lineChart#line.style)
- [github](https://github.com/VisActor/VChart)
