---
title: 5. How to Contribute Code

key words: VisActor, VChart, VTable, VStory, VMind, VGrammar, VRender, Visualization, Chart, Data, Table, Graph, GIS, LLM
---
# Creating a Branch

The default branch for VChart is the develop branch. For any feature development, bug fixes, or documentation writing, please create a new branch and then merge it into the develop branch. Use the following code to create a branch:

```
// Create a documentation, demo branch
git checkout -b docs/add-funnel-demo

```

# Finding or Creating an Issue

In principle, we require every PR to have a corresponding issue. Before starting development, please confirm whether there is a corresponding issue, and the issue has not been claimed.

## Search for Issues

You can search for bug or feature-related issues in the following way:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TPy4bTm01o9MSgxiwZvcTz66nug.gif' alt='' width='487' height='auto'>

## Create Code-Related Issues

Click "NEW ISSUE" to open the issue selection page, and choose "**Bug Report" or "Feature Request".**

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AhNvbxd1uoZZMHxuKxscjErrnDe.gif' alt='' width='611' height='auto'>

Fill in the relevant information for the document issue you want to submit and apply the appropriate tags.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Odonb0WssownV3xTSQDcEudhnOi.gif' alt='' width='828' height='auto'>

# Claiming an Issue

If you want to contribute code, you can leave a message to claim the issue. An administrator will contact you and, upon confirmation, assign the issue to you.

For example:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MMCpb9MvEomle4xYIe1cauFUnCe.gif' alt='' width='988' height='auto'>

# Writing Code

The source code for VChart is located in the following way within the project:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/NWpDbeBSxotFA9xf7GrcM6tUntb.gif' alt='' width='952' height='auto'>

All the components of the VChart ecosystem are in the same directory, split by package name. Developers need to develop code in their own code branch and then submit it.

# Writing Code with Marscode AI Programming Assistant

With the help of the Marscode AI Programming Assistant, comprehensive assistance can be provided throughout the coding process.

If you have not installed the Marscode AI Programming Assistant, please download it from this link: https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a

When writing code, using context commands appropriately can improve the accuracy of content.

`**⭐️ #Workspace**`

Select global code from Workspace as context, and AI will automatically find relevant code context based on the user's Query.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DWoabR7kIoqRe8xVu7RcqjjenFg.gif' alt='' width='1000' height='auto'>

`**⭐️ #Files**`

Search and select files in the code repository as context.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VcWsbki1MohwabxGtRPcZnXXnGb.gif' alt='' width='1000' height='auto'>

`**⭐️ #Code**`

Search and select functions and classes in the code repository as context.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FDTHbZ2Hko9WrSx2JqWcJRRnnUf.gif' alt='' width='1000' height='auto'>

Below is an example of how to use the Marscode AI Programming Assistant for coding.

## 5.1 Quickly Familiarize with the Entire Repository

Here, use ** # to summon #Workspace ** and then ask it to help generate a project structure description document.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VuVub5lyZoVHQqxL3T9cvojUnVu.gif' alt='' width='1000' height='auto'>

We can still ask further questions about subfolders.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AdgDb1oGFoAyaRxkW8xciziInvf.gif' alt='' width='1000' height='auto'>

## 5.2 Explaining Code

### 5.2.1 Generate Code Descriptions

When we select a piece of code in a file, we can choose the Explain command from the floating menu, and [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) will generate a detailed code explanation for us, which we can proofread and adapt.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/K2RVbq5broy4rpxSStYcA4J7ndf.gif' alt='' width='1000' height='auto'>

You can also directly enter the Explain command in the dialog box.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TH9ybov7JomacGxBX2QcccwFnvc.gif' alt='' width='1000' height='auto'>

Here, you can also directly use the #Code context mentioned above to combine Explain with your instructions for more detailed tasks.

### 5.2.2 Generate Explanation for the Entire File

Explain can be used with Context or Files commands to generate explanations for the entire file.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HyeabsSvjoHYZ9xAbLRc55j8nDg.gif' alt='' width='1000' height='auto'>


## 5.3 Content Retrieval

Usually, for each Q&A session, [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) will provide reference documents, which can offer more contextual reference for further analysis.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OeF0bP4jPoUZWGxqDqScyHzhnvf.gif' alt='' width='1000' height='auto'>

