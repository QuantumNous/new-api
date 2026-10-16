# DataZoom 数据筛选滑块

DataZoom 是 VChart 图表库中的一种筛选滑块组件，它可以让用户更方便的缩放漫游图表数据，提高数据的可视性，同时增强图表的交互能力。本教程主要讲解 DataZoom 的相关概念以及组成，关于 DataZoom 更加详细的配置及示例，详见[配置项文档](../../../option)及[示例](../../../example)页面。

## 组成

DataZoom 组件主要由以下部分组成：

- `background` 背景
- `selectedBackground` 选中背景
- `startHandler` 起点手柄
- `endHandler` 终点手柄
- `middleHandler` 中间手柄
  - `icon` 中间手柄图标
  - `background` 中间手柄背景
- `startText` 起点文字
- `endText` 终点文字
- `background` 缩略轴的背景矩形
- `backgroundChart` 缩略轴的预览图表， 目前支持折线图及面积图
- `selectedBackgroundChart` 缩略轴的选中部分预览图表。
- `dragMask` 缩略轴的拖拽轨迹图元。

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a2c7623458257d15626270914.png" alt="DataZoom 组成图示">
</div>

## 示例

通过下面的实例，您可以在图表底部看到一个数据筛选滑块，用户可以通过拖动滑块手柄或者在背景层进行框选来缩放和漫游图表数据。

在这个示例中，我们通过 `dataZoom` 属性进行数据筛选滑块的配置，这里我们主要配置了滑块背景层的缩略图表以及图表在选中区域的样式

- 背景区域图：用 `backgroundChart` 对象进行配置，包括面积图 (`area`) 和折线图 (`line`) 的样式。面积图的填充颜色为`#D1DBEE`，线宽为 1；线形的描边颜色为 `#D1DBEE`，宽为 1。

- 选中区域图：用 `selectedBackgroundChart` 对象进行配置，包括面积 (`area`) 和折线图 (`line`) 的样式。面积图的填充颜色为 `#fbb934`，线宽为 1；线形图的描边颜色为 `#fbb934`，线宽为 1。

