# ZCode 36-Model Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the exact same 36 text-model identifiers in the Chat, Responses, and Messages providers of both ZCode Desktop and ZCode CLI.

**Architecture:** Store the approved model set in one importable manifest and use a pure transformer to update only the three target providers. Wrap the two real configuration writes in a hash-preconditioned backup/apply/readback transaction so partial writes roll back both files.

**Tech Stack:** Python 3 standard library, `unittest`, JSON, SHA-256, atomic POSIX file replacement, ZCode local configuration.

---

## File Structure

- Create `tools/ops/zcode_text_models.py`: exact 36-model manifest, provider IDs, and invariant validation.
- Create `tools/ops/zcode_model_sync.py`: pure configuration transformation, redacted reporting, backup, apply, rollback, and CLI.
- Create `tools/ops/test_zcode_model_sync.py`: manifest, transformation, idempotence, and transaction tests.
- Write runtime evidence to `/Users/bytedance/newapi/reports/zcode-36-model-sync-20260928/`; never commit copied ZCode configuration.

### Task 1: Freeze The Exact Model Manifest

**Files:**

- Create: `tools/ops/zcode_text_models.py`
- Create: `tools/ops/test_zcode_model_sync.py`

- [ ] **Step 1: Write the failing manifest test**

```python
import unittest

import zcode_text_models as manifest


class ModelManifestTest(unittest.TestCase):
    def test_exact_physical_text_model_contract(self) -> None:
        self.assertEqual(len(manifest.MODEL_IDS), 36)
        self.assertEqual(len(set(manifest.MODEL_IDS)), 36)
        self.assertEqual(tuple(sorted(manifest.MODEL_IDS)), manifest.MODEL_IDS)
        self.assertNotIn("gpt-5.6", manifest.MODEL_IDS)
        self.assertNotIn("gpt-6", manifest.MODEL_IDS)
        self.assertNotIn("gpt-5.3-codex-spark", manifest.MODEL_IDS)
        self.assertNotIn("doubao-seed-evolving", manifest.MODEL_IDS)
        self.assertIn("claude-fable-5-1", manifest.MODEL_IDS)
        self.assertIn("gpt-5.6-luna", manifest.MODEL_IDS)
        self.assertIn("gpt-6-luna", manifest.MODEL_IDS)
        self.assertIn("grok-4.7", manifest.MODEL_IDS)

    def test_three_provider_contract(self) -> None:
        self.assertEqual(
            manifest.PROVIDER_KINDS,
            {
                "newapi-chat": "openai-compatible",
                "4e71cad5-e14a-4b21-8feb-7727ba10511d": "openai",
                "newapi-messages": "anthropic",
            },
        )
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_zcode_model_sync.py -v
```

Expected: `ModuleNotFoundError: No module named 'zcode_text_models'`.

- [ ] **Step 3: Implement the immutable manifest**

```python
MODEL_IDS = tuple(sorted((
    "claude-fable-5-1",
    "claude-haiku-4-5",
    "claude-opus-4-6",
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-opus-5",
    "claude-opus-5-5",
    "claude-sonnet-4-6",
    "claude-sonnet-5",
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "deepseekv4.1flash",
    "deepseekv4.1flash-vision",
    "doubao-seed-2.0-code",
    "doubao-seed-2.0-lite",
    "doubao-seed-2.0-mini",
    "doubao-seed-2.0-pro",
    "doubao-seed-2.1-pro",
    "doubao-seed-2.1-turbo",
    "doubao-seed-character",
    "glm-5.1",
    "glm-5.2",
    "glm-5.3",
    "glm-5.3-flash",
    "gpt-5.5",
    "gpt-5.6-luna",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-6-astra",
    "gpt-6-luna",
    "gpt-6-sol",
    "grok-4.5",
    "grok-4.6",
    "grok-4.7",
    "kimi-k3",
    "minimax-m3",
)))

PROVIDER_KINDS = {
    "newapi-chat": "openai-compatible",
    "4e71cad5-e14a-4b21-8feb-7727ba10511d": "openai",
    "newapi-messages": "anthropic",
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run the command from Step 2.

Expected: both manifest tests pass.

- [ ] **Step 5: Commit the manifest contract**

```bash
git add tools/ops/zcode_text_models.py tools/ops/test_zcode_model_sync.py
git commit -m "test(ops): freeze zcode physical model set"
```

### Task 2: Build A Pure, Idempotent Configuration Transformer

**Files:**

- Create: `tools/ops/zcode_model_sync.py`
- Modify: `tools/ops/test_zcode_model_sync.py`

- [ ] **Step 1: Add failing transformation tests**

```python
import copy

