---
category: examples
group: scrollBar
title: scrollBar Controls Axis Range
keywords: scrollBar
order: 30-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/scrollbar/scrollbar-line-chart.png
option: lineChart#scrollbar
---

# scrollBar Controls Axis Range

scrollBar controls the axis range, by setting `filterMode` to `axis`, it only affects the axis range, thus controlling the display area of the line.

## Key option

- The `orient` property is declared as a string type, used to set the orientation of the `scollBar`. Available options: `bottom`, `right`
- The `start` property is declared as a numeric field, with a value range of `[0, 1]`
- The `end` property is declared as a numeric field, with a value range of `[0, 1]`. Note that the value of the `start` property should be smaller than the `end` value
- The `filterMode` property declares the way the `scrollBar` controls the data display range. Available options: `axis`, `filter`. When `filterMode` is set to `filter`, it filters multiple data, affecting the axis scale calculation; when `filterMode` is set to `axis`, it only affects the corresponding axis coordinate range, without filtering the data.
- The `roam` property is declared as a `Boolean` type, used to set whether to enable the zoom and pan function

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '0:05',
        value: 10
      },
      {
        time: '0:10',
        value: 18
      },
      {
        time: '0:15',
        value: 20
      },
      {
        time: '0:20',
        value: 18
      },
      {
        time: '0:25',
        value: 20
      },
      {
        time: '0:30',
        value: 18
      },
      {
        time: '0:35',
        value: 20
      },
      {
        time: '0:40',
        value: 18
      },
      {
        time: '0:45',
        value: 20
      },
      {
        time: '0:50',
        value: 18
      },
      {
        time: '0:55',
        value: 10
      },
      {
        time: '1:00',
        value: 28
      },
      {
        time: '1:05',
        value: 18
      },
      {
        time: '1:10',
        value: 14
      },
      {
        time: '1:15',
        value: 12
      },
      {
        time: '1:20',
        value: 9
      },
      {
        time: '1:25',
        value: 20
      },
      {
        time: '1:30',
        value: 3
      },
      {
        time: '1:35',
        value: 4
      },
      {
        time: '1:40',
        value: 5
      },
      {
        time: '1:45',
        value: 10
      },
      {
        time: '1:50',
        value: 16
      },
      {
        time: '1:55',
        value: 10
      },
      {
        time: '2:00',
        value: 8
      },
      {
        time: '2:05',
        value: 18
      },
      {
        time: '2:10',
        value: 14
      },
      {
        time: '2:15',
        value: 12
      },
      {
        time: '2:20',
        value: 9
      },
      {
        time: '2:25',
        value: 20
      },
      {
        time: '2:30',
        value: 3
      },
      {
        time: '2:35',
        value: 4
      },
      {
        time: '2:40',
        value: 5
      },
      {
        time: '2:45',
        value: 10
      },
      {
        time: '2:50',
        value: 16
      },
      {
        time: '2:55',
        value: 10
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
  scrollBar: [
    {
      orient: 'bottom',
      start: 0.8,
      end: 1,
      roam: true,
      filterMode: 'axis'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Related Tutorials

[scrollBar](link)