```javascript livedemo
const spec = {
  color: ['#1ac7c2', '#6f40aa', '#ccf59a', '#D4ADFC'],
  type: 'bar',
  dataId: 'bar',
  xField: 'Date',
  yField: 'Close',
  seriesField: 'Symbol',
  dataZoom: [
    {
      orient: 'bottom',
      backgroundChart: {
        area: {
          style: {
            lineWidth: 1,
            fill: '#D1DBEE'
          }
        },
        line: {
          style: {
            stroke: '#D1DBEE',
            lineWidth: 1
          }
        }
      },
      selectedBackgroundChart: {
        area: {
          style: {
            lineWidth: 1,
            fill: '#fbb934'
          }
        },
        line: {
          style: {
            stroke: '#fbb934',
            lineWidth: 1
          }
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top'
  },
  data: [
    {
      id: 'bar',
      values: [
        { Symbol: 'AMZN', Date: '2016-01-04', Close: 636.98999 },
        { Symbol: 'AMZN', Date: '2016-01-05', Close: 633.789978 },
        { Symbol: 'AMZN', Date: '2016-01-06', Close: 632.650024 },
        { Symbol: 'AMZN', Date: '2016-01-07', Close: 607.940002 },
        { Symbol: 'AMZN', Date: '2016-01-08', Close: 607.049988 },
        { Symbol: 'AMZN', Date: '2016-01-11', Close: 617.73999 },
        { Symbol: 'AMZN', Date: '2016-01-12', Close: 617.890015 },
        { Symbol: 'AMZN', Date: '2016-01-13', Close: 581.809998 },
        { Symbol: 'AMZN', Date: '2016-01-14', Close: 593 },
        { Symbol: 'AMZN', Date: '2016-01-15', Close: 570.179993 },
        { Symbol: 'AMZN', Date: '2016-01-19', Close: 574.47998 },
        { Symbol: 'AMZN', Date: '2016-01-20', Close: 571.77002 },
        { Symbol: 'AMZN', Date: '2016-01-21', Close: 575.02002 },
        { Symbol: 'AMZN', Date: '2016-01-22', Close: 596.380005 },
        { Symbol: 'AMZN', Date: '2016-01-25', Close: 596.530029 },
        { Symbol: 'AMZN', Date: '2016-01-26', Close: 601.25 },
        { Symbol: 'AMZN', Date: '2016-01-27', Close: 583.349976 },
        { Symbol: 'AMZN', Date: '2016-01-28', Close: 635.349976 },
        { Symbol: 'AMZN', Date: '2016-01-29', Close: 587 },
        { Symbol: 'GOOG', Date: '2016-01-04', Close: 741.840027 },
        { Symbol: 'GOOG', Date: '2016-01-05', Close: 742.580017 },
        { Symbol: 'GOOG', Date: '2016-01-06', Close: 743.619995 },
        { Symbol: 'GOOG', Date: '2016-01-07', Close: 726.390015 },
        { Symbol: 'GOOG', Date: '2016-01-08', Close: 714.469971 },
        { Symbol: 'GOOG', Date: '2016-01-11', Close: 716.030029 },
        { Symbol: 'GOOG', Date: '2016-01-12', Close: 726.070007 },
        { Symbol: 'GOOG', Date: '2016-01-13', Close: 700.559998 },
        { Symbol: 'GOOG', Date: '2016-01-14', Close: 714.719971 },
        { Symbol: 'GOOG', Date: '2016-01-15', Close: 694.450012 },
        { Symbol: 'GOOG', Date: '2016-01-19', Close: 701.789978 },
        { Symbol: 'GOOG', Date: '2016-01-20', Close: 698.450012 },
        { Symbol: 'GOOG', Date: '2016-01-21', Close: 706.590027 },
        { Symbol: 'GOOG', Date: '2016-01-22', Close: 725.25 },
        { Symbol: 'GOOG', Date: '2016-01-25', Close: 711.669983 },
        { Symbol: 'GOOG', Date: '2016-01-26', Close: 713.039978 },
        { Symbol: 'GOOG', Date: '2016-01-27', Close: 699.98999 },
        { Symbol: 'GOOG', Date: '2016-01-28', Close: 730.960022 },
        { Symbol: 'GOOG', Date: '2016-01-29', Close: 742.950012 },
        { Symbol: 'IBM', Date: '2016-01-04', Close: 135.949997 },
        { Symbol: 'IBM', Date: '2016-01-05', Close: 135.850006 },
        { Symbol: 'IBM', Date: '2016-01-06', Close: 135.169998 },
        { Symbol: 'IBM', Date: '2016-01-07', Close: 132.860001 },
        { Symbol: 'IBM', Date: '2016-01-08', Close: 131.630005 },
        { Symbol: 'IBM', Date: '2016-01-11', Close: 133.229996 },
        { Symbol: 'IBM', Date: '2016-01-12', Close: 132.899994 },
        { Symbol: 'IBM', Date: '2016-01-13', Close: 131.169998 },
        { Symbol: 'IBM', Date: '2016-01-14', Close: 132.910004 },
        { Symbol: 'IBM', Date: '2016-01-15', Close: 130.029999 },
        { Symbol: 'IBM', Date: '2016-01-19', Close: 128.110001 },
        { Symbol: 'IBM', Date: '2016-01-20', Close: 121.860001 },
        { Symbol: 'IBM', Date: '2016-01-21', Close: 122.910004 },
        { Symbol: 'IBM', Date: '2016-01-22', Close: 122.5 },
        { Symbol: 'IBM', Date: '2016-01-25', Close: 122.080002 },
        { Symbol: 'IBM', Date: '2016-01-26', Close: 122.589996 },
        { Symbol: 'IBM', Date: '2016-01-27', Close: 120.959999 },
        { Symbol: 'IBM', Date: '2016-01-28', Close: 122.220001 },
        { Symbol: 'IBM', Date: '2016-01-29', Close: 124.790001 },
        { Symbol: 'MSFT', Date: '2016-01-04', Close: 54.799999 },
        { Symbol: 'MSFT', Date: '2016-01-05', Close: 55.049999 },
        { Symbol: 'MSFT', Date: '2016-01-06', Close: 54.049999 },
        { Symbol: 'MSFT', Date: '2016-01-07', Close: 52.169998 },
        { Symbol: 'MSFT', Date: '2016-01-08', Close: 52.330002 },
        { Symbol: 'MSFT', Date: '2016-01-11', Close: 52.299999 },
        { Symbol: 'MSFT', Date: '2016-01-12', Close: 52.779999 },
        { Symbol: 'MSFT', Date: '2016-01-13', Close: 51.639999 },
        { Symbol: 'MSFT', Date: '2016-01-14', Close: 53.110001 },
        { Symbol: 'MSFT', Date: '2016-01-15', Close: 50.990002 },
        { Symbol: 'MSFT', Date: '2016-01-19', Close: 50.560001 },
        { Symbol: 'MSFT', Date: '2016-01-20', Close: 50.790001 },
        { Symbol: 'MSFT', Date: '2016-01-21', Close: 50.48 },
        { Symbol: 'MSFT', Date: '2016-01-22', Close: 52.290001 },
        { Symbol: 'MSFT', Date: '2016-01-25', Close: 51.790001 },
        { Symbol: 'MSFT', Date: '2016-01-26', Close: 52.169998 },
        { Symbol: 'MSFT', Date: '2016-01-27', Close: 51.220001 },
        { Symbol: 'MSFT', Date: '2016-01-28', Close: 52.060001 },
        { Symbol: 'MSFT', Date: '2016-01-29', Close: 55.09 }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();
```
