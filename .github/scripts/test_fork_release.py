import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("fork_release", Path(__file__).with_name("fork_release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ForkReleaseTest(unittest.TestCase):
    def test_new_tags_are_queued_and_failed_builds_are_retried(self):
        tags = ["v1.0.0-rc.40", "v1.0.0-rc.41", "v1.0.0-rc.42"]
        baseline = {tags[0]}
        self.assertEqual(release.select_tag(tags, baseline, set()), tags[1])
        self.assertEqual(release.select_tag(tags, baseline, {tags[1]}), tags[2])
        self.assertEqual(release.select_tag(tags, baseline, set(tags)), "")
        self.assertEqual(release.select_tag(tags, baseline, set(tags), tags[0]), tags[0])
        for invalid in ["main", "nightly-20261005", "v1.0.0-rc.99", "v1.0.0\ninjected=true"]:
            with self.subTest(tag=invalid), self.assertRaises(ValueError):
                release.select_tag(tags, baseline, set(), invalid)

    def test_merge_preserves_both_histories_and_leaves_main_intact(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = os.getcwd()
            os.chdir(directory)
            try:
                release.git("init", "-b", "main")
                release.git("config", "user.name", "Test")
                release.git("config", "user.email", "test@example.invalid")
                Path("common.txt").write_text("base\n")
                release.git("add", ".")
                release.git("commit", "-m", "base")
                base = release.git("rev-parse", "HEAD")
                Path("custom.txt").write_text("fork patch\n")
                release.git("add", ".")
                release.git("commit", "-m", "fork patch")
                main_sha = release.git("rev-parse", "HEAD")
                release.git("checkout", "--detach", base)
                Path("upstream.txt").write_text("new release\n")
                release.git("add", ".")
                release.git("commit", "-m", "upstream release")
                upstream_sha = release.git("rev-parse", "HEAD")
                release.git("update-ref", "refs/upstream-tags/v1.0.0", upstream_sha)
                branch, merged = release.merge_release("v1.0.0", main_sha)
                self.assertEqual(branch, "fork-release/v1.0.0")
                self.assertEqual(release.git("rev-parse", "main"), main_sha)
                self.assertEqual(Path("custom.txt").read_text(), "fork patch\n")
                self.assertEqual(Path("upstream.txt").read_text(), "new release\n")
                for parent in [main_sha, upstream_sha]:
                    release.git("merge-base", "--is-ancestor", parent, merged)

                # Retry uses the already resolved/pushed release branch.
                release.git("update-ref", f"refs/remotes/origin/{branch}", merged)
                self.assertEqual(release.merge_release("v1.0.0", main_sha)[1], merged)

                # A conflicting release fails without advancing main or retaining merge state.
                release.git("checkout", "main")
                Path("common.txt").write_text("fork\n")
                release.git("commit", "-am", "fork edit")
                conflicting_main = release.git("rev-parse", "HEAD")
                release.git("checkout", "--detach", base)
                Path("common.txt").write_text("upstream\n")
                release.git("commit", "-am", "upstream edit")
                release.git("update-ref", "refs/upstream-tags/v1.0.1", release.git("rev-parse", "HEAD"))
                with self.assertRaisesRegex(RuntimeError, "common.txt"):
                    release.merge_release("v1.0.1", conflicting_main)
                self.assertEqual(release.git("rev-parse", "main"), conflicting_main)
                self.assertFalse(Path(".git/MERGE_HEAD").exists())
            finally:
                os.chdir(previous)


if __name__ == "__main__":
    unittest.main()
