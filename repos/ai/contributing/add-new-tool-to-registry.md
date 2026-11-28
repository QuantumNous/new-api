# AI SDK Tools Registry - Contributing a Tool

You can add your tool to the [registry](https://ai-sdk.dev/tools-registry) by submitting a pull request that updates the `content/tools-registry/registry.ts` file.

### Prerequisites

Before submitting your tool, ensure you have:

- Published your tool package to npm
- Documented your tool with clear usage instructions
- Tested your tool with the AI SDK

### Adding Your Tool

1. **Fork and clone the repository**

   Follow the setup instructions in the main [CONTRIBUTING.md](../../CONTRIBUTING.md)

2. **Add your tool entry**

   ```bash
   # Navigate to the tools registry directory
   cd content/tools-registry
   ```

   Open `registry.ts` in your editor and add a new tool object to the `tools` array following this structure:

   ```typescript
   {
     slug: 'your-tool-slug',
     name: 'Your Tool Name',
     description: 'Clear description of what your tool does and its capabilities',
     packageName: 'your-package-name',
     tags: ['tag1', 'tag2'], // Optional: categorize your tool
     apiKeyEnvName: 'YOUR_API_KEY', // Optional: environment variable name for API key
     installCommand: {
       pnpm: 'pnpm install your-package-name',
       npm: 'npm install your-package-name',
       yarn: 'yarn add your-package-name',
       bun: 'bun add your-package-name',
     },
     codeExample: `import { generateText, gateway, isStepCount } from 'ai';
   import { yourTool } from 'your-package-name';

   const { text } = await generateText({
     model: gateway('openai/gpt-5-mini'),
     prompt: 'Your example prompt',
     tools: {
       yourTool: yourTool(),
     },
     stopWhen: isStepCount(3),
   });

   console.log(text);`,
     docsUrl: 'https://your-docs-url.com',
     apiKeyUrl: 'https://your-api-key-url.com',
     websiteUrl: 'https://your-website.com',
     npmUrl: 'https://www.npmjs.com/package/your-package-name',
   }
   ```

3. **Provide a working code example**

   Your `codeExample` should:
   - Be a complete, working example
   - Show realistic usage of your tool
   - Use the latest AI SDK patterns
   - Include necessary imports
   - Be tested to ensure it works

4. **Submit your pull request**

   ```bash
   # Create a new branch
   git checkout -b feat/add-tool-your-tool-name

   # Add and commit your changes
   git add content/tools-registry/registry.ts
   git commit -m "feat(tools-registry): add your-tool-name"

   # Push and create a pull request
   git push origin feat/add-tool-your-tool-name
   ```

   Use the PR title format: `feat(tools-registry): add your-tool-name`

## Questions?

If you have questions about adding your tool to the registry:

- Check the main [CONTRIBUTING.md](../../CONTRIBUTING.md) guide
- Review existing tool entries in `registry.ts` for examples
- Open an issue on [GitHub](https://github.com/vercel/ai/issues)
