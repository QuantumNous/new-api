---
title: 4. How to Contribute to a Demo

key words: VisActor, VChart, VTable, VStory, VMind, VGrammar, VRender, Visualization, Chart, Data, Table, Graph, GIS, LLM
---

# Creating a Branch

The default branch for VChart is the develop branch. Whether it's for feature development, bug fixes, or documentation writing, please create a new branch before merging it into the develop branch. Use the following code to create a branch:

```
// Create a documentation/demo branch
git checkout -b docs/add-funnel-demo

```

# Finding or Creating an Issue

In principle, we require that each PR must have a corresponding issue. Before starting development, please ensure there is a corresponding issue, and that the issue is not already claimed.

## Searching for Demo Issues

You can search for demo-related issues using the following method:

```
 label:demos

```

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RDQZbKyEYomaIRx7jwJccGoMnId.gif' alt='' width='769' height='auto'>

Some features may have the doc label associated with them. Check further if the issue is purely a demo task.

## Creating a Demo Issue

Click "NEW ISSUE" to open the issue selection page and choose "**Others**."

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VNGhbVirmoaQTIxhOlFc61w3nqb.gif' alt='' width='1000' height='auto'>

Fill in the information related to the document issue you want to submit, and tag it with "demos."

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Cc8SbSAFFoCvQ2xJFd6cjv17nyc.gif' alt='' width='1000' height='auto'>

# Claiming an Issue

If you want to submit a demo or fix a demo bug, you can leave a message in the issue to claim it. The administrator will contact you, and after confirmation, assign the issue to you.

For example:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Q2vGbhmevorebJxa8Toc1hmtnMc.gif' alt='' width='988' height='auto'>

# Creating or Modifying a Demo

The location of VChart documentation and demos within the project is as follows (examples):

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ObSbbLIPio1un5xZGv7cZ7m8nrh.gif' alt='' width='1000' height='auto'>

Taking the example document of a basic area chart as an example (currently, a single example contains both Chinese and English versions, located under the paths zh & en respectively):

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ZivMbU0iwouDoIx6T3pcleJnn1b.gif' alt='' width='1000' height='auto'>

Example Markdown content is divided into several parts:

- Metadata: Attribute definitions of the example content, including chart category, cover image, keywords, etc.

- Title: The main content under the first-level title corresponds to the description information of the example.

- Key Configuration: Explanation of the key configurations included in the example, which will be displayed in the "Key Configuration" section on the right side of the example page.

- Code Demonstration: The specific code content executed in the example; currently only native JavaScript code is supported.

The field definitions of Markdown metadata are:

- group: The classification information of the example, describing which chart category the current example belongs to.

- title: The example title

- keywords: Keywords of the example

- order: The order criterion of the example within the same group

- cover: The cover image of the example

- tutorial: The tutorial link to jump to (the default example tutorial will jump to the tutorial corresponding to the example group)

Currently, chart examples in the group include multiple categories such as area chart, bar chart, combination, storytelling, etc., corresponding to all categories under the vchart example gallery. Refer to existing example documents for specific classification fields.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BCvZbkvF9oiPWlx6R2zcJxxBn7e.gif' alt='' width='1000' height='auto'>

Finally, add the new demo path in `docs/assets/examples/menu.json` so that it can be previewed during `rush docs` and displayed on the official website.

# Writing Demos with the Help of Doubao Marscode AI Programming Assistant

[Marscode AI Programming Assistant](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)

With the help of Doubao [Marscode AI Programming Assistant](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a), you can get comprehensive assistance throughout the document creation process.

If you haven't installed the [Marscode AI Programming Assistant](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a), please download it from this link: https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a

During demo writing, using context instructions reasonably can improve content accuracy.

`**⭐️ #Workspace**`

Select global code in the Workspace as context; AI will automatically find related code Context according to user Query.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/XQaqbAX59oLBKOxR7ngctRbQnXb.gif' alt='' width='1000' height='auto'>

`**⭐️ #Files**`

Search and select files in the code repository as context

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MhZTbAAD2oj1XJxil8WcHYSWn6d.gif' alt='' width='1000' height='auto'>

`**⭐️ #Code**`

