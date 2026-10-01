# AI SDK Codemods

The AI SDK provides automated code transformations (codemods) to help upgrade your codebase when features are deprecated, removed, or changed between versions.

Codemods are transformations that run on your codebase programmatically, allowing you to easily apply many changes without manually editing every file.

## Quick Start

### Run All Codemods (Recommended)

To run all codemods:

```sh
npx @ai-sdk/codemod upgrade
```

This will automatically detect and transform all applicable code patterns in your project.

### Run Version-Specific Codemods

To run codemods for a specific version:

```sh
npx @ai-sdk/codemod v4

npx @ai-sdk/codemod v5

npx @ai-sdk/codemod v6

npx @ai-sdk/codemod upgrade
```

### Run Individual Codemods

To run a specific codemod:

```sh
npx @ai-sdk/codemod <codemod-name> <path>
```

Examples:

```sh
# Transform a specific file
npx @ai-sdk/codemod v4/remove-experimental-ai-fn-exports src/app/api/chat/route.ts

# Transform a directory
npx @ai-sdk/codemod v4/replace-baseurl src/lib/

# Transform entire project
npx @ai-sdk/codemod v5/rename-format-stream-part .
```

## Available Codemods

### v4 Codemods (v3 → v4 Migration)

| Codemod                                               | Description                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `v4/remove-ai-stream-methods-from-stream-text-result` | Transforms v4/remove ai stream methods from stream text result |
| `v4/remove-anthropic-facade`                          | Transforms v4/remove anthropic facade                          |
| `v4/remove-await-streamobject`                        | Transforms v4/remove await streamobject                        |
| `v4/remove-await-streamtext`                          | Transforms v4/remove await streamtext                          |
| `v4/remove-deprecated-provider-registry-exports`      | Transforms v4/remove deprecated provider registry exports      |
| `v4/remove-experimental-ai-fn-exports`                | Transforms v4/remove experimental ai fn exports                |
| `v4/remove-experimental-message-types`                | Transforms v4/remove experimental message types                |
| `v4/remove-experimental-streamdata`                   | Transforms v4/remove experimental streamdata                   |
| `v4/remove-experimental-tool`                         | Transforms v4/remove experimental tool                         |
| `v4/remove-experimental-useassistant`                 | Transforms v4/remove experimental useassistant                 |
| `v4/remove-google-facade`                             | Transforms v4/remove google facade                             |
| `v4/remove-isxxxerror`                                | Transforms v4/remove isxxxerror                                |
| `v4/remove-metadata-with-headers`                     | Transforms v4/remove metadata with headers                     |
| `v4/remove-mistral-facade`                            | Transforms v4/remove mistral facade                            |
| `v4/remove-openai-facade`                             | Transforms v4/remove openai facade                             |
| `v4/rename-format-stream-part`                        | Transforms v4/rename format stream part                        |
| `v4/rename-parse-stream-part`                         | Transforms v4/rename parse stream part                         |
| `v4/replace-baseurl`                                  | Transforms v4/replace baseurl                                  |
| `v4/replace-continuation-steps`                       | Transforms v4/replace continuation steps                       |
| `v4/replace-langchain-toaistream`                     | Transforms v4/replace langchain toaistream                     |
| `v4/replace-nanoid`                                   | Transforms v4/replace nanoid                                   |
| `v4/replace-roundtrips-with-maxsteps`                 | Transforms v4/replace roundtrips with maxsteps                 |
| `v4/replace-token-usage-types`                        | Transforms v4/replace token usage types                        |
| `v4/rewrite-framework-imports`                        | Transforms v4/rewrite framework imports                        |

### v5 Codemods (v4 → v5 Migration)

