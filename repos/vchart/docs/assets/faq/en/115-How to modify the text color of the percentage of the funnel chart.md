# How to modify the text color of the percentage of the funnel chart?

## Question Description

I saw that some chart libraries are able to draw such a conversion funnel chart. I hope to customize the percentage text in this funnel chart. How can this be achieved?

![funnel](/vchart/faq/81-0.png)

## Solution

The funnel layer labels, conversion layer labels, and external labels in the VChart funnel chart all support custom styles and text content settings. You can set the fill visual channel value in the corresponding label configuration item to specify the required text color.

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
    visible: true
  },
  transformLabel: {
    visible: true,
    style: {
      fill: 'red'
    }
  },
  outerLabel: {
    position: 'right',
    visible: true
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
- [funnelChart transformLabel style spec](https://www.visactor.io/vchart/option/funnelChart#transformLabel.style.fill)
