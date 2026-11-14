{{ target: mark-box-plot }}

<!-- IBoxPlotMarkSpec -->

#${prefix} shaftShape(string) = 'line'
箱线图的绘制形状，控制箱线图的视觉呈现方式

可选值：

- `'line'` - 标准线条形式，箱体为矩形，须线为线条
- `'bar'` - 柱状形式，使用矩形表示数据范围
- `'filled-line'` - 填充线条形式

#${prefix} boxWidth(number|string)
箱体的宽度（垂直箱线图）或高度（水平箱线图）

支持数字或百分比字符串。为空时自适应分组宽度。

默认值：`30`

#${prefix} boxHeight(number|string)
箱体的高度（垂直箱线图）或宽度（水平箱线图）

支持数字或百分比字符串。

#${prefix} shaftWidth(number|string)
须线端点的宽度（垂直箱线图）或高度（水平箱线图）

支持数字或百分比字符串。为空时自适应。仅在 `shaftShape='line'` 或 `'filled-line'` 时生效。

默认值：`20`

#${prefix} ruleWidth(number|string)
须线端点横线的宽度（垂直箱线图）或高度（水平箱线图）

仅在 `shaftShape='line'` 或 `'filled-line'` 时生效。

#${prefix} ruleHeight(number|string)
须线端点横线的高度（垂直箱线图）或宽度（水平箱线图）

仅在 `shaftShape='line'` 或 `'filled-line'` 时生效。

#${prefix} minMaxWidth(number|string)
以下配置仅在 `shaftShape='bar'` 时生效。
最小-最大值矩形的宽度（垂直箱线图）或高度（水平箱线图）

#${prefix} minMaxHeight(number|string)
最小-最大值矩形的高度（垂直箱线图）或宽度（水平箱线图）

#${prefix} q1q3Width(number|string)
Q1-Q3 四分位数矩形的宽度（垂直箱线图）或高度（水平箱线图）

#${prefix} q1q3Height(number|string)
Q1-Q3 四分位数矩形的高度（垂直箱线图）或宽度（水平箱线图）

#${prefix} lineWidth(number) = 2
箱线图的描边宽度

在 `shaftShape='line'` 或 `'filled-line'` 模式下影响所有线条的宽度。
在 `shaftShape='bar'` 模式下不显示描边。

#${prefix} stroke(string)
箱线图的描边颜色

#${prefix} boxStroke(string)
箱体的描边颜色，可单独设置以区别于其他部分

{{ use: common-version(version: '2.0.11') }}

#${prefix} medianStroke(string)
中位数线的描边颜色，可单独设置以突出显示中位数

{{ use: common-version(version: '2.0.11') }}

#${prefix} boxFill(string)
箱体的填充颜色，为空则不填充

#${prefix} minMaxFillOpacity(number)
最小-最大值矩形的填充透明度

仅在 `shaftShape='bar'` 模式下生效。

#${prefix} boxCornerRadius(number)
箱体的圆角半径，设置后箱体四角将显示为圆角

{{ use: common-version(version: '2.0.11') }}

#${prefix} min(Function)
最小值的数据映射函数

类型：`(datum: Datum) => number`

#${prefix} q1(Function)
第一四分位数（Q1，25%分位数）的数据映射函数

类型：`(datum: Datum) => number`

#${prefix} median(Function)
中位数（Q2，50%分位数）的数据映射函数

类型：`(datum: Datum) => number`

#${prefix} q3(Function)
第三四分位数（Q3，75%分位数）的数据映射函数

类型：`(datum: Datum) => number`

#${prefix} max(Function)
最大值的数据映射函数

类型：`(datum: Datum) => number`
