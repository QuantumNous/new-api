# OMI Introduction

OMI is a Web components framework based on JSX and signal. Correspondingly, the OMIU component library offers a variety of ready-to-use UI components and provides built-in encapsulation for VChart.

- OMI Project URL: [OMI](https://omi.cdn-go.cn/home/latest/introduction.html)
- OMIU Project URL: [OMIU](https://omi.cdn-go.cn/omiu/latest/#/)

## Quick Start

A simple OMIU chart rendering code looks like this:

```ts
<o-chart
  xField="month"
  yField="sales"
  data={{
    values: [
      { month: 'Monday', sales: 22 },
      { month: 'Tuesday', sales: 13 },
      { month: 'Wednesday', sales: 25 },
      { month: 'Thursday', sales: 29 },
      { month: 'Friday', sales: 38 }
    ]
  }}
></o-chart>
```

![omi-vchart](/vchart/guide/omi-vchart.png)

For more OMIU vchart rendering examples, please refer to [OMIU chart examples](https://omi.cdn-go.cn/omiu/latest/#/data/chart/)
