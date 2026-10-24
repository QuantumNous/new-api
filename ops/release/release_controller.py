#!/usr/bin/env python3
"""Fail-closed packaging, validation, preflight, and deployment-lock tooling.

This module intentionally contains no production transport or deployment code.  It
only creates and verifies an exact Git release package and provides a local,
atomic lease file that a separately authorized adapter may hold while deploying.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid
from typing import Any, Iterable, Protocol, Sequence


SCHEMA_VERSION = 1
MANIFEST_NAME = "release-manifest.json"
SOURCE_ARCHIVE_NAME = "source.tar.gz"
BUNDLE_NAME = "source.bundle"
REGISTRY_RECEIPT_NAME = "registry-receipt.json"
REGISTRY_SCHEMA_VERSION = 1
HEX40 = re.compile(r"^[0-9a-f]{40}$")
IMAGE_DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
LOCK_SCHEMA_VERSION = 1


class ReleaseError(RuntimeError):
    """An expected, fail-closed release gate error."""


class DeploymentAdapter(Protocol):
    """Interface for a separately authorized production deployment adapter.

    Implementations are intentionally outside this package.  The interface
    carries no address, credential, transport, or deployment command.
    """

    def deploy(self, package_dir: Path, manifest: dict[str, Any]) -> None:
        ...

    def rollback(self, package_dir: Path, manifest: dict[str, Any]) -> None:
        ...

    def post_release_validate(self, manifest: dict[str, Any]) -> None:
        ...


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _timestamp(value: dt.datetime | None = None) -> str:
    current = value or _utc_now()
    return current.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_timestamp(value: Any, field: str) -> dt.datetime:
    if not isinstance(value, str) or not value:
        raise ReleaseError(f"{field} must be an ISO-8601 timestamp")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ReleaseError(f"{field} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ReleaseError(f"{field} must include a timezone")
    return parsed.astimezone(dt.timezone.utc)


def _run(
    command: Sequence[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
    input_data: bytes | None = None,
) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        list(command),
        cwd=str(cwd) if cwd else None,
        input=input_data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace").strip()
        detail = f": {stderr}" if stderr else ""
        raise ReleaseError(f"command failed ({' '.join(command)}), exit {result.returncode}{detail}")
    return result


def _git(repo: Path, args: Sequence[str], *, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return _run(["git", "-C", str(repo), *args], check=check)


def _git_text(repo: Path, args: Sequence[str], *, check: bool = True) -> str:
    result = _git(repo, args, check=check)
    return result.stdout.decode("utf-8", errors="replace").strip()


def _repo_path(raw: str | os.PathLike[str]) -> Path:
    repo = Path(raw).expanduser().resolve()
    if not repo.is_dir():
        raise ReleaseError(f"repository is not a directory: {repo}")
    _git_text(repo, ["rev-parse", "--show-toplevel"])
    return repo


def _require_hex40(value: Any, field: str) -> str:
    if not isinstance(value, str) or not HEX40.fullmatch(value):
        raise ReleaseError(f"{field} must be a full 40-character lowercase commit hash")
    return value


def _require_digest(value: Any, field: str) -> str:
    if not isinstance(value, str) or not IMAGE_DIGEST.fullmatch(value):
        raise ReleaseError(f"{field} must be a sha256:<64 lowercase hex> image digest")
    return value


def _resolve_commit(repo: Path, ref: str, field: str) -> str:
    if not isinstance(ref, str) or not ref:
        raise ReleaseError(f"{field} is required")
    result = _git(repo, ["rev-parse", "--verify", f"{ref}^{{commit}}"], check=False)
    if result.returncode != 0:
        raise ReleaseError(f"{field} does not resolve to a commit: {ref}")
    return _require_hex40(result.stdout.decode("ascii", errors="replace").strip(), field)


def _commit_tree(repo: Path, commit: str, field: str = "commit tree") -> str:
    return _require_hex40(
        _git_text(repo, ["rev-parse", "--verify", f"{commit}^{{tree}}"]),
        field,
    )


def _commit_parents(repo: Path, commit: str) -> list[str]:
    parents = _git_text(repo, ["show", "-s", "--format=%P", commit])
    if not parents:
        return []
    return [_require_hex40(parent, "commit parent") for parent in parents.split()]


def _head(repo: Path) -> str:
    return _resolve_commit(repo, "HEAD", "HEAD")


def _is_ancestor(repo: Path, ancestor: str, descendant: str) -> bool:
    result = _git(repo, ["merge-base", "--is-ancestor", ancestor, descendant], check=False)
    if result.returncode == 0:
        return True
    if result.returncode == 1:
        return False
    stderr = result.stderr.decode("utf-8", errors="replace").strip()
    raise ReleaseError(f"could not check commit ancestry: {stderr or 'git merge-base failed'}")


def _ensure_clean_checkout(repo: Path) -> None:
    status = _git_text(repo, ["status", "--porcelain=v1", "--untracked-files=all"])
    if status:
        raise ReleaseError("working tree is not clean; exact release packaging requires a clean checkout")


def _ensure_digest_args(expected_commit: str, expected_tree: str, image_digest: str) -> tuple[str, str, str]:
    return (
        _require_hex40(expected_commit, "expected production commit"),
        _require_hex40(expected_tree, "expected production tree"),
        _require_digest(image_digest, "expected production image digest"),
    )


def _sha256(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _safe_tar_member_name(value: str, field: str) -> str:
    path = Path(value)
    if not value or path.is_absolute() or any(part in ("", "..") for part in path.parts):
        raise ReleaseError(f"OCI image tar contains unsafe {field}: {value!r}")
    return value


def _tar_json(members: dict[str, tarfile.TarInfo], stream: tarfile.TarFile, name: str, field: str) -> Any:
    member = members.get(_safe_tar_member_name(name, field))
    if member is None or not member.isfile():
        raise ReleaseError(f"OCI image tar is missing {field}: {name}")
    handle = stream.extractfile(member)
    if handle is None:
        raise ReleaseError(f"OCI image tar cannot read {field}: {name}")
    try:
        return json.loads(handle.read())
    except json.JSONDecodeError as exc:
        raise ReleaseError(f"OCI image tar has invalid JSON in {field}: {name}") from exc


def _tar_digest(members: dict[str, tarfile.TarInfo], stream: tarfile.TarFile, name: str, field: str) -> str:
    member = members.get(_safe_tar_member_name(name, field))
    if member is None or not member.isfile():
        raise ReleaseError(f"OCI image tar is missing {field}: {name}")
    handle = stream.extractfile(member)
    if handle is None:
        raise ReleaseError(f"OCI image tar cannot read {field}: {name}")
    digest = hashlib.sha256()
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
        digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def verify_oci_image_tar(
    image_tar: Path,
    expected_tar_sha256: str,
    expected_manifest_digest: str,
    expected_config_digest: str,
    expected_revision: str,
    expected_platform: str,
    expected_repo_tag: str,
) -> None:
    """Verify a portable OCI/Docker image tar without relying on Docker's ID display.

    Docker commonly reports a config digest as `.Id`; OCI registries identify an
    image by its manifest digest.  Both are verified, alongside the config's
    revision/platform and every referenced layer, so a same-revision image
    cannot silently replace the authorized binary.
    """

    image_tar = image_tar.expanduser().resolve()
    if not image_tar.is_file():
        raise ReleaseError(f"OCI image tar does not exist: {image_tar}")
    if not re.fullmatch(r"[0-9a-f]{64}", expected_tar_sha256):
        raise ReleaseError("expected image tar SHA-256 must be 64 lowercase hex characters")
    manifest_digest = _require_digest(expected_manifest_digest, "expected OCI manifest digest")
    config_digest = _require_digest(expected_config_digest, "expected OCI config digest")
    revision = _require_hex40(expected_revision, "expected OCI revision")
    if expected_platform != "linux/amd64":
        raise ReleaseError("expected OCI platform must be linux/amd64")
    if not expected_repo_tag or "@" in expected_repo_tag or expected_repo_tag.startswith("/"):
        raise ReleaseError("expected OCI repo tag must be a non-empty image tag")
    actual_tar_sha256, _ = _sha256(image_tar)
    if actual_tar_sha256 != expected_tar_sha256:
        raise ReleaseError("OCI image tar SHA-256 mismatch")
    try:
        with tarfile.open(image_tar, mode="r:") as stream:
            members = {member.name: member for member in stream.getmembers()}
            if len(members) != len(stream.getmembers()):
                raise ReleaseError("OCI image tar contains duplicate member names")
            index = _tar_json(members, stream, "index.json", "OCI index")
            docker_manifest = _tar_json(members, stream, "manifest.json", "Docker manifest")
            if not isinstance(index, dict) or not isinstance(index.get("manifests"), list):
                raise ReleaseError("OCI image index must contain a manifests list")
            selected = [entry for entry in index["manifests"] if isinstance(entry, dict) and entry.get("digest") == manifest_digest]
            if len(selected) != 1:
                raise ReleaseError("OCI image index does not bind exactly one expected manifest digest")
            manifest_name = "blobs/sha256/" + manifest_digest.removeprefix("sha256:")
            if _tar_digest(members, stream, manifest_name, "OCI manifest blob") != manifest_digest:
                raise ReleaseError("OCI manifest blob digest mismatch")
            manifest = _tar_json(members, stream, manifest_name, "OCI manifest blob")
            if not isinstance(manifest, dict) or not isinstance(manifest.get("config"), dict):
                raise ReleaseError("OCI manifest must contain a config object")
            if manifest["config"].get("digest") != config_digest:
                raise ReleaseError("OCI manifest config digest mismatch")
            config_name = "blobs/sha256/" + config_digest.removeprefix("sha256:")
            if _tar_digest(members, stream, config_name, "OCI config blob") != config_digest:
                raise ReleaseError("OCI config blob digest mismatch")
            config = _tar_json(members, stream, config_name, "OCI config blob")
            if not isinstance(config, dict):
                raise ReleaseError("OCI config must be a JSON object")
            labels = config.get("config", {}).get("Labels", {})
            if not isinstance(labels, dict) or labels.get("org.opencontainers.image.revision") != revision:
                raise ReleaseError("OCI config revision mismatch")
            if f"{config.get('os')}/{config.get('architecture')}" != expected_platform:
                raise ReleaseError("OCI config platform mismatch")
            layers = manifest.get("layers")
            if not isinstance(layers, list) or not layers:
                raise ReleaseError("OCI manifest must contain a non-empty layers list")
            manifest_layers: list[str] = []
            for layer in layers:
                if not isinstance(layer, dict):
                    raise ReleaseError("OCI manifest layer must be an object")
                digest = _require_digest(layer.get("digest"), "OCI layer digest")
                layer_name = "blobs/sha256/" + digest.removeprefix("sha256:")
                if _tar_digest(members, stream, layer_name, "OCI layer blob") != digest:
                    raise ReleaseError("OCI layer blob digest mismatch")
                manifest_layers.append(digest)
            if not isinstance(docker_manifest, list) or len(docker_manifest) != 1 or not isinstance(docker_manifest[0], dict):
                raise ReleaseError("Docker manifest must contain exactly one image entry")
            docker_entry = docker_manifest[0]
            if docker_entry.get("Config") != config_name:
                raise ReleaseError("Docker manifest config path mismatch")
            if docker_entry.get("Layers") != ["blobs/sha256/" + digest.removeprefix("sha256:") for digest in manifest_layers]:
                raise ReleaseError("Docker manifest layer list mismatch")
            if docker_entry.get("RepoTags") != [expected_repo_tag]:
                raise ReleaseError("Docker manifest repo tag mismatch")
    except (OSError, tarfile.TarError) as exc:
        raise ReleaseError(f"OCI image tar is unreadable: {image_tar.name}") from exc


def _write_source_archive(repo: Path, commit: str, destination: Path) -> None:
    """Write a deterministic gzip-wrapped `git archive` for the candidate."""

    process = subprocess.Popen(
        ["git", "-C", str(repo), "archive", "--format=tar", "--prefix=source/", commit],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert process.stdout is not None
    assert process.stderr is not None
    try:
        with destination.open("xb") as raw_output:
            with gzip.GzipFile(fileobj=raw_output, mode="wb", mtime=0) as compressed:
                for chunk in iter(lambda: process.stdout.read(1024 * 1024), b""):
                    compressed.write(chunk)
        stderr = process.stderr.read().decode("utf-8", errors="replace").strip()
        return_code = process.wait()
    except BaseException:
        process.kill()
        process.wait()
        raise
    if return_code != 0:
        try:
            destination.unlink()
        except FileNotFoundError:
            pass
        raise ReleaseError(f"git archive failed: {stderr or 'unknown error'}")


def _write_bundle(repo: Path, commit: str, destination: Path) -> None:
    # `prepare` has already proved that commit is the checked-out HEAD.  Using
    # the symbolic ref makes Git advertise a head and includes the complete
    # reachable history; passing a bare object id can produce an empty bundle
    # on supported Git versions.
    _git(repo, ["bundle", "create", str(destination), "HEAD"])


def _artifact_record(path: Path, relative_path: str) -> dict[str, Any]:
    digest, size = _sha256(path)
    return {"path": relative_path, "sha256": digest, "size": size}


def _write_json_new(path: Path, value: dict[str, Any]) -> None:
    encoded = (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")
    with path.open("xb") as stream:
        stream.write(encoded)


def _new_output_directory(raw: str | os.PathLike[str]) -> Path:
    output = Path(raw).expanduser().resolve()
    if os.path.lexists(output):
        raise ReleaseError(f"output directory already exists; refusing to overwrite: {output}")
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.mkdir()
    except FileExistsError as exc:
        raise ReleaseError(f"output directory was created concurrently; refusing to overwrite: {output}") from exc
    return output


def prepare(
    repo: Path,
    output: Path,
    candidate_ref: str,
    expected_production_commit: str,
    expected_production_tree: str,
    expected_production_image_digest: str,
    release_id: str | None = None,
) -> Path:
    repo = _repo_path(repo)
    _ensure_clean_checkout(repo)
    candidate = _resolve_commit(repo, candidate_ref, "candidate commit")
    if candidate != _head(repo):
        raise ReleaseError("candidate commit is not the checked-out HEAD; refusing to package a different source")
    candidate_tree = _commit_tree(repo, candidate, "candidate tree")
    candidate_parents = _commit_parents(repo, candidate)
    expected_commit, expected_tree, image_digest = _ensure_digest_args(
        expected_production_commit,
        expected_production_tree,
        expected_production_image_digest,
    )
    resolved_expected = _resolve_commit(repo, expected_commit, "expected production commit")
    if resolved_expected != expected_commit:
        raise ReleaseError("expected production commit did not resolve exactly")
    if _commit_tree(repo, expected_commit, "expected production tree") != expected_tree:
        raise ReleaseError("expected production tree does not match expected production commit")
    if not _is_ancestor(repo, expected_commit, candidate):
        raise ReleaseError("expected production commit is not an ancestor of the candidate commit")

    output = _new_output_directory(output)
    source_archive = output / SOURCE_ARCHIVE_NAME
    bundle = output / BUNDLE_NAME
    _write_source_archive(repo, candidate, source_archive)
    _write_bundle(repo, candidate, bundle)
    _validate_bundle(repo, bundle, candidate)
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "release_id": release_id or f"aibuff-{candidate[:12]}-{_utc_now().strftime('%Y%m%dT%H%M%SZ')}",
        "created_at_utc": _timestamp(),
        "candidate_commit": candidate,
        "candidate_tree": candidate_tree,
        "candidate_parent": candidate_parents[0] if candidate_parents else None,
        "candidate_parents": candidate_parents,
        "expected_production_commit": expected_commit,
        "expected_production_tree": expected_tree,
        "expected_production_image_digest": image_digest,
        "source_archive_format": "tar.gz",
        "source_archive_prefix": "source/",
        "bundle_format": "git bundle",
        "bundle_head": candidate,
        "artifacts": {
            "source_archive": _artifact_record(source_archive, SOURCE_ARCHIVE_NAME),
            "git_bundle": _artifact_record(bundle, BUNDLE_NAME),
        },
    }
    _write_json_new(output / MANIFEST_NAME, manifest)
    return output / MANIFEST_NAME


def _load_json(path: Path, description: str) -> Any:
    try:
        with path.open("r", encoding="utf-8") as stream:
            return json.load(stream)
    except (OSError, json.JSONDecodeError) as exc:
        raise ReleaseError(f"cannot read {description}: {path}") from exc


def _required(mapping: dict[str, Any], key: str, description: str = "manifest") -> Any:
    if key not in mapping:
        raise ReleaseError(f"{description} is missing required field: {key}")
    return mapping[key]


def _safe_artifact_path(base: Path, raw: Any, field: str) -> Path:
    if not isinstance(raw, str) or not raw or Path(raw).is_absolute():
        raise ReleaseError(f"{field}.path must be a non-empty relative path")
    relative = Path(raw)
    if any(part == ".." for part in relative.parts):
        raise ReleaseError(f"{field}.path must not escape the package directory")
    resolved_base = base.resolve()
    resolved = (base / relative).resolve()
    try:
        resolved.relative_to(resolved_base)
    except ValueError as exc:
        raise ReleaseError(f"{field}.path must stay inside the package directory") from exc
    return resolved


def _check_artifact_hash(record: dict[str, Any], package_dir: Path, name: str) -> Path:
    raw_path = _required(record, "path", f"artifact {name}")
    artifact = _safe_artifact_path(package_dir, raw_path, f"artifact {name}")
    if not artifact.is_file():
        raise ReleaseError(f"artifact {name} is missing: {raw_path}")
    expected_hash = _required(record, "sha256", f"artifact {name}")
    if not isinstance(expected_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
        raise ReleaseError(f"artifact {name}.sha256 must be 64 lowercase hex characters")
    expected_size = _required(record, "size", f"artifact {name}")
    if not isinstance(expected_size, int) or isinstance(expected_size, bool) or expected_size < 0:
        raise ReleaseError(f"artifact {name}.size must be a non-negative integer")
    actual_hash, actual_size = _sha256(artifact)
    if actual_hash != expected_hash or actual_size != expected_size:
        raise ReleaseError(
            f"artifact {name} hash/size mismatch (expected {expected_hash}/{expected_size}, "
            f"observed {actual_hash}/{actual_size})"
        )
    return artifact


def _validate_archive_safety(archive: Path) -> None:
    try:
        with tarfile.open(archive, mode="r:gz") as stream:
            members = stream.getmembers()
    except (OSError, tarfile.TarError) as exc:
        raise ReleaseError(f"source archive is not a readable tar.gz: {archive.name}") from exc
    if not members:
        raise ReleaseError("source archive is empty")
    for member in members:
        for name, value in (("member", member.name), ("link", member.linkname)):
            if not value:
                continue
            candidate = Path(value)
            if candidate.is_absolute() or any(part == ".." for part in candidate.parts):
                raise ReleaseError(f"source archive contains unsafe {name} path: {value}")


def _validate_bundle(repo: Path, bundle: Path, candidate: str) -> None:
    _git(repo, ["bundle", "verify", str(bundle)])
    heads = _git_text(repo, ["bundle", "list-heads", str(bundle)])
    listed = {line.split()[0] for line in heads.splitlines() if line.split()}
    if candidate not in listed:
        raise ReleaseError("git bundle does not advertise the exact candidate commit")
    with tempfile.TemporaryDirectory(prefix="aibuff-release-bundle-") as temporary:
        clone = Path(temporary) / "clone"
        result = _run(["git", "clone", "--quiet", "--no-checkout", str(bundle), str(clone)], check=False)
        if result.returncode != 0:
            detail = result.stderr.decode("utf-8", errors="replace").strip()
            raise ReleaseError(f"git bundle could not be cloned for verification: {detail}")
        cloned_commit = _resolve_commit(clone, candidate, "bundle candidate")
        if cloned_commit != candidate:
            raise ReleaseError("git bundle clone resolved a different candidate commit")


def validate_manifest(manifest_path: Path, repo: Path) -> dict[str, Any]:
    manifest_path = manifest_path.expanduser().resolve()
    if not manifest_path.is_file():
        raise ReleaseError(f"manifest does not exist: {manifest_path}")
    package_dir = manifest_path.parent
    manifest = _load_json(manifest_path, "release manifest")
    if not isinstance(manifest, dict):
        raise ReleaseError("release manifest must be a JSON object")
    if _required(manifest, "schema_version") != SCHEMA_VERSION:
        raise ReleaseError("unsupported or missing release manifest schema_version")
    release_id = _required(manifest, "release_id")
    if not isinstance(release_id, str) or not release_id.strip():
        raise ReleaseError("release_id must be a non-empty string")
    _parse_timestamp(_required(manifest, "created_at_utc"), "created_at_utc")
    candidate = _require_hex40(_required(manifest, "candidate_commit"), "candidate_commit")
    candidate_tree = _require_hex40(_required(manifest, "candidate_tree"), "candidate_tree")
    raw_parents = _required(manifest, "candidate_parents")
    if not isinstance(raw_parents, list):
        raise ReleaseError("candidate_parents must be a list")
    candidate_parents = [_require_hex40(parent, "candidate parent") for parent in raw_parents]
    raw_parent = _required(manifest, "candidate_parent")
    if raw_parent is not None:
        _require_hex40(raw_parent, "candidate_parent")
    if raw_parent != (candidate_parents[0] if candidate_parents else None):
        raise ReleaseError("candidate_parent does not match candidate_parents")
    expected_commit = _require_hex40(
        _required(manifest, "expected_production_commit"), "expected_production_commit"
    )
    expected_tree = _require_hex40(
        _required(manifest, "expected_production_tree"), "expected_production_tree"
    )
    expected_digest = _require_digest(
        _required(manifest, "expected_production_image_digest"),
        "expected_production_image_digest",
    )
    artifacts = _required(manifest, "artifacts")
    if not isinstance(artifacts, dict):
        raise ReleaseError("artifacts must be a JSON object")
    archive_record = _required(artifacts, "source_archive", "artifacts")
    bundle_record = _required(artifacts, "git_bundle", "artifacts")
    if not isinstance(archive_record, dict) or not isinstance(bundle_record, dict):
        raise ReleaseError("source_archive and git_bundle artifact records must be objects")

    repo = _repo_path(repo)
    resolved_candidate = _resolve_commit(repo, candidate, "candidate_commit")
    if resolved_candidate != candidate:
        raise ReleaseError("candidate commit did not resolve exactly")
    actual_candidate_tree = _commit_tree(repo, candidate, "candidate tree")
    if actual_candidate_tree != candidate_tree:
        raise ReleaseError("candidate tree does not match candidate commit")
    if _commit_parents(repo, candidate) != candidate_parents:
        raise ReleaseError("candidate parent list does not match candidate commit")
    resolved_expected = _resolve_commit(repo, expected_commit, "expected_production_commit")
    if resolved_expected != expected_commit:
        raise ReleaseError("expected production commit did not resolve exactly")
    if _commit_tree(repo, expected_commit, "expected production tree") != expected_tree:
        raise ReleaseError("expected production tree does not match expected production commit")
    if not _is_ancestor(repo, expected_commit, candidate):
        raise ReleaseError("expected production commit is not an ancestor of candidate commit")

    archive = _check_artifact_hash(archive_record, package_dir, "source_archive")
    bundle = _check_artifact_hash(bundle_record, package_dir, "git_bundle")
    _validate_archive_safety(archive)
    with tempfile.TemporaryDirectory(prefix="aibuff-release-archive-") as temporary:
        expected_archive = Path(temporary) / SOURCE_ARCHIVE_NAME
        _write_source_archive(repo, candidate, expected_archive)
        expected_hash, expected_size = _sha256(expected_archive)
        actual_hash, actual_size = _sha256(archive)
        if (expected_hash, expected_size) != (actual_hash, actual_size):
            raise ReleaseError("source archive is incomplete or does not exactly match candidate commit")
    _validate_bundle(repo, bundle, candidate)
    return manifest


def _registry_destination(registry: Path, manifest: dict[str, Any]) -> Path:
    release_id = manifest["release_id"]
    if not isinstance(release_id, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,119}", release_id):
        raise ReleaseError("release_id is not safe for a registry directory name")
    destination = registry.expanduser().resolve() / release_id
    if os.path.lexists(destination):
        raise ReleaseError(f"candidate already exists in registry; refusing to overwrite: {destination}")
    return destination


def _copy_file_new(source: Path, destination: Path) -> None:
    try:
        with source.open("rb") as input_stream, destination.open("xb") as output_stream:
            shutil.copyfileobj(input_stream, output_stream, length=1024 * 1024)
    except BaseException:
        try:
            destination.unlink()
        except FileNotFoundError:
            pass
        raise


def stage_candidate(manifest_path: Path, repo: Path, registry: Path) -> Path:
    """Copy a fully validated package into an immutable cross-device registry."""

    manifest_path = manifest_path.expanduser().resolve()
    manifest = validate_manifest(manifest_path, repo)
    package_dir = manifest_path.parent
    archive_record = manifest["artifacts"]["source_archive"]
    bundle_record = manifest["artifacts"]["git_bundle"]
    archive = _safe_artifact_path(package_dir, archive_record["path"], "artifact source_archive")
    bundle = _safe_artifact_path(package_dir, bundle_record["path"], "artifact git_bundle")
    registry = registry.expanduser().resolve()
    registry.mkdir(parents=True, exist_ok=True)
    destination = _registry_destination(registry, manifest)
    try:
        destination.mkdir()
    except FileExistsError as exc:
        raise ReleaseError(f"candidate was registered concurrently; refusing to overwrite: {destination}") from exc
    try:
        staged_manifest = destination / MANIFEST_NAME
        _copy_file_new(manifest_path, staged_manifest)
        _copy_file_new(archive, destination / SOURCE_ARCHIVE_NAME)
        _copy_file_new(bundle, destination / BUNDLE_NAME)
        staged_archive = _check_artifact_hash(archive_record, destination, "source_archive")
        staged_bundle = _check_artifact_hash(bundle_record, destination, "git_bundle")
        manifest_hash, manifest_size = _sha256(staged_manifest)
        receipt = {
            "schema_version": REGISTRY_SCHEMA_VERSION,
            "staged_at_utc": _timestamp(),
            "release_id": manifest["release_id"],
            "candidate_commit": manifest["candidate_commit"],
            "candidate_tree": manifest["candidate_tree"],
            "manifest": {"path": MANIFEST_NAME, "sha256": manifest_hash, "size": manifest_size},
            "artifacts": {
                "source_archive": _artifact_record(staged_archive, SOURCE_ARCHIVE_NAME),
                "git_bundle": _artifact_record(staged_bundle, BUNDLE_NAME),
            },
        }
        _write_json_new(destination / REGISTRY_RECEIPT_NAME, receipt)
    except BaseException:
        # This directory was created by this invocation. A partial package must
        # never remain where another machine could mistake it for a candidate.
        shutil.rmtree(destination)
        raise
    return destination


def _validate_registry_receipt(package_dir: Path, manifest: dict[str, Any]) -> None:
    receipt_path = package_dir / REGISTRY_RECEIPT_NAME
    receipt = _load_json(receipt_path, "registry receipt")
    if not isinstance(receipt, dict) or receipt.get("schema_version") != REGISTRY_SCHEMA_VERSION:
        raise ReleaseError("registry receipt is missing or has an unsupported schema_version")
    _parse_timestamp(_required(receipt, "staged_at_utc", "registry receipt"), "registry receipt staged_at_utc")
    for field in ("release_id", "candidate_commit", "candidate_tree"):
        if _required(receipt, field, "registry receipt") != manifest[field]:
            raise ReleaseError(f"registry receipt {field} does not match the release manifest")
    receipt_manifest = _required(receipt, "manifest", "registry receipt")
    receipt_artifacts = _required(receipt, "artifacts", "registry receipt")
    if not isinstance(receipt_manifest, dict) or not isinstance(receipt_artifacts, dict):
        raise ReleaseError("registry receipt manifest and artifacts must be objects")
    receipt_manifest_path = _safe_artifact_path(package_dir, _required(receipt_manifest, "path", "registry receipt manifest"), "registry receipt manifest")
    expected_manifest_hash = _required(receipt_manifest, "sha256", "registry receipt manifest")
    expected_manifest_size = _required(receipt_manifest, "size", "registry receipt manifest")
    actual_manifest_hash, actual_manifest_size = _sha256(receipt_manifest_path)
    if (expected_manifest_hash, expected_manifest_size) != (actual_manifest_hash, actual_manifest_size):
        raise ReleaseError("registry receipt manifest hash/size mismatch")
    for name in ("source_archive", "git_bundle"):
        record = _required(receipt_artifacts, name, "registry receipt artifacts")
        if not isinstance(record, dict):
            raise ReleaseError(f"registry receipt {name} must be an object")
        _check_artifact_hash(record, package_dir, f"registry receipt {name}")


def verify_registry_candidate(manifest_path: Path) -> dict[str, Any]:
    """Verify a staged package on a machine that has no source checkout yet."""

    manifest_path = manifest_path.expanduser().resolve()
    package_dir = manifest_path.parent
    manifest = _load_json(manifest_path, "release manifest")
    if not isinstance(manifest, dict):
        raise ReleaseError("release manifest must be a JSON object")
    _validate_registry_receipt(package_dir, manifest)
    candidate = _require_hex40(_required(manifest, "candidate_commit"), "candidate_commit")
    artifacts = _required(manifest, "artifacts")
    if not isinstance(artifacts, dict):
        raise ReleaseError("artifacts must be a JSON object")
    bundle_record = _required(artifacts, "git_bundle", "artifacts")
    if not isinstance(bundle_record, dict):
        raise ReleaseError("git_bundle artifact record must be an object")
    bundle = _safe_artifact_path(package_dir, _required(bundle_record, "path", "artifact git_bundle"), "artifact git_bundle")
    if not bundle.is_file():
        raise ReleaseError("registry candidate is missing its git bundle")
    with tempfile.TemporaryDirectory(prefix="aibuff-registry-verify-") as temporary:
        clone = Path(temporary) / "clone"
        result = _run(["git", "clone", "--quiet", "--no-checkout", str(bundle), str(clone)], check=False)
        if result.returncode != 0:
            detail = result.stderr.decode("utf-8", errors="replace").strip()
            raise ReleaseError(f"registry git bundle could not be cloned: {detail}")
        resolved = _resolve_commit(clone, candidate, "registry candidate")
        if resolved != candidate:
            raise ReleaseError("registry clone resolved a different candidate commit")
        return validate_manifest(manifest_path, clone)


def preflight(manifest_path: Path, repo: Path, production_state_path: Path) -> None:
    manifest = validate_manifest(manifest_path, repo)
    state = _load_json(production_state_path.expanduser().resolve(), "redacted production state")
    if not isinstance(state, dict):
        raise ReleaseError("redacted production state must be a JSON object")
    observed_commit = _require_hex40(_required(state, "commit", "production state"), "production state commit")
    observed_tree = _require_hex40(_required(state, "tree", "production state"), "production state tree")
    observed_digest = _require_digest(
        _required(state, "image_digest", "production state"),
        "production state image digest",
    )
    expected = (
        manifest["expected_production_commit"],
        manifest["expected_production_tree"],
        manifest["expected_production_image_digest"],
    )
    observed = (observed_commit, observed_tree, observed_digest)
    labels = ("commit", "tree", "image_digest")
    drift = [f"{label}: expected {want}, observed {got}" for label, want, got in zip(labels, expected, observed) if want != got]
    if drift:
        raise ReleaseError("production baseline drift detected; " + "; ".join(drift))


def _lock_payload(owner_id: str, ttl_seconds: int) -> dict[str, Any]:
    acquired = _utc_now()
    return {
        "schema_version": LOCK_SCHEMA_VERSION,
        "owner_id": owner_id,
        "pid": os.getpid(),
        "acquired_at": _timestamp(acquired),
        "expires_at": _timestamp(acquired + dt.timedelta(seconds=ttl_seconds)),
    }


def _read_lock(path: Path) -> dict[str, Any]:
    try:
        value = _load_json(path, "deployment lock")
    except ReleaseError as exc:
        raise ReleaseError("deployment lock exists but is unreadable; refusing automatic recovery") from exc
    if not isinstance(value, dict):
        raise ReleaseError("deployment lock exists but is not a JSON object; refusing automatic recovery")
    if value.get("schema_version") != LOCK_SCHEMA_VERSION:
        raise ReleaseError("deployment lock schema is unknown; refusing automatic recovery")
    owner = value.get("owner_id")
    if not isinstance(owner, str) or not owner:
        raise ReleaseError("deployment lock owner_id is invalid; refusing automatic recovery")
    _parse_timestamp(_required(value, "acquired_at", "deployment lock"), "deployment lock acquired_at")
    _parse_timestamp(_required(value, "expires_at", "deployment lock"), "deployment lock expires_at")
    return value


def acquire_lock(path: Path, owner_id: str, ttl_seconds: int, ready_file: Path | None = None) -> dict[str, Any]:
    if not owner_id.strip():
        raise ReleaseError("lock owner_id must be non-empty")
    if ttl_seconds <= 0:
        raise ReleaseError("lock ttl_seconds must be positive")
    path = path.expanduser().resolve()
    if path.exists():
        existing = _read_lock(path)
        expires = _parse_timestamp(existing["expires_at"], "deployment lock expires_at")
        if expires <= _utc_now():
            raise ReleaseError(
                f"stale/expired deployment lock held by {existing['owner_id']}; manual review is required, lock was not stolen"
            )
        raise ReleaseError(f"deployment lock is already held by {existing['owner_id']}; second task rejected")
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = _lock_payload(owner_id, ttl_seconds)
    encoded = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ReleaseError("deployment lock was acquired concurrently by another task; second task rejected") from exc
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(encoded)
    except BaseException:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        raise
    if ready_file is not None:
        ready_file = ready_file.expanduser().resolve()
        try:
            with ready_file.open("x", encoding="utf-8") as stream:
                stream.write(owner_id + "\n")
        except BaseException:
            try:
                path.unlink()
            except FileNotFoundError:
                pass
            raise
    return payload


def release_lock(path: Path, owner_id: str) -> None:
    path = path.expanduser().resolve()
    if not path.exists():
        raise ReleaseError(f"deployment lock does not exist: {path}")
    existing = _read_lock(path)
    if existing["owner_id"] != owner_id:
        raise ReleaseError("deployment lock owner mismatch; refusing to remove another task's lock")
    path.unlink()


def _hold(seconds: float) -> None:
    if seconds < 0:
        raise ReleaseError("hold_seconds must not be negative")
    deadline = time.monotonic() + seconds
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        time.sleep(min(remaining, 30.0))


def _cmd_prepare(args: argparse.Namespace) -> int:
    manifest = prepare(
        _repo_path(args.repo),
        Path(args.output),
        args.candidate,
        args.expected_production_commit,
        args.expected_production_tree,
        args.expected_production_image_digest,
        args.release_id,
    )
    print(f"PREPARE PASS: {manifest}")
    return 0


def _cmd_validate(args: argparse.Namespace) -> int:
    manifest = validate_manifest(Path(args.manifest), _repo_path(args.repo))
    print(f"VALIDATE PASS: {manifest['candidate_commit']} package is exact and verified")
    return 0


def _cmd_preflight(args: argparse.Namespace) -> int:
    preflight(Path(args.manifest), _repo_path(args.repo), Path(args.production_state))
    print("PREFLIGHT PASS: redacted production state matches the expected commit, tree, and image digest")
    return 0


def _cmd_registry_stage(args: argparse.Namespace) -> int:
    destination = stage_candidate(Path(args.manifest), _repo_path(args.repo), Path(args.registry))
    print(f"REGISTRY STAGE PASS: {destination}")
    return 0


def _cmd_registry_verify(args: argparse.Namespace) -> int:
    manifest = verify_registry_candidate(Path(args.manifest))
    print(f"REGISTRY VERIFY PASS: {manifest['candidate_commit']} is recoverable from the registry package")
    return 0


def _cmd_image_verify(args: argparse.Namespace) -> int:
    verify_oci_image_tar(
        Path(args.image_tar),
        args.tar_sha256,
        args.oci_manifest_digest,
        args.config_digest,
        args.revision,
        args.platform,
        args.repo_tag,
    )
    print("OCI IMAGE VERIFY PASS: tar, manifest, config, revision, platform, tag, and layers are exact")
    return 0


def _cmd_lock_acquire(args: argparse.Namespace) -> int:
    owner_id = args.owner_id or f"pid-{os.getpid()}-{uuid.uuid4().hex}"
    if args.hold_seconds < 0:
        raise ReleaseError("hold_seconds must not be negative")
    payload = acquire_lock(Path(args.path), owner_id, args.ttl_seconds, Path(args.ready_file) if args.ready_file else None)
    print(f"LOCK ACQUIRED: owner_id={payload['owner_id']} expires_at={payload['expires_at']}")
    _hold(args.hold_seconds)
    if args.hold_seconds > 0:
        release_lock(Path(args.path), owner_id)
        print("LOCK RELEASED: hold completed")
    return 0


def _cmd_lock_release(args: argparse.Namespace) -> int:
    release_lock(Path(args.path), args.owner_id)
    print("LOCK RELEASED: owner verified")
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    prepare_parser = commands.add_parser("prepare", help="package an exact clean checkout")
    prepare_parser.add_argument("--repo", default=".")
    prepare_parser.add_argument("--output", required=True)
    prepare_parser.add_argument("--candidate", default="HEAD")
    prepare_parser.add_argument("--expected-production-commit", required=True)
    prepare_parser.add_argument("--expected-production-tree", required=True)
    prepare_parser.add_argument("--expected-production-image-digest", required=True)
    prepare_parser.add_argument("--release-id")
    prepare_parser.set_defaults(handler=_cmd_prepare)

    validate_parser = commands.add_parser("validate", help="verify a release package")
    validate_parser.add_argument("--repo", default=".")
    validate_parser.add_argument("--manifest", required=True)
    validate_parser.set_defaults(handler=_cmd_validate)

    preflight_parser = commands.add_parser("preflight", help="compare redacted production state to the package")
    preflight_parser.add_argument("--repo", default=".")
    preflight_parser.add_argument("--manifest", required=True)
    preflight_parser.add_argument("--production-state", required=True)
    preflight_parser.set_defaults(handler=_cmd_preflight)

    registry_parser = commands.add_parser("registry", help="stage and verify immutable cross-device candidate packages")
    registry_commands = registry_parser.add_subparsers(dest="registry_command", required=True)
    registry_stage_parser = registry_commands.add_parser("stage", help="validate then copy a package into a new registry directory")
    registry_stage_parser.add_argument("--repo", default=".")
    registry_stage_parser.add_argument("--manifest", required=True)
    registry_stage_parser.add_argument("--registry", required=True)
    registry_stage_parser.set_defaults(handler=_cmd_registry_stage)
    registry_verify_parser = registry_commands.add_parser("verify", help="verify a staged package without a pre-existing checkout")
    registry_verify_parser.add_argument("--manifest", required=True)
    registry_verify_parser.set_defaults(handler=_cmd_registry_verify)

    image_parser = commands.add_parser("image", help="verify an exact portable OCI image tar")
    image_commands = image_parser.add_subparsers(dest="image_command", required=True)
    image_verify_parser = image_commands.add_parser("verify", help="verify tar, OCI manifest/config, revision, platform, tag, and layers")
    image_verify_parser.add_argument("--image-tar", required=True)
    image_verify_parser.add_argument("--tar-sha256", required=True)
    image_verify_parser.add_argument("--oci-manifest-digest", required=True)
    image_verify_parser.add_argument("--config-digest", required=True)
    image_verify_parser.add_argument("--revision", required=True)
    image_verify_parser.add_argument("--platform", required=True)
    image_verify_parser.add_argument("--repo-tag", required=True)
    image_verify_parser.set_defaults(handler=_cmd_image_verify)

    lock_parser = commands.add_parser("lock", help="acquire or release the single deployment lock")
    lock_commands = lock_parser.add_subparsers(dest="lock_command", required=True)
    acquire_parser = lock_commands.add_parser("acquire", help="acquire a fail-first atomic lock")
    acquire_parser.add_argument("--path", required=True)
    acquire_parser.add_argument("--owner-id")
    acquire_parser.add_argument("--ttl-seconds", type=int, default=1800)
    acquire_parser.add_argument("--hold-seconds", type=float, default=0)
    acquire_parser.add_argument("--ready-file")
    acquire_parser.set_defaults(handler=_cmd_lock_acquire)
    release_parser = lock_commands.add_parser("release", help="release only a lock owned by the caller")
    release_parser.add_argument("--path", required=True)
    release_parser.add_argument("--owner-id", required=True)
    release_parser.set_defaults(handler=_cmd_lock_release)
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    try:
        return args.handler(args)
    except ReleaseError as exc:
        print(f"HARD STOP: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
