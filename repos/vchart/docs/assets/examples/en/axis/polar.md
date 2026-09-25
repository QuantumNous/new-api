---
category: demo
group: axis
title: Polar Axis Configuration
keywords: roseChart,comparison,composition,circle,axis
order: 25-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/polar.png
option: roseChart#axes
---

# Polar Axis Configuration

There are two types of axes in the polar coordinate system:

- Arc axis, specified by `orient: angle`. When `innerRadius` is configured on the spec, we can use the `inside` attribute on the axis to display the arc axis on the inner circle.
- Radius axis, specified by `orient: radius`.

## Key Configuration

Configure the `grid.alternateColor` property on the `axes` property for the specified direction axis:

- If only one color is needed for filling, use a string.
- If multiple colors are needed for alternating filling, use a string array.

## Live Demo

```javascript livedemo
const spec = {
  type: 'rose',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'AL',
          age: 'Under 5 Years',
          population: 310504,
          type: 'a'
        },
        {
          State: 'AL',
          age: '5 to 13 Years',
          population: 552339,
          type: 'a'
        },
        {
          State: 'AL',
          age: '14 to 17 Years',
          population: 259034,
          type: 'a'
        },
        {
          State: 'AL',
          age: '18 to 24 Years',
          population: 450818,
          type: 'b'
        },
        {
          State: 'AL',
          age: '25 to 44 Years',
          population: 1231572,
          type: 'c'
        },
        {
          State: 'AL',
          age: '45 to 64 Years',
          population: 1215966,
          type: 'd'
        },
        {
          State: 'AL',
          age: '65 Years and Over',
          population: 641667,
          type: 'd'
        },
        {
          State: 'AK',
          age: 'Under 5 Years',
          population: 52083,
          type: 'a'
        },
        {
          State: 'AK',
          age: '5 to 13 Years',
          population: 85640,
          type: 'a'
        },
        {
          State: 'AK',
          age: '14 to 17 Years',
          population: 42153,
          type: 'a'
        },
        {
          State: 'AK',
          age: '18 to 24 Years',
          population: 74257,
          type: 'b'
        },
        {
          State: 'AK',
          age: '25 to 44 Years',
          population: 198724,
          type: 'c'
        },
        {
          State: 'AK',
          age: '45 to 64 Years',
          population: 183159,
          type: 'd'
        },
        {
          State: 'AK',
          age: '65 Years and Over',
          population: 50277,
          type: 'd'
        },
        {
          State: 'AZ',
          age: 'Under 5 Years',
          population: 515910,
          type: 'a'
        },
        {
          State: 'AZ',
          age: '5 to 13 Years',
          population: 828669,
          type: 'a'
        },
        {
          State: 'AZ',
          age: '14 to 17 Years',
          population: 362642,
          type: 'a'
        },
        {
          State: 'AZ',
          age: '18 to 24 Years',
          population: 601943,
          type: 'b'
        },
        {
          State: 'AZ',
          age: '25 to 44 Years',
          population: 1804762,
          type: 'c'
        },
        {
          State: 'AZ',
          age: '45 to 64 Years',
          population: 1523681,
          type: 'd'
        },
        {
          State: 'AZ',
          age: '65 Years and Over',
          population: 862573,
          type: 'd'
        },
        {
          State: 'AR',
          age: 'Under 5 Years',
          population: 202070,
          type: 'a'
        },
        {
          State: 'AR',
          age: '5 to 13 Years',
          population: 343207,
          type: 'a'
        },
        {
          State: 'AR',
          age: '14 to 17 Years',
          population: 157204,
          type: 'a'
        },
        {
          State: 'AR',
          age: '18 to 24 Years',
          population: 264160,
          type: 'b'
        },
        {
          State: 'AR',
          age: '25 to 44 Years',
          population: 754420,
          type: 'c'
        },
        {
          State: 'AR',
          age: '45 to 64 Years',
          population: 727124,
          type: 'd'
        },
        {
          State: 'AR',
          age: '65 Years and Over',
          population: 407205,
          type: 'd'
        },
        {
          State: 'CA',
          age: 'Under 5 Years',
          population: 2704659,
          type: 'a'
        },
        {
          State: 'CA',
          age: '5 to 13 Years',
          population: 4499890,
          type: 'a'
        },
        {
          State: 'CA',
          age: '14 to 17 Years',
          population: 2159981,
          type: 'a'
        },
        {
          State: 'CA',
          age: '18 to 24 Years',
          population: 3853788,
          type: 'b'
        },
        {
          State: 'CA',
          age: '25 to 44 Years',
          population: 10604510,
          type: 'c'
        },
        {
          State: 'CA',
          age: '45 to 64 Years',
          population: 8819342,
          type: 'd'
        },
        {
          State: 'CA',
          age: '65 Years and Over',
          population: 4114496,
          type: 'd'
        },
        {
          State: 'CO',
          age: 'Under 5 Years',
          population: 358280,
          type: 'a'
        },
        {
          State: 'CO',
          age: '5 to 13 Years',
          population: 587154,
          type: 'a'
        },
        {
          State: 'CO',
          age: '14 to 17 Years',
          population: 261701,
          type: 'a'
        },
        {
          State: 'CO',
          age: '18 to 24 Years',
          population: 466194,
          type: 'b'
        },
        {
          State: 'CO',
          age: '25 to 44 Years',
          population: 1464939,
          type: 'c'
        },
        {
          State: 'CO',
          age: '45 to 64 Years',
          population: 1290094,
          type: 'd'
        },
        {
          State: 'CO',
          age: '65 Years and Over',
          population: 511094,
          type: 'd'
        },
        {
          State: 'CT',
          age: 'Under 5 Years',
          population: 211637,
          type: 'a'
        },
        {
          State: 'CT',
          age: '5 to 13 Years',
          population: 403658,
          type: 'a'
        },
        {
          State: 'CT',
          age: '14 to 17 Years',
          population: 196918,
          type: 'a'
        },
        {
          State: 'CT',
          age: '18 to 24 Years',
          population: 325110,
          type: 'b'
        },
        {
          State: 'CT',
          age: '25 to 44 Years',
          population: 916955,
          type: 'c'
        },
        {
          State: 'CT',
          age: '45 to 64 Years',
          population: 968967,
          type: 'd'
        },
        {
          State: 'CT',
          age: '65 Years and Over',
          population: 478007,
          type: 'd'
        }
      ]
    }
  ],
  padding: {
    top: 30
  },
  radius: 1,
  innerRadius: 0.6,
  categoryField: ['State', 'type'],
  valueField: 'population',
  seriesField: 'age',
  stack: true,
  color: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00'],
  axes: [
    {
      orient: 'radius',
      visible: true,
      label: {
        visible: true,
        formatMethod: val => {
          return val / 1000000 + 'M';
        },
        style: {
          lineWidth: 2,
          stroke: '#fff',
          fill: '#000'
        }
      },
      grid: {
        visible: true,
        smooth: true,
        style: {
          lineDash: [0]
        }
      },
      title: {
        visible: true,
        position: 'end',
        text: 'population',
        autoRotate: false,
        style: {
          textAlign: 'start',
          dy: -10,
          dx: -10
        }
      }
    },
    {
      orient: 'angle',
      visible: true,
      inside: true, // display the arc axis in the inner circle
      // configure the title of the arc axis
      title: {
        visible: true,
        position: 'center', // the title display position is the center of the circle
        text: 'State',
        padding: 4,
        background: {
          visible: true,
          style: {
            fill: 'rgba(0, 0, 0, 0.3)',
            cornerRadius: 4
          }
        }
      },
      tick: {
        visible: true,
        style: {
          stroke: '#000'
        }
      },
      domainLine: {
        visible: true
      },
      label: {
        visible: true,
        style: {
          fill: '#000'
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation related to the demo configuration.
