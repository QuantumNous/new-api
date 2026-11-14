```markdown
---
title: 3-How to Contribute Documentation

keywords: VisActor, VChart, VTable, VStory, VMind, VGrammar, VRender, Visualization, Chart, Data, Table, Graph, Gis, LLM
---
# Create a Branch

The default branch for VChart is the develop branch. Whether it is for feature development, bug fixes, or documentation writing, please create a new branch and then merge it into the develop branch. Use the following command to create a branch:

```bash
// Create a documentation/demo branch
git checkout -b docs/add-funnel-demo
```

# Find or Create an Issue

In principle, we require each PR to have a corresponding issue. Before starting development, please confirm whether there is a corresponding issue, and that the issue has not been claimed.

## Search for Documentation Issues

You can search for documentation-related issues using the following filter:

```
is:open label:docs
```

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JkscbtGcbo9iQRxuAR2clnx6n9J.gif' alt='' width='801' height='auto'>

Some features may be associated with the doc label, so check if the issue is purely a documentation task.

## Create a Documentation Issue

Click "NEW ISSUE" to open the issue selection page, then select “**Documentation Request**.”

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Xs7nbpfaCo479XxGRq5cONJ3nye.gif' alt='' width='1000' height='auto'>

Fill out the relevant information for the documentation issue you want to submit.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KXsCbe7XYo0puWxn3oGczfXInbc.gif' alt='' width='1000' height='auto'>

# Claim an Issue

If you want to write or edit documentation bugs, you can leave a comment on the issue to claim it. An administrator will contact you, and after confirmation, the issue will be assigned to you.

For example:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/V9UTb3w08oJcj6xUSUKc32gTnrh.gif' alt='' width='988' height='auto'>

# Create or Modify Documentation

The locations of VChart documentation and demos in the project are as follows:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DWwxbUDeZoC9Drx8gOGczzAcncc.gif' alt='' width='1000' height='auto'>

The current documentation types are as follows:

*  api: Interface documentation, corresponding site: https://www.visactor.io/vchart/api/API/vchart
*  changelog: Log, corresponding site: https://www.visactor.io/vchart/changelog/release
*  demos: Independent running demos for debugging purposes
*  examples: Graph examples, corresponding sites:
https://www.visactor.io/vchart/example
https://www.visactor.io/vchart/example-react
https://www.visactor.io/vchart/example-openinula
*  faq: FAQs, corresponding site: https://www.visactor.io/vchart/faq/1-%20Does%20the%20tooltip%20support%20changing%20the%20background%20color
*  guide: Tutorials, corresponding site: https://www.visactor.io/vchart/guide/tutorial_docs/VChart_Website_Guide
*  option: Specification descriptions, corresponding site: https://www.visactor.io/vchart/option/barChart
*  themes: Theme configuration tools, corresponding site: https://www.visactor.io/vchart/theme/playground
*  contributing: Community contributor documentation, corresponding site: https://www.visactor.io/vchart/guide/contributing_docs/Contribution_Guide

Find the corresponding location to add or modify the document. Note that some documents need to maintain the “menu.json” file as well.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TxwTb83S5oOnqMx5VI7cqzjXnkg.gif' alt='' width='528' height='auto'>

This file corresponds to the final position and name of the document displayed on the site. For example:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/L6WpbXlFEo15F4xSIsMch9YTnof.gif' alt='' width='1000' height='auto'>

# Use Doubao Marscode AI Programming Assistant

[Marscode AI Programming Assistant](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)

Using Doubao [Marscode AI Programming Assistant](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) can provide comprehensive assistance throughout the entire process of document creation.

If you haven't installed the [Marscode AI Programming Assistant](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a), please download it from the following link: https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a

In document writing, using context commands appropriately can improve content accuracy.

`**⭐️ #Workspace**`

Select the global code from Workspace as context, and the AI will automatically find related code context based on user queries.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WiikbC26FovfN8xiDrkc5jDGn4b.gif' alt='' width='1000' height='auto'>

`**⭐️ #Files**`

Search and select files from the code repository as context

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OG15bVGdAoghaux6QlUckffVnfg.gif' alt='' width='1000' height='auto'>

`**⭐️ #Code**`

Search and select functions or classes from the code repository as context

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BEaXbdXyUoik0WxoWqHcz0A6nCg.gif' alt='' width='1000' height='auto'>

Below is an example of how to use the [Marscode AI Programming Assistant](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) for document writing.

## 5.1 Provide Document Writing Ideas

Here, **by invoking #Workspace** and then asking it to help generate an outline for a developer document.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/GnctbsyzWo6OBFxLFFNcjXh9n22.gif' alt='' width='1000' height='auto'>

## 5.2 Generate Project Structure Description