| Codemod                                                               | Description                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `v5/flatten-streamtext-file-properties`                               | Transforms v5/flatten streamtext file properties                               |
| `v5/import-LanguageModelV2-from-provider-package`                     | Transforms v5/import LanguageModelV2 from provider package                     |
| `v5/migrate-to-data-stream-protocol-v2`                               | Transforms v5/migrate to data stream protocol v2                               |
| `v5/move-image-model-maxImagesPerCall`                                | Transforms v5/move image model maxImagesPerCall                                |
| `v5/move-langchain-adapter`                                           | Transforms v5/move langchain adapter                                           |
| `v5/move-maxsteps-to-stopwhen`                                        | Transforms v5/move maxsteps to stopwhen                                        |
| `v5/move-provider-options`                                            | Transforms v5/move provider options                                            |
| `v5/move-react-to-ai-sdk`                                             | Transforms v5/move react to ai sdk                                             |
| `v5/move-ui-utils-to-ai`                                              | Transforms v5/move ui utils to ai                                              |
| `v5/remove-experimental-wrap-language-model`                          | Transforms v5/remove experimental wrap language model                          |
| `v5/remove-get-ui-text`                                               | Transforms v5/remove get ui text                                               |
| `v5/remove-openai-compatibility`                                      | Transforms v5/remove openai compatibility                                      |
| `v5/remove-sendExtraMessageFields`                                    | Transforms v5/remove sendExtraMessageFields                                    |
| `v5/rename-IDGenerator-to-IdGenerator`                                | Transforms v5/rename IDGenerator to IdGenerator                                |
| `v5/rename-addtoolresult-to-addtooloutput`                            | Transforms v5/rename addtoolresult to addtooloutput                            |
| `v5/rename-converttocoremessages-to-converttomodelmessages`           | Transforms v5/rename converttocoremessages to converttomodelmessages           |
| `v5/rename-core-message-to-model-message`                             | Transforms v5/rename core message to model message                             |
| `v5/rename-datastream-methods-to-uimessage`                           | Transforms v5/rename datastream methods to uimessage                           |
| `v5/rename-datastream-transform-stream`                               | Transforms v5/rename datastream transform stream                               |
| `v5/rename-languagemodelv1providermetadata`                           | Transforms v5/rename languagemodelv1providermetadata                           |
| `v5/rename-max-tokens-to-max-output-tokens`                           | Transforms v5/rename max tokens to max output tokens                           |
| `v5/rename-message-to-ui-message`                                     | Transforms v5/rename message to ui message                                     |
| `v5/rename-mime-type-to-media-type`                                   | Transforms v5/rename mime type to media type                                   |
| `v5/rename-pipedatastreamtoresponse-to-pipeuimessagestreamtoresponse` | Transforms v5/rename pipedatastreamtoresponse to pipeuimessagestreamtoresponse |
| `v5/rename-reasoning-properties`                                      | Transforms v5/rename reasoning properties                                      |
| `v5/rename-reasoning-to-reasoningText`                                | Transforms v5/rename reasoning to reasoningText                                |
| `v5/rename-request-options`                                           | Transforms v5/rename request options                                           |
| `v5/rename-todatastreamresponse-to-touimessagestreamresponse`         | Transforms v5/rename todatastreamresponse to touimessagestreamresponse         |
| `v5/rename-tool-parameters-to-inputschema`                            | Transforms v5/rename tool parameters to inputschema                            |
| `v5/replace-bedrock-snake-case`                                       | Transforms v5/replace bedrock snake case                                       |
| `v5/replace-content-with-parts`                                       | Transforms v5/replace content with parts                                       |
| `v5/replace-datastream-to-uimessagestream`                            | Transforms v5/replace datastream to uimessagestream                            |
| `v5/replace-experimental-provider-metadata`                           | Transforms v5/replace experimental provider metadata                           |
| `v5/replace-fal-snake-case`                                           | Transforms v5/replace fal snake case                                           |
| `v5/replace-image-type-with-file-type`                                | Transforms v5/replace image type with file type                                |
| `v5/replace-llamaindex-adapter`                                       | Transforms v5/replace llamaindex adapter                                       |
| `v5/replace-oncompletion-with-onfinal`                                | Transforms v5/replace oncompletion with onfinal                                |
| `v5/replace-provider-metadata-with-provider-options`                  | Transforms v5/replace provider metadata with provider options                  |
| `v5/replace-rawresponse-with-response`                                | Transforms v5/replace rawresponse with response                                |
| `v5/replace-redacted-reasoning-type`                                  | Transforms v5/replace redacted reasoning type                                  |
| `v5/replace-simulate-streaming`                                       | Transforms v5/replace simulate streaming                                       |
| `v5/replace-textdelta-with-text`                                      | Transforms v5/replace textdelta with text                                      |
| `v5/replace-usage-token-properties`                                   | Transforms v5/replace usage token properties                                   |
| `v5/replace-usechat-api-with-transport`                               | Transforms v5/replace usechat api with transport                               |
| `v5/replace-usechat-input-with-state`                                 | Transforms v5/replace usechat input with state                                 |
| `v5/replace-zod-import-with-v3`                                       | Transforms v5/replace zod import with v3                                       |
| `v5/require-createIdGenerator-size-argument`                          | Transforms v5/require createIdGenerator size argument                          |
| `v5/restructure-file-stream-parts`                                    | Transforms v5/restructure file stream parts                                    |
| `v5/restructure-source-stream-parts`                                  | Transforms v5/restructure source stream parts                                  |
| `v5/rsc-package`                                                      | Transforms v5/rsc package                                                      |

