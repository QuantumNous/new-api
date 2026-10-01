# React-VChart 问题诊断专项指南

> 本文档是场景一（问题诊断）的 React-VChart 专项补充，适用于使用 `@visactor/react-vchart` 库的 React 用户。

## 适用情况

当用户代码中出现以下特征时，使用本指南：

- 从 `@visactor/react-vchart` 导入组件
- 使用 `<BarChart>`、`<LineChart>`、`<VChart>` 等 JSX 标签
- React 项目中的图表问题
- 提及 React Hooks、状态管理、组件生命周期等

---

## React-VChart 特有问题诊断

### 1. 组件使用错误

#### 问题 1.1：组件类型选择错误

**识别信号**：

- 图表类型与组件不匹配
- 用户使用 `<LineChart>` 但想要柱状图

**诊断步骤**：

```
1. 确认用户意图的图表类型
2. 检查使用的组件标签是否匹配：
   - 柱状图 → <BarChart>
   - 折线图 → <LineChart>
   - 饼图 → <PieChart>
   - 通用 → <VChart> (需要 spec prop)
```

**修复示例**：

```jsx
// ❌ 错误
<LineChart data={data}>
  <Bar xField="x" yField="y" />
</LineChart>

// ✅ 正确
<BarChart data={data}>
  <Bar xField="x" yField="y" />
</BarChart>
```

#### 问题 1.2：组件嵌套错误

**识别信号**：

- 系列组件（如 `<Bar>`）未放在对应图表组件内
- 组件标签组合不合法

**诊断步骤**：

```
1. 检查系列组件是否在正确的父组件下：
   - <Bar> 必须在 <BarChart> 或 <CommonChart> 内
   - <Line> 必须在 <LineChart> 或 <CommonChart> 内
2. 检查组件组件（Axis、Legend）是否在图表组件内
```

**修复示例**：

```jsx
// ❌ 错误
<div>
  <Bar xField="x" yField="y" />
  <BarChart data={data} />
</div>

// ✅ 正确
<BarChart data={data}>
  <Bar xField="x" yField="y" />
  <Axis orient="bottom" />
  <Legend visible={true} />
</BarChart>
```

---

### 2. Props 传递问题

#### 问题 2.1：data prop 格式错误

**识别信号**：

- 图表不显示或报错 "data is not iterable"
- data 格式不符合 VChart 规范

**诊断步骤**：

```
1. 检查 data 是否为数组格式：[{ id, values }]
2. 确认 values 是否为数组
3. 检查数据字段是否与 xField/yField 匹配
```

**常见错误**：

```jsx
// ❌ 错误 1：直接传值数组
<BarChart data={[{x: 1, y: 2}, {x: 2, y: 3}]}>

// ❌ 错误 2：缺少 id
<BarChart data={[{ values: [...] }]}>

// ❌ 错误 3：values 不是数组
<BarChart data={[{ id: 'data', values: {...} }]}>

// ✅ 正确
<BarChart data={[{ id: 'data', values: [{x: 1, y: 2}, {x: 2, y: 3}] }]}>
```

#### 问题 2.2：配置对象 props 错误

**识别信号**：

- 样式配置不生效
- 嵌套对象配置语法错误

**诊断步骤**：

```
1. 确认对象型 props 使用双花括号 {{ }}
2. 检查对象内部属性名是否正确
3. 对照 VChart spec 文档验证配置项
```

**修复示例**：

```jsx
// ❌ 错误：单花括号
<Bar label={visible: true} />

// ✅ 正确：双花括号
<Bar label={{ visible: true }} />

// ✅ 正确：嵌套对象
<Bar
  label={{
    visible: true,
    style: { fill: 'red' }
  }}
/>
```

---

### 3. 状态更新问题

#### 问题 3.1：数据更新不触发重渲染

**识别信号**：

- 修改 state 后图表不更新
- 数据变化但图表保持旧数据

**诊断步骤**：

```
1. 检查是否使用了不可变更新方式
2. 确认 data prop 引用是否改变
3. 检查 React DevTools 确认组件是否重新渲染
```

**常见问题**：

```jsx
// ❌ 错误：直接修改数组（引用未变）
const handleUpdate = () => {
  chartData.push({ x: 5, y: 10 });
  setChartData(chartData); // 引用相同，不触发更新
};

// ✅ 正确：创建新数组
const handleUpdate = () => {
  setChartData([...chartData, { x: 5, y: 10 }]);
};

// ✅ 正确：使用不可变更新
const handleUpdate = () => {
  setChartData(prev => [...prev, { x: 5, y: 10 }]);
};
```

