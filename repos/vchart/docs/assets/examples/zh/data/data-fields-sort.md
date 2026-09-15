---
category: demo
group: data
title: 数据排序
keywords: data,sort
order: 34-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/data/data-fields-sort.png
option: barChart#data
---

# 数据排序

数据的 `fields` 配置支持对维度进行处理，其中配置 `sortIndex` 可以对数据进行排序，配置 `sortReverse` 为 `true` 可以在排序时逆序。默认不逆序的情况下：连续数从小到大。离散数据按照 `domain` 从前到后。

## 关键配置

- `sortIndex` 在 `data` 的 `fields` 中配置。可以将数据按照此维度排序
- `sortReverse` 排序时是否逆序。

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  width: 1000,
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

## 相关教程

[数据](link)
