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

Label configuration.

##${prefix} position(string|Function) = 'outside'

Label position.

Since `1.6.0` version, in bar series, `position` can be a function, for example:

```ts
label: {
  position: (datum: any) => {
    return datum.year === '2000' ? 'top' : 'bottom';
  };
}
```

Available string options are:

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

Point element configuration.

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

Below is a simple example:

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

Data field corresponding to point size.

#${prefix} size(number|Array|Object|Function)

Size visual channel, supports:

- `number`
- `number[]`
- `FunctionType<number>`
- `IVisualSpecBase<unknown, number>`

#${prefix} shapeField(string|Array|Function|Object)

Data field corresponding to point shape.

#${prefix} shape(number|Object|Function|Array)

Shape visual channel, supports:

- `string`
- `string[]`
- `FunctionType<ShapeType>`
- `IVisualSpecBase<unknown, ShapeType>`
