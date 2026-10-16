<div align="center">
        <a href="https://react-hook-form.com" title="React Hook Form - Simple React forms validation">
            <img src="https://raw.githubusercontent.com/react-hook-form/react-hook-form/master/docs/logo.png" alt="React Hook Form Logo - React hook custom hook for form validation" />
        </a>
</div>

https://user-images.githubusercontent.com/10513364/152621466-59a41c65-52b4-4518-9d79-ffa3fafa498a.mp4

<div align="center">

[![npm downloads](https://img.shields.io/npm/dm/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/npm/dt/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/npm/l/react-hook-form?style=for-the-badge)](https://github.com/react-hook-form/react-hook-form/blob/master/LICENSE)
[![Discord](https://img.shields.io/discord/754891658327359538.svg?style=for-the-badge&label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/yYv7GZ8)

</div>

<p align="center">
  <a href="https://react-hook-form.com/get-started">Get started</a> | 
  <a href="https://react-hook-form.com/docs">API</a> |
  <a href="https://github.com/bluebill1049/react-hook-form/tree/master/examples">Examples</a> |
  <a href="https://react-hook-form.com">Demo</a> |
  <a href="https://react-hook-form.com/form-builder">Form Builder</a> |
  <a href="https://react-hook-form.com/faqs">FAQs</a>
</p>

### Features

- Built with performance, UX and DX in mind
- Embraces native HTML form [validation](https://react-hook-form.com/get-started#Applyvalidation)
- Out of the box integration with [UI libraries](https://codesandbox.io/s/react-hook-form-v7-controller-5h1q5)
- [Small size](https://bundlephobia.com/result?p=react-hook-form@latest) and no [dependencies](./package.json)
- Support [Yup](https://github.com/jquense/yup), [Zod](https://github.com/colinhacks/zod), [AJV](https://github.com/ajv-validator/ajv), [Superstruct](https://github.com/ianstormtaylor/superstruct), [Joi](https://github.com/hapijs/joi), [Vest](https://github.com/ealush/vest), [class-validator](https://github.com/typestack/class-validator), [io-ts](https://github.com/gcanti/io-ts), [nope](https://github.com/bvego/nope-validator) and custom build

### Install

    npm install react-hook-form

### Quickstart

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
      <input {...register('firstName')} />
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

### Sponsors

Thanks go to these kind and lovely sponsors (companies and individuals)!

~Sponsors

### Backers

Thanks go to all our backers! [[Become a backer](https://opencollective.com/react-hook-form#backer)].

<a href="https://opencollective.com/react-hook-form#backers">
    <img src="https://opencollective.com/react-hook-form/backers.svg?width=950" />
</a>

### Contributors

Thanks go to these wonderful people! [[Become a contributor](CONTRIBUTING.md)].

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
  <img src="https://opencollective.com/react-hook-form/contributors.svg?width=890&button=false" />
</a>

### Helpers

Thank you for helping and answering questions from the community.

~Helpers

### Organizations

Thanks go to these wonderful organizations! [[Contribute](https://opencollective.com/react-hook-form/contribute)].

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
    <img src="https://opencollective.com/react-hook-form/organizations.svg?width=890" />
</a>

<!--  -->
