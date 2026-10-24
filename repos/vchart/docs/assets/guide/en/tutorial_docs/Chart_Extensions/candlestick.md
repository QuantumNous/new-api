# Extend Chart: Candlestick Chart

Candlestick Chart (K-line Chart) is a common chart type in the financial field, used to display price trends over a period of time, including four key price points: open price, high price, low price, and close price.

VChart provides a candlestick chart extension component that supports flexible style configuration and interactive features, meeting various financial data visualization needs.

![img](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/candlestick/candlestick-basic.png)

## How to use extended charts

The candlestick chart needs to be manually registered before use. The registration and usage methods are as follows:

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

If it is introduced through CDN, the registration method is as follows:

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

## Related Configuration

```js
export interface ICandlestickSeriesSpec
  extends Omit<ICartesianSeriesSpec, 'xField' | 'yField' | 'direction'>,
    IAnimationSpec<SeriesMarkNameEnum.boxPlot, string> {
  type: 'candlestick';
  /**
   * Time axis field
   */
  xField: string | string[];
  /**
   * Open price field
   */
  openField?: string;
  /**
   * High price field
   */
  highField?: string;
  /**
   * Low price field
   */
  lowField?: string;
  /**
   * Close price field
   */
  closeField?: string;
  /**
   * Rising candlestick color
   */
  rising?: IMarkSpec<ICandlestickMarkSpec>;
  /**
   * Falling candlestick color
   */
  falling?: IMarkSpec<ICandlestickMarkSpec>;
  /**
   * Doji candlestick color
   */
  doji?: IMarkSpec<ICandlestickMarkSpec>;
  /**
   * Candlestick mark configuration
   */
  candlestick?: IMarkSpec<ICandlestickMarkSpec>;
}

export interface ICandlestickMarkSpec extends ICommonSpec {
  /**
   * Box width
   */
  boxWidth?: number;
  /**
   * Box fill color, not filled if empty
   */
  boxFill?: string | ((datum: Datum) => string);
  /**
   * Low price
   */
  low?: (datum: Datum) => number;
  /**
   * Close price
   */
  close?: (datum: Datum) => number;
  /**
   * Open price
   */
  open?: (datum: Datum) => number;
  /**
   * High price
   */
  high?: (datum: Datum) => number;
}
```

## Candlestick Chart Examples

- [Basic Candlestick Chart](/vchart/demo/candlestick-charts/candlestick-basic)
- [Candlestick with Moving Average](/vchart/demo/candlestick-charts/candlestick-with-MA)

## Configuration Details

### Data Field Configuration

The candlestick chart requires the following data fields to be configured:

- `xField`: Time axis field, used to display the time dimension
- `openField`: Open price field
- `highField`: High price field
- `lowField`: Low price field
- `closeField`: Close price field

### Style Configuration

The candlestick chart supports style configuration for three states:

- `rising`: Style configuration for rising state (close price > open price)
- `falling`: Style configuration for falling state (close price < open price)
- `doji`: Style configuration for doji state (close price = open price)

Each state can be configured with the following style properties:

- `boxWidth`: The width of the candlestick box
- `boxFill`: The fill color of the box
- `stroke`: Border color
- `lineWidth`: Border width

### Animation Configuration

The candlestick chart has built-in entry and exit animations, and custom animation effects can be configured through `animation`. The default animations are `candlestickScaleIn` and `candlestickScaleOut`.

## Best Practices

1. **Data Preparation**: Ensure the data contains complete time, open price, high price, low price, and close price fields
2. **Color Configuration**: It is recommended to use red for rising and green for falling, in line with domestic market habits
3. **Responsive Design**: On small screen devices, `boxWidth` can be appropriately reduced to avoid candlestick overlap
4. **Combination Charts**: Can be combined with volume bar charts to provide a more comprehensive market analysis view