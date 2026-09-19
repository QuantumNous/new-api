{{ target: common-data }}

<!-- IData -->

${prefix} data(${dataType})

{{ if: ${isSeries} }}

系列数据，系列可以配置自身的数据，也可以从 spec.data 中获取数据。可以直接传入 DataView 实例，可以进行对象配置。

{{ else }}

图表数据，可以是单个数据也可以是一个数据数组。

{{ /if }}

图表数据配置支持 2 种结构。

- 数据描述格式对象：**IDataValues**
- **Dataset** 中的数据对象 **DataView**。

#${prefix} IDataValues

图表支持的数据描述结构

##${prefix} id(string|number)

用户设定 ID。默认不指定，指定则可用于在图表其他模块中引用。

{{ if: ${isHierarchy} }}

##${prefix} values(IHierarchyData)

层次数据。支持嵌套结构的层次数据：

```ts
export type IHierarchyNodeData = {
  value?: number;
  children?: IHierarchyNodeData[];
} & Datum;

export type Datum = {
  [key: string]: any;
};
```

{{ else }}

##${prefix} values(string|Datum[])

数据值。支持 2 种类型

- **csv|dsv|tsv** 格式的字符串。
- 数据对象的数据组。

其中 **csv|dsv|tsv** 格式的字符串，需要配置 **[parser](TODO:)** 属性，指定字符串是哪种格式。

{{ /if }}

##${prefix} fromDataId(string|number)

当前数据引用数据数组中的其他数据作为原始数据，通过 **id** 进行索引。数据处理按照数组顺序从前向后，请保证被依赖的数据在数组前面。

##${prefix} fromDataIndex(number)

当前数据引用数据数组中的其他数据作为原始数据，通过 **数组下标** 进行索引。数据处理按照数组顺序从前向后，请保证被依赖的数据在数组前面。

##${prefix} transform(BuildInTransformOptions[])

数据变换。可以给数据添加变换，最终使用时，图表会使用经过数据变换后的数据。

目前内置的数据变换：

- ~~simplify: 地理数据简化~~
  **1.11.0 版本后移除了内置的 `simplify` 变换**
  可以在注册地图数据时，配置 `simplify` 参数，例如：

  ```js
  VChart.registerMap('myMay', geojson, {
    simplify: {
      tolerance: 0.01
    }
  });
  ```

- fields: 数据维度处理，包括基于维度的排序，逆序，数据筛选能力

```ts
// type
export interface IFieldsMeta {
    type: 'ordinal' | 'linear'; // 维度类型，ordinal 为离散型，linear 为连续型。
    alias?: string; //  字段别名。
    domain?: any[]; // 当前维度的数值区间。在数值区间外的数据会被剔除。
    lockStatisticsByDomain?: boolean; // 是否使用 domain 锁定统计信息。默认为 false 。
    sortIndex?: number; // 当前维度的排序顺序，如果不设置，则不参与排序。可以多个维度按照此属性对数据进行排序。
    sortReverse?: boolean; // 当前维度在排序时是否逆序，只有在配置了 sortIndex 后才有效。默认为 false 。
}
type fieldType = {
  type: 'fields';
  options: {
      fields: {
        [key: string]: IFieldsMeta;
      }
  };
}
// example
const spec = {
  data: [
    {
      id: 'fieldsData',
      values: [
        {date: '1-3', value: '22', type: '利润'},
        {date: '1-2', value: '20', type: '利润'},
        {date: '1-4', value: '30', type: '销售额'},
        {date: '1-2', value: '220', type: '销售额'},
        {date: '1-3', value: '230', type: '销售额'},
        {date: '1-4', value: '-40', type: '销售额'}
      ],
      transforms: [{
        type: 'fields',
        options: {
          fields: {
            date: {
              type: 'ordinal' // 数据维度 date 的类型是离散类型
              sortIndex: 1 // 数据会按照 date 进行排序
            },
            value: {
              type: 'linear' // 数据维度 value 的类型是连续类型
              domain: [0,10000] // 会提出 value 值不在 0-10000内的数据
            },
            type: {
              alias: '类型' // 数据维度 type 的别名。如果图例对应这个维度，那么图例的标题文本默认值将是 '类型' 。
            }
          }
        }
      }]
    }
  ]
}
// 最终数据
// 数据会按照 date 在原数据中出现的顺序进行排序
vchart.getDataSet().getDataView('fieldsData').latestData ===
[{date: '1-3', value: '22', type: '利润'},
{date: '1-3', value: '230', type: '销售额'},
{date: '1-2', value: '20', type: '利润'},
{date: '1-2', value: '220', type: '销售额'},
{date: '1-4', value: '30', type: '销售额'}，
{date: '1-4', value: '-40', type: '销售额'}]

```

- filter: 使用回调的自定义筛选

```ts
type filterType = {
  type: 'filter';
  options: {
    callback?: (item: any) => boolean; // 返回true的数据保留，返回false的数据剔除
  };
};
// example
const spec = {
  data: [
    {
      id: 'data',
      values: [
        // ...
      ],
      transform: [
        {
          type: 'filter',
          options: {
            callback: (datum: any) => {
              return true | false;
            }
          }
        }
      ]
    }
  ]
};
```

- IFoldOptions: 数据展开

