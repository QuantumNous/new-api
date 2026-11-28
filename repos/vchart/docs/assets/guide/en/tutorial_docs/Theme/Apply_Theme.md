# Theme Application Guide

VChart provides a flexible theme application mechanism that supports applying themes at both global and chart instance levels. This article will detail how to apply different types of themes, including default themes, custom themes, extension package themes, and how to extend installed themes.

## Theme Application Scope

VChart supports two levels of theme application:

### 1. Global Application

The `ThemeManager.setCurrentTheme()` method (<https://www.visactor.com/vchart/api/API/theme>) can be used to set a global theme, which will affect all existing chart instances on the page as well as subsequently created chart instances.

### 2. Chart Instance Application

Through the `theme` configuration item in the chart spec or through the constructor (<https://www.visactor.com/vchart/api/API/vchart>), you can apply a specific theme to a single chart instance without affecting other charts.

You can also use the `setCurrentTheme` instance method to dynamically update the current chart, provided that the theme has been registered through `VChart.ThemeManager.registerTheme`.

```js
vchart.setCurrentTheme('userTheme');
```

## Theme Types

### 1. Default Themes

VChart has built-in `light` and `dark` default themes that can be used directly without registration.

#### Global Application of Default Theme

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value'
};

// Apply default theme globally
VChart.ThemeManager.setCurrentTheme('dark');

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Chart Instance Application of Default Theme

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value',
  // Specify theme name in spec
  theme: 'dark'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 2. Custom Themes

Custom themes are theme configuration objects defined by users. For custom content, refer to:

<https://www.visactor.com/vchart/guide/tutorial_docs/Theme/Customize_Theme>

#### Global Application of Custom Theme

```javascript livedemo
// Define custom theme
const customTheme = {
  name: 'myCustomTheme',
  colorScheme: {
    default: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2']
  },
  series: {
    bar: {
      barMaxWidth: 20,
      label: {
        visible: true,
        position: 'top'
      }
    }
  },
  component: {
    axis: {
      label: {
        style: {
          fill: '#666',
          fontSize: 12
        }
      }
    }
  }
};

// Register custom theme
VChart.ThemeManager.registerTheme('myCustomTheme', customTheme);

// Apply custom theme globally
VChart.ThemeManager.setCurrentTheme('myCustomTheme');

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Chart Instance Application of Custom Theme

There are two ways:

**Method 1: Through the theme configuration item in spec**

```javascript livedemo
// Define custom theme object
const customTheme = {
  colorScheme: {
    default: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2']
  },
  series: {
    bar: {
      barMaxWidth: 20,
      label: {
        visible: true,
        position: 'top'
      }
    }
  }
};

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value',
  // Pass theme object directly in spec
  theme: customTheme
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

**Method 2: Through instance method**

```javascript livedemo
// Define and register custom theme
const customTheme = {
  colorScheme: {
    default: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2']
  },
  series: {
    bar: {
      barMaxWidth: 20,
      label: {
        visible: true,
        position: 'top'
      }
    }
  }
};

VChart.ThemeManager.registerTheme('myCustomTheme', customTheme);

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Apply theme through instance method
vchart.setCurrentTheme('myCustomTheme');
```

### 3. Extension Package Themes

VChart provides an extension theme package `@visactor/vchart-theme` that contains various ready-to-use themes.
Reference: <https://www.visactor.com/vchart/guide/tutorial_docs/Theme/Theme_Extension>

#### Installing Extension Theme Package

```bash
npm install @visactor/vchart-theme
# or
yarn add @visactor/vchart-theme
```

#### Global Application of Extension Package Theme

```javascript livedemo
// Import extension theme package
// import { allThemeMap } from '@visactor/vchart-theme';

// The VChartTheme object is already mounted on the window object in the editor environment

// Register all extension themes
VChartTheme.allThemeMap.forEach((theme, name) => {
  VChart.ThemeManager.registerTheme(name, theme);
});

// Apply extension theme globally
VChart.ThemeManager.setCurrentTheme('vScreenVolcanoBlue');

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Chart Instance Application of Extension Package Theme

```javascript livedemo
// Import specific theme
const response = await fetch('https://www.unpkg.com/@visactor/vchart-theme@latest/public/vScreenVolcanoBlue.json');
const vScreenVolcanoBlue = await response.json();

// Register extension theme
VChart.ThemeManager.registerTheme('vScreenVolcanoBlue', vScreenVolcanoBlue);

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value',
  // Specify theme name in spec
  theme: 'vScreenVolcanoBlue'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 4. Extending Installed Themes

Sometimes we need to make some custom modifications to an existing theme rather than completely redefining it. You can get the installed theme and then extend it.

#### Extending Default Theme

```javascript livedemo
// Get default theme
const defaultTheme = VChart.ThemeManager.getDefaultTheme();

// Extend default theme, create new theme
const extendedTheme = {
  ...defaultTheme,
  colorScheme: {
    default: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2']
  },
  series: {
    ...defaultTheme.series,
    bar: {
      ...defaultTheme.series?.bar,
      barMaxWidth: 30,
      label: {
        visible: true,
        position: 'top',
        style: {
          fill: '#333',
          fontSize: 14
        }
      }
    }
  }
};

// Register extended theme
VChart.ThemeManager.registerTheme('extendedLight', extendedTheme);

// Apply extended theme
VChart.ThemeManager.setCurrentTheme('extendedLight');

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Extending Extension Package Theme

```javascript livedemo
// Import extension theme (the following two lines are needed in development environment, not needed in vchart playground)
//import vScreenVolcanoBlue from '@visactor/vchart-theme/public/vScreenVolcanoBlue.json';
//import VChart from '@visactor/vchart';
const response = await fetch('https://www.unpkg.com/@visactor/vchart-theme@latest/public/vScreenVolcanoBlue.json');
const vScreenVolcanoBlue = await response.json();

// Register original theme
VChart.ThemeManager.registerTheme('vScreenVolcanoBlue', vScreenVolcanoBlue);

// Get registered theme
const baseTheme = VChart.ThemeManager.getTheme('vScreenVolcanoBlue');

// Extend theme, add custom configuration
const extendedTheme = {
  ...baseTheme,
  series: {
    ...baseTheme.series,
    bar: {
      ...baseTheme.series?.bar,
      barMaxWidth: 40,
      label: {
        visible: true,
        position: 'top',
        style: {
          fill: '#fff',
          fontSize: 16,
          fontWeight: 'bold'
        }
      }
    }
  },
  component: {
    ...baseTheme.component,
    axis: {
      ...baseTheme.component?.axis,
      label: {
        ...baseTheme.component?.axis?.label,
        style: {
          ...baseTheme.component?.axis?.label?.style,
          fontSize: 14,
          fontWeight: 'bold'
        }
      }
    }
  }
};

// Register extended theme
VChart.ThemeManager.registerTheme('extendedVolcanoBlue', extendedTheme);

// Apply extended theme
VChart.ThemeManager.setCurrentTheme('extendedVolcanoBlue');

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Using Deep Merge to Extend Theme

For complex theme structures, you can use a deep merge utility to extend themes:

```javascript livedemo
// Deep merge utility function
function deepMerge(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Get default theme
const baseTheme = VChart.ThemeManager.getDefaultTheme();

// Define extension configuration
const extension = {
  series: {
    bar: {
      barMaxWidth: 25,
      label: {
        visible: true,
        position: 'top'
      }
    }
  },
  component: {
    axis: {
      label: {
        style: {
          fontSize: 14
        }
      }
    }
  }
};

// Deep merge
const mergedTheme = deepMerge(baseTheme, extension);

// Register merged theme
VChart.ThemeManager.registerTheme('mergedTheme', mergedTheme);

// Apply theme
VChart.ThemeManager.setCurrentTheme('mergedTheme');

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Summary

This article introduced a complete guide to VChart theme application:

1. **Theme Application Scope**:

   - Global application: Affects all charts through `ThemeManager.setCurrentTheme()`
   - Chart instance application: Through the `theme` configuration item in spec or the instance's `setCurrentTheme()` method

2. **Theme Types**:

   - **Default themes**: VChart's built-in `light` and `dark` themes that can be used without registration
   - **Custom themes**: Theme configuration objects defined by users
   - **Extension package themes**: Rich themes provided through the `@visactor/vchart-theme` package
   - **Extending installed themes**: Customizing modifications based on existing themes

3. **Best Practices**:
   - Use global themes for multiple charts that need a unified style
   - Use instance themes for individual charts that need special styling
   - Use theme extension for scenarios that need fine-tuning based on existing themes

By flexibly using these theme application methods, you can easily achieve personalized customization and unified management of charts.
