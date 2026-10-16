---
category: examples
group: pictogram chart
title: Map of China eating spicy degree pictograph
keywords: pictogramChart,map,comparison,china
order: 26-6
cover: https://cdn.jsdelivr.net/gh/UC-web291/picture_storing/5.gif
option: pictogramChart
---

# Chinese Map Pictogram - A Glance at the Spiciness Level in Chinese Provinces

> Contributed by Qian_Shark

The classification information of different regions in China can be displayed through pictograms, and color mapping can be carried out according to different categories of spicy food, from strong to weak colors, more and more cold tones, while supporting legend hover interactive display of province information.

## Key Configurations

- In the SVG file, configure the name attribute for the graphic elements. Then, in the chart configuration, you can specify the element styles through the name configuration.
- Register SVG resources using the VChart.registerSVG interface.
- Declare the registered SVG name using the svg attribute.
- Declare the chart type as a pictogram using the type: pictogram attribute.
- Define the data source using the data attribute.
- onfigure color mapping using the color attribute.
- Declare the series field and name field using the seriesField and nameField attributes respectively.
- Specify the SVG graphic to use with the svg attribute.
- Declare the styles of the pictogram elements using the pictogram.style attribute.
- Listen for the legendItemHover and legendItemUnHover events to implement legend hover interaction.

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

const response = await fetch('https://cdn.jsdelivr.net/gh/UC-web291/picture_storing/chinamap.svg');
const shape = await response.text();
// Define map data
const chinamap_data = [
  { name: '湖南省', category: 'MVP', level: '🌶🌶🌶🌶' },
  { name: '重庆市', category: 'MVP', level: '🌶🌶🌶🌶' },
  { name: '四川省', category: 'MVP', level: '🌶🌶🌶🌶' },
  { name: '贵州省', category: 'MVP', level: '🌶🌶🌶🌶' },
  { name: '甘肃省', category: 'MVP', level: '🌶🌶🌶🌶' },
  { name: '新疆维吾尔自治区', category: 'MVP', level: '🌶🌶🌶🌶' },
  { name: '江西省', category: 'MVP', level: '🌶🌶🌶🌶' },
  { name: '山西省', category: 'diamond', level: '🌶🌶🌶' },
  { name: '内蒙古自治区', category: 'diamond', level: '🌶🌶🌶' },
  { name: '辽宁省', category: 'diamond', level: '🌶🌶🌶' },
  { name: '吉林省', category: 'diamond', level: '🌶🌶🌶' },
  { name: '黑龙江省', category: 'diamond', level: '🌶🌶🌶' },
  { name: '湖北省', category: 'diamond', level: '🌶🌶🌶' },
  { name: '云南省', category: 'diamond', level: '🌶🌶🌶' },
  { name: '北京市', category: 'gold', level: '🌶🌶' },
  { name: '天津市', category: 'gold', level: '🌶🌶' },
  { name: '河北省', category: 'gold', level: '🌶🌶' },
  { name: '山东省', category: 'gold', level: '🌶🌶' },
  { name: '河南省', category: 'gold', level: '🌶🌶' },
  { name: '陕西省', category: 'gold', level: '🌶🌶' },
  { name: '广西壮族自治区', category: 'gold', level: '🌶🌶' },
  { name: '上海市', category: 'silver', level: '🌶' },
  { name: '江苏省', category: 'silver', level: '🌶' },
  { name: '浙江省', category: 'silver', level: '🌶' },
  { name: '安徽省', category: 'silver', level: '🌶' },
  { name: '福建省', category: 'silver', level: '🌶' },
  { name: '广东省', category: 'silver', level: '🌶' },
  { name: '海南省', category: 'bronze', level: '🌶' },
  { name: '西藏自治区', category: 'bronze', level: '🌶' },
  { name: '青海省', category: 'bronze', level: '🌶' },
  { name: '宁夏回族自治区', category: 'bronze', level: '🌶' },
  { name: '香港特别行政区', category: 'bronze', level: '🌶' },
  { name: '澳门特别行政区', category: 'bronze', level: '🌶' },
  { name: '台湾省', category: 'bronze', level: '🌶' }
];
const spec = {
  // The chart type is pictograph
  type: 'pictogram',
  padding: 0,
  data: {
    // Unique identifier of the data
    id: 'data',
    // Data value
    values: chinamap_data
  },
  color: {
    specified: {
      // master
      MVP: 'rgb(73, 3, 3)',
      // diamond
      diamond: 'rgb(250, 8, 8)',
      //  gold
      gold: 'rgb(250, 77, 8)',
      // silver
      silver: 'rgb(228, 170, 64)',
      // bronze
      bronze: 'rgb(198, 238, 53)',
      // The color of undefined categories is white
      undefined: 'white'
    },
    // Series fields are categories
    field: 'category'
  },
  // Series fields are categories
  seriesField: 'category',
  //  The name field is the name
  nameField: 'name',
  valueField: 'level',
  // SVG graphic name used
  svg: 'chinamap',
  pictogram: {
    style: {
      fill: {
        // Fill color Use color to map the color. The fields are categories
        scale: 'color',
        field: 'category'
      },
      cursor: 'pointer'
    },
    state: {
      //  The fill color of the legend hover is white
      legend_hover_reverse: {
        fill: 'white'
      },
      // The effect of making the province map "spit out" when hovering
      hover: {
        lineWidth: 3,
        stroke: 'rgb(0, 0, 0)',
        shadowBlur: 80,
        shadowColor: 'rgb(0, 0, 0)'
      },
      hover_reverse: {
        opacity: 0.1
      }
    }
  },

  //  Chart title
  title: {
    text: 'Spicy food in China at a glance'
  },
  legends: [
    {
      orient: 'top',
      position: 'middle',
      padding: {
        bottom: 12
      },
      visible: true,
      field: 'category',
      filter: false,
      select: false,
      data: items => {
        return items.map(item => {
          item.shape.outerBorder = {
            stroke: item.shape.fill,
            distance: 2,
            lineWidth: 1
          };
          return item;
        });
      }
    }
  ]
};

// VChart.registerPictogramChart();
// VChart.default.registerSVG('chinamap', shape);

VChart.registerSVG('chinamap', shape);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
// Listen for legend item hover events
vchart.on('legendItemHover', e => {
  // Gets the legend item name of the hover
  const hoveredName = e?.value?.data?.label;
  if (hoveredName) {
    // Update the chart status by setting the color of the legend item that is not hovering
    vchart.updateState({
      legend_hover_reverse: {
        filter: d => {
          // Finds the category of the current data item
          const category = chinamap_data.find(chinamap_data => chinamap_data.name === d.data?.name)?.category;
          // Return true if the class exists and is not equal to the legend item name of the hover, fals
          return category && category !== hoveredName;
        }
      }
    });
  }
});

// Listen for the legend item unhover event
vchart.on('legendItemUnHover', e => {
  // Update the chart state to restore the color of all legend items to the original color
  vchart.updateState({
    legend_hover_reverse: {
      filter: d => false
    }
  });
});

vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Relative tourials

[pictogram](link)
