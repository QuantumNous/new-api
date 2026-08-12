# In the combination chart, how to configure the scope of the cross auxiliary line, within a certain sub-figure, or on the entire combination chart?

## Problem Description

![](/vchart/faq/87-0.png)

I would like to ask, is there a way to display the cross auxiliary lines in all sub-tables of the perspective combination chart?

## solution

On VChart, crosshair supports this capability. You only need to declare the bound axis index for the crosshair in the corresponding direction. If not declared, all axes corresponding to the crosshair position will be bound by default.

As shown in the figure below, we expect the crosshair on the y-axis to act on the entire figure. We only need to declare the following configuration

![](/vchart/faq/87-1.png)

If you want to apply it to a certain subgraph, you only need to configure `bindingAxesIndex` as the axis index corresponding to the subgraph.

![](/vchart/faq/87-2.png)

## Result display

```javascript livedemo
const data = [
  { region: 'Central', state: 'North Dakota', sales: 920 },
  { region: 'Central', state: 'South Dakota', sales: 1317 },
  { region: 'Central', state: 'Kansas', sales: 2916 },
  { region: 'Central', state: 'Iowa', sales: 4577 },
  { region: 'Central', state: 'Nebraska', sales: 7464 },
  { region: 'Central', state: 'Oklahoma', sales: 19686 },
  { region: 'Central', state: 'Missouri', sales: 22207 },
  { region: 'Central', state: 'Minnesota', sales: 29865 },
  { region: 'Central', state: 'Wisconsin', sales: 32125 },
  { region: 'Central', state: 'Indiana', sales: 53549 },
  { region: 'Central', state: 'Michigan', sales: 76281 },
  { region: 'Central', state: 'Illinois', sales: 80162 },
  { region: 'Central', state: 'Texas', sales: 170187 },
  { region: 'East', state: 'West Virginia', sales: 1209 },
  { region: 'East', state: 'Maine', sales: 1270 },
  { region: 'East', state: 'District of Columbia', sales: 2866 },
  { region: 'East', state: 'New Hampshire', sales: 7294 },
  { region: 'East', state: 'Vermont', sales: 8929 },
  { region: 'East', state: 'Connecticut', sales: 13386 },
  { region: 'East', state: 'Rhode Island', sales: 22629 },
  { region: 'East', state: 'Maryland', sales: 23707 },
  { region: 'East', state: 'Delaware', sales: 27453 },
  { region: 'East', state: 'Massachusetts', sales: 28639 },
  { region: 'East', state: 'New Jersey', sales: 35763 },
  { region: 'East', state: 'Ohio', sales: 78253 },
  { region: 'East', state: 'Pennsylvania', sales: 116522 },
  { region: 'East', state: 'New York', sales: 310914 },
  { region: 'South', state: 'South Carolina', sales: 8483 },
  { region: 'South', state: 'Louisiana', sales: 9219 },
  { region: 'South', state: 'Mississippi', sales: 10772 },
  { region: 'South', state: 'Arkansas', sales: 11678 },
  { region: 'South', state: 'Alabama', sales: 19511 },
  { region: 'South', state: 'Tennessee', sales: 30662 },
  { region: 'South', state: 'Kentucky', sales: 36598 },
  { region: 'South', state: 'Georgia', sales: 49103 },
  { region: 'South', state: 'North Carolina', sales: 55604 },
  { region: 'South', state: 'Virginia', sales: 70641 },
  { region: 'South', state: 'Florida', sales: 89479 },
  { region: 'West', state: 'Wyoming', sales: 1603 },
  { region: 'West', state: 'Idaho', sales: 4380 },
  { region: 'West', state: 'New Mexico', sales: 4779 },
  { region: 'West', state: 'Montana', sales: 5589 },
  { region: 'West', state: 'Utah', sales: 11223 },
  { region: 'West', state: 'Nevada', sales: 16729 },
  { region: 'West', state: 'Oregon', sales: 17431 },
  { region: 'West', state: 'Colorado', sales: 32110 },
  { region: 'West', state: 'Arizona', sales: 35283 },
  { region: 'West', state: 'Washington', sales: 138656 },
  { region: 'West', state: 'California', sales: 457731 }
];

const centralData = data.filter(obj => obj.region === 'Central').sort((a, b) => a.sales - b.sales);
const eastData = data.filter(obj => obj.region === 'East').sort((a, b) => a.sales - b.sales);
const westData = data.filter(obj => obj.region === 'West').sort((a, b) => a.sales - b.sales);
const southData = data.filter(obj => obj.region === 'South').sort((a, b) => a.sales - b.sales);

// Get the default color palette
const defaultColorScheme = VChart.ThemeManager.getCurrentTheme().colorScheme?.default?.dataScheme?.[0]?.scheme;

const spec = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 3,
    row: 5,
    elements: [
      {
        modelId: 'legend',
        col: 2,
        row: 0,
        rowSpan: 5
      },
      {
        modelId: 'centralLeftAxis',
        col: 0,
        row: 0
      },
      {
        modelId: 'southLeftAxis',
        col: 0,
        row: 1
      },
      {
        modelId: 'eastLeftAxis',
        col: 0,
        row: 2
      },
      {
        modelId: 'westLeftAxis',
        col: 0,
        row: 3
      },
      {
        modelId: 'central',
        col: 1,
        row: 0
      },
      {
        modelId: 'south',
        col: 1,
        row: 1
      },
      {
        modelId: 'east',
        col: 1,
        row: 2
      },
      {
        modelId: 'west',
        col: 1,
        row: 3
      },
      {
        modelId: 'bottomAxis',
        col: 1,
        row: 4
      }
    ]
  },
  region: [
    {
      id: 'central',
      style: {
        stroke: [defaultColorScheme[0], false, false, false],
        lineWidth: 1
      }
    },
    {
      id: 'south',
      style: {
        stroke: [defaultColorScheme[1], false, false, false],
        lineWidth: 1
      }
    },
    {
      id: 'east',
      style: {
        stroke: [defaultColorScheme[2], false, false, false],
        lineWidth: 1
      }
    },
    {
      id: 'west',
      style: {
        stroke: [defaultColorScheme[3], false, false, false],
        lineWidth: 1
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'right',
    position: 'top',
    id: 'legend',
    regionId: ['central', 'south', 'east', 'west'],
    item: {
      background: {
        visible: false
      },
      label: {
        formatMethod: (label, datum, index) => {
          return ['central', 'south', 'east', 'west'][index];
        }
      }
    },
    interactive: false, // Turn off legend interaction
    padding: {
      top: 0,
      left: 20
    }
  },
  series: [
    {
      id: 'centralSeriesO',
      regionId: 'central',
      type: 'bar',
      data: {
        id: 'central',
        values: centralData
      },
      direction: 'horizontal',
      xField: 'sales',
      yField: 'state'
    },
    {
      id: 'southSeries0',
      regionId: 'south',
      type: 'bar',
      data: {
        id: 'south',
        values: southData
      },
      direction: 'horizontal',
      xField: 'sales',
      yField: 'state'
    },
    {
      id: 'eastSeries0',
      regionId: 'east',
      type: 'bar',
      data: {
        id: 'east',
        values: eastData
      },
      direction: 'horizontal',
      xField: 'sales',
      yField: 'state'
    },
    {
      id: 'westSeries0',
      regionId: 'west',
      type: 'bar',
      data: {
        id: 'west',
        values: westData
      },
      direction: 'horizontal',
      xField: 'sales',
      yField: 'state'
    }
  ],
  axes: [
    {
      grid: {
        visible: 1,
        style: {
          lineDash: [1, 0]
        }
      },
      id: 'centralLeftAxis',
      regionId: 'central',
      seriesId: ['centralSeriesO'],
      orient: 'left',
      type: 'band'
    },
    {
      grid: {
        visible: 1,
        style: {
          lineDash: [1, 0]
        }
      },
      id: 'southLeftAxis',
      regionId: 'south',
      seriesId: ['southSeries0'],
      orient: 'left',
      type: 'band'
    },
    {
      grid: {
        visible: 1,
        style: {
          lineDash: [1, 0]
        }
      },
      id: 'eastLeftAxis',
      regionId: 'east',
      seriesId: ['eastSeries0'],
      orient: 'left',
      type: 'band'
    },
    {
      grid: {
        visible: 1,
        style: {
          lineDash: [1, 0]
        }
      },
      id: 'westLeftAxis',
      regionId: 'west',
      seriesId: ['westSeries0'],
      orient: 'left',
      type: 'band'
    },
    {
      id: 'bottomAxis',
      regionId: ['central', 'south', 'east', 'west'],
      orient: 'bottom',
      type: 'linear',
      tick: {
        visible: false
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  crosshair: {
    xField: {
      visible: true,
      bindingAxesIndex: [4],
      line: {
        visible: true,
        type: 'line',
        style: {
          opacity: 1,
          lineDash: [2, 2],
          lineWidth: 1,
          stroke: '#000'
        }
      },
      label: {
        visible: true // Default is false
      }
    },
    yField: {
      bindingAxesIndex: [0, 1, 2, 3],
      visible: true,
      line: {
        visible: true,
        type: 'line',
        style: {
          opacity: 1,
          lineDash: [2, 2],
          lineWidth: 1,
          stroke: '#000'
        }
      },
      label: {
        visible: true // Default is false
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related documents

- [Crosshair Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Crosshair)

- [Crosshair Configuration](https://www.visactor.io/vchart/option/commonChart#crosshair.id)

- [Combination Chart Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination)

- [Common Chart Configuration](https://www.visactor.io/vchart/option/commonChart#type)

- [github](https://github.com/VisActor/VChart)
