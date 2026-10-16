# Adding a new model

1. Add model id to settings (model ids) for auto-complete
1. Add model id to list in provider page under `/content/providers/...` (Model Capabilities table at the bottom)
1. If the model is notable, add to
   - `content/providers/01-ai-sdk-providers/index.mdx`
   - `content/docs/02-foundations/02-providers-and-models.mdx`
1. PR with changeset
1. NPM publish through Changesets PR

Example PR: https://github.com/vercel/ai/pull/7313
