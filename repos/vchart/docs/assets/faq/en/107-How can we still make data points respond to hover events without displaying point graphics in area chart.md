# How can we still make data points respond to hover events without displaying point graphics in area chart?

## Question Description

It is expected that the points will not be displayed in the area chart, but the event message of the point being hovered can still be obtained through vchart.on('pointerover', ...)

## Solution

VChart's graphic configuration will indeed no longer respond to interactive events after setting visible:false. However, you can set the transparency to 0 to make the point invisible, but still respond to interactive events.

```ts
{
  point: {
     style: {
       fillOpacity: 0,
       strokeOpacity: 0,
     }
  }
}
```

## Code Example

```javascript livedemo
const spec = {
  type: 'area',
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
  point: {
    style: {
      fillOpacity: 0,
      strokeOpacity: 0
    }
  },
  xField: 'time',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Point style configuration](https://www.visactor.io/vchart/option/areaChart#point.style.fillOpacity)
- [Event listening documentation](https://www.visactor.io/vchart/api/API/event)
