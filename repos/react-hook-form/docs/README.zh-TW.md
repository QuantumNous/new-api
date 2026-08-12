<div align="center">
    <p align="center">
      <a href="https://react-hook-form.com/zh" title="React Hook Form - Simple React forms validation">
        <img src="https://raw.githubusercontent.com/bluebill1049/react-hook-form/master/docs/logo.png" alt="React Hook Form Logo - hook custom hook for form validation" width="330px" />
      </a>
    </p>
</div>

<div align="center">

高效能、靈活、易擴充、易於使用的表單

[![npm downloads](https://img.shields.io/npm/dm/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/npm/dt/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/bundlephobia/minzip/react-hook-form?style=for-the-badge)](https://bundlephobia.com/result?p=react-hook-form)
[![Coverage Status](https://img.shields.io/coveralls/github/bluebill1049/react-hook-form/master?style=for-the-badge)](https://coveralls.io/github/bluebill1049/react-hook-form?branch=master)

[![Tweet](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?text=React+hooks+for+form+validation+without+the+hassle&url=https://github.com/bluebill1049/react-hook-form)&nbsp;[![Join the community on Spectrum](https://withspectrum.github.io/badge/badge.svg)](https://spectrum.chat/react-hook-form)

</div>

<div align="center"><p align="center"><a href="https://react-hook-form.com/zh" title="React Hook Form - Simple React forms validation"><img src="https://raw.githubusercontent.com/bluebill1049/react-hook-form/master/docs/example.gif" alt="React Hook Form Logo - React hook form validation" width="100%" /></a></p></div>

<a href="./README.V6.md">English</a> | 繁中 | <a href="./README.zh-CN.md">簡中</a> | <a href="./README.ja-JP.md">日本語</a> | <a href="./README.ko-KR.md">한국어</a> | <a href="./README.fr-FR.md">Français</a> | <a href="./README.it-IT.md">Italiano</a> | <a href="./README.pt-BR.md">Português</a> | <a href="./README.es-ES.md">Español</a> | <a href="./README.ru-RU.md">Русский</a> | <a href="./README.de-DE.md">Deutsch</a> | <a href="./README.tr-TR.md">Türkçe</a>

## 功能

- 感受效能與開發者體驗（DX）
- 使用原生表單驗證
- 簡單整合 [UI 套件](https://codesandbox.io/s/react-hook-form-v6-controller-24gcl)
- [輕巧](https://bundlephobia.com/result?p=react-hook-form@latest) 且沒有依賴
- 遵循 HTML 標準的 [驗證](https://react-hook-form.com/get-started#Applyvalidation)
- 支援 [Yup](https://github.com/jquense/yup)、[Superstruct](https://github.com/ianstormtaylor/superstruct)、[Joi](https://github.com/hapijs/joi) 等自定義 [Resolvers](https://github.com/react-hook-form/resolvers)
- 使用 [Form Builder](https://react-hook-form.com/form-builder) 快速建構表單

## 安裝

    $ npm install react-hook-form

## 連結

- [動機](https://medium.com/@bruce1049/form-validation-with-hook-in-3kb-c5414edf7d64)
- [影片教學](https://www.youtube.com/watch?v=-mFXqOaqgZk&t)
- [開始](https://react-hook-form.com/zh/get-started)
- [API](https://react-hook-form.com/zh/api)
- [範例](https://github.com/bluebill1049/react-hook-form/tree/master/examples)
- [Demo](https://react-hook-form.com/zh)
- [Form Builder](https://react-hook-form.com/zh/form-builder)
- [常見問題](https://react-hook-form.com/zh/faqs)

## 快速開始

```jsx
import React from 'react';
import { useForm } from 'react-hook-form';

function App() {
  const { register, handleSubmit, errors } = useForm(); // initialise the hook
  const onSubmit = (data) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input name="firstname" ref={register} /> {/* register an input */}
      <input name="lastname" ref={register({ required: true })} />
      {errors.lastname && 'Last name is required.'}
      <input name="age" ref={register({ pattern: /\d+/ })} />
      {errors.age && 'Please enter number for age.'}
      <input type="submit" />
    </form>
  );
}
```

## 贊助者

<a href="https://underbelly.is/" target="_blank">
<img src="https://images.opencollective.com/underbelly/989a4a6/logo/256.png" width="75" height="75" />
</a>

<br />

想在這裡秀你的 Logo 嗎？[在 Twitter 上私訊我](https://twitter.com/HookForm)

## 支持者

感謝所有支持者！ [[成為支持者](https://opencollective.com/react-hook-form#backer)]

<a href="https://opencollective.com/react-hook-form#backers">
    <img src="https://opencollective.com/react-hook-form/backers.svg?width=950" />
</a>

## 組織機構

感謝這些優質的組織！ [[捐助](https://opencollective.com/react-hook-form/contribute)]

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
    <img src="https://opencollective.com/react-hook-form/organizations.svg?width=950" />
</a>

## 貢獻者

感謝這些出色的人！ [[成為貢獻者](../CONTRIBUTING.md)]

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
    <img src="https://opencollective.com/react-hook-form/contributors.svg?width=950" />
</a>
