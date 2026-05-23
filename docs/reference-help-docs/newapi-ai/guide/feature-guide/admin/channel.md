# 渠道管理

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/channel.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/channel.mdx

## 页面大纲

  - 添加渠道
    - 基本配置
    - 选择模型
    - 高级配置
    - 提交保存
  - 渠道测试
    - 单个渠道测试
    - 批量测试
  - 批量操作
    - 选择渠道
    - 执行批量操作
  - 多 Key 模式
    - 配置多 Key
    - 选择轮询模式
    - 保存配置
  - 参数覆盖系统
    - 简单覆盖模式
    - 高级操作模式
      - 基本结构
    - 操作模式 (mode)
      - 1. set - 设置值
      - 2. delete - 删除字段
      - 3. move - 移动字段
      - 4. append - 追加内容
      - 5. prepend - 前置内容
      - 6. copy - 复制字段
      - 7. trim_prefix - 去除前缀
      - 8. trim_suffix - 去除后缀
      - 9. ensure_prefix - 确保前缀
      - 10. ensure_suffix - 确保后缀
      - 11. trim_space - 去除首尾空白
      - 12. to_lower - 转小写
      - 13. to_upper - 转大写
      - 14. replace - 字符串替换
      - 15. regex_replace - 正则替换
    - 条件判断
      - 条件结构
      - 条件匹配模式
      - 条件参数说明
      - 逻辑关系 (logic)
    - 路径语法
    - 实用示例
      - 1. 动态调整模型参数
      - 2. 添加系统提示
      - 3. 根据模型类型调整参数
      - 4. 多条件组合（AND逻辑）
      - 5. 数值比较条件
      - 6. 反选条件
      - 7. 处理缺失字段
      - 8. 字符串拼接示例
    - 注意事项

## 原文内容

---
title: 渠道管理
description: 渠道是平台对接 AI 服务商的核心配置单元
---
import { Callout } from 'fumadocs-ui/components/callout';

渠道是平台对接 AI 服务商的核心配置单元,每条渠道对应一个服务商的 API Key。使用管理员账号登录后,左侧导航点击「渠道」,或直接访问 `/console/channel`。

![渠道列表页](../../../assets/guide/feature-guide/channel-list.png)

渠道列表展示所有已配置的 AI 服务商渠道,包含名称、类型、状态(绿色=正常 / 红色=禁用)、响应时间、已用配额等信息。

## 添加渠道

### 基本配置

1. 在渠道列表页点击右上角「添加渠道」按钮,弹出配置弹窗
2. 在弹窗中选择服务商类型(如 OpenAI、Claude、Gemini 等)
3. 填写渠道名称和 API Key

![添加渠道弹窗(基础信息)](../../../assets/guide/feature-guide/channel-add-basic.png)

### 选择模型

在模型列表中勾选该渠道支持的模型,或点击「填入默认模型」自动填充

### 高级配置

按需展开高级配置,填写以下可选项:

![添加渠道弹窗(高级配置)](../../../assets/guide/feature-guide/channel-add-advanced.png)

| 配置项 | 说明 |
| --- | --- |
| Base URL | 自定义接口地址,代理或私有部署时使用 |
| 优先级 | 数值越高越优先被选中,默认为 0 |
| 权重 | 同优先级下的随机权重,默认为 0 |
| 模型映射 | 将用户请求的模型名映射为实际模型名,JSON 格式 |
| 参数覆盖 | 强制覆盖请求中的某些参数,JSON 格式 |
| 自动禁用 | 开启后连续失败达到阈值时自动禁用该渠道 |

### 提交保存

点击「提交」完成渠道添加,新渠道出现在列表中

## 渠道测试

### 单个渠道测试

1. 在渠道列表中找到目标渠道,点击右侧操作栏中的「测试」按钮
2. 等待测试请求完成,弹窗显示响应时间和成功/失败状态

![渠道测试结果弹窗](../../../assets/guide/feature-guide/channel-test.png)