import zcode_model_sync as sync


class ConfigurationTransformTest(unittest.TestCase):
    def setUp(self) -> None:
        self.document = {
            "model": "newapi-messages/glm-5.3",
            "provider": {
                provider_id: {
                    "kind": kind,
                    "enabled": True,
                    "options": {
                        "baseURL": "https://gateway.invalid/v1",
                        "apiKey": "fixture-secret",
                        "headers": {
                            "X-NewAPI-Responses-Input-Item-Soft-Limit": "900"
                        },
                    },
                    "models": {
                        "glm-5.3": {
                            "modelType": "language",
                            "limit": {"context": 262144},
                        }
                    },
                }
                for provider_id, kind in manifest.PROVIDER_KINDS.items()
            },
            "unrelated": {"keep": True},
        }

    def test_all_targets_receive_exactly_the_manifest(self) -> None:
        updated, report = sync.synchronize_document(self.document)
        for provider_id in manifest.PROVIDER_KINDS:
            self.assertEqual(
                set(updated["provider"][provider_id]["models"]),
                set(manifest.MODEL_IDS),
            )
            self.assertEqual(report[provider_id]["after_count"], 36)

    def test_non_model_configuration_is_preserved(self) -> None:
        updated, _ = sync.synchronize_document(self.document)
        self.assertEqual(updated["model"], self.document["model"])
        self.assertEqual(updated["unrelated"], self.document["unrelated"])
        for provider_id in manifest.PROVIDER_KINDS:
            self.assertEqual(
                updated["provider"][provider_id]["options"],
                self.document["provider"][provider_id]["options"],
            )

    def test_transform_is_idempotent(self) -> None:
        once, _ = sync.synchronize_document(self.document)
        twice, _ = sync.synchronize_document(once)
        self.assertEqual(once, twice)
```

- [ ] **Step 2: Run the transformer tests and verify RED**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_zcode_model_sync.ConfigurationTransformTest -v
```

Expected: import or missing-function failures for `zcode_model_sync`.

- [ ] **Step 3: Implement the pure transformer**

Implement these interfaces in `tools/ops/zcode_model_sync.py`:

```python
DEFAULT_CONTEXT = 1_048_576


def model_catalog(document: dict[str, object]) -> dict[str, dict[str, object]]:
    catalog = {}
    for provider in document["provider"].values():
        for model_id, metadata in (provider.get("models") or {}).items():
            if isinstance(metadata, dict):
                catalog.setdefault(model_id, copy.deepcopy(metadata))
    return catalog


def normalized_metadata(
    metadata: dict[str, object] | None,
) -> dict[str, object]:
    value = copy.deepcopy(metadata or {})
    value["modelType"] = "language"
    value.setdefault("limit", {})
    value["limit"].setdefault("context", DEFAULT_CONTEXT)
    value.setdefault("modalities", {})
    value["modalities"].setdefault("input", ["text"])
    value["modalities"].setdefault("output", ["text"])
    value.setdefault("zcode", {})
    value["zcode"]["modified"] = True
    return value


def synchronize_document(
    document: dict[str, object],
) -> tuple[dict[str, object], dict[str, object]]:
    updated = copy.deepcopy(document)
    catalog = model_catalog(document)
    report = {}
    for provider_id, expected_kind in PROVIDER_KINDS.items():
        provider = updated["provider"].get(provider_id)
        if not isinstance(provider, dict):
            raise ValueError(f"missing provider: {provider_id}")
        if provider.get("kind") != expected_kind:
            raise ValueError(f"unexpected provider kind: {provider_id}")
        before = set((provider.get("models") or {}).keys())
        provider["models"] = {
            model_id: normalized_metadata(catalog.get(model_id))
            for model_id in MODEL_IDS
        }
        report[provider_id] = {
            "before_count": len(before),
            "after_count": len(MODEL_IDS),
            "added": sorted(set(MODEL_IDS) - before),
            "removed": sorted(before - set(MODEL_IDS)),
        }
    return updated, report
```

