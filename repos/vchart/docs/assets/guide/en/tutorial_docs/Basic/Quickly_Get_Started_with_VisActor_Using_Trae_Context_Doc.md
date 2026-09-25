---
title: Using Cursor with DeepSeek to Quickly Get Started with Unfamiliar Components

key words: VisActor, VChart, VTable, VStory, VMind, VGrammar, VRender, Visualization, Chart, Data, Table, Graph, Gis, LLM
---
In today's software development field, developers face the challenge of continuously improving development efficiency and reducing the learning curve. The core purpose of this document is to help developers achieve this goal, especially by cleverly using **component official documentation** and combining tools like **Cursor** and **DeepSeek** to let AI automatically generate the required code, quickly lowering the entry barrier. Next, we will experiment with several projects in the relatively new open-source project, VisActor (https://www.visactor.com; https://www.visactor.io/), an open-source visualization solution, to see how effective it is.

# Preparation

## Create a Test Project

For example, I have a simple project initialized with `npx create-react-app my-app --template typescript`, which looks like this after starting:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/C4cabsu8goKMv4xiaBtcDqvmnuf.gif' alt='' width='1000' height='auto'>

## Obtain DeepSeek API Key

Register with DeepSeek and create your API key on the [DeepSeek API](https://platform.deepseek.com/api_keys) official website.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JNQPbFzIOoYknHxr3aDcg60onCg.gif' alt='' width='1000' height='auto'>

## Configure Cursor

Official website: https://www.cursor.com/

Download and register, open your VChart project with Cursor, and configure Cursor.

Using DeepSeek-V3 as an example, its API model name is `deepseek-chat`, and the API address is https://api.deepseek.com/v1. For more details, see the [API usage official website](https://api-docs.deepseek.com/zh-cn).

Create a new model on the model page, set the corresponding API address and model name.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WBBCb55WwoF3HUxnhGtc6P5Un5c.gif' alt='' width='1000' height='auto'>

Of course, you can also use any other AI model; here, we use DeepSeek.

# Inject Official Tutorial into @Docs

# Practical Verification

## VTable Test

VTable (https://www.visactor.io/vtable/; https://www.visactor.com/vtable/) is a powerful table component in the VisActor visualization library. It is designed to meet diverse data presentation needs, offering high flexibility and customizability. Whether it's simple data listing or complex data analysis display scenarios, VTable can provide excellent solutions.

VTable has the following core features:

- Supports various table types: basic tables, pivot tables, transposed tables, pivot charts, etc.

- Powerful interaction features: sorting, filtering, row and column dragging, cell editing, etc.

- Rich cell types: text, charts, progress bars, checkboxes, sparklines, etc.

- High-performance rendering: supports smooth display of millions of data

- Multi-platform adaptation: perfect support for mainstream frameworks like Vue, React

### Invoke AI Interaction Panel in Cursor and Generate Code

After setting up the project environment, use `cmd + i` to invoke the AI interaction panel. We directly let AI generate a basic table code snippet for inserting VTable.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AIWSbqgyhog1DZxaYGCcl9kinsb.gif' alt='' width='1000' height='auto'>

However, the initial generation result shows that AI does not recognize VTable's `ListTable`, possibly due to the inability to accurately recognize VTable's ListTable configuration.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/IfZ4bjODTocB2oxPfDScNdvnnEg.gif' alt='' width='1000' height='auto'>

### Inject Official Tutorial into @Docs

To solve the above problem, we inject the official tutorial into @Docs.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DOapbrW3gowfgDxw6v9cagArnPe.gif' alt='' width='1000' height='auto'>

Explicitly specify `VisActor VTable` in the `prompt` in @Docs. After this step, we are pleasantly surprised to find that AI can correctly write the implementation logic according to the `option` in VTable.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HOHPbR1gho68fAxnA0XcWR3Xnuc.gif' alt='' width='1000' height='auto'>

### Code Application and Effect Display

Copy the generated code into the corresponding file, run the project, and you can see the initial effect, with the table correctly generated.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Vbf8bECXsoJngRxMxdzcbZgunfb.gif' alt='' width='1000' height='auto'>

Then, we continue to let AI modify the table style. AI provided reasonable modification suggestions,

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/CM5lbR4tIokooxxxNotcvtakngd.gif' alt='' width='1000' height='auto'>

After running the project again, we got a display effect that better meets the requirements:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Co0mb5MdhoTuE1xGpwtcqC5Vngu.gif' alt='' width='406' height='auto'>

## VChart Test

### Add a Bar Chart

Invoke AI interaction with the `cmd+i` command, and let AI help us generate a simple bar chart code first.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WnzubAlKKo70ePxjlVbclc6ynmg.gif' alt='' width='970' height='auto'>

Directly apply this spec, and we check the result; a simple bar chart is rendered. It can be seen that DeepSeek has a certain understanding of VChart, and simple charts can be directly added. Let's try a more complex scenario.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HYjbb8u8ToXkbBxJ8o6cGqPgn8f.gif' alt='' width='1000' height='auto'>

### Complex Scenario, Inject Docs

We hope to add an average auxiliary line on the y-axis, check the result, but the result is incorrect. Upon closer inspection, it can be found that although the markLine is written as if it is correct, the spec does not conform to the specification, and the average line is calculated. We solve this problem by injecting docs.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UJdkbdp0poJRSzxy94kcOHqZnsd.gif' alt='' width='980' height='auto'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RQgwbW3WGopiNAxoEAXcJhornqc.gif' alt='' width='1000' height='auto'>

#### Set Docs

Enter the Cursor settings page, select `Features`, add new docs, the docs address is https://visactor.com/vchart (https://visactor.io/vchart); you can also directly add through @Docs on the editing page.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JQarbKxBEoKc3FxjN4Fc9jydnXb.gif' alt='' width='1000' height='auto'>

### Experimental Results

By editing again with the newly added docs, the correct result can be obtained!

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/PJXKbmAccoeUmjxXButcR45dnZe.gif' alt='' width='1000' height='auto'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/SIFlbNJ5eo0bbjxRRMCcoruFnWp.gif' alt='' width='1000' height='auto'>

## VStory Test

VStory (GitHub: https://github.com/VisActor/VStory/; site: https://www.visactor.io/vstory/, https://www.visactor.com/vstory/) is a narrative-oriented visualization development framework that integrates the capabilities of all VisActor visualization components, making it more challenging to use. We conduct a simple test.

Invoke AI interaction with the `cmd+i` command, and let AI help us generate a simple dashboard demo first.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WNZAbOsbVoBd46xTGChcqbm3nbh.gif' alt='' width='766' height='auto'>

It can be found that it is completely incorrect because DeepSeek uses data from 2023, and VStory had not been released at that time, so it does not know how to use it. At this point, we need to let it read the documentation to learn.

### Inject Docs

We solve this problem by injecting docs.

Enter the Cursor settings page, select `Features`, add new docs, the docs address is https://visactor.com/vstory/guide/tutorial_docs/VStory_Website_Guide; you can also directly add through @Docs on the editing page.

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OtoTbG06lodqIaxBCkscQztNnoh.gif' alt='' width='1000' height='auto'>

### Experimental Results

By editing again with the newly added docs, the correct result can be obtained!

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HqKdbVHgYoM9a6xmsZqcuZ4QnDq.gif' alt='' width='754' height='auto'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/X1UZb9HXsoIdiRxqLCucJbqPnZc.gif' alt='' width='1000' height='auto'>

**Since VStory uses VChart, VTable, and VRender, to achieve better results, you should add the documentation of VChart, VTable, and VRender to the context simultaneously.**

# Simple Summary

1. Improve Development Efficiency

- Quick Access: Directly access VisActor API documentation through Cursor

- Intelligent Suggestions: Precise code completion based on VisActor documentation

2. Enhance Development Experience

- Seamless Integration: Directly obtain VTable usage guidance in the development environment

- Real-time Feedback: Quickly verify code effects

3. Reduce Learning Costs

- Documentation Assistance: Access VisActor official examples at any time

- Code Generation: Automatically generate code that complies with VisActor standards

4. Improve Code Quality

- Standard Check: Ensure code complies with VTable best practices

- Performance Optimization: Automatically generate high-performance table configurations

# Contact Us

GitHub: [github.com/VisActor](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FVisActor)

Leave a message on the VisActor WeChat subscription account (you can join the WeChat group through the subscription account menu):

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VyPsbaIz8offShxlv0ZcqqD8nfd.gif' alt='' width='258' height='auto'>

VisActor official website: [www.visactor.io/](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable); [www.visactor.](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable)com

Feishu Group:

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/NAQhbtdelofTIyxk9pgcE3hqnQG.gif' alt='' width='264' height='auto'>

Discord: https://discord.com/invite/3wPyxVyH6m 


---

The doc is contributed by [玄魂](https://github.com/xuanhun)