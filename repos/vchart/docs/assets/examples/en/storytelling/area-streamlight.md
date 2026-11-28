---
category: examples
group: storytelling
title: Stream light animation for area charts
keywords: animation,area,lineChart
order: 42-1
cover: /vchart/preview/area-streamlight_1.8.3.gif
option: areeaChart#animationNormal
---

# Stream light animation for area charts

The commonly-seen stream light animation effect in big screens.

## Key configuration

## Demo source

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  animationNormal: {
    area: {
      loop: 100,
      duration: 1500,
      easing: 'quadIn',
      custom: VRender.StreamLight,
      customParameters: {
        streamLength: 30,
        attribute: { stroke: 'white', strokeOpacity: 0.8, lineWidth: 2 }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
```

## Related Tutorials

[Scatterplot](link)