Import `MODEL_IDS` and `PROVIDER_KINDS` from `zcode_text_models`.
Validate that `provider` and every target `models` value are JSON objects
before iteration.

- [ ] **Step 4: Run the transformer tests and verify GREEN**

Run the command from Step 2.

Expected: all transformation tests pass.

- [ ] **Step 5: Commit the transformer**

```bash
git add tools/ops/zcode_model_sync.py tools/ops/test_zcode_model_sync.py
git commit -m "feat(ops): synchronize zcode model visibility"
```

### Task 3: Add Atomic Two-File Apply And Rollback

**Files:**

- Modify: `tools/ops/zcode_model_sync.py`
- Modify: `tools/ops/test_zcode_model_sync.py`

- [ ] **Step 1: Add failing transaction tests**

Add tests using `tempfile.TemporaryDirectory` for:

```python
def test_apply_writes_both_configs_and_private_backup(self) -> None:
    result = sync.apply_pair(self.v2_path, self.cli_path, self.backup_root)
    self.assertEqual(result["changed_files"], 2)
    self.assertEqual(self.v2_path.stat().st_mode & 0o777, 0o600)
    self.assertEqual(self.cli_path.stat().st_mode & 0o777, 0o600)
    self.assertEqual(result["backup_dir"].stat().st_mode & 0o777, 0o700)


def test_second_write_failure_restores_both_original_byte_sequences(self) -> None:
    original_v2 = self.v2_path.read_bytes()
    original_cli = self.cli_path.read_bytes()
    with self.assertRaisesRegex(RuntimeError, "injected second write"):
        sync.apply_pair(
            self.v2_path,
            self.cli_path,
            self.backup_root,
            write_hook=sync.fail_on_write_number(2),
        )
    self.assertEqual(self.v2_path.read_bytes(), original_v2)
    self.assertEqual(self.cli_path.read_bytes(), original_cli)


def test_noop_reapply_does_not_create_backup(self) -> None:
    sync.apply_pair(self.v2_path, self.cli_path, self.backup_root)
    result = sync.apply_pair(self.v2_path, self.cli_path, self.backup_root)
    self.assertEqual(result["changed_files"], 0)
    self.assertIsNone(result["backup_dir"])
```

