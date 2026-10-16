{{ target: component-indicator-item }}

#${prefix} visible(boolean) = true

是否显示当前项

#${prefix} field(string)

文字内容字段。
优先级高于样式中 text 配置

#${prefix} space(number)

本文间距。

- `title.space`: title 和 content 之间的间距
- `contentItem.space`: content 之间的间距

#${prefix} autoLimit(boolean) = false

是否自适应文字空间进行缩略。

#${prefix} autoFit(boolean) = false

是否自适应文字空间缩放文字大小。

#${prefix} fitPercent(number) = 0.5

自适应文字宽度与可用空间的比例。

#${prefix} fitStrategy(string) = 'default'

自适应文字计算所采用的策略。可选项：

- 'default': 默认的自适应策略，每个文本依据可用空间独立计算字号；
- 'inscribed': 内切矩形计算策略，所有配置了 inscribed 策略的文本将会共同计算可用空间的内切矩形，避免与可用空间外元素产生遮挡。

#${prefix} formatMethod(Function)

自**1.11.11**版本开始支持

对文本进行格式化方法函数的，参数为：

```ts
/**
 * 格式化方法
 * @param text 文本内容
 * @param textStyle 计算出来的文本样式
 */
(text: string | number, textStyle: ITextGraphicAttribute) =>
  IFormatMethod<[activeDatum: Datum]> | ITextMarkSpec['text'] | ReturnType<IFormatMethod<[activeDatum: Datum]>>;
```

支持返回富文本配置，html 配置、react 配置，更详细的使用方式请参考[富文本教程](/vchart/guide/tutorial_docs/extend/Richtext_and_Dom)

#${prefix} style(Object)

文字样式。

自 `1.11.7` 版本后，指标卡文字样式上的图形属性除了支持正常的属性赋值外，也允许配置回调函数。例如：

```ts
indicator: {
  visible: true,
  content: [
    {
      visible: true,
      style: {
        fill: (data) => data['value'] > 100 ? "red": 'black',
      }
    }
  ]
}
```

##${prefix} type(string)

自 1.7.0 版本支持，文本类型

可选：

- 'text'
- 'rich'

##${prefix} text(string | number | Array)

文本内容。
自 1.7.0 版本支持富文本内容。

{{ use: graphic-text(
  prefix = '####'
) }}
