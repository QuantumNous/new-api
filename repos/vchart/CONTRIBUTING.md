First of all, I would like to give you a thumbs up 👍🏻 for choosing to contribute to the open source community. Also, thank you very much for choosing to participate in the VisActor community and contribute to this open source project.

## VChart Contribution Guide

The VisActor team usually develops and maintains issues on GitHub. Please open the [GitHub website](https://github.com/), click the `Sign up `button in the upper right corner, register your own account, and take the first step in your open source journey.

If you cannot open the Github site due to special circumstances, please inform us and proceed with project development through [Gitee](https://gitee.com/VisActor/VChart).

In the [VChart repository](https://github.com/VisActor/VChart), we have a [guide ](https://github.com/VisActor/VChart/blob/develop/CONTRIBUTING.md)for all open source contributors on versioning, branching, and more. **Please take a few minutes to read about it** .

## Your first PullRequest

### Step 0: Install Git

Git is a version control system used to track and manage code changes in software development projects. It helps developers record and manage the history of code, facilitating team collaboration, code version control, merging code, and other operations. With Git, you can track each version of each file and easily switch and compare between different versions. Git also provides branch management functionality, allowing for multiple parallel development tasks to be performed simultaneously.

- Visit the official Git website: [https://git-scm.com](https://git-scm.com/)
- Download the latest version of the Git installer.
- Run the downloaded installation program and follow the prompts of the installation wizard to install.
- After the installation is complete, you can use the Command Line command `git version `to confirm the installation is successful.

### Step 1: Fork the project

- First, you need to fork this project, enter the [VChart project page](https://github.com/VisActor/VChart), and click the Fork button in the upper right corner

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/fork.PNG)

- The project Your_Github_Username/vchart will appear in your GitHub account
- Use the following command on your local computer: Get a VChart folder

```
// ssh
git clone git@github.com:Your_Github_Username/VChart.git
// https
git clone https://github.com/Your_Github_Username/VChart.git
```

### Step 2: Get the project code

- Go to the VChart folder and add the remote address of the VChart

```
git remote add upstream https://github.com/VisActor/VChart.git
```

- Get the latest source code of VChart

```
git pull upstream develop
```

### Step 3: Create a branch

- Okay, now we can start contributing our code. The default branch of VChart is the develop branch. Whether it's feature development, bug fixing, or documentation writing, please create a new branch and merge it into the develop branch. Use the following code to create a branch:

```
// Create a feature development branch
git checkout -b feat/xxxx

// Create a issue-fix development branch
git checkout -b fix/xxxx

// Create documentation and demo branches
git checkout -b docs/add-funnel-demo
```

Suppose we create a document modification branch `docs/add-fund-demo`

- Now we can change the code on the branch

- Assuming we have added some code and submitted it to the codebase

- Git commit -a -m "docs: add custom funnel demo and related docs". The commit information of VisActor follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)specification

  - `<type>[optional scope]: <description>`
  - The commonly used `types `include docs (document, log modification), feat (new feature), fix (problem repair), refactor (Code Refactoring), etc. Please choose according to the actual situation.
  - Please write a brief and accurate description in English.
  - Before submitting the commit, we will perform a commit lint check, you can check the [rules](https://github.com/VisActor/VChart/blob/98711490e90532d896dd9e44dd00a3af5b95f06d/common/autoinstallers/lint/commitlint.config.js)

### Step 4: Merge and modify

- A common issue is that remote upstream (@visactor/vchart) has new updates, which can cause conflicts when we submit Pull Requests. Therefore, we can merge the commits of other remote developers with ours before submitting. Use the following code to switch to the develop branch.

```
git checkout develop
```

- Use the following code to pull out the latest remote code:

```
git pull upstream develop
```

- Switch back to your own development branch.

```
git checkout docs/add-funnel-demo
```

- Merge the develop commit into your own branch.

```
git rebase develop
```

- Submit the updated code to your own branch.

```
git push origin docs/add-funnel-demo
```

### Step 5: Submit Pull Request

You can click the `Compare & Pull Request `button on your GitHub repository page.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/create-PR.png)

Or create via the `contribute `button:

<div align='center'>
<img style="width:200px" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/create-PR-2.png">
</div>

Fill in the submitted modification content according to the template.

- Check what type of modification this is

<div align='center'>
<img style="width:200px" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/issue-checklist.png">
</div>

- Fill in the associated issue

<div align='center'>
<img style="width:200px" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/related-issue.png">
</div>

- If there are complex changes, please explain the background and solution

<div align='center'>
<img style="height:120px" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/issue-background.png">
</div>

After filling in the relevant information, click Create pull request to submit.

## Getting Started with VChart Contribution

" **Good first issue** " is a common hashtag in the open source community, and the purpose of this hashtag is to help new contributors find problems that are suitable for beginners.

VChart beginner questions, you can view through the [issues list](https://github.com/VisActor/VChart/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22), currently includes two categories:

- Demo case production
- Simple feature development

If you currently **have time and willingness** to participate in community contributions, you can take a look at the **good first issue** in the issue and choose a claim that is interested and suitable for yourself.

I believe you must be a colleague who has a beginning and an end. Therefore, when you understand and decide to claim an issue, please leave a message under the issue to inform everyone.

### Demo Task Development Guide

We have prepared some common cases in practical application scenarios and need to consider how to utilize the capabilities of VChart to achieve them.

You can get started with using VChart through this type of task. VChart provides rich capabilities, and everyone may have different implementation ideas. **You can leave a message under the issue and discuss your own plan with everyone** .

After completing the task, you can submit the self-made case to the official website demo for more people in need to learn and use.

All demos are stored in the `docs/assets/examples` directory

1.  Please create a new `docs/***` or `demo/***` branch based on the develop branch for development
2.  (If you have already installed, skip this step) Global installation [@microsoft/rush](https://rushjs.io/pages/intro/get_started/): `npm i --global @microsoft/rush`
3.  Run `rush update`
4.  Run `rush docs` to preview the current demo content locally
5.  `Docs` directory
    1.  `Docs/assets/examples/menu.json` Add your demo information to the directory file
    2.  Complete the Chinese and English demo documents in the `zh`/`en` directory respectively
    3.  Add the demo preview image in the `docs/public/vchart/preview` directory and update the path in the demo document accordingly, for example, `/vchart/preview/basic-map_1.9.1.png`
6.  Submit all code and create a Pull Request on Github, inviting others to review

### Feature Task Development Guide

We have prepared some simple and easy-to-use feature development tasks. If you have a certain foundation in JavaScript/TypeScript, you can claim these tasks.

You can understand the VChart code architecture faster through requirement development. **You can leave a message under the issue and discuss your own plan with everyone** .

1.  Please create a new `feat/*** `branch based on the develop branch for development
2.  (If you have already installed, skip this step) Global installation [@microsoft/rush](https://rushjs.io/pages/intro/get_started/): `npm i --global @microsoft/rush`
3.  Run `rush update`
4.  Run `rush start ` to start demo page:
    1.  You can create a index.page page under `develop/packages/vchart/__tests__/runtime/browser `to import your own created development use cases
5.  Confirm that all tests pass the `rush test`
6.  After development is finished, run `rush change `command, write changelog and submit
7.  Submit all code and create a Pull Request on Github, inviting others to review

### Promotion Task Contribution Guide

A promotion task refers to the action of publicly releasing materials related to VisActor, such as articles, demos, videos, etc., across various media channels.

You can create a new issue, select the type others and tag it with promotion. Then, post it along with relevant links, screenshots, summaries, etc.

For example, see https://github.com/VisActor/VChart/issues/2858.

Every quarter, we will select some promotional works for VisActor and provide the authors with material rewards.

## Embrace the VisActor community

In addition to contributing code to VisActor, we encourage you to participate in other things that make the community more prosperous, such as:

1.  Provide suggestions for project development, functional planning, etc
2.  Create articles, videos, and hold lectures to promote VisActor.
3.  Write promotion plan and execute it together with the team

VisActor is also working hard to help colleagues who participate in community building grow together. We plan (but are not limited to, looking forward to more suggestions from everyone) to provide the following assistance:

1.  Data lake visualization development training based on VisActor helps participating colleagues grow rapidly in programming skills, visualization theory, architecture design and other aspects.
2.  Regularly select "Code Contribution Award" and "Community Promotion Award".
3.  Organize community members to participate in open source activities

## FAQ

### node-canvas installation failure

VChart is a monorepo project, and when running VChart on the node side, we rely on the [node-canvas](https://github.com/Automattic/node-canvas) library. Therefore, when executing `rush update`, the `node-canvas` package needs to be installed. However, this package may fail to install on different operating systems. You can refer to the [node-canvas](https://github.com/Automattic/node-canvas) readme for installation dependencies. The installation methods for various operating systems are as follows:

| OS      | Command                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| macOS   | Using [Homebrew](https://brew.sh/): `brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman python-setuptools` |
| Ubuntu  | `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`                      |
| Fedora  | `sudo yum install gcc-c++ cairo-devel pango-devel libjpeg-turbo-devel giflib-devel`                                           |
| Solaris | `pkgin install cairo pango pkg-config xproto renderproto kbproto xextproto`                                                   |
| OpenBSD | `doas pkg_add cairo pango png jpeg giflib`                                                                                    |
| Windows | See the [wiki](https://github.com/Automattic/node-canvas/wiki/Installation:-Windows)                                          |
| Others  | See the [wiki](https://github.com/Automattic/node-canvas/wiki)                                                                |

If you encounter other node-canvas related issues, you can also search in the [node-canvas issue list](https://github.com/Automattic/node-canvas/issues).
