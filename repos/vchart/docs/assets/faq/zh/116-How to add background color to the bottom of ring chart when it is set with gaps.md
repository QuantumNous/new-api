# 当环形图设置有间隔时，环形的底部能否增加背景颜色？

## 问题描述

设计稿中环形图的每一块之间设置了间隔，并且在间隔下方还有一个灰的背景环，请问这个效果如何实现？  
![design](/vchart/faq/21-0.png)
![detail](/vchart/faq/21-1.png)

## 解决方案

这个效果可以用 VChart 的组合图实现。组合图可以配置两个饼图系列，第一个只有一条数据，用于模拟背景的环形；第二个系列就是常规的饼图系列。需要注意：

- `padAngle`：配置间隔的角度；
- `innerRadius`/`outerRadius`：配置内外半径。两个系列需要配置相同的内外半径；
- 系列之间的顺序不要颠倒，因为后配置的系列层级更高；
- 背景系列建议关闭动画 和 tooltip 交互；

## Code Example

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'id0',
      values: [
        { type: '0~9', value: '39.12' },
        { type: '10~19', value: '43.01' },
        { type: '20~29', value: '43.91' },
        { type: '30~39', value: '45.4' },
        { type: '40~49', value: '40.89' },
        { type: '50~59', value: '42.48' },
        { type: '60~69', value: '39.63' },
        { type: '70~79', value: '25.17' },
        { type: '80 and over', value: '12.29' }
      ]
    },
    {
      id: 'id1',
      values: [{ type: '0~9', value: '1' }]
    }
  ],
  series: [
    {
      type: 'pie',
      id: 'background',
      dataIndex: 1,
      outerRadius: 0.8,
      innerRadius: 0.67,
      valueField: 'value',
      categoryField: 'type',
      animation: false,
      tooltip: { visible: false },
      pie: {
        style: {
          fill: 'rgb(237,239,242)'
        }
      }
    },
    {
      type: 'pie',
      dataIndex: 0,
      outerRadius: 0.8,
      innerRadius: 0.67,
      valueField: 'value',
      padAngle: 2,
      categoryField: 'type',
      pie: {
        style: {
          cornerRadius: 20
        },
        state: {
          hover: {
            outerRadius: 0.82,
            innerRadius: 0.65
          }
        }
      }
    }
  ],
  title: {
    visible: true,
    text: 'Population Distribution by Age in the United States, 2021 (in millions)',
    textStyle: {
      fontFamily: 'Times New Roman'
    }
  },
  legends: {
    visible: true,
    orient: 'left',
    seriesIndex: [1]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [相关教程](https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination)
- [相关 API](https://visactor.io/vchart/demo/pie-chart/nested-pie?keyword=pieChart)
- [github](https://github.com/VisActor/VChart)