```ts
type foldType = {
  type: 'fold';
  options: {
    fields: string[]; // 需要被展开的字段集
    key: string; // 展开后 fields 的内容被转化到 key 字段
    value: string; // 展开后对应数值转化到 value 字段
    retains?: string[]; // 保留字段集，默认为除 fields 以外的所有字段
  };
};
// example
const spec = {
  data: [
    {
      id: 'temperatureData',
      values: [
        { date: '周一', 最低: 18, 最高: 28 },
        { date: '周二', 最低: 19, 最高: 30 },
        { date: '周三', 最低: 20, 最高: 32 }
      ],
      transform: [
        {
          type: 'fold',
          options: {
            fields: string[('最低', '最高')],
            key: 'type',
            value: 'temperature'
          }
        }
      ]
    }
  ]
};
// 最终数据
vchart.getDataSet().getDataView('temperatureData').latestData ===
  [
    { date: '周一', type: '最低', temperature: 18 },
    { date: '周一', type: '最高', temperature: 28 },
    { date: '周二', type: '最低', temperature: 19 },
    { date: '周二', type: '最高', temperature: 30 },
    { date: '周三', type: '最低', temperature: 20 },
    { date: '周三', type: '最高', temperature: 32 }
  ];
```

##${prefix} fields(Object)

考虑到数据维度处理比较常用，独立提供一个配置项，此配置内容会被转化为 [transform.fieldsTransform](TODO:)

```ts
// type
type fields = {
  [key: string]: IFieldsMeta;
};
// example
const spec = {
  data: [
    {
      id: 'fieldsData',
      values: [
        {date: '1-3', value: '22', type: '利润'},
        {date: '1-2', value: '20', type: '利润'},
        {date: '1-4', value: '30', type: '销售额'},
        {date: '1-2', value: '220', type: '销售额'},
        {date: '1-3', value: '230', type: '销售额'},
        {date: '1-4', value: '-40', type: '销售额'}
      ],
      fields: {
        date: {
          type: 'ordinal' // 数据维度 date 的类型是离散类型
          sortIndex: 1 // 数据会按照 date 进行排序
        },
        value: {
          type: 'linear' // 数据维度 value 的类型是连续类型
          domain: [0,10000] // 会提出 value 值不在 0-10000内的数据
        },
        type: {
          alias: '类型' // 数据维度 type 的别名。如果图例对应这个维度，那么图例的标题文本默认值将是 '类型' 。
        }
      }
    }
  ]
}
// 最终数据
vchart.getDataSet().getDataView('fieldsData').latestData ===
  [
    {date: '1-3', value: '22', type: '利润'},
    {date: '1-3', value: '230', type: '销售额'},
    {date: '1-2', value: '20', type: '利润'},
    {date: '1-2', value: '220', type: '销售额'},
    {date: '1-4', value: '30', type: '销售额'}，
    {date: '1-4', value: '-40', type: '销售额'}
  ]
```

##${prefix} parser(Object)

自 `1.3.0` 版本开始，`parser` 上支持了 `clone` 属性配置，默认为 `true`，用于配置是否需要对数据进行 clone，如果考虑性能，你可以将其关闭，但是这会带了一些副作用，即我们会对传入的数据进行修改（不会对原有字段及值修改，只会在原有数据基础上添加一些字段）。

当数据内容为字符串时，可以通过配置 parser 指定解析方式，目前仅支持 **csv|dsv|tsv**，配置如下：

```ts
type parser = {
  type: 'csv' | 'dsv' | 'tsv';
  options?: {
    // delimiter 必须是一个单字符。
    delimiter?: string; // 参数值默认为半角逗号，即默认将被处理文件视为 CSV , 当 delimiter='\t' 时，被处理文件就是TSV。
  };
  /**
   * 是否需要对数据进行 clone，默认为 true。
   * 如果考虑性能，你可以将其关闭，但是这会带了一些副作用，即我们会对传入的数据进行修改（不会对原有字段及值修改，只会在原有数据基础上添加一些字段）。
   * @default true
   * @since 1.3.0
   */
  clone?: boolean;
};
```

```ts
// example
const csvData = `date,最低,最高
周一,18,28
周二,19,30
周三,20,32
`;
const spec = {
  data: [
    {
      id: 'fieldsData',
      values: csvData,
      // parser 不配置的话，默认当做 csv 处理
      parser: {
        type: 'csv'
      }
    }
  ]
};
```

#${prefix} DataView

使用数据处理包 [**@visactor/dataset**](TODO:) 。

数据处理包提供 2 个核心对象：

1. 管理数据集的 **DataSet**
2. 数据对象 **DataView**

使用例子如下：

```ts
// 从包中导出需要的内容
import { DataSet, DataView, csvParser, fold } from '@visactor/dataset';

// 创建一个数据集
const dataSet = new DataSet();
// 注册数据 parser 和 transform。除了使用内置的 parser 和 transform 外，用户还可以按照接口自定义 parser 和 transform 。
dataSet.registerParser('csv', csvParser);
dataSet.registerTransform('fold', fold);
// 创建 dataView 。请务必设置数据集和名称，方便其他模块使用此数据
const dataView = new DataView(dataSet, { name: 'data' });
const csvData = `date,最低,最高
周一,18,28
周二,19,30
周三,20,32
`;
// 指定当前数据使用 csvParser 进行解析
dataView.parse(csvData, {
  type: 'csv'
});
// 添加 transform 处理数据
dataView.transform({
  type: 'fold',
  options: {
    fields: ['最低', '最高'], // 展开字段集
    key: 'type', // fields 内容转为到 key 字段
    value: 'value' // 对应数值转化到 value 字段
  }
});

// 最终数据
dataSet.getDataView('data').latestData ===
  [
    { date: '周一', type: '最低', temperature: 18 },
    { date: '周一', type: '最高', temperature: 28 },
    { date: '周二', type: '最低', temperature: 19 },
    { date: '周二', type: '最高', temperature: 30 },
    { date: '周三', type: '最低', temperature: 20 },
    { date: '周三', type: '最高', temperature: 32 }
  ];

// 在图表的数据中可以直接使用此对象
const spec: {
  data: [dataView];
  // ...
};
```
