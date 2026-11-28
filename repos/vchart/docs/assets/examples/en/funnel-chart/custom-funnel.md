---
category: examples
group: funnel chart
title: Custom Funnel Chart
keywords: funnelChart,composition,trend,custom
order: 8-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/funnel-chart/custom-funnel.png
option: funnelChart
---

# Custom Funnel Chart

## When to use

1. The data is ordered, there is a logical sequence relationship between them, and it is best to have more than 3 stages.

2. The process should be "consumptive" such as in the e-commerce field, registered users must go through layers of consumption before they reach the order stage; In the human resources field, the received resumes must go through multiple rounds of screening before reaching the final interview.

## Key option

- Specify the chart type as `type: common`, which is a composite chart
- `categoryField` specifies the category field
- `valueField` specifies the value field
- The `region` array configures 4 regions
  - Configure the region width, height, and offsets with percentages
- `series[i].regionIndex` can specify the region area where series are drawn, default is 0, i.e., the first region.

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  padding: 0,
  data: [
    {
      id: 'funnel1',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    },
    {
      name: 'funnel2',
      values: [
        {
          value: 200,
          name: 'Step1'
        },
        {
          value: 160,
          name: 'Step2'
        },
        {
          value: 120,
          name: 'Step3'
        },
        {
          value: 80,
          name: 'Step4'
        },
        {
          value: 40,
          name: 'Step5'
        }
      ]
    }
  ],
  layout: {
    type: 'grid',
    col: 4,
    row: 3,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        row: 0,
        colSpan: 4
      },
      {
        modelId: 'left',
        col: 0,
        row: 1,
        rowSpan: 2
      },
      {
        modelId: 'right',
        col: 1,
        row: 1,
        rowSpan: 2
      },
      {
        modelId: 'right-top',
        col: 2,
        row: 1,
        colSpan: 2
      },
      {
        modelId: 'right-bottom',
        col: 2,
        row: 2,
        colSpan: 2
      }
    ]
  },
  region: [
    {
      id: 'left'
    },
    {
      id: 'right',
      padding: {
        left: 1
      }
    },
    {
      id: 'right-top'
    },
    {
      id: 'right-bottom',
      padding: {
        top: 1
      }
    }
  ],
  series: [
    {
      type: 'funnel',
      dataIndex: 0,
      gap: 2,
      range: {
        max: 200
      },
      funnelOrient: 'top',
      funnelAlign: 'right',
      categoryField: 'name',
      valueField: 'value',
      isCone: false,
      funnel: {
        style: {
          cornerRadius: 4,
          lineWidth: 0
        }
      },
      outerLabel: {
        visible: true,
        alignLabel: false,
        position: 'left'
      }
    },
    {
      type: 'funnel',
      regionIndex: 1,
      dataIndex: 1,
      gap: 2,
      funnelOrient: 'top',
      funnelAlign: 'left',
      categoryField: 'name',
      valueField: 'value',
      isCone: false,
      funnel: {
        style: {
          cornerRadius: 4,
          lineWidth: 0
        }
      }
    },
    {
      type: 'funnel',
      dataIndex: 0,
      regionIndex: 2,
      gap: 1,
      funnelOrient: 'top',
      funnelAlign: 'left',
      categoryField: 'name',
      valueField: 'value',
      isCone: false,
      funnel: {
        style: {
          lineWidth: 0
        }
      },
      outerLabel: {
        visible: true,
        alignLabel: false,
        position: 'right'
      }
    },
    {
      type: 'funnel',
      regionIndex: 3,
      dataIndex: 1,
      gap: 1,
      funnelOrient: 'bottom',
      funnelAlign: 'left',
      categoryField: 'name',
      valueField: 'value',
      isCone: false,
      label: { visible: true, style: { text: '' } },
      outerLabel: {
        visible: true,
        alignLabel: false,
        position: 'right'
      },
      funnel: {
        style: {
          lineWidth: 0
        }
      }
    }
  ],
  legends: {
    id: 'legend',
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related tutorials

[Funnel Chart](link)
