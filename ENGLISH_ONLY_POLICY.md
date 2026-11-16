# English-only policy

BEU Developer Orbit uses English as its only supported interface language.

All authored product copy, backend messages, account emails, default display metadata, admin pages, documentation, comments, commit messages, and new filenames must use English. Keep required New API, QuantumNous, One API, and third-party license notices and attribution. Do not rewrite Git history.

## Runtime behavior

- The frontend loads only `web/src/i18n/locales/en.json`. It does not detect the browser language or offer a language selector. Legacy preferences normalize to English.
- Existing `t()` calls remain for interpolation and upstream compatibility. `i18next` and `react-i18next` are still used; removing them would remove functional application plumbing. The browser language detector and obsolete translation-authoring workflow are removed.
- Calendar and interface number/date formatting use English. Language adapters remain so existing callers and stored preferences do not break.
- The backend loads only `i18n/locales/en.yaml`. Requested or previously saved locales fall back to English. Server logging stays English regardless of legacy `DEFAULT_LANGUAGE` settings.
- Built-in plugin display metadata contains English only. The plugin wire contract still accepts localized metadata from external integrations; the Orbit UI selects its English entry.
- Provider payloads, model IDs, protocol field names, user-authored content, and existing customer data are not translated or rewritten. Their exact bytes can affect routing, security, and API compatibility. Administrators must write new site content in English. Phase 1 does not rewrite arbitrary existing databases or third-party responses.

## Compatibility fixtures

English-only product copy does not mean ASCII-only transport. Unicode request bodies, identifiers, provider payloads, security cases, token-counting inputs, and legacy localized-plugin fixtures remain where they test upstream compatibility. `english-only-fixtures.json` pins each permitted file/line by SHA-256. These entries are test data, not alternative interface resources. Do not add a fixture exception to permit product copy or prose in another language.

## Validation

Run from the repository root:

```bash
python3 bin/check-english-only.py
(cd web && bun run typecheck)
(cd web && bun run test --maxWorkers=2)
```

The build and test scripts run the policy check, so the existing frontend CI test command also enforces it. The check inspects tracked and new source/prose files, rejects non-English scripts outside pinned compatibility fixtures, rejects additional locale resources, and detects obsolete language-selector references. Tests exercise old preferences and English fallback. Reviewers must also inspect English wording, Latin-script translations, dynamically configured copy, and text in images; a script detector cannot prove the language of every sentence.

Do not remove functional application code because it once supported localization. Preserve API contracts, authentication/session protections, quotas, database migrations, and role checks. Keep English changes separate from behavioral changes in review. Future branding must preserve the visible notice “Frontend design and development by New API contributors.” and the link to the upstream project.
