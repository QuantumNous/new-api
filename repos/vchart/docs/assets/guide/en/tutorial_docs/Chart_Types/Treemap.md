# Treemap

[\[Configuration Manual\]](../../../option/treemapChart)

## Introduction

A treemap is a statistical chart displaying tree-structured data using nested rectangles of different sizes. In a treemap, parent-child hierarchy is represented by the nesting of rectangles. Within the same level, all rectangles are arranged consecutively without gaps, and their sum of areas represents the overall size. The area of an individual rectangle is determined by its proportion at the same level.

Treemaps require tree-structured data (at least one parent node) and weighted child nodes. For tree-structured data without weights, use tree-structure diagrams or radial tree diagrams for representation.

## Chart Composition

The treemap is mainly composed of rectangle elements representing hierarchical structures, tooltip information, and other components.  
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/364e85f0a2e6efbc39057a000.png)

Rectangle elements are the basic elements of the treemap, and relevant drawing configurations are essential:

- `treemapChart.type`: Chart type, the type of bar/column/strip chart is `'treemap'`
- `treemapChart.data`: Data source for chart drawing
- `treemapChart.categoryField`: Value field, mapping different chart elements
- `treemapChart.valueField`: Node weight field, mapping the size of the chart elements

Tooltip information and other components that assist in chart presentation are optional configurations with default effects and functions:

- `treemapChart.tooltip`: Tooltip, displayed by default during interactions, detailed configuration see [VChart Tooltip Component Configuration](../../../option/treemapChart#tooltip)
- More component configurations can be found at [VChart treemapChart Configuration](../../../option/treemapChart)

## Getting Started

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

### Key Configurations

- `categoryField` declares the categorical field, usually node names
- `valueField` declares the value field, usually node weights

## Treemap Features

### Data

In treemaps, data is usually hierarchical in structure, in the form of:

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

### Chart Layout

#### Rectangle Split

1. Split method
   The essence of the treemap algorithm is to divide the rectangular area and then divide the subdivided areas again until the smallest areas are obtained. In VChart, the division method can be specified by `treeMapChart.splitType: 'binary' | 'dice' | 'slice' | 'sliceDice' | 'squarify'`, with a default value of `'binary'`.

- `'binary'`: Recursively splits the specified node into a nearly balanced binary tree, with horizontal split for wide rectangles and vertical split for high rectangles.
- `'dice'`: Horizontally divide the rectangular area specified by x0, y0, x1, y1 according to the value of each child node of the specified node. Child nodes are positioned in order, starting from the left edge (x0) of the given rectangle. If the sum of the child node values is less than the value of the specified node (i.e., if the specified node has a nonzero internal value), the remaining space will be positioned at the right edge (x1) of the given rectangle.
- `'slice'`: Similar to `'dice'`, but with vertical direction splitting.
- `'sliceDice'`: Nodes with odd depth use `'slice'`; nodes with even depth use `'dice'`.
- `'squarify'`: As far as possible, divide the rectangle according to a specific aspect ratio.

2. Split ratio
   `treemapChart.aspectRatio`: It can be configured for each split ratio. The default value is `(1 + Math.sqrt(5)) / 2`, which is about 1.618

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

#### Hierarchical Display

1. Gap width between two same-level nodes: `treemapChart.gapWidth`
2. Hierarchy margin: `nodePadding`
3. Maximum display level: `maxDepth`
4. When the area (px \* px) is smaller than the set value, the node will be hidden: `minVisibleArea`
5. When the area (px \* px) is smaller than the set value, the child nodes will be hidden: `minChildrenVisibleArea`

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

### Chart Interaction

#### Drag and Zoom

Since treemaps usually display large amounts of data and complex hierarchical structures, VChart provides drag and zoom interactions specifically for treemaps. To enable drag and zoom, configure `treemapChart.roam: true`.

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

#### Drill Down

The drill-down feature allows users to click on a parent category to dig deeper into subcategory information in treemaps, Circle Packing, and sunburst charts that display different levels of sub-data. Through the drill-down feature, users can view details level by level, explore the details of data hierarchies, and better understand the relationships and differences between data, resulting in higher quality analytical conclusions.

By configuring `treemapChart.drill: true` and `treemapChart.drillField`, you can enable the drill-down feature and configure the field used for drill-down (the drill-down field will use autogenerated unique keys by default, but the `drillField` needs to be configured when using the API for drilling).

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
