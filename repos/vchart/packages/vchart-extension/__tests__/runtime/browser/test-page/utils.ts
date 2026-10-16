import trainingData1 from '../data/sequence-scatter/Training_process1/data.json';
import trainingInfo1 from '../data/sequence-scatter/Training_process1/info.json';
import trainingData2 from '../data/sequence-scatter/Training_process2/data.json';
import trainingInfo2 from '../data/sequence-scatter/Training_process2/info.json';
import type {
  ISequenceScatterLinkData,
  OriginalData,
  TrainingInfo,
  Endpoint
} from '../../../../src/charts/sequence-scatter-link/interface';

export function getSeqScatterChartData(task_type: string) {
  // get basic settings
  const { scope, label_index, label_text, label_color_dict } = getBasicSettings(task_type);

  // construct chart data
  const chartData = constructChartData(task_type, label_index, label_text, label_color_dict);

  return { chartData, scope, label_color_dict };
}

/**
 * 获取基本设置，包括画布范围、标签、标签文本和标签颜色
 */
function getBasicSettings(task_type: string) {
  const training_info: TrainingInfo = task_type === 'neighborhood' ? trainingInfo1 : trainingInfo2;
  const scope = task_type === 'neighborhood' ? [-9, -9, 6, 6] : [-8, -8, 8, 8];

  const label_index = training_info.label_index;
  const label_text = training_info.label_text;
  const label_color_list = training_info.label_color;
  const label_color_dict: { [key: string]: string } = {}; // text -> rgb

  for (let i = 0; i < label_color_list.length; i++) {
    const c = label_color_list[i];
    label_color_dict[label_text[i]] = `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  return { scope, label_index, label_text, label_color_dict };
}

/**
 * 构造图表数据，包括节点和边
 */
function constructChartData(
  task_type: string,
  label_index: number[],
  label_text: string[],
  label_color_dict: { [key: string]: string }
) {
  const original_data: OriginalData = task_type === 'neighborhood' ? trainingData1 : (trainingData2 as OriginalData);
  const chartData: ISequenceScatterLinkData = {};

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
    let intra_similarity: number[][];
    let inter_similarity: number[][];
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
export function selectEdges(chartData: ISequenceScatterLinkData, x: number, y: number) {
  const endpoints: Endpoint[] = [];
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
