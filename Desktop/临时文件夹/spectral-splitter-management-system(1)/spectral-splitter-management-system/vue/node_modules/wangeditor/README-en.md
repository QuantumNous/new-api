# wangEditor

<!-- Badge -->
![Stars badge](https://img.shields.io/badge/stars-11.2-green)
![Forks badge](https://img.shields.io/badge/forks-2.5k-brightgreen)
![cypress badge](https://img.shields.io/badge/E2E-Cypress-brightgreen)
![jest badge](https://img.shields.io/badge/unit%20test-jest-yellowgreen)
![build badge](https://github.com/wangeditor-team/wangEditor/workflows/build/badge.svg)
![MIT License](https://img.shields.io/badge/License-MIT-blue)
[![](https://data.jsdelivr.com/v1/package/npm/wangeditor/badge)](https://www.jsdelivr.com/package/npm/wangeditor)

<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="http://www.wangeditor.com/">
    <img src="./docs/imgs/logo.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">wangEditor</h3>

  <p align="center">
    A lightweight rich text editor, friendly API and use extremely conventient.
    <br />
    <a href="https://www.wangeditor.com/en.html"><strong>Offical website</strong></a>
    ·
    <a href="https://www.wangeditor.com/doc-en/"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="./README.md">中文</a>
    ·
    <a href="https://codepen.io/collection/DNmPQV">View Demo</a>
    ·
    <a href="https://github.com/wangeditor-team/wangEditor/issues/new?template=bug.md">Report Bug</a>
    ·
    <a href="https://github.com/wangeditor-team/wangEditor/issues/new?template=feature.md">Request Feature</a>
  </p>
</p>

## About

wangEditor is a web rich text editor that use typescript develop. It's lightweight, simple, use convience and open source.

It support most of modern browsers: Chrome, Firefox, Safar, Edge, QQ-browser, IE11 and so on.

It doesn't support mobile browsers.

![Product Name Screen Shot](./docs/imgs/demo-en.png)

## Usage

### Use NPM package
```sh
npm install wangeditor --save
``` 
A few lines code for creating editor instance：

```js
import E from "wangeditor";
const editor = new E("#div1");
editor.create();
```

### Use CDN
```html
<script type="text/javascript" src="https://unpkg.com/wangeditor/dist/wangEditor.min.js"></script>
<script type="text/javascript">
  const E = window.wangEditor
  const editor = new E('#div1')
  // or const editor = new E(document.getElementById('div1'))
  editor.create()
</script>
```

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**. Before contributing wangEditor, You must read [contribution](./docs/contribution.md) docs.

<!-- LICENSE -->
## License

Distributed under the MIT License. See [MIT License](https://en.wikipedia.org/wiki/MIT_license) for more information.

## Developer team
We have a professional developer team, if you want to join us, you can send email to `wangfupeng1988@163.com`.

If you are a chinese developer, you can join our QQ group or read [chinese](./README-zh-cn.md) docs for more information.

## Support us

Your support will encourage us to output more quality content.

![](./docs/imgs/wechat-pay.jpeg)
![](./docs/imgs/ali-pay.jpeg)
