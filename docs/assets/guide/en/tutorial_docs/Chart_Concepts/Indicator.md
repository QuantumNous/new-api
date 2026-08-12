# Indicator Card

Indicator Card (Indicator) is an important component used in pie charts, rose charts, radar charts, and other polar coordinate charts. It can display the key data information of the chart, making the chart more informative and readable. This tutorial mainly explains the related concepts and components of the indicator. For more detailed configuration and examples of indicators, please refer to the [Configuration Document](../../../option) and [Example](../../../example) pages.

## Composition

Indicator Card (Indicator) is mainly composed of the following parts:

1. Title: Used to display the main information of the card.
2. Content: Used to display the detailed data of the indicator card.
3. Interaction Trigger: Used to configure the triggering method of indicator card updates.

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a16.png" alt="Indicator Schematic">
</div>

## Interaction

The Indicator Card (Indicator) component provides interactive capabilities. With different chart elements hovered or clicked by the user, the content of the indicator card can be dynamically updated. By configuring the triggering method, you can customize the changes of the indicator card when the chart elements are hovered or clicked by the mouse.

```ts
{
  indicator: {
    trigger: 'hover',
  }
}
```

## Examples

### Pie Chart with Indicator Card

In this example, we used the `indicator` configuration to implement the indicator card component. Now let's analyze the details of this configuration:

1. `visible: true`: The indicator card is visible.
2. `trigger: 'hover'`: Specifies to update the data of  indicator card when the mouse hovers over the chart.
3. `limitRatio 0.4`: Specifies the maximum width of the indicator card as a ratio of the entire pie chart width.
4. `title` object: The title of the indicator card. In this:
   - `visible: true`: Specifies that the title is visible.
   - `autoFit true`: Specifies that the title automatically adapts to the width of the indicator card.
   - `style` object: Configure the title style, including font, color, etc.
   - `text` anonymous function: Dynamically generate the title text.
5. `content` array: Configure the content of the indicator card. In this:
   - `visible: true`: Specifies that the content is visible.
   - `style` object: Configure the content style, including text content, font, color, etc.
   - `text` anonymous function: Dynamically generate the content text based on data.

With the above configuration, we successfully created a pie chart with an indicator card. Below is an example image of the actual effect of the pie chart:

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  indicator: {
    visible: true,
    trigger: 'hover',
    limitRatio: 0.4,
    title: {
      visible: true,
      autoFit: true,
      style: {
        fontWeight: 'bolder',
        fontFamily: 'Times New Roman',
        fill: '#888',
        text: datum => {
          const d = datum ?? data[0];
          return d['formula'];
        }
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 20,
          fill: 'orange',
          fontWeight: 'bolder',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['type'];
          }
        }
      },
      {
        visible: true,
        style: {
          fontSize: 18,
          fill: 'orange',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['value'] + '%';
          }
        }
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'left',
    item: {
      shape: {
        style: {
          symbolType: 'circle',
          texture: datum => datum['texture']
        }
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```
