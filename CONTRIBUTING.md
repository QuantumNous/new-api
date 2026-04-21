# Contributing

This repository is a customized fork of upstream `QuantumNous/new-api`.

## Branch Model

- `main`: upstream sync branch, treated as read-only for normal development
- `develop`: default branch and team integration branch
- `feature/*`: personal or task branches created from `develop`

## Daily Workflow

Create a feature branch from `develop`:

```bash
git checkout develop
git pull
git checkout -b feature/your-change
```

Push your branch:

```bash
git push -u origin feature/your-change
```

Open a pull request with:

- base: `develop`
- compare: your `feature/*` branch

## Rules

- Do not open daily feature work against `main`
- Do not push directly to `develop` or `main` unless you are performing repository maintenance
- Keep pull requests focused on a single task when possible
- Include a short human-written summary of what changed and why

## Upstream Sync Flow

Repository maintainers sync upstream through `main`, then merge updates into `develop`.

Typical maintainer flow:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main

git checkout develop
git merge main
git push origin develop
```
