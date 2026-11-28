<div align="center">
    <p align="center">
        <a href="https://react-hook-form.com" title="React Hook Form - Simple React forms validation">
            <img src="https://raw.githubusercontent.com/bluebill1049/react-hook-form/master/docs/logo.png" alt="React Hook Form Logo - React hook custom hook for form validation" width="300px" />
        </a>
    </p>
</div>

<p align="center">유연하고 확장 가능한 사용하기 쉬운 고성능 폼 검증 라이브러리</p>

<div align="center">

[![npm downloads](https://img.shields.io/npm/dm/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/npm/dt/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/bundlephobia/minzip/react-hook-form?style=for-the-badge)](https://bundlephobia.com/result?p=react-hook-form)
[![Coverage Status](https://img.shields.io/coveralls/github/bluebill1049/react-hook-form/master?style=for-the-badge)](https://coveralls.io/github/bluebill1049/react-hook-form?branch=master)

[![Tweet](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?text=React+hooks+for+form+validation+without+the+hassle&url=https://github.com/bluebill1049/react-hook-form)&nbsp;[![Join the community on Spectrum](https://withspectrum.github.io/badge/badge.svg)](https://spectrum.chat/react-hook-form)

</div>

<div align="center">
    <p align="center">
        <a href="https://react-hook-form.com" title="React Hook Form - Simple React forms validation">
            <img src="https://raw.githubusercontent.com/bluebill1049/react-hook-form/master/docs/example.gif" alt="React Hook Form video - React custom hook for form validation" width="100%" />
        </a>
    </p>
</div>

<a href="./README.V6.md">English</a> | <a href="./README.zh-TW.md">繁中</a> | <a href="./README.zh-CN.md">简中</a> | <a href="./README.ja-JP.md">日本語</a> | 한국어 | <a href="./README.fr-FR.md">Français</a> | <a href="./README.it-IT.md">Italiano</a> | <a href="./README.pt-BR.md">Português</a> | <a href="./README.es-ES.md">Español</a> | <a href="./README.ru-RU.md">Русский</a> | <a href="./README.de-DE.md">Deutsch</a> | <a href="./README.tr-TR.md">Türkçe</a>

## 특징

- 성능과 DX를 기반으로 구축
- 제어되지 않는 양식 검증
- 제어 된 양식의 성능을 향상시킵니다
- 의존성 없는 [작은 용량](https://bundlephobia.com/result?p=react-hook-form@latest)
- HTML 표준을 따르는 검증
- React Native 와 호환
- [Yup](https://github.com/jquense/yup), [Joi](https://github.com/hapijs/joi), [Superstruct](https://github.com/ianstormtaylor/superstruct) 또는 custom 지원
- 브라우저 네이티브 검증 지원
- [Form Builder](https://react-hook-form.com/form-builder)로 폼 빠르게 생성

## 설치

    $ npm install react-hook-form

## 링크

- [만들게된 동기](https://medium.com/@bruce1049/form-validation-with-hook-in-3kb-c5414edf7d64)
- [비디오 튜토리얼](https://www.youtube.com/watch?v=-mFXqOaqgZk&t)
- [시작하기](https://react-hook-form.com/get-started)
- [API](https://react-hook-form.com/docs)
- [예제](https://github.com/bluebill1049/react-hook-form/tree/master/examples)
- [데모](https://react-hook-form.com)
- [Form Builder](https://react-hook-form.com/form-builder)
- [FAQs](https://react-hook-form.com/faqs)

## 시작하기

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

## 기여자

모든 기여자 분들께 감사합니다! [[기여하기](../CONTRIBUTING.md)]

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
    <img src="https://opencollective.com/react-hook-form/contributors.svg?width=950" />
</a>

## 조직

이 훌륭한 조직에 감사드립니다! [[기증하다](https://opencollective.com/react-hook-form/contribute)]

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
    <img src="https://opencollective.com/react-hook-form/organizations.svg?width=950" />
</a>

## 후원자

모든 후원자 분들께 감사합니다! [[후원하기](https://opencollective.com/react-hook-form#backer)]

<a href="https://opencollective.com/react-hook-form#backers">
    <img src="https://opencollective.com/react-hook-form/backers.svg?width=950" />
</a>
