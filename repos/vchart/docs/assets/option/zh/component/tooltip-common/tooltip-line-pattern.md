{{ target: component-tooltip-line-pattern }}

<!-- ITooltipLinePattern -->

#${prefix} visible(boolean) = true

当前行是否显示。

{{ if: ${content} }}
#${prefix} key(string|Function)

tooltip 当前行 key 列的内容。如果配置为字符串，则显示为对应的常量文本。

{{ if: ${supportFunction} }}

也可配置为函数回调，类型为：

```ts
(datum: Datum) => string;
```

其中 `datum` 为 tooltip 当前行所默认对应的数据项。

如果想要读取数据项中特定字段的内容，可以通过设置`field`实现，类型如下：

```ts
// （自 1.13.0 支持）
{
  field: string;
}
```

{{ /if }}

#${prefix} keyTimeFormat(string) = '%Y%m%d'

key 的时间转换格式。

| **日期粒度** | **格式配置** | **日期内容**         | **示例**  | **数值范围** |
| ------------ | ------------ | -------------------- | --------- | ------------ |
| 年           | %Y           | 年的全称             | 2022      |              |
| 月           | %b           | 简写的月             | Jul       |              |
|              | %B           | 月的全称             | July      |              |
|              | %m           | 月份                 | 7         | [01, 12]     |
| 周           | %a           | 简写的周             | Wed       |              |
|              | %A           | 周的全称             | Wednesday |              |
| 日           | %d           | 使用 0 填补位数的天  | 1         | [01, 31]     |
|              | %e           | 使用空格填补位数的天 | 1         | [ 1, 31]     |
| 时           | %H           | 24 小时制小时        | 1         | [00, 23]     |
|              | %I           | 12 小时制小时        | 1         | [01, 12]     |
|              | %p           | AM 或 PM             | AM        |              |
| 分           | %M           | 分钟                 | 0         | [00, 59]     |
| 秒           | %S           | 秒                   | 0         | [00, 61]     |
| 毫秒         | %L           | 毫秒                 | 1         | [000, 999]   |

#${prefix} keyTimeFormatMode(string) = 'local'

key 的时间转换模式。支持`'utc' | 'local'`模式。

#${prefix} keyFormatter(string)

格式化字符串模版，自`1.10.0`版本开始支持。

用`{}`包裹变量名的字符串模版，变量名取自数据属性值。

例如，`keyFormatter: '{label:~s}'`

详细使用文档请参考[教程文档](/vchart/guide/tutorial_docs/Chart_Plugins/Formatter)和[Demo](/vchart/demo/label/label-formatter)。

{{ /if }}

#${prefix} value(string|Function|Object)

tooltip 当前行 value 列的内容。
如果配置为字符串，则显示为对应的常量文本。
也可配置为富文本配置，类型为：

```ts
{
    /**
     * 主标题文本类型（默认类型为text）
     * text, rich
     */
    type?: string;
    /**
     * 标题文本内容
     * - 支持富文本配置
     */
    text?: IRichTextCharacter[] | string;
}
```

{{ if: ${supportFunction} }}

也可配置为函数回调，类型为：

```ts
(datum: Datum) => string;
```

如果想要读取数据项中特定字段的内容，可以通过设置`field`实现，类型如下：

```ts
// （自 1.13.0 支持）
{
  field: string;
}
```

{{ /if }}

其中 `datum` 为 tooltip 当前行所默认对应的数据项。

#${prefix} valueTimeFormat(string) = '%Y%m%d'

value 的时间转换格式。

| **日期粒度** | **格式配置** | **日期内容**         | **示例**  | **数值范围** |
| ------------ | ------------ | -------------------- | --------- | ------------ |
| 年           | %Y           | 年的全称             | 2022      |              |
| 月           | %b           | 简写的月             | Jul       |              |
|              | %B           | 月的全称             | July      |              |
|              | %m           | 月份                 | 7         | [01, 12]     |
| 周           | %a           | 简写的周             | Wed       |              |
|              | %A           | 周的全称             | Wednesday |              |
| 日           | %d           | 使用 0 填补位数的天  | 1         | [01, 31]     |
|              | %e           | 使用空格填补位数的天 | 1         | [ 1, 31]     |
| 时           | %H           | 24 小时制小时        | 1         | [00, 23]     |
|              | %I           | 12 小时制小时        | 1         | [01, 12]     |
|              | %p           | AM 或 PM             | AM        |              |
| 分           | %M           | 分钟                 | 0         | [00, 59]     |
| 秒           | %S           | 秒                   | 0         | [00, 61]     |
| 毫秒         | %L           | 毫秒                 | 1         | [000, 999]   |

#${prefix} valueTimeFormatMode(string) = 'local'

value 的时间转换模式。支持`'utc' | 'local'`模式。

#${prefix} valueFormatter(string)

格式化字符串模版，自`1.10.0`版本开始支持。

用`{}`包裹变量名的字符串模版，变量名取自数据属性值。

例如，`keyFormatter: '{label:~s}'`

详细使用文档请参考[教程文档](/vchart/guide/tutorial_docs/Chart_Plugins/Formatter)和[Demo](/vchart/demo/label/label-formatter)。

{{ if: ${content} }}

{{ if: ${supportFunction} }}

{{ use: component-tooltip-shape-pattern(
  prefix = ${prefix},
  type = 'pattern'
) }}

{{ else }}

{{ use: component-tooltip-shape-pattern(
  prefix = ${prefix},
  type = 'style'
) }}

{{ /if }}

{{ /if }}
