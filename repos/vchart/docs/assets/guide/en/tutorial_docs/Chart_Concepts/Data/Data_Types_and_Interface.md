# Data Types and Data Definition

In most cases, the purpose of charts is to transform data into graphical forms, making data analysis easier and more efficient. As an essential part of a chart, VChart supports multiple data formats. Let's introduce them one by one.

## Supported Data Types

### Flattened Data Objects

In VChart, in most cases, we expect to use `flattened` data objects. The difference between `flattened` and `non-flattened` data objects can be seen in the example below.

```js
// Non-flattened data objects
[
    { date: "Monday", class1: 20, class2: 30},
    { date: "Tuesday", class1: 25, class2: 28},
]
// Flattened data objects
[
    { date: "Monday", class: "Class 1", score: 20 },
    { date: "Monday", class: "Class 2", score: 30 },

    { date: "Tuesday", class: "Class 1", score: 25 },
    { date: "Tuesday", class: "Class 2", score: 28 },
]
```

As you can see, the keys "Class 1" and "Class 2" in the non-flattened data have been expanded. The data above has been expanded into two pieces of data. This is a commonly used data processing method in visualization, called `fold`.

The main significance of flattened data is that it allows for a one-to-one correspondence between data and graphics. Taking the data above as an example, we use it to make a grouped bar chart.

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { date: 'Monday', class: 'class No.1', score: 20 },
        { date: 'Monday', class: 'class No.2', score: 30 },

        { date: 'Tuesday', class: 'class No.1', score: 25 },
        { date: 'Tuesday', class: 'class No.2', score: 28 }
      ]
    }
  ],
  seriesField: 'class',
  xField: ['date', 'class'],
  yField: 'score',
  crosshair: {
    xField: { visible: true }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

You can see that there are four bars in the chart, each corresponding to an entry in the data.

In visualization, we often expect to represent the features of the data on the graphics. Using one graphic per data item can help us encode the relationship between the data and the graphics.

Let's use this data to display a scatter plot.

- Use shapes to represent the class
- Use size to represent the scores
- Use color to represent the date
- Data with more than 30 points are marked in red

```javascript livedemo
const spec = {
  type: 'scatter',
  data: [
    {
      id: 'scatterData',
      values: [
        { date: 'Monday', class: 'class No.1', score: 20 },
        { date: 'Monday', class: 'class No.2', score: 30 },

        { date: 'Tuesday', class: 'class No.1', score: 25 },
        { date: 'Tuesday', class: 'class No.2', score: 28 }
      ]
    }
  ],
  shape: {
    type: 'ordinal',
    domain: ['class No.1', 'class No.2'],
    range: ['circle', 'rect']
  },
  shapeField: 'class',
  size: {
    type: 'linear',
    domain: [20, 30],
    range: [10, 50]
  },
  sizeField: 'score',
  seriesField: 'date',
  point: {
    state: {
      superScore: {
        filter: datum => datum.score >= 30,
        style: {
          fill: 'red'
        }
      }
    }
  },
  xField: 'date',
  yField: 'score',
  crosshair: {
    xField: { visible: true }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Data Flattening

We provide a data flattening tool called `transform` and `fold`, which can help users convert non-flattened data into flattened data. In VChart, we offer various built-in data processing tools and support for adding custom data processing tools. For specific methods, please refer to [DataSet](./Dataset_and_Data_Processing).

The usage example of `fold` is as follows:

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { date: 'Monday', 'class No.1': 20, 'class No.2': 30 },
        { date: 'Tuesday', 'class No.1': 25, 'class No.2': 28 }
      ],
      transforms: [
        {
          type: 'fold',
          options: {
            key: 'class', // 转化后，原始数据的 key 放入这个配置对应的字段中作为值
            value: 'score', // 转化后，原始数据的 value 放入这个配置对应的字段中作为值
            fields: ['class No.1', 'class No.2'] // 需要转化的维度
          }
        }
      ]
    }
  ],
  seriesField: 'class',
  xField: ['date', 'class'],
  yField: 'score',
  crosshair: {
    xField: { visible: true }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### CSV Data Objects

In addition to data objects, we also support CSV text content as a data source. Just configure the parsing method as `csv`.

Here's how to use it:

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: `date,class No.1,class No.2
Monday,20,30
Tuesday,25,28`,
      parser: {
        type: 'csv'
      },
      transforms: [
        {
          type: 'fold',
          options: {
            key: 'class',
            value: 'score',
            fields: ['class No.1', 'class No.2']
          }
        }
      ]
    }
  ],
  seriesField: 'class',
  xField: ['date', 'class'],
  yField: 'score'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### Tree-structured Data Objects

For charts such as sunburst and treemap, you need to use tree-structured data.

Currently, only standard tree-structured data objects are supported, as shown in the example below:

```javascript livedemo
const data = [
  {
    name: 'Grandpa',
    children: [
      {
        name: 'Uncle Leo',
        value: 15,
        children: [
          {
            name: 'Cousin Jack',
            value: 2
          },
          {
            name: 'Cousin Mary',
            value: 5,
            children: [
              {
                name: 'Jackson',
                value: 2
              }
            ]
          },
          {
            name: 'Cousin Ben',
            value: 4
          }
        ]
      },
      {
        name: 'Father',
        value: 10,
        children: [
          {
            name: 'Me',
            value: 5
          },
          {
            name: 'Brother Peter',
            value: 1
          }
        ]
      }
    ]
  },
  {
    name: 'Nancy',
    children: [
      {
        name: 'Uncle Nike',
        children: [
          {
            name: 'Cousin Betty',
            value: 1
          },
          {
            name: 'Cousin Jenny',
            value: 2
          }
        ]
      }
    ]
  }
];

const spec = {
  type: 'sunburst',
  offsetX: 0,
  offsetY: 20,
  categoryField: 'name',
  valueField: 'value',
  outerRadius: 0.75,
  innerRadius: 0,
  gap: 0,
  labelLayout: {
    align: 'start',
    rotate: 'radial',
    offset: 60
  },
  drill: true,
  sunburst: {
    visible: true,
    style: {
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  label: {
    visible: true,
    style: {
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  tooltip: {
    mark: {
      title: {
        value: val => {
          return val?.datum?.map(data => data.name).join(' / ');
        }
      }
    }
  },
  data: [
    {
      id: 'data',
      values: data
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### Other Structures

Some charts may use unique data structures, which will be described in the corresponding chart documentation.

## Data Configuration

From the examples above, you can see that the chart data configuration is at the outermost layer of the spec and uses an array structure. It supports multiple pieces of data but uses the first one by default.

```js
const spec = {
  data: [
    {
      // Data id
      id: string;
      // Data content
      values: string | Array<Object> | Object;
      // Parsing method
      parser?: {
        type: 'csv' | 'dsv'
      },
      transforms?: Transform[];
      // Current data references other data
      // Index of data referenced
      fromDataIndex?: number;
      // Data id referenced
      fromDataId?: string | number;
    }
  ]
}
```

### Basic Content of Data Objects

There are two key contents of data objects:

- `id` Unique data id that can be indexed by this id in other modules.
- `values` The content of the data. Supported data types are described in detail below.

### Transforms

Transforms are used to process the data content, transforming the data structure or content so that the original data can be used by the chart, or extracting specific content from the raw data to generate new data. Detailed usage examples are provided below.

### Generating New Data Using Data

The following configuration items can be used to generate new data from the original data:

- `fromDataIndex` The index of the raw data of the current data in the data array.
- `fromDataId` The id of the raw data of the current data. When `fromDataId` is set, `fromDataIndex` will be invalid.

> Note: When `fromDataId` or `fromDataIndex` is set, the `values` configuration will be invalid. The `values` of the current data will come from the data content it depends on.

### Usage Example

In the following example, we will perform the following steps:

1. First flatten the original data,
2. Generate a new piece of data,
3. And filter out data equal to `null` or `undefined` in the new data.

```js
const spec = {
  data: [
    {
      id: "dataSource",
      values: [
        { date: "Monday", class1: 20, class2: 30 },
        { date: "Tuesday", class1: 25, class2: 28 },
        { date: "Wednesday", class1: null, class2: undefined },
      ],
      transforms: [
        {
          type: "fold",
          options: {
            key: "class", // After the transformation, the key of the raw data is stored as a value in the corresponding field of this configuration
            value: "score", // After the transformation, the value of the raw data is stored as a value in the corresponding field of this configuration
            fields: ["Class 1", "Class 2"], // The dimensions to be transformed
          },
        },
      ],
    },
    {
      id: "dataNoEmpty",
      fromDataId: "dataSource",
      transforms: [
        {
          type: "filter",
          option: {
            callBack: (datum) =>
              // The current datum is the number of data items transformed from the barData
              datum.score !== null && datum.score !== undefined,
          },
        },
      ],
    },
  ],
};
// After the above configuration, the actual content of the 2 data items is as follows:
// dataSource
[
    { date: "Monday", class: "Class 1", score: 20 },
    { date: "Monday", class: "Class 2", score: 30 },
    { date: "Tuesday", class: "Class 1", score: 25 },
    { date: "Tuesday", class: "Class 2", score: 28 },
    { date: "Wednesday", class: "Class 1", score: null },
    { date: "Wednesday", class: "Class 2", score: undefined },
]
// dataNoEmpty
[
    { date: "Monday", class: "Class 1", score: 20 },
    { date: "Monday", class: "Class 2", score: 30 },
    { date: "Tuesday", class: "Class 1", score: 25 },
    { date: "Tuesday", class: "Class 2", score: 28 },
]
// You can use the data in the chart series as needed
```
