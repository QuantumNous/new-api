# 如何获取 VChart

获取 VChart 的方式有以下几种：

1. 从 npm 获取
2. 从 cdn 获取
3. 从 GitHub 仓库获取

## npm 获取

```bash
# npm
$ npm install @visactor/vchart

# yarn
$ yarn add @visactor/vchart
```

获取时候如何使用，详见[如何在项目中引用 VChart](./How_to_Import_VChart)。

## cdn 获取

> 说明：cdn 方式引入的时候，VChart 的引用方式需要注意：`const vchart = new VChart.default(spec, { dom: 'chart' });`

可以从以下免费的 CDN 中获取 VChart:

```html
<!-- unpkg -->
<script src="https://unpkg.com/@visactor/vchart/build/index.min.js"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
```

## GitHub 获取

从 GitHub 上你可以直接获取 VChart 的源码：

1. 你可以直接从 GitHub clone 源码。
2. 你也可以从 VChart 的 [release](https://github.com/VisActor/VChart/releases) 页面选择对应的版本，点击页面下方 Assets 中的 Source code，将其下载至本地解压后使用。
