---
category: examples
group: pictogram chart
title: 太极八卦图
keywords: pictogramChart, interaction
order: 26-7
cover: https://cdn.jsdelivr.net/gh/xilzy/images/pictogram-bagua-cover.png
option: pictogramChart
---

# 象形图-太极八卦图

> 由 [xilzy](https://github.com/xilzy) 贡献

太极八卦象图展示了先天八卦的各个元素。核心位置为太极图案，中间层为 8 个卦象，最外层为八个卦象的符号图案。卦象符号图案都有对应的五行属性。通过使用象形图，我们可以快速了解先天八卦的布局和元素分布情况，为先天八卦研究和分析提供参考。 鼠标悬停在图例上，可以显示一类属性元素的分布；鼠标悬停在图中的形状上，可以显示该形状对应的元素名称。

## 关键配置

- 在 SVG 文件中，为图元配置 `name` 属性，则在图表配置中可以通过 `name` 配置指定图元样式；
- 通过 `VChart.registerSVG` 接口来注册 svg 资源；
- `svg` 属性声明为注册的 svg 名称；
- 数据：声明数据，数据格式为 `[{name: 'xxx', value:'xxx',category: 'xxx'}]`；
- 颜色配置：以`category`为基本配色单位，阴阳使用黑白色系，五行对应黄绿蓝红褐五种色系，整体上采用柔和的颜色。
- 交互：采用`element-active-by-legend`交互模式，可以通过点击图例进行交互，也可以通过鼠标悬停在具体元素区域进行交互，对于非核心区域，设置禁止交互模式。

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 1.x版本，在业务中使用时, 请额外引入 registerPictogramChart 并执行
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
// 2.0.0版本，在业务中使用时, 请额外引入 registerPictogramChart 并执行
// import { registerPictogramChart } from '@visactor/vchart-extension';
// registerPictogramChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
if (VCHART_MODULE.registerPictogramChart) {
  // 1.x 版本执行注册代码
  VCHART_MODULE.registerPictogramChart();
} else if (VChartExtension.registerPictogramChart) {
  // 2.0.0版本执行注册代码
  VChartExtension.registerPictogramChart();
}

// 加载SVG文件（确保路径正确）
const response = await fetch('https://cdn.jsdelivr.net/gh/xilzy/images/pictogram-bagua-name4.svg');
const shape = await response.text();

const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    // 八卦数据配置,中心阴阳可分为正负两类，外围八卦对应五行属性分类
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
  svg: 'bagua', // 使用自定义SVG标识
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
      // 阴阳元素配色，保留经典对比又增加质感
      阳: '#F5F1E6', // 阳用米白色，柔和不刺眼
      阴: '#1A1A1A', // 阴用深灰色，比纯黑更有层次

      // 五行元素配色（优化后更协调的传统色调）
      金: '#F2D08C', // 金 - 暖调米金色，替代高饱和黄
      木: '#61B58C', // 木 - 清新草木绿，视觉更舒适
      水: '#3A86C8', // 水 - 沉稳湖蓝色
      火: '#E66C52', // 火 - 低饱和砖红色，减少刺眼感
      土: '#A67C58', // 土 - 温暖赭石色
      background: '#F5E9D6', // 背景改用浅米色，营造古朴氛围
      line: '#D2B48C', // 线条用暖调浅棕色，增强整体融合度
      undefined: false
    },
    // 颜色映射的字段为类别
    field: 'category'
  },
  //交互配置
  interactions: [
    {
      type: 'element-active-by-legend'
    }
  ],
  //象形图配置
  pictogram: {
    style: {
      fill: {
        scale: 'color',
        field: 'category'
      },
      stroke: '#000000', // 边框颜色为黑色
      lineWidth: 2,
      pickable: datum => datum.name !== 'Line',
      visible: datum => datum => !datum.attributes?.d?.startsWith('M0 0L1024 0L1024 1024L0 1024')
    },
    state: {
      active: {
        fillOpacity: 0.8,
        stroke: {
          //激活状态的颜色设置
          scale: 'color',
          field: 'category'
        },
        lineWidth: 2
      },
      hover: {
        fillOpacity: 0.8,
        stroke: {
          //悬浮状态的颜色设置
          scale: 'color',
          field: 'category'
        },
        lineWidth: 1
      }
    }
  },
  // 标题配置
  title: {
    text: '太极八卦图',
    textStyle: {
      fontSize: 18,
      fill: '#333'
    }
  },
  // 图例配置
  legends: {
    orient: 'top',
    top: '5%', // 将图例向上移动 5% 的位置
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

// 注册 SVG 图形资源，名称为bagua，图形数据为 shape
VChart.registerSVG('bagua', shape);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 控制台调试用，实际部署时删除
window['vchart'] = vchart;
```

## 相关教程

[象形图](link)
