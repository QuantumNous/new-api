---
category: examples
group: extension chart
title: sequence-scatter-link-neighborhood
keywords: extension, relationship
order:
cover: /vchart/preview/extension-chart-sequence-scatter-link-neighborhood.gif
option: extensionChart
---

# sequence-scatter-link-neighborhood

- Temporal Sequence
  A deep learning training process consists of multiple training epochs. The predictions of the same data sample may vary across different epochs. Therefore, the predictions of all data in a specific epoch can be viewed as a "frame" in an animation. To display different frames in the same chart, we utilize the player component in vchart to automatically update epoch data, showcasing the progression of the training process over time.
- Scatter Plot
  To visualize the prediction results (in coordinate form) of each training data sample in the current epoch, it's natural to use a scatter plot where each data sample corresponds to a point in the chart. In addition to 2D coordinates, points can have other attributes, such as:
- Color: Can correspond to sample labels, with different labels having different colors;
- Opacity: Can correspond to the prediction confidence of samples, with higher confidence resulting in lower opacity;
- Size: Can distinguish selected points, with hovered or selected points enlarged;
- ......

For more implementation details, see: https://uvwoh700cpq.feishu.cn/docx/AULUdfgPJopMoMxP64RcuGo7nzh?from=from_copylink

## Key option

- `type: sequenceScatterLink` 指定图表类型为散点关系图

## Live Demo

```javascript livedemo
/** --Add the following code when using in production-- */
// When using in production, please additionally depend on @visactor/vchart-extension, keeping the package version consistent with vchart
// import { registerConversionFunnelChart } from '@visactor/vchart-extension';
/** --Add the above code when using in production-- */

/** --Delete the following code when using in production-- */
const { registerSequenceScatterLink } = VChartExtension;
/** --Delete the above code when using in production-- */

/**
 * Demo for classification task
 */
const TASK_TYPE = 'neighborhood';

/**
 * getChartData
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
 * Get basic settings including canvas scope, labels, label text and label colors
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
 * Construct chart data including nodes and edges
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
 * Select edges based on given x and y coordinates, return all edges related to the point, and construct edge endpoints for drawing lines
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
 * create sequence-scatter spec
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
 * Register mouse hover event to draw adjacent edges of the node
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
