---
category: examples
group: pictogram chart
title: Taiji-Bagua Diagram
keywords: pictogramChart, interaction
order: 26-7
cover: https://cdn.jsdelivr.net/gh/xilzy/images/pictogram-bagua-cover.png
option: pictogramChart
---

# SVG Taiji Bagua Symbol Diagram

> Contributed by [xilzy](https://github.com/xilzy)

The Taiji Bagua Symbol Diagram illustrates the elements of the Early Heaven Bagua (Xiantian Bagua). At its core lies the Taiji symbol, surrounded by a middle layer of eight trigram symbols and an outermost layer displaying their corresponding symbolic patterns. Each trigram symbol pattern corresponds to a specific Five Elements attribute. By using the pictographic diagram, viewers can quickly grasp the layout and elemental distribution of the Early Heaven Bagua, offering a valuable reference for its study and analysis. Hovering the mouse over the legend reveals the distribution of a particular elemental attribute, while hovering over the shapes in the diagram displays the name of the element associated with that shape.

## Key Configurations

- Configure the `name` attribute for graphic elements in SVG files, then specify element styles via the `name`configuration in chart specifications;
- Use the `VChart.registerSVG` interface to register SVG resources;
- Declare the registered `svg` name through the svg property;
- Data: Define data in the format `[{name: 'xxx', value:'xxx',category: 'xxx'}]`, aligning with VChart's data structure requirements;
- Color Configuration:Use `category` as the basic color unit.Apply black/white schemes for Yin-Yang elements and yellow/green/blue/red/brown schemes corresponding to the Five Elements (Wu Xing), all using soft tones;
- Interactions:Implement the `element-active-by-legend` mode for legend-click interactions.Enable hover interactions on specific element areas.Disable interactions for non-core regions through configuration.

## Code Demo

```javascript livedemo
/** --Please add the following code when using in your project-- */
// For version 1.x, please additionally import and execute registerPictogramChart in your project
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
// For version 2.0.0, please additionally import and execute registerPictogramChart in your project
// import { registerPictogramChart } from '@visactor/vchart-extension';
// registerPictogramChart();
/** --Please add the above code when using in your project-- */

/** --Please remove the following code when using in your project-- */
if (VCHART_MODULE.registerPictogramChart) {
  // Execute registration code for version 1.x
  VCHART_MODULE.registerPictogramChart();
} else if (VChartExtension.registerPictogramChart) {
  // Execute registration code for version 2.0.0
  VChartExtension.registerPictogramChart();
}

// Use the fetch API to get SVG graphic data
const response = await fetch('https://cdn.jsdelivr.net/gh/xilzy/images/pictogram-bagua-name4.svg');
const shape = await response.text();

const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    // Bagua data configuration: Central Yin-Yang categorized as positive/negative, outer trigrams mapped to Five Elements attributes
    values: [
      { name: 'Yin', value: '阴', category: '阴' },
      { name: 'Yang', value: '阳', category: '阳' },
      { name: 'Yin_Yao', value: '爻阴', category: '阴' },
      { name: 'Yang_Yao', value: '爻阳', category: '阳' },
      { name: 'Heaven', value: '天', category: '金' },
      { name: 'Wind', value: '风', category: '木' },
      { name: 'Water', value: '水', category: '水' },
      { name: 'Mountain', value: '山', category: '土' },
      { name: 'Earth', value: '地', category: '土' },
      { name: 'Thunder', value: '雷', category: '木' },
      { name: 'Fire', value: '火', category: '火' },
      { name: 'Marsh', value: '泽', category: '金' },
      { name: 'Qian', value: '乾', category: '金' },
      { name: 'Xun', value: '巽', category: '木' },
      { name: 'Kan', value: '坎', category: '水' },
      { name: 'Gen', value: '艮', category: '土' },
      { name: 'Kun', value: '坤', category: '土' },
      { name: 'Zhen', value: '震', category: '木' },
      { name: 'Li', value: '离', category: '火' },
      { name: 'Dui', value: '兑', category: '金' }
    ]
  },
  seriesField: 'category',
  nameField: 'name',
  valueField: 'value',
  svg: 'bagua', // Use custom SVG identifier
  region: [
    {
      roam: { blank: true },
      style: {
        fill: '#F5E9D6'
      }
    }
  ],
  color: {
    specified: {
      // Yin-Yang color scheme preserves classic contrast with enhanced texture
      阳: '#F5F1E6', // Yang: Off-white for soft contrast
      阴: '#1A1A1A', // Yin: Charcoal gray for depth over pure black

      // Five Elements color scheme (optimized traditional palette)
      金: '#F2D08C', // Metal: Warm golden-beige replaces high-saturation yellow
      木: '#61B58C', // Wood: Fresh foliage green for visual comfort
      水: '#3A86C8', // Water: Deep lake blue
      火: '#E66C52', // Fire: Desaturated terracotta reduces glare
      土: '#A67C58', // Earth: Warm ochre tone
      background: '#F5E9D6', // Background: Light beige for antique ambiance
      line: '#D2B48C', // Lines: Warm tan for harmonious integration
      undefined: false
    },
    // Color mapping based on category field
    field: 'category'
  },
  // Interaction configuration
  interactions: [
    {
      type: 'element-active-by-legend'
    }
  ],
  // Pictogram settings
  pictogram: {
    style: {
      fill: {
        scale: 'color',
        field: 'category'
      },
      stroke: '#000000', // Border color: Black
      lineWidth: 2,
      pickable: datum => datum.name !== 'Line',
      visible: datum => datum => !datum.attributes?.d?.startsWith('M0 0L1024 0L1024 1024L0 1024')
    },
    state: {
      active: {
        fillOpacity: 0.8,
        stroke: {
          // Active state color settings
          scale: 'color',
          field: 'category'
        },
        lineWidth: 2
      },
      hover: {
        fillOpacity: 0.8,
        stroke: {
          // Hover state color settings
          scale: 'color',
          field: 'category'
        },
        lineWidth: 1
      }
    }
  },
  // Title configuration
  title: {
    text: 'Taiji Bagua Diagram',
    textStyle: {
      fontSize: 18,
      fill: '#333'
    }
  },
  // Legend configuration
  legends: {
    orient: 'top',
    top: '5%', // Position legend 5% from top
    item: {
      label: {
        style: {
          fill: '#666',
          fontSize: 12
        }
      }
    }
  }
};

// Register SVG graphic resource with name 'bagua' and shape data
VChart.registerSVG('bagua', shape);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// For console debugging; remove in production
window['vchart'] = vchart;
```

## Related Tutorials

[PictogramChart](link)
