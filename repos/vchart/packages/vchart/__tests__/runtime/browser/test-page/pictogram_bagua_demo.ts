import { default as VChart, registerPictogramChart } from '../../../../src/index';
registerPictogramChart();

// 加载本地SVG文件（确保路径正确）
const response = await fetch('https://cdn.jsdelivr.net/gh/xilzy/images/pictogram-bagua-name4.svg');
const shape = await response.text();

// 定义容器ID常量（与HTML中的id一致）
const CONTAINER_ID = 'chartContainer';

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
// 注册自定义SVG（标识符需与spec.svg字段对应）
VChart.registerSVG('bagua', shape);
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.on('click', console.log);
vchart.renderSync();
// 控制台调试用，实际部署时删除
window['vchart'] = vchart;
