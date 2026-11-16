# The constant package (`/constant`)

This directory is only used to place globally reusable constant definitions and does not contain any business logic or dependencies.

## Current file

| Documentation | Description |
|----------------------|---------------------------------------------------------------------|
| `azure.go` | Defines global constants related to Azure, such as `AzureNoRemoveDotTime` (controls the deadline for removing `.`).         |
| `cache_key.go` | Cache key format string and Token related field constants, unified cache naming rules.                                    |
| `channel_setting.go` | Channel-level setting keys, such as `proxy`, `force_format`, etc.                          |
| `context_key.go` | Defines the `ContextKey` type and context key constants used throughout the project (request time, Token/Channel/User related information, etc.). |
| `env.go` | Global variables related to environment configuration, injected according to configuration files or environment variables during the startup phase.                                     |
| `finish_reason.go` | A collection of `finish_reason` string constants returned by OpenAI/GPT requests.                           |
| `midjourney.go` | Midjourney related error codes and action (Action) constants and model-to-action mapping table.                            |
| `setup.go` | Identifies whether the project has completed initial installation (`Setup` boolean).                                       |
| `task.go` | Various task platforms, action constants, and model and action mapping tables, such as Suno, Midjourney, etc.                     |
| `user_setting.go` | User settings related key constants and notification types (Email/Webhook), etc.                                    |

## Usage convention

1. The `constant` package **can only be referenced** (import) by other packages. **It is prohibited to reference other custom packages within the project** in this package. Only references to the **Go standard library** are allowed if necessary.
2. It is not allowed to write any logic code related to business processes, database operations, third-party service calls, etc. in this directory.
3. When adding a new type, please keep the naming semantics clear and add explanations in the **Current File** table of this README to ensure that team members can quickly understand its purpose.

> ⚠️ Violation of the above conventions will lead to unnecessary coupling between packages, affecting code maintainability and testability. Please check it yourself before submitting your code.