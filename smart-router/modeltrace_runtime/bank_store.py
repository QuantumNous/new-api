from __future__ import annotations

import fcntl
import hashlib
import json
import os
import re
import stat
import sys
import threading
import uuid
import weakref
from contextlib import contextmanager
from functools import wraps
from pathlib import Path

from modeltrace_runtime import numeric_rows
from modeltrace_runtime.bank_validation import validate_bank
from modeltrace_runtime.numeric_rows import _parse_numeric_rows, normalize_row


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
VENDOR_ROOT = REPOSITORY_ROOT / "third_party" / "modeltrace"
VENDOR_DATA = REPOSITORY_ROOT / "third_party" / "modeltrace" / "data"
BUILTIN_REFERENCES = (
    ("gpt", "GPT", VENDOR_DATA / "gpt_reference.jsonl"),
    ("claude", "Claude", VENDOR_DATA / "claude_reference.jsonl"),
)
_BANK_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
_RESERVED_BANK_IDS = {
    family_id for family_id, _, _ in BUILTIN_REFERENCES
} | {"unified"}
_SENSITIVE_LABEL_PATTERN = re.compile(
    r"(?<![^\W_])"
    r"(?:api(?:[\W_]*key)|authorization|bearer|secret|token|password|credential)"
    r"(?![^\W_])",
    re.IGNORECASE,
)
_MAX_CUSTOM_BANKS = 30
_MAX_MODELS = 256
_MAX_REFERENCES = 8192
_MAX_STATE_BYTES = 1024 * 1024
_MAX_BANK_BYTES = 32 * 1024 * 1024
_MAX_MANIFEST_BYTES = 64 * 1024
_THREAD_LOCKS: dict[str, threading.Lock] = {}
_THREAD_LOCKS_GUARD = threading.Lock()
_UNCERTAIN_COMMIT_MESSAGE = (
    "bank store commit outcome is uncertain; restart required"
)

sys.path.insert(0, str(VENDOR_ROOT))
try:
    from third_party.modeltrace.bank_builder import (  # noqa: E402
        build_bank,
        read_rows as vendor_read_rows,
    )
finally:
    sys.path.remove(str(VENDOR_ROOT))


def _load_builtin_rows() -> list[dict]:
    output = []
    for family_id, family_name, path in BUILTIN_REFERENCES:
        for row in vendor_read_rows(path):
            numeric = {
                "row_id": row["row_id"],
                "source": row["source"],
                "family_id": family_id,
                "family_name": family_name,
                "condition_id": row["condition_id"],
                "challenge_id": row["challenge_id"],
                "expected_count": row["requested_count"],
                "numbers": row["numbers"],
            }
            if "nuisance_condition_id" in row:
                numeric["nuisance_condition_id"] = row[
                    "nuisance_condition_id"
                ]
            if "collected_at" in row:
                numeric["time"] = row["collected_at"]
            output.append(normalize_row(numeric))
    return output


def _json_bytes(value) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=True,
            allow_nan=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


def _jsonl_bytes(rows: list[dict]) -> bytes:
    return b"".join(_json_bytes(row) for row in rows)


def _cache_locked(operation):
    @wraps(operation)
    def locked(self, *args, **kwargs):
        with self._cache_lock:
            return operation(self, *args, **kwargs)
    return locked


