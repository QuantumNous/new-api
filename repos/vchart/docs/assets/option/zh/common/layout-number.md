{{ target: common-layout-number }}

<!-- ILayoutNumber -->

支持直接配置数值（单位 px）、百分比（`${number}%`）(图表视窗尺寸的百分比) 以及回调配置。回调函数定义如下：

```ts
interface ILayoutRect {
  width: number;
  height: number;
}

(layoutRect: ILayoutRect) => number;
```

使用示例:

- 数值：`45` 为像素值 px
- 百分比：`'10%'` 当在水平方向时是**图表视图区域** `宽度` 的百分比，当在垂直方向时是**图表视图区域** `高度` 的百分比
- 回调：`({ width, height }) => width * 0.5` 返回值被当做像素值 px