### v6 Codemods (v5 → v6 Migration)

| Codemod                                                     | Description                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `v6/add-await-converttomodelmessages`                       | Transforms v6/add await converttomodelmessages                       |
| `v6/rename-converttocoremessages-to-converttomodelmessages` | Transforms v6/rename converttocoremessages to converttomodelmessages |
| `v6/rename-core-message-to-model-message`                   | Transforms v6/rename core message to model message                   |
| `v6/rename-mock-v2-to-v3`                                   | Transforms v6/rename mock v2 to v3                                   |
| `v6/rename-text-embedding-to-embedding`                     | Transforms v6/rename text embedding to embedding                     |
| `v6/rename-tool-call-options-to-tool-execution-options`     | Transforms v6/rename tool call options to tool execution options     |
| `v6/rename-vertex-provider-metadata-key`                    | Transforms v6/rename vertex provider metadata key                    |
| `v6/wrap-tomodeloutput-parameter`                           | Transforms v6/wrap tomodeloutput parameter                           |

## CLI Options

### Commands

```sh
npx @ai-sdk/codemod@beta <command> [options]
```

**Available Commands:**

- `upgrade` - Apply all codemods (v4 + v5 + v6)
- `v4` - Apply v4 codemods (v3 → v4 migration)
- `v5` - Apply v5 codemods (v4 → v5 migration)
- `v6` - Apply v6 codemods (v5 → v6 migration)
- `<codemod-name> <path>` - Apply specific codemod

### Global Options

- `--dry` - Preview changes without applying them
- `--print` - Print transformed code to stdout
- `--verbose` - Show detailed transformation logs

### Examples

```sh
# Preview all changes without applying
npx @ai-sdk/codemod@beta --dry upgrade

# Preview v4 changes only
npx @ai-sdk/codemod@beta --dry v4

# Preview v5 changes only
npx @ai-sdk/codemod@beta --dry v5

# Preview v6 changes only
npx @ai-sdk/codemod@beta --dry v6

# Show verbose output for specific codemod
npx @ai-sdk/codemod@beta --verbose v4/remove-experimental-ai-fn-exports src/

# Print transformed code for specific codemod
npx @ai-sdk/codemod@beta --print v4/replace-baseurl src/config.ts
```

## Best Practices

### Before Running Codemods

1. **Backup your code** - Commit all changes to version control
2. **Review current deprecation warnings** - Fix any obvious issues first
3. **Update dependencies** - Ensure you're on the target AI SDK version

### After Running Codemods

1. **Review changes** - Check the diff to understand what was transformed
2. **Test your application** - Ensure everything works as expected
3. **Handle edge cases** - Some complex patterns may need manual fixes
4. **Run type checking** - Fix any TypeScript errors that remain

### Troubleshooting

If a codemod doesn't transform some code:

1. **Check file extensions** - Codemods work on `.ts`, `.tsx`, `.js`, `.jsx` files
2. **Review patterns** - Complex or unusual code patterns may need manual updates
3. **Run specific codemods** - Try running individual codemods for targeted fixes
4. **Check documentation** - Some changes may not have automated codemods

## Contributing

### Adding New Codemods

1. Create the codemod in `src/codemods/`
2. Add test fixtures in `src/test/__testfixtures__/`
3. Create tests in `src/test/`
4. Update the bundle in `src/lib/upgrade.ts`

### Testing Codemods

First, navigate to the codemod directory:

```sh
cd packages/codemod
```

Then run the tests:

```sh
# Run all tests
pnpm test

# Run specific codemod tests
pnpm test <codemod-name>

# Test in development
pnpm test:watch
```

## Support

- **Documentation**: [AI SDK Migration Guides](https://ai-sdk.dev/docs/migration-guides)
- **Issues**: [GitHub Issues](https://github.com/vercel/ai/issues)
- **Community**: [Discord](https://discord.gg/vercel)

## Version Compatibility

- **AI SDK 6.0**: All codemods in this package
- **AI SDK 5.0**: Use v4 + v5 codemods
- **AI SDK 4.x**: Use `@ai-sdk/codemod@1.x`
- **AI SDK 3.x**: Manual migration required

---

For more detailed migration information, see:

- [AI SDK 6.0 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)
