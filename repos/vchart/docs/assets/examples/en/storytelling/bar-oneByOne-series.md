---
category: examples
group: storytelling
title: Bar One-by-one Appear Animation (By Series)
keywords: animation,bar,barChart,comparison
order: 42-0
cover: /vchart/preview/bar-oneByOne-series_1.8.3.gif
option: barChart#animationAppear
---

# Bar One-by-one Appear Animation (By Series)

## Key configuration

## Demo source

```javascript livedemo
const values = [
  { type: 'Nail polish', country: 'Africa', value: 4229 },
  { type: 'Nail polish', country: 'EU', value: 4376 },
  { type: 'Nail polish', country: 'China', value: 3054 },
  { type: 'Nail polish', country: 'USA', value: 12814 },
  { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
  { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
  { type: 'Eyebrow pencil', country: 'China', value: 5067 },
  { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
  { type: 'Rouge', country: 'Africa', value: 5221 },
  { type: 'Rouge', country: 'EU', value: 3574 },
  { type: 'Rouge', country: 'China', value: 7004 },
  { type: 'Rouge', country: 'USA', value: 11624 },
  { type: 'Lipstick', country: 'Africa', value: 9256 },
  { type: 'Lipstick', country: 'EU', value: 4376 },
  { type: 'Lipstick', country: 'China', value: 9054 },
  { type: 'Lipstick', country: 'USA', value: 8814 },
  { type: 'Eyeshadows', country: 'Africa', value: 3308 },
  { type: 'Eyeshadows', country: 'EU', value: 4572 },
  { type: 'Eyeshadows', country: 'China', value: 12043 },
  { type: 'Eyeshadows', country: 'USA', value: 12998 }
];
const series = Array.from(new Set(values.map(v => v.country)));
const spec = {
  type: 'bar',
  data: {
    values
  },
  xField: ['type', 'country'],
  yField: 'value',
  seriesField: 'country',
  animationAppear: {
    duration: 500, // 每个柱子的动画时长为 500ms
    delay: (datum, element, ctx, params) => {
      const seriesIndex = series.findIndex(s => s === datum.country);
      return seriesIndex * (500 + 50); // 柱子延迟为 500ms（之前柱子的动画时长）+ 50ms（动画间隔时间）
    }
  },
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod(val) {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
```

## Related Tutorials

[Scatterplot](link)
