# Title

The chart title is mainly used to display the theme information of the chart. The title of VChart is displayed at the top of the chart by default, consisting of the main title and subtitle, with the option of displaying the subtitle below. This tutorial mainly explains the related concepts and components of Title. For more detailed configuration and examples of Title, please refer to [Configuration Document](../../../option) and [Example](../../../example) pages.

## Components of Title

The components of the title are as follows:

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a2c7623458257d1562627090e.png" alt="Title component composition diagram">
</div>

In VChart, we can configure the title through the `title` attribute. The following code example shows how to configure the chart's title and subtitle:

```ts
{
  title: {
    text: 'chart title',
    subtext: 'This is a subtext.'
  }
}
```

For complete configuration details, see [title](../../../option/barChart#title).
