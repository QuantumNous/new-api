---
category: examples
group: pictogram chart
title: 中国地图吃辣程度一览象形图
keywords: pictogramChart,map,comparison,china
order: 26-6
cover: https://cdn.jsdelivr.net/gh/UC-web291/picture_storing/5.gif
option: pictogramChart
---

# 中国地图象形图--中国省份吃辣程度一览

> 由 Qian_Shark 贡献

通过象形图展示中国各地区的分类信息，可根据吃辣的不同类别进行颜色映射，从强到弱颜色越来越偏冷调，同时支持图例悬停交互显示省份信息。

## 关键配置

- 在 SVG 文件中，为图元配置 name 属性，则在图表配置中可以通过 name 配置指定图元样式；
- 通过 `VChart.registerSVG` 接口来注册 svg 资源；
- `svg` 属性声明为注册的 svg 名称
- `type: pictogram` 属性声明为象形图
- `data` 属性定义数据来源
- `color` 属性进行颜色映射配置
- `seriesField` 和 `nameField` 分别声明系列字段和名称字段
- `svg` 属性指定使用的 SVG 图形
- `pictogram.style` 属性声明象形图元的样式
- 监听 `legendItemHover` 和 `legendItemUnHover` 事件实现图例悬停交互

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

const response = await fetch('https://cdn.jsdelivr.net/gh/UC-web291/picture_storing/chinamap.svg');
const shape = await response.text();
// 定义地图数据
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

// 定义图表配置对象
const spec = {
  // 图表类型为象形图
  type: 'pictogram',
  padding: 0,
  data: {
    // 数据的唯一标识符
    id: 'data',
    // 数据的值
    values: chinamap_data
  },
  color: {
    specified: {
      // 大师
      MVP: 'rgb(73, 3, 3)',
      // 钻石
      diamond: 'rgb(250, 8, 8)',
      //  黄金
      gold: 'rgb(250, 77, 8)',
      // 白银
      silver: 'rgb(228, 170, 64)',
      // 青铜
      bronze: 'rgb(198, 238, 53)',
      // 未定义类别的颜色为白色
      undefined: 'white'
    },
    // 颜色映射的字段为类别
    field: 'category'
  },
  // 系列字段为类别
  seriesField: 'category',
  // 名称字段为名称
  nameField: 'name',
  //显示辣椒图标
  valueField: 'level',
  // 使用的 SVG 图形名称
  svg: 'chinamap',
  pictogram: {
    style: {
      fill: {
        // 填充颜色使用 color 颜色映射，字段为类别
        scale: 'color',
        field: 'category'
      },
      cursor: 'pointer'
    },
    state: {
      // 图例悬停时的填充颜色为白色
      legend_hover_reverse: {
        fill: 'white'
      },
      hover: {
        lineWidth: 3,
        stroke: 'black',
        shadowBlur: 80,
        shadowColor: 'black'
      },
      // 鼠标非悬停时的效果，地图向外扩散，透明度降低，阴影模糊度增加
      hover_reverse: {
        opacity: 0.1
      }
    }
  },
  // 图表标题
  title: {
    text: '中国地图吃辣程度一览'
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

// 注册 SVG 图形资源，名称为 chinamap，图形数据为 shape
VChart.registerSVG('chinamap', shape);

// 创建 VChart 实例，传入图表配置对象和容器 ID
const vchart = new VChart(spec, { dom: CONTAINER_ID });

// 监听图例项悬停事件
vchart.on('legendItemHover', e => {
  // 获取悬停的图例项名称
  const hoveredName = e?.value?.data?.label;
  if (hoveredName) {
    // 更新图表状态，将未悬停的图例项颜色设置为灰色
    vchart.updateState({
      legend_hover_reverse: {
        filter: d => {
          // 查找当前数据项的类别
          const category = chinamap_data.find(chinamap_data => chinamap_data.name === d.data?.name)?.category;
          // 如果类别存在且不等于悬停的图例项名称，则返回 true，否则返回 false
          return category && category !== hoveredName;
        }
      }
    });
  }
});

// 监听图例项取消悬停事件
vchart.on('legendItemUnHover', e => {
  // 更新图表状态，将所有图例项颜色恢复为原始颜色
  vchart.updateState({
    legend_hover_reverse: {
      filter: d => false
    }
  });
});

// 渲染图表
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[象形图](link)
