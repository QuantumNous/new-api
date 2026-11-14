# Cursor+DeepSeek: Quick Start with Your VChart Code

In the previous chapters, we have learned about the basic components of a spec and how to generate basic charts. However, due to VChart's powerful features and diverse APIs, it can be challenging to quickly implement complex charts. Is there an easy way to get started without having to search through API documentation?

The answer is yes! Thanks to the rapid development of AI technology, AI tools can not only help you quickly understand and master VChart usage but also significantly improve coding efficiency, allowing developers to focus on creativity and business logic implementation.

In this tutorial, we'll learn how to quickly get started with your VChart code by configuring `Cursor` and `DeepSeek` (you can use other AIs as well, and Cursor's default model is also fine - the key is custom document integration)!

## 1. Preparation

### A Project Using VChart

For example, I have a simple project initialized with `npx create-react-app my-app --template typescript`, which looks like this after startup:

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepSeek+Cursor_1.PNG" alt="Initialized Project">
</div>

### DeepSeek

Register for DeepSeek and create your API key on the [DeepSeek API official website](https://platform.deepseek.com/api_keys)

### Cursor

Download and register from the [official website](https://www.cursor.com/), open your VChart project with `cursor`, and configure `cursor`

### Configure Cursor

Take `deepSeek-V3` as an example, its model name is `deepseek-chat`, and the API address is https://api.deepseek.com/v1. For details, see the [API usage official website](https://api-docs.deepseek.com/zh-cn/)

Create a new model on the `model` page and set the corresponding `api` address and `model` name.

_Note: Currently, `cursor` officially does not support direct integration with `deepSeek`. We can achieve integration with `deepSeek` by overriding the `openAPI` interface address. During the setup process, you need to close other models first and only integrate the `deepSeek` model_

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_cursor_2.PNG" alt="Cursor Configuration">
</div>

## 2. Practical Usage

### Add a Bar Chart

Use the `cmd+i` command to invoke AI interaction, and let the AI help us generate a simple bar chart code. After applying this spec, we can see the result - a simple bar chart is rendered. We can see that `deepSeek` has a certain understanding of `vchart`, and simple charts can be added directly. Let's try a more complex scenario.

<p style="text-align: center;">
 <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deep_seek_3.PNG" alt="Cursor Result" height="380">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_4.PNG" alt="Rendering Result" height="380">
</p>

### Complex Scenario: Injecting Docs

We want to add a mean auxiliary line on the y-axis. Looking at the result, it's not correct. Upon closer inspection, we can see that although `markLine` is written as expected, the `spec` doesn't conform to the specification, and the mean line has been calculated. We'll solve this problem by injecting docs.

<p style="text-align: center;">
 <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_5.png" alt="markline_cursor" height="380">
 <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_6.png" alt="markline_result" height="380">
</p>

### Setting up Docs

Go to the `cursor` settings page, select `Features`, and add docs. You can choose from the following docs addresses:

- https://visactor.com/vchart
- https://visactor.io/vchart

![Configure docs](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deep_seek_6.gif)

You can also add new docs directly in the editor through `@Docs`

### Experimental Results

By adding the new docs and editing again, we can get the correct result!

<p style="text-align: center;">
 <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_7.png" alt="markline_cursor" height="380">
 <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_8.png" alt="markline_result" height="380">
</p>

Through this tutorial, you've learned how to improve your VChart coding efficiency using `cursor+deepseek`, while exploring VChart's powerful features and flexibility to create colorful charts. Happy coding!
