# How to customize the position of gauge indicator in VChart?

## Question Description

In the design, there is a gap set between each piece of the ring chart, and there is also a gray background ring under the interval. How can this effect be achieved?
![design](/vchart/faq/21-0.png)
![detail](/vchart/faq/21-1.png)

## Solution

This effect can be achieved using the common chart of VChart. The common chart can be configured with two pie series, where the first series has only one data to simulate the background ring, and the second series is a regular pie series. Note:

- `padAngle`: Configure the angle of the interval;
- `innerRadius`/`outerRadius`: Configure the inner and outer radius. Both series need to have the same inner and outer radius;
- Do not reverse the order of the series between each other, because the series configured later has a higher z-index;
- It is recommended to turn off animation and tooltip interaction for the background series.

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

- [Related tutorial](https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination)
- [Related API](https://visactor.io/vchart/demo/pie-chart/nested-pie?keyword=pieChart)
- [github](https://github.com/VisActor/VChart)
