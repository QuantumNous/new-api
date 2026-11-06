---
description: 'Automatically execute the subsequent code delivery pipeline: skilltypesync → changelog → commit → prgenerate, in strict sequential order.'
handoffs:
  - label: 'Create Pull Request'
    agent: 'speckit.prcreate'
    prompt: 'Create the GitHub Pull Request using the generated body'
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Outline

This command orchestrates the code delivery pipeline, executing the `skilltypesync`, `changelog`, `commit`, and `prgenerate` phases in a strict, sequential, and non-interactive flow. It ensures that the entire process, from synchronizing skill type resources to preparing the PR body, is automated while maintaining the precise behavior of each individual step.

**Execution is strictly sequential. No steps will be skipped or run in parallel.**

### Phase 1: Sync Skill Type Resources (`/speckit.skilltypesync`)

- **Action**: Initiates the delivery pipeline by invoking `/speckit.skilltypesync`.
- **Process**:
  - Detects whether this feature includes user-facing config/API/type changes.
  - If required, synchronizes skill reference assets under:
    - `skills/vchart-development-assistant/references/type-meta/`
    - `skills/vchart-development-assistant/references/type-details/`
  - Runs consistency checks to prevent broken type references in the skill resources.
  - Any parameters provided in `$ARGUMENTS` will be passed through (for example: `--base`, `--force`, `--types`).
- **Handoff**: Upon successful completion, automatically triggers the `changelog` phase.
- **Output Report**:
  - "Phase 1 (Skill Type Sync) completed."
  - `SYNC_TRIGGER`: [auto-detected | forced]
  - `UPDATED_TYPE_META`: [List of updated files or empty]
  - `UPDATED_TYPE_DETAILS`: [List of updated files or empty]

### Phase 2: Generate Changelog (`/speckit.changelog`)

- **Action**: Triggered automatically after `skilltypesync` completes.
- **Process**:
  - Collects commits since a base branch (defaulting to `develop`).
  - Infers the version bump type (`patch`, `minor`, `major`) automatically from commit messages unless an explicit `bumpType` is passed in `$ARGUMENTS`.
  - Generates the necessary change files within the `common/changes/` directory.
  - Any parameters provided in `$ARGUMENTS` will be passed through to override default behavior.
- **Handoff**: Upon successful completion, automatically triggers the `commit` phase.
- **Output Report**:
  - "Phase 2 (Changelog) completed."
  - `CREATED_FILES`: [List of paths to generated files in `common/changes/`]
  - `VALIDATION`: "Changelog message conforms to Conventional Commits standards."

### Phase 3: Create Commit (`/speckit.commit`)

- **Action**: Triggered automatically after `changelog` completes.
- **Process**:
  - Stages all current workspace changes (`git add --all`).
  - Generates a Conventional Commits-compliant commit message, prioritizing `$ARGUMENTS`, then `common/changes/` content, and finally a generic message.
  - Executes `git commit`.
  - Pushes the commit to the remote origin by default.
  - The `message` and `pushAfterCommit` behaviors can be overridden via `$ARGUMENTS`.
- **Handoff**: Upon successful completion, automatically triggers the `prgenerate` phase.
- **Output Report**:
  - "Phase 3 (Commit) completed."
  - `COMMIT_MESSAGE`: [The full commit message used]
  - `PUSH_STATUS`: "Branch [branch-name] pushed to origin."

### Phase 4: Generate PR Body (`/speckit.prgenerate`)

- **Action**: The final phase, realized via the native `handoff` from `/speckit.commit` to `/speckit.prgenerate` after `commit` completes. This `/speckit.aftercode` command does not declare its own `handoff` entry for `/speckit.prgenerate` to avoid duplicate execution.
- **Process**:
  - Selects the appropriate PR template (`.github/PULL_REQUEST_TEMPLATE/pr_cn.md` or `.github/PULL_REQUEST_TEMPLATE.md`), defaulting to Chinese unless specified in `$ARGUMENTS`.
  - Populates the template with content from `common/changes/`, commit history, and any other available artifacts.
  - Saves the final, populated PR body to `.trae/output/pr.body.local.md`.
- **Handoff**: This step retains its original `handoff` to `speckit.prcreate`. The `/speckit.aftercode` command depends strictly on the original single-step handoff chain and does **not** introduce any additional handoffs, preventing `prgenerate` (or downstream steps) from running more than once.
- **Output Report**:
  - "Phase 4 (PR Generate) completed."
  - `OUTPUT_FILE`: ".trae/output/pr.body.local.md"
  - `VALIDATION_SUMMARY`: "PR body generated. Please review the file before creating the pull request."
  - `NEXT_STEPS`: "The `speckit.prcreate` command may have been triggered automatically. If not, you can run it manually to create the GitHub Pull Request."
