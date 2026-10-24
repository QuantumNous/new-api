---
category: demo
group: legend
title: 离散图例指定scale
keywords: radarChart,legend,circle,comparison,composition
order: 27-9
cover: /vchart/preview/legend-discrete-legend-scale_1.10.4.png
option: radarChart#legends
---

# Specify Scale for Discrete Legend

Analyze legend data by associating with `scale`

## Key Configurations

- `legends` configure legends
- `scaleName` configure the scale mapped by the legend
- `field` Configure the field corresponding to the legend

## 代码演示

```javascript livedemo
const spec = {
  type: 'radar',
  categoryField: 'date',
  valueField: 'value',
  seriesField: 'group',

  data: {
    id: 'data0',
    values: [
      {
        cat0: 'Small Business',
        date: '2016',
        cat1: 'Furniture',
        group: 'Small Business  Furniture',
        value: '402'
      },
      {
        cat0: 'Small Business',
        date: '2016',
        cat1: 'Technology',
        group: 'Small Business  Technology',
        value: '279'
      },
      {
        cat0: 'Small Business',
        date: '2016',
        cat1: 'Office Supplies',
        group: 'Small Business  Office Supplies',
        value: '827'
      },
      {
        cat0: 'Company',
        date: '2016',
        cat1: 'Technology',
        group: 'Company  Technology',
        value: '564'
      },
      {
        cat0: 'Company',
        date: '2016',
        cat1: 'Furniture',
        group: 'Company  Furniture',
        value: '566'
      },
      {
        cat0: 'Company',
        date: '2016',
        cat1: 'Office Supplies',
        group: 'Company  Office Supplies',
        value: '1472'
      },
      {
        cat0: 'Company',
        date: '2017',
        cat1: 'Furniture',
        group: 'Company  Furniture',
        value: '618'
      },
      {
        cat0: 'Small Business',
        date: '2017',
        cat1: 'Furniture',
        group: 'Small Business  Furniture',
        value: '392'
      },
      {
        cat0: 'Company',
        date: '2017',
        cat1: 'Technology',
        group: 'Company  Technology',
        value: '638'
      },
      {
        cat0: 'Company',
        date: '2017',
        cat1: 'Office Supplies',
        group: 'Company  Office Supplies',
        value: '1632'
      },
      {
        cat0: 'Small Business',
        date: '2017',
        cat1: 'Technology',
        group: 'Small Business  Technology',
        value: '412'
      },
      {
        cat0: 'Small Business',
        date: '2017',
        cat1: 'Office Supplies',
        group: 'Small Business  Office Supplies',
        value: '1036'
      },
      {
        cat0: 'Small Business',
        date: '2018',
        cat1: 'Furniture',
        group: 'Small Business  Furniture',
        value: '499'
      },
      {
        cat0: 'Company',
        date: '2018',
        cat1: 'Furniture',
        group: 'Company  Furniture',
        value: '893'
      },
      {
        cat0: 'Small Business',
        date: '2018',
        cat1: 'Office Supplies',
        group: 'Small Business  Office Supplies',
        value: '1262'
      },
      {
        cat0: 'Company',
        date: '2018',
        cat1: 'Technology',
        group: 'Company  Technology',
        value: '855'
      },
      {
        cat0: 'Small Business',
        date: '2018',
        cat1: 'Technology',
        group: 'Small Business  Technology',
        value: '436'
      },
      {
        cat0: 'Company',
        date: '2018',
        cat1: 'Office Supplies',
        group: 'Company  Office Supplies',
        value: '2218'
      },
      {
        cat0: 'Small Business',
        date: '2019',
        cat1: 'Office Supplies',
        group: 'Small Business  Office Supplies',
        value: '692'
      },
      {
        cat0: 'Company',
        date: '2019',
        cat1: 'Office Supplies',
        group: 'Company  Office Supplies',
        value: '1177'
      },
      {
        cat0: 'Company',
        date: '2019',
        cat1: 'Furniture',
        group: 'Company  Furniture',
        value: '482'
      },
      {
        cat0: 'Company',
        date: '2019',
        cat1: 'Technology',
        group: 'Company  Technology',
        value: '451'
      },
      {
        cat0: 'Small Business',
        date: '2019',
        cat1: 'Furniture',
        group: 'Small Business  Furniture',
        value: '302'
      },
      {
        cat0: 'Small Business',
        date: '2019',
        cat1: 'Technology',
        group: 'Small Business  Technology',
        value: '229'
      }
    ]
  },
  outerRadius: 0.9,
  axes: [
    {
      orient: 'radius',
      min: 0,
      domainLine: {
        visible: true
      },
      label: {
        visible: true
      },
      grid: {
        smooth: true
      }
    },
    {
      orient: 'angle',
      tick: {
        visible: false
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  legends: {
    orient: 'bottom',
    type: 'discrete',
    maxRow: 1,
    maxCol: 1,
    data: (data, colorScale, globalScale) => {
      return data.map(entry => {
        return {
          ...entry,
          shape: {
            ...entry.shape,
            fill: globalScale.getScale('legendColor').scale(entry.label)
          }
        };
      });
    },
    scaleName: 'legendColor',
    field: 'cat0',
    allowAllCanceled: false,
    item: {
      label: {
        style: {
          fontSize: 12
        }
      }
    }
  },
  label: {
    visible: true,
    style: {
      fontSize: 12
    }
  },
  scales: [
    {
      domain: ['Small Business  Furniture', 'Small Business  Technology', 'Small Business  Office Supplies', 'Company  Technology', 'Company  Furniture', 'Company  Office Supplies'],
      id: 'color',
      type: 'ordinal',
      range: ['#1664FF', '#1664FF', '#1664FF', '#1AC6FF', '#1AC6FF', '#1AC6FF']
    },

    {
      id: 'legendColor',
      type: 'ordinal',
      domain: ['Small Business', 'Company'],
      range: ['#1664FF', '#1AC6FF']
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程
