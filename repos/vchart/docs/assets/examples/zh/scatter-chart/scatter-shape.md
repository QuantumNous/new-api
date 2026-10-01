---
category: examples
group: scatter chart
title: 各种形状的散点图
order: 9-1
cover: /vchart/preview/scatter-chart-scatter-shape_1.9.0.png
option: scatterChart
---

# 各种形状的散点图

通过形状视觉通道，区分各种点的类型

## 关键配置

- `shapeField` 属性声明为尺寸字段
- `shape` 点形状的视觉通道配置为`scale`类型，实现根据特定字段映射形状类型

## 代码演示

```javascript livedemo
const data = [
  { continent: 'Americas', Country: 'Argentina', LifeExpectancy: 75.32, GDP: 12779.37964, Population: 40301927 },
  { continent: 'Americas', Country: 'Brazil', LifeExpectancy: 72.39, GDP: 9065.800825, Population: 190010647 },
  { continent: 'Americas', Country: 'Canada', LifeExpectancy: 80.653, GDP: 36319.23501, Population: 33390141 },
  { continent: 'Americas', Country: 'Chile', LifeExpectancy: 78.553, GDP: 13171.63885, Population: 16284741 },
  { continent: 'Americas', Country: 'Colombia', LifeExpectancy: 72.889, GDP: 7006.580419, Population: 44227550 },
  { continent: 'Americas', Country: 'Costa Rica', LifeExpectancy: 78.782, GDP: 9645.06142, Population: 4133884 },
  { continent: 'Americas', Country: 'Cuba', LifeExpectancy: 78.273, GDP: 8948.102923, Population: 11416987 },
  {
    continent: 'Americas',
    Country: 'Dominican Republic',
    LifeExpectancy: 72.235,
    GDP: 6025.374752,
    Population: 9319622
  },
  { continent: 'Americas', Country: 'Ecuador', LifeExpectancy: 74.994, GDP: 6873.262326, Population: 13755680 },
  { continent: 'Americas', Country: 'El Salvador', LifeExpectancy: 71.878, GDP: 5728.353514, Population: 6939688 },
  { continent: 'Americas', Country: 'Guatemala', LifeExpectancy: 70.259, GDP: 5186.050003, Population: 12572928 },
  { continent: 'Americas', Country: 'Honduras', LifeExpectancy: 70.198, GDP: 3548.330846, Population: 7483763 },
  { continent: 'Americas', Country: 'Jamaica', LifeExpectancy: 72.567, GDP: 7320.880262, Population: 2780132 },
  { continent: 'Americas', Country: 'Mexico', LifeExpectancy: 76.195, GDP: 11977.57496, Population: 108700891 },
  { continent: 'Americas', Country: 'Nicaragua', LifeExpectancy: 72.899, GDP: 2749.320965, Population: 5675356 },
  { continent: 'Americas', Country: 'Panama', LifeExpectancy: 75.537, GDP: 9809.185636, Population: 3242173 },
  { continent: 'Americas', Country: 'Paraguay', LifeExpectancy: 71.752, GDP: 4172.838464, Population: 6667147 },
  { continent: 'Americas', Country: 'Peru', LifeExpectancy: 71.421, GDP: 7408.905561, Population: 28674757 },
  { continent: 'Americas', Country: 'Puerto Rico', LifeExpectancy: 78.746, GDP: 19328.70901, Population: 3942491 },
  {
    continent: 'Americas',
    Country: 'Trinidad and Tobago',
    LifeExpectancy: 69.819,
    GDP: 18008.50924,
    Population: 1056608
  },
  { continent: 'Americas', Country: 'United States', LifeExpectancy: 78.242, GDP: 42951.65309, Population: 301139947 },
  { continent: 'Americas', Country: 'Uruguay', LifeExpectancy: 76.384, GDP: 10611.46299, Population: 3447496 },
  { continent: 'Americas', Country: 'Venezuela', LifeExpectancy: 73.747, GDP: 11415.80569, Population: 26084662 },
  { continent: 'Asia', Country: 'China', LifeExpectancy: 72.961, GDP: 4959.114854, Population: 1318683096 },
  { continent: 'Asia', Country: 'Hong Kong, China', LifeExpectancy: 82.208, GDP: 39724.97867, Population: 6980412 },
  { continent: 'Asia', Country: 'Japan', LifeExpectancy: 82.603, GDP: 31656.06806, Population: 127467972 },
  { continent: 'Asia', Country: 'Korea, Dem. Rep.', LifeExpectancy: 67.297, GDP: 1593.06548, Population: 23301725 },
  { continent: 'Asia', Country: 'Korea, Rep.', LifeExpectancy: 78.623, GDP: 23348.13973, Population: 49044790 },
  { continent: 'Europe', Country: 'Albania', LifeExpectancy: 76.423, GDP: 5937.029526, Population: 3600523 },
  { continent: 'Europe', Country: 'Austria', LifeExpectancy: 79.829, GDP: 36126.4927, Population: 8199783 },
  { continent: 'Europe', Country: 'Belgium', LifeExpectancy: 79.441, GDP: 33692.60508, Population: 10392226 },
  {
    continent: 'Europe',
    Country: 'Bosnia and Herzegovina',
    LifeExpectancy: 74.852,
    GDP: 7446.298803,
    Population: 4552198
  },
  { continent: 'Europe', Country: 'Bulgaria', LifeExpectancy: 73.005, GDP: 10680.79282, Population: 7322858 },
  { continent: 'Europe', Country: 'Croatia', LifeExpectancy: 75.748, GDP: 14619.22272, Population: 4493312 },
  { continent: 'Europe', Country: 'Czech Republic', LifeExpectancy: 76.486, GDP: 22833.30851, Population: 10228744 },
  { continent: 'Europe', Country: 'Denmark', LifeExpectancy: 78.332, GDP: 35278.41874, Population: 5468120 },
  { continent: 'Europe', Country: 'Finland', LifeExpectancy: 79.313, GDP: 33207.0844, Population: 5238460 },
  { continent: 'Europe', Country: 'France', LifeExpectancy: 80.657, GDP: 30470.0167, Population: 61083916 },
  { continent: 'Europe', Country: 'Germany', LifeExpectancy: 79.406, GDP: 32170.37442, Population: 82400996 },
  { continent: 'Europe', Country: 'Greece', LifeExpectancy: 79.483, GDP: 27538.41188, Population: 10706290 },
  { continent: 'Europe', Country: 'Hungary', LifeExpectancy: 73.338, GDP: 18008.94444, Population: 9956108 },
  { continent: 'Europe', Country: 'Iceland', LifeExpectancy: 81.757, GDP: 36180.78919, Population: 301931 },
  { continent: 'Europe', Country: 'Ireland', LifeExpectancy: 78.885, GDP: 40675.99635, Population: 4109086 },
  { continent: 'Europe', Country: 'Italy', LifeExpectancy: 80.546, GDP: 28569.7197, Population: 58147733 },
  { continent: 'Europe', Country: 'Montenegro', LifeExpectancy: 74.543, GDP: 9253.896111, Population: 684736 },
  { continent: 'Europe', Country: 'Netherlands', LifeExpectancy: 79.762, GDP: 36797.93332, Population: 16570613 },
  { continent: 'Europe', Country: 'Norway', LifeExpectancy: 80.196, GDP: 49357.19017, Population: 4627926 },
  { continent: 'Europe', Country: 'Poland', LifeExpectancy: 75.563, GDP: 15389.92468, Population: 38518241 },
  { continent: 'Europe', Country: 'Portugal', LifeExpectancy: 78.098, GDP: 20509.64777, Population: 10642836 },
  { continent: 'Europe', Country: 'Romania', LifeExpectancy: 72.476, GDP: 10808.47561, Population: 22276056 },
  { continent: 'Europe', Country: 'Serbia', LifeExpectancy: 74.002, GDP: 9786.534714, Population: 10150265 },
  { continent: 'Europe', Country: 'Slovak Republic', LifeExpectancy: 74.663, GDP: 18678.31435, Population: 5447502 },
  { continent: 'Europe', Country: 'Slovenia', LifeExpectancy: 77.926, GDP: 25768.25759, Population: 2009245 },
  { continent: 'Europe', Country: 'Spain', LifeExpectancy: 80.941, GDP: 28821.0637, Population: 40448191 },
  { continent: 'Europe', Country: 'Sweden', LifeExpectancy: 80.884, GDP: 33859.74835, Population: 9031088 },
  { continent: 'Europe', Country: 'Switzerland', LifeExpectancy: 81.701, GDP: 37506.41907, Population: 7554661 },
  { continent: 'Europe', Country: 'Turkey', LifeExpectancy: 71.777, GDP: 8458.276384, Population: 71158647 },
  { continent: 'Europe', Country: 'United Kingdom', LifeExpectancy: 79.425, GDP: 33203.26128, Population: 60776238 },
  { continent: 'Oceania', Country: 'Australia', LifeExpectancy: 81.235, GDP: 34435.36744, Population: 20434176 },
  { continent: 'Oceania', Country: 'New Zealand', LifeExpectancy: 80.204, GDP: 25185.00911, Population: 4115771 }
];

function logScale(value, domain, range) {
  // 计算域和范围的对数
  const logDomain = domain.map(x => (x !== 0 ? Math.log10(x) : 0));
  const logRange = range.map(x => Math.log10(x));

  // 计算值在域内的位置，将其映射到范围内
  const t = (Math.log10(value) - logDomain[0]) / (logDomain[1] - logDomain[0]);
  const newValue = (logRange[1] - logRange[0]) * t + logRange[0];

  // 返回映射后的值，还原对数缩放
  return Math.pow(10, newValue);
}

// 图表配置
const spec = {
  type: 'common',
  series: [
    {
      type: 'scatter',
      xField: 'GDP',
      yField: 'LifeExpectancy',
      seriesField: 'continent',
      sizeField: 'Population',
      size: d => logScale(d.Population, [0, Math.max(...data.map(d => d.Population))], [1, 20]),
      // shape: (a, b, c) => {
      //   console.log(a, b, c);
      //   return 'square';
      // }
      shapeField: 'continent',
      shape: {
        type: 'ordinal',
        range: ['square', 'triangle', 'diamond', 'circle']
      }
    }
  ],
  crosshair: {
    yField: {
      visible: true,
      line: { visible: true, type: 'line' },
      label: {
        visible: true // label 默认关闭
      }
    },
    xField: {
      visible: true,
      line: { visible: true, type: 'line' },
      label: {
        visible: true // label 默认关闭
      }
    }
  },

  data: [
    {
      id: 'data',
      values: data
    }
  ],
  axes: [
    {
      orient: 'left',
      type: 'linear',
      range: {
        min: Math.min(...data.map(d => d.LifeExpectancy)),
        max: Math.max(...data.map(d => d.LifeExpectancy))
      },
      title: {
        visible: true,
        text: 'LifeExpectancy'
      },
      domainLine: {
        visible: true
      }
    },
    {
      orient: 'bottom',
      type: 'linear',
      title: {
        visible: true,
        text: 'GDP'
      },
      domainLine: {
        visible: true
      }
    }
  ],
  legends: [
    {
      visible: true,
      orient: 'right'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window.vchart = vchart;
```

## 相关教程

[散点图](link)
