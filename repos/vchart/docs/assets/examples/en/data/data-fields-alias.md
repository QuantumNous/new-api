---
category: demo
group: data
title: Data Alias
keywords: data,alias
order: 34-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/data/data-fields-alias.png
option: lineChart#data
---

# Data Alias

The `fields` configuration of data supports the processing of dimensions. Among them, the configuration of `sortIndex` can be used to sort the data, and setting `sortReverse` to `true` can reverse the order during sorting. By default, in non-inverted order: continuous numbers from small to large. Discrete data is sorted according to `domain` from front to back.

## Key option

- `sortIndex` is configured in `fields` of `data`. It can be used to sort the data according to this dimension
- `sortReverse` determines whether to reverse the order during sorting.

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      fields: {
        temperature: {
          alias: 'temperature'
        },
        date: {
          alias: 'date'
        },
        type: {
          alias: 'type'
        }
      },
      values: [
        {
          date: 'Monday',
          temperature: 18,
          type: 'lowest'
        },
        {
          date: 'Tuesday',
          temperature: 16,
          type: 'lowest'
        },
        {
          date: 'Wednesday',
          temperature: 17,
          type: 'lowest'
        },
        {
          date: 'Thursday',
          temperature: 18,
          type: 'lowest'
        },
        {
          date: 'Friday',
          temperature: 19,
          type: 'lowest'
        },
        {
          date: 'Saturday',
          temperature: 20,
          type: 'lowest'
        },
        {
          date: 'Sunday',
          temperature: 17,
          latest: true,
          type: 'lowest'
        },
        {
          date: 'Monday',
          temperature: 28,
          type: 'highest'
        },
        {
          date: 'Tuesday',
          temperature: 26,
          type: 'highest'
        },
        {
          date: 'Wednesday',
          temperature: 27,
          type: 'highest'
        },
        {
          date: 'Thursday',
          temperature: 28,
          type: 'highest'
        },
        {
          date: 'Friday',
          temperature: 29,
          type: 'highest'
        },
        {
          date: 'Saturday',
          temperature: 30,
          type: 'highest'
        },
        {
          date: 'Sunday',
          temperature: 27,
          latest: true,
          type: 'highest'
        }
      ]
    }
  ],
  xField: 'date',
  yField: 'temperature',
  seriesField: 'type',
  color: ['#016BFF', '#FF6666'],
  line: {
    style: {
      curveType: 'basis'
    }
  },
  point: {
    visible: false
  },
  axes: [
    { orient: 'left', title: { visible: true } },
    { orient: 'bottom', title: { visible: true } }
  ],
  legends: {
    visible: true,
    orient: 'bottom',
    title: {
      visible: true
    }
  },
  title: {
    visible: true,
    text: 'Weekly temperature change'
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Data](link)
