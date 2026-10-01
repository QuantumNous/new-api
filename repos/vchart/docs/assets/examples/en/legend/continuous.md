---
category: demo
group: legend
title: Continuous Legend
keywords: scatterChart,comparison,distribution,scatter,legend
order: 27-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/legend/continuous.png
option: scatterChart#legends
---

# Continuous Legend

Continuous legend is used to represent continuous data, such as color, size, etc.

## Key Configuration

- Color legend: Configure `{ type: 'color' }` in `legends`, and associate the data field controlled by the continuous legend through the `field` attribute
- Size legend: Configure `{ type: 'size' }` in `legends`, and associate the data field controlled by the continuous legend through the `field` attribute

## Demo source

```javascript livedemo
const spec = {
  type: 'scatter',
  data: [
    {
      id: 'data',
      values: [
        {
          name: 'GuangDong',
          y: 337994.9930600375,
          c: 1453763.5144729614,
          size: 863255.7392129898,
          x: 19.850000239908695
        },
        {
          name: 'LiaoNing',
          y: -168038.7239317,
          size: 863255.7392129898,
          c: 863255.7392129898,
          x: 220.0000034570694
        },
        {
          name: 'GuiZhou',
          y: 18998.42001771927,
          size: 108223.60027313232,
          c: 108223.60027313232,
          x: 1.2000000178813934
        },
        {
          name: 'HeiLongJiang',
          y: 257172.0618750155,
          size: 1179437.1639633179,
          c: 1179437.1639633179,
          x: 9.350000083446503
        },
        {
          name: 'AnHui',
          y: 149028.80988395214,
          size: 629312.1919708252,
          c: 629312.1919708252,
          x: 5.500000059604645
        },
        {
          name: 'ChongQing',
          y: 64431.75177577138,
          size: 361993.9318008423,
          c: 361993.9318008423,
          x: 4.200000062584877
        },
        {
          name: 'HuBei',
          y: -132032.34773816913,
          size: 622537.3305253983,
          c: 622537.3305253983,
          x: 184.6000028848648
        },
        {
          name: 'ZheJiang',
          y: -131728.99608793855,
          size: 452523.242269516,
          c: 452523.242269516,
          x: 134.2000021636486
        },
        {
          name: 'ShanXi',
          y: 105814.68778556585,
          size: 457924.1689968109,
          c: 457924.1689968109,
          x: 1.600000023841858
        },
        {
          name: 'GanSu',
          y: -42682.19228865206,
          size: 179415.02758216858,
          c: 179415.02758216858,
          x: 49.80000078678131
        },
        {
          name: 'JiLin',
          y: 153058.17127805948,
          size: 640540.5713615417,
          c: 640540.5713615417,
          x: 5.400000050663948
        },
        {
          name: 'ShangHai',
          y: 121650.08878350258,
          size: 582742.5663032532,
          c: 582742.5663032532,
          x: 2.0000000298023224
        },
        {
          name: 'HuNan',
          y: 156735.92889063805,
          size: 723874.2084827423,
          c: 723874.2084827423,
          x: 10.950000144541264
        },
        {
          name: 'YunNan',
          y: 86639.16781044006,
          size: 361091.76978874207,
          c: 361091.76978874207,
          x: 2.600000038743019
        },
        {
          name: 'FuJian',
          y: 142601.731725201,
          size: 547162.5310325623,
          c: 547162.5310325623,
          x: 1.2000000178813934
        },
        {
          name: 'NeiMengGu',
          y: -57707.88812363148,
          size: 273677.012925148,
          c: 273677.012925148,
          x: 68.60000109672546
        },
        {
          name: 'ShanDong',
          y: 385463.00792324543,
          size: 1587696.9900550842,
          c: 1587696.9900550842,
          x: 2.8000000417232513
        },
        {
          name: 'TianJin',
          y: 117704.09058022499,
          size: 550210.6289558411,
          c: 550210.6289558411,
          x: 1.5
        },
        {
          name: 'BeiJing',
          y: 91961.93995001912,
          size: 409399.19856643677,
          c: 409399.19856643677,
          x: 0
        },
        {
          name: 'NingXia',
          y: 8537.619744062424,
          size: 58159.000633239746,
          c: 58159.000633239746,
          x: 0.800000011920929
        },
        {
          name: 'XinJiang',
          y: 14606.06029844284,
          size: 70135.020778656,
          c: 70135.020778656,
          x: 0.800000011920929
        },
        {
          name: 'HeBei',
          y: 172031.6850079298,
          size: 791303.4042472839,
          c: 791303.4042472839,
          x: 3
        },
        {
          name: 'QingHai',
          y: 12277.299978733063,
          size: 49884.379943847656,
          c: 49884.379943847656,
          x: 0.4000000059604645
        },
        {
          name: 'GuangXi',
          y: 84724.26922267675,
          size: 377872.828125,
          c: 377872.828125,
          x: 4.500000052154064
        },
        {
          name: 'JiangXi',
          y: 47807.06022775173,
          size: 237467.70012283325,
          c: 237467.70012283325,
          x: 0.800000011920929
        },
        {
          name: 'ShanXi',
          y: 107063.39007788897,
          size: 424079.76944351196,
          c: 424079.76944351196,
          x: 1
        },
        {
          name: 'HaiNan',
          y: 39722.12303733826,
          size: 169360.84245681763,
          c: 169360.84245681763,
          x: 2.1500000208616257
        },
        {
          name: 'SiChuan',
          y: -89487.52344161272,
          size: 401269.59553718567,
          c: 401269.59553718567,
          x: 126.00000196695328
        },
        {
          name: 'HeNan',
          y: 199528.67920143902,
          size: 854028.8028030396,
          c: 854028.8028030396,
          x: 10.300000131130219
        },
        {
          name: 'XiZang',
          y: 1266.5800173282623,
          size: 10025.17980957031,
          c: 10025.17980957031,
          x: 0
        },
        {
          name: 'JiangSu',
          y: -107603.01941305399,
          size: 650545.2204933167,
          c: 650545.2204933167,
          x: 184.6000028848648
        }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  sizeField: 'size',
  point: {
    style: {
      fill: {
        field: 'c',
        scale: 'color'
      }
    }
  },
  color: {
    type: 'linear',
    domain: [
      {
        dataId: 'data',
        fields: ['c']
      }
    ],
    range: ['#b2e3ff', '#0050b3']
  },
  size: {
    type: 'linear',
    range: [5, 30]
  },
  legends: [
    {
      visible: true,
      type: 'color',
      field: 'c',
      title: {
        visible: true,
        text: 'Color Legend'
      },
      orient: 'left'
    },
    {
      visible: true,
      type: 'size',
      field: 'size',
      orient: 'right',
      title: {
        visible: true,
        text: 'Size Legend'
      }
    }
  ],
  axes: [
    {
      orient: 'bottom',
      type: 'linear'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach the links to tutorials or API documents related to this demo configuration.
