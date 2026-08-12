<div align="center">
        <a href="https://react-hook-form.com" title="React Hook Form - Simple React forms validation">
            <img src="https://raw.githubusercontent.com/react-hook-form/react-hook-form/master/docs/logo.png" alt="React Hook Form Logo - React hook custom hook for form validation" />
        </a>
</div>

<div align="center">

[![npm downloads](https://img.shields.io/npm/dm/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/npm/dt/react-hook-form.svg?style=for-the-badge)](https://www.npmjs.com/package/react-hook-form)
[![npm](https://img.shields.io/npm/l/react-hook-form?style=for-the-badge)](https://github.com/react-hook-form/react-hook-form/blob/master/LICENSE)
[![Discord](https://img.shields.io/discord/754891658327359538.svg?style=for-the-badge&label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/yYv7GZ8)

</div>

<p align="center">
  <a href="https://react-hook-form.com/get-started">Get started</a> | 
  <a href="https://react-hook-form.com/docs">API</a> |
  <a href="https://react-hook-form.com/form-builder">Form Builder</a> |
  <a href="https://react-hook-form.com/faqs">FAQs</a> |
  <a href="https://github.com/react-hook-form/react-hook-form/tree/master/examples">Examples</a>
</p>

### Features

- Built with performance, UX and DX in mind
- Embraces native HTML form [validation](https://react-hook-form.com/get-started#Applyvalidation)
- Out of the box integration with [UI libraries](https://codesandbox.io/s/react-hook-form-v7-controller-5h1q5)
- [Small size](https://bundlephobia.com/result?p=react-hook-form@latest) and no [dependencies](./package.json)
- Support [Yup](https://github.com/jquense/yup), [Zod](https://github.com/colinhacks/zod), [AJV](https://github.com/ajv-validator/ajv), [Superstruct](https://github.com/ianstormtaylor/superstruct), [Joi](https://github.com/hapijs/joi) and [others](https://github.com/react-hook-form/resolvers)

### Install

    npm install react-hook-form

### Quickstart

```jsx
import { useForm } from 'react-hook-form';

function App() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
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

### Sponsors

We’re incredibly grateful to these kind and generous sponsors for their support!

## Major Sponsors

| Follower24 | BuyFans |
|---|---|
| <a href="https://www.follower24.de/"><img src="https://images.opencollective.com/follower24/00297f8/avatar/256.png?height=256" width="120"/></a> | <a href="https://buy.fans/"><img src="https://images.opencollective.com/buy-instagram-followers-buyfans/2b97c05/logo/256.png?height=256" width="120"/></a> |

## Supporting Sponsors

| Thanks.dev | Workleap | Kinsta | Sent | Niche |
|---|---|---|---|---|
| <a href="https://thanks.dev/"><img src="https://avatars.githubusercontent.com/u/72539280?s=200&v=4" width="60"/></a> | <a href="https://workleap.com/"><img src="https://images.opencollective.com/workleap/db82f38/logo/256.png?height=256" width="60"/></a> | <a href="https://kinsta.com/"><img src="https://images.opencollective.com/kinsta/55912d7/logo/256.png?height=256" width="60"/></a> | <a href="https://www.sent.dm"><img src="https://avatars.githubusercontent.com/u/153308555?s=200&v=4" width="60"/></a> | <a href="https://niche.com"><img src="https://avatars.githubusercontent.com/u/8988784?s=200&v=4" width="60"/></a> |
| Toss | Principal | Hygraph |  |  |
| <a href="https://toss.im"><img src="https://images.opencollective.com/toss/3ed69b3/logo/256.png" width="60"/></a> | <a href="https://principal.com/about-us"><img src="https://images.opencollective.com/principal/431e690/logo/256.png?height=256" width="60"/></a> | <a href="https://hygraph.com"><img src="https://avatars.githubusercontent.com/u/31031438" width="60"/></a> |  |  |

### Past Sponsors

Thank you to our previous sponsors for your generous support!

| <a href="https://www.beekai.com/" target="_blank"><img src="https://www.beekai.com/marketing/logo/logo.svg" width="24" height="24" /></a> | <a href="https://route4me.com/" target="_blank"><img src="https://images.opencollective.com/route4me/71fb6fa/avatar/256.png?height=256" width="24" height="24" /></a> | <a href="https://www.sgkb.ch/" target="_blank"><img src="https://images.opencollective.com/st-galler-kantonalbank-ag/bfdd17f/logo/256.png?height=256" width="24" height="24" /></a> | <a href="https://www.sanity.io/" target="_blank"><img src="https://images.opencollective.com/sanity_io/558f87f/logo/256.png?height=256" width="24" height="24" /></a> | <a href="https://twicsy.com/" target="_blank"><img src="https://images.opencollective.com/buy-instagram-followers-twicsy/b4c5d7f/logo/256.png?height=256" width="24" height="24" /></a> | <a href="https://www.leniolabs.com/" target="_blank"><img src="https://www.leniolabs.com/images/leniolabs-isologo-example.jpg" width="24" height="24" /></a> | <a href="https://underbelly.is" target="_blank"><img src="https://images.opencollective.com/underbelly/989a4a6/logo/256.png" width="24" height="24" /></a> | <a href="https://feathery.io" target="_blank"><img src="https://images.opencollective.com/feathery1/c29b0a1/logo/256.png" width="24" height="24" /></a> | <a href="https://getform.io" target="_blank"><img src="https://images.opencollective.com/getformio2/3c978c8/avatar/256.png" width="24" height="24" /></a> | <a href="https://marmelab.com/" target="_blank"><img src="https://images.opencollective.com/marmelab/d7fd82f/logo/256.png" width="24" height="24" /></a> |
|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| <a href="https://formcarry.com/" target="_blank"><img src="https://images.opencollective.com/formcarry/a40a4ea/logo/256.png" width="24" height="24" /></a> | <a href="https://fabform.io" target="_blank"><img src="https://images.opencollective.com/fabform/2834037/logo/256.png" width="24" height="24" /></a> | <a href="https://www.thinkmill.com.au/" target="_blank"><img src="https://images.opencollective.com/thinkmill/28910ec/logo/256.png" width="24" height="24" /></a> | <a href="https://kwork.studio/" target="_blank"><img src="https://images.opencollective.com/knowledge-work/f91b72d/logo/256.png" width="24" height="24" /></a> | <a href="https://fiberplane.com/" target="_blank"><img src="https://avatars.githubusercontent.com/u/61152955?s=200&v=4" width="24" height="24" /></a> | <a href="https://www.jetbrains.com/" target="_blank"><img src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.png" width="24" height="24" /></a> | <a href="https://www.mirakl.com/" target="_blank"><img src="https://images.opencollective.com/mirakl/0b191f0/logo/256.png" width="24" height="24" /></a> | <a href="https://wantedlyinc.com" target="_blank"><img src="https://images.opencollective.com/wantedly/d94e44e/logo/256.png" width="24" height="24" /></a> | <a href="https://www.casinoreviews.net/" target="_blank"><img src="https://images.opencollective.com/casinoreviews/f0877d1/logo/256.png" width="24" height="24" /></a> | <a href="https://kanamekey.com" target="_blank"><img src="https://images.opencollective.com/kaname/d15fd98/logo/256.png" width="24" height="24" /></a> |

### Backers

Thanks go to all our backers! [[Become a backer](https://opencollective.com/react-hook-form#backer)].

<a href="https://opencollective.com/react-hook-form#backers">
    <img src="https://opencollective.com/react-hook-form/backers.svg?width=820" />
</a>

### Contributors

Thanks go to these wonderful people! [[Become a contributor](CONTRIBUTING.md)].

<br />
<br />

<p align="center">Documentation website supported and backed by <a href="https://vercel.com"><b>Vercel</b></a></p>
