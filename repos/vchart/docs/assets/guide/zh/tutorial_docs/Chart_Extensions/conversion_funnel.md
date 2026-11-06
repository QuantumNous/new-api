# 扩展图表：转化率漏斗图

在漏斗图中，需要展示转换率箭头是一种比较常见的需求。

通常来说，通过 VChart 的扩展图元能力，可以实现自定义转化率箭头，例如这个[示例](/vchart/demo/funnel-chart/funnel-custom-annotation)。

我们将自定义箭头的布局算法、漏斗层背景等相对常见的展示形式，沉淀封装了转化率漏斗图。

![img](/vchart/guide/extension/conversion-funnel.png)

## 如何使用扩展图表

转化率漏斗图需要在手动注册，注册和使用方式如下：

```js
import VChart from '@visactor/vchart';
import { registerConversionFunnelChart } from '@visactor/vchart-extension';

const spec = {
  type: 'conversionFunnel'
  //  your spec
};
registerConversionFunnelChart();

const vchart = new VChart(spec, { dom: 'chart' });
vchart.renderSync();
```

如果是通过 cdn 引入的方式，注册方式如下：

```html
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart-extension/build/index.min.js"></script>
<script>
  const spec = {
    type: 'conversionFunnel'

    //  your spec
  };
  VChartExtension.registerConversionFunnelChart();

  const vchart = new VChart.defatult(spec, { dom: 'chart' });
  vchart.renderSync();
</script>
```

## 相关配置项

```js
export interface Arrow {
  /**
   * from 节点索引
   */
  from: number;
  /**
   * to 节点索引
   */
  to: number;
  /**
   * 箭头位置
   */
  position?: 'left' | 'right';
  /**
   * 箭头与柱子之间的距离
   */
  distance?: number;
  /**
   * 箭头文字
   */
  text?: string;
}


export interface IConversionFunnelSpec {
  /**
   * 转化率箭头配置
   */
  conversionArrow?: {
    /**
     * 箭头配置
     */
    arrows?: Arrow[];
    /**
     * 箭头与柱子之间的距离
     * @default 12
     */
    margin?: number;
    /**
     * 箭头线配置
     */
    line?: IMarkSpec<Omit<IPathMarkSpec, 'points' | 'fill'>>;
    /**
     * 箭头符号配置
     */
    symbol?: IMarkSpec<ISymbolMarkSpec>;
    /**
     * 标签配置
     */
    text?: IMarkSpec<ITextMarkSpec> & {
      /**
       * 箭头文字格式化方法
       */
      formatMethod?: IFormatMethod<[text: string, params?: { from: any; to: any; arrow: Arrow }]>;
      /**
       * 箭头文本与柱子之间的距离
       * @default 4
       */
      textMargin?: number;
    };
  };
  /**
   * 漏斗层背景配置
   */
  funnelBackground?: IMarkSpec<IRectMarkSpec>;
}
```

## 转化率漏斗图示例

- [自定义漏斗图转化率箭头](/vchart/demo/funnel-chart/conversion-funnel)
