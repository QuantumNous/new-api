---
category: demo
group: axis
title: 网格线填充
keywords: barChart,comparison,distribution,rank,composition,rectangle,axis
order: 25-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/grid-style.png
option: barChart#axes
---

# 网格线填充

我们可以通过 `grid.alternateColor` 来实现常见的斑马线效果。

## 关键配置

在 `axes` 属性上为指定方向的坐标轴配置 `grid.alternateColor` 属性：

- 如果只需要一种颜色填充，则可以使用 string
- 如果需要多种颜色交替填充，则使用 string 数组

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'line',
      values: [
        {
          group: 'All Survey Responses',
          type: 'All Survey Responses',
          opinion: 'Disagree',
          value: -3.7
        },
        {
          group: 'All Survey Responses',
          type: 'All Survey Responses',
          opinion: 'Strongly Disagree',
          value: -0.7
        },
        {
          group: 'All Survey Responses',
          type: 'All Survey Responses',
          opinion: 'No Opinion',
          value: 4.8
        },
        {
          group: 'All Survey Responses',
          type: 'All Survey Responses',
          opinion: 'Agree',
          value: 40.7
        },
        {
          group: 'All Survey Responses',
          type: 'All Survey Responses',
          opinion: 'Strongly Agree',
          value: 50.1
        },
        {
          group: 'Employment sector',
          type: 'Academic(nonstudent)',
          opinion: 'Disagree',
          value: -2
        },
        {
          group: 'Employment sector',
          type: 'Academic(nonstudent)',
          opinion: 'Strongly Disagree',
          value: 0
        },
        {
          group: 'Employment sector',
          type: 'Academic(nonstudent)',
          opinion: 'No Opinion',
          value: 3.2
        },
        {
          group: 'Employment sector',
          type: 'Academic(nonstudent)',
          opinion: 'Agree',
          value: 30.8
        },
        {
          group: 'Employment sector',
          type: 'Academic(nonstudent)',
          opinion: 'Strongly Agree',
          value: 64
        },
        {
          group: 'Employment sector',
          type: 'Business and industry',
          opinion: 'Disagree',
          value: -6.3
        },
        {
          group: 'Employment sector',
          type: 'Business and industry',
          opinion: 'Strongly Disagree',
          value: 0
        },
        {
          group: 'Employment sector',
          type: 'Business and industry',
          opinion: 'No Opinion',
          value: 2.8
        },
        {
          group: 'Employment sector',
          type: 'Business and industry',
          opinion: 'Agree',
          value: 50
        },
        {
          group: 'Employment sector',
          type: 'Business and industry',
          opinion: 'Strongly Agree',
          value: 40.6
        },
        {
          group: 'Employment sector',
          type: 'Federal, state, and local government',
          opinion: 'Disagree',
          value: -4.2
        },
        {
          group: 'Employment sector',
          type: 'Federal, state, and local government',
          opinion: 'Strongly Disagree',
          value: -2.8
        },
        {
          group: 'Employment sector',
          type: 'Federal, state, and local government',
          opinion: 'No Opinion',
          value: 7
        },
        {
          group: 'Employment sector',
          type: 'Federal, state, and local government',
          opinion: 'Agree',
          value: 47.9
        },
        {
          group: 'Employment sector',
          type: 'Federal, state, and local government',
          opinion: 'Strongly Agree',
          value: 38
        },
        {
          group: 'Employment sector',
          type: 'Private consultant/self-employed',
          opinion: 'Disagree',
          value: 0
        },
        {
          group: 'Employment sector',
          type: 'Private consultant/self-employed',
          opinion: 'Strongly Disagree',
          value: 0
        },
        {
          group: 'Employment sector',
          type: 'Private consultant/self-employed',
          opinion: 'No Opinion',
          value: 7.1
        },
        {
          group: 'Employment sector',
          type: 'Private consultant/self-employed',
          opinion: 'Agree',
          value: 53.6
        },
        {
          group: 'Employment sector',
          type: 'Private consultant/self-employed',
          opinion: 'Strongly Agree',
          value: 39.3
        },
        {
          group: 'Employment sector',
          type: 'Other',
          opinion: 'Disagree',
          value: -5.9
        },
        {
          group: 'Employment sector',
          type: 'Other',
          opinion: 'Strongly Disagree',
          value: -5.9
        },
        {
          group: 'Employment sector',
          type: 'Other',
          opinion: 'No Opinion',
          value: 14.7
        },
        {
          group: 'Employment sector',
          type: 'Other',
          opinion: 'Agree',
          value: 44.1
        },
        {
          group: 'Employment sector',
          type: 'Other',
          opinion: 'Strongly Agree',
          value: 29.4
        },
        {
          group: 'Race',
          type: 'White',
          opinion: 'Disagree',
          value: -2.8
        },
        {
          group: 'Race',
          type: 'White',
          opinion: 'Strongly Disagree',
          value: -1
        },
        {
          group: 'Race',
          type: 'White',
          opinion: 'No Opinion',
          value: 4.5
        },
        {
          group: 'Race',
          type: 'White',
          opinion: 'Agree',
          value: 41.8
        },
        {
          group: 'Race',
          type: 'White',
          opinion: 'Strongly Agree',
          value: 50
        },
        {
          group: 'Race',
          type: 'Asian',
          opinion: 'Disagree',
          value: -3.3
        },
        {
          group: 'Race',
          type: 'Asian',
          opinion: 'Strongly Disagree',
          value: 0
        },
        {
          group: 'Race',
          type: 'Asian',
          opinion: 'No Opinion',
          value: 3.3
        },
        {
          group: 'Race',
          type: 'Asian',
          opinion: 'Agree',
          value: 40.2
        },
        {
          group: 'Race',
          type: 'Asian',
          opinion: 'Strongly Agree',
          value: 53.3
        },
        {
          group: 'Race',
          type: 'Black or African American',
          opinion: 'Disagree',
          value: -10
        },
        {
          group: 'Race',
          type: 'Black or African American',
          opinion: 'Strongly Disagree',
          value: 0
        },
        {
          group: 'Race',
          type: 'Black or African American',
          opinion: 'No Opinion',
          value: 20
        },
        {
          group: 'Race',
          type: 'Black or African American',
          opinion: 'Agree',
          value: 30
        },
        {
          group: 'Race',
          type: 'Black or African American',
          opinion: 'Strongly Agree',
          value: 40
        },
        {
          group: 'Education',
          type: "Associate's and Bachelor's",
          opinion: 'Disagree',
          value: -6.9
        },
        {
          group: 'Education',
          type: "Associate's and Bachelor's",
          opinion: 'Strongly Disagree',
          value: -1.1
        },
        {
          group: 'Education',
          type: "Associate's and Bachelor's",
          opinion: 'No Opinion',
          value: 5.7
        },
        {
          group: 'Education',
          type: "Associate's and Bachelor's",
          opinion: 'Agree',
          value: 49.1
        },
        {
          group: 'Education',
          type: "Associate's and Bachelor's",
          opinion: 'Strongly Agree',
          value: 37.1
        },
        {
          group: 'Education',
          type: "Master's and Above",
          opinion: 'Disagree',
          value: -2.3
        },
        {
          group: 'Education',
          type: "Master's and Above",
          opinion: 'Strongly Disagree',
          value: -0.5
        },
        {
          group: 'Education',
          type: "Master's and Above",
          opinion: 'No Opinion',
          value: 4.4
        },
        {
          group: 'Education',
          type: "Master's and Above",
          opinion: 'Agree',
          value: 36.9
        },
        {
          group: 'Education',
          type: "Master's and Above",
          opinion: 'Strongly Agree',
          value: 55.9
        },
        {
          group: 'Gender',
          type: 'Male',
          opinion: 'Disagree',
          value: -3.4
        },
        {
          group: 'Gender',
          type: 'Male',
          opinion: 'Strongly Disagree',
          value: -0.8
        },
        {
          group: 'Gender',
          type: 'Male',
          opinion: 'No Opinion',
          value: 4.2
        },
        {
          group: 'Gender',
          type: 'Male',
          opinion: 'Agree',
          value: 41
        },
        {
          group: 'Gender',
          type: 'Male',
          opinion: 'Strongly Agree',
          value: 50.6
        },
        {
          group: 'Gender',
          type: 'Female',
          opinion: 'Disagree',
          value: -3.5
        },
        {
          group: 'Gender',
          type: 'Female',
          opinion: 'Strongly Disagree',
          value: -0.5
        },
        {
          group: 'Gender',
          type: 'Female',
          opinion: 'No Opinion',
          value: 6
        },
        {
          group: 'Gender',
          type: 'Female',
          opinion: 'Agree',
          value: 39
        },
        {
          group: 'Gender',
          type: 'Female',
          opinion: 'Strongly Agree',
          value: 51
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  seriesField: 'opinion',
  stack: true,
  color: {
    type: 'ordinal',
    range: ['#e34a33', '#fdbb84', '#bdbdbd', '#addd8e', '#31a354'],
    domain: ['Strongly Disagree', 'Disagree', 'No Opinion', 'Agree', 'Strongly Agree']
  }, // Custom color scale

  legends: { visible: true },
  region: [
    {
      style: {
        stroke: '#dfdfdf',
        lineWidth: 1
      }
    }
  ],
  axes: [
    {
      orient: 'left',
      tick: {
        visible: false
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        },
        alternateColor: ['#F2F2F2', '#FFFFFF'],
        alignWithLabel: false // grid does not align with label
      }
    },
    {
      orient: 'bottom',
      tick: {
        visible: false,
        tickCount: 10
      },
      min: -100,
      max: 100,
      label: {
        formatMethod: val => `${Math.abs(val)}%`
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
