# 场景三处理流程：视觉还原

## 适用情况

**识别信号**：

- 用户提供了图表截图/设计稿图片
- 用户提供了 Figma 设计稿链接或截图
- 用户说"帮我实现这个图表"、"照着这个做一个"
- 用户希望复刻某个图表效果

**输入类型**：

| 输入类型      | 特点           | 处理方式           |
| ------------- | -------------- | ------------------ |
| 普通截图/图片 | 需要推断样式值 | 标准图片分析流程   |
| Figma 设计稿  | 可获取精确样式 | Figma 专属处理流程 |

## 处理步骤

### 步骤 1：图片分析

从用户提供的图片中识别以下信息：

```
1. **图表类型**：柱状图/折线图/饼图/散点图/雷达图/漏斗图/组合图等
2. **数据维度**：
   - X 轴/类目轴的数据类型（类目/时间/数值）
   - Y 轴/数值轴的范围和格式
   - 数据系列数量（单系列/多系列）
3. **视觉特征**：
   - 颜色方案（主色调、是否渐变）
   - 是否堆叠/分组/百分比
   - 图表方向（垂直/水平）
4. **组件识别**：
   - 标题（位置、内容）
   - 图例（位置、布局）
   - 坐标轴（标签、网格线、标题）
   - 数据标签（是否显示、位置、格式）
   - 提示框样式
5. **特殊元素**：
   - 参考线/参考区域
   - 标注点
   - 辅助图形
```

### 步骤 2：与用户确认

```markdown
## 图表分析结果

根据您提供的图片，我识别到以下信息：

**图表类型**：[识别的类型]

**数据结构**：

- X 轴：[类目/时间/数值]，示例值：[从图中读取的示例]
- Y 轴：[数值范围]
- 系列：[系列数量及含义]

**视觉特征**：

- [颜色/布局/样式等描述]

**组件配置**：

- [识别到的组件列表]

**请确认**：

1. 以上分析是否准确？
2. 请提供实际数据（如有），或确认使用模拟数据
3. 是否有其他细节需要补充？
```

### 步骤 3：生成配置

确认后，按照以下优先级匹配配置：

1. **查找相似示例**：在 `../examples/` 中查找最接近的示例作为基础
2. **构建 spec**：
   - 使用 `type-meta/[图表类型].json` 确定可用属性
   - 使用 `type-details/*.md` 获取样式配置的详细类型
3. **样式还原**：
   - 颜色：设置 `color` 色板或系列 `style`
   - 标签：配置 `label` 的 `position`、`style`
   - 坐标轴：配置 `axes` 的 `label`、`grid`、`title`
   - 图例：配置 `legends` 的 `position`、`orient`

### 步骤 4：输出还原结果

根据用户需求和对话上下文，灵活选择输出格式：

#### 输出格式选择

```
if (用户明确要求"可运行的demo" || "能直接打开的文件" || "完整的HTML") {
  → 输出完整 HTML 文件（使用 Python 脚本生成）
} else if (用户询问"配置怎么写" || "代码示例" || 在讨论具体配置) {
  → 输出 JavaScript spec 代码
} else {
  → 默认输出 JavaScript spec 代码（更简洁、易于集成）
}
```

#### 格式一：输出 JavaScript 代码（推荐）

直接输出基于图片分析的 VChart spec 配置代码。

**输出示例**：

````markdown
## 图表还原结果

基于图片分析，生成了以下配置。

**还原说明**：

- ✅ 已还原：[列出已还原的特征]
- ⚠️ 需调整：[列出需要用户确认或调整的部分]

**完整代码**：

```javascript
const spec = {
  type: 'line',
  data: {
    values: [
      { x: 'Mon', y: 12 },
      { x: 'Tue', y: 18 },
      { x: 'Wed', y: 9 },
      { x: 'Thu', y: 22 },
      { x: 'Fri', y: 16 }
    ]
  },
  xField: 'x',
  yField: 'y',
  color: ['#1890FF'], // 从图片提取的颜色
  label: {
    visible: true,
    position: 'top'
  },
  legends: {
    visible: true,
    position: 'right'
  }
};

const vchart = new VChart(spec, { dom: 'chart' });
vchart.renderAsync();
```
````

