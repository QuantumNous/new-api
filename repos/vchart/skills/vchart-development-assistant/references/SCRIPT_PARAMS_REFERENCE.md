# Python 脚本参数参考

本文档提供所有 Python 脚本的参数详细说明。

---

## generate_diagnosis_html.py

**用途**：生成 VChart 配置问题诊断 HTML 报告

**适用场景**：[scenario-1-diagnosis.md](../workflows/scenario-1-diagnosis.md)

### 参数列表

| 参数            | 类型   | 必需 | 默认值                           | 说明                                                            |
| --------------- | ------ | ---- | -------------------------------- | --------------------------------------------------------------- |
| `--title`       | string | ❌   | `"VChart 问题诊断报告"`          | 诊断报告的标题，显示在 HTML 页面顶部                            |
| `--desc`        | string | ❌   | `"基于用户配置的诊断与修复结果"` | 报告描述，概述诊断内容                                          |
| `--config-file` | path   | ❌   | 使用内置示例                     | 包含 `problemReview`/`diagnosis`/`solutions` 的 JS 配置文件路径 |
| `--output`      | path   | ❌   | `"output/diagnosis.html"`        | 输出 HTML 文件的保存路径                                        |

### 配置文件格式

`--config-file` 指向的 JavaScript 文件必须包含以下三个对象：

```javascript
// 1. 问题回顾
const problemReview = {
  highlightLines: [11], // 可选：高亮行号数组
  specCode: `[用户原始代码]`, // 必需：完整代码字符串
};

// 2. 诊断分析
const diagnosis = {
  problem: "[问题简述]", // 必需
  cause: "[原因分析]", // 必需
  suggestion: "[修复建议]", // 可选
};

// 3. 解决方案数组
const solutions = [
  {
    title: "[方案标题]", // 必需
    description: "[方案描述]", // 必需
    highlightLines: [11], // 可选
    specCode: `[修复代码]`, // 必需
  },
];
```

### 使用示例

**最小示例**（使用默认参数）：

```bash
python3 scripts/generate_diagnosis_html.py --config-file config.js
```

**完整示例**（自定义所有参数）：

```bash
python3 scripts/generate_diagnosis_html.py \
  --title "字段映射错误诊断" \
  --desc "柱状图 Y 轴数据显示问题分析" \
  --config-file configs/bar_yfield_error.js \
  --output output/diagnosis_bar_yfield.html
```

### 输出文件

生成的 HTML 文件包含：

- 📋 **问题回顾区**：展示用户原始代码（支持语法高亮）
- 🔍 **诊断分析区**：问题、原因、建议说明
- ✅ **解决方案区**：多个可编辑、可实时运行的修复方案
- 💻 **Monaco Editor**：在线代码编辑器，支持实时预览

---

## generate_demo_html.py

**用途**：生成 VChart 配置示例演示 HTML

**适用场景**：

- [scenario-2-generation.md](../workflows/scenario-2-generation.md)（配置生成）
- [scenario-3-image-replication.md](../workflows/scenario-3-image-replication.md)（图片还原）

### 参数列表

| 参数          | 类型   | 必需 | 默认值                           | 说明                                    |
| ------------- | ------ | ---- | -------------------------------- | --------------------------------------- |
| `--title`     | string | ❌   | `"VChart 图表示例"`              | 页面标题，显示在 HTML 页面顶部          |
| `--desc`      | string | ❌   | `"基于需求生成的可运行图表配置"` | 页面描述，概述示例内容                  |
| `--feature`   | string | ❌   | `"补充主要功能说明"`             | 主要功能说明，描述图表实现的核心特性    |
| `--tips`      | string | ❌   | `"补充编辑提示"`                 | 编辑提示，指导用户可调整的配置项        |
| `--spec-file` | path   | ❌   | 使用内置示例                     | 包含完整 VChart spec 配置的 JS 文件路径 |
| `--output`    | path   | ❌   | `"output/demo.html"`             | 输出 HTML 文件的保存路径                |

### Spec 文件格式

`--spec-file` 指向的 JavaScript 文件必须包含完整的 VChart spec 对象：

```javascript
const spec = {
  type: "bar", // 必需：图表类型
  data: {
    // 必需：数据源
    values: [
      { category: "A", value: 10 },
      { category: "B", value: 20 },
    ],
  },
  xField: "category", // 必需：X 轴字段映射
  yField: "value", // 必需：Y 轴字段映射
  // 其他可选配置...
  label: { visible: true },
  tooltip: { visible: true },
};
```

### 使用示例

**最小示例**（使用默认参数）：

