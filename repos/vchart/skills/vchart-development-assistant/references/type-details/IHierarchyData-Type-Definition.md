# IHierarchyData 类型定义

## 基本信息

`IHierarchyData` 是 VChart 中用于处理层级数据的联合类型，主要用于树形图表（如 treemap、sunburst、circle packing 等）的数据结构定义。该类型支持两种不同的数据形式：DataView 实例和 IHierarchyDataValues 接口。

```typescript
type IHierarchyData = DataView | IHierarchyDataValues;
```

## 核心类型组成

### 1. DataView（@visactor/vdataset）

DataView 是来自 `@visactor/vdataset` 包的数据视图对象，是一个智能数据容器，提供数据处理和转换能力。

```typescript
// 来自 @visactor/vdataset
interface DataView {
  // 数据视图的具体实现
  // 提供数据操作、统计、转换功能
  name: string | number;
  latestData: any;
  parse: (data: any, parser?: any) => void;
  transform: (options: any) => void;
  // 更多方法...
}
```

**特点：**
- 支持数据解析和转换
- 提供数据统计功能
- 支持数据管道处理
- 可与 DataSet 配合使用

### 2. IHierarchyDataValues 接口

```typescript
interface IHierarchyDataValues extends IDataValues {
  values: IHierarchyNodeData;
}
```

#### 2.1 基础接口 IDataValues

```typescript
interface IDataValues {
  id?: string | number;
  fields?: IFields;
  transforms?: ITransformOptions[];
  parser?: IParserOptions;
  fromDataId?: string;
  fromDataIndex?: number;
}
```

#### 2.2 核心节点类型 IHierarchyNodeData

```typescript
interface IHierarchyNodeData extends Datum {
  value?: number;
  children?: IHierarchyNodeData[];
}
```

#### 2.3 基础数据类型 Datum

```typescript
type Datum = {
  [key: string]: any;
};
```

## 递归数据结构分析

### 层级节点结构

```typescript
// 层级节点的完整定义
interface IHierarchyNodeData {
  // 继承所有 Datum 属性（键值对数据）
  [key: string]: any;
  
  // 节点数值（可选）
  value?: number;
  
  // 子节点数组（可选，支持递归）
  children?: IHierarchyNodeData[];
}
```

### 数据层级示例

```typescript
// 典型的层级数据结构
const hierarchyData: IHierarchyNodeData = {
  name: "root",
  value: 100,
  children: [
    {
      name: "category1",
      value: 60,
      children: [
        { name: "item1", value: 30 },
        { name: "item2", value: 30 }
      ]
    },
    {
      name: "category2", 
      value: 40,
      children: [
        { name: "item3", value: 25 },
        { name: "item4", value: 15 }
      ]
    }
  ]
};
```

## 使用场景分析

### 1. DataView 形式使用

```typescript
// 通过 DataView 处理层级数据
import { DataView, DataSet } from '@visactor/vdataset';

const dataSet = new DataSet();
const hierarchyDataView = new DataView(dataSet, { name: 'hierarchy' });

// 解析和转换层级数据
hierarchyDataView.parse(rawHierarchyData);
hierarchyDataView.transform({
  type: 'hierarchyTransform',
  options: { /* transform options */ }
});

// 在图表中使用
const chartSpec = {
  type: 'treemap',
  data: hierarchyDataView, // DataView 实例
  // 其他配置...
};
```

### 2. IHierarchyDataValues 形式使用

```typescript
// 直接使用层级数据值
const hierarchyDataValues: IHierarchyDataValues = {
  id: 'hierarchy-data',
  values: {
    name: 'Root',
    children: [
      {
        name: 'Branch 1',
        value: 50,
        children: [
          { name: 'Leaf 1', value: 25 },
          { name: 'Leaf 2', value: 25 }
        ]
      },
      {
        name: 'Branch 2', 
        value: 30
      }
    ]
  }
};

// 在图表中使用
const chartSpec = {
  type: 'sunburst',
  data: hierarchyDataValues, // IHierarchyDataValues 对象
  // 其他配置...
};
```

### 3. 树形图表类型支持

- **Treemap（矩形树图）**: 使用层级数据表示区域大小
- **Sunburst（旭日图）**: 使用层级数据表示环形分层
- **Circle Packing（圆形包装图）**: 使用层级数据表示圆形嵌套
- **Tree（树状图）**: 使用层级数据表示节点连接

## 相关工具函数

VChart 提供了多个用于处理层级数据的工具函数：

```typescript
// 查找层级节点
function findHierarchyNode(data: any, predicate: (node: any) => boolean): any;

// 过滤层级数据范围
function filterHierarchyDataByRange(data: any, range: any): any;

// 判断是否为层级项
function isHierarchyItem(item: any): boolean;
```

## 数据转换支持

### 层级数据统计转换

```typescript
// 专门的层级数据统计
registerDataSetInstanceTransform(dataSet, 'hierarchyDimensionStatistics', hierarchyDimensionStatistics);

// 应用统计转换
dataView.transform({
  type: 'hierarchyDimensionStatistics',
  options: {
    fields: ['value', 'name'],
    operations: ['sum', 'count']
  }
});
```

### 层级数据展平

```typescript
// 对象展平转换（用于层级数据处理）
dataView.transform({
  type: 'objFlat',
  options: 'children' // 展开 children 数组
});
```

## 类型约束与验证

### 1. 数据完整性

```typescript
// 确保层级数据的完整性
function validateHierarchyData(data: IHierarchyData): boolean {
  if (data instanceof DataView) {
    return data.latestData !== null;
  }
  
  return data.values && typeof data.values === 'object';
}
```

### 2. 节点属性检查

```typescript
// 检查节点是否包含必要属性
function hasRequiredProperties(node: IHierarchyNodeData): boolean {
  return 'value' in node || 'children' in node;
}
```

## 使用建议

### 1. 数据源选择

- **使用 DataView**: 当需要复杂数据处理、统计计算或数据转换时
- **使用 IHierarchyDataValues**: 当数据结构简单、不需要额外处理时

### 2. 性能优化

- 对于大型层级数据，优先使用 DataView 进行数据预处理
- 合理设置 `value` 属性以避免不必要的计算
- 使用适当的数据转换减少层级深度

### 3. 数据结构设计

- 确保每个节点都有唯一标识符
- 合理组织 `children` 数组避免过深嵌套
- 在叶子节点上提供具体的 `value` 值

## 实际应用示例

```typescript
// 完整的层级图表配置示例
const hierarchyChartSpec = {
  type: 'treemap',
  data: {
    id: 'hierarchy',
    values: {
      name: 'Sales Data',
      children: [
        {
          name: 'Q1',
          children: [
            { name: 'Jan', value: 100 },
            { name: 'Feb', value: 150 },
            { name: 'Mar', value: 200 }
          ]
        },
        {
          name: 'Q2', 
          children: [
            { name: 'Apr', value: 180 },
            { name: 'May', value: 220 },
            { name: 'Jun', value: 250 }
          ]
        }
      ]
    }
  },
  categoryField: 'name',
  valueField: 'value'
};
```