#### 问题 3.2：频繁更新导致性能问题

**识别信号**：

- 图表卡顿或闪烁
- 每次 state 变化都触发图表完全重绘

**诊断步骤**：

```
1. 检查 data 是否在每次渲染时创建新对象
2. 确认是否使用了 useMemo 优化
3. 检查父组件是否频繁重渲染
```

**优化方案**：

```jsx
// ❌ 问题：每次渲染创建新数据
function Chart() {
  const data = [{ id: 'data', values: generateData() }];
  return <BarChart data={data}>...</BarChart>;
}

// ✅ 优化 1：使用 useMemo
function Chart() {
  const data = useMemo(
    () => [{ id: 'data', values: generateData() }],
    [] // 依赖项
  );
  return <BarChart data={data}>...</BarChart>;
}

// ✅ 优化 2：使用 useState
function Chart() {
  const [data] = useState([{ id: 'data', values: generateData() }]);
  return <BarChart data={data}>...</BarChart>;
}
```

---

### 4. 事件处理问题

#### 问题 4.1：事件回调未触发

**识别信号**：

- onClick、onReady 等回调不执行
- 控制台无错误但事件无响应

**诊断步骤**：

```
1. 确认事件名是否正确（注意大小写）
2. 检查回调函数是否正确定义
3. 确认事件是否在正确的组件上监听
```

**常见错误**：

```jsx
// ❌ 错误 1：事件名错误
<BarChart onclick={handleClick}>  // 应为 onClick

// ❌ 错误 2：未传递函数
<BarChart onClick="handleClick">  // 应为 {handleClick}

// ❌ 错误 3：立即执行
<BarChart onClick={handleClick()}>  // 应为 {handleClick}

// ✅ 正确
<BarChart onClick={handleClick}>
  ...
</BarChart>

// ✅ 正确：内联函数
<BarChart onClick={(e) => console.log(e)}>
  ...
</BarChart>
```

#### 问题 4.2：onReady 获取实例错误

**识别信号**：

- 无法获取 VChart 实例
- 实例方法调用失败

**诊断步骤**：

```
1. 确认 onReady 回调参数接收实例
2. 检查实例保存方式（ref vs state）
3. 验证实例方法调用时机
```

**正确用法**：

```jsx
function Chart() {
  const chartRef = useRef(null);

  const handleReady = (instance, isInitial) => {
    chartRef.current = instance;
    console.log('Chart ready:', isInitial);
  };

  const updateChart = () => {
    if (chartRef.current) {
      chartRef.current.updateSpec({...});
    }
  };

  return (
    <BarChart onReady={handleReady}>
      <Bar xField="x" yField="y" />
    </BarChart>
  );
}
```

---

### 5. 生命周期和副作用问题

#### 问题 5.1：内存泄漏

**识别信号**：

- 组件卸载后仍有定时器运行
- 控制台警告 "Can't perform a React state update on an unmounted component"

**诊断步骤**：

```
1. 检查是否在 useEffect 中正确清理副作用
2. 确认事件监听器是否正确移除
3. 检查异步操作是否在组件卸载后仍执行
```

**修复示例**：

```jsx
// ❌ 问题：未清理定时器
function Chart() {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    const timer = setInterval(() => {
      setData(generateNewData());
    }, 1000);
    // 缺少清理函数
  }, []);

  return <BarChart data={data}>...</BarChart>;
}

// ✅ 正确：添加清理函数
function Chart() {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    const timer = setInterval(() => {
      setData(generateNewData());
    }, 1000);

    return () => clearInterval(timer); // 清理
  }, []);

  return <BarChart data={data}>...</BarChart>;
}
```

#### 问题 5.2：依赖项错误导致无限循环

**识别信号**：

- 页面卡死或持续重渲染
- 控制台疯狂输出日志

**诊断步骤**：

```
1. 检查 useEffect 依赖数组
2. 确认依赖项是否在每次渲染时变化
3. 检查是否在 effect 中修改了依赖项
```

**修复示例**：

