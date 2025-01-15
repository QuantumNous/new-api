# vue-router [![Build Status](https://img.shields.io/circleci/project/github/vuejs/vue-router/dev.svg)](https://circleci.com/gh/vuejs/vue-router)

> This is vue-router 3.0 which works only with Vue 2.0.
> - For the 1.x router see the [1.0 branch](https://github.com/vuejs/vue-router/tree/1.0).
> - For Vue Router 4 (for Vue 3) see [vuejs/router](https://github.com/vuejs/router).

<h2 align="center">Supporting Vue Router</h2>

Vue Router is part of the Vue Ecosystem and is an MIT-licensed open source project with its ongoing development made possible entirely by the support of Sponsors. If you would like to become a sponsor, please consider:

- [Become a Sponsor on GitHub](https://github.com/sponsors/posva)
- [One-time donation via PayPal](https://paypal.me/posva)

<!--sponsors start-->

<h4 align="center">Gold Sponsors</h4>
<p align="center">
    <a href="https://vuejobs.com/?utm_source=vuerouter&utm_campaign=sponsor" target="_blank" rel="noopener noreferrer">
    <picture>
      <source srcset="https://posva-sponsors.pages.dev/logos/vuejobs.svg" media="(prefers-color-scheme: dark)" height="72px" alt="VueJobs" />
      <img src="https://posva-sponsors.pages.dev/logos/vuejobs.svg" height="72px" alt="VueJobs" />
    </picture>
  </a>
</p>

<h4 align="center">Silver Sponsors</h4>
<p align="center">
    <a href="https://www.vuemastery.com/" target="_blank" rel="noopener noreferrer">
    <picture>
      <source srcset="https://posva-sponsors.pages.dev/logos/vuemastery-dark.png" media="(prefers-color-scheme: dark)" height="42px" alt="VueMastery" />
      <img src="https://posva-sponsors.pages.dev/logos/vuemastery-light.svg" height="42px" alt="VueMastery" />
    </picture>
  </a>
    <a href="https://www.prefect.io/" target="_blank" rel="noopener noreferrer">
    <picture>
      <source srcset="https://posva-sponsors.pages.dev/logos/prefectlogo-dark.svg" media="(prefers-color-scheme: dark)" height="42px" alt="Prefect" />
      <img src="https://posva-sponsors.pages.dev/logos/prefectlogo-light.svg" height="42px" alt="Prefect" />
    </picture>
  </a>
</p>

<h4 align="center">Bronze Sponsors</h4>
<p align="center">
    <a href="https://stormier.ninja" target="_blank" rel="noopener noreferrer">
    <picture>
      <source srcset="https://avatars.githubusercontent.com/u/2486424?u=7b0c73ae5d090ce53bf59473094e9606fe082c59&v=4" media="(prefers-color-scheme: dark)" height="26px" alt="Stanislas OrmiÃ¨res" />
      <img src="https://avatars.githubusercontent.com/u/2486424?u=7b0c73ae5d090ce53bf59473094e9606fe082c59&v=4" height="26px" alt="Stanislas OrmiÃ¨res" />
    </picture>
  </a>
    <a href="www.vuejs.de" target="_blank" rel="noopener noreferrer">
    <picture>
      <source srcset="https://avatars.githubusercontent.com/u/4183726?u=6b50a8ea16de29d2982f43c5640b1db9299ebcd1&v=4" media="(prefers-color-scheme: dark)" height="26px" alt="Antony Konstantinidis" />
      <img src="https://avatars.githubusercontent.com/u/4183726?u=6b50a8ea16de29d2982f43c5640b1db9299ebcd1&v=4" height="26px" alt="Antony Konstantinidis" />
    </picture>
  </a>
    <a href="https://storyblok.com" target="_blank" rel="noopener noreferrer">
    <picture>
      <source srcset="https://posva-sponsors.pages.dev/logos/storyblok.png" media="(prefers-color-scheme: dark)" height="26px" alt="Storyblok" />
      <img src="https://posva-sponsors.pages.dev/logos/storyblok.png" height="26px" alt="Storyblok" />
    </picture>
  </a>
    <a href="https://nuxtjs.org" target="_blank" rel="noopener noreferrer">
    <picture>
      <source srcset="https://posva-sponsors.pages.dev/logos/nuxt-dark.svg" media="(prefers-color-scheme: dark)" height="26px" alt="NuxtJS" />
      <img src="https://posva-sponsors.pages.dev/logos/nuxt-light.svg" height="26px" alt="NuxtJS" />
    </picture>
  </a>
</p>

<!--sponsors end-->

---

Get started with the [documentation](http://router.vuejs.org), or play with the [examples](https://github.com/vuejs/vue-router/tree/dev/examples) (see how to run them below).

### Development Setup

```bash
# install deps
npm install

# build dist files
npm run build

# serve examples at localhost:8080
npm run dev

# lint & run all tests
npm test

# serve docs at localhost:8080
npm run docs
```

## Releasing

- `yarn run release`
  - Ensure tests are passing `yarn run test`
  - Build dist files `VERSION=<the_version> yarn run build`
  - Build changelog `yarn run changelog`
  - Commit dist files `git add dist CHANGELOG.md && git commit -m "[build $VERSION]"`
  - Publish a new version `npm version $VERSION --message "[release] $VERSION"
  - Push tags `git push origin refs/tags/v$VERSION && git push`
  - Publish to npm `npm publish`

## Questions

For questions and support please use the [Discord chat server](https://chat.vuejs.org) or [the official forum](http://forum.vuejs.org). The issue list of this repo is **exclusively** for bug reports and feature requests.

## Issues

Please make sure to read the [Issue Reporting Checklist](https://github.com/vuejs/vue/blob/dev/.github/CONTRIBUTING.md#issue-reporting-guidelines) before opening an issue. Issues not conforming to the guidelines may be closed immediately.

## Contribution

Please make sure to read the [Contributing Guide](https://github.com/vuejs/vue/blob/dev/.github/CONTRIBUTING.md) before making a pull request.

## Changelog

Details changes for each release are documented in the [`CHANGELOG.md file`](https://github.com/vuejs/vue-router/blob/dev/CHANGELOG.md).

## Stay In Touch

- For latest releases and announcements, follow on Twitter: [@vuejs](https://twitter.com/vuejs)

## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) 2013-present Evan You

## Special Thanks

<a href="https://www.browserstack.com">
  <img src="/assets/browserstack-logo-600x315.png" height="80" title="BrowserStack Logo" alt="BrowserStack Logo" />
</a>

Special thanks to [BrowserStack](https://www.browserstack.com) for letting the maintainers use their service to debug browser specific issues.
