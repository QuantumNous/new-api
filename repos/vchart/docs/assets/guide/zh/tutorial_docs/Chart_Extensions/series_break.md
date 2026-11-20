# 系列截断组件

系列截断组件配合轴截断功能一起使用，可以对图表中的系列进行截断显示。
目前支持如下系列类型的截断展示：

- `bar` 柱系列
- `line` 线系列
- `area` 面积系列

![img](/vchart/guide/extension/series-break.png)

## 如何开启轴截断

轴截断式 VChart 主包就支持的功能，所以只需要在轴上开启，现在只有连续轴支持轴截断功能，配置示例如下：

```js
axes: [
  {
    orient: 'left',
    breaks: [
      {
        range: [2100, 22900]
      },
      {
        range: [700, 900]
      }
    ],
    nice: false,
    tick: {
      tickMode: 'd3'
    },

    domainLine: {
      visible: true
    }
  }
];
```

具体配置参考： [柱图轴截断配置](/vchart/option/barChart-axes-linear#breaks)

## 如何开启系列截断

系列截断组件需要在图表上注册，注册和使用方式如下：

```js
import VChart from '@visactor/vchart';
import { registerSeriesBreak, appendSeriesBreakConfig } from '@visactor/vchart-extension';

const spec = {
  //  your spec
};
registerSeriesBreak();
appendSeriesBreakConfig(spec);

const vchart = new VChart(spec, { dom: 'chart' });
vchart.renderSync();
```

如果是通过 cdn 引入的方式，注册方式如下：

```html
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart-extension/build/index.min.js"></script>
<script>
  const spec = {
    //  your spec
  };
  VChartExtension.registerSeriesBreak();
  VChartExtension.appendSeriesBreakConfig(spec);

  const vchart = new VChart.defatult(spec, { dom: 'chart' });
  vchart.renderSync();
</script>
```

## 轴截断示例

- [简单柱图轴截断](/vchart/demo/bar-chart/bar-break-by-axis)
