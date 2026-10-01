# 箱型图

[\[配置项\]](../../../option/boxPlotChart)

## 简介

箱形图（英文：box plot），又称为盒须图、盒式图、盒状图或箱线图，是一种用作显示一组数据分散情况资料的统计图。因图形如箱子，且在上下四分位数之外常有线条像胡须延伸出去而得名。它主要用于反映原始数据分布的特征，还可以进行多组数据分布特征的比较。它能显示出一组数据的最大值、最小值、中位数、及上下四分位数。当有数值与上下四分位数的范围差距 1.5×IQR 以上时，该值为离群值（outlier）。离群值会有时会画成个别的点。

## 图表构成

箱形图由箱形图元（箱形图元是一种特殊图元，基于[VGrammr Glyph 图元](../../../../vgrammar/guide/guides/mark/mark-glyph)封装）及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf05.png)

箱型图元为箱型图的基本要素，要想绘制出完整的箱型图元，下列绘制配置必不可少:

- `boxPlotChart.type`: 图表类型，箱形图的类型为`'boxPlot'`
- `boxPlotChart.data`: 图表绘制的数据源
- `boxPlotChart.xField`: x 轴字段，当`direction: 'vertical'`时，映射图元的 x 坐标
- `boxPlotChart.yField`: y 轴字段，当`direction: 'horizontal'`时，映射图元的 y 坐标
- `boxPlotChart.minField`: 数值字段，表示数据最小值，映射箱型图元最下边界线
- `boxPlotChart.q1Field`: 数值字段，表示数据四分位数，映射箱型图元箱体的下边界
- `boxPlotChart.medianField`: 数值字段，表示数据中位数，映射箱型图元箱体的中间线
- `boxPlotChart.q3Field`: 数值字段，表示数据上四分位数，映射箱型图元箱体的上边界
- `boxPlotChart.maxField`: 数值字段，表示数据最大值，映射箱型图元最上边界线

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `boxPlotChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，注意直方图不支持离散轴，因为直方图用于统计数据区间内的频率分布，主轴必须以数值区间的形式传入，离散轴不支持该功能。详情配置见[VChart 坐标轴组件配置](../../../option/boxPlotChart#axes)
- `boxPlotChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/boxPlotChart#tooltip)
- 更多组件配置见[VChart boxPlotChart 配置](../../../option/boxPlotChart)

## 快速上手

```javascript livedemo
const data = [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'Sub-Saharan Africa',
        y1: 8.72,
        y2: 9.73,
        y3: 10.17,
        y4: 10.51,
        y5: 11.64
      },
      {
        x: 'South Asia',
        y1: 9.4,
        y2: 10.06,
        y3: 10.75,
        y4: 11.56,
        y5: 12.5
      },
      {
        x: 'Middle East & North Africa',
        y1: 9.54,
        y2: 10.6,
        y3: 11.05,
        y4: 11.5,
        y5: 11.92
      },
      {
        x: 'Latin America & Caribbean',
        y1: 8.74,
        y2: 9.46,
        y3: 10.35,
        y4: 10.94,
        y5: 12.21
      },
      {
        x: 'East Asia & Pacific',
        y1: 7.8,
        y2: 8.95,
        y3: 10.18,
        y4: 11.57,
        y5: 13.25
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.52,
        y2: 10.39,
        y3: 10.93,
        y4: 11.69,
        y5: 12.63
      }
    ]
  }
];

const spec = {
  type: 'boxPlot',
  data: data,
  xField: 'x',

  minField: 'y1',
  q1Field: 'y2',
  medianField: 'y3',
  q3Field: 'y4',
  maxField: 'y5',
  direction: 'vertical'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## 关键配置

- `direction` 属性配置为 `'vertical'`
- `minField`、`q1Field`、`medianField`、`q3Field`、`maxField` 分别声明数据中的最小值、下四分位数、中位数、上四分位数、最大值字段

## 箱型图特性

### 数据

- 一个`离散` 字段，如: `x`
- 五个`数值`字段，如: `y1` `y2` `y3` `y4` `y5`

数据定义如下：

```ts
data: [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'A',
        y1: 5,
        y2: 8,
        y3: 10,
        y4: 12,
        y5: 20
      },
      {
        x: 'B',
        y1: 5,
        y2: 8,
        y3: 10,
        y4: 12,
        y5: 20
      },
      {
        x: 'C',
        y1: 5,
        y2: 8,
        y3: 10,
        y4: 12,
        y5: 20
      }
    ]
  }
];
```

### 布局

#### 分组箱型图

类似于分组柱状图，分组箱型图可以看做不同的箱型系列以间隔排列的方式组合在一起，每组箱型系列代表一个类别。
在 VChart 中，需要在`xField`中追加字段（此时`xField`以数组形式存在），该字段用于区分数据类别，即对同一维度的箱型进行拆分，拆分成若干组以间隔排列的方式展开。并且为了区分同一维度下间隔排列的箱型，需要指定`boxplotChart.seriedField`字段，该字段默认映射箱型图元颜色。

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
  color: ['#62CDFF', '#9E4784'],

  legends: [{ visible: true, position: 'middle', orient: 'top' }],

  title: {
    visible: true,
    text: 'Global GDP 2021'
  },

  boxPlot: {
    style: {
      // 不指定则自适应宽度
      // boxWidth: 50,
      // shaftWidth: 60,
      shaftShape: 'line',
      lineWidth: 2
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 图元及样式

#### 主要配置

| 关键字       | 描述               | 默认值 |
| ------------ | ------------------ | ------ |
| boxWidth     | 箱体宽度           |        |
| shaftShape   | 图元形状           | 'line' |
| shaftWidth   | 最大值最小值宽度   |        |
| shaftOpacity | 最大值最小值透明度 |        |
| lineWidth    | 图元描边宽度       |        |

#### 宽度自适应

箱型图图元宽度默认自适应，如果需要固定箱体宽度，可以在`boxPlotChart.boxPlot.style.boxWidth`中配置具体数值。

```javascript livedemo
const data = [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'Sub-Saharan Africa',
        y1: 8.72,
        y2: 9.73,
        y3: 10.17,
        y4: 10.51,
        y5: 11.64
      },
      {
        x: 'South Asia',
        y1: 9.4,
        y2: 10.06,
        y3: 10.75,
        y4: 11.56,
        y5: 12.5
      },
      {
        x: 'Middle East & North Africa',
        y1: 9.54,
        y2: 10.6,
        y3: 11.05,
        y4: 11.5,
        y5: 11.92
      },
      {
        x: 'Latin America & Caribbean',
        y1: 8.74,
        y2: 9.46,
        y3: 10.35,
        y4: 10.94,
        y5: 12.21
      },
      {
        x: 'East Asia & Pacific',
        y1: 7.8,
        y2: 8.95,
        y3: 10.18,
        y4: 11.57,
        y5: 13.25
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.52,
        y2: 10.39,
        y3: 10.93,
        y4: 11.69,
        y5: 12.63
      }
    ]
  }
];

const spec = {
  type: 'boxPlot',
  data: data,
  xField: 'x',

  minField: 'y1',
  q1Field: 'y2',
  medianField: 'y3',
  q3Field: 'y4',
  maxField: 'y5',
  direction: 'vertical',
  boxPlot: {
    style: {
      boxWidth: 20 // 不指定则自适应宽度
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 图元形状

箱型图图元形状分为'bar'和'line'两种, 'line'表示图元仅描边, 'bar'表示图元仅填充。可以通过`boxPlotChart.boxPlot.style.shaftShape`指定，默认为'line'。

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

  legends: [{ visible: true, position: 'middle', orient: 'top' }],

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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
