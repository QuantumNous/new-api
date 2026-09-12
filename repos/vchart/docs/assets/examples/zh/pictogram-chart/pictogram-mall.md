---
category: examples
group: pictogram chart
title: 商场业态示意图
keywords: pictogramChart, interaction
order: 26-5
cover: https://cdn.jsdelivr.net/gh/EchoChenGithub/images/mall_map.gif
option: pictogramChart
---

# 象形图-商场业态结构图

> 由 Qian_Shark 贡献

商场业态结构图展示了商场中不同业态的分布情况。每个业态都被表示为一个特定的形状，形状的颜色表示业态的类型。 通过使用象形图，我们可以快速了解商场的布局和业态分布情况，为商场运营和管理提供参考。 鼠标悬停在图例上，可以显示具体某个业态的分布；鼠标悬停在图的形状上，可以显示该形状对应的店铺名称。

## 关键配置

- 在 SVG 文件中，为图元配置 `name` 属性，则在图表配置中可以通过 `name` 配置指定图元样式；
- 通过 `VChart.registerSVG` 接口来注册 svg 资源；
- `svg` 属性声明为注册的 svg 名称；
- 交互：关闭 `legend` 的 `select` 配置，通过事件监听鼠标悬停图例事件，再通过状态更新 API `updateState` 来实现 hover 图例项高亮。需要在属性 `pictogram`中设定更新用的`state`。
- 数据：声明数据，数据格式为 `[{name: 'xxx', category: 'xxx'}]`；

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

// 使用 fetch API 获取 SVG 图形数据
const response = await fetch('https://cdn.jsdelivr.net/gh/EchoChenGithub/images/mallmap_withoutcolor.svg');
// 将响应的文本内容解析为 SVG 图形
const shape = await response.text();

// 定义商场数据，包含每个店铺的名称和类别
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

// 定义图表配置对象
const spec = {
  // 图表类型为象形图
  type: 'pictogram',
  data: {
    // 数据的唯一标识符
    id: 'data',
    // 数据的值
    values: mall_data
  },
  color: {
    specified: {
      // 餐饮类别的颜色为棕红色
      food_and_dining: '#A52A2A',
      // 服装鞋类别的颜色为森林绿
      apparel_and_shoes: '#228B22',
      // 娱乐类别的颜色为钢青色
      entertainment: '#4682B4',
      // 珠宝类别的颜色为深紫罗兰
      jewelry: '#9400D3',
      // 电子类别的颜色为金麒麟色
      electronics: '#DAA520',
      // 购物类别的颜色为深青色
      shopping: '#008B8B',
      // 基础设施类别的颜色为暗橄榄绿
      infrastructure: '#556B2F',
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
  // 使用的 SVG 图形名称为 mall
  svg: 'mall',
  pictogram: {
    style: {
      fill: {
        // 填充颜色使用 color 颜色映射，字段为类别
        scale: 'color',
        field: 'category'
      }
    },
    state: {
      // 图例悬停时的填充颜色为灰色
      legend_hover_reverse: {
        fill: '#ccc'
      }
    }
  },
  // 图表标题
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

// 注册 SVG 图形资源，名称为 mall，图形数据为 shape
VChart.registerSVG('mall', shape);

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
          const category = mall_data.find(mall_data => mall_data.name === d.data?.name)?.category;
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
