---
category: examples
group: storytelling
title: Circular Chart
keywords: circularProgress,circle,animation
order: 36-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/storytelling/weekly-activity.gif
option: circularProgress
---

# Circular Chart

## Key Configuration

- `player` attribute configures the player data and logic
  - `player.specs` attribute configures all data specs on the playback timeline
- `categoryField` attribute is declared as the classification field
- `valueField` attribute is declared as the classification field
- `seriesField` attribute is used to declare the field participating in color mapping
- `sizeField` attribute is declared as the size field
- `size` attribute declares the visual channel mapping of size
  - `size.type` configures the visual channel mapping type of size as `linear` continuous mapping
  - `size.range` configures data range `[min, max]` mapping to size `[0,30]`;
- Divide the canvas into multiple spaces through the `region` array
  - `region.width` can be configured as a percentage string, in this example, the canvas is divided into 7 columns
  - `region.offsetX` can be configured as a percentage string, setting the space offset on the canvas x direction
- Associate the axis with the series through `axis.seriesId`, configuring different axis ranges

## Demo source

```javascript livedemo
const firstDay = 1;
const lastDay = 7;

const dataSpec = [];

const region = [];
const series = [];
const axes = [];
const types = ['activity', 'steps', 'hoursActive'];
const target = [30, 8000, 12];
const data = [];

for (let date = firstDay; date <= lastDay; date++) {
  const activity = ~~(Math.random() * 50 + 1);
  const steps = activity * 200;
  const hoursActive = Math.round(Math.random() * (13 - 2)) + 2;
  data.push({ id: `activity_${date}`, values: [{ type: 'activity', value: activity }] });
  data.push({ id: `steps_${date}`, values: [{ type: 'steps', value: steps }] });
  data.push({ id: `hoursActive_${date}`, values: [{ type: 'hoursActive', value: hoursActive }] });

  dataSpec.push({ data: data });

  region.push({
    id: `${date}`,
    width: `${(firstDay / lastDay) * 100}%`,
    offsetX: `${((date - 1) / lastDay) * 100}%`
  });
  types.forEach((type, index) => {
    series.push({
      type: 'circularProgress',
      dataId: `${type}_${date}`,
      regionId: `${date}`,
      id: `${type}_${date}`,
      valueField: 'value',
      categoryField: 'type',
      seriesField: 'type',
      stack: false,
      background: {
        style: {
          innerPadding: 1,
          outerPadding: 1
        }
      },
      progress: {
        style: {
          cornerRadius: 20,
          innerPadding: 1,
          outerPadding: 1
        }
      },
      // FIXME: 目前动画会把 from 属性在 delay 后设置到图元，后续sirius增加配置后效果会正常
      animationAppear: {
        progress: {
          duration: 1000,
          delay: (date - 1) * 400
        }
      }
    });

    axes.push({
      visible: false,
      seriesId: `${type}_${date}`,
      type: 'linear',
      orient: 'angle',
      min: 0,
      max: target[index],
      domain: { visible: true, smooth: false }
    });
  });
  axes.push({
    visible: false,
    type: 'band',
    orient: 'radius',
    grid: { visible: true, smooth: false },
    paddingInner: 0.1
  });
}

data.push({
  id: 'date',
  values: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 }, { value: 7 }]
});

const spec = {
  type: 'common',
  height: 300,
  data,
  outerRadius: 0.6,
  innerRadius: 0.2,
  color: ['#2F86FE', '#FE7B1B', '#E90D31'],
  series,
  axes,
  region,
  legends: {
    orient: 'top',
    padding: 0
  },
  customMark: [
    {
      type: 'text',
      dataId: 'date',
      style: {
        text: datum => datum.value,
        x: (datum, ctx) => {
          const region = ctx.vchart.getChart().getRegionsInIndex([datum.value - 1])[0];
          return region.getLayoutStartPoint().x + region.getLayoutRect().width / 2;
        },
        y: () => 84,
        fontWeight: 'bolder',
        fill: 'black'
      }
    }
  ],
  title: {
    visible: true,
    text: 'Weekly Activities',
    padding: 0
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Bar Chart](link)
