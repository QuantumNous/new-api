---
category: examples
group: bar chart
title: Bar chart with custom label
keywords: barChart,comparison,distribution,rectangle,comparison,rank,axis,label
cover: /vchart/preview/bar-customized-label-en_1.11.1.png
option: barChart
---

# Bar Chart with Custom Label

You can use `customLayoutFunc` to configure custom data label positions; you can customize the background of the bar chart to achieve a progress bar-like effect; the title of the details can be hidden.

## Key option

- Set the `extensionMark` property to the function for custom label positioning, making the labels appear on the right side of the chart.
- Set the `cornerRadius` property of `barBackground.style` and `bar.style` to give the appearance of a progress bar.
- Configure the `tooltip.mark.title.visible` property to false to hide the tooltip's title.

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          province: 'Beijing',
          value: 3080,
          type: 'top1'
        },
        {
          province: 'Tianjin',
          value: 2880,
          type: 'top2'
        },
        {
          province: 'Chongqing',
          value: 880,
          type: 'top3'
        },
        {
          province: 'Shenzhen',
          value: 780,
          type: 'common'
        },
        {
          province: 'Guangzhou',
          value: 680,
          type: 'common'
        },
        {
          province: 'Shandong',
          value: 580,
          type: 'common'
        },
        {
          province: 'Zhejiang',
          value: 480,
          type: 'common'
        },
        {
          province: 'Fujian',
          value: 100,
          type: 'common'
        },
        {
          province: 'Shihkiachwang',
          value: 100,
          type: 'common'
        },
        {
          province: 'Guangxi Zhuang Autonomous Region',
          value: 100,
          type: 'common'
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'province',
  seriesField: 'province',
  padding: { right: 50, left: 10 },
  axes: [
    {
      orient: 'bottom',
      visible: false,
      nice: false
    },
    {
      orient: 'left',
      maxWidth: 65,
      label: {
        autoLimit: true
      },
      domainLine: {
        visible: false
      },
      tick: {
        visible: false
      }
    }
  ],
  stackCornerRadius: 0,
  bar: {
    style: {
      cornerRadius: [5, 5, 5, 5],
      height: 10
    }
  },
  barBackground: {
    visible: true,
    style: {
      cornerRadius: [5, 5, 5, 5],
      height: 10
    },
    state: {
      hover: {
        stroke: '#D9D9D9',
        lineWidth: 1
      }
    }
  },
  extensionMark: [
    {
      type: 'text',
      dataId: 'barData',
      visible: true,
      style: {
        text: datum => datum.value,
        fontSize: 12,
        x: (datum, ctx) => {
          return ctx.getRegion().getLayoutRect().width + 10;
        },
        y: (datum, ctx) => {
          return ctx.valueToY([datum.province]) + ctx.yBandwidth() / 2;
        },
        textBaseline: 'middle',
        textAlign: 'left',
        fill: '#595959',
        size: 20
      }
    }
  ],
  crosshair: {
    yField: {
      visible: false
    }
  },
  tooltip: {
    mark: {
      title: {
        visible: false
      }
    },
    dimension: {
      title: {
        visible: false
      }
    },
    style: {
      shape: {
        shapeType: 'circle'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Bar Chart](link)
