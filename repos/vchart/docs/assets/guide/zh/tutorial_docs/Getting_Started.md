# 快速上手

在本教程中，我们将介绍如何使用 VChart 绘制一个简单的柱状图。VChart 是一款简单易用、跨平台、高性能的前端可视化图表库。图表由数据、series 系列和组件三部分组成，我们将使用配置项来声明图表。

## 获取 VChart

你可以通过以下几种方式获取 VChart。

### 使用 NPM 包

首先，你需要在项目根目录下使用以下命令安装 VChart：

```sh
# 使用 npm 安装
npm install @visactor/vchart

# 使用 yarn 安装
yarn add @visactor/vchart
```

### 使用 CDN

你还可以通过 CDN 获取构建好的 VChart 文件。将以下代码添加到 HTML 文件的 `<script>` 标签中：

```html
<script src="https://unpkg.com/@visactor/vchart/build/index.min.js"></script>
```

## 引入 VChart

### 通过 NPM 包引入

在 JavaScript 文件顶部使用 `import` 引入 VChart：

```js
import VChart from '@visactor/vchart';
```

### 使用 script 标签引入

通过直接在 HTML 文件中添加 `<script>` 标签，引入构建好的 vchart 文件：

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <!-- 引入 vchart 文件 -->
    <script src="https://unpkg.com/@visactor/vchart/build/index.min.js"></script>
  </head>
</html>
```

## 绘制一个简单的图表

在绘图前我们需要为 VChart 准备一个具备高宽的 DOM 容器。

```html
<body>
  <!-- 为 vchart 准备一个具备大小（宽高）的 DOM，当然你也可以在 spec 配置中指定 -->
  <div id="chart" style="width: 600px;height:400px;"></div>
</body>
```

接下来，我们创建一个 `VChart` 实例，传入图表配置项和 DOM 容器的 ID：

```ts
const spec = {
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  type: 'bar',
  xField: 'month',
  yField: 'sales'
};

// 创建 vchart 实例

/**
 * 说明：cdn 方式引入的时候，VChart 的引用方式需要注意：
 * const vchart = new VChart.default(spec, { dom: 'chart' });
 */
const vchart = new VChart(spec, { dom: 'chart' });
// 绘制
vchart.renderSync();
```

至此，你已经成功绘制出了一个简单的柱状图！

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales'
};

/**
 * 说明：cdn 方式引入的时候，VChart 的引用方式需要注意：
 * const vchart = new VChart.default(spec, { dom: 'chart' });
 */
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

希望这篇教程对你学习如何使用 VChart 有所帮助。现在，你可以尝试绘制不同类型的图表，并通过深入了解 VChart 的各种配置选项，定制出更加丰富多样的图表效果。勇敢开始你的 VChart 之旅吧！
