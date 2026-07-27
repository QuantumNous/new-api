#!/usr/bin/env python3
"""Compose the two release manifests from staged desktop artifacts.

Run after every platform build has been staged into one directory:

    python3 make_release_manifests.py --version 0.1.6 --dist dist/ \
        --base-url https://dl.you-box.com/desktop --notes "BoxAI Desktop 0.1.6"

Writes two files next to the artifacts:

  latest.json    Tauri updater manifest. Only platforms whose updater artifact AND its
                 minisign .sig are present are listed — an unsigned update can never
                 install, so a half-published release makes other platforms see no
                 update rather than a broken one.
  releases.json  What the website reads to render the download page: per-platform
                 installer URL, byte size, SHA-256, and whether the installer carries
                 an OS-trusted code signature.

Every URL is pinned to <base-url>/<version>/<asset>, never to a mutable `latest/` path:
a manifest must reference exactly the artifacts it shipped with.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import pathlib
import sys

# Stable asset name -> Tauri platform key. These are the artifacts the updater installs.
UPDATER_ARTIFACTS = {
    "BoxAI-Desktop-macos-arm64.app.tar.gz": "darwin-aarch64",
    "BoxAI-Desktop-windows-setup.exe": "windows-x86_64",
}

# Stable asset name -> what the website shows. `signed` reflects whether the installer
# carries an OS-trusted signature (macOS: Developer ID + notarization; Windows: none yet,
# so the download page must tell users how to get past SmartScreen).
SITE_ARTIFACTS = [
    {
        "asset": "BoxAI-Desktop-macos-arm64.dmg",
        "platform": "macos",
        "arch": "arm64",
        "kind": "dmg",
        "signed": True,
        "minimum_os": "12.0",
    },
    {
        "asset": "BoxAI-Desktop-windows-setup.exe",
        "platform": "windows",
        "arch": "x86_64",
        "kind": "exe",
        "signed": False,
        "minimum_os": "10",
    },
    {
        "asset": "BoxAI-Desktop-windows.msi",
        "platform": "windows",
        "arch": "x86_64",
        "kind": "msi",
        "signed": False,
        "minimum_os": "10",
    },
]


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--version", required=True, help="bare version, e.g. 0.1.6")
    ap.add_argument(
        "--dist", required=True, type=pathlib.Path, help="staged artifacts dir"
    )
    ap.add_argument(
        "--base-url",
        default="https://dl.you-box.com/desktop",
        help="public prefix the artifacts are published under",
    )
    ap.add_argument(
        "--notes", default="", help="release notes line shown in the update prompt"
    )
    args = ap.parse_args()

    base = args.base_url.rstrip("/")
    version_url = f"{base}/{args.version}"
    published_at = (
        datetime.datetime.now(datetime.timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )

    platforms: dict[str, dict[str, str]] = {}
    for asset, platform in UPDATER_ARTIFACTS.items():
        artifact = args.dist / asset
        sig = args.dist / (asset + ".sig")
        if not artifact.exists():
            print(f"warning: {asset} not staged — skipping {platform}", file=sys.stderr)
            continue
        if not sig.exists():
            print(
                f"warning: {asset} has no .sig — skipping {platform} (unsigned updates never install)",
                file=sys.stderr,
            )
            continue
        platforms[platform] = {
            "signature": sig.read_text().strip(),
            "url": f"{version_url}/{asset}",
        }

    if not platforms:
        print(
            "error: no signed updater artifacts staged — refusing to write an empty manifest",
            file=sys.stderr,
        )
        return 1

    downloads = []
    for spec in SITE_ARTIFACTS:
        artifact = args.dist / spec["asset"]
        if not artifact.exists():
            print(
                f"warning: {spec['asset']} not staged — omitted from releases.json",
                file=sys.stderr,
            )
            continue
        downloads.append(
            {
                "platform": spec["platform"],
                "arch": spec["arch"],
                "kind": spec["kind"],
                "signed": spec["signed"],
                "minimum_os": spec["minimum_os"],
                "url": f"{version_url}/{spec['asset']}",
                "filename": spec["asset"],
                "size": artifact.stat().st_size,
                "sha256": sha256(artifact),
            }
        )

    if not downloads:
        print("error: no installer artifacts staged", file=sys.stderr)
        return 1

    (args.dist / "latest.json").write_text(
        json.dumps(
            {
                "version": args.version,
                "notes": args.notes,
                "pub_date": published_at,
                "platforms": platforms,
            },
            indent=2,
        )
        + "\n"
    )
    (args.dist / "releases.json").write_text(
        json.dumps(
            {
                "version": args.version,
                "published_at": published_at,
                "notes": args.notes,
                "downloads": downloads,
            },
            indent=2,
        )
        + "\n"
    )
    print(
        f"wrote latest.json ({', '.join(sorted(platforms))}) "
        f"and releases.json ({len(downloads)} downloads)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