```jsx
// ❌ 问题：依赖项每次都变化
function Chart({ config }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchData(config).then(setData);
  }, [config]); // config 每次都是新对象

  return <BarChart data={data}>...</BarChart>;
}

// ✅ 方案 1：使用 useMemo 稳定依赖
function Chart({ config }) {
  const [data, setData] = useState([]);
  const stableConfig = useMemo(() => config, [config.url, config.params]);

  useEffect(() => {
    fetchData(stableConfig).then(setData);
  }, [stableConfig]);

  return <BarChart data={data}>...</BarChart>;
}

// ✅ 方案 2：解构依赖
function Chart({ config }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchData(config).then(setData);
  }, [config.url, config.params]); // 只依赖具体值

  return <BarChart data={data}>...</BarChart>;
}
```

---

## 转换为 VChart Spec 诊断

当 React 特有问题排查完毕后，如果问题仍然存在，需要将 React 组件代码转换为等价的 VChart spec 进行深度诊断。

### 转换规则

| React 代码                             | VChart Spec                                  |
| -------------------------------------- | -------------------------------------------- |
| `<BarChart data={data}>`               | `{ type: 'bar', data: data }`                |
| `<Bar xField="x" yField="y" />`        | `{ xField: 'x', yField: 'y' }`               |
| `<Axis orient="bottom" type="band" />` | `axes: [{ orient: 'bottom', type: 'band' }]` |
| `<Legend visible={true} />`            | `legends: { visible: true }`                 |
| `label={{ visible: true }}`            | `label: { visible: true }`                   |

### 转换示例

```jsx
// React 组件代码
<BarChart data={[{ id: 'data', values: chartData }]}>
  <Bar xField="category" yField="value" label={{ visible: true }} />
  <Axis orient="bottom" type="band" />
  <Axis orient="left" type="linear" />
  <Legend visible={true} position="top" />
</BarChart>;

// 等价 VChart spec
const spec = {
  type: 'bar',
  data: [{ id: 'data', values: chartData }],
  xField: 'category',
  yField: 'value',
  label: { visible: true },
  axes: [
    { orient: 'bottom', type: 'band' },
    { orient: 'left', type: 'linear' }
  ],
  legends: { visible: true, position: 'top' }
};
```

转换后，使用标准 VChart 诊断流程（参考主文档 scenario-1-diagnosis.md）进行深度分析。

---

## 输出诊断结果

根据用户需求和对话上下文，灵活选择输出格式：

### 输出格式选择

**判断依据**：

```
if (用户明确要求"可运行的demo" || "能直接打开的文件" || "完整的HTML") {
  → 输出完整 HTML 文件（使用 Python 脚本生成）
} else if (用户询问"配置怎么写" || "代码示例" || 在讨论具体配置) {
  → 输出 React 组件代码
} else {
  → 默认输出 React 组件代码（更简洁、易于集成）
}
```

### 格式一：输出 React 组件代码（推荐）

直接输出可用的 React-VChart 组件代码，便于用户复制到项目中。

**输出示例**：

````markdown
## 问题诊断

**问题**：图表 Y 轴没有数据显示

**原因**：yField 属性值为 'values'，但数据字段名为 'value'

**修复建议**：确保字段名与数据一致

## 用户原始代码

```jsx
import React from 'react';
import { BarChart, Bar } from '@visactor/react-vchart';

const ChartComponent = () => {
  const chartData = [
    { category: 'A', value: 10 },
    { category: 'B', value: 20 }
  ];

  return (
    <BarChart data={[{ id: 'data', values: chartData }]}>
      <Bar xField="category" yField="values" /> {/* ❌ 错误 */}
    </BarChart>
  );
};
```

## 修复方案

```jsx
import React from 'react';
import { BarChart, Bar } from '@visactor/react-vchart';

const ChartComponent = () => {
  const chartData = [
    { category: 'A', value: 10 },
    { category: 'B', value: 20 }
  ];

  return (
    <BarChart data={[{ id: 'data', values: chartData }]}>
      <Bar xField="category" yField="value" /> {/* ✅ 修正 */}
    </BarChart>
  );
};
```
````

### 格式二：输出完整 HTML（按需）

当用户需要完整的可运行演示时，使用 `template/diagnosis-react.html` 模板，通过 Python 脚本生成诊断 HTML。

#### 模板特点

- ✅ 已引入 React 18、ReactDOM、Babel
- ✅ 已引入 React-VChart 库
- ✅ 支持 JSX 语法（通过 Babel 转译）
- ✅ 支持 Monaco Editor 代码编辑
- ✅ 实际渲染 React 组件

#### 使用 Python 脚本生成诊断 HTML

推荐使用 `scripts/generate_diagnosis_react_html.py` 脚本，通过命令行参数生成诊断 HTML。

