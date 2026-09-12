---
category: examples
group: storytelling
title: 环形图
keywords: circularProgress,circle,animation
order: 36-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/storytelling/weekly-activity.gif
option: circularProgress
---

# 环形图

## 关键配置

- `player` 属性配置播放器数据和逻辑
  - `player.specs` 属性配置了所有播放时间线上的数据 spec
- `categoryField` 属性声明为分类字段
- `valueField` 属性声明为分类字段
- `seriesField` 属性用来声明参与颜色映射的字段
- `sizeField` 属性声明为尺寸字段
- `size` 属性声明尺寸的视觉通道映射
  - `size.type` 配置尺寸的视觉通道映射类型为`linear`连续映射
  - `size.range` 配置数据范围 `[min, max]` 映射到尺寸大小为 `[0,30]`；
- 通过 `region` 数组将画布划分为多个空间
  - `region.width` 可以配置为百分比字符串，本例中将画布等分为了 7 列
  - `region.offsetX` 可以配置为百分比字符串，设置空间在画布 x 方向的偏移
- 通过 `axis.seriesId` 将轴与系列关联，配置不同的轴范围

## 代码演示

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

// 配置项
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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