```bash
python3 scripts/generate_demo_html.py --spec-file spec.js
```

**完整示例**（配置生成场景）：

```bash
python3 scripts/generate_demo_html.py \
  --title "柱状图标签功能示例" \
  --desc "展示如何配置数据标签" \
  --feature "在柱子上显示数值标签，支持自定义格式化" \
  --tips "可修改 label.position、label.style 调整标签位置和样式" \
  --spec-file specs/bar_with_labels.js \
  --output output/demo_bar_labels.html
```

**完整示例**（图片还原场景）：

```bash
python3 scripts/generate_demo_html.py \
  --title "销售趋势图还原" \
  --desc "基于设计稿还原的折线图" \
  --feature "还原了渐变填充、数据标签位置、坐标轴样式" \
  --tips "可调整 color、line.style、point.style 优化视觉效果" \
  --spec-file specs/sales_trend_replication.js \
  --output output/replication_sales_trend.html
```

### 输出文件

生成的 HTML 文件包含：

- 📊 **图表预览区**：实时渲染的图表
- 📝 **功能说明**：展示 `--feature` 内容
- 💡 **编辑提示**：展示 `--tips` 内容
- 💻 **Monaco Editor**：可编辑 spec 配置，实时预览修改效果

---

## generate_diagnosis_react_html.py

**用途**：生成 React-VChart 组件问题诊断 HTML 报告

**适用场景**：[scenario-1-react.md](../workflows/scenario-1-react.md)

### 参数列表

| 参数                 | 类型   | 必需 | 默认值                          | 说明                                  |
| -------------------- | ------ | ---- | ------------------------------- | ------------------------------------- |
| `--problem-code`     | string | ✅   | -                               | 用户的原始 React 组件代码（JSX 格式） |
| `--problem-title`    | string | ✅   | -                               | 问题简述，概括问题现象                |
| `--cause`            | string | ✅   | -                               | 问题原因分析                          |
| `--suggestion`       | string | ❌   | -                               | 修复建议（可选）                      |
| `--solution-N-title` | string | ✅   | -                               | 第 N 个解决方案的标题                 |
| `--solution-N-desc`  | string | ✅   | -                               | 第 N 个解决方案的描述                 |
| `--solution-N-code`  | string | ✅   | -                               | 第 N 个解决方案的修复代码             |
| `--output`           | path   | ❌   | `"output/diagnosis_react.html"` | 输出 HTML 文件的保存路径              |

**注意**：

- `N` 必须从 1 开始连续编号（1, 2, 3...）
- 每个方案必须同时提供 `title`、`desc`、`code` 三个参数
- 不支持跳号（例如 1, 3, 5 是无效的）

### 使用示例

**单方案示例**：

```bash
python3 scripts/generate_diagnosis_react_html.py \
  --problem-code "const Chart = () => <BarChart data={data}><Bar xField=\"cat\" yField=\"values\" /></BarChart>" \
  --problem-title "图表 Y 轴没有数据显示" \
  --cause "Bar 组件的 yField 值为 'values'，但数据字段名为 'value'" \
  --suggestion "确保 xField/yField 与数据字段名严格一致" \
  --solution-1-title "修正字段映射" \
  --solution-1-desc "将 yField 从 'values' 改为 'value'" \
  --solution-1-code "const Chart = () => <BarChart data={data}><Bar xField=\"cat\" yField=\"value\" /></BarChart>" \
  --output output/react_yfield_fix.html
```

**多方案示例**：

```bash
python3 scripts/generate_diagnosis_react_html.py \
  --problem-code "const Chart = () => { const data = getData(); return <BarChart data={data} />; }" \
  --problem-title "图表渲染性能问题" \
  --cause "getData() 在每次渲染时重新执行，导致不必要的计算" \
  --solution-1-title "使用 useMemo 优化" \
  --solution-1-desc "使用 useMemo 缓存计算结果" \
  --solution-1-code "const Chart = () => { const data = useMemo(() => getData(), []); return <BarChart data={data} />; }" \
  --solution-2-title "移至组件外部" \
  --solution-2-desc "将静态数据移至组件外部定义" \
  --solution-2-code "const data = getData(); const Chart = () => <BarChart data={data} />;" \
  --output output/react_performance_fix.html
```

### 特殊字符处理

由于需要在命令行中传递 JSX 代码，注意以下转义规则：

**双引号**：

```bash
# ❌ 错误：双引号冲突
--problem-code "<Bar xField="category" />"

# ✅ 方法1：使用单引号包裹
--problem-code '<Bar xField="category" />'

# ✅ 方法2：转义双引号
--problem-code "<Bar xField=\"category\" />"
```