响应时间越短说明该渠道速度越快。

### 批量测试

点击列表顶部「测试所有渠道」按钮一键批量测试。

## 批量操作

### 选择渠道

1. 在渠道列表左侧勾选多条渠道的复选框
2. 页面顶部出现批量操作工具栏

![勾选多条渠道后的批量操作栏](../../../assets/guide/feature-guide/channel-batch.png)

### 执行批量操作

点击对应按钮执行批量操作:
- **批量启用**:将选中渠道状态改为正常
- **批量禁用**:将选中渠道状态改为禁用
- **批量打标签**:为选中渠道统一设置标签,便于分类管理

## 多 Key 模式

多 Key 模式允许一个渠道配置多个 API Key,系统自动轮询使用,单个 Key 失败后自动跳过,恢复后重新启用。

### 配置多 Key

1. 在渠道列表中点击目标渠道右侧的「编辑」按钮
2. 在编辑弹窗中找到「多 Key 管理」区域

![多 Key 模式配置区域](../../../assets/guide/feature-guide/channel-multikey.png)

3. 点击「添加 Key」逐条输入多个 API Key

### 选择轮询模式

选择轮询模式:

| 轮询模式 | 说明 |
| --- | --- |
| 轮询(Round Robin) | 按顺序依次使用每个 Key |
| 加权随机 | 按权重随机选择 Key |

### 保存配置

点击「保存」完成配置


## 参数覆盖系统

参数覆盖系统支持两种模式：简单覆盖模式（向前兼容）和高级操作模式。通过灵活的条件判断和操作类型，可以实现复杂的参数动态调整。

### 简单覆盖模式

向前兼容性，直接指定要覆盖的字段和值，系统会将这些字段合并到原始请求中：

```json
{
  "temperature": 0.8,
  "max_tokens": 2000,
  "model": "gpt-4"
}
```

### 高级操作模式

通过 `operations` 数组定义复杂的参数操作，支持条件判断、数组操作、字符串拼接与字符串规范化等高级功能。

#### 基本结构

```json
{
  "operations": [
    {
      "path": "temperature",
      "mode": "set",
      "value": 0.8,
      "conditions": [...],
      "logic": "AND"
    }
  ]
}
```

**字段说明（按需填写）：**

- `mode`: 必填
- `path`: 适用于 `set` / `delete` / `append` / `prepend` / `trim_prefix` / `trim_suffix` / `ensure_prefix` / `ensure_suffix` / `trim_space` / `to_lower` / `to_upper` / `replace` / `regex_replace`
- `value`: 常见于 `set` / `append` / `prepend` / `trim_prefix` / `trim_suffix` / `ensure_prefix` / `ensure_suffix`
- `from` / `to`: 适用于 `move` / `copy` / `replace` / `regex_replace`
- `keep_origin`: 用于 `set`（已有值则跳过）以及对象合并时的 `append` / `prepend`

### 操作模式 (mode)

#### 1. set - 设置值

设置指定路径的值：

```json
{
  "path": "temperature",
  "mode": "set",
  "value": 0.8,
  "keep_origin": false
}
```

**参数说明：**
- `keep_origin`: 为 `true` 时，如果目标路径已存在值则跳过设置

#### 2. delete - 删除字段

删除指定路径的字段：

```json
{
  "path": "messages.0",
  "mode": "delete"
}
```

#### 3. move - 移动字段

将一个字段的值移动到另一个位置：

```json
{
  "mode": "move",
  "from": "messages.0.content",
  "to": "system"
}
```

#### 4. append - 追加内容

在现有内容后追加新内容：

```json
{
  "path": "messages.0.content",
  "mode": "append",
  "value": "\n\n请用中文回答。"
}
```

**支持的数据类型：**
- **字符串**: 在原字符串末尾追加
- **数组**: 在数组末尾添加元素（支持添加单个元素或数组）
- **对象**: 合并对象属性

#### 5. prepend - 前置内容

在现有内容前添加新内容：

