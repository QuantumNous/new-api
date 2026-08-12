{{ target: common-layout }}

<!-- ILayoutSpec  -->

## layout(Object)

图表布局配置，目前除了图表默认的 **占位布局** 外。图表的初始化函数中也支持传入自定义布局函数

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

图表的配置中还支持另一种布局模式 **Grid 布局**

### type(string) = 'grid'

布局类型，目前除了默认值外仅支持**grid**。

### col(number)

grid 的列数

### row(number)

grid 的行数

### colWidth(Array)

可选配置，指定某几列的宽度

#### index(number)

指定列数，序号从 0 开始。

#### size(number|Function)

这一列的宽度

使用示例：

```ts
// 数值类型，设置这一列的列宽为 5px
size: 5;
// 函数类型，设置这一列的列宽为总宽度 * 0.2 + 20px
size: totalSize => totalSize * 0.2 + 20;
```

### rowHeight(Array)

可选配置，指定某几行的高度

#### index(number)

指定行数，序号从 0 开始。

#### size(number|Function)

这一行的高度

使用示例：

```ts
// 数值类型，设置这一行的行高为 5px
size: 5;
// 函数类型，设置这一行的行高为总高度 * 0.2 + 20px
size: totalSize => totalSize * 0.2 + 20;
```

### elements(Array)

必选，请务必指定**所有图表元素**所在位置，图表元素的位置起点和占几行几列，可以占多行多列。图表元素位置允许配置重叠。

#### modelId(string|number)

布局元素对应的 id。`modelId`和`modelKey`必须至少指定一个。

#### modelKey(string)

布局元素对应的`spec key`，例如 `'legends'` 表示图例。`modelKey`和`modelId`必须至少指定一个。

#### modelIndex(number)

与`modelKey`一起使用，用于指定布局元素在组件中的序号。

#### col(number)

必选，指定布局元素的位置起点列数，序号从 0 开始。

#### row(number)

必选，指定布局元素的位置起点行数，序号从 0 开始。

#### colSpan(number) = 1

指定布局元素占几列，默认 1 列

#### rowSpan(number) = 1

指定布局元素占几行，默认 1 行
