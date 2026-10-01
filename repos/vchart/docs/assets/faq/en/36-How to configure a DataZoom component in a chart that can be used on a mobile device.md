# How to configure a DataZoom component in a chart that can be used on a mobile device?

## Question Description

For a simple line chart like [this one](https://www.visactor.io/vchart/demo/line-chart/basic-line), how do I configure the DataZoom component? Can the DataZoom component be used for interaction on mobile devices?

![line chart](/vchart/faq/25-0.png)

## Solution

The solutions of different chart libraries vary. Based on the demo you provided, in VChart, you only need to configure **dataZoom** to display the component. To make the interaction more user-friendly for mobile devices, you can enable the configuration of `roam: true`.

![line chart](/vchart/faq/25-1.png)

## Code Example

```
const spec = {
  type: "line",
  data: {
    values: [
      {
        time: "2:00",
        value: 8
      },
      {
        time: "4:00",
        value: 9
      },
      {
        time: "6:00",
        value: 11
      },
      {
        time: "8:00",
        value: 14
      },
      {
        time: "10:00",
        value: 16
      },
      {
        time: "12:00",
        value: 17
      },
      {
        time: "14:00",
        value: 17
      },
      {
        time: "16:00",
        value: 16
      },
      {
        time: "18:00",
        value: 15
      }
    ]
  },
  xField: "time",
  yField: "value",
  dataZoom: [
    {
      orient: "bottom",
      filterMode: "filter",
      roam: true
    }
  ]
};
```

## Results

- [Online demo](https://codesandbox.io/s/line-chart-datazoom-wzk8n7)

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  dataZoom: [
    {
      orient: 'bottom',
      filterMode: 'filter',
      roam: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Related Documentation

- [DataZoom demo](https://www.visactor.io/vchart/demo/data-zoom/preview-data?keyword=dataZoom)
- [DataZoom Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/DataZoom)
- [Related option](https://www.visactor.io/vchart/option/lineChart#dataZoom.valueField)
- [github](https://github.com/VisActor/VChart)
