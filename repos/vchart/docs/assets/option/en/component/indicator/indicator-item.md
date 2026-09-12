{{ target: component-indicator-item }}

#${prefix} visible(boolean) = true

Whether to display the current item

#${prefix} field(string)

Text content field.
Higher priority than the text configuration in the style

#${prefix} space(number)

Text spacing.

- `title.space`: spacing between title and content
- `contentItem.space`: spacing between content

#${prefix} autoLimit(boolean) = false

Whether to automatically limit text space.

#${prefix} autoFit(boolean) = false

Whether to automatically fit the text size based on the available space.

#${prefix} fitPercent(number) = 0.5

The ratio of the text width to the available space when automatically fitting the text.

#${prefix} fitStrategy(string) = 'default'

Strategies employed in adaptive text computing. Options:

- 'default': The default adaptive strategy, each text calculates the font size independently based on the available space;
- 'inscribed': Inscribed rectangle calculation strategy. All texts configured with the inscribed strategy will jointly calculate the inscribed rectangle of the available space to avoid occlusion with elements outside the available space.

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

Text style.

Since version `1.11.7`, in addition to supporting normal attribute assignments, the graphic attributes of the text style also allow configuration of callback functions. For example:

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

Supported since version 1.7.0, text type

Optional:

- 'text'
- 'rich'

##${prefix} text(string | number | Array)

Text content.
Rich text content is supported since version 1.7.0.

{{ use: graphic-text(
  prefix = '####'
) }}
