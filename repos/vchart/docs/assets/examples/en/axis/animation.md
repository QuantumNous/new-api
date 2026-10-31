---
category: demo
group: axis
title: Axis Animation
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-7
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/animation.png
option: barChart#axes
---

# Axis Animation

Axes support animations, but they are turned off by default. If you need to enable them, you need to enable the `animation` property on the specified axis in the `axes` property.

## Key Configuration

Configure `animation: true` for the specified direction axis on the `axes` property.

## Demo source

```javascript livedemo
const asiaData = {
  1973: [
    {
      max: 239.27,
      min: 0,
      country: 'Japan',
      continent: 'Asia'
    },
    {
      max: 22.96,
      min: 0,
      country: 'India',
      continent: 'Asia'
    },
    {
      max: 7.87,
      min: 0,
      country: 'South Korea',
      continent: 'Asia'
    },
    {
      max: 17.24,
      min: 0,
      country: 'Turkey',
      continent: 'Asia'
    },
    {
      max: 10.98,
      min: 0,
      country: 'Indonesia',
      continent: 'Asia'
    },
    {
      max: 23.76,
      min: 0,
      country: 'Saudi Arabia',
      continent: 'Asia'
    },
    {
      max: 4.13,
      min: 0,
      country: 'Thailand',
      continent: 'Asia'
    },
    {
      max: 5.66,
      min: 0,
      country: 'Philippines',
      continent: 'Asia'
    },
    {
      max: 2.78,
      min: 0,
      country: 'Malaysia',
      continent: 'Asia'
    },
    {
      max: 114.75,
      min: 0,
      country: 'United Kingdom',
      continent: 'Europe'
    },
    {
      max: 107.57,
      min: 0,
      country: 'Italy',
      continent: 'Europe'
    },
    {
      max: 55.99,
      min: 0,
      country: 'Spain',
      continent: 'Europe'
    },
    {
      max: 36.41,
      min: 0,
      country: 'Netherlands',
      continent: 'Europe'
    },
    {
      max: 33.92,
      min: 0,
      country: 'Switzerland',
      continent: 'Europe'
    },
    {
      max: 9.93,
      min: 0,
      country: 'Finland',
      continent: 'Europe'
    },
    {
      max: 23.02,
      min: 0,
      country: 'Sweden',
      continent: 'Europe'
    },
    {
      max: 22.28,
      min: 0,
      country: 'Belgium',
      continent: 'Europe'
    },
    {
      max: 14.54,
      min: 0,
      country: 'Norway',
      continent: 'Europe'
    }
  ],
  1978: [
    {
      max: 278.39,
      min: 0,
      country: 'Japan',
      continent: 'Asia'
    },
    {
      max: 29.22,
      min: 0,
      country: 'India',
      continent: 'Asia'
    },
    {
      max: 13.12,
      min: 0,
      country: 'South Korea',
      continent: 'Asia'
    },
    {
      max: 22.62,
      min: 0,
      country: 'Turkey',
      continent: 'Asia'
    },
    {
      max: 15.39,
      min: 0,
      country: 'Indonesia',
      continent: 'Asia'
    },
    {
      max: 30.08,
      min: 0,
      country: 'Saudi Arabia',
      continent: 'Asia'
    },
    {
      max: 6,
      min: 0,
      country: 'Thailand',
      continent: 'Asia'
    },
    {
      max: 7.48,
      min: 0,
      country: 'Philippines',
      continent: 'Asia'
    },
    {
      max: 3.9,
      min: 0,
      country: 'Malaysia',
      continent: 'Asia'
    },
    {
      max: 121.14,
      min: 0,
      country: 'United Kingdom',
      continent: 'Europe'
    },
    {
      max: 126.03,
      min: 0,
      country: 'Italy',
      continent: 'Europe'
    },
    {
      max: 64.08,
      min: 0,
      country: 'Spain',
      continent: 'Europe'
    },
    {
      max: 41.42,
      min: 0,
      country: 'Netherlands',
      continent: 'Europe'
    },
    {
      max: 32.36,
      min: 0,
      country: 'Switzerland',
      continent: 'Europe'
    },
    {
      max: 10.8,
      min: 0,
      country: 'Finland',
      continent: 'Europe'
    },
    {
      max: 24.65,
      min: 0,
      country: 'Sweden',
      continent: 'Europe'
    },
    {
      max: 24.97,
      min: 0,
      country: 'Belgium',
      continent: 'Europe'
    },
    {
      max: 18.16,
      min: 0,
      country: 'Norway',
      continent: 'Europe'
    }
  ],
  1983: [
    {
      max: 336.52,
      min: 0,
      country: 'Japan',
      continent: 'Asia'
    },
    {
      max: 34.79,
      min: 0,
      country: 'India',
      continent: 'Asia'
    },
    {
      max: 18.48,
      min: 0,
      country: 'South Korea',
      continent: 'Asia'
    },
    {
      max: 25,
      min: 0,
      country: 'Turkey',
      continent: 'Asia'
    },
    {
      max: 20.87,
      min: 0,
      country: 'Indonesia',
      continent: 'Asia'
    },
    {
      max: 24.13,
      min: 0,
      country: 'Saudi Arabia',
      continent: 'Asia'
    },
    {
      max: 7.84,
      min: 0,
      country: 'Thailand',
      continent: 'Asia'
    },
    {
      max: 9.07,
      min: 0,
      country: 'Philippines',
      continent: 'Asia'
    },
    {
      max: 5.51,
      min: 0,
      country: 'Malaysia',
      continent: 'Asia'
    },
    {
      max: 129.86,
      min: 0,
      country: 'United Kingdom',
      continent: 'Europe'
    },
    {
      max: 141.5,
      min: 0,
      country: 'Italy',
      continent: 'Europe'
    },
    {
      max: 67.43,
      min: 0,
      country: 'Spain',
      continent: 'Europe'
    },
    {
      max: 42.83,
      min: 0,
      country: 'Netherlands',
      continent: 'Europe'
    },
    {
      max: 35,
      min: 0,
      country: 'Switzerland',
      continent: 'Europe'
    },
    {
      max: 13.13,
      min: 0,
      country: 'Finland',
      continent: 'Europe'
    },
    {
      max: 26.98,
      min: 0,
      country: 'Sweden',
      continent: 'Europe'
    },
    {
      max: 26.86,
      min: 0,
      country: 'Belgium',
      continent: 'Europe'
    },
    {
      max: 20.98,
      min: 0,
      country: 'Norway',
      continent: 'Europe'
    }
  ],
  1988: [
    {
      max: 427.65,
      min: 0,
      country: 'Japan',
      continent: 'Asia'
    },
    {
      max: 45.4,
      min: 0,
      country: 'India',
      continent: 'Asia'
    },
    {
      max: 30.96,
      min: 0,
      country: 'South Korea',
      continent: 'Asia'
    },
    {
      max: 33.34,
      min: 0,
      country: 'Turkey',
      continent: 'Asia'
    },
    {
      max: 26.89,
      min: 0,
      country: 'Indonesia',
      continent: 'Asia'
    },
    {
      max: 25.64,
      min: 0,
      country: 'Saudi Arabia',
      continent: 'Asia'
    },
    {
      max: 11.35,
      min: 0,
      country: 'Thailand',
      continent: 'Asia'
    },
    {
      max: 8.97,
      min: 0,
      country: 'Philippines',
      continent: 'Asia'
    },
    {
      max: 6.88,
      min: 0,
      country: 'Malaysia',
      continent: 'Asia'
    },
    {
      max: 158.98,
      min: 0,
      country: 'United Kingdom',
      continent: 'Europe'
    },
    {
      max: 166.06,
      min: 0,
      country: 'Italy',
      continent: 'Europe'
    },
    {
      max: 80.43,
      min: 0,
      country: 'Spain',
      continent: 'Europe'
    },
    {
      max: 49.07,
      min: 0,
      country: 'Netherlands',
      continent: 'Europe'
    },
    {
      max: 39.95,
      min: 0,
      country: 'Switzerland',
      continent: 'Europe'
    },
    {
      max: 15.72,
      min: 0,
      country: 'Finland',
      continent: 'Europe'
    },
    {
      max: 31.27,
      min: 0,
      country: 'Sweden',
      continent: 'Europe'
    },
    {
      max: 30.52,
      min: 0,
      country: 'Belgium',
      continent: 'Europe'
    },
    {
      max: 24.8,
      min: 0,
      country: 'Norway',
      continent: 'Europe'
    }
  ],
  1993: [
    {
      max: 488.02,
      min: 0,
      country: 'Japan',
      continent: 'Asia'
    },
    {
      max: 56.68,
      min: 0,
      country: 'India',
      continent: 'Asia'
    },
    {
      max: 45.79,
      min: 0,
      country: 'South Korea',
      continent: 'Asia'
    },
    {
      max: 41.6,
      min: 0,
      country: 'Turkey',
      continent: 'Asia'
    },
    {
      max: 37.57,
      min: 0,
      country: 'Indonesia',
      continent: 'Asia'
    },
    {
      max: 34.67,
      min: 0,
      country: 'Saudi Arabia',
      continent: 'Asia'
    },

    {
      max: 17.99,
      min: 0,
      country: 'Thailand',
      continent: 'Asia'
    },
    {
      max: 10,
      min: 0,
      country: 'Philippines',
      continent: 'Asia'
    },
    {
      max: 10.72,
      min: 0,
      country: 'Malaysia',
      continent: 'Asia'
    },
    {
      max: 167.18,
      min: 0,
      country: 'United Kingdom',
      continent: 'Europe'
    },
    {
      max: 177.75,
      min: 0,
      country: 'Italy',
      continent: 'Europe'
    },
    {
      max: 89.63,
      min: 0,
      country: 'Spain',
      continent: 'Europe'
    },
    {
      max: 56.32,
      min: 0,
      country: 'Netherlands',
      continent: 'Europe'
    },
    {
      max: 42.74,
      min: 0,
      country: 'Switzerland',
      continent: 'Europe'
    },
    {
      max: 15.04,
      min: 0,
      country: 'Finland',
      continent: 'Europe'
    },
    {
      max: 30.95,
      min: 0,
      country: 'Sweden',
      continent: 'Europe'
    },
    {
      max: 33.35,
      min: 0,
      country: 'Belgium',
      continent: 'Europe'
    },
    {
      max: 28.05,
      min: 0,
      country: 'Norway',
      continent: 'Europe'
    }
  ],
  1998: [
    {
      max: 521.74,
      min: 0,
      country: 'Japan',
      continent: 'Asia'
    },
    {
      max: 77.27,
      min: 0,
      country: 'India',
      continent: 'Asia'
    },
    {
      max: 59.6,
      min: 0,
      country: 'South Korea',
      continent: 'Asia'
    },
    {
      max: 50.56,
      min: 0,
      country: 'Turkey',
      continent: 'Asia'
    },

    {
      max: 42.88,
      min: 0,
      country: 'Indonesia',
      continent: 'Asia'
    },
    {
      max: 37.31,
      min: 0,
      country: 'Saudi Arabia',
      continent: 'Asia'
    },
    {
      max: 19.93,
      min: 0,
      country: 'Thailand',
      continent: 'Asia'
    },
    {
      max: 12.09,
      min: 0,
      country: 'Philippines',
      continent: 'Asia'
    },
    {
      max: 14.07,
      min: 0,
      country: 'Malaysia',
      continent: 'Asia'
    },
    {
      max: 196.37,
      min: 0,
      country: 'United Kingdom',
      continent: 'Europe'
    },
    {
      max: 196.13,
      min: 0,
      country: 'Italy',
      continent: 'Europe'
    },
    {
      max: 104.8,
      min: 0,
      country: 'Spain',
      continent: 'Europe'
    },
    {
      max: 67.57,
      min: 0,
      country: 'Netherlands',
      continent: 'Europe'
    },
    {
      max: 46.09,
      min: 0,
      country: 'Switzerland',
      continent: 'Europe'
    },
    {
      max: 18.94,
      min: 0,
      country: 'Finland',
      continent: 'Europe'
    },
    {
      max: 36.51,
      min: 0,
      country: 'Sweden',
      continent: 'Europe'
    },
    {
      max: 37.79,
      min: 0,
      country: 'Belgium',
      continent: 'Europe'
    },
    {
      max: 34.83,
      min: 0,
      country: 'Norway',
      continent: 'Europe'
    }
  ],
  2003: [
    {
      max: 545.92,
      min: 0,
      country: 'Japan',
      continent: 'Asia'
    },
    {
      max: 102.5,
      min: 0,
      country: 'India',
      continent: 'Asia'
    },
    {
      max: 84.42,
      min: 0,
      country: 'South Korea',
      continent: 'Asia'
    },
    {
      max: 55.06,
      min: 0,
      country: 'Turkey',
      continent: 'Asia'
    },
    {
      max: 51.46,
      min: 0,
      country: 'Indonesia',
      continent: 'Asia'
    },
    {
      max: 40.5,
      min: 0,
      country: 'Saudi Arabia',
      continent: 'Asia'
    },
    {
      max: 25.62,
      min: 0,
      country: 'Thailand',
      continent: 'Asia'
    },
    {
      max: 14.62,
      min: 0,
      country: 'Philippines',
      continent: 'Asia'
    },
    {
      max: 18.21,
      min: 0,
      country: 'Malaysia',
      continent: 'Asia'
    },
    {
      max: 228.64,
      min: 0,
      country: 'United Kingdom',
      continent: 'Europe'
    },
    {
      max: 211.73,
      min: 0,
      country: 'Italy',
      continent: 'Europe'
    },
    {
      max: 126.72,
      min: 0,
      country: 'Spain',
      continent: 'Europe'
    },
    {
      max: 75.95,
      min: 0,
      country: 'Netherlands',
      continent: 'Europe'
    },
    {
      max: 49.45,
      min: 0,
      country: 'Switzerland',
      continent: 'Europe'
    },
    {
      max: 22.26,
      min: 0,
      country: 'Finland',
      continent: 'Europe'
    },
    {
      max: 42.29,
      min: 0,
      country: 'Sweden',
      continent: 'Europe'
    },
    {
      max: 42.16,
      min: 0,
      country: 'Belgium',
      continent: 'Europe'
    },
    {
      max: 38.32,
      min: 0,
      country: 'Norway',
      continent: 'Europe'
    }
  ],
  2008: [
    {
      max: 578.41,
      min: 0,
      country: 'Japan',
      continent: 'Asia'
    },
    {
      max: 143.18,
      min: 0,
      country: 'India',
      continent: 'Asia'
    },
    {
      max: 106.28,
      min: 0,
      country: 'South Korea',
      continent: 'Asia'
    },
    {
      max: 74.66,
      min: 0,
      country: 'Turkey',
      continent: 'Asia'
    },
    {
      max: 67.94,
      min: 0,
      country: 'Indonesia',
      continent: 'Asia'
    },
    {
      max: 51.34,
      min: 0,
      country: 'Saudi Arabia',
      continent: 'Asia'
    },
    {
      max: 31.95,
      min: 0,
      country: 'Thailand',
      continent: 'Asia'
    },
    {
      max: 19.14,
      min: 0,
      country: 'Philippines',
      continent: 'Asia'
    },
    {
      max: 24.1,
      min: 0,
      country: 'Malaysia',
      continent: 'Asia'
    },
    {
      max: 253.56,
      min: 0,
      country: 'United Kingdom',
      continent: 'Europe'
    },
    {
      max: 221.5,
      min: 0,
      country: 'Italy',
      continent: 'Europe'
    },
    {
      max: 147.39,
      min: 0,
      country: 'Spain',
      continent: 'Europe'
    },
    {
      max: 86.71,
      min: 0,
      country: 'Netherlands',
      continent: 'Europe'
    },
    {
      max: 57.96,
      min: 0,
      country: 'Switzerland',
      continent: 'Europe'
    },
    {
      max: 26.27,
      min: 0,
      country: 'Finland',
      continent: 'Europe'
    },
    {
      max: 48.92,
      min: 0,
      country: 'Sweden',
      continent: 'Europe'
    },
    {
      max: 47.72,
      min: 0,
      country: 'Belgium',
      continent: 'Europe'
    },
    {
      max: 43.33,
      min: 0,
      country: 'Norway',
      continent: 'Europe'
    }
  ],
  2013: [
    {
      max: 589.42,
      min: 0,
      country: 'Japan',
      continent: 'Asia'
    },
    {
      max: 197.84,
      min: 0,
      country: 'India',
      continent: 'Asia'
    },
    {
      max: 125.32,
      min: 0,
      country: 'South Korea',
      continent: 'Asia'
    },
    {
      max: 97.51,
      min: 0,
      country: 'Turkey',
      continent: 'Asia'
    },
    {
      max: 89.73,
      min: 0,
      country: 'Indonesia',
      continent: 'Asia'
    },
    {
      max: 62.9,
      min: 0,
      country: 'Saudi Arabia',
      continent: 'Asia'
    },
    {
      max: 37.88,
      min: 0,
      country: 'Thailand',
      continent: 'Asia'
    },
    {
      max: 24.7,
      min: 0,
      country: 'Philippines',
      continent: 'Asia'
    },
    {
      max: 29.65,
      min: 0,
      country: 'Malaysia',
      continent: 'Asia'
    },
    {
      max: 260.51,
      min: 0,
      country: 'United Kingdom',
      continent: 'Europe'
    },
    {
      max: 204.67,
      min: 0,
      country: 'Italy',
      continent: 'Europe'
    },
    {
      max: 134.78,
      min: 0,
      country: 'Spain',
      continent: 'Europe'
    },
    {
      max: 84.97,
      min: 0,
      country: 'Netherlands',
      continent: 'Europe'
    },
    {
      max: 61.07,
      min: 0,
      country: 'Switzerland',
      continent: 'Europe'
    },
    {
      max: 24.97,
      min: 0,
      country: 'Finland',
      continent: 'Europe'
    },
    {
      max: 51.47,
      min: 0,
      country: 'Sweden',
      continent: 'Europe'
    },
    {
      max: 49.5,
      min: 0,
      country: 'Belgium',
      continent: 'Europe'
    },
    {
      max: 44.93,
      min: 0,
      country: 'Norway',
      continent: 'Europe'
    }
  ],
  2018: [
    {
      max: 617.03,
      min: 0,
      country: 'Japan',
      continent: 'Asia'
    },
    {
      max: 282.22,
      min: 0,
      country: 'India',
      continent: 'Asia'
    },
    {
      max: 144.97,
      min: 0,
      country: 'South Korea',
      continent: 'Asia'
    },
    {
      max: 124.05,
      min: 0,
      country: 'Turkey',
      continent: 'Asia'
    },
    {
      max: 114.69,
      min: 0,
      country: 'Indonesia',
      continent: 'Asia'
    },
    {
      max: 70.16,
      min: 0,
      country: 'Saudi Arabia',
      continent: 'Asia'
    },
    {
      max: 44.23,
      min: 0,
      country: 'Thailand',
      continent: 'Asia'
    },
    {
      max: 34.03,
      min: 0,
      country: 'Philippines',
      continent: 'Asia'
    },
    {
      max: 38.21,
      min: 0,
      country: 'Malaysia',
      continent: 'Asia'
    },
    {
      max: 287.93,
      min: 0,
      country: 'United Kingdom',
      continent: 'Europe'
    },
    {
      max: 214.1,
      min: 0,
      country: 'Italy',
      continent: 'Europe'
    },
    {
      max: 153.95,
      min: 0,
      country: 'Spain',
      continent: 'Europe'
    },
    {
      max: 94.81,
      min: 0,
      country: 'Netherlands',
      continent: 'Europe'
    },
    {
      max: 67.46,
      min: 0,
      country: 'Switzerland',
      continent: 'Europe'
    },
    {
      max: 26.92,
      min: 0,
      country: 'Finland',
      continent: 'Europe'
    },
    {
      max: 58.93,
      min: 0,
      country: 'Sweden',
      continent: 'Europe'
    },
    {
      max: 53.84,
      min: 0,
      country: 'Belgium',
      continent: 'Europe'
    },
    {
      max: 48.93,
      min: 0,
      country: 'Norway',
      continent: 'Europe'
    }
  ]
};

const duration = 400;
const years = Object.keys(asiaData);

const spec = {
  height: 500,
  width: 800,
  type: 'bar',
  padding: {
    top: 12,
    right: 100,
    bottom: 12,
    left: 100
  },
  data: [
    {
      id: 'data0',
      values: []
    }
  ],
  direction: 'horizontal',
  yField: 'country',
  xField: 'max',
  axes: [
    {
      animation: true,
      orient: 'bottom',
      type: 'linear',
      visible: true,
      grid: {
        visible: true
      }
    },
    {
      animation: true,
      id: 'axis-left',
      orient: 'left',
      tick: { visible: false },
      label: { visible: true },
      type: 'band',
      grid: {
        visible: true
      }
    }
  ],
  animationAppear: {
    bar: {
      type: 'growWidthIn',
      duration
    },
    axis: {
      duration,
      easing: 'linear'
    }
  },
  animationUpdate: {
    bar: {
      duration,
      easing: 'linear'
    },
    axis: {
      duration: duration * 0.8,
      easing: 'linear'
    }
  },
  bar: {
    style: {
      texture: 'circle',
      texturePadding: 1,
      textureSize: 5,
      textureColor: 'red'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
const view = vchart.getCompiler().getVGrammarView();
const time = view.mark('text', view.rootMark).encode({
  text: '',
  fontSize: 40,
  zIndex: 1000,
  x: 700,
  y: 460,
  fill: 'grey',
  fontWeight: 'bold'
});
years.forEach((year, index) => {
  setTimeout(() => {
    time
      .encode({
        text: year
      })
      .animation({
        enter: {
          type: 'fadeIn',
          duration
        }
      });
    asiaData[year].sort((pre, next) => next.max - pre.max);

    vchart.updateData('data0', asiaData[year]);
  }, duration * (index + 1));
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation associated with this demo configuration.
