# How to Obtain VChart

There are several ways to obtain VChart:

1. Obtain from npm
2. Obtain from cdn
3. Obtain from GitHub repository

## Obtain from npm

```bash
# npm
$ npm install @visactor/vchart

# yarn
$ yarn add @visactor/vchart
```

For how to use it when obtaining, see [How to Import VChart in a Project](./How_to_Import_VChart).

## Obtain from cdn

> Note: When introducing in cdn mode, you need to pay attention to the reference method of VChart: `const vchart = new VChart.default(spec, { dom: 'chart' });`

You can get VChart from the following free CDNs:

```html
<!-- unpkg -->
<script src="https://unpkg.com/@visactor/vchart/build/index.min.js"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
```

## Obtain from GitHub

You can directly get the VChart source code from GitHub:

1. You can directly clone the source code from GitHub.
2. You can also go to VChart's [release](https://github.com/VisActor/VChart/releases) page, select the corresponding version, and click on the Source code in the Assets section at the bottom of the page, download it to your local machine and extract it for use.