Search and select functions or classes in the code repository as context

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/V4M7bX87hoHOxOxM1Nfc9of0nhL.gif' alt='' width='1000' height='auto'>

Below is an example of how to use the [Marscode AI Programming Assistant](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) for demo writing.

## 5.1 Providing a Document Framework

Here **invoke #Workspace**, then ask a question, select a document content of an example and hope it generates a new example document in the same manner.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TUHVbTez5o6IjtxmCLhcWnGHnZg.gif' alt='' width='1000' height='auto'>

We can continue to make adjustments on this basis.

## 5.2 Generating Descriptive Text

The description text for each demo can be initially generated using [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a), and then proofread and adjusted. For example:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/U6n7bEo0DoaCGyxtiVVc1GBGnrg.gif' alt='' width='1000' height='auto'>

## 5.3 Generating Example Code

To better explain principles and usage, it is usually necessary to provide a runnable demo. The code generation capability of [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) can be used to generate example code. However, the current code generation capabilities of various AIs cannot guarantee accuracy and require further verification.

## 5.4 Content Retrieval

Usually, in each Q&A, [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) will provide reference documents, which can offer more contextual references for further analysis.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DGyBbfi99oucAYxxkyJcfka3nJa.gif' alt='' width='1000' height='auto'>

You can also perform file retrieval directly:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WM9Ubr9JYoYAjOxFQ6tc8cW3nLd.gif' alt='' width='1000' height='auto'>

# Submitting Code

After the document is completed, push the code to your remote branch, for example:

```
git commit -a -m "docs: add custom funnel demo and related docs"

```

The commit message for VisActor follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) convention. **For demo, use docs**

`<type>[optional scope]: <description>`

Common `type` includes docs (documentation/log modifications), feat (new feature), fix (bug fix), refactor (code restructuring), etc., please choose based on the actual situation.

Please write the description in brief and precise English.

Before submitting a commit, we perform a commit lint check, which you can check in the [check rules](https://github.com/VisActor/VChart/blob/98711490e90532d896dd9e44dd00a3af5b95f06d/common/autoinstallers/lint/commitlint.config.js).

A common issue is that the remote upstream (@visactor/vchart) has new updates, which can lead to conflicts during the submission of a Pull Request. Thus, before submission, you can merge the commits from other developers remotely into your commit. Use the following code to switch to the develop branch:

```
git checkout develop

```

Use the following code to pull the latest remote code:

```
git pull upstream develop

```

Switch back to your development branch:

```
git checkout docs/add-funnel-demo

```

Merge the develop commits into your branch:

```
git rebase develop

```

Push the updated code to your branch:

```
git push origin docs/add-funnel-demo

```

# Submitting a PR

You can click the `Compare & pull request` button on your GitHub repository page.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FWm3bZjbnoaqUOxiygXcFdLznwf.gif' alt='' width='1000' height='auto'>

Or create via the `contribute` button:

Fill in the modified content of this submission according to the template:

- Check what type of modification this is

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/V7xpbJhhEoSoCExC31WcyKvHnDe.gif' alt='' width='692' height='auto'>

- Fill in the associated issue

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/O6YqbpdxgodBjfxHXEpcwob4n5E.gif' alt='' width='470' height='auto'>

- If there are complex changes, explain the background and solution

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QsnYbfLCio4u3MxK2uIc8epKnXh.gif' alt='' width='1000' height='auto'>

After filling in the relevant information, click Create pull request to submit.

The administrator will review the PR to decide whether to approve it; if not, modifications need to be made, and a resubmission is required.

# Next Step

Next, you can continue to explore different types of tasks.

GitHub: [github.com/VisActor](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FVisActor)

VisActor WeChat subscription account message (you can join the WeChat group through the subscription account menu):

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/I8OdbhGfkort6oxqHW6cR492n7d.gif' alt='' width='258' height='auto'>

VisActor Official Website: [www.visactor.io/](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable)

Feishu Group:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DdEAbEU9yoFq9IxjrN4curJnnyf.gif' alt='' width='264' height='auto'>

Discord: https://discord.com/invite/3wPyxVyH6m

# This Document Was Contributed By

[玄魂](https://github.com/xuanhun)
