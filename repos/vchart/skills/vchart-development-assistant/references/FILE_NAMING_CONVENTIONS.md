# 文件命名约定指南

## 概述

不同 Python 脚本使用不同的输入文件格式和命名约定。请严格遵循本指南，避免在场景间混淆文件名和格式。

---

## 输入文件约定

### generate_diagnosis_html.py

**输入文件名**：`config.js`（推荐）或自定义名称

**文件格式**：JavaScript 配置对象

**必需内容**：

```javascript
// 1. 问题回顾对象
const problemReview = {
  highlightLines: [11], // 可选：高亮行号数组
  specCode: `[用户原始代码]`, // 必需：完整 JS 代码字符串
};

// 2. 诊断分析对象
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
  // 可添加更多方案...
];
```

**使用示例**：

```bash
python3 scripts/generate_diagnosis_html.py \
  --title "诊断报告" \
  --desc "问题分析结果" \
  --config-file config.js \
  --output output/diagnosis.html
```

**适用场景**：

- [scenario-1-diagnosis.md](../workflows/scenario-1-diagnosis.md)（VChart 问题诊断）

---

### generate_demo_html.py

**输入文件名**：`spec.js`（推荐）或自定义名称

**文件格式**：VChart Spec 配置（JavaScript）

**必需内容**：

```javascript
const spec = {
  type: "bar", // 图表类型
  data: {
    values: [
      { category: "A", value: 10 },
      { category: "B", value: 20 },
    ],
  },
  xField: "category",
  yField: "value",
  // 其他 VChart 配置...
};
```

**使用示例**：

```bash
python3 scripts/generate_demo_html.py \
  --title "图表示例" \
  --desc "演示配置" \
  --feature "展示柱状图基本配置" \
  --tips "可调整 xField/yField" \
  --spec-file spec.js \
  --output output/demo.html
```

**适用场景**：

- [scenario-2-generation.md](../workflows/scenario-2-generation.md)（配置生成）
- [scenario-3-image-replication.md](../workflows/scenario-3-image-replication.md)（图片还原）

---

### generate_diagnosis_react_html.py

**输入文件名**：无（使用命令行参数）

**文件格式**：不需要输入文件，所有内容通过命令行参数传递

**必需参数**：

```bash
--problem-code "原始 React 代码"    # JSX 格式代码
--problem-title "问题标题"         # 问题简述
--cause "问题原因"                 # 原因分析
--solution-N-title "方案标题"      # 第 N 个方案标题
--solution-N-desc "方案描述"       # 第 N 个方案描述
--solution-N-code "修复代码"       # 第 N 个方案代码
```

**使用示例**：

```bash
python3 scripts/generate_diagnosis_react_html.py \
  --problem-code "const Chart = () => <BarChart />" \
  --problem-title "图表不显示" \
  --cause "数据格式错误" \
  --solution-1-title "修正数据格式" \
  --solution-1-desc "添加必需的 values 字段" \
  --solution-1-code "const Chart = () => <BarChart data={...} />" \
  --output output/diagnosis_react.html
```

**适用场景**：

- [scenario-1-react.md](../workflows/scenario-1-react.md)（React-VChart 诊断）

---

## 快速对照表

| 脚本                                 | 输入文件    | 文件格式    | 必需字段                                           | 适用场景             |
| ------------------------------------ | ----------- | ----------- | -------------------------------------------------- | -------------------- |
| **generate_diagnosis_html.py**       | `config.js` | JS 配置对象 | `problemReview`<br>`diagnosis`<br>`solutions`      | VChart 问题诊断      |
| **generate_demo_html.py**            | `spec.js`   | VChart Spec | `type`<br>`data`<br>`xField`/`yField`              | 配置生成<br>图片还原 |
| **generate_diagnosis_react_html.py** | 无          | 命令行参数  | `--problem-code`<br>`--problem-title`<br>`--cause` | React 诊断           |

---

## 常见混淆场景

### ❌ 错误：在 generate_demo_html.py 中使用 config.js

```bash
# ❌ 错误：文件格式不匹配
python3 scripts/generate_demo_html.py --spec-file config.js

# config.js 包含的是诊断配置（problemReview/diagnosis/solutions）
# 而 generate_demo_html.py 需要的是 VChart spec
```

**正确做法**：

```bash
# ✅ 正确：使用 spec.js
python3 scripts/generate_demo_html.py --spec-file spec.js
```

---

