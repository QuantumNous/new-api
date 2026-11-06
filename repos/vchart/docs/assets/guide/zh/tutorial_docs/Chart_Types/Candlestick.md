# 扩展图表：蜡烛图

蜡烛图（K 线图）是金融领域常用的图表类型，用于展示一段时间内的价格走势，包括开盘价、最高价、最低价和收盘价四个关键价格点。

VChart 提供了蜡烛图扩展组件，支持灵活的样式配置和交互功能，能够满足各种金融数据可视化需求。

![img](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/candlestick/candlestick-basic.png)

## 如何使用扩展图表

蜡烛图需要手动注册后才能使用，注册和使用方式如下：

```js
import VChart from '@visactor/vchart';
import { registerCandlestickChart } from '@visactor/vchart-extension';

const spec = {
  type: 'candlestick'
  //  your spec
};
registerCandlestickChart();

const vchart = new VChart(spec, { dom: 'chart' });
vchart.renderSync();
```

如果是通过 cdn 引入的方式，注册方式如下：

```html
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart-extension/build/index.min.js"></script>
<script>
  const spec = {
    type: 'candlestick'

    //  your spec
  };
  VChartExtension.registerCandlestickChart();

  const vchart = new VChart.default(spec, { dom: 'chart' });
  vchart.renderSync();
</script>
```

## 相关配置项

```js
export interface ICandlestickSeriesSpec
  extends Omit<ICartesianSeriesSpec, 'xField' | 'yField' | 'direction'>,
    IAnimationSpec<SeriesMarkNameEnum.boxPlot, string> {
  type: 'candlestick';
  /**
   * 时间轴字段
   */
  xField: string | string[];
  /**
   * 开盘价字段
   */
  openField?: string;
  /**
   * 最高价字段
   */
  highField?: string;
  /**
   * 最低价字段
   */
  lowField?: string;
  /**
   * 收盘价字段
   */
  closeField?: string;
  /**
   * 上涨蜡烛图颜色
   */
  rising?: IMarkSpec<ICandlestickMarkSpec>;
  /**
   * 下跌蜡烛图颜色
   */
  falling?: IMarkSpec<ICandlestickMarkSpec>;
  /**
   * 平盘蜡烛图颜色
   */
  doji?: IMarkSpec<ICandlestickMarkSpec>;
  /**
   * 蜡烛图标记配置
   */
  candlestick?: IMarkSpec<ICandlestickMarkSpec>;
}

export interface ICandlestickMarkSpec extends ICommonSpec {
  /**
   * 盒子宽度
   */
  boxWidth?: number;
  /**
   * 盒子填充颜色，为空则不填充
   */
  boxFill?: string | ((datum: Datum) => string);
  /**
   * 最低价
   */
  low?: (datum: Datum) => number;
  /**
   * 收盘价
   */
  close?: (datum: Datum) => number;
  /**
   * 开盘价
   */
  open?: (datum: Datum) => number;
  /**
   * 最高价
   */
  high?: (datum: Datum) => number;
}
```

## 蜡烛图示例

- [基础蜡烛图](/vchart/demo/candlestick-charts/candlestick-basic)
- [蜡烛与均线组合用法](/vchart/demo/candlestick-charts/candlestick-with-MA)

## 配置详解

### 数据字段配置

蜡烛图需要配置以下数据字段：

- `xField`: 时间轴字段，用于展示时间维度
- `openField`: 开盘价字段
- `highField`: 最高价字段
- `lowField`: 最低价字段
- `closeField`: 收盘价字段

### 样式配置

蜡烛图支持三种状态的样式配置：

- `rising`: 上涨状态（收盘价 > 开盘价）的样式配置
- `falling`: 下跌状态（收盘价 < 开盘价）的样式配置
- `doji`: 平盘状态（收盘价 = 开盘价）的样式配置

每种状态都可以配置以下样式属性：

- `boxWidth`: 蜡烛图盒子的宽度
- `boxFill`: 盒子的填充颜色
- `stroke`: 边框颜色
- `lineWidth`: 边框宽度

### 动画配置

蜡烛图内置了入场和出场动画，可以通过 `animation` 配置自定义动画效果。默认动画为 `candlestickScaleIn` 和 `candlestickScaleOut`。

## 最佳实践

1. **数据准备**：确保数据包含完整的时间、开盘价、最高价、最低价和收盘价字段
2. **颜色配置**：建议上涨使用红色、下跌使用绿色，符合国内市场习惯
3. **响应式设计**：在小屏幕设备上，可以适当减小 `boxWidth` 以避免蜡烛图重叠
4. **组合图表**：可以与成交量柱状图组合，提供更全面的市场分析视图
