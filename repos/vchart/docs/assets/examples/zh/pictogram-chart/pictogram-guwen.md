---
category: examples
group: pictogram chart
title: 古文识别图
keywords: pictogramChart, interaction
order: 26-8
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/lisao_cover_2.png
option: pictogramChart
---

# 象形图-古文识别图

> 由 [zamhown](https://github.com/zamhown) 贡献

古文识别图展示了古籍数字化的 ocr 识别结果，并且优化信息图交互，辅助读者进行古文阅读。

《楚辞》扫描图片及解析文字来自于抖音公益项目「识典古籍」的公开数据。

鼠标悬停在图例上，可以单独显示原文或者注释；

鼠标悬停在文字上，tooltip 可以显示当前原文/注释的详细信息，可以将鼠标滑入 tooltip 中进行滚动；

鼠标点击图中的文字，可以快速调转到「识典古籍」中的对应原文位置。

## 关键配置

- 在 SVG 文件中，为图元配置 `name` 属性，则在图表配置中可以通过 `name` 配置指定图元样式；
- 通过 `VChart.registerSVG` 接口来注册 svg 资源；
- `svg` 属性声明为注册的 svg 名称；
- 交互：采用自定义交互模式，监听 `legendItemHover` 和 `legendItemUnHover` 事件实现图例悬停交互。
- tooltip：采用自定义 tooltip 回调 `updateElement`，对默认 tooltip 的 dom 结构进行重新绘制，同时继承了默认 tooltip 的布局策略。

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
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/lisao_2.svg');
const shape = await response.text();

const base_data = [
  {
    category: '原文',
    segment: '长太息以掩涕兮，哀民生之多艰',
    description: '长叹以掩面哭泣啊，哀伤民生多艰。',
    p: 'SBCK111_1_144'
  },
  { category: '原文', segment: '余虽好修姱以鞿羁兮', description: '我虽然喜欢美德而被束缚啊', p: 'SBCK111_1_146' },
  { category: '原文', segment: '謇朝谇而夕替', description: '忠直之言早上进献晚上就被替换', p: 'SBCK111_1_146' }
];

const data = [
  { name: 'chang11', value: '长', pinyin: 'cháng', ...base_data[0] },
  { name: 'tai12', value: '太', pinyin: 'tài', ...base_data[0] },
  { name: 'xi13', value: '息', pinyin: 'xī', ...base_data[0] },
  { name: 'yi14', value: '以', pinyin: 'yǐ', ...base_data[0] },
  { name: 'yan15', value: '掩', pinyin: 'yǎn', ...base_data[0] },
  { name: 'ti16', value: '涕', pinyin: 'tì', ...base_data[0] },
  { name: 'xi17', value: '兮', pinyin: 'xī', ...base_data[0] },
  { name: 'ai21', value: '哀', pinyin: 'āi', ...base_data[0] },
  { name: 'min22', value: '民', pinyin: 'mín', ...base_data[0] },
  { name: 'sheng23', value: '生', pinyin: 'shēng', ...base_data[0] },
  { name: 'zhi24', value: '之', pinyin: 'zhī', ...base_data[0] },
  { name: 'duo25', value: '多', pinyin: 'duō', ...base_data[0] },
  { name: 'jian26', value: '艰', pinyin: 'jiān', ...base_data[0] },
  { name: 'yu31', value: '余', pinyin: 'yú', ...base_data[1] },
  { name: 'sui32', value: '虽', pinyin: 'suī', ...base_data[1] },
  { name: 'hao33', value: '好', pinyin: 'hào', ...base_data[1] },
  { name: 'xiu34', value: '修', pinyin: 'xiū', ...base_data[1] },
  { name: 'kua35', value: '姱', pinyin: 'kuā', ...base_data[1] },
  { name: 'yi36', value: '以', pinyin: 'yǐ', ...base_data[1] },
  { name: 'ji37', value: '鞿', pinyin: 'jī', ...base_data[1] },
  { name: 'ji38', value: '羁', pinyin: 'jī', ...base_data[1] },
  { name: 'xi39', value: '兮', pinyin: 'xī', ...base_data[1] },
  { name: 'jian41', value: '謇', pinyin: 'jiǎn', ...base_data[2] },
  { name: 'zhao42', value: '朝', pinyin: 'zhāo', ...base_data[2] },
  { name: 'sui43', value: '谇', pinyin: 'suì', ...base_data[2] },
  { name: 'er44', value: '而', pinyin: 'ér', ...base_data[2] },
  { name: 'xi45', value: '夕', pinyin: 'xī', ...base_data[2] },
  { name: 'ti46', value: '替', pinyin: 'tì', ...base_data[2] },
  {
    name: 'comment1',
    value: null,
    category: '注释',
    segment:
      '愿依彭咸之遗则，又曰：吾将从彭咸之所居。盖其志先定，非一时忿怼而自沈也。反离骚曰：弃由聃之所珍兮，摭彭咸之所遗。岂知屈子之心哉！',
    p: 'SBCK111_1_142'
  },
  {
    name: 'comment2',
    value: null,
    category: '注释',
    segment:
      '艰，难也。言已自伤所行不合于世，将效彭咸，沈身于渊，乃太息长悲，哀念万民，受命而生，遭过多难，以陨其身。申生雉经，子胥沈江，是谓多难也。五臣云：太息掩涕，哀此万姓遭轻薄之俗，而多屯难。补曰：掩涕，犹牧泪也。远游曰：哀民生之长勤。与此意同。',
    p: 'SBCK111_1_144'
  },
  {
    name: 'comment3',
    value: null,
    category: '注释',
    segment:
      '鞿羁，以马自喻。缰在口曰鞿，革络头曰羁，言为人所系累也。五臣云：言我虽习前人之大道，而为谗人所衔勒。补曰：鞿，居依切。羁，居宜切。下文云：余独好修以为常。修姱，谓修洁而姱美也。',
    p: 'SBCK111_1_146'
  },
  {
    name: 'comment4',
    value: null,
    category: '注释',
    segment:
      '谇，谏也。诗曰：谇予不顾。替，废也。言己虽有绝远之智，姱好之姿，然以为谗人所鞿羁而系累矣，故朝谏謇謇于君，夕暮而身废弃也。补曰：谇音邃，又音信，今诗作讯。',
    p: 'SBCK111_1_146'
  }
];

const font1 = 'DFKai-SB, BiauKai, KaiTi, STKaiti, "楷体", "楷体_GB2312", serif';
const font2 = 'serif, "楷体", "楷体_GB2312", "KaiTi"';

const spec = {
  type: 'pictogram',
  width: 418.5,
  height: 500.4,
  background: {
    image: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/lisao_2.png'
  },
  padding: 0,
  data: {
    id: 'data',
    values: data
  },
  seriesField: 'category',
  nameField: 'name',
  valueField: 'value',
  svg: 'lisao',
  pictogram: {
    style: {
      cornerRadius: 10,
      fillOpacity: 0,
      stroke: 'red',
      cursor: 'zoom-in'
    },
    state: {
      legend_hover: {
        fillOpacity: 0.4,
        cornerRadius: 0
      },
      legend_hover_reverse: {
        fillOpacity: 1,
        cornerRadius: 0,
        fill: 'white'
      },
      hover: {
        fillOpacity: 0.4,
        lineWidth: 2
      }
    }
  },
  legends: {
    orient: 'right',
    filter: false,
    layoutType: 'absolute',
    top: 5,
    right: 45,
    background: {
      visible: true,
      style: {
        padding: 1,
        fill: '#009A00',
        fillOpacity: 0.2
      }
    },
    data: items => {
      return items.map(item => {
        item.label = item.label.split('');
        return item;
      });
    },
    item: {
      shape: {
        visible: false
      },
      label: {
        style: {
          fill: 'black',
          fontSize: 11
        },
        state: {
          unSelected: {
            fill: 'black'
          }
        }
      }
    }
  },
  title: {
    text: ['离', '骚'],
    orient: 'right',
    layoutType: 'absolute',
    top: 196,
    right: 0,
    textStyle: {
      fill: '#fff',
      fontSize: 34,
      fontFamily: font2,
      stroke: '#228822',
      strokeOpacity: 1,
      lineWidth: 2
    }
  },
  tooltip: {
    enterable: true,
    updateElement: (tooltipElement, actualTooltip, params) => {
      if (!params.changePositionOnly) {
        window.handleTooltipLoad = () => {
          const datum = params.datum.data;
          const iframe = document.getElementById('lisao-tooltip');
          const iframeDoc = iframe.contentWindow.document;
          iframeDoc.body.innerHTML = `
    <style>
      html{
        font-family: ${font2};
      }
      body{
        margin: 0;
      }
      article{
        background-color: #F5EBD4;
        padding: 1em 0.5em;
        border-left: 10px solid #405C53;
        border-right: 10px solid #405C53;
        margin: 0 15px;
      }
      p{
        margin: 0;
        padding: 0.2em 0;
        color: #2C402E;
        line-height: 150%;
        text-indent: 2em;
      }
      h1{
        margin: 8px 0;
        text-align: center;
        font-family: ${font1};
        font-size: 32;
        span {
          font-family: ${font2};
          font-size: 18;
        }
        a {
          text-align: center;
          font-size: 14;
          color: #a57f27;
        }
      }
      .reel{
        position: sticky;
        top: 0px;
      }
      .reel-bottom{
        position: sticky;
        bottom: 0px;
      }
      .reel, .reel-bottom {
        height: 28px;
        margin: 0 15px;
        border-radius: 1px;
        border-image: url("https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/lisao_juanzhou.png") fill 40 36/14px 12px/0 12px;
        box-shadow: 0 -5px 10px 5px rgba(0,0,0,.3);
        overflow: hidden;
      }
      .reel-bg{
        position: absolute;
        left: 0;
        width: 100%;
        height: 368px;
        background: url("https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/lisao_juanzhou_bg.jpg") 50% 0/auto 50%;
        mix-blend-mode: multiply;
      }
      @supports (animation-timeline: scroll()) {
        .reel-bg{
          --s: 999999;
          animation: scroll 1s linear forwards calc(var(--s)/184/3.14);
          animation-timeline: scroll(root);
          animation-range: 0 calc(var(--s) * 1px);
        }
      }
      @keyframes scroll {
        0%{
          transform: translateY(-80%);
        }
        100% {
          transform: translateY(-30%);
        }
      }
      ::-webkit-scrollbar{
        display: none;
      }
    </style>
    <div class="reel" style="--p: 5">
      <div class="reel-bg"></div>
    </div>
    <article>
      ${
        datum.value
          ? `<h1 id="title">${datum.value}${
              datum.pinyin ? `<span>（${datum.pinyin}）</span>` : ''
            }<br/><a href="https://hanyu.baidu.com/hanyu-page/zici/s?wd=${datum.value}" target="_blank">字意</a></h1>`
          : ''
      }
      <p id="content"><b>文本：</b><span id="content-span">${datum.segment}</span></p>
      ${
        datum.description
          ? `<p id="description"><b>释意：</b><span id="description-span">${datum.description}</span></p>`
          : ''
      }
    </article>
    <div class="reel-bottom" style="--p: 5">
      <div class="reel-bg"></div>
    </div>
    <script>
      if (!CSS.supports('animation-timeline: scroll()')){
        console.log('不支持 animation-timeline')
        const bg = document.querySelector('.reel-bg')
        window.addEventListener('scroll',function(){
          bg.style.transform = 'translateY(' + this.scrollY / Math.PI % 184 / 368 * 100 - 80 + '%)'
        })
      }
    </script>`;
        };

        tooltipElement.innerHTML = `<iframe
        id="lisao-tooltip"
        style="border: none; width: 100%; height: 100%"
        onload="handleTooltipLoad()"
        ></iframe>`;
        tooltipElement.style.boxShadow = 'none';
        tooltipElement.style.background = 'none';
        tooltipElement.style.width = '250px';
        tooltipElement.style.height = '250px';
      }
    }
  }
};

VChart.registerSVG('lisao', shape);

const vchart = new VChart(spec, { dom: CONTAINER_ID });

// 监听图例项悬停事件
vchart.on('legendItemHover', e => {
  // 获取悬停的图例项名称
  const hoveredName = e?.value?.data?.label.join('');
  if (hoveredName) {
    // 更新图表状态，将未悬停的图例项颜色设置为灰色
    vchart.updateState({
      legend_hover: {
        filter: d => {
          // 查找当前数据项的类别
          const category = data.find(datum => datum.name === d.data?.name)?.category;
          // 如果类别存在且等于悬停的图例项名称，则返回 true，否则返回 false
          return category && category === hoveredName;
        }
      },
      legend_hover_reverse: {
        filter: d => {
          // 查找当前数据项的类别
          const category = data.find(datum => datum.name === d.data?.name)?.category;
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
    legend_hover: {
      filter: d => false
    },
    legend_hover_reverse: {
      filter: d => false
    }
  });
});

vchart.on('click', e => {
  const datum = e.datum?.data;
  if (datum?.p) {
    if (datum.value) {
      window.open(
        `https://www.shidianguji.com/book/SBCK111/chapter/SBCK111_3?paragraphId=${datum.p}&keywords=${datum.value}&hightlightIndex=0&contentMatch=1`,
        '_blank'
      );
    } else {
      window.open(
        `https://www.shidianguji.com/book/SBCK111/chapter/SBCK111_3?paragraphId=${datum.p}&hightlightIndex=0&contentMatch=1`,
        '_blank'
      );
    }
  }
});

vchart.renderSync();

// 控制台调试用，实际部署时删除
window['vchart'] = vchart;
```

## 相关教程

[象形图](link)
