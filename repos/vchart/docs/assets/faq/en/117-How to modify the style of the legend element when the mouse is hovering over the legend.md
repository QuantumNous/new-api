# How to realize that when the mouse hovers over the legend, the circular legend will be highlighted in a circle and the gray background of the rectangle will be removed?

## Question Description

How to configure the style of the legend when the mouse hovers, hoping to replace the gray background with a larger graphic.

## Solution

The legend of VChart provides the style configuration of the graph when it is hovered by the mouse, and the background can also be turned off.

1. item.background.visible can be used to turn off or turn on the background of the legend item
2. item.shape.state.selectedHover can be used to set the style of the selected shape when it is hovered by the mouse.
3. item.shape.state.unSelectedHover can be used to set the style of the selected shape when it is hovered by the mouse.

The graphic style configuration properties of VChart are unified. Configuring size in selectedHover and unSelectedHover at the same time can ensure that all legend items become larger when hovered by the mouse.

## Code Example

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Round 1', y: 21, c: 'Role A' },
        { x: 'Round 1', y: 38, c: 'Role B' },
        { x: 'Round 2', y: 28, c: 'Role A' },
        { x: 'Round 2', y: 45, c: 'Role B' },
        { x: 'Round 3', y: 22, c: 'Role A' },
        { x: 'Round 3', y: 56, c: 'Role B' },
        { x: 'Round 4', y: 34, c: 'Role A' },
        { x: 'Round 4', y: 48, c: 'Role B' },
        { x: 'Round 5', y: 34, c: 'Role A' },
        { x: 'Round 5', y: 64, c: 'Role B' },
        { x: 'Round 6', y: 44, c: 'Role A' },
        { x: 'Round 6', y: 72, c: 'Role B' },
        { x: 'Round 7', y: 38, c: 'Role A' },
        { x: 'Round 7', y: 65, c: 'Role B' },
        { x: 'Round 8', y: 24, c: 'Role A' },
        { x: 'Round 8', y: 70, c: 'Role B' },
        { x: 'Round 9', y: 28, c: 'Role A' },
        { x: 'Round 9', y: 62, c: 'Role B' }
      ]
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom',
    item: {
      background: {
        visible: false
      },
      shape: {
        state: {
          selectedHover: {
            size: 15
          },
          unSelectedHover: {
            size: 15
          }
        }
      }
    }
  },
  xField: 'x',
  yField: 'y',
  seriesField: 'c'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Legends background configuration](https://www.visactor.io/vchart/option/barChart#legends-discrete.item.background.visible)
- [Legends item hover](https://www.visactor.io/vchart/option/barChart#legends-discrete.item.shape.state.selectedHover)