class BankStore:
    def __init__(self, root):
        try:
            self.root, self._root_fd = self._open_root(root)
        except ValueError:
            raise
        except (OSError, TypeError) as error:
            raise ValueError("invalid bank store root") from error
        self._root_finalizer = weakref.finalize(
            self,
            os.close,
            self._root_fd,
        )
        root_status = os.fstat(self._root_fd)
        self._root_identity = (root_status.st_dev, root_status.st_ino)
        self._cache_lock = threading.RLock()
        self._banks: dict[str, str] = {}
        self._custom_rows: dict[str, list[dict]] = {}
        self._builtin_rows: list[dict] | None = None
        self._family_calibration: dict[str, dict] = {}
        self._committed_bank: dict | None = None
        self._committed_revision = ""
        self._committed_generation = "builtin"
        self._write_uncertain = False
        self._commit_sequence = 0
        try:
            self._refresh_committed()
        except Exception:
            self._root_finalizer()
            raise

    def create(self, bank_id: str, label: str) -> dict:
        with self._writer_lock():
            return self._create(bank_id, label)

    @_cache_locked
    def _create(self, bank_id: str, label: str) -> dict:
        self._validate_bank_id(bank_id, allow_reserved=False)
        self._validate_label(label)
        if bank_id in self._banks:
            raise ValueError(f"bank {bank_id!r} already exists")
        if len(self._banks) >= _MAX_CUSTOM_BANKS:
            raise ValueError(
                f"at most {_MAX_CUSTOM_BANKS} custom banks are supported"
            )
        banks = dict(self._banks)
        custom_rows = {
            existing_id: list(rows)
            for existing_id, rows in self._custom_rows.items()
        }
        banks[bank_id] = label
        custom_rows[bank_id] = []
        self._assert_model_capacity(self._all_rows(custom_rows))
        unified = self._current_bank()[0]
        family_banks = self._fit_family_banks(custom_rows)
        self._publish_generation(banks, custom_rows, unified, family_banks)
        return self.summary()

    def enroll(self, bank_id: str, rows: list[dict]) -> dict:
        with self._writer_lock():
            return self._enroll(bank_id, rows)

    @_cache_locked
    def _enroll(self, bank_id: str, rows: list[dict]) -> dict:
        self._validate_bank_id(bank_id, allow_reserved=False)
        if bank_id not in self._banks:
            raise ValueError(f"unknown bank {bank_id!r}")
        if type(rows) is not list or not rows:
            raise ValueError("rows must be a non-empty list")
        label = self._banks[bank_id]
        normalized = []
        for row in rows:
            if type(row) is not dict:
                raise ValueError("enrollment rows must contain dicts")
            if "family_id" in row and row["family_id"] != bank_id:
                raise ValueError("enrollment row family_id conflicts with bank")
            if "family_name" in row and row["family_name"] != label:
                raise ValueError("enrollment row family_name conflicts with bank")
            candidate = dict(row)
            candidate["family_id"] = bank_id
            candidate["family_name"] = label
            item = normalize_row(candidate)
            if not item["strict_valid"]:
                raise ValueError("enrollment rows must be strict-valid")
            normalized.append(item)
        banks = dict(self._banks)
        custom_rows = {
            existing_id: list(existing_rows)
            for existing_id, existing_rows in self._custom_rows.items()
        }
        custom_rows[bank_id].extend(normalized)
        all_rows = self._all_rows(custom_rows)
        if len(all_rows) > _MAX_REFERENCES:
            raise ValueError(
                f"at most {_MAX_REFERENCES} numeric references are supported"
            )
        self._assert_model_ownership(all_rows)
        self._assert_model_capacity(all_rows)
        family_banks = self._fit_family_banks(custom_rows)
        fallback = self._current_bank()[0]["calibration"]
        unified = build_bank(
            self._fitted_rows(custom_rows),
            fallback_calibration=fallback,
        )
        validate_bank(unified)
        self._publish_generation(banks, custom_rows, unified, family_banks)
        return self.summary()

    def rebuild(self) -> dict:
        with self._writer_lock():
            return self._rebuild()

    @_cache_locked
    def _rebuild(self) -> dict:
        banks = dict(self._banks)
        custom_rows = {
            bank_id: list(rows)
            for bank_id, rows in self._custom_rows.items()
        }
        all_rows = self._all_rows(custom_rows)
        self._assert_model_ownership(all_rows)
        self._assert_model_capacity(all_rows)
        family_banks = self._fit_family_banks(custom_rows)
        fallback = self._current_bank()[0]["calibration"]
        unified = build_bank(
            self._fitted_rows(custom_rows),
            fallback_calibration=fallback,
        )
        validate_bank(unified)
        self._publish_generation(banks, custom_rows, unified, family_banks)
        return self.summary()

    @_cache_locked
    def summary(self) -> dict:
        if not self._write_uncertain:
            self._refresh_committed()
        bank, revision = self._current_bank()
        families = [
            {
                "id": family_id,
                "label": family_name,
                "builtin": True,
                "active": True,
                "row_count": sum(
                    row["family_id"] == family_id
                    for row in self._get_builtin_rows()
                ),
            }
            for family_id, family_name, _ in BUILTIN_REFERENCES
        ]
        families.extend(
            {
                "id": bank_id,
                "label": label,
                "builtin": False,
                "active": self._family_is_fit_ready(
                    self._custom_rows[bank_id]
                ),
                "row_count": len(self._custom_rows[bank_id]),
            }
            for bank_id, label in self._banks.items()
        )
        models = [
            {
                "id": model["id"],
                "family": model["family"],
                "family_name": model["family_name"],
                "response_count": model["response_count"],
                "valid_number_count": model["valid_number_count"],
            }
            for model in bank["models"]
        ]
        return {
            "generation": self._committed_generation,
            "revision": revision,
            "model_count": len(models),
            "family_count": len(families),
            "reference_count": sum(
                family["row_count"] for family in families
            ),
            "models": models,
            "families": families,
        }

    @_cache_locked
    def _get_builtin_rows(self) -> list[dict]:
        if self._builtin_rows is None:
            self._builtin_rows = _load_builtin_rows()
        return self._builtin_rows

    def _all_rows(
        self,
        custom_rows: dict[str, list[dict]] | None = None,
    ) -> list[dict]:
        rows = list(self._get_builtin_rows())
        selected = self._custom_rows if custom_rows is None else custom_rows
        for bank_rows in selected.values():
            rows.extend(bank_rows)
        return rows

    def _fitted_rows(
        self,
        custom_rows: dict[str, list[dict]],
    ) -> list[dict]:
        rows = list(self._get_builtin_rows())
        for family_rows in custom_rows.values():
            if self._family_is_fit_ready(family_rows):
                rows.extend(family_rows)
        return rows

    @staticmethod
    def _family_is_fit_ready(rows: list[dict]) -> bool:
        challenges_by_source: dict[str, set[str]] = {}
        for row in rows:
            challenges_by_source.setdefault(row["source"], set()).add(
                row["challenge_id"]
            )
        return bool(challenges_by_source) and all(
            len(challenges) >= 4
            for challenges in challenges_by_source.values()
        )

    @staticmethod
    def _assert_model_ownership(rows: list[dict]) -> None:
        owners = {}
        for row in rows:
            source = row["source"]
            family_id = row["family_id"]
            previous = owners.setdefault(source, family_id)
            if previous != family_id:
                raise ValueError(
                    f"model label {source!r} appears in a different family"
                )

    @staticmethod
    def _assert_model_capacity(rows: list[dict]) -> None:
        if len({row["source"] for row in rows}) > _MAX_MODELS:
            raise ValueError(
                f"at most {_MAX_MODELS} distinct models are supported"
            )

    @staticmethod
    def _assert_bank_model_membership(
        bank: dict,
        expected_models: dict[str, tuple[str, str]],
        *,
        artifact: str,
    ) -> None:
        actual_models = {
            model["id"]: (model["family"], model["family_name"])
            for model in bank["models"]
        }
        if actual_models != expected_models:
            raise ValueError(f"committed {artifact} model membership mismatch")

    @staticmethod
    def _validate_bank_id(bank_id, *, allow_reserved: bool) -> None:
        if type(bank_id) is not str or _BANK_ID_PATTERN.fullmatch(bank_id) is None:
            raise ValueError(
                "bank_id must match ^[a-z0-9][a-z0-9-]{0,63}$"
            )
        if not allow_reserved and bank_id in _RESERVED_BANK_IDS:
            raise ValueError(f"bank_id {bank_id!r} is reserved")

    @staticmethod
    def _validate_label(label) -> None:
        lowered = label.casefold() if type(label) is str else ""
        if (
            type(label) is not str
            or not label.strip()
            or len(label) > 256
            or any(ord(character) < 32 or ord(character) == 127 for character in label)
            or "://" in lowered
            or _SENSITIVE_LABEL_PATTERN.search(label) is not None
        ):
            raise ValueError("bank label must be a safe non-empty string")

    def _fit_family_banks(
        self,
        custom_rows: dict[str, list[dict]],
    ) -> dict[str, dict]:
        fitted = {}
        for family_id, family_name, _ in BUILTIN_REFERENCES:
            path = VENDOR_DATA / f"{family_id}_bank.json"
            bank = json.loads(path.read_bytes())
            for model in bank["models"]:
                model["family"] = family_id
                model["family_name"] = family_name
            validate_bank(bank)
            fitted[family_id] = bank
        for bank_id, rows in custom_rows.items():
            if not self._family_is_fit_ready(rows):
                continue
            previous = self._family_calibration.get(bank_id, {})
            # Retain only same-family temperature, never stale CV measurements.
            fallback = {
                key: {
                    "beta": previous.get(key, {}).get("beta", 1.0),
                    "cv_accuracy": 0.0,
                    "cv_correct": 0,
                    "cv_samples": 0,
                    "cv_nll": None,
                    "fallback": True,
                }
                for key in ("1", "2", "3")
            }
            bank = build_bank(rows, fallback_calibration=fallback)
            validate_bank(bank)
            fitted[bank_id] = bank
        return fitted

    @staticmethod
    def _directory_open_flags() -> int:
        flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0)
        flags |= getattr(os, "O_DIRECTORY", 0)
        flags |= getattr(os, "O_NOFOLLOW", 0)
        return flags

    @classmethod
    def _open_root(cls, root) -> tuple[Path, int]:
        try:
            absolute = Path(os.path.abspath(os.fspath(root)))
        except (OSError, TypeError, ValueError) as error:
            raise ValueError("invalid bank store root") from error
        parts = absolute.parts
        if not parts or parts[0] != os.sep:
            raise ValueError("invalid bank store root")

        descriptor = None
        try:
            descriptor = os.open(os.sep, cls._directory_open_flags())
            for component in parts[1:]:
                child = None
                try:
                    try:
                        child = os.open(
                            component,
                            cls._directory_open_flags(),
                            dir_fd=descriptor,
                        )
                    except FileNotFoundError:
                        try:
                            os.mkdir(component, mode=0o700, dir_fd=descriptor)
                        except FileExistsError:
                            pass
                        child = os.open(
                            component,
                            cls._directory_open_flags(),
                            dir_fd=descriptor,
                        )
                    child_status = os.fstat(child)
                    if not stat.S_ISDIR(child_status.st_mode):
                        raise ValueError(
                            "bank store root components must be directories"
                        )
                    previous = descriptor
                    descriptor = child
                    child = None
                    os.close(previous)
                finally:
                    if child is not None:
                        os.close(child)
            return absolute, descriptor
        except ValueError:
            if descriptor is not None:
                os.close(descriptor)
            raise
        except OSError as error:
            if descriptor is not None:
                os.close(descriptor)
            raise ValueError("invalid bank store root") from error

    @classmethod
    def _open_directory(
        cls,
        parent_descriptor: int,
        name: str,
        *,
        create: bool = False,
    ) -> int:
        if create:
            try:
                os.mkdir(name, mode=0o700, dir_fd=parent_descriptor)
            except FileExistsError:
                pass
            except OSError as error:
                raise ValueError("could not create bank store directory") from error
        descriptor = None
        try:
            descriptor = os.open(
                name,
                cls._directory_open_flags(),
                dir_fd=parent_descriptor,
            )
            status = os.fstat(descriptor)
            if not stat.S_ISDIR(status.st_mode):
                raise ValueError("bank store directory is unsafe")
            return descriptor
        except ValueError:
            if descriptor is not None:
                os.close(descriptor)
            raise
        except OSError as error:
            if descriptor is not None:
                os.close(descriptor)
            raise ValueError("bank store directory is unsafe") from error

    @_cache_locked
    def _publish_generation(
        self,
        banks: dict[str, str],
        custom_rows: dict[str, list[dict]],
        unified: dict,
        family_banks: dict[str, dict],
    ) -> None:
        generation = f"generation-{uuid.uuid4().hex}"
        all_rows = self._all_rows(custom_rows)
        if len(all_rows) > _MAX_REFERENCES:
            raise ValueError(
                f"at most {_MAX_REFERENCES} numeric references are supported"
            )
        state = {
            "banks": [
                {"id": bank_id, "label": label}
                for bank_id, label in banks.items()
            ]
        }
        artifacts = {
            "bank.json": _json_bytes(unified),
            "references.jsonl": _jsonl_bytes(all_rows),
            "state.json": _json_bytes(state),
        }
        for family_id, bank in family_banks.items():
            artifacts[f"families/{family_id}.json"] = _json_bytes(bank)
        entries = {
            relative: {
                "path": f"generations/{generation}/{relative}",
                "sha256": hashlib.sha256(content).hexdigest(),
            }
            for relative, content in artifacts.items()
        }
        manifest = {
            "schema_version": 1,
            "generation": generation,
            "bank": entries["bank.json"],
            "references": entries["references.jsonl"],
            "state": entries["state.json"],
            "families": {
                family_id: entries[f"families/{family_id}.json"]
                for family_id in family_banks
            },
        }
        manifest_bytes = _json_bytes(manifest)
        maximums = {
            "bank.json": _MAX_BANK_BYTES,
            "references.jsonl": numeric_rows.MAX_FILE_BYTES,
            "state.json": _MAX_STATE_BYTES,
        }
        for relative in artifacts:
            if relative.startswith("families/"):
                maximums[relative] = _MAX_BANK_BYTES
        for relative, content in artifacts.items():
            if len(content) > maximums[relative]:
                raise ValueError(
                    f"generation artifact {relative} is too large"
                )
        if len(manifest_bytes) > _MAX_MANIFEST_BYTES:
            raise ValueError("current manifest is too large")

        generations_descriptor = None
        temporary_descriptor = None
        family_descriptor = None
        temporary_name = f".tmp-{generation}"
        body_failed = False
        commit_sequence = self._commit_sequence
        try:
            generations_descriptor = self._open_directory(
                self._root_fd,
                "generations",
                create=True,
            )
            try:
                os.mkdir(
                    temporary_name,
                    mode=0o700,
                    dir_fd=generations_descriptor,
                )
            except OSError as error:
                raise ValueError(
                    "could not create temporary bank generation"
                ) from error
            temporary_descriptor = self._open_directory(
                generations_descriptor,
                temporary_name,
            )
            try:
                os.mkdir(
                    "families",
                    mode=0o700,
                    dir_fd=temporary_descriptor,
                )
            except OSError as error:
                raise ValueError(
                    "could not create family artifact directory"
                ) from error
            family_descriptor = self._open_directory(
                temporary_descriptor,
                "families",
            )

            entries = {}
            for relative, content in artifacts.items():
                if relative.startswith("families/"):
                    parent_descriptor = family_descriptor
                    name = relative.removeprefix("families/")
                else:
                    parent_descriptor = temporary_descriptor
                    name = relative
                self._write_file(parent_descriptor, name, content)

            os.fchmod(family_descriptor, 0o500)
            self._fsync_directory(family_descriptor)
            os.fchmod(temporary_descriptor, 0o500)
            self._fsync_directory(temporary_descriptor)
            os.rename(
                temporary_name,
                generation,
                src_dir_fd=generations_descriptor,
                dst_dir_fd=generations_descriptor,
            )
            self._fsync_directory(generations_descriptor)

            manifest_temporary = f".current-{uuid.uuid4().hex}.tmp"
            self._write_file(
                self._root_fd,
                manifest_temporary,
                manifest_bytes,
            )
            os.replace(
                manifest_temporary,
                "current.json",
                src_dir_fd=self._root_fd,
                dst_dir_fd=self._root_fd,
            )
            self._commit_sequence += 1
            try:
                self._fsync_directory(self._root_fd)
            except OSError:
                self._write_uncertain = True
                raise RuntimeError(_UNCERTAIN_COMMIT_MESSAGE) from None
        except BaseException:
            body_failed = True
            raise
        finally:
            descriptors = [
                generations_descriptor,
                temporary_descriptor,
                family_descriptor,
            ]
            family_descriptor = temporary_descriptor = generations_descriptor = None
            cleanup_error = None
            while descriptors:
                # Consume ownership before close, even if close raises after release.
                descriptor = descriptors.pop()
                if descriptor is not None:
                    try:
                        os.close(descriptor)
                    except BaseException as error:
                        if not body_failed and cleanup_error is None:
                            cleanup_error = error
            if cleanup_error is not None:
                message = (
                    _UNCERTAIN_COMMIT_MESSAGE
                    if self._commit_sequence != commit_sequence
                    else "bank store publication cleanup failed"
                )
                raise RuntimeError(message) from None

    @staticmethod
    def _write_file(
        directory_descriptor: int,
        name: str,
        content: bytes,
    ) -> None:
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        flags |= getattr(os, "O_CLOEXEC", 0)
        flags |= getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(
            name,
            flags,
            0o600,
            dir_fd=directory_descriptor,
        )
        try:
            view = memoryview(content)
            while view:
                written = os.write(descriptor, view)
                if written <= 0:
                    raise OSError("short write while publishing bank generation")
                view = view[written:]
            os.fchmod(descriptor, 0o400)
            os.fsync(descriptor)
        finally:
            os.close(descriptor)

    @staticmethod
    def _fsync_directory(descriptor: int) -> None:
        os.fsync(descriptor)

    @contextmanager
    def _writer_lock(self):
        if self._write_uncertain:
            raise RuntimeError(_UNCERTAIN_COMMIT_MESSAGE)
        key = f"{self._root_identity[0]}:{self._root_identity[1]}"
        with _THREAD_LOCKS_GUARD:
            thread_lock = _THREAD_LOCKS.setdefault(key, threading.Lock())
        if not thread_lock.acquire(blocking=False):
            raise RuntimeError("bank store is busy")
        descriptor = None
        locked = False
        body_failed = False
        commit_sequence = self._commit_sequence
        try:
            if self._write_uncertain:
                raise RuntimeError(_UNCERTAIN_COMMIT_MESSAGE)
            flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_CLOEXEC", 0)
            flags |= getattr(os, "O_NOFOLLOW", 0)
            try:
                descriptor = os.open(
                    "writer.lock",
                    flags,
                    0o600,
                    dir_fd=self._root_fd,
                )
            except OSError as error:
                raise ValueError("bank store writer lock is unsafe") from error
            if not stat.S_ISREG(os.fstat(descriptor).st_mode):
                raise ValueError("bank store writer lock is unsafe")
            try:
                fcntl.flock(
                    descriptor,
                    fcntl.LOCK_EX | fcntl.LOCK_NB,
                )
            except BlockingIOError as error:
                raise RuntimeError("bank store is busy") from error
            locked = True
            # Try the global writer first so a competing writer never waits here.
            with self._cache_lock:
                if self._write_uncertain:
                    raise RuntimeError(_UNCERTAIN_COMMIT_MESSAGE)
                self._refresh_committed()
                yield
        except BaseException:
            body_failed = True
            raise
        finally:
            cleanup_failed = False
            try:
                if locked:
                    fcntl.flock(descriptor, fcntl.LOCK_UN)
            except BaseException:
                cleanup_failed = True
            finally:
                try:
                    if descriptor is not None:
                        os.close(descriptor)
                except BaseException:
                    cleanup_failed = True
                finally:
                    with self._cache_lock:
                        switched = self._commit_sequence != commit_sequence
                        if switched and (cleanup_failed or body_failed):
                            self._write_uncertain = True
                        try:
                            thread_lock.release()
                        except BaseException:
                            cleanup_failed = True
                            if switched:
                                self._write_uncertain = True
                        if cleanup_failed and not body_failed:
                            message = (
                                _UNCERTAIN_COMMIT_MESSAGE if switched
                                else "bank store writer cleanup failed"
                            )
                            raise RuntimeError(message) from None

    @_cache_locked
    def _current_bank(self) -> tuple[dict, str]:
        if self._committed_bank is not None:
            return self._committed_bank, self._committed_revision
        path = VENDOR_DATA / "unified_bank.json"
        bank_bytes = path.read_bytes()
        bank = json.loads(bank_bytes)
        validate_bank(bank)
        self._committed_bank = bank
        self._committed_revision = hashlib.sha256(bank_bytes).hexdigest()
        self._committed_generation = "builtin"
        return self._committed_bank, self._committed_revision

    @_cache_locked
    def _refresh_committed(self) -> None:
        if not self._entry_exists(self._root_fd, "current.json"):
            if self._committed_bank is None:
                self._current_bank()
            return
        manifest = self._load_manifest()
        state_bytes = self._read_artifact(
            manifest,
            manifest["state"],
            maximum=_MAX_STATE_BYTES,
        )
        try:
            state = json.loads(state_bytes, parse_constant=self._reject_constant)
        except (json.JSONDecodeError, ValueError) as error:
            raise ValueError("invalid committed bank state") from error
        if type(state) is not dict or set(state) != {"banks"}:
            raise ValueError("invalid committed bank state")
        if type(state["banks"]) is not list or len(state["banks"]) > 30:
            raise ValueError("invalid committed bank registry")
        banks = {}
        for item in state["banks"]:
            if type(item) is not dict or set(item) != {"id", "label"}:
                raise ValueError("invalid committed bank registry")
            bank_id = item["id"]
            self._validate_bank_id(bank_id, allow_reserved=False)
            label = item["label"]
            self._validate_label(label)
            if bank_id in banks:
                raise ValueError("duplicate committed bank ID")
            banks[bank_id] = label

        references_entry = manifest["references"]
        references_bytes = self._read_artifact(
            manifest,
            references_entry,
            maximum=numeric_rows.MAX_FILE_BYTES,
        )
        rows = _parse_numeric_rows(references_bytes)
        custom_rows = {bank_id: [] for bank_id in banks}
        builtin_ids = {
            family_id for family_id, _, _ in BUILTIN_REFERENCES
        }
        for row in rows:
            family_id = row.get("family_id")
            if family_id in builtin_ids:
                continue
            if family_id not in banks:
                raise ValueError("committed reference has an unknown family")
            if row.get("family_name") != banks[family_id]:
                raise ValueError("committed reference family label mismatch")
            if not row["strict_valid"]:
                raise ValueError("committed custom references must be strict-valid")
            custom_rows[family_id].append(row)
        all_rows = self._all_rows(custom_rows)
        if len(all_rows) > _MAX_REFERENCES:
            raise ValueError(
                f"at most {_MAX_REFERENCES} numeric references are supported"
            )
        self._assert_model_ownership(all_rows)
        self._assert_model_capacity(all_rows)

        expected_models = {
            row["source"]: (row["family_id"], row["family_name"])
            for row in self._fitted_rows(custom_rows)
        }
        expected_families = builtin_ids | {
            bank_id
            for bank_id, values in custom_rows.items()
            if self._family_is_fit_ready(values)
        }
        if set(manifest["families"]) != expected_families:
            raise ValueError("committed family artifacts are incomplete")
        family_calibration = {}
        for family_id, entry in manifest["families"].items():
            content = self._read_artifact(
                manifest,
                entry,
                maximum=_MAX_BANK_BYTES,
            )
            try:
                family_bank = json.loads(
                    content,
                    parse_constant=self._reject_constant,
                )
            except (json.JSONDecodeError, ValueError) as error:
                raise ValueError("invalid committed family bank") from error
            validate_bank(family_bank)
            self._assert_bank_model_membership(
                family_bank,
                {
                    source: owner
                    for source, owner in expected_models.items()
                    if owner[0] == family_id
                },
                artifact="family",
            )
            family_calibration[family_id] = family_bank["calibration"]

        bank_bytes = self._read_artifact(
            manifest,
            manifest["bank"],
            maximum=_MAX_BANK_BYTES,
        )
        try:
            bank = json.loads(
                bank_bytes,
                parse_constant=self._reject_constant,
            )
        except (json.JSONDecodeError, ValueError) as error:
            raise ValueError("invalid committed unified bank") from error
        validate_bank(bank)
        self._assert_bank_model_membership(
            bank, expected_models, artifact="unified"
        )
        self._banks = banks
        self._custom_rows = custom_rows
        self._family_calibration = family_calibration
        self._committed_bank = bank
        self._committed_revision = hashlib.sha256(bank_bytes).hexdigest()
        self._committed_generation = manifest["generation"]

    def _load_manifest(self) -> dict:
        data = self._read_regular_file(
            self._root_fd,
            "current.json",
            maximum=_MAX_MANIFEST_BYTES,
        )
        try:
            manifest = json.loads(
                data,
                parse_constant=self._reject_constant,
            )
        except (json.JSONDecodeError, ValueError) as error:
            raise ValueError("invalid current manifest") from error
        required = {
            "schema_version",
            "generation",
            "bank",
            "references",
            "state",
            "families",
        }
        if type(manifest) is not dict or set(manifest) != required:
            raise ValueError("invalid current manifest")
        generation = manifest["generation"]
        if (
            manifest["schema_version"] != 1
            or type(generation) is not str
            or re.fullmatch(r"generation-[0-9a-f]{32}", generation) is None
            or type(manifest["families"]) is not dict
        ):
            raise ValueError("invalid current manifest")
        return manifest

    def _read_artifact(
        self,
        manifest: dict,
        entry,
        *,
        maximum: int,
    ) -> bytes:
        if type(entry) is not dict or set(entry) != {"path", "sha256"}:
            raise ValueError("invalid current manifest artifact")
        relative = entry["path"]
        digest = entry["sha256"]
        if type(relative) is not str or type(digest) is not str:
            raise ValueError("invalid current manifest artifact")
        parts = Path(relative).parts
        if (
            len(parts) < 3
            or parts[0] != "generations"
            or parts[1] != manifest["generation"]
            or Path(relative).is_absolute()
            or relative != "/".join(parts)
            or any(part in ("", ".", "..") for part in parts)
            or re.fullmatch(r"[0-9a-f]{64}", digest) is None
        ):
            raise ValueError("invalid current manifest artifact path")
        directory_descriptor = os.dup(self._root_fd)
        try:
            for part in parts[:-1]:
                child_descriptor = self._open_directory(
                    directory_descriptor,
                    part,
                )
                os.close(directory_descriptor)
                directory_descriptor = child_descriptor
            data = self._read_regular_file(
                directory_descriptor,
                parts[-1],
                maximum=maximum,
            )
        finally:
            os.close(directory_descriptor)
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError("committed artifact checksum mismatch")
        return data

    @staticmethod
    def _reject_constant(value: str):
        raise ValueError(f"non-finite JSON constant {value!r}")

    @staticmethod
    def _entry_exists(directory_descriptor: int, name: str) -> bool:
        try:
            os.stat(
                name,
                dir_fd=directory_descriptor,
                follow_symlinks=False,
            )
            return True
        except FileNotFoundError:
            return False
        except OSError as error:
            raise ValueError("could not inspect bank store path") from error

    @staticmethod
    def _read_regular_file(
        directory_descriptor: int,
        name: str,
        *,
        maximum: int,
    ) -> bytes:
        if (
            type(name) is not str
            or name in ("", ".", "..")
            or os.sep in name
            or (os.altsep is not None and os.altsep in name)
        ):
            raise ValueError("committed artifact path is unsafe")
        flags = os.O_RDONLY | os.O_NONBLOCK | getattr(os, "O_CLOEXEC", 0)
        flags |= getattr(os, "O_NOFOLLOW", 0)
        try:
            descriptor = os.open(
                name,
                flags,
                dir_fd=directory_descriptor,
            )
        except OSError as error:
            raise ValueError("committed artifact is not a safe file") from error
        try:
            before = os.fstat(descriptor)
            if not stat.S_ISREG(before.st_mode):
                raise ValueError("committed artifact must be a regular file")
            if before.st_size > maximum:
                raise ValueError("committed artifact is too large")
            chunks = []
            remaining = before.st_size + 1
            while remaining:
                chunk = os.read(descriptor, min(remaining, 64 * 1024))
                if not chunk:
                    break
                chunks.append(chunk)
                remaining -= len(chunk)
            after = os.fstat(descriptor)
        except OSError as error:
            raise ValueError("could not read committed artifact") from error
        finally:
            os.close(descriptor)
        data = b"".join(chunks)
        snapshot = (
            before.st_dev,
            before.st_ino,
            before.st_size,
            before.st_mtime_ns,
            before.st_ctime_ns,
        )
        current = (
            after.st_dev,
            after.st_ino,
            after.st_size,
            after.st_mtime_ns,
            after.st_ctime_ns,
        )
        if snapshot != current or len(data) != before.st_size:
            raise ValueError("committed artifact changed while being read")
        return data