```json
{
  "path": "messages.0.content",
  "mode": "prepend",
  "value": "重要提示：请仔细阅读以下内容。\n\n"
}
```

**支持的数据类型：**
- **字符串**: 在原字符串开头前置
- **数组**: 在数组开头添加元素（支持添加单个元素或数组）
- **对象**: 合并对象属性

#### 6. copy - 复制字段

将 `from` 指定路径的值复制到 `to` 指定路径（不删除源字段）：

```json
{
  "mode": "copy",
  "from": "model",
  "to": "original_model"
}
```

#### 7. trim_prefix - 去除前缀

对字符串字段去除指定前缀（若不匹配则不变）：

```json
{
  "path": "model",
  "mode": "trim_prefix",
  "value": "openai/"
}
```

#### 8. trim_suffix - 去除后缀

对字符串字段去除指定后缀（若不匹配则不变）：

```json
{
  "path": "model",
  "mode": "trim_suffix",
  "value": "-latest"
}
```

#### 9. ensure_prefix - 确保前缀

确保字符串字段以指定前缀开头（已存在则不变）：

```json
{
  "path": "model",
  "mode": "ensure_prefix",
  "value": "openai/"
}
```

#### 10. ensure_suffix - 确保后缀

确保字符串字段以指定后缀结尾（已存在则不变）：

```json
{
  "path": "model",
  "mode": "ensure_suffix",
  "value": "-latest"
}
```

#### 11. trim_space - 去除首尾空白

对字符串字段执行 `TrimSpace`（空格、换行、制表符等都会被移除）：

```json
{
  "path": "model",
  "mode": "trim_space"
}
```

#### 12. to_lower - 转小写

将字符串字段转换为小写：

```json
{
  "path": "model",
  "mode": "to_lower"
}
```

#### 13. to_upper - 转大写

将字符串字段转换为大写：

```json
{
  "path": "model",
  "mode": "to_upper"
}
```

#### 14. replace - 字符串替换

对字符串字段执行子串替换：

```json
{
  "path": "model",
  "mode": "replace",
  "from": "openai/",
  "to": ""
}
```

**参数要求：**
- `from`: 必填且不能为空字符串
- `to`: 可选，省略时等同于空字符串

#### 15. regex_replace - 正则替换

对字符串字段执行正则匹配替换：

```json
{
  "path": "model",
  "mode": "regex_replace",
  "from": "^gpt-",
  "to": "openai/gpt-"
}
```

**参数要求：**
- `from`: 必填（正则表达式，Go regexp 语法）
- `to`: 可选，省略时等同于空字符串

### 条件判断

通过 `conditions` 数组设置操作执行的条件，仅当条件满足时才会执行对应操作。

#### 条件结构

```json
{
  "conditions": [
    {
      "path": "model",
      "mode": "contains",
      "value": "gpt-4",
      "invert": false,
      "pass_missing_key": false
    }
  ],
  "logic": "AND"
}
```

#### 条件匹配模式

- `full`: 完全匹配（默认）
- `prefix`: 前缀匹配
- `suffix`: 后缀匹配
- `contains`: 包含匹配
- `gt`: 大于（仅数字类型）
- `gte`: 大于等于（仅数字类型）
- `lt`: 小于（仅数字类型）
- `lte`: 小于等于（仅数字类型）

**须知：**
- 数值比较只能用于数字类型
- 字符串操作（prefix、suffix、contains）会将值转换为字符串进行比较

#### 条件参数说明

- `invert`: 反选功能，`true` 表示取反结果
- `pass_missing_key`: 当指定路径不存在时的行为
  - `true`: 路径不存在时条件通过
  - `false`: 路径不存在时条件不通过（默认）

#### 逻辑关系 (logic)

- `AND`: 所有条件都必须满足
- `OR`: 任意条件满足即可（默认）

### 路径语法

使用 JSON 路径语法访问嵌套字段：

