# Codemods

We strongly recommend to utilize an AI model to create a codemod for your changes, such as [Cursor](https://cursor.com) with `claude-4-sonnet`.

Here is a list of instructions that will help the AI model to come up with a better result

```md
- Start all input/output fixtures files with `// @ts-nocheck`. Make sure the comment remains in place in the output fixture file.
- Update `packages/codemod/src/lib/upgrade.ts`
- Use `import { createTransformer } from './lib/create-transformer';` for codemods. Do not import anything from `jscodeshift` directly.
- No need to cover imports that use `require()`
- The codemod should not return anything. It should set `context.hasChanges` to `true` instead.
- See files in `packages/codemod/src/codemods` for conventions
- Multiple input/output files can be used in case of import conflicts.
- Run tests to verify the change
- Run the codemod manually to verify that it's working
- If you need to create temporary files for testing, create them in `packages/codemod/`, and remove them when done.
```

Depending on the complexity of the changes, you can instruct the AI to review changes directly from a pull request, e.g. https://github.com/vercel/ai/pull/5750.diff. If that doesn't yield a useful result, try describing the breaking change such as in the example below

## Example

````md
# Breaking change

## `streamtext()`: `result.file.{mediaType,data}` properties is now `result.{mediaType,data}`

Before:

```ts
import { streamText } from 'ai';

const result = await streamText({
  model: someModel,
  prompt: 'Generate an image',
});

for await (const delta of result.stream) {
  switch (delta.type) {
    case 'file': {
      console.log('Media type:', delta.file.mediaType);
      console.log('File data:', delta.file.data);
      break;
    }
  }
}
```

After:

```ts
import { streamText } from 'ai';

const result = await streamText({
  model: someModel,
  prompt: 'Generate an image',
});

for await (const delta of result.stream) {
  switch (delta.type) {
    case 'file': {
      console.log('Media type:', delta.mediaType);
      console.log('File data:', delta.data);
      break;
    }
  }
}
```
````