### ❌ 错误：在 generate_diagnosis_html.py 中使用 spec.js

```bash
# ❌ 错误：文件格式不匹配
python3 scripts/generate_diagnosis_html.py --config-file spec.js

# spec.js 仅包含 VChart spec 配置
# 而 generate_diagnosis_html.py 需要包含 problemReview/diagnosis/solutions
```

**正确做法**：

```bash
# ✅ 正确：使用 config.js
python3 scripts/generate_diagnosis_html.py --config-file config.js
```

---

### ❌ 错误：为 React 脚本创建输入文件

```bash
# ❌ 不需要：React 脚本不使用输入文件
cat > react_config.js << 'EOF'
...
EOF

python3 scripts/generate_diagnosis_react_html.py --config-file react_config.js
```

**正确做法**：

```bash
# ✅ 正确：直接使用命令行参数
python3 scripts/generate_diagnosis_react_html.py \
  --problem-code "..." \
  --problem-title "..." \
  --cause "..."
```

---

## 文件创建模板

### 创建 config.js（用于诊断场景）

```bash
cat > config.js << 'EOF'
const problemReview = {
  specCode: `const spec = {
  type: "bar",
  data: {
    values: [
      { category: "A", value: 10 }
    ]
  },
  xField: "category",
  yField: "values"  // 错误：应为 "value"
};`
};

const diagnosis = {
  problem: "柱状图高度为 0，Y 轴无数据",
  cause: "yField 值为 'values'，但数据字段名为 'value'，字段名不匹配",
  suggestion: "确保 xField/yField 与数据字段名严格一致"
};

const solutions = [
  {
    title: "修正字段映射",
    description: "将 yField 从 'values' 改为 'value'",
    specCode: `const spec = {
  type: "bar",
  data: {
    values: [
      { category: "A", value: 10 }
    ]
  },
  xField: "category",
  yField: "value"  // 修正
};`
  }
];
EOF
```

### 创建 spec.js（用于生成/还原场景）

```bash
cat > spec.js << 'EOF'
const spec = {
  type: "bar",
  data: {
    values: [
      { category: "A", value: 10 },
      { category: "B", value: 20 },
      { category: "C", value: 15 },
      { category: "D", value: 12 },
      { category: "E", value: 18 }
    ]
  },
  xField: "category",
  yField: "value",
  label: {
    visible: true,
    style: { fill: "#333" }
  },
  tooltip: {
    visible: true
  }
};
EOF
```

---

## 验证文件格式

### 验证 config.js

```bash
# 检查是否包含必需对象
grep "const problemReview" config.js
grep "const diagnosis" config.js
grep "const solutions" config.js

# 验证 JavaScript 语法
node -c config.js
```

### 验证 spec.js

```bash
# 检查是否包含 spec 对象
grep "const spec" spec.js

# 验证 JavaScript 语法
node -c spec.js

# 检查必需字段
grep "type:" spec.js
grep "data:" spec.js
```

---

## 最佳实践

### ✅ 推荐命名方式

| 场景         | 推荐文件名           | 说明                          |
| ------------ | -------------------- | ----------------------------- |
| 诊断单个问题 | `config.js`          | 默认名称，简洁明了            |
| 多个诊断案例 | `config_<场景>.js`   | 例如：`config_bar_yfield.js`  |
| 单个示例     | `spec.js`            | 默认名称                      |
| 多个示例     | `spec_<图表类型>.js` | 例如：`spec_line_gradient.js` |
| 图片还原     | `spec_<原图描述>.js` | 例如：`spec_sales_chart.js`   |

### ✅ 文件组织建议

```
vchart-development-assistant/
├── configs/                 # 存放诊断配置文件
│   ├── config_bar.js
│   ├── config_line.js
│   └── config_pie.js
├── specs/                   # 存放图表 spec 文件
│   ├── spec_bar_basic.js
│   ├── spec_line_multi.js
│   └── spec_pie_donut.js
└── output/                  # 输出 HTML 文件
    ├── diagnosis_bar.html
    ├── demo_line.html
    └── demo_pie.html
```

---

## 故障排除

遇到文件格式相关问题？参见：

- [SCRIPTS_TROUBLESHOOTING.md](SCRIPTS_TROUBLESHOOTING.md) - 常见问题解决方案
- [SCRIPT_PARAMS_REFERENCE.md](SCRIPT_PARAMS_REFERENCE.md) - 脚本参数详细说明
