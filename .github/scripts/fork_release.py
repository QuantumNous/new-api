#!/usr/bin/env python3
"""Select an unbuilt upstream tag and merge fork main into its release branch."""

import os
from pathlib import Path
import re
import subprocess


RELEASE_TAG = re.compile(r"v\d+\.\d+\.\d+(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?")


def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()


def select_tag(tags, baseline, completed, requested=""):
    if requested:
        if not RELEASE_TAG.fullmatch(requested) or requested not in tags:
            raise ValueError(f"Not an upstream release tag: {requested!r}")
        return requested
    return next((tag for tag in tags if tag not in baseline and tag not in completed), "")


def merge_release(tag, main_sha):
    branch = f"fork-release/{tag}"
    existing = f"refs/remotes/origin/{branch}"
    exists = subprocess.run(
        ["git", "show-ref", "--verify", "--quiet", existing], check=False
    ).returncode == 0
    base = existing if exists else f"refs/upstream-tags/{tag}"
    git("checkout", "-B", branch, base)
    try:
        git("merge", "--no-ff", "--no-edit", main_sha)
    except subprocess.CalledProcessError:
        conflicts = git("diff", "--name-only", "--diff-filter=U")
        git("merge", "--abort")
        raise RuntimeError(
            f"Merge conflict for {tag}. Resolve main into {branch}, push that branch, "
            f"then run this workflow with tag={tag}. Conflicting files:\n{conflicts}"
        ) from None
    return branch, git("rev-parse", "HEAD")


def main():
    # Read automation configuration before checking out the merged source tree.
    baseline = {
        line for line in Path(".github/fork-release-baseline.txt").read_text().splitlines()
        if line and not line.startswith("#")
    }
    refs = git(
        "-c", "versionsort.suffix=-alpha", "-c", "versionsort.suffix=-beta",
        "-c", "versionsort.suffix=-rc", "for-each-ref", "--sort=version:refname",
        "--format=%(refname:strip=2)", "refs/upstream-tags/",
    ).splitlines()
    tags = [tag for tag in refs if RELEASE_TAG.fullmatch(tag)]
    completed = set(git(
        "for-each-ref", "--format=%(refname:strip=3)", "refs/tags/fork-built/"
    ).splitlines())
    tag = select_tag(tags, baseline, completed, os.environ.get("REQUESTED_TAG", ""))
    outputs = {"tag": tag}
    if tag:
        main_sha = git("rev-parse", "refs/remotes/origin/main")
        upstream_sha = git("rev-parse", f"refs/upstream-tags/{tag}^{{commit}}")
        branch, sha = merge_release(tag, main_sha)
        git("push", "origin", f"HEAD:refs/heads/{branch}")
        outputs.update(
            sha=sha, main_sha=main_sha, upstream_sha=upstream_sha,
            version=f"{tag}-fork.{sha[:12]}",
            image=f"ghcr.io/{os.environ['GITHUB_REPOSITORY'].lower()}",
            latest=str(tag == tags[-1]).lower(),
        )
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
            summary.write(
                f"### Fork release {tag}\n\n"
                f"- Upstream: `{upstream_sha}`\n- Fork main: `{main_sha}`\n"
                f"- Merged source: `{sha}` on `{branch}`\n"
                f"- Image: `{outputs['image']}:{outputs['version']}`\n"
            )
    else:
        print("No new upstream release tags.")
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        for key, value in outputs.items():
            output.write(f"{key}={value}\n")


if __name__ == "__main__":
    main()
