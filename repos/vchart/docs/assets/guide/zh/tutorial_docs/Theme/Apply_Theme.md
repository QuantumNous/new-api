# 主题应用指南

VChart 提供了灵活的主题应用机制，支持在全局和图表实例两个层面应用主题。本文将详细介绍如何应用不同类型的主题，包括默认主题、自定义主题、扩展包主题以及如何扩展已安装的主题。

## 主题应用范围

VChart 支持两种主题应用范围：

### 1. 全局应用

通过 `ThemeManager.setCurrentTheme()` ( <https://www.visactor.com/vchart/api/API/theme> ) 方法可以设置全局主题，该方法会影响页面上所有已创建的图表实例以及后续创建的图表实例。

### 2. 图表实例应用

通过图表 spec 的 `theme` 配置项或通过构造函数( <https://www.visactor.com/vchart/api/API/vchart> )，可以为单个图表实例应用特定的主题，不会影响其他图表。

也可以通过 setCurrentTheme 实例方法，对当前图表进行动态更新，前提是该主题通过 VChart.ThemeManager.registerTheme 注册过。

```js
vchart.setCurrentTheme('userTheme');
```

## 主题类型

### 1. 默认主题

VChart 内置了 `light` 和 `dark` 两个默认主题，无需注册即可直接使用。

#### 全局应用默认主题

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

// 全局应用默认主题
VChart.ThemeManager.setCurrentTheme('dark');

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### 图表实例应用默认主题

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
  // 在 spec 中指定主题名称
  theme: 'dark'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 2. 自定义主题

自定义主题是指用户自己定义的主题配置对象。自定义内容参考：

<https://www.visactor.com/vchart/guide/tutorial_docs/Theme/Customize_Theme>

#### 全局应用自定义主题

```javascript livedemo
// 定义自定义主题
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

// 注册自定义主题
VChart.ThemeManager.registerTheme('myCustomTheme', customTheme);

// 全局应用自定义主题
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

#### 图表实例应用自定义主题

有两种方式：

**方式一：通过 spec 的 theme 配置项**

```javascript livedemo
// 定义自定义主题对象
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
  // 直接在 spec 中传入主题对象
  theme: customTheme
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

**方式二：通过实例方法**

```javascript livedemo
// 定义并注册自定义主题
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

// 通过实例方法应用主题
vchart.setCurrentTheme('myCustomTheme');
```

### 3. 扩展包主题

VChart 提供了扩展主题包 `@visactor/vchart-theme`，包含多种开箱即用的主题。
参考： <https://www.visactor.com/vchart/guide/tutorial_docs/Theme/Theme_Extension>

#### 安装扩展主题包

```bash
npm install @visactor/vchart-theme
# 或
yarn add @visactor/vchart-theme
```

#### 全局应用扩展包主题

```javascript livedemo
// 导入扩展主题包
// Import extension theme package
// import { allThemeMap } from '@visactor/vchart-theme';

// The VChartTheme object is already mounted on the window object in the editor environment

// 注册所有扩展主题
VChartTheme.allThemeMap.forEach((theme, name) => {
  VChart.ThemeManager.registerTheme(name, theme);
});

// 全局应用扩展主题
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

#### 图表实例应用扩展包主题

```javascript livedemo
// 导入特定主题
const response = await fetch('https://www.unpkg.com/@visactor/vchart-theme@latest/public/vScreenVolcanoBlue.json');
const vScreenVolcanoBlue = await response.json();

// 注册扩展主题
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
  // 在 spec 中指定主题名称
  theme: 'vScreenVolcanoBlue'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 4. 扩展已安装的主题

有时候我们需要在已有主题的基础上进行一些定制化修改，而不是完全重新定义。可以通过获取已安装的主题，然后进行扩展。

#### 扩展默认主题

```javascript livedemo
// 获取默认主题
const defaultTheme = VChart.ThemeManager.getDefaultTheme();

// 扩展默认主题，创建新主题
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

// 注册扩展后的主题
VChart.ThemeManager.registerTheme('extendedLight', extendedTheme);

// 应用扩展主题
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

#### 扩展扩展包主题

```javascript livedemo
// 导入扩展主题(以下两行代码在开发环境中需要使用，vchart playground 中不需要)
//import vScreenVolcanoBlue from '@visactor/vchart-theme/public/vScreenVolcanoBlue.json';
//import VChart from '@visactor/vchart';
const response = await fetch('https://www.unpkg.com/@visactor/vchart-theme@latest/public/vScreenVolcanoBlue.json');
const vScreenVolcanoBlue = await response.json();

// 注册原始主题
VChart.ThemeManager.registerTheme('vScreenVolcanoBlue', vScreenVolcanoBlue);

// 获取已注册的主题
const baseTheme = VChart.ThemeManager.getTheme('vScreenVolcanoBlue');

// 扩展主题，添加自定义配置
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

// 注册扩展后的主题
VChart.ThemeManager.registerTheme('extendedVolcanoBlue', extendedTheme);

// 应用扩展主题
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

#### 使用深度合并扩展主题

对于复杂的主题结构，可以使用深度合并工具来扩展主题：

```javascript livedemo
// 深度合并工具函数
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

// 获取默认主题
const baseTheme = VChart.ThemeManager.getDefaultTheme();

// 定义扩展配置
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

// 深度合并
const mergedTheme = deepMerge(baseTheme, extension);

// 注册合并后的主题
VChart.ThemeManager.registerTheme('mergedTheme', mergedTheme);

// 应用主题
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

## 总结

本文介绍了 VChart 主题应用的完整指南：

1. **主题应用范围**：

   - 全局应用：通过 `ThemeManager.setCurrentTheme()` 影响所有图表
   - 图表实例应用：通过 spec 的 `theme` 配置项或实例的 `setCurrentTheme()` 方法

2. **主题类型**：

   - **默认主题**：VChart 内置的 `light` 和 `dark` 主题，无需注册即可使用
   - **自定义主题**：用户自己定义的主题配置对象
   - **扩展包主题**：通过 `@visactor/vchart-theme` 包提供的丰富主题
   - **扩展已安装的主题**：在已有主题基础上进行定制化修改

3. **最佳实践**：
   - 对于需要统一风格的多个图表，使用全局主题
   - 对于需要特殊样式的单个图表，使用实例主题
   - 对于需要基于现有主题进行微调的场景，使用主题扩展

通过灵活运用这些主题应用方式，您可以轻松实现图表的个性化定制和统一管理。
