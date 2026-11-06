---
category: examples
group: line chart
title: 存在空值折线图
keywords: lineChart,comparison,trend,line
order: 0-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/line-chart/null-value-line.png
option: lineChart
---

# 存在空值折线图

数据中存在空值的折线图。在这里例子中，展示了奥运会金牌、银牌、铜牌数随时间的变化情况，其中在 1980 年是空数据。

## 关键配置

`invalidType` 属性为 `null`，`undefined` 等非合规数据点连接方式:

- 'break'指在该数据点处断开
- 'link' 指忽略该点保持连续
- 'zero' 指该点默认数值为 0
- 'ignore' 指不处理

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        medalType: 'Gold Medals',
        count: 40,
        year: '1952'
      },
      {
        medalType: 'Gold Medals',
        count: 32,
        year: '1956'
      },
      {
        medalType: 'Gold Medals',
        count: 34,
        year: '1960'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '1964'
      },
      {
        medalType: 'Gold Medals',
        count: 45,
        year: '1968'
      },
      {
        medalType: 'Gold Medals',
        count: 33,
        year: '1972'
      },
      {
        medalType: 'Gold Medals',
        count: 34,
        year: '1976'
      },
      {
        medalType: 'Gold Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Gold Medals',
        count: 83,
        year: '1984'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '1988'
      },
      {
        medalType: 'Gold Medals',
        count: 37,
        year: '1992'
      },
      {
        medalType: 'Gold Medals',
        count: 44,
        year: '1996'
      },
      {
        medalType: 'Gold Medals',
        count: 37,
        year: '2000'
      },
      {
        medalType: 'Gold Medals',
        count: 35,
        year: '2004'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '2008'
      },
      {
        medalType: 'Gold Medals',
        count: 46,
        year: '2012'
      },
      {
        medalType: 'Silver Medals',
        count: 19,
        year: '1952'
      },
      {
        medalType: 'Silver Medals',
        count: 25,
        year: '1956'
      },
      {
        medalType: 'Silver Medals',
        count: 21,
        year: '1960'
      },
      {
        medalType: 'Silver Medals',
        count: 26,
        year: '1964'
      },
      {
        medalType: 'Silver Medals',
        count: 28,
        year: '1968'
      },
      {
        medalType: 'Silver Medals',
        count: 31,
        year: '1972'
      },
      {
        medalType: 'Silver Medals',
        count: 35,
        year: '1976'
      },
      {
        medalType: 'Silver Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Silver Medals',
        count: 60,
        year: '1984'
      },
      {
        medalType: 'Silver Medals',
        count: 31,
        year: '1988'
      },
      {
        medalType: 'Silver Medals',
        count: 34,
        year: '1992'
      },
      {
        medalType: 'Silver Medals',
        count: 32,
        year: '1996'
      },
      {
        medalType: 'Silver Medals',
        count: 24,
        year: '2000'
      },
      {
        medalType: 'Silver Medals',
        count: 40,
        year: '2004'
      },
      {
        medalType: 'Silver Medals',
        count: 38,
        year: '2008'
      },
      {
        medalType: 'Silver Medals',
        count: 29,
        year: '2012'
      },
      {
        medalType: 'Bronze Medals',
        count: 17,
        year: '1952'
      },
      {
        medalType: 'Bronze Medals',
        count: 17,
        year: '1956'
      },
      {
        medalType: 'Bronze Medals',
        count: 16,
        year: '1960'
      },
      {
        medalType: 'Bronze Medals',
        count: 28,
        year: '1964'
      },
      {
        medalType: 'Bronze Medals',
        count: 34,
        year: '1968'
      },
      {
        medalType: 'Bronze Medals',
        count: 30,
        year: '1972'
      },
      {
        medalType: 'Bronze Medals',
        count: 25,
        year: '1976'
      },
      {
        medalType: 'Bronze Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Bronze Medals',
        count: 30,
        year: '1984'
      },
      {
        medalType: 'Bronze Medals',
        count: 27,
        year: '1988'
      },
      {
        medalType: 'Bronze Medals',
        count: 37,
        year: '1992'
      },
      {
        medalType: 'Bronze Medals',
        count: 25,
        year: '1996'
      },
      {
        medalType: 'Bronze Medals',
        count: 33,
        year: '2000'
      },
      {
        medalType: 'Bronze Medals',
        count: 26,
        year: '2004'
      },
      {
        medalType: 'Bronze Medals',
        count: 36,
        year: '2008'
      },
      {
        medalType: 'Bronze Medals',
        count: 29,
        year: '2012'
      }
    ]
  },
  xField: 'year',
  yField: 'count',
  seriesField: 'medalType',
  invalidType: 'link'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[折线图](link)
