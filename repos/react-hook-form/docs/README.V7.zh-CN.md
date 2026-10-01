<div align="center">
        <a href="https://react-hook-form.com" title="React Hook Form - Simple React forms validation">
            <img src="https://raw.githubusercontent.com/react-hook-form/react-hook-form/master/docs/logo.png" alt="React Hook Form Logo - React hook custom hook for form validation" />
        </a>
</div>

<div align="center">
        <a href="https://react-hook-form.com" title="React Hook Form - Simple React forms validation">
            <img src="https://raw.githubusercontent.com/bluebill1049/react-hook-form/master/docs/v7_example.gif" alt="React Hook Form video - React custom hook for form validation" width="100%" />
        </a>
</div>

<div align="center">

[![npm downloads](https://img.shields.io/npm/dm/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/npm/dt/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/npm/l/react-hook-form?style=for-the-badge)](https://github.com/react-hook-form/react-hook-form/blob/master/LICENSE)
[![Discord](https://img.shields.io/discord/754891658327359538.svg?style=for-the-badge&label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/yYv7GZ8)

</div>

<p align="center">
  <a href="https://react-hook-form.com/get-started">开始</a> | 
  <a href="https://react-hook-form.com/docs">API</a> |
  <a href="https://github.com/bluebill1049/react-hook-form/tree/master/examples">示例</a> |
  <a href="https://react-hook-form.com">Demo</a> |
  <a href="https://react-hook-form.com/form-builder">表单生成器</a> |
  <a href="https://react-hook-form.com/faqs">常见问题</a>
</p>

### Features

- 以性能和开发体验为基础构建
- 支持浏览器原生校验
- [UI库](https://codesandbox.io/s/react-hook-form-v7-controller-5h1q5)开箱即用
- [小巧](https://bundlephobia.com/result?p=react-hook-form@latest)无[依赖](./package.json)
- 遵循 HTML 标准进行[校验](https://react-hook-form.com/get-started#Applyvalidation)
- 支持[Yup](https://github.com/jquense/yup), [Zod](https://github.com/vriad/zod), [Superstruct](https://github.com/ianstormtaylor/superstruct), [Joi](https://github.com/hapijs/joi), [Vest](https://github.com/ealush/vest), [class-validator](https://github.com/typestack/class-validator), [io-ts](https://github.com/gcanti/io-ts), [nope](https://github.com/bvego/nope-validator)或自定义

### 安装

    npm install react-hook-form

### 快速开始

```jsx
import React from 'react';
import { useForm } from 'react-hook-form';

function App() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const onSubmit = (data) => console.log(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('firstName')} /> {/* register an input */}
      <input {...register('lastName', { required: true })} />
      {errors.lastName && <p>Last name is required.</p>}
      <input {...register('age', { pattern: /\d+/ })} />
      {errors.age && <p>Please enter number for age.</p>}
      <input type="submit" />
    </form>
  );
}
```

<a href="https://ui.dev/bytes/?r=bill">
  <img src="https://raw.githubusercontent.com/react-hook-form/react-hook-form/master/docs/ads-1.jpeg" />
</a>

### 赞助者

感谢所有可爱及热情的（公司/个人）赞助者

<a href="https://underbelly.is/" target="_blank">
  <img src="https://images.opencollective.com/underbelly/989a4a6/logo/256.png" width="94" height="94" />
</a>
<a href="https://www.leniolabs.com/" target="_blank">
  <img src="https://images.opencollective.com/leniolabs_/63e9b6e/logo/256.png" width="94" height="94" />
</a>
<a href="https://graphcms.com/" target="_blank">
  <img src="https://avatars.githubusercontent.com/u/31031438?s=200&v=4" width="94" height="94" />
</a>

<p>
    <a href="https://github.com/sayav"
    ><img
            src="https://avatars1.githubusercontent.com/u/42376060?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@sayav"
    /></a>
    <a href="https://github.com/lemcii"
    ><img
            src="https://avatars1.githubusercontent.com/u/35668113?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@lemcii"
    /></a>
    <a href="https://github.com/washingtonsoares"
    ><img
            src="https://avatars.githubusercontent.com/u/5726140?v=4"
            width="45"
            height="45"
            alt="@washingtonsoares"
    /></a>
    <a href="https://github.com/lixunn"
    ><img
            src="https://avatars.githubusercontent.com/u/4017964?v=4"
            width="45"
            height="45"
            alt="@lixunn"
    /></a>
    <a href="https://github.com/SamSamskies"
    ><img
            src="https://avatars2.githubusercontent.com/u/3655410?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@SamSamskies"
    /></a>
    <a href="https://github.com/peaonunes"
    ><img
            src="https://avatars2.githubusercontent.com/u/3356720?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@peaonunes"
    /></a>
    <a href="https://github.com/wilhelmeek"
    ><img
            src="https://avatars2.githubusercontent.com/u/609452?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@wilhelmeek"
    /></a>
    <a href="https://github.com/iwarner"
    ><img
            src="https://avatars2.githubusercontent.com/u/279251?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@iwarner"
    /></a>
    <a href="https://github.com/joejknowles"
    ><img
            src="https://avatars2.githubusercontent.com/u/10728145?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@joejknowles"
    /></a>
    <a href="https://github.com/chris-gunawardena"
    ><img
            src="https://avatars0.githubusercontent.com/u/5763108?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@chris-gunawardena"
    /></a>
    <a href="https://github.com/Tymek"
    ><img
            src="https://avatars1.githubusercontent.com/u/2625371?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@Tymek"
    /></a>
    <a href="https://github.com/Luchanso"
    ><img
            src="https://avatars0.githubusercontent.com/u/2098777?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@Luchanso"
    /></a>
    <a href="https://github.com/vcarel"
    ><img
            src="https://avatars1.githubusercontent.com/u/1541093?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@vcarel"
    /></a>
    <a href="https://github.com/gragland"
    ><img
            src="https://avatars0.githubusercontent.com/u/1481077?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@gragland"
    /></a>
    <a href="https://github.com/tjshipe"
    ><img
            src="https://avatars2.githubusercontent.com/u/1254942?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@tjshipe"
    /></a>
    <a href="https://github.com/krnlde"
    ><img
            src="https://avatars1.githubusercontent.com/u/1087002?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@krnlde"
    /></a>
    <a href="https://github.com/msutkowski"
    ><img
            src="https://avatars2.githubusercontent.com/u/784953?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@msutkowski"
    /></a>
    <a href="https://github.com/mlukaszczyk"
    ><img
            src="https://avatars3.githubusercontent.com/u/599247?s=60&amp;v=4"
            width="45"
            height="45"
            alt="@mlukaszczyk"
    /></a>
    <a href="https://github.com/susshma"
    ><img
            src="https://avatars0.githubusercontent.com/u/2566818?s=460&u=754ee26b96e321ff28dbc4a2744132015f534fe0&v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/MatiasCiccone"
    ><img
            src="https://avatars3.githubusercontent.com/u/32602795?s=460&u=6a0c4dbe23c4f9a5628dc8867842b75989ecc4aa&v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/ghostwriternr"
    ><img
            src="https://avatars0.githubusercontent.com/u/10023615?s=460&u=3ec1e4ba991699762fd22a9d9ef47a0599f937dc&v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/neighborhood999"
    ><img
            src="https://avatars3.githubusercontent.com/u/10325111?s=450&u=f60c932f81d95a60f77f5c7f2eab4590e07c29af&v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/yjp20"
    ><img
            src="https://avatars3.githubusercontent.com/u/44457064?s=460&u=a55119c84e0167f6a3f830dbad3133b28f0c0a8f&v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/samantha-wong"
    ><img
            src="https://avatars.githubusercontent.com/u/19571028?s=460&u=7421a02f600646b5836d5973359a257950cae8c4&v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/msc-insure"
    ><img
            src="https://avatars.githubusercontent.com/u/44406870?s=200&v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/ccheney"
    ><img
            src="https://avatars.githubusercontent.com/u/302437?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/artischockee"
    ><img
            src="https://avatars.githubusercontent.com/u/22125223?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/tsongas"
    ><img
            src="https://avatars.githubusercontent.com/u/2079598?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/knoefel"
    ><img
            src="https://avatars.githubusercontent.com/u/2396344?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/JGibel"
    ><img
            src="https://avatars.githubusercontent.com/u/1953965?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/gpalrepo"
    ><img
            src="https://avatars.githubusercontent.com/u/41862257?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/pjsachdev"
    ><img
            src="https://avatars.githubusercontent.com/u/43356139?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/svict4"
    ><img
            src="https://avatars.githubusercontent.com/u/1137112?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/raisiqueira"
    ><img
            src="https://avatars.githubusercontent.com/u/2914170?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/pashtet422"
    ><img
            src="https://avatars.githubusercontent.com/u/45594821?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/ozywuli"
    ><img
            src="https://avatars.githubusercontent.com/u/5769153?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/monkey0722"
    ><img
            src="https://avatars.githubusercontent.com/u/12868063?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/KATT"
    ><img
            src="https://avatars.githubusercontent.com/u/459267?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/jeroenvisser101"
    ><img
            src="https://avatars.githubusercontent.com/u/1941348?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/sainu"
    ><img
            src="https://avatars.githubusercontent.com/u/12888685?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/bkincart"
    ><img
            src="https://avatars.githubusercontent.com/u/22803185?v=4"
            width="45"
            height="45"
    /></a>
    <a href="https://github.com/37108"
    ><img
            src="https://avatars.githubusercontent.com/u/36793907?v=4"
            width="45"
            height="45"
    /></a>
</p>

### 支持者

感谢所有支持者! [[成为支持者](https://opencollective.com/react-hook-form#backer)].

<a href="https://opencollective.com/react-hook-form#backers">
    <img src="https://opencollective.com/react-hook-form/backers.svg?width=950" />
</a>

### 贡献者

感谢这些出色的人！ [[成为贡献者](../CONTRIBUTING.md)].

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
  <img src="https://opencollective.com/react-hook-form/contributors.svg?width=890&button=false" />
</a>

### 帮助者

感谢您帮助及回答社区中的问题

<a href="https://github.com/leapful">
  <img src="https://avatars.githubusercontent.com/u/18494222?v=4" width="25" />
</a>
<a href="https://github.com/thanh-nguyen-95">
  <img src="https://avatars.githubusercontent.com/u/44762180?v=4" width="25" />
</a>
<a href="https://github.com/slugmandrew">
  <img src="https://avatars.githubusercontent.com/u/153625?v=4" width="25" />
</a>
<a href="https://github.com/lundn">
  <img src="https://avatars.githubusercontent.com/u/4386964?v=4" width="25" />
</a>
<a href="https://github.com/ritikbanger">
  <img src="https://avatars.githubusercontent.com/u/47841501?v=4" width="25" />
</a>
<a href="https://github.com/fahadsohail482">
  <img src="https://avatars.githubusercontent.com/u/46647496?v=4" width="25" />
</a>
<a href="https://github.com/getTobiasNielsen">
  <img src="https://avatars.githubusercontent.com/u/54803528?v=4" width="25" />
</a>
<a href="https://github.com/jfreedman0212">
  <img src="https://avatars.githubusercontent.com/u/31392256?v=4" width="25" />
</a>
<a href="https://github.com/marr">
  <img src="https://avatars.githubusercontent.com/u/44376?v=4" width="25" />
</a>

## 组织机构

感谢这些精彩的组织！ [[捐助](https://opencollective.com/react-hook-form/contribute)]

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
    <img src="https://opencollective.com/react-hook-form/organizations.svg?width=890" />
</a>
