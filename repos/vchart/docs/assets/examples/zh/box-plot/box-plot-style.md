---
category: examples
group: box plot
title: 箱型图样式
keywords: boxPlot,distribution,comparison,strip
order: 5-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/box-plot/box-plot-style.png
option: boxPlotChart
---

# 箱型图样式设置

通过设置 boxPlot 图元的 style 字段，可以对箱型图的样式进行修改。将 shaftShape 字段，可以将箱型图绘制为条形。

## 关键配置

- `shaftShape`属性指定箱型图形状，分 line 和 bar 两种
- `shaftOpacity`属性指定箱型图最大最小值的透明图，仅在 shaftShape=bar 时才会生效
- `boxWidth`、`shaftWidth` 属性分别用于配置箱型图上下四分位数形成的箱体宽度、最大最小值宽度

## 代码演示

```javascript livedemo
const data = [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'Sub-Saharan Africa',
        y1: 9.16270124,
        y2: 10.07530816,
        y3: 10.09027907,
        y4: 10.27579542,
        y5: 11.62222959,
        group: 'High income'
      },
      {
        x: 'Sub-Saharan Africa',
        y1: 8.721525214,
        y2: 9.641352839,
        y3: 10.1736233,
        y4: 10.57169914,
        y5: 11.64427467,
        group: 'Low income'
      },
      {
        x: 'South Asia',
        y1: 9.404757278,
        y2: 10.36482449,
        y3: 10.94903493,
        y4: 11.5806383,
        y5: 12.50192084,
        group: 'Low income'
      },
      {
        x: 'South Asia',
        y1: 9.732841997,
        y2: 9.732841997,
        y3: 9.732841997,
        y4: 9.732841997,
        y5: 9.732841997,
        group: 'High income'
      },
      {
        x: 'Middle East & North Africa',
        y1: 9.541951901,
        y2: 10.33719892,
        y3: 10.91206173,
        y4: 11.29821858,
        y5: 11.60653481,
        group: 'Low income'
      },
      {
        x: 'Middle East & North Africa',
        y1: 10.2396509,
        y2: 10.63879995,
        y3: 11.09996104,
        y4: 11.54301107,
        y5: 11.92092709,
        group: 'High income'
      },
      {
        x: 'Latin America & Caribbean',
        y1: 10.14653181,
        y2: 10.32106777,
        y3: 10.45467215,
        y4: 10.45844052,
        y5: 10.6064696,
        group: 'Low income'
      },
      {
        x: 'Latin America & Caribbean',
        y1: 8.743652009,
        y2: 9.413881158,
        y3: 10.16606248,
        y4: 11.00011805,
        y5: 12.20655104,
        group: 'High income'
      },
      {
        x: 'East Asia & Pacific',
        y1: 7.800035977,
        y2: 8.850646235,
        y3: 10.14633178,
        y4: 11.59877618,
        y5: 13.24880824,
        group: 'High income'
      },
      {
        x: 'East Asia & Pacific',
        y1: 8.316035904,
        y2: 9.038602613,
        y3: 10.22954548,
        y4: 10.71782871,
        y5: 12.07411874,
        group: 'Low income'
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.831631935,
        y2: 9.939275167,
        y3: 10.39108655,
        y4: 10.95556656,
        y5: 11.3012157,
        group: 'Low income'
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.522480948,
        y2: 10.43085982,
        y3: 11.06642694,
        y4: 11.73822523,
        y5: 12.62940296,
        group: 'High income'
      }
    ]
  }
];

const spec = {
  type: 'boxPlot',
  data: data,
  xField: ['x', 'group'],

  minField: 'y1',
  q1Field: 'y2',
  medianField: 'y3',
  q3Field: 'y4',
  maxField: 'y5',
  seriesField: 'group',

  direction: 'vertical',
  color: ['#BBD6B8', '#EA5455'],

  legends: [{ visible: true }],

  title: {
    visible: true,
    text: 'Global GDP 2021'
  },

  boxPlot: {
    style: {
      boxWidth: 50,
      shaftWidth: 30,
      shaftShape: 'bar',
      lineWidth: 2,
      shaftOpacity: 0.3
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[箱型图](link)
