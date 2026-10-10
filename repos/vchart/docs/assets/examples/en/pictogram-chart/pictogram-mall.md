---
category: examples
group: pictogram chart
title: SVG Shopping Mall Tenant Layout
keywords: pictogramChart
order: 26-5
cover: https://cdn.jsdelivr.net/gh/EchoChenGithub/images/mall_map.gif
option: pictogramChart
---

# SVG Shopping Mall Tenant Layout

> Contributed by Echo

Shopping Mall Tenant Layout pictogram displays the distribution of different business formats within the mall. Each business format is represented by a specific shape, and the color of the shape indicates the type of business format. By using pictograms, we can quickly understand the mall's layout and business format distribution, providing a reference for mall operation and management. Hovering the mouse over the legend reveals the distribution of a specific business format; hovering the mouse over a shape in the diagram displays the name of the store corresponding to that shape.

## Key Configurations

- Register SVG resources through the `VChart.registerSVG` interface;
- Declare the `svg` attribute as the registered SVG name.
- Interaction: Disable the `select` configuration for the `legend`. Implement the hover highlight of legend items by listening to the mouse hover event of the legend, and then using the stateUpdate API `updateState`. You need to set the `state` for updating in the `pictogram` property.
- data: Declare the data, the data format is `[{name: 'xxx', category: 'xxx'}]`.

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
const response = await fetch('https://cdn.jsdelivr.net/gh/EchoChenGithub/images/mallmap_withoutcolor.svg');
// Parse the response text content into an SVG graphic
const shape = await response.text();

// Define mall data, including the name and category of each store
const mall_data = [
  { name: 'Starbucks', category: 'food_and_dining' },
  { name: 'Foot Locker', category: 'apparel_and_shoes' },
  { name: 'Dave and Busters', category: 'entertainment' },
  { name: 'Best Buy', category: 'electronics' },
  { name: 'Kay Jewelers', category: 'jewelry' },
  { name: 'Target', category: 'shopping' },
  { name: 'McDonalds', category: 'food_and_dining' },
  { name: 'Nike Store', category: 'apparel_and_shoes' },
  { name: 'AMC Theatres', category: 'entertainment' },
  { name: 'Apple Store', category: 'electronics' },
  { name: 'Tiffany Co', category: 'jewelry' },
  { name: "Macy's", category: 'shopping' },
  { name: 'Chipotle', category: 'food_and_dining' },
  { name: 'Old Navy', category: 'apparel_and_shoes' },
  { name: 'Samsung Store', category: 'electronics' },
  { name: 'Pandora', category: 'jewelry' },
  { name: 'Walmart', category: 'shopping' },
  { name: 'Subway', category: 'food_and_dining' },
  { name: 'Maintenance', category: 'infrastructure' },
  { name: 'Restroom', category: 'infrastructure' },
  { name: 'Management', category: 'infrastructure' },
  { name: 'Adidas Store', category: 'apparel_and_shoes' },
  { name: 'Round 1', category: 'entertainment' },
  { name: 'HP Store', category: 'electronics' },
  { name: 'Zales Jewelers', category: 'jewelry' },
  { name: 'TJ Maxx', category: 'shopping' },
  { name: 'Pizza Hut', category: 'food_and_dining' },
  { name: 'HM', category: 'apparel_and_shoes' },
  { name: 'Regal Cinemas', category: 'entertainment' },
  { name: 'Microsoft Store', category: 'electronics' },
  { name: 'Jared', category: 'jewelry' },
  { name: "Kohl's", category: 'shopping' },
  { name: 'Panera Bread', category: 'food_and_dining' },
  { name: 'Gap', category: 'apparel_and_shoes' },
  { name: 'Barnes and Noble', category: 'entertainment' },
  { name: 'Radio Shack', category: 'electronics' },
  { name: "Claire's", category: 'jewelry' },
  { name: 'JCPenney Outlet', category: 'shopping' },
  { name: 'Taco Bell', category: 'food_and_dining' },
  { name: 'Express', category: 'apparel_and_shoes' },
  { name: 'Chuck E Cheese', category: 'entertainment' },
  { name: 'Swarovski', category: 'jewelry' },
  { name: 'HomeGoods', category: 'shopping' },
  { name: 'Burger King', category: 'food_and_dining' },
  { name: 'American Eagle', category: 'apparel_and_shoes' },
  { name: 'Sky Zone', category: 'entertainment' },
  { name: 'Verizon', category: 'electronics' },
  { name: 'Sephora', category: 'jewelry' },
  { name: 'Best Buy Mobile', category: 'shopping' },
  { name: 'Five Guys', category: 'food_and_dining' },
  { name: "Levi's", category: 'apparel_and_shoes' },
  { name: 'Arcade', category: 'entertainment' },
  { name: 'GameStop', category: 'electronics' },
  { name: 'Helzberg Diamonds', category: 'jewelry' },
  { name: 'Marshalls', category: 'shopping' },
  { name: 'Chick-fil-A', category: 'food_and_dining' },
  { name: 'Banana Republic', category: 'apparel_and_shoes' },
  { name: 'Main Event', category: 'entertainment' },
  { name: 'Frys Electronics', category: 'electronics' },
  { name: 'JCPenney Jewelers', category: 'jewelry' },
  { name: 'Burlington', category: 'shopping' },
  { name: 'Dunkin Donuts', category: 'food_and_dining' },
  { name: 'Forever 21', category: 'shopping' },
  { name: 'Mall Kiosk 1', category: 'shopping' },
  { name: 'Mall Kiosk 2', category: 'food_and_dining' },
  { name: 'Mall Kiosk 3', category: 'apparel_and_shoes' },
  { name: 'Mall Kiosk 4', category: 'entertainment' },
  { name: 'Mall Kiosk 5', category: 'electronics' },
  { name: 'Mall Kiosk 6', category: 'jewelry' },
  { name: 'Mall Kiosk 7', category: 'shopping' },
  { name: 'JCPenney', category: 'apparel_and_shoes' },
  { name: 'Belk', category: 'apparel_and_shoes' },
  { name: 'Bealls', category: 'apparel_and_shoes' },
  { name: 'Kmart', category: 'shopping' },
  { name: 'AMC Theatres', category: 'entertainment' },
  { name: 'Sears', category: 'shopping' }
];

