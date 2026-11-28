---
category: examples
group: pictogram chart
title: SVG Keyboard
keywords: pictogramChart, space
order: 26-1
cover: /vchart/preview/pictogram-keyboard_1.13.0.png
option: pictogramChart
---

# SVG Keyboard

## Key Configurations

- In the SVG file, configure the name attribute for the pictogram, then you can specify the pictogram style through the name configuration in the chart settings;

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
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/pictogram/keyboard.svg');
const keyboard = await response.text();

const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: [
      {
        name: 'W',
        value: 1
      },
      {
        name: 'A',
        value: 1
      },
      {
        name: 'S',
        value: 1
      },
      {
        name: 'D',
        value: 1
      }
    ]
  },
  region: [
    {
      roam: { blank: true }
    }
  ],
  nameField: 'name',
  valueField: 'value',
  svg: 'keyboard',
  pictogram: {
    style: {
      fill: datum => {
        return datum.data?.value ? 'rgb(190,204,232)' : 'white';
      },
      fillOpacity: 0.5
    },
    state: {
      selected: {
        fill: 'red'
      }
    }
  }
};

VChart.registerSVG('keyboard', keyboard);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Assume this is your keyboard layout 2D array
const keyboardLayout = [
  // First row
  ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
  // Second row
  ['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  // Third row
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  // Fourth row
  ['CapsLock', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  // Fifth row
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  // Sixth row
  ['Control', 'Win', 'Alt', 'Space', 'Alt', 'Menu', 'Ctrl']
];

// Convert the keyboard layout to a one-dimensional array for easy lookup
const keys = keyboardLayout.flat();

document.addEventListener('keydown', async event => {
  // Get the name of the key pressed and ensure the first letter is capitalized
  const keyName = event.key.charAt(0).toUpperCase() + event.key.slice(1);

  if (keys.includes(keyName)) {
    console.log(`You pressed ${keyName} key.`);

    const graphics = vchart.getStage().getElementsByName(keyName);
    if (graphics) {
      graphics.forEach(g => {
        g._originalFill = g.attribute.fill;
        g.setAttributes({ fill: 'red' });
      });
    }
  } else {
    console.log(`You pressed a key that is not in the standard keyboard layout: ${keyName}`);
  }
});

document.addEventListener('keyup', async event => {
  // Get the name of the key pressed and ensure the first letter is capitalized
  const keyName = event.key.charAt(0).toUpperCase() + event.key.slice(1);

  if (keys.includes(keyName)) {
    const graphics = vchart.getStage().getElementsByName(keyName);
    if (graphics) {
      graphics.forEach(g => g.setAttributes({ fill: g._originalFill ?? 'white' }));
    }
  }
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[PictogramChart](link)
