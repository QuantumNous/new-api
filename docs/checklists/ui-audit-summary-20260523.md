# UI audit summary

- **Generated (UTC):** 2026-05-23T07:53:53Z
- **BASE_URL:** http://192.168.18.92:3001
- **Frontend reachable:** yes
- **Scope:** [`UI_ACCEPTANCE_SCOPE.md`](./UI_ACCEPTANCE_SCOPE.md)

## Artifacts

| Item | Path |
|------|------|
| Legacy term report (source) | `reports/legacy-terms-report.md` |
| Scan meta | `reports/scan-meta.env` |
| **Page audit report** | `reports/page-audit-report.md` |
| Page audit TSV | `reports/page-audit-full.tsv` |
| Screenshots | `screenshots/` |
| Screenshot / page log | `reports/screenshot.log` |

## Source scan counts

| Tier | Actionable | Internal/Ignored |
|------|----------:|-----------------:|
| P0 | 0 | 1535 |
| P1 | 313 | 2416 |
| P2 | 5 | — |

Full TSV: `reports/legacy-terms-full.tsv`

## Page audit (visible text + screenshots)

| Metric | Value |
|--------|------:|
| Status | success |
| P0 visible hits | 0 |
| P1 visible hits | 0 |
| Failed pages | 0 |
| Skipped (auth required) | 0 |

Detail: [`page-audit-report.md`](./page-audit-report.md)

## Recommended next steps

1. 修复 **页面 P0 可见命中** 与 **failed 页面**（含 500）。
2. 修复 **源码 P0 actionable**（`legacy-terms-report.md`）。
3. 复验：`bash scripts/dev/ui-audit/run-ui-audit.sh`

## Important constraints

- 不要改 API、字段名、`routeTree.gen.ts`、计费逻辑。
- 额度用词元；金额/单价用 ¥。

## Page / screenshot status

- **Page audit:** success — 截图与页面文本扫描完成
- **Screenshot runner:** success
- **Log:** `reports/screenshot.log`
