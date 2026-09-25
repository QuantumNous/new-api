# 矩形树图

[\[配置项\]](../../../option/treemapChart)

## 简介

矩形树图，是一个由不同大小的嵌套式矩形来显示树状结构数据的统计图表。在矩形树图中，父子层级由矩形的嵌套表示。在同一层级中，所有矩形依次无间隙排布，他们的面积之和代表了整体的大小。单个矩形面积由其在同一层级的占比决定

矩形树图需要树形结构 ( 至少有一个父级节点 )数据，且子节点需要有权重，对于不带权重的树形结构数据，应用树形结构图或径向树图来表示。

## 图表构成

矩形树图主要由表现层级结构的矩形图元、提示信息及其他组件构成。  
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/364e85f0a2e6efbc39057a000.png)

矩形图元为矩形树图的基本要素，相关的绘制配置必不可少:

- `treemapChart.type`: 图表类型，柱状体 / 条形图的类型为`'treemap'`
- `treemapChart.data`: 图表绘制的数据源
- `treemapChart.categoryField`: 数值字段，映射不同图元
- `treemapChart.valueField`: 节点权重字段，映射图元的大小

提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `treemapChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/treemapChart#tooltip)
- 更多组件配置见[VChart treemapChart 配置](../../../option/treemapChart)

## 快速上手

```javascript livedemo
const spec = {
  type: 'treemap',
  data: [
    {
      id: 'data',
      values: [
        {
          name: 'query',
          children: [
            {
              name: 'methods',
              children: [
                { name: 'add', value: 593 },
                { name: 'and', value: 330 },
                { name: 'average', value: 287 },
                { name: 'count', value: 277 },
                { name: 'distinct', value: 292 },
                { name: 'div', value: 595 },
                { name: 'eq', value: 594 },
                { name: 'fn', value: 460 },
                { name: 'gt', value: 603 },
                { name: 'gte', value: 625 },
                { name: 'iff', value: 748 },
                { name: 'isa', value: 461 },
                { name: 'lt', value: 597 },
                { name: 'lte', value: 619 },
                { name: 'max', value: 283 },
                { name: 'min', value: 283 },
                { name: 'mod', value: 591 },
                { name: 'mul', value: 603 },
                { name: 'neq', value: 599 },
                { name: 'not', value: 386 },
                { name: 'or', value: 323 },
                { name: 'orderby', value: 307 },
                { name: 'range', value: 772 },
                { name: 'select', value: 296 },
                { name: 'stddev', value: 363 },
                { name: 'sub', value: 600 },
                { name: 'sum', value: 280 },
                { name: 'update', value: 307 },
                { name: 'variance', value: 335 },
                { name: 'where', value: 299 },
                { name: 'xor', value: 354 },
                { name: '_', value: 264 }
              ]
            },
            { name: 'AggregateExpression', value: 1616 },
            { name: 'And', value: 1027 },
            { name: 'Arithmetic', value: 3891 },
            { name: 'Average', value: 891 },
            { name: 'BinaryExpression', value: 2893 },
            { name: 'Comparison', value: 5103 },
            { name: 'CompositeExpression', value: 3677 },
            { name: 'Count', value: 781 },
            { name: 'DateUtil', value: 4141 },
            { name: 'Distinct', value: 933 },
            { name: 'Expression', value: 5130 },
            { name: 'ExpressionIterator', value: 3617 },
            { name: 'Fn', value: 3240 },
            { name: 'If', value: 2732 },
            { name: 'IsA', value: 2039 },
            { name: 'Literal', value: 1214 },
            { name: 'Match', value: 3748 },
            { name: 'Maximum', value: 843 },
            { name: 'Minimum', value: 843 },
            { name: 'Not', value: 1554 },
            { name: 'Or', value: 970 },
            { name: 'Query', value: 13896 },
            { name: 'Range', value: 1594 },
            { name: 'StringUtil', value: 4130 },
            { name: 'Sum', value: 791 },
            { name: 'Variable', value: 1124 },
            { name: 'Variance', value: 1876 },
            { name: 'Xor', value: 1101 }
          ]
        },
        {
          name: 'util',
          children: [
            {
              name: 'palette',
              children: [
                { name: 'ColorPalette', value: 6367 },
                { name: 'Palette', value: 1229 },
                { name: 'ShapePalette', value: 2059 },
                { name: 'valuePalette', value: 2291 }
              ]
            },
            {
              name: 'math',
              children: [
                { name: 'DenseMatrix', value: 3165 },
                { name: 'IMatrix', value: 2815 },
                { name: 'SparseMatrix', value: 3366 }
              ]
            },
            {
              name: 'heap',
              children: [
                { name: 'FibonacciHeap', value: 9354 },
                { name: 'HeapNode', value: 1233 }
              ]
            },
            { name: 'Arrays', value: 8258 },
            { name: 'Colors', value: 10001 },
            { name: 'Dates', value: 8217 },
            { name: 'Displays', value: 12555 },
            { name: 'Filter', value: 2324 },
            { name: 'Geometry', value: 10993 },
            { name: 'IEvaluable', value: 335 },
            { name: 'IPredicate', value: 383 },
            { name: 'IValueProxy', value: 874 },
            { name: 'Maths', value: 17705 },
            { name: 'Orientation', value: 1486 },
            { name: 'Property', value: 5559 },
            { name: 'Shapes', value: 19118 },
            { name: 'Sort', value: 6887 },
            { name: 'Stats', value: 6557 },
            { name: 'Strings', value: 22026 }
          ]
        },
        {
          name: 'animate',
          children: [
            {
              name: 'interpolate',
              children: [
                { name: 'ArrayInterpolator', value: 1983 },
                { name: 'ColorInterpolator', value: 2047 },
                { name: 'DateInterpolator', value: 1375 },
                { name: 'Interpolator', value: 8746 },
                { name: 'MatrixInterpolator', value: 2202 },
                { name: 'NumberInterpolator', value: 1382 },
                { name: 'ObjectInterpolator', value: 1629 },
                { name: 'PointInterpolator', value: 1675 },
                { name: 'RectangleInterpolator', value: 2042 }
              ]
            },
            { name: 'Easing', value: 17010 },
            { name: 'FunctionSequence', value: 5842 },
            { name: 'ISchedulable', value: 1041 },
            { name: 'Parallel', value: 5176 },
            { name: 'Pause', value: 449 },
            { name: 'Scheduler', value: 5593 },
            { name: 'Sequence', value: 5534 },
            { name: 'Transition', value: 9201 },
            { name: 'Transitioner', value: 19975 },
            { name: 'TransitionEvent', value: 1116 },
            { name: 'Tween', value: 6006 }
          ]
        },
        {
          name: 'scale',
          children: [
            { name: 'IScaleMap', value: 2105 },
            { name: 'LinearScale', value: 1316 },
            { name: 'LogScale', value: 3151 },
            { name: 'OrdinalScale', value: 3770 },
            { name: 'QuantileScale', value: 2435 },
            { name: 'QuantitativeScale', value: 4839 },
            { name: 'RootScale', value: 1756 },
            { name: 'Scale', value: 4268 },
            { name: 'ScaleType', value: 1821 },
            { name: 'TimeScale', value: 5833 }
          ]
        },
        {
          name: 'physics',
          children: [
            { name: 'DragForce', value: 1082 },
            { name: 'GravityForce', value: 1336 },
            { name: 'IForce', value: 319 },
            { name: 'NBodyForce', value: 10498 },
            { name: 'Particle', value: 2822 },
            { name: 'Simulation', value: 9983 },
            { name: 'Spring', value: 2213 },
            { name: 'SpringForce', value: 1681 }
          ]
        },
        {
          name: 'data',
          children: [
            {
              name: 'converters',
              children: [
                { name: 'Converters', value: 721 },
                { name: 'DelimitedTextConverter', value: 4294 },
                { name: 'GraphMLConverter', value: 9800 },
                { name: 'IDataConverter', value: 1314 },
                { name: 'JSONConverter', value: 2220 }
              ]
            },
            { name: 'DataField', value: 1759 },
            { name: 'DataSchema', value: 2165 },
            { name: 'DataSet', value: 586 },
            { name: 'DataSource', value: 3331 },
            { name: 'DataTable', value: 772 },
            { name: 'DataUtil', value: 3322 }
          ]
        },
        {
          name: 'vis',
          children: [
            {
              name: 'controls',
              children: [
                { name: 'AnchorControl', value: 2138 },
                { name: 'ClickControl', value: 3824 },
                { name: 'Control', value: 1353 },
                { name: 'ControlList', value: 4665 },
                { name: 'DragControl', value: 2649 },
                { name: 'ExpandControl', value: 2832 },
                { name: 'HoverControl', value: 4896 },
                { name: 'IControl', value: 763 },
                { name: 'PanZoomControl', value: 5222 },
                { name: 'SelectionControl', value: 7862 },
                { name: 'TooltipControl', value: 8435 }
              ]
            },
            {
              name: 'operator',
              children: [
                {
                  name: 'layout',
                  children: [
                    { name: 'AxisLayout', value: 6725 },
                    { name: 'BundledEdgeRouter', value: 3727 },
                    { name: 'CircleLayout', value: 9317 },
                    { name: 'CirclePackingLayout', value: 12003 },
                    { name: 'DendrogramLayout', value: 4853 },
                    { name: 'ForceDirectedLayout', value: 8411 },
                    { name: 'IcicleTreeLayout', value: 4864 },
                    { name: 'IndentedTreeLayout', value: 3174 },
                    { name: 'Layout', value: 7881 },
                    { name: 'NodeLinkTreeLayout', value: 12870 },
                    { name: 'PieLayout', value: 2728 },
                    { name: 'RadialTreeLayout', value: 12348 },
                    { name: 'RandomLayout', value: 870 },
                    { name: 'StackedAreaLayout', value: 9121 },
                    { name: 'TreeMapLayout', value: 9191 }
                  ]
                },
                {
                  name: 'encoder',
                  children: [
                    { name: 'ColorEncoder', value: 3179 },
                    { name: 'Encoder', value: 4060 },
                    { name: 'PropertyEncoder', value: 4138 },
                    { name: 'ShapeEncoder', value: 1690 },
                    { name: 'valueEncoder', value: 1830 }
                  ]
                },
                {
                  name: 'distortion',
                  children: [
                    { name: 'BifocalDistortion', value: 4461 },
                    { name: 'Distortion', value: 6314 },
                    { name: 'FisheyeDistortion', value: 3444 }
                  ]
                },
                {
                  name: 'filter',
                  children: [
                    { name: 'FisheyeTreeFilter', value: 5219 },
                    { name: 'GraphDistanceFilter', value: 3165 },
                    { name: 'VisibilityFilter', value: 3509 }
                  ]
                },
                {
                  name: 'label',
                  children: [
                    { name: 'Labeler', value: 9956 },
                    { name: 'RadialLabeler', value: 3899 },
                    { name: 'StackedAreaLabeler', value: 3202 }
                  ]
                },
                { name: 'IOperator', value: 1286 },
                { name: 'Operator', value: 2490 },
                { name: 'OperatorList', value: 5248 },
                { name: 'OperatorSequence', value: 4190 },
                { name: 'OperatorSwitch', value: 2581 },
                { name: 'SortOperator', value: 2023 }
              ]
            },
            {
              name: 'data',
              children: [
                {
                  name: 'render',
                  children: [
                    { name: 'ArrowType', value: 698 },
                    { name: 'EdgeRenderer', value: 5569 },
                    { name: 'IRenderer', value: 353 },
                    { name: 'ShapeRenderer', value: 2247 }
                  ]
                },
                { name: 'Data', value: 20544 },
                { name: 'DataList', value: 19788 },
                { name: 'DataSprite', value: 10349 },
                { name: 'EdgeSprite', value: 3301 },
                { name: 'NodeSprite', value: 19382 },
                { name: 'ScaleBinding', value: 11275 },
                { name: 'Tree', value: 7147 },
                { name: 'TreeBuilder', value: 9930 }
              ]
            },
            {
              name: 'axis',
              children: [
                { name: 'Axes', value: 1302 },
                { name: 'Axis', value: 24593 },
                { name: 'AxisGridLine', value: 652 },
                { name: 'AxisLabel', value: 636 },
                { name: 'CartesianAxes', value: 6703 }
              ]
            },
            {
              name: 'events',
              children: [
                { name: 'DataEvent', value: 2313 },
                { name: 'SelectionEvent', value: 1880 },
                { name: 'TooltipEvent', value: 1701 },
                { name: 'VisualizationEvent', value: 1117 }
              ]
            },
            {
              name: 'legend',
              children: [
                { name: 'Legend', value: 20859 },
                { name: 'LegendItem', value: 4614 },
                { name: 'LegendRange', value: 10530 }
              ]
            },
            { name: 'Visualization', value: 16540 }
          ]
        },
        {
          name: 'display',
          children: [
            { name: 'DirtySprite', value: 8833 },
            { name: 'LineSprite', value: 1732 },
            { name: 'RectSprite', value: 3623 },
            { name: 'TextSprite', value: 10066 }
          ]
        },
        {
          name: 'analytics',
          children: [
            {
              name: 'graph',
              children: [
                { name: 'BetweennessCentrality', value: 3534 },
                { name: 'LinkDistance', value: 5731 },
                { name: 'MaxFlowMinCut', value: 7840 },
                { name: 'ShortestPaths', value: 5914 },
                { name: 'SpanningTree', value: 3416 }
              ]
            },
            {
              name: 'cluster',
              children: [
                { name: 'AgglomerativeCluster', value: 3938 },
                { name: 'CommunityStructure', value: 3812 },
                { name: 'HierarchicalCluster', value: 6714 },
                { name: 'MergeEdge', value: 743 }
              ]
            },
            {
              name: 'optimization',
              children: [{ name: 'AspectRatioBanker', value: 7074 }]
            }
          ]
        },
        { name: 'flex', children: [{ name: 'FlareVis', value: 4116 }] }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  aspectRatio: 1,
  label: {
    visible: true,
    style: {
      fontSize: 12
    }
  },
  title: {
    visible: true,
    text: 'The software class hierarchy of the Flare visualization toolkit'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 关键配置

- `categoryField` 属性声明为分类字段，字段值通常为节点名称
- `valueField` 属性声明为数值字段，字段值通常为节点权重

## 矩形树图特性

### 数据

在矩形树图中，数据通常通常为具有层级结构，形式如下:

```ts
data: [
  {
    name: 'area',
    values: [
      {
        name: 'A',
        children: [
          { name: 'A-a', value: 1 },
          { name: 'A-b', value: 2 }
        ]
      },
      {
        name: 'B',
        children: [
          { name: 'B-a', value: 3 },
          { name: 'B-b', value: 4 }
        ]
      }
    ]
  }
];
```

### 图表布局

#### 矩形分割

1. 分割方式
   树图的算法本质是对矩形区域进行分割，并在分割后的细分区域进行再一次分割，直到得到最小区域。
   在 VChart 中，可以通过`treeMapChart.splitType: 'binary' | 'dice' | 'slice' | 'sliceDice' | 'squarify'`进行分割方式的指定，默认值为`'binary'`。

- `'binary'`: 递归地将指定的节点分割成一个近似平衡的二叉树，对宽的矩形选择水平分割，对高的矩形选择垂直分割。
- `'dice'`: 根据指定节点的每个子节点的值水平划分由 x0, y0, x1, y1 指定的矩形区域。子节点按顺序定位，从给定矩形的左边缘（x0）开始。如果子节点的值之和小于指定节点的值（即，如果指定节点有一个非零的内部值），剩余的空位将被定位在给定矩形的右边缘（x1）。
- `'slice'`: 和`'dice'`类似，方向为竖直方向分割。
- `'sliceDice'`: 节点奇数深度，用`'slice'`；节点偶数深度，用'dice'。
- `'squarify'`: 尽可能按照一个特定长宽比的分割矩形。

2. 分割比例
   使用`treemapChart.aspectRatio`可以配置每次分割的比例，默认值`(1 + Math.sqrt(5)) / 2`，约为 1.618

```javascript livedemo
const spec = {
  type: 'treemap',
  data: [
    {
      id: 'data',
      values: [
        {
          name: 'query',
          children: [
            {
              name: 'methods',
              children: [
                { name: 'add', value: 593 },
                { name: 'and', value: 330 },
                { name: 'average', value: 287 },
                { name: 'count', value: 277 },
                { name: 'distinct', value: 292 },
                { name: 'div', value: 595 },
                { name: 'eq', value: 594 },
                { name: 'fn', value: 460 },
                { name: 'gt', value: 603 },
                { name: 'gte', value: 625 },
                { name: 'iff', value: 748 },
                { name: 'isa', value: 461 },
                { name: 'lt', value: 597 },
                { name: 'lte', value: 619 },
                { name: 'max', value: 283 },
                { name: 'min', value: 283 },
                { name: 'mod', value: 591 },
                { name: 'mul', value: 603 },
                { name: 'neq', value: 599 },
                { name: 'not', value: 386 },
                { name: 'or', value: 323 },
                { name: 'orderby', value: 307 },
                { name: 'range', value: 772 },
                { name: 'select', value: 296 },
                { name: 'stddev', value: 363 },
                { name: 'sub', value: 600 },
                { name: 'sum', value: 280 },
                { name: 'update', value: 307 },
                { name: 'variance', value: 335 },
                { name: 'where', value: 299 },
                { name: 'xor', value: 354 },
                { name: '_', value: 264 }
              ]
            },
            { name: 'AggregateExpression', value: 1616 },
            { name: 'And', value: 1027 },
            { name: 'Arithmetic', value: 3891 },
            { name: 'Average', value: 891 },
            { name: 'BinaryExpression', value: 2893 },
            { name: 'Comparison', value: 5103 },
            { name: 'CompositeExpression', value: 3677 },
            { name: 'Count', value: 781 },
            { name: 'DateUtil', value: 4141 },
            { name: 'Distinct', value: 933 },
            { name: 'Expression', value: 5130 },
            { name: 'ExpressionIterator', value: 3617 },
            { name: 'Fn', value: 3240 },
            { name: 'If', value: 2732 },
            { name: 'IsA', value: 2039 },
            { name: 'Literal', value: 1214 },
            { name: 'Match', value: 3748 },
            { name: 'Maximum', value: 843 },
            { name: 'Minimum', value: 843 },
            { name: 'Not', value: 1554 },
            { name: 'Or', value: 970 },
            { name: 'Query', value: 13896 },
            { name: 'Range', value: 1594 },
            { name: 'StringUtil', value: 4130 },
            { name: 'Sum', value: 791 },
            { name: 'Variable', value: 1124 },
            { name: 'Variance', value: 1876 },
            { name: 'Xor', value: 1101 }
          ]
        },
        {
          name: 'util',
          children: [
            {
              name: 'palette',
              children: [
                { name: 'ColorPalette', value: 6367 },
                { name: 'Palette', value: 1229 },
                { name: 'ShapePalette', value: 2059 },
                { name: 'valuePalette', value: 2291 }
              ]
            },
            {
              name: 'math',
              children: [
                { name: 'DenseMatrix', value: 3165 },
                { name: 'IMatrix', value: 2815 },
                { name: 'SparseMatrix', value: 3366 }
              ]
            },
            {
              name: 'heap',
              children: [
                { name: 'FibonacciHeap', value: 9354 },
                { name: 'HeapNode', value: 1233 }
              ]
            },
            { name: 'Arrays', value: 8258 },
            { name: 'Colors', value: 10001 },
            { name: 'Dates', value: 8217 },
            { name: 'Displays', value: 12555 },
            { name: 'Filter', value: 2324 },
            { name: 'Geometry', value: 10993 },
            { name: 'IEvaluable', value: 335 },
            { name: 'IPredicate', value: 383 },
            { name: 'IValueProxy', value: 874 },
            { name: 'Maths', value: 17705 },
            { name: 'Orientation', value: 1486 },
            { name: 'Property', value: 5559 },
            { name: 'Shapes', value: 19118 },
            { name: 'Sort', value: 6887 },
            { name: 'Stats', value: 6557 },
            { name: 'Strings', value: 22026 }
          ]
        },
        {
          name: 'animate',
          children: [
            {
              name: 'interpolate',
              children: [
                { name: 'ArrayInterpolator', value: 1983 },
                { name: 'ColorInterpolator', value: 2047 },
                { name: 'DateInterpolator', value: 1375 },
                { name: 'Interpolator', value: 8746 },
                { name: 'MatrixInterpolator', value: 2202 },
                { name: 'NumberInterpolator', value: 1382 },
                { name: 'ObjectInterpolator', value: 1629 },
                { name: 'PointInterpolator', value: 1675 },
                { name: 'RectangleInterpolator', value: 2042 }
              ]
            },
            { name: 'Easing', value: 17010 },
            { name: 'FunctionSequence', value: 5842 },
            { name: 'ISchedulable', value: 1041 },
            { name: 'Parallel', value: 5176 },
            { name: 'Pause', value: 449 },
            { name: 'Scheduler', value: 5593 },
            { name: 'Sequence', value: 5534 },
            { name: 'Transition', value: 9201 },
            { name: 'Transitioner', value: 19975 },
            { name: 'TransitionEvent', value: 1116 },
            { name: 'Tween', value: 6006 }
          ]
        },
        {
          name: 'scale',
          children: [
            { name: 'IScaleMap', value: 2105 },
            { name: 'LinearScale', value: 1316 },
            { name: 'LogScale', value: 3151 },
            { name: 'OrdinalScale', value: 3770 },
            { name: 'QuantileScale', value: 2435 },
            { name: 'QuantitativeScale', value: 4839 },
            { name: 'RootScale', value: 1756 },
            { name: 'Scale', value: 4268 },
            { name: 'ScaleType', value: 1821 },
            { name: 'TimeScale', value: 5833 }
          ]
        },
        {
          name: 'physics',
          children: [
            { name: 'DragForce', value: 1082 },
            { name: 'GravityForce', value: 1336 },
            { name: 'IForce', value: 319 },
            { name: 'NBodyForce', value: 10498 },
            { name: 'Particle', value: 2822 },
            { name: 'Simulation', value: 9983 },
            { name: 'Spring', value: 2213 },
            { name: 'SpringForce', value: 1681 }
          ]
        },
        {
          name: 'data',
          children: [
            {
              name: 'converters',
              children: [
                { name: 'Converters', value: 721 },
                { name: 'DelimitedTextConverter', value: 4294 },
                { name: 'GraphMLConverter', value: 9800 },
                { name: 'IDataConverter', value: 1314 },
                { name: 'JSONConverter', value: 2220 }
              ]
            },
            { name: 'DataField', value: 1759 },
            { name: 'DataSchema', value: 2165 },
            { name: 'DataSet', value: 586 },
            { name: 'DataSource', value: 3331 },
            { name: 'DataTable', value: 772 },
            { name: 'DataUtil', value: 3322 }
          ]
        },
        {
          name: 'vis',
          children: [
            {
              name: 'controls',
              children: [
                { name: 'AnchorControl', value: 2138 },
                { name: 'ClickControl', value: 3824 },
                { name: 'Control', value: 1353 },
                { name: 'ControlList', value: 4665 },
                { name: 'DragControl', value: 2649 },
                { name: 'ExpandControl', value: 2832 },
                { name: 'HoverControl', value: 4896 },
                { name: 'IControl', value: 763 },
                { name: 'PanZoomControl', value: 5222 },
                { name: 'SelectionControl', value: 7862 },
                { name: 'TooltipControl', value: 8435 }
              ]
            },
            {
              name: 'operator',
              children: [
                {
                  name: 'layout',
                  children: [
                    { name: 'AxisLayout', value: 6725 },
                    { name: 'BundledEdgeRouter', value: 3727 },
                    { name: 'CircleLayout', value: 9317 },
                    { name: 'CirclePackingLayout', value: 12003 },
                    { name: 'DendrogramLayout', value: 4853 },
                    { name: 'ForceDirectedLayout', value: 8411 },
                    { name: 'IcicleTreeLayout', value: 4864 },
                    { name: 'IndentedTreeLayout', value: 3174 },
                    { name: 'Layout', value: 7881 },
                    { name: 'NodeLinkTreeLayout', value: 12870 },
                    { name: 'PieLayout', value: 2728 },
                    { name: 'RadialTreeLayout', value: 12348 },
                    { name: 'RandomLayout', value: 870 },
                    { name: 'StackedAreaLayout', value: 9121 },
                    { name: 'TreeMapLayout', value: 9191 }
                  ]
                },
                {
                  name: 'encoder',
                  children: [
                    { name: 'ColorEncoder', value: 3179 },
                    { name: 'Encoder', value: 4060 },
                    { name: 'PropertyEncoder', value: 4138 },
                    { name: 'ShapeEncoder', value: 1690 },
                    { name: 'valueEncoder', value: 1830 }
                  ]
                },
                {
                  name: 'distortion',
                  children: [
                    { name: 'BifocalDistortion', value: 4461 },
                    { name: 'Distortion', value: 6314 },
                    { name: 'FisheyeDistortion', value: 3444 }
                  ]
                },
                {
                  name: 'filter',
                  children: [
                    { name: 'FisheyeTreeFilter', value: 5219 },
                    { name: 'GraphDistanceFilter', value: 3165 },
                    { name: 'VisibilityFilter', value: 3509 }
                  ]
                },
                {
                  name: 'label',
                  children: [
                    { name: 'Labeler', value: 9956 },
                    { name: 'RadialLabeler', value: 3899 },
                    { name: 'StackedAreaLabeler', value: 3202 }
                  ]
                },
                { name: 'IOperator', value: 1286 },
                { name: 'Operator', value: 2490 },
                { name: 'OperatorList', value: 5248 },
                { name: 'OperatorSequence', value: 4190 },
                { name: 'OperatorSwitch', value: 2581 },
                { name: 'SortOperator', value: 2023 }
              ]
            },
            {
              name: 'data',
              children: [
                {
                  name: 'render',
                  children: [
                    { name: 'ArrowType', value: 698 },
                    { name: 'EdgeRenderer', value: 5569 },
                    { name: 'IRenderer', value: 353 },
                    { name: 'ShapeRenderer', value: 2247 }
                  ]
                },
                { name: 'Data', value: 20544 },
                { name: 'DataList', value: 19788 },
                { name: 'DataSprite', value: 10349 },
                { name: 'EdgeSprite', value: 3301 },
                { name: 'NodeSprite', value: 19382 },
                { name: 'ScaleBinding', value: 11275 },
                { name: 'Tree', value: 7147 },
                { name: 'TreeBuilder', value: 9930 }
              ]
            },
            {
              name: 'axis',
              children: [
                { name: 'Axes', value: 1302 },
                { name: 'Axis', value: 24593 },
                { name: 'AxisGridLine', value: 652 },
                { name: 'AxisLabel', value: 636 },
                { name: 'CartesianAxes', value: 6703 }
              ]
            },
            {
              name: 'events',
              children: [
                { name: 'DataEvent', value: 2313 },
                { name: 'SelectionEvent', value: 1880 },
                { name: 'TooltipEvent', value: 1701 },
                { name: 'VisualizationEvent', value: 1117 }
              ]
            },
            {
              name: 'legend',
              children: [
                { name: 'Legend', value: 20859 },
                { name: 'LegendItem', value: 4614 },
                { name: 'LegendRange', value: 10530 }
              ]
            },
            { name: 'Visualization', value: 16540 }
          ]
        },
        {
          name: 'display',
          children: [
            { name: 'DirtySprite', value: 8833 },
            { name: 'LineSprite', value: 1732 },
            { name: 'RectSprite', value: 3623 },
            { name: 'TextSprite', value: 10066 }
          ]
        },
        {
          name: 'analytics',
          children: [
            {
              name: 'graph',
              children: [
                { name: 'BetweennessCentrality', value: 3534 },
                { name: 'LinkDistance', value: 5731 },
                { name: 'MaxFlowMinCut', value: 7840 },
                { name: 'ShortestPaths', value: 5914 },
                { name: 'SpanningTree', value: 3416 }
              ]
            },
            {
              name: 'cluster',
              children: [
                { name: 'AgglomerativeCluster', value: 3938 },
                { name: 'CommunityStructure', value: 3812 },
                { name: 'HierarchicalCluster', value: 6714 },
                { name: 'MergeEdge', value: 743 }
              ]
            },
            {
              name: 'optimization',
              children: [{ name: 'AspectRatioBanker', value: 7074 }]
            }
          ]
        },
        { name: 'flex', children: [{ name: 'FlareVis', value: 4116 }] }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  // splitType: 'binary',
  // splitType: 'dice',
  // splitType: 'slice',
  // splitType: 'sliceDice',
  splitType: 'squarify',
  aspectRatio: 1,
  label: {
    visible: true,
    style: {
      fontSize: 12
    }
  },
  title: {
    visible: true,
    text: 'The software class hierarchy of the Flare visualization toolkit'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 层级展示

1. 两个同层级节点之间的间距: `treemapChart.gapWidth`
2. 层级边距: `nodePadding`
3. 展示的最大层级: `maxDepth`
4. 当区域面积（px \* px）小于设定值后，节点将被隐藏: `minVisibleArea`
5. 当区域面积（px \* px）小于设定值后，节点的子节点将被隐藏: `minChildrenVisibleArea`

```javascript livedemo
const spec = {
  type: 'treemap',
  data: [
    {
      id: 'data',
      values: [
        {
          name: 'query',
          children: [
            {
              name: 'methods',
              children: [
                { name: 'add', value: 593 },
                { name: 'and', value: 330 },
                { name: 'average', value: 287 },
                { name: 'count', value: 277 },
                { name: 'distinct', value: 292 },
                { name: 'div', value: 595 },
                { name: 'eq', value: 594 },
                { name: 'fn', value: 460 },
                { name: 'gt', value: 603 },
                { name: 'gte', value: 625 },
                { name: 'iff', value: 748 },
                { name: 'isa', value: 461 },
                { name: 'lt', value: 597 },
                { name: 'lte', value: 619 },
                { name: 'max', value: 283 },
                { name: 'min', value: 283 },
                { name: 'mod', value: 591 },
                { name: 'mul', value: 603 },
                { name: 'neq', value: 599 },
                { name: 'not', value: 386 },
                { name: 'or', value: 323 },
                { name: 'orderby', value: 307 },
                { name: 'range', value: 772 },
                { name: 'select', value: 296 },
                { name: 'stddev', value: 363 },
                { name: 'sub', value: 600 },
                { name: 'sum', value: 280 },
                { name: 'update', value: 307 },
                { name: 'variance', value: 335 },
                { name: 'where', value: 299 },
                { name: 'xor', value: 354 },
                { name: '_', value: 264 }
              ]
            },
            { name: 'AggregateExpression', value: 1616 },
            { name: 'And', value: 1027 },
            { name: 'Arithmetic', value: 3891 },
            { name: 'Average', value: 891 },
            { name: 'BinaryExpression', value: 2893 },
            { name: 'Comparison', value: 5103 },
            { name: 'CompositeExpression', value: 3677 },
            { name: 'Count', value: 781 },
            { name: 'DateUtil', value: 4141 },
            { name: 'Distinct', value: 933 },
            { name: 'Expression', value: 5130 },
            { name: 'ExpressionIterator', value: 3617 },
            { name: 'Fn', value: 3240 },
            { name: 'If', value: 2732 },
            { name: 'IsA', value: 2039 },
            { name: 'Literal', value: 1214 },
            { name: 'Match', value: 3748 },
            { name: 'Maximum', value: 843 },
            { name: 'Minimum', value: 843 },
            { name: 'Not', value: 1554 },
            { name: 'Or', value: 970 },
            { name: 'Query', value: 13896 },
            { name: 'Range', value: 1594 },
            { name: 'StringUtil', value: 4130 },
            { name: 'Sum', value: 791 },
            { name: 'Variable', value: 1124 },
            { name: 'Variance', value: 1876 },
            { name: 'Xor', value: 1101 }
          ]
        },
        {
          name: 'util',
          children: [
            {
              name: 'palette',
              children: [
                { name: 'ColorPalette', value: 6367 },
                { name: 'Palette', value: 1229 },
                { name: 'ShapePalette', value: 2059 },
                { name: 'valuePalette', value: 2291 }
              ]
            },
            {
              name: 'math',
              children: [
                { name: 'DenseMatrix', value: 3165 },
                { name: 'IMatrix', value: 2815 },
                { name: 'SparseMatrix', value: 3366 }
              ]
            },
            {
              name: 'heap',
              children: [
                { name: 'FibonacciHeap', value: 9354 },
                { name: 'HeapNode', value: 1233 }
              ]
            },
            { name: 'Arrays', value: 8258 },
            { name: 'Colors', value: 10001 },
            { name: 'Dates', value: 8217 },
            { name: 'Displays', value: 12555 },
            { name: 'Filter', value: 2324 },
            { name: 'Geometry', value: 10993 },
            { name: 'IEvaluable', value: 335 },
            { name: 'IPredicate', value: 383 },
            { name: 'IValueProxy', value: 874 },
            { name: 'Maths', value: 17705 },
            { name: 'Orientation', value: 1486 },
            { name: 'Property', value: 5559 },
            { name: 'Shapes', value: 19118 },
            { name: 'Sort', value: 6887 },
            { name: 'Stats', value: 6557 },
            { name: 'Strings', value: 22026 }
          ]
        },
        {
          name: 'animate',
          children: [
            {
              name: 'interpolate',
              children: [
                { name: 'ArrayInterpolator', value: 1983 },
                { name: 'ColorInterpolator', value: 2047 },
                { name: 'DateInterpolator', value: 1375 },
                { name: 'Interpolator', value: 8746 },
                { name: 'MatrixInterpolator', value: 2202 },
                { name: 'NumberInterpolator', value: 1382 },
                { name: 'ObjectInterpolator', value: 1629 },
                { name: 'PointInterpolator', value: 1675 },
                { name: 'RectangleInterpolator', value: 2042 }
              ]
            },
            { name: 'Easing', value: 17010 },
            { name: 'FunctionSequence', value: 5842 },
            { name: 'ISchedulable', value: 1041 },
            { name: 'Parallel', value: 5176 },
            { name: 'Pause', value: 449 },
            { name: 'Scheduler', value: 5593 },
            { name: 'Sequence', value: 5534 },
            { name: 'Transition', value: 9201 },
            { name: 'Transitioner', value: 19975 },
            { name: 'TransitionEvent', value: 1116 },
            { name: 'Tween', value: 6006 }
          ]
        },
        {
          name: 'scale',
          children: [
            { name: 'IScaleMap', value: 2105 },
            { name: 'LinearScale', value: 1316 },
            { name: 'LogScale', value: 3151 },
            { name: 'OrdinalScale', value: 3770 },
            { name: 'QuantileScale', value: 2435 },
            { name: 'QuantitativeScale', value: 4839 },
            { name: 'RootScale', value: 1756 },
            { name: 'Scale', value: 4268 },
            { name: 'ScaleType', value: 1821 },
            { name: 'TimeScale', value: 5833 }
          ]
        },
        {
          name: 'physics',
          children: [
            { name: 'DragForce', value: 1082 },
            { name: 'GravityForce', value: 1336 },
            { name: 'IForce', value: 319 },
            { name: 'NBodyForce', value: 10498 },
            { name: 'Particle', value: 2822 },
            { name: 'Simulation', value: 9983 },
            { name: 'Spring', value: 2213 },
            { name: 'SpringForce', value: 1681 }
          ]
        },
        {
          name: 'data',
          children: [
            {
              name: 'converters',
              children: [
                { name: 'Converters', value: 721 },
                { name: 'DelimitedTextConverter', value: 4294 },
                { name: 'GraphMLConverter', value: 9800 },
                { name: 'IDataConverter', value: 1314 },
                { name: 'JSONConverter', value: 2220 }
              ]
            },
            { name: 'DataField', value: 1759 },
            { name: 'DataSchema', value: 2165 },
            { name: 'DataSet', value: 586 },
            { name: 'DataSource', value: 3331 },
            { name: 'DataTable', value: 772 },
            { name: 'DataUtil', value: 3322 }
          ]
        },
        {
          name: 'vis',
          children: [
            {
              name: 'controls',
              children: [
                { name: 'AnchorControl', value: 2138 },
                { name: 'ClickControl', value: 3824 },
                { name: 'Control', value: 1353 },
                { name: 'ControlList', value: 4665 },
                { name: 'DragControl', value: 2649 },
                { name: 'ExpandControl', value: 2832 },
                { name: 'HoverControl', value: 4896 },
                { name: 'IControl', value: 763 },
                { name: 'PanZoomControl', value: 5222 },
                { name: 'SelectionControl', value: 7862 },
                { name: 'TooltipControl', value: 8435 }
              ]
            },
            {
              name: 'operator',
              children: [
                {
                  name: 'layout',
                  children: [
                    { name: 'AxisLayout', value: 6725 },
                    { name: 'BundledEdgeRouter', value: 3727 },
                    { name: 'CircleLayout', value: 9317 },
                    { name: 'CirclePackingLayout', value: 12003 },
                    { name: 'DendrogramLayout', value: 4853 },
                    { name: 'ForceDirectedLayout', value: 8411 },
                    { name: 'IcicleTreeLayout', value: 4864 },
                    { name: 'IndentedTreeLayout', value: 3174 },
                    { name: 'Layout', value: 7881 },
                    { name: 'NodeLinkTreeLayout', value: 12870 },
                    { name: 'PieLayout', value: 2728 },
                    { name: 'RadialTreeLayout', value: 12348 },
                    { name: 'RandomLayout', value: 870 },
                    { name: 'StackedAreaLayout', value: 9121 },
                    { name: 'TreeMapLayout', value: 9191 }
                  ]
                },
                {
                  name: 'encoder',
                  children: [
                    { name: 'ColorEncoder', value: 3179 },
                    { name: 'Encoder', value: 4060 },
                    { name: 'PropertyEncoder', value: 4138 },
                    { name: 'ShapeEncoder', value: 1690 },
                    { name: 'valueEncoder', value: 1830 }
                  ]
                },
                {
                  name: 'distortion',
                  children: [
                    { name: 'BifocalDistortion', value: 4461 },
                    { name: 'Distortion', value: 6314 },
                    { name: 'FisheyeDistortion', value: 3444 }
                  ]
                },
                {
                  name: 'filter',
                  children: [
                    { name: 'FisheyeTreeFilter', value: 5219 },
                    { name: 'GraphDistanceFilter', value: 3165 },
                    { name: 'VisibilityFilter', value: 3509 }
                  ]
                },
                {
                  name: 'label',
                  children: [
                    { name: 'Labeler', value: 9956 },
                    { name: 'RadialLabeler', value: 3899 },
                    { name: 'StackedAreaLabeler', value: 3202 }
                  ]
                },
                { name: 'IOperator', value: 1286 },
                { name: 'Operator', value: 2490 },
                { name: 'OperatorList', value: 5248 },
                { name: 'OperatorSequence', value: 4190 },
                { name: 'OperatorSwitch', value: 2581 },
                { name: 'SortOperator', value: 2023 }
              ]
            },
            {
              name: 'data',
              children: [
                {
                  name: 'render',
                  children: [
                    { name: 'ArrowType', value: 698 },
                    { name: 'EdgeRenderer', value: 5569 },
                    { name: 'IRenderer', value: 353 },
                    { name: 'ShapeRenderer', value: 2247 }
                  ]
                },
                { name: 'Data', value: 20544 },
                { name: 'DataList', value: 19788 },
                { name: 'DataSprite', value: 10349 },
                { name: 'EdgeSprite', value: 3301 },
                { name: 'NodeSprite', value: 19382 },
                { name: 'ScaleBinding', value: 11275 },
                { name: 'Tree', value: 7147 },
                { name: 'TreeBuilder', value: 9930 }
              ]
            },
            {
              name: 'axis',
              children: [
                { name: 'Axes', value: 1302 },
                { name: 'Axis', value: 24593 },
                { name: 'AxisGridLine', value: 652 },
                { name: 'AxisLabel', value: 636 },
                { name: 'CartesianAxes', value: 6703 }
              ]
            },
            {
              name: 'events',
              children: [
                { name: 'DataEvent', value: 2313 },
                { name: 'SelectionEvent', value: 1880 },
                { name: 'TooltipEvent', value: 1701 },
                { name: 'VisualizationEvent', value: 1117 }
              ]
            },
            {
              name: 'legend',
              children: [
                { name: 'Legend', value: 20859 },
                { name: 'LegendItem', value: 4614 },
                { name: 'LegendRange', value: 10530 }
              ]
            },
            { name: 'Visualization', value: 16540 }
          ]
        },
        {
          name: 'display',
          children: [
            { name: 'DirtySprite', value: 8833 },
            { name: 'LineSprite', value: 1732 },
            { name: 'RectSprite', value: 3623 },
            { name: 'TextSprite', value: 10066 }
          ]
        },
        {
          name: 'analytics',
          children: [
            {
              name: 'graph',
              children: [
                { name: 'BetweennessCentrality', value: 3534 },
                { name: 'LinkDistance', value: 5731 },
                { name: 'MaxFlowMinCut', value: 7840 },
                { name: 'ShortestPaths', value: 5914 },
                { name: 'SpanningTree', value: 3416 }
              ]
            },
            {
              name: 'cluster',
              children: [
                { name: 'AgglomerativeCluster', value: 3938 },
                { name: 'CommunityStructure', value: 3812 },
                { name: 'HierarchicalCluster', value: 6714 },
                { name: 'MergeEdge', value: 743 }
              ]
            },
            {
              name: 'optimization',
              children: [{ name: 'AspectRatioBanker', value: 7074 }]
            }
          ]
        },
        { name: 'flex', children: [{ name: 'FlareVis', value: 4116 }] }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  gapWidth: 1,
  nodePadding: [5],
  maxDepth: 6,
  minVisibleArea: 10,
  minChildrenVisibleArea: 10,
  label: {
    visible: true,
    style: {
      fontSize: 12
    }
  },
  title: {
    visible: true,
    text: 'The software class hierarchy of the Flare visualization toolkit'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 图表交互

#### 拖拽和缩放

由于矩形树图展示的数据量往往比较大且层级结构复杂，所以 VChart 提供了针对矩形树图的拖拽和缩放交互，配置`treemapChart.roam: true`即可开启拖拽和缩放。

```javascript livedemo
const spec = {
  type: 'treemap',
  data: [
    {
      id: 'data',
      values: [
        {
          name: 'query',
          children: [
            {
              name: 'methods',
              children: [
                { name: 'add', value: 593 },
                { name: 'and', value: 330 },
                { name: 'average', value: 287 },
                { name: 'count', value: 277 },
                { name: 'distinct', value: 292 },
                { name: 'div', value: 595 },
                { name: 'eq', value: 594 },
                { name: 'fn', value: 460 },
                { name: 'gt', value: 603 },
                { name: 'gte', value: 625 },
                { name: 'iff', value: 748 },
                { name: 'isa', value: 461 },
                { name: 'lt', value: 597 },
                { name: 'lte', value: 619 },
                { name: 'max', value: 283 },
                { name: 'min', value: 283 },
                { name: 'mod', value: 591 },
                { name: 'mul', value: 603 },
                { name: 'neq', value: 599 },
                { name: 'not', value: 386 },
                { name: 'or', value: 323 },
                { name: 'orderby', value: 307 },
                { name: 'range', value: 772 },
                { name: 'select', value: 296 },
                { name: 'stddev', value: 363 },
                { name: 'sub', value: 600 },
                { name: 'sum', value: 280 },
                { name: 'update', value: 307 },
                { name: 'variance', value: 335 },
                { name: 'where', value: 299 },
                { name: 'xor', value: 354 },
                { name: '_', value: 264 }
              ]
            },
            { name: 'AggregateExpression', value: 1616 },
            { name: 'And', value: 1027 },
            { name: 'Arithmetic', value: 3891 },
            { name: 'Average', value: 891 },
            { name: 'BinaryExpression', value: 2893 },
            { name: 'Comparison', value: 5103 },
            { name: 'CompositeExpression', value: 3677 },
            { name: 'Count', value: 781 },
            { name: 'DateUtil', value: 4141 },
            { name: 'Distinct', value: 933 },
            { name: 'Expression', value: 5130 },
            { name: 'ExpressionIterator', value: 3617 },
            { name: 'Fn', value: 3240 },
            { name: 'If', value: 2732 },
            { name: 'IsA', value: 2039 },
            { name: 'Literal', value: 1214 },
            { name: 'Match', value: 3748 },
            { name: 'Maximum', value: 843 },
            { name: 'Minimum', value: 843 },
            { name: 'Not', value: 1554 },
            { name: 'Or', value: 970 },
            { name: 'Query', value: 13896 },
            { name: 'Range', value: 1594 },
            { name: 'StringUtil', value: 4130 },
            { name: 'Sum', value: 791 },
            { name: 'Variable', value: 1124 },
            { name: 'Variance', value: 1876 },
            { name: 'Xor', value: 1101 }
          ]
        },
        {
          name: 'util',
          children: [
            {
              name: 'palette',
              children: [
                { name: 'ColorPalette', value: 6367 },
                { name: 'Palette', value: 1229 },
                { name: 'ShapePalette', value: 2059 },
                { name: 'valuePalette', value: 2291 }
              ]
            },
            {
              name: 'math',
              children: [
                { name: 'DenseMatrix', value: 3165 },
                { name: 'IMatrix', value: 2815 },
                { name: 'SparseMatrix', value: 3366 }
              ]
            },
            {
              name: 'heap',
              children: [
                { name: 'FibonacciHeap', value: 9354 },
                { name: 'HeapNode', value: 1233 }
              ]
            },
            { name: 'Arrays', value: 8258 },
            { name: 'Colors', value: 10001 },
            { name: 'Dates', value: 8217 },
            { name: 'Displays', value: 12555 },
            { name: 'Filter', value: 2324 },
            { name: 'Geometry', value: 10993 },
            { name: 'IEvaluable', value: 335 },
            { name: 'IPredicate', value: 383 },
            { name: 'IValueProxy', value: 874 },
            { name: 'Maths', value: 17705 },
            { name: 'Orientation', value: 1486 },
            { name: 'Property', value: 5559 },
            { name: 'Shapes', value: 19118 },
            { name: 'Sort', value: 6887 },
            { name: 'Stats', value: 6557 },
            { name: 'Strings', value: 22026 }
          ]
        },
        {
          name: 'animate',
          children: [
            {
              name: 'interpolate',
              children: [
                { name: 'ArrayInterpolator', value: 1983 },
                { name: 'ColorInterpolator', value: 2047 },
                { name: 'DateInterpolator', value: 1375 },
                { name: 'Interpolator', value: 8746 },
                { name: 'MatrixInterpolator', value: 2202 },
                { name: 'NumberInterpolator', value: 1382 },
                { name: 'ObjectInterpolator', value: 1629 },
                { name: 'PointInterpolator', value: 1675 },
                { name: 'RectangleInterpolator', value: 2042 }
              ]
            },
            { name: 'Easing', value: 17010 },
            { name: 'FunctionSequence', value: 5842 },
            { name: 'ISchedulable', value: 1041 },
            { name: 'Parallel', value: 5176 },
            { name: 'Pause', value: 449 },
            { name: 'Scheduler', value: 5593 },
            { name: 'Sequence', value: 5534 },
            { name: 'Transition', value: 9201 },
            { name: 'Transitioner', value: 19975 },
            { name: 'TransitionEvent', value: 1116 },
            { name: 'Tween', value: 6006 }
          ]
        },
        {
          name: 'scale',
          children: [
            { name: 'IScaleMap', value: 2105 },
            { name: 'LinearScale', value: 1316 },
            { name: 'LogScale', value: 3151 },
            { name: 'OrdinalScale', value: 3770 },
            { name: 'QuantileScale', value: 2435 },
            { name: 'QuantitativeScale', value: 4839 },
            { name: 'RootScale', value: 1756 },
            { name: 'Scale', value: 4268 },
            { name: 'ScaleType', value: 1821 },
            { name: 'TimeScale', value: 5833 }
          ]
        },
        {
          name: 'physics',
          children: [
            { name: 'DragForce', value: 1082 },
            { name: 'GravityForce', value: 1336 },
            { name: 'IForce', value: 319 },
            { name: 'NBodyForce', value: 10498 },
            { name: 'Particle', value: 2822 },
            { name: 'Simulation', value: 9983 },
            { name: 'Spring', value: 2213 },
            { name: 'SpringForce', value: 1681 }
          ]
        },
        {
          name: 'data',
          children: [
            {
              name: 'converters',
              children: [
                { name: 'Converters', value: 721 },
                { name: 'DelimitedTextConverter', value: 4294 },
                { name: 'GraphMLConverter', value: 9800 },
                { name: 'IDataConverter', value: 1314 },
                { name: 'JSONConverter', value: 2220 }
              ]
            },
            { name: 'DataField', value: 1759 },
            { name: 'DataSchema', value: 2165 },
            { name: 'DataSet', value: 586 },
            { name: 'DataSource', value: 3331 },
            { name: 'DataTable', value: 772 },
            { name: 'DataUtil', value: 3322 }
          ]
        },
        {
          name: 'vis',
          children: [
            {
              name: 'controls',
              children: [
                { name: 'AnchorControl', value: 2138 },
                { name: 'ClickControl', value: 3824 },
                { name: 'Control', value: 1353 },
                { name: 'ControlList', value: 4665 },
                { name: 'DragControl', value: 2649 },
                { name: 'ExpandControl', value: 2832 },
                { name: 'HoverControl', value: 4896 },
                { name: 'IControl', value: 763 },
                { name: 'PanZoomControl', value: 5222 },
                { name: 'SelectionControl', value: 7862 },
                { name: 'TooltipControl', value: 8435 }
              ]
            },
            {
              name: 'operator',
              children: [
                {
                  name: 'layout',
                  children: [
                    { name: 'AxisLayout', value: 6725 },
                    { name: 'BundledEdgeRouter', value: 3727 },
                    { name: 'CircleLayout', value: 9317 },
                    { name: 'CirclePackingLayout', value: 12003 },
                    { name: 'DendrogramLayout', value: 4853 },
                    { name: 'ForceDirectedLayout', value: 8411 },
                    { name: 'IcicleTreeLayout', value: 4864 },
                    { name: 'IndentedTreeLayout', value: 3174 },
                    { name: 'Layout', value: 7881 },
                    { name: 'NodeLinkTreeLayout', value: 12870 },
                    { name: 'PieLayout', value: 2728 },
                    { name: 'RadialTreeLayout', value: 12348 },
                    { name: 'RandomLayout', value: 870 },
                    { name: 'StackedAreaLayout', value: 9121 },
                    { name: 'TreeMapLayout', value: 9191 }
                  ]
                },
                {
                  name: 'encoder',
                  children: [
                    { name: 'ColorEncoder', value: 3179 },
                    { name: 'Encoder', value: 4060 },
                    { name: 'PropertyEncoder', value: 4138 },
                    { name: 'ShapeEncoder', value: 1690 },
                    { name: 'valueEncoder', value: 1830 }
                  ]
                },
                {
                  name: 'distortion',
                  children: [
                    { name: 'BifocalDistortion', value: 4461 },
                    { name: 'Distortion', value: 6314 },
                    { name: 'FisheyeDistortion', value: 3444 }
                  ]
                },
                {
                  name: 'filter',
                  children: [
                    { name: 'FisheyeTreeFilter', value: 5219 },
                    { name: 'GraphDistanceFilter', value: 3165 },
                    { name: 'VisibilityFilter', value: 3509 }
                  ]
                },
                {
                  name: 'label',
                  children: [
                    { name: 'Labeler', value: 9956 },
                    { name: 'RadialLabeler', value: 3899 },
                    { name: 'StackedAreaLabeler', value: 3202 }
                  ]
                },
                { name: 'IOperator', value: 1286 },
                { name: 'Operator', value: 2490 },
                { name: 'OperatorList', value: 5248 },
                { name: 'OperatorSequence', value: 4190 },
                { name: 'OperatorSwitch', value: 2581 },
                { name: 'SortOperator', value: 2023 }
              ]
            },
            {
              name: 'data',
              children: [
                {
                  name: 'render',
                  children: [
                    { name: 'ArrowType', value: 698 },
                    { name: 'EdgeRenderer', value: 5569 },
                    { name: 'IRenderer', value: 353 },
                    { name: 'ShapeRenderer', value: 2247 }
                  ]
                },
                { name: 'Data', value: 20544 },
                { name: 'DataList', value: 19788 },
                { name: 'DataSprite', value: 10349 },
                { name: 'EdgeSprite', value: 3301 },
                { name: 'NodeSprite', value: 19382 },
                { name: 'ScaleBinding', value: 11275 },
                { name: 'Tree', value: 7147 },
                { name: 'TreeBuilder', value: 9930 }
              ]
            },
            {
              name: 'axis',
              children: [
                { name: 'Axes', value: 1302 },
                { name: 'Axis', value: 24593 },
                { name: 'AxisGridLine', value: 652 },
                { name: 'AxisLabel', value: 636 },
                { name: 'CartesianAxes', value: 6703 }
              ]
            },
            {
              name: 'events',
              children: [
                { name: 'DataEvent', value: 2313 },
                { name: 'SelectionEvent', value: 1880 },
                { name: 'TooltipEvent', value: 1701 },
                { name: 'VisualizationEvent', value: 1117 }
              ]
            },
            {
              name: 'legend',
              children: [
                { name: 'Legend', value: 20859 },
                { name: 'LegendItem', value: 4614 },
                { name: 'LegendRange', value: 10530 }
              ]
            },
            { name: 'Visualization', value: 16540 }
          ]
        },
        {
          name: 'display',
          children: [
            { name: 'DirtySprite', value: 8833 },
            { name: 'LineSprite', value: 1732 },
            { name: 'RectSprite', value: 3623 },
            { name: 'TextSprite', value: 10066 }
          ]
        },
        {
          name: 'analytics',
          children: [
            {
              name: 'graph',
              children: [
                { name: 'BetweennessCentrality', value: 3534 },
                { name: 'LinkDistance', value: 5731 },
                { name: 'MaxFlowMinCut', value: 7840 },
                { name: 'ShortestPaths', value: 5914 },
                { name: 'SpanningTree', value: 3416 }
              ]
            },
            {
              name: 'cluster',
              children: [
                { name: 'AgglomerativeCluster', value: 3938 },
                { name: 'CommunityStructure', value: 3812 },
                { name: 'HierarchicalCluster', value: 6714 },
                { name: 'MergeEdge', value: 743 }
              ]
            },
            {
              name: 'optimization',
              children: [{ name: 'AspectRatioBanker', value: 7074 }]
            }
          ]
        },
        { name: 'flex', children: [{ name: 'FlareVis', value: 4116 }] }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  label: {
    visible: true,
    style: {
      fontSize: 12
    }
  },
  roam: true,
  nonLeaf: {
    visible: true
  },
  nonLeafLabel: {
    visible: true,
    // non-leaf label will show at the top of the rect
    // 非叶子节点的标签位置显示在矩形上方
    position: 'top',
    // The padding for non-leaf node, we can use this space to display a label
    // This padding will only works when the node has enough space
    // 非叶子结点预留的空间大小，通常用于配合文字大小配置，本例中为多行文本预留 30px 高度
    padding: 30,
    style: {
      x: data => {
        // Label will be placed at the center of node rect.
        // Here we adjust the x attribute to position label to the left
        // 默认标签显示在矩形中心位置，这里配置为左对齐，预留 4px 间距
        return data.labelRect?.x0 + 4;
      },
      textAlign: 'left',
      // string array will be shown like multi-line text
      // 字符串数组将会以多行文本的形式展示
      text: data => [data.name, data.value]
    }
  },
  tooltip: {
    mark: {
      title: {
        value: data => {
          // datum property in treemap data shows all the data of nodes from root to current node
          // Here we config tooltip title to show the path of a node
          // 在treemap 中，datum 字段是一个数组，用于存储从根结点到当前结点的所有数据
          // 这里配置 tooltip 标题显示当前结点的路径
          return data?.datum?.map(data => data.name).join('/');
        }
      }
    }
  },
  title: {
    visible: true,
    text: '请尝试拖拽或缩放画布'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 下钻

下钻功能是在矩形树图、Circle Packing、旭日图等展示不同层次的下级数据时，能够单击父类别以深入挖掘子类别信息的能力。通过下钻功能，用户可以逐级查看详情，深入探索数据的层级细节，并更好地了解数据之间的关系和差异性，得出更高质量的分析结论。

通过配置`treemapChart.drill: true` 和 `treemapChart.drillField` 可以分别开启下钻功能和配置下钻依据的字段（下钻字段默认情况会使用自动生成 unique key, 但在使用 API 钻取时需要配置`drillField`）。

```javascript livedemo
const spec = {
  type: 'treemap',
  data: [
    {
      id: 'data',
      values: [
        {
          name: 'query',
          children: [
            {
              name: 'methods',
              children: [
                { name: 'add', value: 593 },
                { name: 'and', value: 330 },
                { name: 'average', value: 287 },
                { name: 'count', value: 277 },
                { name: 'distinct', value: 292 },
                { name: 'div', value: 595 },
                { name: 'eq', value: 594 },
                { name: 'fn', value: 460 },
                { name: 'gt', value: 603 },
                { name: 'gte', value: 625 },
                { name: 'iff', value: 748 },
                { name: 'isa', value: 461 },
                { name: 'lt', value: 597 },
                { name: 'lte', value: 619 },
                { name: 'max', value: 283 },
                { name: 'min', value: 283 },
                { name: 'mod', value: 591 },
                { name: 'mul', value: 603 },
                { name: 'neq', value: 599 },
                { name: 'not', value: 386 },
                { name: 'or', value: 323 },
                { name: 'orderby', value: 307 },
                { name: 'range', value: 772 },
                { name: 'select', value: 296 },
                { name: 'stddev', value: 363 },
                { name: 'sub', value: 600 },
                { name: 'sum', value: 280 },
                { name: 'update', value: 307 },
                { name: 'variance', value: 335 },
                { name: 'where', value: 299 },
                { name: 'xor', value: 354 },
                { name: '_', value: 264 }
              ]
            },
            { name: 'AggregateExpression', value: 1616 },
            { name: 'And', value: 1027 },
            { name: 'Arithmetic', value: 3891 },
            { name: 'Average', value: 891 },
            { name: 'BinaryExpression', value: 2893 },
            { name: 'Comparison', value: 5103 },
            { name: 'CompositeExpression', value: 3677 },
            { name: 'Count', value: 781 },
            { name: 'DateUtil', value: 4141 },
            { name: 'Distinct', value: 933 },
            { name: 'Expression', value: 5130 },
            { name: 'ExpressionIterator', value: 3617 },
            { name: 'Fn', value: 3240 },
            { name: 'If', value: 2732 },
            { name: 'IsA', value: 2039 },
            { name: 'Literal', value: 1214 },
            { name: 'Match', value: 3748 },
            { name: 'Maximum', value: 843 },
            { name: 'Minimum', value: 843 },
            { name: 'Not', value: 1554 },
            { name: 'Or', value: 970 },
            { name: 'Query', value: 13896 },
            { name: 'Range', value: 1594 },
            { name: 'StringUtil', value: 4130 },
            { name: 'Sum', value: 791 },
            { name: 'Variable', value: 1124 },
            { name: 'Variance', value: 1876 },
            { name: 'Xor', value: 1101 }
          ]
        },
        {
          name: 'util',
          children: [
            {
              name: 'palette',
              children: [
                { name: 'ColorPalette', value: 6367 },
                { name: 'Palette', value: 1229 },
                { name: 'ShapePalette', value: 2059 },
                { name: 'valuePalette', value: 2291 }
              ]
            },
            {
              name: 'math',
              children: [
                { name: 'DenseMatrix', value: 3165 },
                { name: 'IMatrix', value: 2815 },
                { name: 'SparseMatrix', value: 3366 }
              ]
            },
            {
              name: 'heap',
              children: [
                { name: 'FibonacciHeap', value: 9354 },
                { name: 'HeapNode', value: 1233 }
              ]
            },
            { name: 'Arrays', value: 8258 },
            { name: 'Colors', value: 10001 },
            { name: 'Dates', value: 8217 },
            { name: 'Displays', value: 12555 },
            { name: 'Filter', value: 2324 },
            { name: 'Geometry', value: 10993 },
            { name: 'IEvaluable', value: 335 },
            { name: 'IPredicate', value: 383 },
            { name: 'IValueProxy', value: 874 },
            { name: 'Maths', value: 17705 },
            { name: 'Orientation', value: 1486 },
            { name: 'Property', value: 5559 },
            { name: 'Shapes', value: 19118 },
            { name: 'Sort', value: 6887 },
            { name: 'Stats', value: 6557 },
            { name: 'Strings', value: 22026 }
          ]
        },
        {
          name: 'animate',
          children: [
            {
              name: 'interpolate',
              children: [
                { name: 'ArrayInterpolator', value: 1983 },
                { name: 'ColorInterpolator', value: 2047 },
                { name: 'DateInterpolator', value: 1375 },
                { name: 'Interpolator', value: 8746 },
                { name: 'MatrixInterpolator', value: 2202 },
                { name: 'NumberInterpolator', value: 1382 },
                { name: 'ObjectInterpolator', value: 1629 },
                { name: 'PointInterpolator', value: 1675 },
                { name: 'RectangleInterpolator', value: 2042 }
              ]
            },
            { name: 'Easing', value: 17010 },
            { name: 'FunctionSequence', value: 5842 },
            { name: 'ISchedulable', value: 1041 },
            { name: 'Parallel', value: 5176 },
            { name: 'Pause', value: 449 },
            { name: 'Scheduler', value: 5593 },
            { name: 'Sequence', value: 5534 },
            { name: 'Transition', value: 9201 },
            { name: 'Transitioner', value: 19975 },
            { name: 'TransitionEvent', value: 1116 },
            { name: 'Tween', value: 6006 }
          ]
        },
        {
          name: 'scale',
          children: [
            { name: 'IScaleMap', value: 2105 },
            { name: 'LinearScale', value: 1316 },
            { name: 'LogScale', value: 3151 },
            { name: 'OrdinalScale', value: 3770 },
            { name: 'QuantileScale', value: 2435 },
            { name: 'QuantitativeScale', value: 4839 },
            { name: 'RootScale', value: 1756 },
            { name: 'Scale', value: 4268 },
            { name: 'ScaleType', value: 1821 },
            { name: 'TimeScale', value: 5833 }
          ]
        },
        {
          name: 'physics',
          children: [
            { name: 'DragForce', value: 1082 },
            { name: 'GravityForce', value: 1336 },
            { name: 'IForce', value: 319 },
            { name: 'NBodyForce', value: 10498 },
            { name: 'Particle', value: 2822 },
            { name: 'Simulation', value: 9983 },
            { name: 'Spring', value: 2213 },
            { name: 'SpringForce', value: 1681 }
          ]
        },
        {
          name: 'data',
          children: [
            {
              name: 'converters',
              children: [
                { name: 'Converters', value: 721 },
                { name: 'DelimitedTextConverter', value: 4294 },
                { name: 'GraphMLConverter', value: 9800 },
                { name: 'IDataConverter', value: 1314 },
                { name: 'JSONConverter', value: 2220 }
              ]
            },
            { name: 'DataField', value: 1759 },
            { name: 'DataSchema', value: 2165 },
            { name: 'DataSet', value: 586 },
            { name: 'DataSource', value: 3331 },
            { name: 'DataTable', value: 772 },
            { name: 'DataUtil', value: 3322 }
          ]
        },
        {
          name: 'vis',
          children: [
            {
              name: 'controls',
              children: [
                { name: 'AnchorControl', value: 2138 },
                { name: 'ClickControl', value: 3824 },
                { name: 'Control', value: 1353 },
                { name: 'ControlList', value: 4665 },
                { name: 'DragControl', value: 2649 },
                { name: 'ExpandControl', value: 2832 },
                { name: 'HoverControl', value: 4896 },
                { name: 'IControl', value: 763 },
                { name: 'PanZoomControl', value: 5222 },
                { name: 'SelectionControl', value: 7862 },
                { name: 'TooltipControl', value: 8435 }
              ]
            },
            {
              name: 'operator',
              children: [
                {
                  name: 'layout',
                  children: [
                    { name: 'AxisLayout', value: 6725 },
                    { name: 'BundledEdgeRouter', value: 3727 },
                    { name: 'CircleLayout', value: 9317 },
                    { name: 'CirclePackingLayout', value: 12003 },
                    { name: 'DendrogramLayout', value: 4853 },
                    { name: 'ForceDirectedLayout', value: 8411 },
                    { name: 'IcicleTreeLayout', value: 4864 },
                    { name: 'IndentedTreeLayout', value: 3174 },
                    { name: 'Layout', value: 7881 },
                    { name: 'NodeLinkTreeLayout', value: 12870 },
                    { name: 'PieLayout', value: 2728 },
                    { name: 'RadialTreeLayout', value: 12348 },
                    { name: 'RandomLayout', value: 870 },
                    { name: 'StackedAreaLayout', value: 9121 },
                    { name: 'TreeMapLayout', value: 9191 }
                  ]
                },
                {
                  name: 'encoder',
                  children: [
                    { name: 'ColorEncoder', value: 3179 },
                    { name: 'Encoder', value: 4060 },
                    { name: 'PropertyEncoder', value: 4138 },
                    { name: 'ShapeEncoder', value: 1690 },
                    { name: 'valueEncoder', value: 1830 }
                  ]
                },
                {
                  name: 'distortion',
                  children: [
                    { name: 'BifocalDistortion', value: 4461 },
                    { name: 'Distortion', value: 6314 },
                    { name: 'FisheyeDistortion', value: 3444 }
                  ]
                },
                {
                  name: 'filter',
                  children: [
                    { name: 'FisheyeTreeFilter', value: 5219 },
                    { name: 'GraphDistanceFilter', value: 3165 },
                    { name: 'VisibilityFilter', value: 3509 }
                  ]
                },
                {
                  name: 'label',
                  children: [
                    { name: 'Labeler', value: 9956 },
                    { name: 'RadialLabeler', value: 3899 },
                    { name: 'StackedAreaLabeler', value: 3202 }
                  ]
                },
                { name: 'IOperator', value: 1286 },
                { name: 'Operator', value: 2490 },
                { name: 'OperatorList', value: 5248 },
                { name: 'OperatorSequence', value: 4190 },
                { name: 'OperatorSwitch', value: 2581 },
                { name: 'SortOperator', value: 2023 }
              ]
            },
            {
              name: 'data',
              children: [
                {
                  name: 'render',
                  children: [
                    { name: 'ArrowType', value: 698 },
                    { name: 'EdgeRenderer', value: 5569 },
                    { name: 'IRenderer', value: 353 },
                    { name: 'ShapeRenderer', value: 2247 }
                  ]
                },
                { name: 'Data', value: 20544 },
                { name: 'DataList', value: 19788 },
                { name: 'DataSprite', value: 10349 },
                { name: 'EdgeSprite', value: 3301 },
                { name: 'NodeSprite', value: 19382 },
                { name: 'ScaleBinding', value: 11275 },
                { name: 'Tree', value: 7147 },
                { name: 'TreeBuilder', value: 9930 }
              ]
            },
            {
              name: 'axis',
              children: [
                { name: 'Axes', value: 1302 },
                { name: 'Axis', value: 24593 },
                { name: 'AxisGridLine', value: 652 },
                { name: 'AxisLabel', value: 636 },
                { name: 'CartesianAxes', value: 6703 }
              ]
            },
            {
              name: 'events',
              children: [
                { name: 'DataEvent', value: 2313 },
                { name: 'SelectionEvent', value: 1880 },
                { name: 'TooltipEvent', value: 1701 },
                { name: 'VisualizationEvent', value: 1117 }
              ]
            },
            {
              name: 'legend',
              children: [
                { name: 'Legend', value: 20859 },
                { name: 'LegendItem', value: 4614 },
                { name: 'LegendRange', value: 10530 }
              ]
            },
            { name: 'Visualization', value: 16540 }
          ]
        },
        {
          name: 'display',
          children: [
            { name: 'DirtySprite', value: 8833 },
            { name: 'LineSprite', value: 1732 },
            { name: 'RectSprite', value: 3623 },
            { name: 'TextSprite', value: 10066 }
          ]
        },
        {
          name: 'analytics',
          children: [
            {
              name: 'graph',
              children: [
                { name: 'BetweennessCentrality', value: 3534 },
                { name: 'LinkDistance', value: 5731 },
                { name: 'MaxFlowMinCut', value: 7840 },
                { name: 'ShortestPaths', value: 5914 },
                { name: 'SpanningTree', value: 3416 }
              ]
            },
            {
              name: 'cluster',
              children: [
                { name: 'AgglomerativeCluster', value: 3938 },
                { name: 'CommunityStructure', value: 3812 },
                { name: 'HierarchicalCluster', value: 6714 },
                { name: 'MergeEdge', value: 743 }
              ]
            },
            {
              name: 'optimization',
              children: [{ name: 'AspectRatioBanker', value: 7074 }]
            }
          ]
        },
        { name: 'flex', children: [{ name: 'FlareVis', value: 4116 }] }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  label: {
    visible: true,
    style: {
      fontSize: 12
    }
  },
  drill: true,
  nonLeaf: {
    visible: true
  },
  nonLeafLabel: {
    visible: true,
    // non-leaf label will show at the top of the rect
    // 非叶子节点的标签位置显示在矩形上方
    position: 'top',
    // The padding for non-leaf node, we can use this space to display a label
    // This padding will only works when the node has enough space
    // 非叶子结点预留的空间大小，通常用于配合文字大小配置，本例中为多行文本预留 30px 高度
    padding: 30,
    style: {
      x: data => {
        // Label will be placed at the center of node rect.
        // Here we adjust the x attribute to position label to the left
        // 默认标签显示在矩形中心位置，这里配置为左对齐，预留 4px 间距
        return data.labelRect?.x0 + 4;
      },
      textAlign: 'left',
      // string array will be shown like multi-line text
      // 字符串数组将会以多行文本的形式展示
      text: data => [data.name, data.value]
    }
  },
  tooltip: {
    mark: {
      title: {
        value: data => {
          // datum property in treemap data shows all the data of nodes from root to current node
          // Here we config tooltip title to show the path of a node
          // 在treemap 中，datum 字段是一个数组，用于存储从根结点到当前结点的所有数据
          // 这里配置 tooltip 标题显示当前结点的路径
          return data?.datum?.map(data => data.name).join('/');
        }
      }
    }
  },
  title: {
    visible: true,
    text: '请尝试点击节点'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
