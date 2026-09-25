---
description: Automatically execute the four core phases of the Spec-Driven Development (SDD) pipeline: specify → plan → tasks → implement, in strict sequential order.
handoffs:
  - label: Execute After-Code Pipeline
    agent: speckit.aftercode
    prompt: Execute the after-code pipeline.
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Outline

This command orchestrates the full Spec-Driven Development (SDD) lifecycle, executing each of the four core phases in a strict, sequential, and non-interactive manner. It ensures that each phase completes before the next one begins, mirroring the exact semantics of executing each `/speckit.*` command individually.

**Execution is strictly sequential. Parallel execution of phases is prohibited.**

### Pre-flight Check

1.  **Validate User Input**:
    - If `$ARGUMENTS` is empty, the process will halt with an error. The initial feature description is mandatory to start the `specify` phase.

### Phase 1: Specify (`/speckit.specify`)

- **Action**: The workflow begins by invoking `/speckit.specify` with the provided `$ARGUMENTS`. This is the single entry point for user input.
- **Process**: This phase will automatically generate a feature branch, create the `spec.md` file, and run all associated validation and checklist generation steps as defined in the `speckit.specify` command.
- **Handoff**: Upon successful completion, it will automatically trigger the `plan` phase.
- **Output Report**:
  - "Phase 1 (Specify) completed."
  - `BRANCH_NAME`: [The generated feature branch name]
  - `SPEC_FILE`: [Path to the generated spec.md file]

### Phase 2: Plan (`/speckit.plan`)

- **Action**: Triggered automatically after `specify` completes. It requires no additional arguments and operates on the context established by the previous phase.
- **Process**: This phase will generate the `plan.md` and all its associated design artifacts (e.g., `research.md`, `data-model.md`, `contracts/`). It strictly follows the "Phase 0" and "Phase 1" steps outlined in the `speckit.plan` command.
- **Handoff**: Upon successful completion, it will automatically trigger the `tasks` phase.
- **Output Report**:
  - "Phase 2 (Plan) completed."
  - `IMPL_PLAN`: [Path to the generated plan.md file]
  - `DERIVED_ARTIFACTS`: [List of paths to other generated files like research.md]

### Phase 3: Tasks (`/speckit.tasks`)

- **Action**: Triggered automatically after `plan` completes.
- **Process**: This phase reads the `plan.md` and other design documents to generate a detailed, actionable `tasks.md` file, organizing work into phases based on user stories. The command name `speckit.tasks` is used to align with VChart's existing commands.
- **Handoff**: Upon successful completion, rely on the native `handoffs` of `/speckit.tasks` to automatically trigger `/speckit.implement`; `/speckit.auto` MUST NOT trigger `/speckit.implement` directly to avoid duplicate execution.
- **Output Report**:
  - "Phase 3 (Tasks) completed."
  - `TASKS_FILE`: [Path to the generated tasks.md file]
  - `SUMMARY`: [Total task count and parallel opportunities]

### Phase 4: Implement (`/speckit.implement`)

- **Action**: This phase corresponds to the `/speckit.implement` run that is started by the native `handoff` from `/speckit.tasks`. `/speckit.auto` MUST NOT start a separate `/speckit.implement` execution.
- **Process**: Continue (or observe) the implementation based on `tasks.md`, strictly following all rules of the original `speckit.implement` command, including the checklist gate behavior (ask for explicit confirmation before proceeding when checklists are incomplete). If `/speckit.implement` has already finished, do **not** re-run it; only summarize its results.
- **Completion**: The `auto` workflow conceptually ends after the implementation phase has completed. The subsequent `aftercode` pipeline must be initiated manually.
- **Output Report**:
  - "Phase 4 (Implement) completed."
  - `STATUS`: [Summary of task execution, e.g., "All tasks completed successfully."]
  - `NEXT_STEPS`: "Ready to proceed with the code delivery pipeline. Run `/speckit.aftercode` to continue."

**Note**: If any downstream phase (for example `tasks` or `implement`) has already been completed via the native handoff chain of the upstream commands, do not invoke it again. Simply acknowledge its completion and record the relevant outputs before moving on.
