---
category: examples
group: pattern
title: Pie Chart with Texture
keywords: pieChart,comparison,proportion,composition,pattern,label,circle
order: 41-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/pattern/accessible-pie.png
option: pieChart
---

# Pie Chart with Texture

Filling the chart with texture can improve the readability of the chart in scenarios with low screen brightness or for color-blind audiences.

## Key option

Configure the related properties of the texture on the graphic elements:

- `texture`: Texture type configuration, supports: `'circle' | 'diamond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid'`.
- `textureColor`: Texture color.
- `textureSize`: The size of the texture unit.
- `texturePadding`: The gap size between texture units.

## Demo source

```javascript livedemo
const textureMap = {
  NVDA: 'circle',
  JAWS: 'horizontal-line',
  VoiceOver: 'vertical-line',
  ZoomText: 'bias-rl',
  Other: 'grid'
};

const spec = {
  type: 'pie',
  data: {
    id: 'pieData',
    values: [
      {
        name: 'NVDA',
        y: 40.6
      },
      {
        name: 'JAWS',
        y: 40.1
      },
      {
        name: 'VoiceOver',
        y: 12.9
      },
      {
        name: 'ZoomText',
        y: 2
      },
      {
        name: 'Other',
        y: 4.4
      }
    ]
  },
  categoryField: 'name',
  valueField: 'y',
  padAngle: 2, // set pad angle
  pie: {
    style: {
      texture: datum => textureMap[datum.name]
    },
    state: {
      hover: {
        centerOffset: 10
      }
    }
  },
  label: {
    visible: true,
    style: {
      text: datum => {
        // return [datum.name, `${datum.y}%`]; // wrap display
        return `${datum.name}: ${datum.y}%`;
      },
      fontSize: 12
    },
    line: {
      line1MinLength: 30
    }
  },
  legends: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window.vchart = vchart;
```

## Related Tutorials

[Scatter Plot](link)
