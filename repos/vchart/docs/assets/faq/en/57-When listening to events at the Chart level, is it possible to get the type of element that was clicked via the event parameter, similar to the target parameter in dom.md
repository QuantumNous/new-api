# When listening to events at the Chart level, is it possible to get the type of element that was clicked via the event parameter, similar to the target parameter in dom?

## Question Description

Is it possible to listen to the whole chart or canvas and then determine if the click is on axis/legend/item based on the parameters returned, such as type?

## Solution

This can be done. The VChart instance provides event registration and unregistration, you can listen to different event types via chart.on(event: string, callback: (params: EventParams)=> void): void and get the context information via the callback function. If you want to distinguish the different events you are triggering on axis/legend/item, you can do so by event filtering and passing `{ level: 'model' | 'mark', type: 'axis' }`, where `'model'` denotes the model type of the chart's constituent elements and `'mark'` denotes the chart's item elements.
For example: `vchart.on('pointerdown', { level: 'model', type: 'axis' }, (params) => {})`. When I click on the axis, I can get the specific parameters.
More event types and parameters can be found at: https://www.visactor.io/vchart/api/API/event.

[event](/vchart/faq/8-0.png)

## Code Example

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],
  xField: 'State',
  yField: 'Population',
  seriesField: 'Age',
  stack: true,
  legends: {
    visible: true
  },
  bar: {
    // The state style of bar
    state: {
      hover: {
        stroke: '#000',
        lineWidth: 1
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

vchart.on('pointerdown', { level: 'model', type: 'axis' }, params => {
  console.log('params', params);
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [Event Tutorial](https://www.visactor.io/vchart/guide/event)
- [Related api](https://www.visactor.io/vchart/api/event)
- [github](https://github.com/VisActor/VChart)
