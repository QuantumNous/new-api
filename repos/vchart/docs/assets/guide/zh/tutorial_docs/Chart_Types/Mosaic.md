# 马赛克图

[\[配置项\]](../../../option/mosaic)

## 简介

马赛克图（Mosaic）英文学名为 Mosaic Plot，是分组显示数据百分比的一种特殊类型的堆叠柱状图，多用于统计学领域。

2 维的马赛克图是百分比堆积柱图的扩展，除了展示堆积类内部的百分比信息以外，还展示了堆积类目之间的百分比占比情况;

![mosaic-chart](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-guide/mosaic-chart.png)

### 图表构成

马赛克图的配置和柱状图的配置基本一致，由矩形图元、坐标轴及其他组件构成。

以下为必传的一些配置：

- `type`: 图表类型，类型为`'mosaic'`
- `data`: 图表绘制的数据源
- `xField`: 分类字段，映射图元的 x 坐标 / 宽度
- `yField`: 数值字段，映射图元的高度 / y 坐标

- 更多组件配置见[VChart MosaicChart 配置](../../../option/mosaic)

### 快速上手

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入registerMosaicChart并执行
// import { registerMosaicChart } from '@visactor/vchart';
// registerMosaicChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerMosaicChart();
/** --在业务中使用时请删除以上代码-- */
const spec = {
  type: 'mosaic',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],

  label: [
    {
      visible: true,
      position: 'bottom',
      style: {
        fill: '#333'
      },
      filterByGroup: {
        field: 'State',
        type: 'min'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return datum['State'];
      }
    },

    {
      visible: true,
      position: 'top',
      style: {
        fill: '#333'
      },
      filterByGroup: {
        field: 'State',
        type: 'max'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return `${datum['__VCHART_STACK_END']} ( ${(
          (datum['__VCHART_MOSAIC_CAT_END_PERCENT'] - datum['__VCHART_MOSAIC_CAT_START_PERCENT']) *
          100
        ).toFixed(0)}% )`;
      }
    },
    {
      visible: true,
      position: 'center',
      smartInvert: true
    }
  ],
  xField: 'State',
  yField: 'Population',
  seriesField: 'Age',
  percent: true,
  legends: {
    visible: true
  },
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod: val => {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    }
    // {
    //   orient: 'bottom',
    //   label: {
    //     visible: false
    //   }
    // }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### 关键配置

- `type` 属性设置图表类型为`'mosaic'`

## 马赛克图的特性

### 数据

马赛克图用于展示 2 个维度的数据较多

- 两个`离散` 字段，如: `product`、`type`
- 一个`数值`字段，如: `sales`

参考示例如下:

```ts
data: [
  {
    name: 'bar',
    values: [
      {
        product: '数码产品',
        type: 'a',
        sales: 20
      },
      {
        product: '数码产品',
        type: 'b',
        sales: 20
      },
      {
        product: '日用品',
        sales: 50
      },
      {
        product: '食品',
        sales: 80
      }
    ]
  }
];
```

注意：和百分比堆积图类似，马赛克图中的数据一般不推荐有负数

### 没有分组字段的马赛克图

马赛克图在展示没有分组字段的数据的时候，默认不做百分比堆积，只做分类维度的一个百分比展示，是对基础柱图的一个扩展：

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入registerMosaicChart并执行
// import { registerMosaicChart } from '@visactor/vchart';
// registerMosaicChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerMosaicChart();
/** --在业务中使用时请删除以上代码-- */
const spec = {
  type: 'mosaic',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  label: [
    {
      visible: true,
      position: 'bottom',
      style: {
        fill: '#333'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return datum['month'];
      }
    },
    {
      visible: true,
      position: 'top',
      style: {
        fill: '#333'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return datum['sales'];
      }
    }
  ],
  axes: [
    {
      orient: 'bottom',
      label: {
        visible: false
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### 坐标轴

水平方向的马赛克图的坐标轴默认配置如下：

- x 轴默认的比例尺类型为`linear`，默认不展示标签，建议通过`label`展示标签值

```ts
{
  orient: 'bottom',
  type: 'linear',
  label: {
    visible: false
  }
} as ICartesianAxisSpec;
```

- y 轴默认配置如下：

```ts
return {
  orient: 'left',
  type: 'linear'
} as ICartesianAxisSpec;
```