- [ ] **Step 2: Run the transaction tests and verify RED**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_zcode_model_sync.ZCodeTransactionTest -v
```

Expected: failures for missing `apply_pair` and injected-write support.

- [ ] **Step 3: Implement the transaction**

Implement:

```python
def canonical_bytes(value: dict[str, object]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def atomic_write(path: Path, data: bytes) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=path.name + ".", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
```

`apply_pair` must read both byte sequences and hashes first, transform both
documents in memory, return without backup when neither changes, create one
mode-`0700` backup directory with mode-`0600` copies otherwise, recheck both
source hashes before the first write, write both files atomically, validate
readback, and restore both original byte sequences on any exception.

- [ ] **Step 4: Run the transaction tests and the complete file**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_zcode_model_sync.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit transactional apply**

```bash
git add tools/ops/zcode_model_sync.py tools/ops/test_zcode_model_sync.py
git commit -m "feat(ops): apply zcode model sync atomically"
```

### Task 4: Add A Redacted CLI And Readback Validator

**Files:**

- Modify: `tools/ops/zcode_model_sync.py`
- Modify: `tools/ops/test_zcode_model_sync.py`

- [ ] **Step 1: Add failing CLI and report tests**

Test `main(argv)` with fixture paths and assert:

```python
self.assertEqual(report["model_count"], 36)
self.assertEqual(set(report["providers"]), set(manifest.PROVIDER_KINDS))
self.assertNotIn("apiKey", json.dumps(report))
self.assertNotIn("fixture-secret", json.dumps(report))
self.assertEqual(report["selected_model_unchanged"], True)
self.assertEqual(report["semantic_changes_after_reapply"], 0)
```

- [ ] **Step 2: Run the CLI tests and verify RED**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_zcode_model_sync.ZCodeCliTest -v
```

Expected: failure because argument parsing and redacted report generation do
not exist.

- [ ] **Step 3: Implement the CLI**

Support these exact arguments:

```text
--v2-config
--cli-config
--backup-root
--output
--apply
--rollback-backup
```

Defaults must be:

```python
Path.home() / ".zcode/v2/config.json"
Path.home() / ".zcode/cli/config.json"
Path.home() / ".zcode/backups"
```

Dry-run must write only counts, model identifiers, additions/removals, and
before/after SHA-256 values. Rollback must require both expected backup files,
verify their manifest hashes, recheck current file hashes, and restore both
files atomically.

- [ ] **Step 4: Run all synchronizer tests**

Run:

```bash
cd /Users/bytedance/newapi/.worktrees/rc40-compat-20260924/new-api/tools/ops
python3 -m unittest test_zcode_model_sync.py -v
python3 -m py_compile zcode_text_models.py zcode_model_sync.py
```

Expected: all tests pass and compilation exits `0`.

- [ ] **Step 5: Commit the CLI**

```bash
git add tools/ops/zcode_model_sync.py tools/ops/test_zcode_model_sync.py
git commit -m "feat(ops): add audited zcode model sync cli"
```

### Task 5: Apply And Verify The Local ZCode Configuration

**Files:**

- Modify: `~/.zcode/v2/config.json` outside Git
- Modify: `~/.zcode/cli/config.json` outside Git
- Create: `/Users/bytedance/newapi/reports/zcode-36-model-sync-20260928/dry-run.json`
- Create: `/Users/bytedance/newapi/reports/zcode-36-model-sync-20260928/apply.json`
- Create: `/Users/bytedance/newapi/reports/zcode-36-model-sync-20260928/noop.json`

- [ ] **Step 1: Run the real dry-run**

```bash
python3 tools/ops/zcode_model_sync.py \
  --output /Users/bytedance/newapi/reports/zcode-36-model-sync-20260928/dry-run.json
```

Expected: `mode=dry-run`, model count `36`, and no real configuration hash
changes.

- [ ] **Step 2: Inspect the redacted diff**

```bash
jq '{model_count,providers,selected_model_unchanged,before_sha256,after_sha256}' \
  /Users/bytedance/newapi/reports/zcode-36-model-sync-20260928/dry-run.json
```

Expected: six target provider/config combinations converge to 36; no secret
fields appear.

- [ ] **Step 3: Apply once**

```bash
python3 tools/ops/zcode_model_sync.py \
  --apply \
  --output /Users/bytedance/newapi/reports/zcode-36-model-sync-20260928/apply.json
```

Expected: both configurations change or already match, any created backup is
mode `0700`, and readback validation passes.

- [ ] **Step 4: Reapply and verify no-op**

```bash
python3 tools/ops/zcode_model_sync.py \
  --apply \
  --output /Users/bytedance/newapi/reports/zcode-36-model-sync-20260928/noop.json
```

Expected: `changed_files=0` and no new backup directory.

- [ ] **Step 5: Verify all six exact sets without printing credentials**

```bash
for file in "$HOME/.zcode/v2/config.json" "$HOME/.zcode/cli/config.json"; do
  jq -e '
    [.provider["newapi-chat"].models,
     .provider["4e71cad5-e14a-4b21-8feb-7727ba10511d"].models,
     .provider["newapi-messages"].models]
    | . as $sets
    | ($sets | all(length == 36))
      and (($sets[0] | keys) == ($sets[1] | keys))
      and (($sets[1] | keys) == ($sets[2] | keys))
  ' "$file"
done
```

Expected: `true` for both files.

- [ ] **Step 6: Refresh ZCode and verify the visible lists**

Use the running ZCode settings UI to refresh provider configuration. Inspect
Chat, Responses, and Messages in Desktop and CLI and assert each list contains
36 entries, includes all six GPT physical variants, `claude-fable-5-1`, and
`grok-4.7`, and excludes the two generic GPT aliases and two explicitly
removed models.

- [ ] **Step 7: Seal evidence and update handoff**

Create SHA-256 sums for the three redacted reports and record the backup path,
post-apply configuration hashes, exact model-set hash, and UI readback result
in `/Users/bytedance/newapi/docs/mvp/handoff.md`. Do not hash or copy
credential-bearing configuration into the report directory.
