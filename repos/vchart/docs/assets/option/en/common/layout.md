{{ target: common-layout }}

<!-- ILayoutSpec  -->

## layout(Object)

Chart layout configuration, currently, besides the default **placeholder layout**. The chart initialization function also supports passing in custom layout functions

```ts
/**
* 自定义布局函数
* 对布局元素布局
* 布局策略随意
* @param chart chart对象
* @param item 布局元素数组
* @param chartLayoutRect 排除图表 padding 后的图表的布局矩形，原点是图表绘制区域左上角。
* @param chartViewBox 图表在画布中的可用空间，包含图表padding，原点是画布左上角
*/
const type LayoutCallBack = (chart: IChart, item: ILayoutItem[], chartLayoutRect: IRect, chartViewBox: IBoundsLike) => void;

/**
 * 每一个布局元素拥有的属性
 */
export interface ILayoutItem {
  // 模块类型
  type: string;
  // 布局类型
  layoutType: 'region' | 'normal' | 'absolute';

  /** 获取布局位置和大小 */
  getLayoutStartPoint: () => ILayoutPoint;
  getLayoutRect: () => ILayoutRect;

  /** 更新元素布局的 layoutRect 大小，用来更新指定布局空间 */
  setLayoutRect: (rect: Partial<ILayoutRect>, levelMap?: Partial<ILayoutRectLevel>) => void;
  /** 基于元素内部逻辑计算占位空间，rect表示可用空间 */
  computeBoundsInRect: (rect: ILayoutRect) => ILayoutRect;
  /** 更新元素布局的起始点位置 */
  setLayoutStartPosition: (pos: Partial<IPoint>) => void;
  /** 元素内部布局信息更新 */
  updateLayoutAttribute: () => void;

  /** 更新绝对布局元素的位置信息 */
  absoluteLayoutInRect: (rect: IRect) => void;
}

// example
const chart = new VChart(spec,{
  layout: (chart: IChart, item: ILayoutItem[], chartLayoutRect: IRect, chartViewBox: IBoundsLike)=>{
    // 使用布局元素的属性和提供的方法完成布局
    item.forEach(i=>{
      // 请在布局完成后务必调用
      i.setLayoutStartPosition(pos);
      i.setLayoutRect(rect);
      i.updateLayoutAttribute();
      // 绝对定位元素可以使用内置方法，直接按照图表信息绝对定位
      if(i.layoutType === 'absolute'){
        i.absoluteLayoutInRect(rect);
      }
    })
  }
})

```

The chart configuration also supports another layout mode: **Grid layout**

### type(string) = 'grid'

Layout type, currently, besides default value, it only supports **grid**.

### col(number)

Number of columns in the grid

### row(number)

Number of rows in the grid

### colWidth(Array)

Optional configuration, specify the width of certain columns

#### index(number)

Specify the column number, starting from 0.

#### size(number|Function)

The width of this column

Usage example：

```ts
// 数值类型，设置这一列的列宽为 5px
size: 5;
// 函数类型，设置这一列的列宽为总宽度 * 0.2 + 20px
size: totalSize => totalSize * 0.2 + 20;
```

### rowHeight(Array)

Optional configuration, specify the height of certain rows

#### index(number)

Specify the row number, starting from 0.

#### size(number|Function)

The height of this row

Usage example：

```ts
// 数值类型，设置这一行的行高为 5px
size: 5;
// 函数类型，设置这一行的行高为总高度 * 0.2 + 20px
size: totalSize => totalSize * 0.2 + 20;
```

### elements(Array)

Required, be sure to specify the location of **all chart elements**, the starting point of the chart element's position, and how many rows and columns it occupies. Chart elements can span multiple rows and columns. Overlapping chart element positions is allowed.

#### modelId(string|number)

The id corresponding to the layout element. Either `modelId` or `modelKey` must be specified.

#### modelKey(string)

The `spec key` corresponding to the layout element, for example, `'legends'` represents the legend. Either `modelKey` or `modelId` must be specified.

#### modelIndex(number)

Used with `modelKey` to specify the index of the layout element in the component.

#### col(number)

Specify the starting point column number for the layout element, starting from 0.

#### row(number)

Specify the starting point row number for the layout element, starting from 0.

#### colSpan(number) = 1

Specify how many columns the layout element occupies, 1 column by default

#### rowSpan(number) = 1

Specify how many rows the layout element occupies, 1 row by default
