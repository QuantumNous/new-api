---
category: examples
group: extension chart
title: 时序散点关系图-支持交互邻域
keywords: extension, relationship
order:
cover: /vchart/preview/extension-chart-sequence-scatter-link-neighborhood.gif
option: extensionChart
---

# 时序散点关系图-支持交互邻域

- 时序性
  一个深度学习训练过程会包括若干个训练轮次，同一个数据样本在不同训练轮次模型下的预测可能是不同的，因此，所有数据在某个训练轮次模型下的预测结果可以看作是一个动画中的“一帧”。为了能在同一个图表中展示不同的帧，我们需要用到vchart中player组件，用来自动更新轮次数据，以展示训练过程在时间上的推进。
- 散点图
  为了展示每个训练数据样本在当前轮次下的预测结果（坐标的形式），自然地想到使用散点图，一个数据样本对应图中的一个点。除了二维坐标外，点还应该具有一些其他属性，例如：
- 颜色：可以对应样本标签，不同的标签具有不同的颜色；
- 透明度： 可以对应样本的预测置信度，置信度越大透明度越低；
- 大小：可以区分是否选中，hover或selected的点放大；
- ......

更多实现见: https://uvwoh700cpq.feishu.cn/docx/AULUdfgPJopMoMxP64RcuGo7nzh?from=from_copylink

## 关键配置

- `type: sequenceScatterLink` 指定图表类型为散点关系图

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外依赖 @visactor/vchart-extension，包版本保持和vchart一致
// import { registerConversionFunnelChart } from '@visactor/vchart-extension';
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
const { registerSequenceScatterLink } = VChartExtension;
/** --在业务中使用时请删除以上代码-- */

/**
 * 展示分类任务的Demo
 */
const TASK_TYPE = 'neighborhood';

/**
 * 获取图表数据
 */
const { chartData, scope, label_color_dict } = await getSeqScatterChartData(TASK_TYPE);

/**
 * utils
 */
async function getSeqScatterChartData(task_type) {
  // get basic settings
  const { scope, label_index, label_text, label_color_dict } = await getBasicSettings(task_type);

  // construct chart data
  const chartData = await constructChartData(task_type, label_index, label_text, label_color_dict);

  return { chartData, scope, label_color_dict };
}

/**
 * 获取基本设置，包括画布范围、标签、标签文本和标签颜色
 */
async function getBasicSettings(task_type) {
  const response1 = await fetch(
    'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/sequence-scatter/Training_process1/info.json'
  );
  const trainingInfo1 = await response1.json();

  const response2 = await fetch(
    'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/sequence-scatter/Training_process2/info.json'
  );
  const trainingInfo2 = await response2.json();

  const training_info = task_type === 'neighborhood' ? trainingInfo1 : trainingInfo2;
  const scope = task_type === 'neighborhood' ? [-9, -9, 6, 6] : [-8, -8, 8, 8];

  const label_index = training_info['label_index'];
  const label_text = training_info['label_text'];
  const label_color_list = training_info['label_color'];
  const label_color_dict = {}; // text -> rgb

  for (let i = 0; i < label_color_list.length; i++) {
    const c = label_color_list[i];
    label_color_dict[label_text[i]] = `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  return { scope, label_index, label_text, label_color_dict };
}

/**
 * 构造图表数据，包括节点和边
 */
async function constructChartData(task_type, label_index, label_text, label_color_dict) {
  const response1 = await fetch(
    'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/sequence-scatter/Training_process1/data.json'
  );
  const trainingData1 = await response1.json();

  const response2 = await fetch(
    'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/sequence-scatter/Training_process2/data.json'
  );
  const trainingData2 = await response2.json();

  const original_data = task_type === 'neighborhood' ? trainingData1 : trainingData2;
  const chartData = {};

  Object.keys(original_data).forEach(epoch => {
    chartData[epoch] = {
      nodes: [],
      edges: []
    };

    // fill in nodes
    original_data[epoch].projection.forEach((pos, id) => {
      let conf = 1;
      let pred = label_text[label_index[id]];
      if (task_type === 'classification') {
        conf = original_data[epoch].confidence[id];
        pred = label_text[original_data[epoch].prediction[id]];
      }

      chartData[epoch].nodes.push({
        id: id, // unique identification of a point
        x: pos[0],
        y: pos[1],
        label: label_text[label_index[id]],
        prediction: pred,
        confidence: conf
      });
    });

    // fill in edges
    let intra_similarity, inter_similarity;
    if (task_type === 'neighborhood') {
      intra_similarity = original_data[epoch].intra_similarity;
      inter_similarity = original_data[epoch].inter_similarity;

      let i = 0;
      original_data[epoch].projection.forEach((pos, id) => {
        intra_similarity[id].forEach(neighbor => {
          chartData[epoch].edges.push({
            id: i, // unique identification of an edge
            x0: pos[0],
            y0: pos[1],
            x1: original_data[epoch].projection[neighbor][0],
            y1: original_data[epoch].projection[neighbor][1],
            type: 'same_type',
            color: label_color_dict[label_text[label_index[id]]]
          });
          i++;
        });
        inter_similarity[id].forEach(neighbor => {
          chartData[epoch].edges.push({
            id: i, // unique identification of an edge
            x0: pos[0],
            y0: pos[1],
            x1: original_data[epoch].projection[neighbor][0],
            y1: original_data[epoch].projection[neighbor][1],
            type: 'cross_type',
            color: label_color_dict[label_text[label_index[neighbor]]]
          });
          i++;
        });
      });
    }
  });

  return chartData;
}

/**
 * 选择边，根据给定的x和y坐标，返回所有与该点相关的边，构造边的端点用于绘制线段
 */
function selectEdges(chartData, x, y) {
  const endpoints = [];
  Object.keys(chartData).forEach(iter => {
    const edges = chartData[iter].edges;
    edges.forEach(edge => {
      if (x === edge.x0 && y === edge.y0) {
        endpoints.push({ edgeId: edge.id, x: edge.x0, y: edge.y0, type: edge.type, color: edge.color });
        endpoints.push({ edgeId: edge.id, x: edge.x1, y: edge.y1, type: edge.type, color: edge.color });
      }
    });
  });
  return endpoints;
}

/**
 * 创建sequence-scatter的特有配置项
 */
const spec = {
  type: 'sequenceScatterLink',
  taskType: TASK_TYPE,
  labelColor: label_color_dict,
  scope: scope,
  data: chartData,
  xField: 'x',
  yField: 'y',

  infoLabel: {
    visible: true,
    style: {
      text: datum => {
        return 'iteration: ' + datum.iter;
      }
    }
  },
  player: {
    orient: 'bottom',
    auto: true,
    interval: 2000,
    duration: 2000
  }
};

registerSequenceScatterLink();
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

/**
 * 注册鼠标悬浮事件，绘制该节点的邻接边
 */
vchart.on('pointerover', { id: 'scatter-series' }, e => {
  const endpoints = selectEdges(spec.data, e.datum?.x, e.datum?.y);
  vchart.updateDataSync('endpoints', endpoints);
});
vchart.on('pointerout', { id: 'scatter-series' }, () => {
  vchart.updateDataSync('endpoints', []);
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[时序散点关系图](link)
