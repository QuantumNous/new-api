from __future__ import annotations

import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import tarfile
import time
import unittest


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "ops" / "release" / "release_controller.py"


class GitRepo:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.run("init", "-b", "main")
        self.run("config", "user.name", "Release Gate Test")
        self.run("config", "user.email", "release-gate@example.invalid")

    def run(self, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            ["git", "-C", str(self.path), *args],
            text=True,
            capture_output=True,
            check=False,
        )
        if check and result.returncode != 0:
            self.failure = result.stderr
            raise AssertionError(f"git command failed: {args}\n{result.stderr}")
        return result

    def commit_file(self, name: str, content: str, message: str) -> str:
        (self.path / name).write_text(content, encoding="utf-8")
        self.run("add", name)
        self.run("commit", "-m", message)
        return self.commit()

    def commit(self) -> str:
        return self.run("rev-parse", "HEAD").stdout.strip()

    def tree(self, commit: str) -> str:
        return self.run("rev-parse", f"{commit}^{{tree}}").stdout.strip()


class ReleaseControllerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="aibuff-release-test-")
        self.root = Path(self.temp.name)
        self.repo_path = self.root / "repo"
        self.repo_path.mkdir()
        self.repo = GitRepo(self.repo_path)
        self.production_commit = self.repo.commit_file("app.txt", "one\n", "base")
        self.candidate_commit = self.repo.commit_file("app.txt", "two\n", "candidate")
        self.production_tree = self.repo.tree(self.production_commit)
        self.image_digest = "sha256:" + "1" * 64

    def tearDown(self) -> None:
        self.temp.cleanup()

    def run_cli(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            cwd=str(ROOT),
            text=True,
            capture_output=True,
            check=False,
        )

    def prepare(self, output: Path) -> subprocess.CompletedProcess[str]:
        return self.run_cli(
            "prepare",
            "--repo",
            str(self.repo_path),
            "--output",
            str(output),
            "--candidate",
            self.candidate_commit,
            "--expected-production-commit",
            self.production_commit,
            "--expected-production-tree",
            self.production_tree,
            "--expected-production-image-digest",
            self.image_digest,
        )

    def package(self, name: str = "package") -> Path:
        output = self.root / name
        result = self.prepare(output)
        self.assertEqual(result.returncode, 0, result.stderr)
        return output

    def write_oci_image_tar(self, name: str = "candidate-image.tar") -> tuple[Path, dict[str, str]]:
        revision = self.candidate_commit
        config = json.dumps(
            {
                "architecture": "amd64",
                "config": {"Labels": {"org.opencontainers.image.revision": revision}},
                "os": "linux",
            },
            separators=(",", ":"),
        ).encode()
        layer = b"exact layer bytes\n"
        config_hex = hashlib.sha256(config).hexdigest()
        layer_hex = hashlib.sha256(layer).hexdigest()
        config_path = f"blobs/sha256/{config_hex}"
        layer_path = f"blobs/sha256/{layer_hex}"
        manifest = json.dumps(
            {
                "schemaVersion": 2,
                "config": {"mediaType": "application/vnd.oci.image.config.v1+json", "digest": f"sha256:{config_hex}", "size": len(config)},
                "layers": [{"mediaType": "application/vnd.oci.image.layer.v1.tar", "digest": f"sha256:{layer_hex}", "size": len(layer)}],
            },
            separators=(",", ":"),
        ).encode()
        manifest_hex = hashlib.sha256(manifest).hexdigest()
        manifest_path = f"blobs/sha256/{manifest_hex}"
        tag = "example.invalid/aibuff:aadd"
        index = json.dumps(
            {"schemaVersion": 2, "manifests": [{"mediaType": "application/vnd.oci.image.manifest.v1+json", "digest": f"sha256:{manifest_hex}", "size": len(manifest)}]},
            separators=(",", ":"),
        ).encode()
        docker_manifest = json.dumps(
            [{"Config": config_path, "RepoTags": [tag], "Layers": [layer_path]}], separators=(",", ":")
        ).encode()
        image_tar = self.root / name
        with tarfile.open(image_tar, "w") as archive:
            for path, payload in (("index.json", index), ("manifest.json", docker_manifest), (config_path, config), (layer_path, layer), (manifest_path, manifest)):
                info = tarfile.TarInfo(path)
                info.size = len(payload)
                archive.addfile(info, io.BytesIO(payload))
        return image_tar, {
            "tar_sha256": hashlib.sha256(image_tar.read_bytes()).hexdigest(),
            "manifest": f"sha256:{manifest_hex}",
            "config": f"sha256:{config_hex}",
            "revision": revision,
            "platform": "linux/amd64",
            "tag": tag,
        }

    def test_prepare_and_validate_success(self) -> None:
        package = self.package()
        manifest = package / "release-manifest.json"
        result = self.run_cli("validate", "--repo", str(self.repo_path), "--manifest", str(manifest))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("VALIDATE PASS", result.stdout)
        data = json.loads(manifest.read_text(encoding="utf-8"))
        self.assertEqual(data["candidate_commit"], self.candidate_commit)
        self.assertEqual(data["candidate_tree"], self.repo.tree(self.candidate_commit))
        self.assertEqual(data["expected_production_commit"], self.production_commit)
        self.assertEqual(data["expected_production_tree"], self.production_tree)
        self.assertEqual(data["expected_production_image_digest"], self.image_digest)
        self.assertEqual(sorted(path.name for path in package.iterdir()), ["release-manifest.json", "source.bundle", "source.tar.gz"])

    def test_dirty_checkout_is_rejected(self) -> None:
        (self.repo_path / "untracked.txt").write_text("not packaged\n", encoding="utf-8")
        output = self.root / "dirty-output"
        result = self.prepare(output)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("HARD STOP", result.stderr)
        self.assertFalse(output.exists())

    def test_expected_production_not_ancestor_is_rejected(self) -> None:
        self.repo.run("checkout", "-b", "unrelated", self.production_commit)
        unrelated_commit = self.repo.commit_file("other.txt", "divergent\n", "unrelated")
        unrelated_tree = self.repo.tree(unrelated_commit)
        self.repo.run("checkout", "main")
        result = self.run_cli(
            "prepare",
            "--repo",
            str(self.repo_path),
            "--output",
            str(self.root / "not-ancestor"),
            "--candidate",
            self.candidate_commit,
            "--expected-production-commit",
            unrelated_commit,
            "--expected-production-tree",
            unrelated_tree,
            "--expected-production-image-digest",
            self.image_digest,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not an ancestor", result.stderr)

    def test_preflight_drift_is_hard_stop(self) -> None:
        package = self.package()
        manifest = package / "release-manifest.json"
        variants = (
            {"commit": self.candidate_commit, "tree": self.production_tree, "image_digest": self.image_digest},
            {"commit": self.production_commit, "tree": self.repo.tree(self.candidate_commit), "image_digest": self.image_digest},
            {"commit": self.production_commit, "tree": self.production_tree, "image_digest": "sha256:" + "2" * 64},
        )
        for index, state in enumerate(variants):
            state_path = self.root / f"state-{index}.json"
            state_path.write_text(json.dumps(state) + "\n", encoding="utf-8")
            result = self.run_cli(
                "preflight",
                "--repo",
                str(self.repo_path),
                "--manifest",
                str(manifest),
                "--production-state",
                str(state_path),
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("HARD STOP", result.stderr)
            self.assertIn("drift", result.stderr)

    def test_preflight_success(self) -> None:
        package = self.package("preflight-pass")
        state_path = self.root / "state-pass.json"
        state_path.write_text(
            json.dumps(
                {
                    "commit": self.production_commit,
                    "tree": self.production_tree,
                    "image_digest": self.image_digest,
                }
            )
            + "\n",
            encoding="utf-8",
        )
        result = self.run_cli(
            "preflight",
            "--repo",
            str(self.repo_path),
            "--manifest",
            str(package / "release-manifest.json"),
            "--production-state",
            str(state_path),
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("PREFLIGHT PASS", result.stdout)

    def test_source_and_bundle_tamper_are_rejected(self) -> None:
        package = self.package("archive-tamper")
        archive = package / "source.tar.gz"
        archive.write_bytes(archive.read_bytes() + b"tamper")
        result = self.run_cli("validate", "--repo", str(self.repo_path), "--manifest", str(package / "release-manifest.json"))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("HARD STOP", result.stderr)

    def test_oci_image_identity_chain_is_verified(self) -> None:
        image_tar, identity = self.write_oci_image_tar()
        result = self.run_cli(
            "image", "verify", "--image-tar", str(image_tar), "--tar-sha256", identity["tar_sha256"],
            "--oci-manifest-digest", identity["manifest"], "--config-digest", identity["config"],
            "--revision", identity["revision"], "--platform", identity["platform"], "--repo-tag", identity["tag"],
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("OCI IMAGE VERIFY PASS", result.stdout)
        wrong = self.run_cli(
            "image", "verify", "--image-tar", str(image_tar), "--tar-sha256", identity["tar_sha256"],
            "--oci-manifest-digest", "sha256:" + "0" * 64, "--config-digest", identity["config"],
            "--revision", identity["revision"], "--platform", identity["platform"], "--repo-tag", identity["tag"],
        )
        self.assertNotEqual(wrong.returncode, 0)
        self.assertIn("HARD STOP", wrong.stderr)

        package = self.package("bundle-tamper")
        bundle = package / "source.bundle"
        bundle.write_bytes(bundle.read_bytes() + b"tamper")
        result = self.run_cli("validate", "--repo", str(self.repo_path), "--manifest", str(package / "release-manifest.json"))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("HARD STOP", result.stderr)

    def test_existing_output_is_never_overwritten(self) -> None:
        output = self.root / "existing"
        output.mkdir()
        sentinel = output / "sentinel.txt"
        sentinel.write_text("keep me\n", encoding="utf-8")
        result = self.prepare(output)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("already exists", result.stderr)
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep me\n")
        self.assertEqual([path.name for path in output.iterdir()], ["sentinel.txt"])

    def test_registry_stage_is_portable_and_never_overwrites(self) -> None:
        package = self.package("registry-source")
        manifest = package / "release-manifest.json"
        registry = self.root / "drive-registry"
        result = self.run_cli(
            "registry",
            "stage",
            "--repo",
            str(self.repo_path),
            "--manifest",
            str(manifest),
            "--registry",
            str(registry),
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("REGISTRY STAGE PASS", result.stdout)
        staged_manifest = next(registry.glob("*/release-manifest.json"))
        self.assertEqual(
            sorted(path.name for path in staged_manifest.parent.iterdir()),
            ["registry-receipt.json", "release-manifest.json", "source.bundle", "source.tar.gz"],
        )
        portable = self.run_cli("registry", "verify", "--manifest", str(staged_manifest))
        self.assertEqual(portable.returncode, 0, portable.stderr)
        self.assertIn("REGISTRY VERIFY PASS", portable.stdout)
        (staged_manifest.parent / "registry-receipt.json").unlink()
        incomplete = self.run_cli("registry", "verify", "--manifest", str(staged_manifest))
        self.assertNotEqual(incomplete.returncode, 0)
        self.assertIn("registry receipt", incomplete.stderr)
        repeated = self.run_cli(
            "registry",
            "stage",
            "--repo",
            str(self.repo_path),
            "--manifest",
            str(manifest),
            "--registry",
            str(registry),
        )
        self.assertNotEqual(repeated.returncode, 0)
        self.assertIn("refusing to overwrite", repeated.stderr)

    def test_second_parallel_lock_is_rejected(self) -> None:
        lock = self.root / "deploy.lock"
        ready = self.root / "ready"
        first = subprocess.Popen(
            [
                sys.executable,
                str(SCRIPT),
                "lock",
                "acquire",
                "--path",
                str(lock),
                "--owner-id",
                "first",
                "--ttl-seconds",
                "30",
                "--hold-seconds",
                "1",
                "--ready-file",
                str(ready),
            ],
            cwd=str(ROOT),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        try:
            deadline = time.monotonic() + 3
            while not ready.exists() and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(ready.exists(), "first lock holder did not acquire the lock")
            second = self.run_cli(
                "lock",
                "acquire",
                "--path",
                str(lock),
                "--owner-id",
                "second",
                "--ttl-seconds",
                "30",
            )
            self.assertNotEqual(second.returncode, 0)
            self.assertIn("HARD STOP", second.stderr)
            self.assertIn("second task rejected", second.stderr)
        finally:
            stdout, stderr = first.communicate(timeout=5)
            self.assertEqual(first.returncode, 0, stderr)
            self.assertIn("LOCK RELEASED", stdout)
        self.assertFalse(lock.exists())

    def test_stale_lock_fails_first_without_stealing(self) -> None:
        lock = self.root / "stale.lock"
        old = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=10)
        payload = {
            "schema_version": 1,
            "owner_id": "old-owner",
            "pid": 1,
            "acquired_at": old.isoformat().replace("+00:00", "Z"),
            "expires_at": (old + dt.timedelta(seconds=1)).isoformat().replace("+00:00", "Z"),
        }
        lock.write_text(json.dumps(payload) + "\n", encoding="utf-8")
        result = self.run_cli(
            "lock",
            "acquire",
            "--path",
            str(lock),
            "--owner-id",
            "new-owner",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("HARD STOP", result.stderr)
        self.assertIn("stale/expired", result.stderr)
        self.assertEqual(json.loads(lock.read_text(encoding="utf-8"))["owner_id"], "old-owner")


if __name__ == "__main__":
    unittest.main()
