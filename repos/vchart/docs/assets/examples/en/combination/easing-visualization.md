---
category: demo
group: combination
title: Easing Functions Visualization
keywords: commonChart
order: 22-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/combination/easing-visualization.png
option: commonChart
---

# Easing Functions Visualization

## Key option

- `type: 'common'` declaring as combination chart type
- Configuring the layout of multiple `region` in the `layout` property
- `animationAppear` configuring the outgoing animation
  - `animationAppear.easing` configuring the easing function for outgoing animation

## Demo source

```javascript livedemo
const easingFuncs = {
  linear: function (k) {
    return k;
  },
  quadIn: function (k) {
    return k * k;
  },
  quadOut: function (k) {
    return k * (2 - k);
  },
  quadInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k;
    }
    return -0.5 * (--k * (k - 2) - 1);
  },
  cubicIn: function (k) {
    return k * k * k;
  },
  cubicOut: function (k) {
    return --k * k * k + 1;
  },
  cubicInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k * k;
    }
    return 0.5 * ((k -= 2) * k * k + 2);
  },
  quartIn: function (k) {
    return k * k * k * k;
  },
  quartOut: function (k) {
    return 1 - --k * k * k * k;
  },
  quartInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k * k * k;
    }
    return -0.5 * ((k -= 2) * k * k * k - 2);
  },
  quintIn: function (k) {
    return k * k * k * k * k;
  },
  quintOut: function (k) {
    return --k * k * k * k * k + 1;
  },
  quintInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k * k * k * k;
    }
    return 0.5 * ((k -= 2) * k * k * k * k + 2);
  },
  circIn: function (k) {
    return 1 - Math.sqrt(1 - k * k);
  },
  circOut: function (k) {
    return Math.sqrt(1 - --k * k);
  },
  circInOut: function (k) {
    if ((k *= 2) < 1) {
      return -0.5 * (Math.sqrt(1 - k * k) - 1);
    }
    return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
  },
  elasticIn: function (k) {
    let s;
    let a = 0.1;
    const p = 0.4;
    if (k === 0) {
      return 0;
    }
    if (k === 1) {
      return 1;
    }
    if (!a || a < 1) {
      a = 1;
      s = p / 4;
    } else {
      s = (p * Math.asin(1 / a)) / (2 * Math.PI);
    }
    return -(a * Math.pow(2, 10 * (k -= 1)) * Math.sin(((k - s) * (2 * Math.PI)) / p));
  },
  elasticOut: function (k) {
    let s;
    let a = 0.1;
    const p = 0.4;
    if (k === 0) {
      return 0;
    }
    if (k === 1) {
      return 1;
    }
    if (!a || a < 1) {
      a = 1;
      s = p / 4;
    } else {
      s = (p * Math.asin(1 / a)) / (2 * Math.PI);
    }
    return a * Math.pow(2, -10 * k) * Math.sin(((k - s) * (2 * Math.PI)) / p) + 1;
  },
  elasticInOut: function (k) {
    let s;
    let a = 0.1;
    const p = 0.4;
    if (k === 0) {
      return 0;
    }
    if (k === 1) {
      return 1;
    }
    if (!a || a < 1) {
      a = 1;
      s = p / 4;
    } else {
      s = (p * Math.asin(1 / a)) / (2 * Math.PI);
    }
    if ((k *= 2) < 1) {
      return -0.5 * (a * Math.pow(2, 10 * (k -= 1)) * Math.sin(((k - s) * (2 * Math.PI)) / p));
    }
    return a * Math.pow(2, -10 * (k -= 1)) * Math.sin(((k - s) * (2 * Math.PI)) / p) * 0.5 + 1;
  },
  backIn: function (k) {
    const s = 1.70158;
    return k * k * ((s + 1) * k - s);
  },
  backOut: function (k) {
    const s = 1.70158;
    return --k * k * ((s + 1) * k + s) + 1;
  },
  backInOut: function (k) {
    const s = 1.70158 * 1.525;
    if ((k *= 2) < 1) {
      return 0.5 * (k * k * ((s + 1) * k - s));
    }
    return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
  },
  bounceIn: function (k) {
    return 1 - easingFuncs.bounceOut(1 - k);
  },
  bounceOut: function (k) {
    if (k < 1 / 2.75) {
      return 7.5625 * k * k;
    } else if (k < 2 / 2.75) {
      return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
    } else if (k < 2.5 / 2.75) {
      return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
    }
    return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
  },
  bounceInOut: function (k) {
    if (k < 0.5) {
      return easingFuncs.bounceIn(k * 2) * 0.5;
    }
    return easingFuncs.bounceOut(k * 2 - 1) * 0.5 + 0.5;
  }
};

const POINTS = 30;
const row = 5;
const col = 5;
const region = [];
const layoutElements = [];
const series = [];
const axes = [];
const rowHeight = [];

Object.keys(easingFuncs).forEach((easingFuncName, index) => {
  const data = [];
  for (let i = 0; i < POINTS; i++) {
    data.push({
      x: i / POINTS,
      y: easingFuncs[easingFuncName](i / POINTS)
    });
  }

  region.push({
    id: easingFuncName
  });

  const seriesRow = Math.floor(index / col) + Math.floor(index / col);
  const seriesCol = index - Math.floor(index / col) * col;

  // 系列行
  layoutElements.push({
    row: seriesRow,
    col: seriesCol + seriesCol + 1,
    modelId: easingFuncName
  });

  series.push({
    id: `${easingFuncName}Series`,
    type: 'line',
    xField: 'x',
    yField: 'y',
    data: { id: easingFuncName, values: data },
    point: { style: { visible: false } },
    line: { style: { lineWidth: 2 } },
    regionId: easingFuncName,
    animationAppear: {
      easing: easingFuncName
    },
    extensionMark: [
      {
        type: 'text',
        style: {
          text: easingFuncName,
          x: 0,
          y: 0,
          fill: 'black',
          fontSize: 12,
          textAlign: 'left',
          textBaseline: 'top'
        }
      }
    ]
  });

  axes.push({
    id: `${easingFuncName}Left`,
    orient: 'left',
    visible: false,
    max: 1.5,
    regionId: easingFuncName,
    seriesId: [`${easingFuncName}Series`]
  });

  layoutElements.push({
    row: seriesRow,
    col: seriesCol + seriesCol,
    modelId: `${easingFuncName}Left`
  });

  axes.push({
    id: `${easingFuncName}Bottom`,
    orient: 'bottom',
    visible: false,
    regionId: easingFuncName,
    seriesId: [`${easingFuncName}Series`]
  });

  layoutElements.push({
    row: seriesRow + 1,
    col: seriesCol + seriesCol + 1,
    modelId: `${easingFuncName}Bottom`
  });

  if (seriesCol === 0) {
    rowHeight.push({
      index: seriesRow + 1,
      size: 10
    });
  }
});

const spec = {
  type: 'common',
  padding: {
    left: 30,
    right: 30
  },
  region,
  color: ['#6690F2', '#70D6A3', '#B4E6E2', '#63B5FC', '#FF8F62', '#FFDC83', '#BCC5FD', '#A29BFE'],
  layout: {
    type: 'grid',
    col: col * 2,
    row: row * 2,
    elements: layoutElements,
    rowHeight
  },
  axes,
  tooltip: false,
  series
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

TODO
