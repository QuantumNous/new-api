{{ target: series-scatter }}

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  seriesType = 'scatter',
  seriesMarks = ['point'],
  noMorph = ${noMorph},
  noStack = ${noStack},
  useInChart = ${useInChart},
  preset = 'scaleIn' + '|' + 'fadeIn',
  defaultPreset = 'scaleIn'
) }}

#${prefix} label(Object)

标签配置。

##${prefix} position(string|Function) = 'outside'

标签位置。

自 `1.6.0` 版本后，柱系列中，`position` 配置可以为函数形式，例如：

```ts
label: {
  position: (datum: any) => {
    return datum.year === '2000' ? 'top' : 'bottom';
  };
}
```

可选字符串值为：

- `'top'`
- `'bottom'`
- `'left'`
- `'right'`
- `'top-right'`
- `'top-left'`
- `'bottom-right'`
- `'bottom-left'`
- `'center'`

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  hasOverlap = true,
  hasSmartInvert = true,
  defaultOffset = 5,
) }}

#${prefix} point(Object)

点图元配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'point'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

以下是一个简单示例：

```ts
const spec = {
  type: 'scatter',
  data: [
    {
      values: [
        {
          x: 1,
          y: 1,
          size: 10,
          type: 'A'
        },
        {
          x: 10,
          y: 10,
          size: 20,
          type: 'B'
        },
        {
          x: 20,
          y: 20,
          size: 30,
          type: 'C'
        }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  // point
  point: {
    state: {
      hover: {
        scaleX: 1.2,
        scaleY: 1.2
      }
    },
    style: {
      fillOpacity: 0.5
    }
  },
  // shape
  shapeField: 'type',
  shape: {
    type: 'ordinal',
    range: ['star', 'triangleLeft', 'diamond']
  },
  // size
  sizeField: 'size',
  size: {
    type: 'linear',
    range: [30, 60]
  },
  direction: 'vertical'
};
```

#${prefix} sizeField(string)

点尺寸 对应的数据字段。

#${prefix} size(number|Array|Object|Function)

尺寸视觉通道，支持：

- `number`
- `number[]`
- `FunctionType<number>`
- `IVisualSpecBase<unknown, number>`

#${prefix} shapeField(string|Array|Function|Object)

点形状对应的数据字段。

#${prefix} shape(number|Object|Function|Array)

形状视觉通道，支持：

- `string`
- `string[]`
- `FunctionType<ShapeType>`
- `IVisualSpecBase<unknown, ShapeType>`
