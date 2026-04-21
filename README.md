# New API Custom Fork

This repository is a customized fork of upstream `new-api`.

It is maintained with a split-branch workflow:

- `main`: used to sync upstream updates
- `develop`: default branch and main line for team customization
- `feature/*`: branch from `develop` and open PRs back into `develop`

## Collaboration Workflow

Recommended local workflow:

```bash
git checkout develop
git pull
git checkout -b feature/your-change
```

After finishing your work:

```bash
git push -u origin feature/your-change
```

Then open a pull request:

- base: `develop`
- compare: your `feature/*` branch

## Branch Policy

- Do not send daily feature changes directly to `main`
- Sync upstream into `main` first
- Merge upstream updates from `main` into `develop`
- Treat `develop` as the only team integration branch

## Repository Notes

- This is not the upstream project repository
- Upstream changes are consumed through `main`
- Team-specific UI, workflow, and business customizations are developed on `develop`

## Language Notices

The following files are lightweight notices that point back to this primary document:

- `README.zh_CN.md`
- `README.zh_TW.md`
- `README.fr.md`
- `README.ja.md`
