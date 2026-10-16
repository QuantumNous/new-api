<div align="center">
        <a href="https://react-hook-form.com" title="React Hook Form - تحقق من صحة استمارة في React بسهولة">
            <img src="https://raw.githubusercontent.com/react-hook-form/react-hook-form/master/docs/logo.png" alt="شعار React Hook Form - خطاف React المخصص للتحقق من صحة استمارة" />
        </a>
</div>

https://user-images.githubusercontent.com/10513364/152621466-59a41c65-52b4-4518-9d79-ffa3fafa498a.mp4

<div align="center">

[![عدد التنزيلات من npm](https://img.shields.io/npm/dm/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/npm/dt/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/npm/l/react-hook-form?style=for-the-badge)](https://github.com/react-hook-form/react-hook-form/blob/master/LICENSE)
[![Discord](https://img.shields.io/discord/754891658327359538.svg?style=for-the-badge&label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/yYv7GZ8)

</div>

<p align="center">
  <a href="https://react-hook-form.com/get-started">البدء</a> | 
  <a href="https://react-hook-form.com/docs">واجهة التطبيق البرمجية</a> |
  <a href="https://github.com/bluebill1049/react-hook-form/tree/master/examples">أمثلة</a> |
  <a href="https://react-hook-form.com">عرض توضيحي</a> |
  <a href="https://react-hook-form.com/form-builder">منشئ استمارة</a> |
  <a href="https://react-hook-form.com/faqs">أسئلة شائعة</a>
</p>

### الميزات

- تم تصميمه مع مراعاة الأداء وتجربة المستخدم وسهولة التطوير
- يدعم التحقق من صحة استمارة الأساسي في HTML [validation](https://react-hook-form.com/get-started#Applyvalidation)
- اندماج مباشر مع مكتبات واجهة المستخدم [UI libraries](https://codesandbox.io/s/react-hook-form-v7-controller-5h1q5)
- [Small size] (https://bundlephobia.com/result?p=react-hook-form@latest) ولا [dependencies](./package.json)
- دعم [Yup](https://github.com/jquense/yup), [Zod](https://github.com/colinhacks/zod), [AJV](https://github.com/ajv-validator/ajv), [Superstruct](https://github.com/ianstormtaylor/superstruct), [Joi](https://github.com/hapijs/joi), [Vest](https://github.com/ealush/vest), [class-validator](https://github.com/typestack/class-validator), [io-ts](https://github.com/gcanti/io-ts), [nope](https://github.com/bvego/nope-validator) وبناء مخصص

### التثبيت

    npm install react-hook-form

### البداية السريعة

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
      {errors.lastName && <p>اسم العائلة مطلوب.</p>}
      <input {...register('age', { pattern: /\d+/ })} />
      {errors.age && <p>الرجاء إدخال عدد للعمر.</p>}
      <input type="submit" />
    </form>
  );
}
``` 
<a href="https://ui.dev/bytes/?r=bill">
  <img src="https://raw.githubusercontent.com/react-hook-form/react-hook-form/master/docs/ads-1.jpeg" />
</a>
الرعاة
شكرًا لهذه الشركات والأفراد اللطفاء والمحبين!

~الرعاة

الداعمين
شكرًا لجميع داعمينا! [كن داعمًا].

<a href="https://opencollective.com/react-hook-form#backers">
    <img src="https://opencollective.com/react-hook-form/backers.svg?width=950" />
</a>
المساهمين
شكرًا لهؤلاء الأشخاص الرائعين! [كن مساهمًا].

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
  <img src="https://opencollective.com/react-hook-form/contributors.svg?width=890&button=false" />
</a>
المساعدين
شكرًا لكم على مساعدتكم والإجابة على أسئلة المجتمع.

~المساعدين

المنظمات
شكرًا لهذه المنظمات الرائعة! [ساهم].

<a href="https://github.com/react-hook-form/react-hook-form/graphs/contributors">
    <img src="https://opencollective.com/react-hook-form/organizations.svg?width=890" />
</a>