{{ target: common-interaction }}

#${prefix} interactions(Array)

从 @1.9.0 版本开始支持，配置格式如：

```ts
{
  interactions: [
    {
      type: 'element-active'
    }
  ];
}
```

具体支持的交互类型，后面会具体介绍:

##${prefix} markIds(Array)

指定触发交互的图元 id，如果不传，各个系列内置的图元默认都会触发

##${prefix} markNames(Array)

指定触发交互的图元 name，如果不传，各个系列内置的图元默认都会触发；举个例子，面积图元中，如果只想对线 和填充面积生效，可以如下配置：

```
markNames: ['line', 'area']
```

注意，如果同时交互同时设置了 `markIds`和`markNames`，`markIds`优先级更高

##${prefix} type(string)

设置交互类型

##${prefix} type.element-acitve

将触发元素的状态设置为激活状态

###${prefix} state(string) = 'active'

激活状态对应的状态名称

###${prefix} trigger(string | string[]) = 'pointerover'

交互的触发事件配置
{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

交互的终止事件配置
{{ use: element-active-trigger}}

##${prefix} type.element-highlight

元素高亮交互，将触发元素的状态设置为高亮状态，其他元素的状态设置为失焦状态；注意该交互不建议和默认的`hover`交互同时使用

###${prefix} highlightState(string) = 'highlight'

高亮状态对应的状态名称

###${prefix} blurState(string) = 'blur'

失焦状态对应的状态名称

###${prefix} trigger(string | string[]) = 'pointerover'

交互的触发事件配置
{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

交互的终止事件配置
{{ use: element-active-trigger}}

##${prefix} type.element-select

元素选中交互，将触发元素的状态设置为选中状态；注意该交互不建议和默认的`select`交互同时使用

###${prefix} state(string) = 'selected'

选中状态对应的状态名称

###${prefix} isMultiple(boolean) = true

是否支持多选

###${prefix} trigger(string | string[]) = 'click'

交互的触发事件配置
{{ use: element-active-trigger}}

###${prefix} triggerOff(string | number | string[]) = 'pointerout'

交互的终止事件配置；支持的配置有：

- 'empty': 点击空白处
- number: 定时清除选中状态
- 其他事件名称
  {{ use: element-active-trigger}}

##${prefix} type.element-highlight-by-legend

图例触发图元高亮、失焦状态

###${prefix} filterType('groupKey' | 'key') = 'groupKey'

图例去查询高亮图元对应的元素的时候，过滤高亮元素的类型，支持两种配置：

- `'groupKey'` 分组 key 和图例 key 相同的时候，高亮该元素，如线图中，通过图例高亮线
- `'key'` 图形 key 和图例 key 相同的时候，高亮该元素，如饼图中，通过图例高亮扇区；注意需要结合系列配置中的 `dataKey`一起使用

###${prefix} filterField(string)

读取图元数据对应的字段和图例项的`key`值进行匹配

图例触发图元的高亮、失焦状态

###${prefix} highlightState(string) = 'highlight'

高亮状态对应的状态名称

###${prefix} blurState(string) = 'blur'

失焦状态对应的状态名称

###${prefix} trigger(string | string[]) = 'pointerover'

交互的触发事件配置
{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

交互的终止事件配置
{{ use: element-active-trigger}}

##${prefix} type.element-active-by-legend

图例触发图元激活状态

###${prefix} filterType('groupKey' | 'key') = 'groupKey'

图例去查询高亮图元对应的元素的时候，过滤高亮元素的类型，支持两种配置：

- `'groupKey'` 分组 key 和图例 key 相同的时候，高亮该元素，如线图中，通过图例高亮线
- `'key'` 图形 key 和图例 key 相同的时候，高亮该元素，如饼图中，通过图例高亮扇区；注意需要结合系列配置中的 `dataKey`一起使用

###${prefix} filterField(string)

读取图元数据对应的字段和图例项的`key`值进行匹配

###${prefix} state(string) = 'active'

激活状态对应的状态名称

###${prefix} trigger(string | string[]) = 'pointerover'

交互的触发事件配置
{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

交互的终止事件配置
{{ use: element-active-trigger}}

##${prefix} type.element-highlight-by-group

将触发元素以及和触发元素具有相同分组值（`groupKey`）的元素状态设置为高亮状态，其他元素的状态设置为失焦状态

###${prefix} highlightState(string) = 'highlight'

高亮状态对应的状态名称

###${prefix} blurState(string) = 'blur'

失焦状态对应的状态名称

###${prefix} trigger(string | string[]) = 'pointerover'

交互的触发事件配置
{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

交互的终止事件配置
{{ use: element-active-trigger}}

##${prefix} type.element-highlight-by-key

将触发元素以及和触发元素具有相同`key`的元素状态设置为高亮状态，其他元素的状态设置为失焦状态；一般需要配合系列的`dataKey` 配置使用

###${prefix} highlightState(string) = 'highlight'

高亮状态对应的状态名称

###${prefix} blurState(string) = 'blur'

失焦状态对应的状态名称

###${prefix} trigger(string | string[]) = 'pointerover'

交互的触发事件配置
{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

交互的终止事件配置
{{ use: element-active-trigger}}

##${prefix} type.element-highlight-by-name

根据`graphicName`来过滤触发元素，根据`filterType`或者`filterField`过滤高亮元素，将高亮元素的状态设置为高亮状态，其他元素设置为失焦状态；

###${prefix} graphicName(string|Array)

触发元素的`name`值；注意这个`name` 值是 vchart 内部生成的；现在支持的配置有：

- `'axis-label'` 轴标签

###${prefix} parseData(Function)

解析触发元素对应的值，使用该值去匹配高亮元素；
对于类型为`text`的元素，我们会读取`text`属性，作为匹配值；

###${prefix} filterType('groupKey' | 'key') = 'groupKey'

过滤高亮元素的类型，支持两种配置：

- `'groupKey'` 分组 key 和图例 key 相同的时候，高亮该元素，如线图中，通过图例高亮线
- `'key'` 图形 key 和图例 key 相同的时候，高亮该元素，如饼图中，通过图例高亮扇区；注意需要结合系列配置中的 `dataKey`一起使用

###${prefix} filterField(string)

读取图元数据对应的字段和触发元素进行匹配

###${prefix} highlightState(string) = 'highlight'

高亮状态对应的状态名称

###${prefix} blurState(string) = 'blur'

失焦状态对应的状态名称

###${prefix} trigger(string | string[]) = 'pointerover'

交互的触发事件配置
{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

交互的终止事件配置
{{ use: element-active-trigger}}

##${prefix} type.element-highlight-by-graphic-name

读取图元名称，将名称相同的所有图元的状态设置为高亮状态，其他元素的状态设置为失焦状态；注意该交互不建议和默认的`hover`交互同时使用（象形图除外）

###${prefix} highlightState(string) = 'highlight'

高亮状态对应的状态名称

###${prefix} blurState(string) = 'blur'

失焦状态对应的状态名称

###${prefix} trigger(string | string[]) = 'pointerover'

交互的触发事件配置
{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

交互的终止事件配置
{{ use: element-active-trigger}}

##${prefix} type.element-select-by-graphic-name

元素选中交互，将所有相同名称的元素的状态设置为选中状态；注意该交互不建议和默认的`select`交互同时使用（象形图除外）

###${prefix} state(string) = 'selected'

选中状态对应的状态名称

###${prefix} isMultiple(boolean) = true

是否支持多选

###${prefix} trigger(string | string[]) = 'click'

交互的触发事件配置
{{ use: element-active-trigger}}

###${prefix} triggerOff(string | number | string[]) = 'pointerout'

交互的终止事件配置；支持的配置有：

- 'empty': 点击空白处
- number: 定时清除选中状态
- 其他事件名称
  {{ use: element-active-trigger}}
