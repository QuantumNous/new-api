---
name: sync-zh-en-docs
description: Sync uncommitted docs between `website/docs/zh` and `website/docs/en`. Use when authors update docs in one language and need to align the mirrored `.md`/`.mdx` file in the other language.
---

# Sync Zh/En Documentation

## Steps

1. Check uncommitted changes under `website/docs/zh` and `website/docs/en`.

2. Translate each changed file to the counterpart path (`zh` <-> `en`), and keep:

- meaning and structure consistent
- technical terms / commands / code blocks unchanged unless localization is required
- concise, clear, professional technical-doc style

3. Format and verify:

```bash
node --run format
```
