# 地图组件，如何根据数值自定义区块颜色？

## 问题描述

类似 vchart 这样的[填充地图](https://visactor.io/vchart/demo/map-chart/basic-map)，怎么能自定义区块颜色的规则？示例里的配置不太符合我的需求。我希望当值在某个区间，显示一个指定的颜色。

## 解决方案

在 VChart 中，可以通过地图图元样式配置中，填充色（fill）的回调函数来实现你的需求，类似：

```js
const colorGroup = [
  {
    range: [1, 100],
    color: 'rgb(252,250,97)'
  },
  {
    range: [101, 200],
    color: 'rgb(252,150,134)'
  },
  {
    range: [201, 300],
    color: 'rgb(87,33,15)'
  }
];

area: {
  style: {
    fill: datum => {
      const res = colorGroup.find(item => item.range[0] <= +datum.value && item.range[1] >= +datum.value);
      return res ? res.color : 'WhiteSmoke';
    };
  }
}
```

## 代码示例

```javascript livedemo
const colorGroup = [
  {
    range: [1, 100],
    color: 'rgb(252,250,97)'
  },
  {
    range: [101, 200],
    color: 'rgb(252,150,134)'
  },
  {
    range: [201, 300],
    color: 'rgb(87,33,15)'
  }
];
const spec = {
  type: 'map',
  data: [
    {
      values: [
        {
          name: 'Alabama',
          value: 0
        },
        {
          name: 'Alaska',
          value: 140
        },
        {
          name: 'Arizona',
          value: 39
        },
        {
          name: 'Arkansas',
          value: 62
        },
        {
          name: 'California',
          value: 235
        },
        {
          name: 'Colorado',
          value: 49
        },
        {
          name: 'Connecticut',
          value: 137
        },
        {
          name: 'Delaware',
          value: 149
        },
        {
          name: 'District of Columbia',
          value: 285
        },
        {
          name: 'Florida',
          value: 198
        },
        {
          name: 'Georgia',
          value: 53
        },
        {
          name: 'Hawaii',
          value: 41
        },
        {
          name: 'Idaho',
          value: 82
        },
        {
          name: 'Illinois',
          value: 240
        },
        {
          name: 'Indiana',
          value: 273
        },
        {
          name: 'Iowa',
          value: 101
        },
        {
          name: 'Kansas',
          value: 215
        },
        {
          name: 'Kentucky',
          value: 41
        },
        {
          name: 'Louisiana',
          value: 37
        },
        {
          name: 'Maine',
          value: 107
        },
        {
          name: 'Maryland',
          value: 62
        },
        {
          name: 'Massachusetts',
          value: 61
        },
        {
          name: 'Michigan',
          value: 134
        },
        {
          name: 'Minnesota',
          value: 241
        },
        {
          name: 'Mississippi',
          value: 259
        },
        {
          name: 'Missouri',
          value: 144
        },
        {
          name: 'Montana',
          value: 92
        },
        {
          name: 'Nebraska',
          value: 117
        },
        {
          name: 'Nevada',
          value: 24
        },
        {
          name: 'New Hampshire',
          value: 106
        },
        {
          name: 'New Jersey',
          value: 147
        },
        {
          name: 'New Mexico',
          value: 77
        },
        {
          name: 'New York',
          value: 47
        },
        {
          name: 'North Carolina',
          value: 260
        },
        {
          name: 'North Dakota',
          value: 223
        },
        {
          name: 'Ohio',
          value: 283
        },
        {
          name: 'Oklahoma',
          value: 85
        },
        {
          name: 'Oregon',
          value: 31
        },
        {
          name: 'Pennsylvania',
          value: 65
        },
        {
          name: 'Rhode Island',
          value: 68
        },
        {
          name: 'South Carolina',
          value: 216
        },
        {
          name: 'South Dakota',
          value: 12
        },
        {
          name: 'Tennessee',
          value: 128
        },
        {
          name: 'Texas',
          value: 198
        },
        {
          name: 'Utah',
          value: 93
        },
        {
          name: 'Vermont',
          value: 66
        },
        {
          name: 'Virginia',
          value: 167
        },
        {
          name: 'Washington',
          value: 47
        },
        {
          name: 'West Virginia',
          value: 170
        },
        {
          name: 'Wisconsin',
          value: 20
        },
        {
          name: 'Wyoming',
          value: 203
        }
      ]
    }
  ],
  area: {
    style: {
      fill: datum => {
        const res = colorGroup.find(item => item.range[0] <= +datum.value && item.range[1] >= +datum.value);
        return res ? res.color : 'WhiteSmoke';
      }
    }
  },
  nameField: 'name',
  valueField: 'value',
  nameProperty: 'name',
  map: 'usa',
  region: [
    {
      roam: true,
      projection: {
        type: 'albersUsa'
      }
    }
  ]
};

const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/geojson/usa.json');
const geojson = await response.json();
VChart.registerMap('usa', geojson);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [更多 demo](https://visactor.io/vchart/demo/map-chart/basic-map?keyword=map)
- [地图教程](https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Map)
- [相关 api](https://visactor.io/vchart/option/mapChart#area.style)
- [github](https://github.com/VisActor/VChart)
