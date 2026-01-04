<div align="center">
<article style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
    <p align="center"><img width="300" src="https://lf1-cdn-tos.bytescm.com/obj/ttfe/ies/semi/SemiLogo/Logo_1576122865926.png" /></p>
    <h1 style="width: 100%; text-align: center;">Semi-UI</h1>
    <p>
        A modern, comprehensive, flexible design system and UI library. Connect DesignOps & DevOps. Quickly build beautiful React apps. Maintained by Douyin-fe team.
    </p>
</article>
    
<div align="center">

[![LICENSE][license-badge]][license-url] [![NPM][npm-badge]][npm-url] [![CONTRIBUTORS][contributors-badge]][contributors-url]  ![Design Token][Design Token] [![FIGMA][figma-badge]][figma-url] 
[![CODECOV][codecov-badge]][codecov-url] [![Chromatic][chromatic-badge]][chromatic-url] [![Cypress][cypress-badge]][cypress-url]
[![Twitter Follow](https://img.shields.io/twitter/follow/SemiDesignUI?style=social)](https://twitter.com/SemiDesignUI)

[npm-badge]: https://img.shields.io/npm/v/@douyinfe/semi-ui.svg
[contributors-badge]: https://img.shields.io/github/contributors/DouyinFE/semi-design
[contributors-url]: https://github.com/DouyinFE/semi-design/graphs/contributors
[Design Token]: https://img.shields.io/badge/Design%20Token-2739%2B-brightgreen
[npm-url]: https://www.npmjs.com/package/@douyinfe/semi-ui
[figma-badge]: https://img.shields.io/badge/Figma-UIKit-%2318a0fb
[figma-url]: https://www.figma.com/@semi

[license-badge]: https://img.shields.io/npm/l/@douyinfe/semi-ui
[license-url]: https://github.com/DouyinFE/semi-design/blob/main/LICENSE
[codecov-badge]: https://img.shields.io/codecov/c/gh/DouyinFE/semi-design
[codecov-url]: https://app.codecov.io/gh/DouyinFE/semi-design
[chromatic-badge]: https://img.shields.io/badge/test-chromatic-brightgreen
[chromatic-url]: https://www.chromatic.com/
[cypress-badge]: https://img.shields.io/endpoint?url=https://dashboard.cypress.io/badge/simple/k83u7j&style=flat&logo=cypress
[cypress-url]: https://dashboard.cypress.io/projects/k83u7j/runs


[build-js-badge]: https://img.badgesize.io/https:/unpkg.com/@douyinfe/semi-ui/dist/umd/semi-ui.min.js?label=semi.min.js&compression=gzip
[build-js-url]: https://unpkg.com/browse/@douyinfe/semi-ui/dist/umd/semi-ui.min.js
[build-css-badge]: https://img.badgesize.io/https:/unpkg.com/@douyinfe/semi-ui/dist/css/semi.min.css?label=semi.min.css&compression=gzip
[build-css-url]: https://unpkg.com/browse/@douyinfe/semi-ui/dist/css/semi.min.css


</div>

</div>

# 🎉 Features

- 💪 Up to 70+ high-quality Components.
- 💅 Code2Design, automatically generate Figma UI Kit according to different themes, keep same between design and code
- 🚀 Powerful Design2Code support, convert figma draft to code in a few seconds
- 💕 Complete A11y support, follows W3C standards to provide keyboard interaction, focus management and ARIA for all components
- 💅 Up to 3000+ Design Tokens can be easily modify by Semi Design system management, make Semi Design to Any Design quickly.
- 🌍 Internationalization Support for Dozens of Languages, timezone, RTL support
- ⚙️ Strict quality assurance, covering unit testing, E2E testing, visual testing
- 👏 Written in Typescript, friendly Static Type Support. Based on Foundation/Adapter architecture, easy to read and contribute
- 🥳 SSR (Server Side Rendering) Compatible.

# 🔥 Install

```sh
# with npm
npm install @douyinfe/semi-ui

# with yarn
yarn add @douyinfe/semi-ui

```

# 👍 Usage

Here is a quick example to get you started, it's all you need:

```jsx
import React from 'react';
import ReactDOM from 'react-dom';
import { Button, Switch } from '@douyinfe/semi-ui';

const App = () => (
    <>
        <Button type='primary'>primary button</Button>
        <Switch size='large' />
    </>
);

ReactDOM.render(<App />, document.querySelector('#app'));
```

And [Semi UI Doc Site](https://semi.design/en-US/) has hundreds of editable examples and live preview, welcome to play with those examples.


# 📰 News about Semi UI
* [Follow on Twitter](https://twitter.com/SemiDesignUI)
* [Follow on Medium](https://medium.com/@semi-design)
* [Follow on Dev.to](https://dev.to/semidesign)

# 📌 Documentation
* [Semi DSM](https://semi.design/dsm)
* [Semi Design2Code](https://semi.design/code/en-US)
* [Semi Figma Plugin](https://www.figma.com/community/plugin/1166339852662786534/Semi-Design-%E8%AE%BE%E8%AE%A1%E8%BD%AC%E4%BB%A3%E7%A0%81)
* [Quick Start](https://semi.design/en-US/start/getting-started)
* [Components Overview](https://semi.design/en-US/start/overview)
* [Customizing Themes](https://semi.design/en-US/start/customize-theme)
* [Design Tokens](https://semi.design/en-US/basic/tokens)
* [Dark Mode](https://semi.design/en-US/start/dark-mode)
* [Semi Icons](https://semi.design/en-US/basic/icon)
* [Global Config](https://semi.design/en-US/other/configprovider)
* [Internationalization](https://semi.design/en-US/other/locale)
* [FAQ](https://semi.design/en-US/start/faq)
* [CHANGELOG](https://semi.design/en-US/start/changelog)

# 👌 Platform Support

Semi UI supports all major modern browsers.

|[<img alt="chrome" height="24px" src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/chrome/chrome.png" />](https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/chrome/chrome.png)<br>chrome|[<img alt="firefox" height="24px" src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/firefox/firefox.png" />](https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/firefox/firefox.png)<br>firefox|[<img alt="safari" height="24px" src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/safari/safari.png" />](https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/safari/safari.png)<br>safari|[<img alt="IE/Edge" height="24px" src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/edge/edge.png" />](https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/edge/edge.png)<br> IE/Edge|[<img alt="electron" height="24px" src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/electron/electron.png" />](https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/electron/electron.png)<br>Electron|
|--|--|--|--|--|
| latest 2 versions | latest 2 versions | latest 2 versions | Edge | latest 2 versions |

# 👨‍👨‍👧‍👦 User Group

Join [User Group](https://bytedance.feishu.cn/docs/doccnw93Dujm3UCkHRDTMTm1qwe#) on Feishu / Lark

# 💖 Thanks

<a href="https://www.chromatic.com/"><img src="https://user-images.githubusercontent.com/321738/84662277-e3db4f80-af1b-11ea-88f5-91d67a5e59f6.png" width="153" height="30" alt="Chromatic" /></a>

Thanks to [Chromatic](https://www.chromatic.com/) for providing the visual testing platform that helps us review UI changes and catch visual regressions.

<a href="https://www.cypress.io/"><img src="https://user-images.githubusercontent.com/26477537/147624641-1274a91d-bc4c-463e-af1a-dbf15de54c49.png" width="90" height="30" alt="Cypress" /></a>

Thanks to [Cypress](https://www.cypress.io/) for providing E2E testing.

## 👐 Contributing
Thanks to all the people who already contributed!

<a href="https://github.com/DouyinFE/semi-design/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=DouyinFE/semi-design" />
</a>

Read the contributing guide to learn about our development process, how to propose bugfixes and improvements, and how to build and test your changes to Semi UI.

See [CONTRIBUTING](CONTRIBUTING-en-US.md) documentation.

# 🎈 License

Semi UI is [MIT Licensed](LICENSE)