**换行符**：

```bash
# ❌ 不推荐：多行代码容易出错
--problem-code "const Chart = () => {
  return <BarChart />;
}"

# ✅ 推荐：简化为单行
--problem-code "const Chart = () => <BarChart />"
```

### 输出文件

生成的 HTML 文件包含：

- 📋 **问题回顾区**：展示用户原始 React 代码
- 🔍 **诊断分析区**：问题、原因、建议说明
- ✅ **解决方案区**：多个可编辑、可实时运行的 React 组件方案
- ⚛️ **React 渲染**：使用 Babel 转译 JSX，实时渲染组件
- 💻 **Monaco Editor**：支持 JSX 语法高亮

---

## 参数对比总结

| 特性         | generate_diagnosis_html.py | generate_demo_html.py             | generate_diagnosis_react_html.py |
| ------------ | -------------------------- | --------------------------------- | -------------------------------- |
| **输入方式** | 配置文件（config.js）      | Spec 文件（spec.js）              | 命令行参数                       |
| **标题参数** | `--title`                  | `--title`                         | -                                |
| **描述参数** | `--desc`                   | `--desc` + `--feature` + `--tips` | `--problem-title` + `--cause`    |
| **代码输入** | 文件中的 `specCode`        | 文件中的 `spec`                   | `--problem-code` 参数            |
| **方案定义** | 文件中的 `solutions` 数组  | 单一 spec                         | `--solution-N-*` 参数            |
| **高亮行号** | 支持（`highlightLines`）   | 不支持                            | 不支持                           |
| **输出路径** | `--output`                 | `--output`                        | `--output`                       |

---

## 快速查询

### 按场景查找脚本

| 场景                  | 推荐脚本                           | 关键参数                             |
| --------------------- | ---------------------------------- | ------------------------------------ |
| VChart 配置问题诊断   | `generate_diagnosis_html.py`       | `--config-file`                      |
| 配置生成展示          | `generate_demo_html.py`            | `--spec-file`, `--feature`, `--tips` |
| 图片/Figma 还原展示   | `generate_demo_html.py`            | `--spec-file`, `--feature`, `--tips` |
| React-VChart 问题诊断 | `generate_diagnosis_react_html.py` | `--problem-code`, `--solution-N-*`   |

### 按输入文件类型查找

| 输入文件类型 | 脚本                               | 文件格式要求                                 |
| ------------ | ---------------------------------- | -------------------------------------------- |
| `config.js`  | `generate_diagnosis_html.py`       | 包含 `problemReview`/`diagnosis`/`solutions` |
| `spec.js`    | `generate_demo_html.py`            | 包含 VChart `spec` 对象                      |
| 无需文件     | `generate_diagnosis_react_html.py` | 通过命令行参数传递                           |

---

## 常见问题

### Q: 如何查看脚本的帮助信息？

```bash
python3 scripts/generate_diagnosis_html.py --help
python3 scripts/generate_demo_html.py --help
python3 scripts/generate_diagnosis_react_html.py --help
```

### Q: 参数中包含空格怎么办？

使用引号包裹：

```bash
--title "这是一个包含空格的标题"
```

### Q: 如何使用相对路径？

所有路径参数都支持相对路径（相对于脚本运行目录）：

```bash
--spec-file ./specs/bar.js           # 当前目录下的 specs 文件夹
--output ../output/demo.html         # 上级目录的 output 文件夹
```

### Q: 默认值是什么意思？

标记为"必需 ❌"的参数可以省略，脚本会使用默认值。例如：

```bash
# 使用默认标题和输出路径
python3 scripts/generate_demo_html.py --spec-file spec.js

# 等同于
python3 scripts/generate_demo_html.py \
  --title "VChart 图表示例" \
  --desc "基于需求生成的可运行图表配置" \
  --spec-file spec.js \
  --output output/demo.html
```

---

## 相关文档

- **故障排除**：[SCRIPTS_TROUBLESHOOTING.md](SCRIPTS_TROUBLESHOOTING.md) - 常见问题解决方案
- **文件命名**：[FILE_NAMING_CONVENTIONS.md](FILE_NAMING_CONVENTIONS.md) - 输入文件格式和命名约定
- **诊断场景**：[scenario-1-diagnosis.md](../workflows/scenario-1-diagnosis.md)
- **生成场景**：[scenario-2-generation.md](../workflows/scenario-2-generation.md)
- **图片还原**：[scenario-3-image-replication.md](../workflows/scenario-3-image-replication.md)
- **React 诊断**：[scenario-1-react.md](../workflows/scenario-1-react.md)
