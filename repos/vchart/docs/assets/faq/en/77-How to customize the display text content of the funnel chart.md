# How to customize the display text content of the funnel chart?

## Question Description

I am currently working on drawing a funnel chart. I hope that the label in each funnel can customize the display content and display two different lines of text. At the same time, the label on the right also needs to be customized. How should I achieve this?

Similar to the figure below:

![funnel](/vchart/faq/76-0.png)

## Solution

Like other VChart charts, the VChart funnel chart also supports customizing the style and content of each label. You can configure a callback function in the corresponding label configuration to customize the content of the text label. If the return value of the callback function of the text content is an array, the final displayed label content will also be displayed in multiple lines.

## Code Example

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  isTransform: true,
  isCone: false,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 5676,
          name: 'Sent'
        },
        {
          value: 3872,
          name: 'Viewed'
        },
        {
          value: 1668,
          name: 'Clicked'
        },
        {
          value: 610,
          name: 'Add to Cart'
        },
        {
          value: 565,
          name: 'Purchased'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Percentage of the customers have dropped from the sales process'
  },
  label: {
    visible: true,
    style: {
      text: datum => {
        return [datum.name, datum.value];
      }
    }
  },
  transformLabel: {
    visible: true
  },
  outerLabel: {
    position: 'right',
    visible: true,
    style: {
      text: datum => {
        return datum.name;
      }
    }
  },
  legends: {
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [funnelChart style spec](https://www.visactor.io/vchart/option/funnelChart#label.style.text)
