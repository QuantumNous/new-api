---
category: Getting Started
title:  Frequently Asked Questions
subTitle: Frequently Asked Questions
icon: doc-faq
localeCode: en-US
order: 11
---


#### Semi now offers Figma UI Kit, will Sketch or other design tool based versions be available in the future?
No plan for this. Specific reasons: [Issue 74](https://github.com/DouyinFE/semi-design/issues/74)

#### Semi currently provides a React-based ui library. Is there any official plan to provide other technology stack libs?
No plans for this. Specific reasons: [Issue 311](https://github.com/DouyinFE/semi-design/issues/311), more discussion [Issue 56](https://github.com/DouyinFE/semi-design/issues/56)

#### Semi's default theme style does not match the positioning of our system. Can i configure another theme?

- Please refer to [Custom theme](/en-US/start/customize-theme). Semi provides **up to 2300+ Design Tokens to allow users to perform in-depth customization**, whether you are a R&D or a designer, you can easily configure the style layer in [Semi DSM](/dsm), and in code, Figma always keep two-way sync. Based on Semi, you can **customize your own Design System at low cost**  Make `Semi Design` to `Any Design`
- And when using, you only need to specify the theme package name used in webpack.config.js to complete the access (the Semi plugin needs to be connected).

#### In what situations recommend using Design Tokens to customize styles, and in what situations recommend using CSS overrides to customize styles?

- Design Token is mainly suitable for scenarios that require branding and style customization. It needs to be configured through [Semi DSM](/dsm), and the released product is an npm theme package. The scope of effect of Design Token is global. For example, if the component-level tokens of Button and Table are adjusted, it will take effect for all Semi Buttons and Semi Tables in the app, and cannot be adjusted only for a specific submodule
- If you only need to adjust the style of a certain component under a specific module, it is not recommended to use Design Token, and it is recommended to directly use CSS selectors to override styles


#### What is the relationship between Semi 2.x (open source version) and Semi 1.x?
 - The Semi v2.0 version is refactored based on v1.x using ts, which brings a better ts experience, bettter a11y support and a more out-of-the-box engineering solution, which solves the coexistence of multi-component libraries in the micro front-end scenario Style conflict issues, etc. All subsequent long-term work of the Semi team will be based on the v2.x version
 - v1.x has stopped iterative maintenance, no more feature additions or complex changes, only necessary bug fix changes are provided.
 - For new projects, we recommend that you directly use 2.x [@douyin/semi-ui](https://semi.design) for development. For existing projects, we also recommend that you upgrade as soon as possible. In order to reduce the cost of upgrading, we provide a cli tool one-click migration (@ies/semi-codemod-v2) that can help you automatically complete up to 90% of the migration and modification (limited by the AST implementation principle, there are still a small number of cases that require manual labor review modification, but not much 😉)
 - Upgrade from Semi 1.x to Semi 2.x for detailed operation steps [From v1 to v2](https://semi.design/en-US/start/update-to-v2)

#### Relationship between versions

- Semi version numbers follow the Semver specification (major version number - minor version number - revision number). We will add features or components in the minor version, and we will only fix bugs in the patch version, but will not update new features. However, there may be style adjustments between different minor versions. When you need to upgrade, we recommend that you use the version diff on the changelog page to check all changes and whether they have an impact on your code.
- All subsequent new features and components will be developed based on version 2.x. We recommend business parties to keep using the latest version as much as possible
- Between 2.x versions, the API will remain **forward compatible**
- The API will also remain **forward compatible** between 1.x versions. When upgrading from 1.x to 2.x, breaking changes will be included, please refer to the documentation for specific upgrade precautions


#### TS type check reports an error, indicating that the attribute children does not exist on xxx or that XXX cannot be used as a JSX component
This is due to the breaking changes of `@types/react` v18. In most cases, two different versions of @types/react will be installed in your project, resulting in no match. Please refer to [Issue 793](https://github.com/DouyinFE/semi-design/issues/793) to lock the version, ensure that only a single version exists

#### Why is defaultValue, default XXX not working?

Property like `defaultValue`, `defaultXXX` will only be consumed once when the component mount. If your `defaultXXX` property is updated asynchronously later, the component will not reconsume the value. If necessary, you should use controlled `value`, controlled `XXX`.
Or force React to remount the component by passing in a different `key`.

#### Does Semi support i18n?
As of 2023-04, Semi supports 21 languages. See [Semi·LocaleProvider](/en-US/other/locale) for details.

#### Who should I look for if there is a new component requirement, or an existing component Feature does not meet my business needs?

You can submit your issue to describe your needs. Issue Label Please select `Feature Request` / `New Component Request`. We will handle these needs with high quality.

#### Confused about the use of components? I wonder if there are components that can meet your business needs scenarios?

Welcome to ours [Customer Service Lark Group](https://bytedance.feishu.cn/docs/doccnw93Dujm3UCkHRDTMTm1qwe) For a consultation question.

#### Is the style of Semi based on Scss or Less? Why not use CSS Module?

Our style is based on Scss, and we also use CSS Variable as the color wheel variable. Color variables and common variables are mounted under `body`. CSS Module is not used because we want to have a fixed className and retain the ability to modify / override Semi style for our users(although it is not recommended, it is really needed sometime).

#### Why do some forms of content not wrap when the content in Tooltip and Typography is very long?  
Before the v2.36.0 version, considering that different language content (e.g. English, Chinese, combination of English and Chinese) have inconsistent requirements for line breaks, so Semi does not use a default setting. After receiving a lot of usage feedback, since the v2.36.0 version, Tooltip has internally set <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap" target= "_blank" rel="noopener noreferrer">word-wrap</a> handles text wrapping for break-word. For any version, if the default settings are not as expected, the user can adjust the line break related CSS properties through the style/className API.

#### More FAQ
Please refer to https://bytedance.feishu.cn/docs/doccnMRDbkhde6p3dMokfFpcNug