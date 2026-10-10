---
category: demo
group: data
title: Data Sorting
keywords: data,sort
order: 34-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/data/data-fields-sort.png
option: barChart#data
---

# Data Sorting

The `fields` configuration of data supports processing dimensions, in which configuring `sortIndex` can sort the data, and configuring `sortReverse` as `true` can reverse the order during sorting. By default, in the non-reverse order: continuous numbers are from small to large. Discrete data are from front to back according to the `domain`.

## Key option

- `sortIndex` is configured in the `fields` of `data`. Data can be sorted according to this dimension
- `sortReverse` Whether to reverse the order when sorting.

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  direction: 'horizontal',
  data: [
    {
      id: 'data',
      values: [
        { industry: 'Agriculture, Forestry, Animal Husbandry and Fishery', gdp: 92582 },
        { industry: 'Industry', gdp: 401644 },
        { industry: 'manufacturing', gdp: 335215 },
        { industry: 'construction industry', gdp: 83383 },
        { industry: 'Wholesale and retail trade', gdp: 114518 },
        { industry: 'Transportation, storage and postal industry', gdp: 49674 },
        { industry: 'accommodation and catering industry', gdp: 17855 },
        { industry: 'financial industry', gdp: 96811 },
        { industry: 'real estate', gdp: 73821 },
        { industry: 'information transmission, software and information technology services', gdp: 1247934 },
        { industry: 'leasing and business services', gdp: 39153 },
        { industry: 'Other industries', gdp: 192831 }
      ],
      fields: {
        gdp: {
          sortIndex: 1,
          sortReverse: true
        }
      }
    }
  ],
  xField: 'gdp',
  yField: 'industry',
  axes: [
    { orient: 'left', type: 'band' },
    { orient: 'bottom', type: 'linear' }
  ],
  title: {
    visible: true,
    text: 'GDP by industry in 2022'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related tutorials

[Data](link)
