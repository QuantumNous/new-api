# Contributing

We are glad that you are interested in contributing to Semi UI. Please take some minutes to read the following guidelines:
## Branch Management
Semi Team will maintain two resident branches: `main` and `release`, we will release the code follow our [Publishing Period](https://semi.design/en-US/start/changelog)
 - main: This branch is just a snapshot of the **latest stable** release. After minor release, we will merge `release` into this branch.
 - release: Bug fixes and feature development will merge into this branch first, new version will be released based on this branch on release day.
## Bug
We use Github issues to track bugs. In order to understand and fix bugs faster, when reporting a bug, you can also reproduce the problem through the template we provide. we recommend you
## Feature
If you have an idea to provide or optimize features, we recommend that you use Github issues to suggest a new issue
## Pull Request Guidelines
The Semi Design team will take every Pull Request seriously. We will review and merge your code. It is also possible to suggest some modifications to your code.
To open a Pull Request, please follow the steps below:
 - Fork our repo, then clone your fork
```bash
git clone https://github.com/<your-username>/semi-design.git
cd semi-design
```
 - Checkout a topic branch
```bash
git checkout -b <TOPIC_BRANCH_NAME>
```
>Before installing the enviroment,make sure that there is a dependency of `lerna` and `yarn` locally, if not, should run:
```base
corepack enable
```

```bash
npm install --global lerna@6
```
 - Install the dependencies
```bash
npm run bootstrap
```
 - Next, make the modifications you want to make, which can be bug fixes or development of new features
 - You can verify your change by running storybook (`npm start`) and official website (`npm run docsite`) locally
 - Add accompanying tests for your change, ensure all tests pass
```bash
npm run test:unit
```
 - Open a Pull Request against `release` of source repo

We may ask or help you to modify the PR according to the situation. For inappropriate PR, we will close it with an explanation.  
If your changes involve style changes or Design Token changes, please read [Semi SCSS Variable Writing/File Citation Specification](https://bytedance.feishu.cn/docx/doxcnsFphF1yOqQJRSGqw6zkxTh)

## Help Improve the Docs
The documentation site is based on [gatsby](https://www.gatsbyjs.com/), and the code is in the `src` directory.

**The component documentation is located in the md file under the `semi-ui` component folder.** Take tooltip as an example:

* Chinese document `packages/semi-ui/tooltip/index.md` 
* English document `packages/semi-ui/tooltip/index-en-US.md`

To get started:
```sh
npm run docsite
```
If you are interested in helping us improve the doc, please modify the md file of the component and submit your changes according to the Pull Request guidelines
