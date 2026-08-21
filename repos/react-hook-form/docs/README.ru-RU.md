<div align="center">
    <p align="center">
        <a href="https://react-hook-form.com" title="React Hook Form - Simple React forms validation">
            <img src="https://raw.githubusercontent.com/bluebill1049/react-hook-form/master/docs/logo.png" alt="React Hook Form Logo - React hook custom hook for form validation" width="300px" />
        </a>
    </p>
</div>

<p align="center">Производительные, гибкие с возможностью расширения и простой в использовании валидацией формы.</p>

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

<a href="./README.V6.md">English</a> | <a href="./README.zh-TW.md">繁中</a> | <a href="./README.zh-CN.md">简中</a> | <a href="./README.ja-JP.md">日本語</a> | <a href="./README.ko-KR.md">한국어</a> | <a href="./README.fr-FR.md">Français</a> | <a href="./README.it-IT.md">Italiano</a> | <a href="./README.pt-BR.md">Português</a> | <a href="./README.es-ES.md">Español</a> | Русский | <a href="./README.de-DE.md">Deutsch</a> | <a href="./README.tr-TR.md">Türkçe</a>

## Особенности

- Нацелены на производительность и DX
- Применение неконтролируемой проверки форм
- Улучшение производительности контролируемых форм
- [Крошечный размер](https://bundlephobia.com/result?p=react-hook-form@latest) без каких-либо зависимостей
- Следование стандартам HTML для валидации
- Совместимость с React Native
- Поддержка [Yup](https://github.com/jquense/yup), [Joi](https://github.com/hapijs/joi), [Superstruct](https://github.com/ianstormtaylor/superstruct) и своих реализаций валидации
- Поддержка нативной браузерной валидации
- Возможность быстро создавать формы с [конструктором форм](https://react-hook-form.com/form-builder)

## Установка

    $ npm install react-hook-form

## Ссылки

- [Мотивация](https://medium.com/@bruce1049/form-validation-with-hook-in-3kb-c5414edf7d64)
- [Видеоурок](https://www.youtube.com/watch?v=-mFXqOaqgZk&t)
- [Начать](https://react-hook-form.com/get-started)
- [АПИ](https://react-hook-form.com/docs)
- [Примеры](https://github.com/bluebill1049/react-hook-form/tree/master/examples)
- [Демонстрация](https://react-hook-form.com)
- [Конструктор форм](https://react-hook-form.com/form-builder)
- [ЧЗВ](https://react-hook-form.com/faqs)

## Быстрый старт

```jsx
import React from 'react';
import { useForm } from 'react-hook-form';

function App() {
  const { register, handleSubmit, errors } = useForm(); // инициализация хука
  const onSubmit = (data) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input name="firstname" ref={register} /> {/* регистрация поля ввода */}
      <input name="lastname" ref={register({ required: true })} />
      {errors.lastname && 'Фамилия обязательна.'}
      <input name="age" ref={register({ pattern: /\d+/ })} />
      {errors.age && 'Пожалуйста, введите ваш возраст.'}
      <input type="submit" />
    </form>
  );
}
```

## Спонсоры

Спасибо всем кто поддерживает нас! [[Стать спонсором](https://opencollective.com/react-hook-form#backer)].

<a href="https://opencollective.com/react-hook-form#backers">
    <img src="https://opencollective.com/react-hook-form/backers.svg?width=950" />
</a>

## Организации

Спасибо этим замечательным организациям! [[Спонсировать](https://opencollective.com/react-hook-form/contribute)]

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
    <img src="https://opencollective.com/react-hook-form/organizations.svg?width=950" />
</a>

## Участники

Спасибо этим замечательным людям! [[Стать участником](../CONTRIBUTING.md)].

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
    <img src="https://opencollective.com/react-hook-form/contributors.svg?width=950" />
</a>
