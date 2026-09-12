# How to truncate, wrap, or perform other formatting effects on axis labels in charts?

## Question Description

How to achieve line breaks or truncation effects for axis labels in bar charts similar to [this example](https://www.visactor.io/vchart/demo/bar-chart/basic-bar) when the labels are very long?

![bar chart](/vchart/faq/24-0.png)

## Solution

The solutions vary among different chart libraries. Based on the demo you provided, in VChart, you only need to configure the label-related settings in the axes section:

- By returning an array through the `formatMethod`, you can achieve custom line breaks.
- By using `style.maxLineWidth`, you can achieve automatic truncation.
- By setting `style.ellipsis`, you can set the ellipsis.

![code](/vchart/faq/24-1.png)

## Code Example

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'Apple https://www.apple.com/',
          value: 214480
        },
        {
          name: 'Google https://www.google.com.hk/',
          value: 155506
        },
        {
          name: 'Amazon https://www.amazon.com/',
          value: 100764
        },
        {
          name: 'Microsoft https://www.microsoft.com/',
          value: 92715
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'name',
  axes: [
    {
      orient: 'bottom',
      visible: false
    },
    {
      orient: 'left',
      label: {
        formatMethod: (text, datum) => {
          return text.split(' ');
        },
        style: {
          maxLineWidth: 100,
          ellipsis: '~'
        }
      }
    }
  ],
  label: {
    visible: true
  }
};
```

## Results

[Online demo](https://codesandbox.io/s/axis-label-auto-limit-pnsvzl)

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'Apple https://www.apple.com/',
          value: 214480
        },
        {
          name: 'Google https://www.google.com.hk/',
          value: 155506
        },
        {
          name: 'Amazon https://www.amazon.com/',
          value: 100764
        },
        {
          name: 'Microsoft https://www.microsoft.com/',
          value: 92715
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'name',
  axes: [
    {
      orient: 'bottom',
      visible: false
    },
    {
      orient: 'left',
      label: {
        formatMethod: (text, datum) => {
          return text.split(' ');
        },
        style: {
          maxLineWidth: 100,
          ellipsis: '~'
        }
      }
    }
  ],
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Related Documentation

- [Axis Demo](https://www.visactor.io/vchart/demo/axis/animation)
- [Axis Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes)
- [Related option](https://www.visactor.io/vchart/option/barChart#axes-band.label.style.ellipsis)
- [github](https://github.com/VisActor/VChart)
