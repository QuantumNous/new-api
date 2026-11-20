# When hovering over a donut chart, how to configure the style of donut chart?

## Question Description

In the interaction of a donut chart, how can the border color, border thickness, radius, and fill opacity of the sectors be changed when the pointer hovers over them?
Additionally, how should the styles of other arc marks, i.e., the ones not being hovered over, be handled?

## Solution

The VChart already provides corresponding functions for this. VChart abstracts various common interactions into mark state. The mark states in VChart are divided into the following categories:

- `default`: Default state, the initial state of the graphic element.
- `hover`: Pointer` hover` state, the state of the graphic element when it is hovered over by the mouse pointer.
- `hover_reverse`: Non-pointer hover state, the state of other graphic elements when a graphic element enters the hover state.
- `selected`: Selected state, the state of the graphic element when it is selected.
- `selected_reverse`: Non-selected state, the state of other graphic elements when a graphic element enters the selected state.
- `dimension_hover`: Dimension hover state, the state when the mouse pointer hovers within a certain x axis area.
- `dimension_hover_reverse`: Non-dimensional hover state, the state of other graphic elements when a graphic element enters the dimension_hover state.

If you want to change the style of pie mark when hovering over a donut chart, you can configure the mark's hover state in the pie configuration.

[Reference documentation: State of Mark](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Mark)

## Code Example

In the following example, the `pie.state` configuration includes four states:

1. `hover`: The state of the mark when the pointer hovers over it. It displays a border, reduces the fill opacity, and expands the outer radius.
2. `hover_reverse`: The state of other marks when they are not being hovered over. It reduces the outer radius.
3. `selected`: The state of the mark when it is selected by the pointer. It enlarges both the inner and outer radii.
4. `selected_reverse`: The state of other marks when they are not selected. It reduces the fill opacity.

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'data',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.5,
  pie: {
    state: {
      hover: {
        stroke: '#0FF',
        lineWidth: 1,

        fillOpacity: 0.9,
        outerRadius: 0.85
      },
      hover_reverse: {
        outerRadius: 0.7,
        innerRadius: 0.5
      },
      selected: {
        outerRadius: 0.85,
        innerRadius: 0.6
      },
      selected_reverse: {
        fillOpacity: 0.25
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Mark State Tutorial](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Mark)
- [Chart Demo](https://visactor.io/vchart/demo/pie-chart/ring?keyword=pieChart)