- `temperature` - 根级字段
- `messages.0.content` - 数组第一个元素的 content 字段
- `messages.-1.content` - 数组最后一个元素的 content 字段
- `metadata.user.name` - 嵌套对象字段

同时，`path` 支持以下内置变量（无需在请求体中显式存在），可直接用于条件判断：

| 变量 | 含义 | 典型用途 |
| --- | --- | --- |
| `model` / `upstream_model` | 重定向后的目标模型 | 按实际调用的上游模型做条件匹配 |
| `original_model` | 重定向前的目标模型 | 按用户请求的原始模型做条件匹配 |

### 实用示例

#### 1. 动态调整模型参数

根据消息内容动态调整温度参数：

```json
{
  "operations": [
    {
      "path": "temperature",
      "mode": "set",
      "value": 0.3,
      "conditions": [
        {
          "path": "messages.0.content",
          "mode": "contains",
          "value": "代码"
        }
      ]
    },
    {
      "path": "temperature",
      "mode": "set",
      "value": 0.9,
      "conditions": [
        {
          "path": "messages.0.content",
          "mode": "contains",
          "value": "创意"
        }
      ]
    }
  ]
}
```

#### 2. 添加系统提示

在消息数组开头添加系统消息：

```json
{
  "operations": [
    {
      "path": "messages",
      "mode": "prepend",
      "value": [
        {
          "role": "system",
          "content": "你是一个专业的AI助手，请始终保持礼貌和专业。"
        }
      ]
    }
  ]
}
```

#### 3. 根据模型类型调整参数

根据不同模型设置不同的 max_tokens：

```json
{
  "operations": [
    {
      "path": "max_tokens",
      "mode": "set",
      "value": 4000,
      "conditions": [
        {
          "path": "model",
          "mode": "prefix",
          "value": "gpt-4"
        }
      ]
    },
    {
      "path": "max_tokens",
      "mode": "set",
      "value": 2000,
      "conditions": [
        {
          "path": "model",
          "mode": "prefix",
          "value": "gpt-3.5"
        }
      ]
    }
  ]
}
```

#### 4. 多条件组合（AND逻辑）

同时满足多个条件时才执行操作：

```json
{
  "operations": [
    {
      "path": "stream",
      "mode": "set",
      "value": false,
      "conditions": [
        {
          "path": "model",
          "mode": "contains",
          "value": "claude"
        },
        {
          "path": "messages.0.content",
          "mode": "contains",
          "value": "长文"
        }
      ],
      "logic": "AND"
    }
  ]
}
```

#### 5. 数值比较条件

根据数值大小进行条件判断：

```json
{
  "operations": [
    {
      "path": "temperature",
      "mode": "set",
      "value": 0.1,
      "conditions": [
        {
          "path": "max_tokens",
          "mode": "gt",
          "value": 1000
        }
      ]
    }
  ]
}
```

#### 6. 反选条件

使用 `invert` 实现反选逻辑：

```json
{
  "operations": [
    {
      "path": "stream",
      "mode": "set",
      "value": true,
      "conditions": [
        {
          "path": "model",
          "mode": "contains",
          "value": "gpt-3.5",
          "invert": true
        }
      ]
    }
  ]
}
```

#### 7. 处理缺失字段

使用 `pass_missing_key` 处理可能不存在的字段：

```json
{
  "operations": [
    {
      "path": "temperature",
      "mode": "set",
      "value": 0.7,
      "conditions": [
        {
          "path": "custom_field",
          "mode": "full",
          "value": "special",
          "pass_missing_key": true
        }
      ]
    }
  ]
}
```

#### 8. 字符串拼接示例

在用户消息后追加指导语：

```json
{
  "operations": [
    {
      "path": "messages.-1.content",
      "mode": "append",
      "value": "\n\n请详细解释你的思考过程。"
    }
  ]
}
```

### 注意事项

<Callout type="warn">
  **执行顺序**: 操作按照在 `operations` 数组中的顺序依次执行，前面的操作会影响后续操作
</Callout>
