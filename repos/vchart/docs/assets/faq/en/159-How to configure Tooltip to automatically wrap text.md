# How to configure Tooltip to automatically wrap text?

# Question Description

Seemly to https://visactor.io/vchart/demo/line-chart/null-value-line, the content of tooltip is too long. How can I achieve automatic line wrapping based on chart width, height, and label length?
![demo](/vchart/faq/95-0.png)

# Solution

The solutions for different chart libraries are different. Based on the demo you provided, you only need to configure the maximum width and multi row support.

```ts
tooltip: {
  style: {
    keyLabel: {
      maxWidth: 100,
      multiLine: true
    },
    titleLabel: {
      maxWidth: 20
    }
  }
}
```

# Code Example

```ts
const spec = {
  type: 'line',
  data: {
    values: [
      { type: 'Nail polish', country: '这是一段很长的标题这是一段很长的标题这是一段很长的标题', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: '这是一段很长的标题这是一段很长的标题这是一段很长的标题', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: '这是一段很长的标题这是一段很长的标题这是一段很长的标题', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: '这是一段很长的标题这是一段很长的标题这是一段很长的标题', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: '这是一段很长的标题这是一段很长的标题这是一段很长的标题', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: '这是一段很长的标题这是一段很长的标题这是一段很长的标题', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: '这是一段很长的标题这是一段很长的标题这是一段很长的标题', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: '这是一段很长的标题这是一段很长的标题这是一段很长的标题', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: '这是一段很长的标题这是一段很长的标题这是一段很长的标题', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: '100% stacked line chart of cosmetic products sales'
  },
  percent: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod(val) {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    }
  ],
  tooltip: {
    style: {
      keyLabel: {
        maxWidth: 100,
        multiLine: true
      },
      titleLabel: {
        maxWidth: 20
      }
    }
  }
};
```

# Results

Online demo：https://codesandbox.io/s/tooltip-multiline-j9ngvp
![result](/vchart/faq/95-1.png)

# Related Documentation

Tooltip Tutorial：https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip
Related api：https://visactor.io/vchart/option/barChart#tooltip.visible
github：https://github.com/VisActor/VChart