You can also directly perform file retrieval:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/SFvjbKHzOokvkPxFGH0cZKRanpc.gif' alt='' width='1000' height='auto'>

## 5.4 Code Generation

In daily coding, we often encounter scenarios where repetitive code is used. Sometimes you may not know if a certain function has already been implemented. At this time, use `#Workspace` to ask questions. For example:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JpG9b7ggroUfX7xduo6cd3qXnOg.gif' alt='' width='1000' height='auto'>

## 5.5 Adding Comments

Use the "/doc" command to generate code comments.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KAS2bRAVWo1K5ixXvfDceiZinEh.gif' alt='' width='1000' height='auto'>

## 5.6 Generating Unit Tests

The unit test code for VChart is located in the “__**tests**” directory of each package.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DHbGbulZ5onHbtx3KFscOLgXnFg.gif' alt='' width='1000' height='auto'>

Use the [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) "/test" command to quickly generate unit test code.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OnTDbxBAzoQ9h7xEk6vcpYjAnNd.gif' alt='' width='1000' height='auto'>

## 5.7 Intelligent Suggestions

During writing, the intelligent generation of optional code is a standard feature of the programming assistant. Please feel free to explore this feature.

# Submitting Code

After completing the documentation, first push the code to your remote branch. For example:

```
git commit -a -m "docs: add custom funnel demo and related docs"

```

The commit message for VisActor follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification, **demo uses docs**

`<type>[optional scope]: <description>`

Common types include docs (documentation, log changes), feat (new features), fix (problem fixes), refactor (code refactoring), etc. Please choose based on the actual situation.

Please write the description with a concise and accurate English description.

Before submitting a commit, we will conduct commit lint checks. For more details, please see [check rules](https://github.com/VisActor/VChart/blob/98711490e90532d896dd9e44dd00a3af5b95f06d/common/autoinstallers/lint/commitlint.config.js).

A common issue is that the remote upstream (@visactor/vchart) has new updates, which may cause conflicts when you submit a Pull Request. Therefore, you can merge the commits from other developers with your commits before submitting. Use the following code to switch to the develop branch:

```
git checkout develop

```
Use the following code to pull out the latest code from upstream:

```
git pull upstream develop

```
Switch back to your development branch:

```
git checkout docs/add-funnel-demo

```
Merge the commits from develop into your branch:

```
git rebase develop

```
Submit the updated code to your branch:

```
git push origin docs/add-funnel-demo

```
# Submitting a PR

You can click the `Compare & pull request` button on your GitHub code repository page.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/H0J8bpv2qoodVCxPfFTcRHL1nCf.gif' alt='' width='1000' height='auto'>

Or create one through the `contribute` button:

Fill in the modification details of this submission according to the template:

*  Check what type of modification this is

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AgIOb5bRAo7UUVxS52AcNZCanad.gif' alt='' width='692' height='auto'>

*  Fill in the associated issue

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VGonbJeFJoc68XxDzkOc7j8Lnjd.gif' alt='' width='470' height='auto'>

*  If there are complex changes, please explain the background and solution

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HYy2bLtuCopGfxxdeKkc2pt0n4e.gif' alt='' width='1000' height='auto'>

After filling in the relevant information, click Create pull request to submit.

An administrator will review the PR to decide whether to approve it. If not approved, modifications will be needed before resubmitting.

# Next Step

Next, you can read the implementation principles and source code explanations of each module, or join in contributing to these documents.

Please join the VisActor family and contribute your efforts!

GitHub: [github.com/VisActor](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FVisActor)

VisActor WeChat Subscription (you can join the WeChat group through the subscription menu):

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ZqQ2bVj6woabSXxeLKOce9rrn9d.gif' alt='' width='258' height='auto'>

VisActor Official Website: [www.visactor.io/](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable)

Feishu Group:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/F0GRbKlLOoHUwRx9JBVcKxk0n6g.gif' alt='' width='264' height='auto'>

Discord: https://discord.com/invite/3wPyxVyH6m

# This Document Was Contributed By
[玄魂](https://github.com/xuanhun)

