---
category: examples
group: radar chart
title: Hollow Radar Chart
keywords: radarChart,comparison,line,circle,axis,label,indicator
order: 10-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/radar-chart/radar-with-innerRadius.png
option: radarChart
---

# Hollow Radar Chart

By configuring the `innerRadius` property, you can make the radar chart hollow.

## Key option

- `innerRadius`: Configuring the inner radius of the radar chart
- `outerRadius`: Configuring the outer radius of the radar chart
- `grid.alignWithLabel`: Configure whether the grid aligns with the scale
- `label.visible`: Configure whether the label is visible

## Demo source

```javascript livedemo
const mockData = [];
for (let i = 0; i < 24; i++) {
  mockData.push({
    key: `key${i}`,
    value: parseInt(Math.random() * 10, 10)
  });
}
const spec = {
  type: 'radar',
  data: [
    {
      values: mockData
    }
  ],
  categoryField: 'key',
  valueField: 'value',
  innerRadius: 0.4,
  outerRadius: 0.9,
  label: {
    visible: true
  },
  axes: [
    {
      orient: 'radius', // 半径轴配置
      zIndex: 100,
      grid: {
        style: (data, index) => {
          if (index === 0) {
            return {
              lineDash: [0]
            };
          }
          return {
            visible: false
          };
        }
      }
    },
    {
      orient: 'angle', // set angle axes
      tick: {
        visible: false
      },
      domainLine: {
        visible: true
      },
      grid: {
        alignWithLabel: false,
        style: {
          lineDash: [0]
        },
        alternateColor: 'rgba(0, 0, 0, 0.04)'
      }
    }
  ],
  indicator: {
    visible: true,
    trigger: 'hover',
    limitRatio: 0.4,
    title: {
      visible: true,
      autoFit: true,
      style: {
        fontWeight: 'bolder',
        fontFamily: 'Times New Roman',
        fill: '#888',
        text: 'Radar'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Interval Bar Chart](link)

```

```
