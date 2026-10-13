import hashlib
import json
import tarfile
import unittest
from pathlib import Path, PurePosixPath


PINNED_COMMIT = "6cd4a8ff0f3f4e49d6d6969dd2fbadfa1569fde2"
SOURCE_URL = "https://github.com/xqy2006/ModelTrace.git"
ARCHIVE_SHA256 = (
    "1a3f10f8ac72b4e6750194637dce2c38d3976f9d883799c96243c42910725b19"
)
ARCHIVE_MEMBER_METADATA_SHA256 = (
    "777fb1886a68b027389d4bc22f15dd8647c449ab4907384db54b6653b70e46bd"
)
FINGERPRINT_SHA256 = (
    "387fe5c44cc5f859995432267b0d3b462fc26e82419fc22e3ee7f36cc2502d98"
)
LICENSE_SHA256 = (
    "238afb57e498990742f84b9ce6167b4e256ac06104a9938ce953bc41c14bea51"
)
UNIFIED_BANK_SHA256 = (
    "f267d0513aa06981d024ec5394746fceddf44e4e8a75fa6bf8304255f4b32d6d"
)
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DISTRIBUTION_ROOT = REPOSITORY_ROOT / "third_party" / "modeltrace"
METADATA_FILES = {"PROVENANCE.json", "SHA256SUMS"}
COPIED_UPSTREAM_FILE_COUNT = 25
OPTIONAL_GUARD_ARCHIVE_FILES = {
    "codex-plugin/modeltrace-guard/.codex-plugin/plugin.json",
    "codex-plugin/modeltrace-guard/hooks/hooks.json",
    "codex-plugin/modeltrace-guard/skills/modeltrace-guard/SKILL.md",
}
FORBIDDEN_EXTRACTED_PARTS = {
    ".agents",
    ".codex-plugin",
    "hooks",
    "plugins",
    "settings",
    "skills",
}
FORBIDDEN_STATE_NAMES = {
    ".DS_Store",
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "node_modules",
    "venv",
}
FORBIDDEN_STATE_SUFFIXES = {".log", ".pyc", ".pyo"}
FORBIDDEN_RUNTIME_PATHS = {"data/custom_banks.json"}


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class DistributionTest(unittest.TestCase):
    def test_distribution_is_pinned_to_upstream_commit(self):
        provenance_path = DISTRIBUTION_ROOT / "PROVENANCE.json"
        self.assertTrue(
            provenance_path.is_file(),
            "pinned upstream distribution is missing",
        )

        provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
        self.assertEqual(SOURCE_URL, provenance["source"]["url"])
        self.assertEqual(PINNED_COMMIT, provenance["source"]["commit"])
        self.assertEqual(
            FINGERPRINT_SHA256,
            sha256(DISTRIBUTION_ROOT / "fingerprint.py"),
        )

    def test_license_is_preserved(self):
        provenance = json.loads(
            (DISTRIBUTION_ROOT / "PROVENANCE.json").read_text(encoding="utf-8")
        )

        self.assertEqual("MIT License", provenance["license"].get("identity"))
        self.assertEqual("MIT", provenance["license"].get("spdx_id"))
        self.assertEqual("LICENSE", provenance["license"].get("file"))
        self.assertEqual(LICENSE_SHA256, provenance["license"].get("sha256"))
        self.assertEqual(
            LICENSE_SHA256,
            sha256(DISTRIBUTION_ROOT / "LICENSE"),
        )

    def test_every_vendor_byte_is_manifested(self):
        provenance = json.loads(
            (DISTRIBUTION_ROOT / "PROVENANCE.json").read_text(encoding="utf-8")
        )
        distributed_files = {
            path.relative_to(DISTRIBUTION_ROOT).as_posix()
            for path in DISTRIBUTION_ROOT.rglob("*")
            if path.is_file()
        }
        payload_files = distributed_files - METADATA_FILES

        self.assertEqual(
            len(payload_files),
            provenance["coverage"].get("payload_file_count"),
        )
        self.assertEqual(payload_files, set(provenance["files"]))

        checksum_paths = []
        checksums = {}
        checksum_text = (DISTRIBUTION_ROOT / "SHA256SUMS").read_text(
            encoding="utf-8"
        )
        for line in checksum_text.splitlines():
            digest, separator, prefixed_path = line.partition("  ")
            self.assertEqual("  ", separator)
            self.assertTrue(prefixed_path.startswith("./"))
            relative_path = prefixed_path[2:]
            self.assertNotIn(relative_path, checksums)
            checksum_paths.append(relative_path)
            checksums[relative_path] = digest

        self.assertEqual(sorted(checksum_paths), checksum_paths)
        self.assertEqual(payload_files, set(checksums))
        for relative_path in sorted(payload_files):
            actual_digest = sha256(DISTRIBUTION_ROOT / relative_path)
            self.assertEqual(actual_digest, provenance["files"][relative_path])
            self.assertEqual(actual_digest, checksums[relative_path])

        manifest_exclusions = provenance["coverage"]["manifest"]["excluded"]
        checksum_exclusions = provenance["coverage"]["sha256sums"]["excluded"]
        self.assertEqual(METADATA_FILES, set(manifest_exclusions))
        self.assertEqual(METADATA_FILES, set(checksum_exclusions))
        self.assertEqual(
            UNIFIED_BANK_SHA256,
            checksums["data/unified_bank.json"],
        )

    def test_archive_is_independently_pinned_and_matches_copied_files(self):
        archive_path = DISTRIBUTION_ROOT / "upstream-source.tar.gz"
        self.assertEqual(ARCHIVE_SHA256, sha256(archive_path))

        distributed_files = {
            path.relative_to(DISTRIBUTION_ROOT).as_posix()
            for path in DISTRIBUTION_ROOT.rglob("*")
            if path.is_file()
        }
        copied_upstream_files = (
            distributed_files - METADATA_FILES - {archive_path.name}
        )
        self.assertEqual(
            COPIED_UPSTREAM_FILE_COUNT,
            len(copied_upstream_files),
        )

        with tarfile.open(archive_path, mode="r:gz") as archive:
            self.assertEqual(
                PINNED_COMMIT,
                archive.pax_headers.get("comment"),
            )
            members = archive.getmembers()
            unsafe_members = {
                member.name: member.type.decode()
                for member in members
                if not member.isfile() and not member.isdir()
            }
            self.assertEqual({}, unsafe_members)

            git_members = {
                member.name
                for member in members
                if ".git" in PurePosixPath(member.name).parts
            }
            self.assertEqual(set(), git_members)

            metadata_digest = hashlib.sha256()
            for member in members:
                metadata_digest.update(
                    (
                        member.name
                        + "\0"
                        + member.type.decode()
                        + "\0"
                        + str(member.size)
                        + "\n"
                    ).encode("utf-8")
                )
            self.assertEqual(
                ARCHIVE_MEMBER_METADATA_SHA256,
                metadata_digest.hexdigest(),
            )

            regular_members = {
                member.name: member
                for member in members
                if member.isfile()
            }
            for relative_path in sorted(copied_upstream_files):
                member = regular_members.get(relative_path)
                self.assertIsNotNone(
                    member,
                    f"{relative_path} is not a regular archive member",
                )
                archived_stream = archive.extractfile(member)
                self.assertIsNotNone(archived_stream)
                archived_bytes = archived_stream.read()
                copied_bytes = (DISTRIBUTION_ROOT / relative_path).read_bytes()
                self.assertEqual(
                    hashlib.sha256(copied_bytes).hexdigest(),
                    hashlib.sha256(archived_bytes).hexdigest(),
                    relative_path,
                )
                self.assertEqual(copied_bytes, archived_bytes, relative_path)

    def test_archive_retains_optional_guard_without_installed_hooks(self):
        provenance = json.loads(
            (DISTRIBUTION_ROOT / "PROVENANCE.json").read_text(encoding="utf-8")
        )
        optional_guard = provenance["archive"].get("optional_guard", {})
        self.assertEqual(PINNED_COMMIT, provenance["archive"].get("commit"))
        self.assertEqual("archive-only", optional_guard.get("distribution"))
        self.assertEqual(
            "codex-plugin/modeltrace-guard/",
            optional_guard.get("path"),
        )
        self.assertIs(optional_guard.get("installed"), False)

        archive_path = DISTRIBUTION_ROOT / "upstream-source.tar.gz"
        with tarfile.open(archive_path, mode="r:gz") as archive:
            archive_files = {
                member.name
                for member in archive.getmembers()
                if member.isfile()
            }
        self.assertTrue(
            OPTIONAL_GUARD_ARCHIVE_FILES.issubset(archive_files),
            "optional guard source is missing from the upstream archive",
        )

        extracted_paths = {
            path.relative_to(DISTRIBUTION_ROOT)
            for path in DISTRIBUTION_ROOT.rglob("*")
            if path != archive_path
        }
        forbidden_paths = {
            path.as_posix()
            for path in extracted_paths
            if FORBIDDEN_EXTRACTED_PARTS.intersection(path.parts)
        }
        self.assertEqual(set(), forbidden_paths)

    def test_distribution_has_no_git_or_runtime_state(self):
        provenance = json.loads(
            (DISTRIBUTION_ROOT / "PROVENANCE.json").read_text(encoding="utf-8")
        )
        policy = provenance.get("distribution_policy", {})
        self.assertIs(policy.get("runtime_state_included"), False)
        self.assertEqual("forbidden", policy.get("symlinks"))
        self.assertEqual("forbidden", policy.get("git_metadata"))
        self.assertEqual(
            "forbidden",
            policy.get("caches_and_virtual_environments"),
        )

        symlinks = set()
        irregular_entries = set()
        forbidden_state = set()
        for path in DISTRIBUTION_ROOT.rglob("*"):
            relative_path = path.relative_to(DISTRIBUTION_ROOT)
            relative_name = relative_path.as_posix()
            if path.is_symlink():
                symlinks.add(relative_name)
                continue
            if not path.is_file() and not path.is_dir():
                irregular_entries.add(relative_name)
            if (
                FORBIDDEN_STATE_NAMES.intersection(relative_path.parts)
                or path.suffix in FORBIDDEN_STATE_SUFFIXES
                or relative_name in FORBIDDEN_RUNTIME_PATHS
            ):
                forbidden_state.add(relative_name)

        self.assertEqual(set(), symlinks)
        self.assertEqual(set(), irregular_entries)
        self.assertEqual(set(), forbidden_state)


if __name__ == "__main__":
    unittest.main()
