---
description: 'Create a GitHub Pull Request using local body file via gh CLI (browser auth).'
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1.  **Check Inputs**:
    - **Title**: The Pull Request title (Required).
    - **Head Branch**: Source branch (defaults to current branch: `git branch --show-current`).
    - **Base Branch**: Target branch (defaults to `develop`).
    - **Body File**: Path to PR body content (defaults to `.trae/output/pr.body.local.md`).

2.  **Verify Environment**:
    - Check if `gh` CLI is installed: `gh --version`.
    - Check authentication status: `gh auth status`.
    - **Note**: Explicitly ignore `GITHUB_TOKEN` env var to force browser-based auth if needed.

3.  **Execute PR Creation**:
    - Construct and run the `gh pr create` command:
      ```bash
      gh pr create --title "<TITLE>" --body-file "<BODY_FILE>" --base "<BASE>" --head "<HEAD>" --web
      ```
    - Note: The `--web` flag is optional but recommended if the user wants to review in browser before final submission, otherwise remove it to create directly. Based on user preference or default to direct creation if not specified.

4.  **Report Output**:
    - Capture the command output.
    - Display the URL of the newly created Pull Request.
    - Verify the URL is valid.