Here, **by invoking #Workspace** and then asking it to help generate a project structure description document.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RI9sb17ygoL2JMxwpqrcDLD3nVh.gif' alt='' width='1000' height='auto'>

We can still ask further questions about subfolders.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Za3MbDf4FoEnQKx5vUUcpB34nZg.gif' alt='' width='1000' height='auto'>

## 5.3 Generate File or Code Details

### 5.3.1 Generate Code Explanation

When we select a piece of code in a file, we can choose the Explain command from the floating menu, and [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) will generate a detailed code explanation for us. We can use this as a basis for proofreading and adaptation.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BQurb7A6fo7UVJxxuqHcSLIdnzc.gif' alt='' width='1000' height='auto'>

You can also directly input the Explain command in the dialogue box.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FtYLb95EEoCXGOx835tc3X2Zn7g.gif' alt='' width='1000' height='auto'>

Here you can also directly use the previously mentioned #Code context to combine Explain with your instructions for more detailed tasks.

### 5.3.2 Generate Explanations for Entire Files

Explain can be used in conjunction with Context or Files commands to generate explanations for entire files.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HoqGbdBxyolQodx2uhdcquven0g.gif' alt='' width='1000' height='auto'>

## 5.4 Generate Sample Code

To better explain principles and usage, it is often necessary to provide a demo that can be practically run. You can use [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)'s code generation capabilities to generate sample code for us. However, currently the code generation capabilities of various AIs cannot guarantee accuracy and require further verification.

## 5.5 Content Search

For each Q&A, [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) will usually provide reference documentation, which can offer more contextual references for further analysis.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QMD7b5mQgoyNYtxNK5jcNTL4n7c.gif' alt='' width='1000' height='auto'>

You can also directly perform file searches:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ZBPmb7fn5oK3DAxLQAxcBP1An5d.gif' alt='' width='1000' height='auto'>

## 5.6 Translate Documents

VisActor's documentation needs to be provided in both Chinese and English, and Marscode can assist in translation.

# Submit Code

After completing the documentation, first push the code to your remote branch. For example:

```bash
git commit -a -m "docs: add custom funnel demo and related docs"
```

VisActor follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for commit messages:

`<type>[optional scope]: <description>`

Common `type`s include docs (documentation, log changes), feat (new features), fix (bug fixes), refactor (code refactoring), and others. Please choose according to the actual situation.

Write the description in concise and accurate English.

Before submitting a commit, we will conduct a commit lint check. You can view the [rules for checking](https://github.com/VisActor/VChart/blob/98711490e90532d896dd9e44dd00a3af5b95f06d/common/autoinstallers/lint/commitlint.config.js).

A common issue is when the remote upstream (@visactor/vchart) has new updates, leading to conflicts when submitting a Pull Request. Therefore, before submission, we can merge other developers' remote commits into ours. Use the following command to switch to the develop branch:

```bash
git checkout develop
```

Use the following command to pull the latest code from upstream:

```bash
git pull upstream develop
```

Switch back to your development branch:

```bash
git checkout docs/add-funnel-demo
```

Merge the develop branch's commits into your branch:

```bash
git rebase develop
```

Push the updated code to your branch:

```bash
git push origin docs/add-funnel-demo
```

# Submit a PR

You can click the `Compare & pull request` button on your GitHub repository page.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/S8hebTyczoKfg7x4ZTncy8uenX9.gif' alt='' width='1000' height='auto'>

Or create it through the `contribute` button:

Fill out the template with the changes submitted:

*  Check the type of modification

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/J9z9biTukokoJBx846zcIOVqnsh.gif' alt='' width='692' height='auto'>

*  Fill in the associated issue

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Oxl7bkBuEoHdssxxfRHc11IAnsg.gif' alt='' width='470' height='auto'>

*  If there are complex changes, please explain the background and solution

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RUeebaBA8oGMZNxWdi1cstXWn1d.gif' alt='' width='1000' height='auto'>

Once the relevant information is filled in, click Create pull request to submit.

The administrator will review the PR to decide whether to approve it. If not approved, modifications are needed and it must be resubmitted.

# Next Steps

Among different documentation types, demo documents have some special requirements, which can be referenced in the "How to Contribute a Demo" section.

You can then continue to attempt different types of tasks.

GitHub: [github.com/VisActor](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FVisActor)

Leave a message on the VisActor WeChat public account (you can join the WeChat group through the public account menu):

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Cj40bjDrxoEDnZxrBl4cEfs9nyc.gif' alt='' width='258' height='auto'>

Official website of VisActor: [www.visactor.io/](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable)

Feishu group:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VeKlb1t5sogCmExPAFmcbtmgndb.gif' alt='' width='264' height='auto'>

Discord: https://discord.com/invite/3wPyxVyH6m
```

# This Document Was Contributed By
[玄魂](https://github.com/xuanhun)