// Define the chart configuration object
const spec = {
  // Chart type is pictogram
  type: 'pictogram',
  data: {
    // The unique identifier of the data
    id: 'data',
    // The value of the data
    values: mall_data
  },
  color: {
    specified: {
      // The color of the food and dining category is brownish red
      food_and_dining: '#A52A2A',
      // The color of the apparel and shoes category is forest green
      apparel_and_shoes: '#228B22',
      // The color of the entertainment category is steel blue
      entertainment: '#4682B4',
      // The color of the jewelry category is dark violet
      jewelry: '#9400D3',
      // The color of the electronics category is goldenrod
      electronics: '#DAA520',
      // The color of the shopping category is dark cyan
      shopping: '#008B8B',
      // The color of the infrastructure category is dark olive green
      infrastructure: '#556B2F',
      // The color of the undefined category is white
      undefined: 'white'
    },
    // The field for color mapping is category
    field: 'category'
  },
  // The series field is category
  seriesField: 'category',
  // The name field is name
  nameField: 'name',
  // The name of the SVG graphic used is mall
  svg: 'mall',
  pictogram: {
    style: {
      fill: {
        // The fill color uses the color color mapping, and the field is category
        scale: 'color',
        field: 'category'
      }
    },
    state: {
      // The fill color of the legend item when hovering is gray
      legend_hover_reverse: {
        fill: '#ccc'
      }
    }
  },
  // Chart title
  title: {
    text: 'Shopping Mall Tenant Layout'
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

VChart.registerSVG('mall', shape);

const vchart = new VChart(spec, { dom: CONTAINER_ID });

// Listen for the legend item hover event
vchart.on('legendItemHover', e => {
  // Get the name of the hovered legend item
  const hoveredName = e?.value?.data?.label;
  if (hoveredName) {
    // Update the chart state to set the color of the non-hovered legend items to gray
    vchart.updateState({
      legend_hover_reverse: {
        filter: d => {
          // Find the category of the current data item
          const category = mall_data.find(mall_data => mall_data.name === d.data?.name)?.category;
          // If the category exists and is not equal to the hovered legend item name, return true, otherwise return false
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

## Related Tutorials

[PictogramChart](link)
