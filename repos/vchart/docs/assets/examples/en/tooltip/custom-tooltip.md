---
category: demo
group: tooltip
title: Custom tooltip style
keywords: tooltip
order: 26-0
cover: /vchart/preview/custom-tooltip.png
option: barChart#tooltip
---

# Custom tooltip style

The default tooltip supports custom configuration in style, content, and location.

## Demo source

```javascript livedemo
const markLineValue = 10000;
const spec = {
  type: 'line',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  stack: false,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  lineLabel: { visible: true },
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  point: {
    style: {
      opacity: 0
    },
    state: {
      dimension_hover: {
        opacity: 1,
        size: 10,
        lineWidth: 2,
        stroke: {
          scale: 'color',
          field: 'country'
        },
        fill: 'white'
      }
    }
  },
  markLine: [
    {
      y: markLineValue,
      endSymbol: {
        visible: false
      },
      line: {
        style: {
          stroke: 'orange',
          lineWidth: 2
        }
      }
    }
  ],
  tooltip: {
    mark: {
      position: 'bottom',
      content: [
        {
          key: datum => datum.country,
          value: datum => datum.value,
          shapeLineWidth: 0.1,
          shapeColor: 'white',
          shapeType: 'circle'
        }
      ]
    },
    dimension: {
      content: [
        {
          key: datum => datum.country,
          value: datum => datum.value,
          shapeLineWidth: 0.1,
          shapeColor: 'white',
          shapeType: 'circle'
        }
      ],
      position: 'top',
      positionMode: 'pointer',
      updateContent: prev => {
        console.log(prev);
        // sort tooltip items
        prev.sort((a, b) => b.value - a.value);
        // highlight tooltip items whose value is greater than mark line
        prev.forEach(item => {
          if (item.value >= markLineValue) {
            item.valueStyle = {
              fill: 'red'
            };
          }
        });
        // add a new tooltip line
        prev.push({
          key: 'Mark Line',
          value: markLineValue,
          keyStyle: {
            fill: 'orange'
          },
          valueStyle: {
            fill: 'orange'
          },
          shapeType:
            'M44.3,22.1H25.6V3.3h18.8V22.1z M76.8,3.3H58v18.8h18.8V3.3z M99.8,3.3h-9.4v18.8h9.4V3.3z M12.9,3.3H3.5v18.8h9.4V3.3z',
          shapeColor: 'orange',
          hasShape: true
        });
      }
    },
    style: {
      panel: {
        padding: {
          top: 10,
          bottom: 15,
          left: 10,
          right: 10
        },
        backgroundColor: '#eee',
        border: {
          color: '#ccc',
          width: 1,
          radius: 10
        },
        shadow: {
          x: 0,
          y: 0,
          blur: 10,
          spread: 5,
          color: '#ddd'
        }
      },
      titleLabel: {
        fontSize: 20,
        fontFamily: 'Times New Roman',
        fill: 'brown',
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 24
      },
      keyLabel: {
        fontSize: 14,
        fontFamily: 'Times New Roman',
        fill: 'black',
        textAlign: 'center',
        lineHeight: 15,
        spacing: 10
      },
      valueLabel: {
        fontSize: 14,
        fill: 'black',
        textAlign: 'center',
        lineHeight: 15,
        spacing: 10
      },
      shape: {
        size: 15,
        spacing: 10
      },
      spaceRow: 10
    },
    offset: {
      y: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach a link to the tutorial or API documentation associated with this demo configuration.