#### 格式二：输出完整 HTML（按需）

当用户需要完整的可运行演示时，使用 `template/demo.html` + Python 脚本生成视觉还原结果。

**数据准备**：

1. **Mock 数据**：根据图片中的数据点构建模拟数据
   - 尽量从坐标轴/标签中读取真实数值
   - 确保数据点数量与图片一致
   - 保持数据趋势特征

#### 使用 Python 脚本生成还原 HTML

推荐使用 `scripts/generate_demo_html.py` 脚本，通过 spec 文件生成视觉还原结果 HTML。

> 💡 **参数详情**：参见 [脚本参数参考](../references/SCRIPT_PARAMS_REFERENCE.md#generate_demo_htmlpy)

#### 脚本使用示例

**最小示例**（使用默认参数）：

```bash
python3 scripts/generate_demo_html.py --spec-file spec.js
```

**完整示例**（图片还原场景）：

```bash
python3 scripts/generate_demo_html.py \
  --title "图表还原结果" \
  --desc "基于图片分析生成的可运行示例" \
  --feature "还原了颜色、标签位置、坐标轴与图例布局" \
  --tips "可调整 color/label/axes/legends，优化样式细节" \
  --spec-file spec.js \
  --output output/image-replication.html
```

#### 主要参数

- `--spec-file`：基于图片分析构建的完整 VChart spec
- `--feature`：已还原的特征说明（如：颜色、标签、坐标轴等）
- `--tips`：可调整的关键配置（如：color/label/axes）
- `--output`：输出 HTML 文件路径（可选，默认 `output/demo.html`）

#### Spec 文件结构

spec 文件应包含基于图片分析构建的完整 VChart 配置（JavaScript 格式）：

```javascript
const spec = {
  type: 'line',
  data: {
    values: [
      { x: 'Mon', y: 12 },
      { x: 'Tue', y: 18 },
      { x: 'Wed', y: 9 },
      { x: 'Thu', y: 22 },
      { x: 'Fri', y: 16 }
    ]
  },
  xField: 'x',
  yField: 'y',
  // 根据图片分析配置样式
  color: ['#1890FF'], // 从图片提取的颜色
  label: {
    visible: true,
    position: 'top'
  },
  legends: {
    visible: true,
    position: 'right'
  }
};
```

#### 实际使用示例

**步骤 1：创建 spec 文件 `spec.js`**

```javascript
const spec = {
  type: 'line',
  data: {
    values: [
      { x: 'Mon', y: 12 },
      { x: 'Tue', y: 18 },
      { x: 'Wed', y: 9 },
      { x: 'Thu', y: 22 },
      { x: 'Fri', y: 16 }
    ]
  },
  xField: 'x',
  yField: 'y'
};
```

**步骤 2：运行脚本生成 HTML**

```bash
python3 scripts/generate_demo_html.py \
  --title "折线图还原示例" \
  --desc "根据截图还原的折线图" \
  --feature "还原了数据趋势、颜色和标签样式" \
  --tips "可修改 line.style 或 point.style 调整线条和数据点样式" \
  --spec-file spec.js \
  --output output/line_replication.html
```

**步骤 3：查看生成结果**

在浏览器中打开 `output/line_replication.html` 查看还原效果。

**输出模板**：

````markdown
## 图表还原结果

基于图片分析，生成了以下配置。

**还原说明**：

- ✅ 已还原：[列出已还原的特征]
- ⚠️ 需调整：[列出需要用户确认或调整的部分]

**可运行示例**：

将以下内容保存为 `.html`，直接在浏览器打开：

```html
[使用 template/demo.html 填充后的完整 HTML]
```
````

## 图片分析技巧

### 图表类型识别

| 视觉特征   | 图表类型 | 关键标识      |
| ---------- | -------- | ------------- |
| 矩形柱子   | bar      | 垂直/水平条形 |
| 连续曲线   | line     | 数据点连线    |
| 扇形分块   | pie      | 圆形切片      |
| 散布点     | scatter  | 离散数据点    |
| 多边形网格 | radar    | 雷达网格      |
| 梯形层级   | funnel   | 漏斗形状      |
| 圆弧刻度   | gauge    | 仪表盘样式    |

### 颜色提取策略

1. **主色调识别**：提取图表中的主要颜色作为色板
2. **渐变检测**：识别是否使用渐变色填充
3. **系列颜色**：多系列图表的颜色区分方案
4. **语义颜色**：如红色表示负值、绿色表示正值

### 数据推断方法

当用户未提供真实数据时：

1. **从图片读取**：尽量从坐标轴、标签中读取数值
2. **合理估算**：根据图形比例估算数据大小
3. **保持趋势**：确保模拟数据体现图片中的趋势特征
4. **数量匹配**：模拟数据的数量与图片中的数据点数量一致

## 还原注意事项

### 精确度说明

1. **高精确度**：图表类型、基本布局、数据趋势
2. **中等精确度**：颜色、字体大小、间距
3. **低精确度**：像素级精确对齐、特殊字体

### VChart 能力边界

1. **支持的特性**：
   - 标准图表类型
   - 常用组件（标题、图例、坐标轴、标签）
   - 基础动画效果
   - 主题样式

2. **不支持或难以实现**：
   - 非标准图表类型
   - 复杂的自定义图形
   - 特殊的交互效果
   - 精确的像素级样式

3. **替代方案**：当遇到不支持的特性时，提供最接近的实现方式

---

## Figma 设计稿专属处理

当用户提供 Figma 设计稿时，可获取比普通图片更精确的样式信息。

### 识别 Figma 输入

- 用户提到"Figma"、"设计稿"、"UI 稿"
- 用户提供 Figma 链接（`figma.com/file/...` 或 `figma.com/design/...`）
- 用户提供带有精确标注的设计截图

### Figma 信息提取清单

从 Figma 设计稿中提取以下精确信息：

```

1. **颜色值**（精确 HEX/RGB）：

   - 图表主色：#XXXXXX
   - 系列色板：['#XXX', '#XXX', ...]
   - 背景色：#XXXXXX
   - 文字颜色：#XXXXXX
   - 网格线颜色：#XXXXXX

2. **字体样式**：

   - 字体族：fontFamily
   - 标题字号：如 16px
   - 标签字号：如 12px
   - 字重：normal / bold / 500

3. **尺寸间距**：

   - 图表宽高：width x height
   - 内边距：padding
   - 组件间距：如图例与图表的间距

4. **圆角与边框**：

   - 柱子圆角：borderRadius
   - 边框宽度：lineWidth
   - 边框样式：solid / dashed

5. **渐变配置**（如有）：

   - 渐变类型：linear / radial
   - 渐变方向：角度或位置
   - 色标：[{offset, color}, ...]

6. **阴影效果**（如有）：
   - 阴影颜色、偏移、模糊半径

```

### Figma 样式转 VChart 配置映射

| Figma 属性      | VChart 配置路径                | 示例         |
| --------------- | ------------------------------ | ------------ |
| Fill Color      | `[series].style.fill`          | `'#1890FF'`  |
| Stroke Color    | `[series].style.stroke`        | `'#1890FF'`  |
| Stroke Width    | `[series].style.lineWidth`     | `2`          |
| Corner Radius   | `bar.style.cornerRadius`       | `4`          |
| Font Family     | `[component].style.fontFamily` | `'Inter'`    |
| Font Size       | `[component].style.fontSize`   | `12`         |
| Font Weight     | `[component].style.fontWeight` | `500`        |
| Text Color      | `[component].style.fill`       | `'#333333'`  |
| Opacity         | `[series].style.fillOpacity`   | `0.8`        |
| Linear Gradient | `[series].style.fill.gradient` | 渐变配置对象 |

### Figma 渐变转换示例

**Figma 渐变定义**：

```

Linear Gradient: 180°
Stop 1: #1890FF at 0%
Stop 2: #69C0FF at 100%

```

**转换为 VChart 配置**：

```javascript
{
  bar: {
    style: {
      fill: {
        gradient: 'linear',
        x0: 0, y0: 0,
        x1: 0, y1: 1,
        stops: [
          { offset: 0, color: '#1890FF' },
          { offset: 1, color: '#69C0FF' }
        ]
      }
    }
  }
}
```

### Figma 处理流程

#### 步骤 F1：收集设计信息

请用户提供：

1. Figma 设计稿截图（带标注更佳）
2. 关键样式值（颜色、字号、间距）
3. 图表数据（如有）
4. 特殊交互说明（如有）

#### 步骤 F2：精确样式提取

```markdown
## Figma 设计分析

根据您的设计稿，提取到以下样式信息：

**色彩系统**：

- 主色：`#XXXXXX`
- 色板：`['#XXX', '#XXX', '#XXX']`

**字体系统**：

- 字体：[字体名称]
- 标题：[字号] / [字重]
- 标签：[字号] / [字重]

**间距尺寸**：

- 图表区域：[宽] x [高]
- 内边距：[值]

**请确认以上提取的样式值是否准确？**
```

#### 步骤 F3：生成精确配置

基于 Figma 精确值生成配置：

```javascript
const spec = {
  type: '[图表类型]',
  // ... 数据配置

  // Figma 精确样式
  color: ['#精确色值1', '#精确色值2'],

  [seriesType]: {
    style: {
      fill: '#精确填充色',
      stroke: '#精确边框色',
      lineWidth: 精确边框宽度,
      cornerRadius: 精确圆角值
    }
  },

  title: {
    text: '标题文字',
    textStyle: {
      fontFamily: 'Figma字体',
      fontSize: 精确字号,
      fontWeight: 精确字重,
      fill: '#精确文字色'
    }
  },

  axes: [
    {
      label: {
        style: {
          fontSize: 精确字号,
          fill: '#精确文字色'
        }
      },
      grid: {
        style: {
          stroke: '#精确网格色',
          lineWidth: 精确线宽
        }
      }
    }
  ]
};
```

### Figma 还原注意事项

1. **字体兼容性**：
   - Figma 中的自定义字体需确保在 Web 环境可用
   - 如不可用，推荐相近的系统字体替代

2. **响应式处理**：
   - Figma 设计通常为固定尺寸
   - 需要确认是否需要响应式适配
   - 必要时使用百分比或相对单位

3. **Design Token 对接**：
   - 如果项目有 Design Token 系统，优先使用 Token
   - 便于后续主题切换和维护

4. **状态变体**：
   - Figma 可能包含 hover/active/disabled 等状态
   - 需要配置对应的 VChart 交互样式

5. **精确度优势**：
   - Figma 输入的还原精确度应达到 **95%+**
   - 主要差异可能来自：字体渲染、抗锯齿、动画细节

---

## 还原最佳实践

### 图片还原技巧

1. **颜色提取**：使用浏览器开发者工具或取色器精确获取原图颜色值
2. **数据点对齐**：确保 mock 数据点数量与原图一致，保持趋势特征
3. **样式迭代**：生成初版后，对比原图逐步调整 `color`、`label`、`axes`、`legend` 等配置
4. **精确度权衡**：平衡像素级精确度与开发成本，聚焦核心视觉特征

### Figma 还原优势

- **精确度高**：可获取精确的颜色值、字号、间距等设计参数
- **效率提升**：减少反复调整的迭代次数
- **设计一致性**：确保实现与设计稿高度一致

---

## 相关资源

- [图表类型指南](../references/chart/chart-type-guide.md) - 各类图表特性参考
- [示例库](../references/examples/) - 常用图表完整示例
- [组件参考](../references/components/) - 组件配置速查
- [类型详情](../references/type-details/) - 详细的类型定义
