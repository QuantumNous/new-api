# Rsbuild website

This website is built with [Rspress](https://github.com/web-infra-dev/rspress), the document content can be written using markdown or mdx syntax. You can refer to the [Rspress Website](https://rspress.rs/) for detailed usage.

## Contributing

Currently Rsbuild provides documentation in English and Chinese. If you can use Chinese, please update both documents at the same time. Otherwise, just update the English documentation.

You can use the local skill at [`sync-zh-en-docs`](../.agents/skills/sync-zh-en-docs/SKILL.md) to sync zh/en docs.

## Writing style guide

The same as Rspack: [Writing style guide](https://github.com/web-infra-dev/rspack/tree/main/website#writing-style-guide).

### Image assets

For images you use in the document, it's better to upload them to the [rstackjs/rstack-design-resources](https://github.com/rstackjs/rstack-design-resources) repository, so the size of the current repository doesn't get too big.

After you upload the images there, they will be automatically deployed under the https://assets.rspack.rs/.