> 💡 **参数详情**：参见 [脚本参数参考](../references/SCRIPT_PARAMS_REFERENCE.md#generate_diagnosis_react_htmlpy)

#### 脚本使用示例

**最小示例**（单方案）：

```bash
python3 scripts/generate_diagnosis_react_html.py \
  --problem-code "const Chart = () => <BarChart />" \
  --problem-title "图表不显示" \
  --cause "缺少必需的 data 属性" \
  --solution-1-title "添加 data 属性" \
  --solution-1-desc "为 BarChart 组件添加必需的 data 属性" \
  --solution-1-code "const Chart = () => <BarChart data={[...]} />"
```

**完整示例**（多方案 + 可选参数）：

```bash
python3 scripts/generate_diagnosis_react_html.py \
  --problem-code "用户的原始 React 代码" \
  --problem-title "图表 Y 轴没有数据显示" \
  --cause "yField 属性值错误" \
  --suggestion "确保字段名与数据一致" \
  --solution-1-title "修正字段映射" \
  --solution-1-desc "将 yField 从 \"values\" 改为 \"value\"" \
  --solution-1-code "修复后的代码" \
  --output diagnosis_result.html
```

#### 主要参数

- `--problem-code`：用户的原始 React 组件代码（JSX 格式）
- `--problem-title`：问题简述
- `--cause`：问题原因分析
- `--solution-N-title/desc/code`：第 N 个解决方案（N 从 1 开始连续编号）
- `--output`：输出 HTML 文件路径（可选，默认 `output/diagnosis_react.html`）

#### 配置对象结构

脚本会自动替换模板中 `CONFIG_START` 和 `CONFIG_END` 注释之间的三个 JavaScript 对象：

**1. problemReview（问题回顾）**

```javascript
const problemReview = {
  code: `[用户原始代码]`
};
```

**2. diagnosis（诊断分析）**

```javascript
const diagnosis = {
  problem: '[问题简述]',
  cause: '[原因分析]',
  suggestion: '[修复建议]' // 可选
};
```

**3. solutions（解决方案数组）**

```javascript
const solutions = [
  {
    title: '[方案标题]',
    description: '[方案描述]',
    code: `[修复代码]`
  }
  // 更多方案...
];
```

#### 实际使用示例

```bash
python3 scripts/generate_diagnosis_react_html.py \
  --problem-code "const ChartComponent = () => {
  const chartData = [
    { category: 'A', value: 10 },
    { category: 'B', value: 20 }
  ];

  return (
    <BarChart data={[{ id: 'data', values: chartData }]}>
      <Bar xField=\"category\" yField=\"values\" />
    </BarChart>
  );
};" \
  --problem-title "图表 Y 轴没有数据显示，柱状图高度为 0" \
  --cause "Bar 组件的 yField 属性值为 'values'，但数据字段名为 'value'，字段名不匹配导致无法正确映射数据" \
  --suggestion "确保组件 props 中的 xField/yField 与数据对象的属性名严格一致" \
  --solution-1-title "修正字段映射" \
  --solution-1-desc "将 Bar 组件的 yField 属性从 'values' 修正为 'value'，与数据字段名保持一致。" \
  --solution-1-code "const ChartComponent = () => {
  const chartData = [
    { category: 'A', value: 10 },
    { category: 'B', value: 20 }
  ];

  return (
    <BarChart data={[{ id: 'data', values: chartData }]}>
      <Bar xField=\"category\" yField=\"value\" />
    </BarChart>
  );
};" \
  --output my_diagnosis.html
```

#### 多方案输出

若有多个解决方案，继续添加参数：

```bash
python3 scripts/generate_diagnosis_react_html.py \
  --problem-code "..." \
  --problem-title "..." \
  --cause "..." \
  --solution-1-title "方案 1" \
  --solution-1-desc "..." \
  --solution-1-code "..." \
  --solution-2-title "方案 2（Hook 优化版）" \
  --solution-2-desc "..." \
  --solution-2-code "..." \
  --output result.html
```

#### 输出文件

生成的 HTML 文件包含：

- **问题回顾区**：展示用户原始代码
- **诊断分析区**：说明问题原因和建议
- **解决方案区**：多个可编辑且可实时运行的 React 组件方案
- **Monaco Editor**：支持在线编辑和实时调试

### 脚本实现原理

脚本 `generate_diagnosis_react_html.py` 的工作流程：

1. **参数解析**：使用 argparse 解析命令行参数
2. **配置块生成**：根据参数生成 JavaScript 配置对象
   - 转义特殊字符（引号、换行等）
   - 生成 `problemReview`、`diagnosis`、`solutions` 配置
3. **模板替换**：使用正则表达式匹配并替换模板中 `CONFIG_START` 和 `CONFIG_END` 之间的内容
4. **文件输出**：创建输出目录并写入修改后的 HTML 文件

**核心函数**：

- `escape_js_string()`：转义 JavaScript 字符串特殊字符
- `generate_solutions_config()`：生成 solutions 数组配置
- `generate_config_block()`：生成完整配置块
- `main()`：命令行接口与文件操作

### 进阶用法

#### 直接调用 Python API

除了命令行调用，还可以直接在代码中调用脚本函数：

```python
from generate_diagnosis_react_html import generate_config_block, generate_solutions_config
from pathlib import Path
import re

# 生成配置块
config_block = generate_config_block(
    problem_code="const Chart = () => {...}",
    problem_title="图表问题",
    cause="原因分析",
    suggestion="修复建议",
    solutions=[
        {"title": "方案1", "desc": "描述", "code": "代码"}
    ]
)

# 读取模板并替换
template = Path("template/diagnosis-react.html").read_text()
html = re.sub(
    r"// ====== CONFIG_START ======.*?// ====== CONFIG_END ======",
    config_block,
    template,
    flags=re.DOTALL
)

# 保存输出
Path("output.html").write_text(html)
```

#### 批量生成多个诊断文件

```bash
#!/bin/bash

# 批量诊断脚本示例
python3 scripts/generate_diagnosis_react_html.py \
  --problem-code "问题代码1" \
  --problem-title "问题1" \
  --cause "原因1" \
  --solution-1-title "方案1" \
  --solution-1-desc "描述1" \
  --solution-1-code "代码1" \
  --output "diagnosis_case1.html"

python3 scripts/generate_diagnosis_react_html.py \
  --problem-code "问题代码2" \
  --problem-title "问题2" \
  --cause "原因2" \
  --solution-1-title "方案1" \
  --solution-1-desc "描述1" \
  --solution-1-code "代码1" \
  --output "diagnosis_case2.html"
```

---

## React 特定最佳实践

### 1. 数据管理

```jsx
// ✅ 推荐：使用 useState 管理图表数据
const [chartData, setChartData] = useState(initialData);

// ✅ 推荐：数据不变时使用 useMemo
const formattedData = useMemo(() => rawData.map(item => ({ ...item, value: item.value * 100 })), [rawData]);

// ✅ 推荐：复杂数据转换使用 useCallback
const transformData = useCallback(raw => {
  return raw.filter(item => item.value > 0);
}, []);
```

### 2. 性能优化

```jsx
// ✅ 使用 React.memo 避免不必要的重渲染
const MemoizedChart = React.memo(
  ({ data, config }) => (
    <BarChart data={data}>
      <Bar {...config} />
    </BarChart>
  ),
  (prevProps, nextProps) => {
    return prevProps.data === nextProps.data && prevProps.config === nextProps.config;
  }
);

// ✅ 拆分大型配置对象
const axesConfig = useMemo(
  () => [
    { orient: 'bottom', type: 'band' },
    { orient: 'left', type: 'linear' }
  ],
  []
);
```

### 3. 实例管理

```jsx
// ✅ 推荐：使用 ref 保存图表实例
const chartRef = useRef(null);

const handleReady = useCallback(instance => {
  chartRef.current = instance;
}, []);

// ✅ 调用实例方法
const exportImage = useCallback(() => {
  if (chartRef.current) {
    chartRef.current.exportImg();
  }
}, []);
```

---

## React 脚本故障排除

### 使用 Python 脚本注意事项

1. **JSX 代码转义**：命令行中传递 JSX 代码时，使用单引号包裹整个代码块，内部使用转义的双引号
2. **代码长度**：避免在命令行中传递超过 10 行的复杂代码，考虑使用配置文件方式
3. **方案编号**：确保方案编号连续（1, 2, 3...），不要跳号
4. **路径问题**：在 `vchart-development-assistant` 目录下运行脚本，确保模板文件路径正确

---

## 参考资源

- **官方文档**：https://visactor.com/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react
- **GitHub 仓库**：https://github.com/VisActor/VChart/tree/develop/packages/react-vchart
- **API 文档**：https://github.com/VisActor/VChart/blob/main/packages/react-vchart/docs/2.1%20API设计.md
- **VChart 主文档**：参考 scenario-1-diagnosis.md 进行深度配置诊断
