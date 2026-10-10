# 如何配置 MarkLine 文字标签的位置，可以配置显示在线起点、终点或者线段中间？

## 问题描述

类似 （https://www.visactor.io/vchart/demo/marker/mark-line-basic）这样的使用了markLine做轴空间定位的图表，
想要实现 markLine 中的 label 显示在线的起点、线的终点或者线段中间，该如何实现？

## 解决方案

不同图表库的解决方案不一样，根据你给的 demo，只需要将配置 markLine.label.position 为所需场景。

- markLine.label.position 用来配置标注线的标签位置（标签相对线的相对位置）。
  - 当文字标签显示在线的起点时，可配置 position 为'start'
  - 当文字标签显示在线的终点时，可配置 position 为'end'
  - 当文字标签显示在线段中间时，可配置 position 为'middle'

## 代码示例

```javascript livedemo
const spec = {
  type: 'scatter',
  padding: [12, 20, 12, 12],
  xField: 'x',
  yField: 'y',
  sizeField: 'z',
  size: {
    type: 'linear',
    range: [20, 80]
  },
  axes: [
    { orient: 'bottom', type: 'linear', min: 60, max: 95 },
    { orient: 'left', type: 'linear', min: 0, max: 200 }
  ],
  point: {
    style: {
      fillOpacity: 0.25,
      lineWidth: 1,
      stroke: '#6690F2',
      fill: '#6690F2'
    }
  },
  label: {
    visible: true,
    position: 'center',
    overlap: {
      avoidBaseMark: false
    },
    style: {
      stroke: '#fff',
      lineWidth: 1
    }
  },
  markLine: [
    {
      x: 65,
      label: {
        visible: true,
        position: 'end',
        text: 'Safe fat intake 65g/day',
        style: {
          textAlign: 'left',
          textBaseline: 'top',
          fill: '#000',
          dx: 10
        },
        labelBackground: {
          visible: false
        }
      },
      line: {
        style: {
          stroke: '#000',
          lineDash: [0]
        }
      }
    },
    {
      y: 50,
      label: {
        visible: true,
        position: 'end',
        text: 'Safe sugar intake 50g/day',
        style: {
          textAlign: 'right',
          textBaseline: 'bottom',
          fill: '#000'
        },
        labelBackground: {
          visible: false
        }
      },
      line: {
        style: {
          stroke: '#000',
          lineDash: [0]
        }
      }
    }
  ],
  tooltip: {
    mark: {
      title: {
        value: datum => datum.country
      }
    }
  },
  data: {
    id: 'data',
    values: [
      { x: 95, y: 95, z: 13.8, name: 'BE', country: 'Belgium' },
      { x: 86.5, y: 102.9, z: 14.7, name: 'DE', country: 'Germany' },
      { x: 80.8, y: 91.5, z: 15.8, name: 'FI', country: 'Finland' },
      { x: 80.4, y: 102.5, z: 12, name: 'NL', country: 'Netherlands' },
      { x: 80.3, y: 86.1, z: 11.8, name: 'SE', country: 'Sweden' },
      { x: 78.4, y: 70.1, z: 16.6, name: 'ES', country: 'Spain' },
      { x: 74.2, y: 68.5, z: 14.5, name: 'FR', country: 'France' },
      { x: 73.5, y: 83.1, z: 10, name: 'NO', country: 'Norway' },
      { x: 71, y: 93.2, z: 24.7, name: 'UK', country: 'United Kingdom' },
      { x: 69.2, y: 57.6, z: 10.4, name: 'IT', country: 'Italy' },
      { x: 68.6, y: 20, z: 16, name: 'RU', country: 'Russia' },
      { x: 65.5, y: 126.4, z: 35.3, name: 'US', country: 'United States' },
      { x: 65.4, y: 50.8, z: 28.5, name: 'HU', country: 'Hungary' },
      { x: 63.4, y: 51.8, z: 15.4, name: 'PT', country: 'Portugal' },
      { x: 64, y: 82.9, z: 31.3, name: 'NZ', country: 'New Zealand' }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

- [在线效果参考](https://codesandbox.io/s/mark-line-basic-srhwq3)

## 相关文档

- [markLine demo](https://www.visactor.io/vchart/demo/marker/mark-line-basic)
- [markLine 教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/marker)
- [相关 api](https://www.visactor.io/vchart/option/barChart#markLine.label.position)
- [github](https://github.com/VisActor/VChart)
