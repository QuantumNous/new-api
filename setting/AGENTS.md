# setting/ — Configuration Management

## Overview
Two-tier config system: zero-dep constants + domain-specific settings.

## Structure
```
setting/
├── constant/              # Zero-dep constants
├── ratio_setting/
├── model_setting/
├── operation_setting/
├── system_setting/
└── performance_setting/
```

## Where to Look
| Task | Location |
|---|---|
| Domain configs | `setting/*_setting/` |
| System-level settings | `system_setting/` |

## Conventions
- `constant/` holds values with no external dependencies.
- Each domain has its own sub-package for isolation.

## Anti-Patterns
- Do NOT put DB-dependent configs in `constant/`.
