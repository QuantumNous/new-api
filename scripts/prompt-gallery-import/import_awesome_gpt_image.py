#!/usr/bin/env python3
"""Import awesome-gpt-image prompts into flatkey prompt-library.

Pipeline: fetch upstream README -> parse cases -> download images ->
upload to GCS via `gcloud storage cp` -> POST /api/prompt-library/import.

Usage:
  python import_awesome_gpt_image.py --dry-run
  python import_awesome_gpt_image.py \
      --api-base https://<host> --token $PROMPT_LIBRARY_IMPORT_TOKEN \
      --bucket <bucket-name>

Upstream: https://github.com/ZeroLu/awesome-gpt-image (CC BY 4.0).
Attribution is preserved per-item in source/label and output.extra_sources.
"""

import argparse
import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

import requests

UPSTREAM_RAW = "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main/README.md"
UPSTREAM_ASSET_BASE = "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main/"
IMPORT_BATCH_LIMIT = 100
FIXED_MODEL = "gpt-image-2"

# Upstream "## emoji Title" -> tag. Parser raises on unknown category so new
# upstream sections surface loudly instead of being silently skipped.
CATEGORY_TAGS = {
    "photography": "photography",
    "gaming": "gaming",
    "game": "gaming",  # upstream heading is "Game & Entertainment"
    "ui/ux": "ui-ux",
    "video": "video-animation",
    "typography": "typography-poster",
    "infographic": "infographic",
    "character": "character-consistency",
    "editing": "image-editing",
}


def slugify(title):
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def category_tag_for(heading):
    lowered = heading.lower()
    for needle, tag in CATEGORY_TAGS.items():
        if needle in lowered:
            return tag
    raise ValueError(f"unknown category heading: {heading!r}")


CASE_RE = re.compile(r"^### +(.+?) *$", re.MULTILINE)
H2_RE = re.compile(r"^## +(.+?) *$", re.MULTILINE)
IMG_TAG_RE = re.compile(r'<img[^>]*?src="([^"]+)"', re.IGNORECASE)
MD_IMG_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
FENCE_RE = re.compile(r"```text\n(.*?)```", re.DOTALL)
SOURCE_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")
COMMENT_RE = re.compile(r"\*\*Comment:\*\* *(.+)")
# Live README style: "**English Translation:** <text>" on one line (no fence).
INLINE_TRANSLATION_RE = re.compile(r"\*\*English Translation:\*\* *(.+)")


def parse_readme(markdown):
    """Parse upstream README into a list of case dicts."""
    headings = [(m.start(), "h2", m.group(1)) for m in H2_RE.finditer(markdown)]
    cases_pos = [(m.start(), "h3", m.group(1)) for m in CASE_RE.finditer(markdown)]
    marks = sorted(headings + cases_pos)

    cases = []
    current_category = None
    for idx, (pos, kind, title) in enumerate(marks):
        if kind == "h2":
            try:
                current_category = category_tag_for(title)
            except ValueError:
                current_category = None  # Resources/Contributing etc.
            continue
        if current_category is None:
            continue
        end = marks[idx + 1][0] if idx + 1 < len(marks) else len(markdown)
        block = markdown[pos:end]
        case = parse_case_block(title.strip(), current_category, block)
        if case:
            cases.append(case)
    return cases


def parse_case_block(title, category_tag, block):
    fences = FENCE_RE.findall(block)
    if not fences:
        return None  # a block without a prompt is not a case
    prompt = fences[0].strip()
    prompt_en = ""
    if len(fences) >= 2 and "**English Translation:**" in block:
        prompt_en = fences[1].strip()
    else:
        inline = INLINE_TRANSLATION_RE.search(block)
        if inline:
            prompt_en = inline.group(1).strip()

    image_src = pick_image(block)
    if not image_src:
        return None

    sources = []
    source_section = block.split("**Source:**", 1)
    if len(source_section) == 2:
        for label, url in SOURCE_LINK_RE.findall(source_section[1]):
            sources.append({"label": label, "url": url})

    comment_match = COMMENT_RE.search(block)
    return {
        "title": title,
        "category_tag": category_tag,
        "prompt": prompt,
        "prompt_en": prompt_en,
        "image_src": image_src,
        "comment": comment_match.group(1).strip() if comment_match else "",
        "sources": sources,
    }


def pick_image(block):
    """Single image: <img src>. Comparison table: take the 'GPT Image 2' column."""
    md_imgs = MD_IMG_RE.findall(block)
    if md_imgs and "| GPT Image" in block:
        for alt, src in md_imgs:
            if "2" in alt and "1.5" not in alt:
                return src
        return md_imgs[-1][1]
    tag = IMG_TAG_RE.search(block)
    if tag:
        return tag.group(1)
    if md_imgs:
        return md_imgs[0][1]
    return None


def resolve_image_url(src):
    if src.startswith("http://") or src.startswith("https://"):
        return src
    return UPSTREAM_ASSET_BASE + src.lstrip("./")


def image_ext(url, content_type):
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        if ext in url.lower():
            return ".jpg" if ext == ".jpeg" else ext
    if "png" in (content_type or ""):
        return ".png"
    return ".jpg"


def gcs_object_exists(bucket, name):
    result = subprocess.run(
        ["gcloud", "storage", "objects", "describe", f"gs://{bucket}/{name}"],
        capture_output=True,
    )
    return result.returncode == 0


def upload_to_gcs(local_path, bucket, name):
    subprocess.run(
        [
            "gcloud", "storage", "cp",
            "--cache-control", "public, max-age=31536000",
            str(local_path), f"gs://{bucket}/{name}",
        ],
        check=True,
    )


def build_import_item(case, image_url, captured_at):
    slug = slugify(case["title"])
    output = {}
    if case["prompt_en"]:
        output["translation"] = case["prompt_en"]
    if len(case["sources"]) > 1:
        output["extra_sources"] = case["sources"][1:]

    primary = case["sources"][0] if case["sources"] else {"label": "awesome-gpt-image", "url": "https://github.com/ZeroLu/awesome-gpt-image"}
    platform = "X" if "x.com" in primary["url"] else ("WeChat" if "weixin" in primary["url"] else "Web")
    item = {
        "slug": slug,
        "category": "image",
        "model": FIXED_MODEL,
        "prompt": case["prompt"],
        "title": {"en": case["title"]},
        "tags": [case["category_tag"]],
        "artifact": {"kind": "image", "url": image_url, "alt": case["title"]},
        "source": {
            "label": primary["label"],
            "platform": platform,
            "url": primary["url"],
            "captured_at": captured_at,
        },
    }
    if case["comment"]:
        item["summary"] = {"en": case["comment"]}
    if output:
        item["output"] = output
    return item


def dedupe_slugs(items):
    seen = {}
    for item in items:
        base = item["slug"]
        if base in seen:
            seen[base] += 1
            item["slug"] = f"{base}-{seen[base]}"
        else:
            seen[base] = 1
    return items


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=os.environ.get("PROMPT_GALLERY_API_BASE", ""))
    parser.add_argument("--token", default=os.environ.get("PROMPT_LIBRARY_IMPORT_TOKEN", ""))
    parser.add_argument("--bucket", default=os.environ.get("PROMPT_GALLERY_BUCKET", ""))
    parser.add_argument("--dry-run", action="store_true", help="parse only; write items.json without upload/import")
    parser.add_argument("--force", action="store_true", help="re-upload images even if the GCS object exists")
    parser.add_argument("--out", default="items.json")
    args = parser.parse_args()

    print(f"fetching {UPSTREAM_RAW}")
    readme = requests.get(UPSTREAM_RAW, timeout=30)
    readme.raise_for_status()
    cases = parse_readme(readme.text)
    print(f"parsed {len(cases)} cases")

    captured_at = datetime.date.today().isoformat()
    items, failures = [], []

    if args.dry_run:
        for case in cases:
            items.append(build_import_item(case, resolve_image_url(case["image_src"]), captured_at))
    else:
        if not args.bucket:
            sys.exit("--bucket is required unless --dry-run")
        with tempfile.TemporaryDirectory() as tmp:
            for case in cases:
                slug = slugify(case["title"])
                src_url = resolve_image_url(case["image_src"])
                try:
                    resp = requests.get(src_url, timeout=60)
                    resp.raise_for_status()
                    ext = image_ext(src_url, resp.headers.get("content-type"))
                    object_name = f"prompt-gallery/{slug}{ext}"
                    if args.force or not gcs_object_exists(args.bucket, object_name):
                        local = pathlib.Path(tmp) / f"{slug}{ext}"
                        local.write_bytes(resp.content)
                        upload_to_gcs(local, args.bucket, object_name)
                        print(f"uploaded {object_name}")
                    else:
                        print(f"exists, skip {object_name}")
                    gcs_url = f"https://storage.googleapis.com/{args.bucket}/{object_name}"
                    items.append(build_import_item(case, gcs_url, captured_at))
                except Exception as exc:  # noqa: BLE001 - continue on per-item failure
                    failures.append({"title": case["title"], "reason": str(exc)})
                    print(f"FAILED {case['title']}: {exc}", file=sys.stderr)

    items = dedupe_slugs(items)
    pathlib.Path(args.out).write_text(json.dumps({"items": items}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(items)} items to {args.out}; {len(failures)} failures")

    if args.dry_run:
        return
    if not args.api_base or not args.token:
        sys.exit("--api-base and --token are required to import (or rerun with --dry-run)")

    for start in range(0, len(items), IMPORT_BATCH_LIMIT):
        batch = items[start:start + IMPORT_BATCH_LIMIT]
        resp = requests.post(
            f"{args.api_base.rstrip('/')}/api/prompt-library/import",
            json={"items": batch},
            headers={"Authorization": f"Bearer {args.token}"},
            timeout=60,
        )
        print(f"batch {start // IMPORT_BATCH_LIMIT + 1}: HTTP {resp.status_code} {resp.text[:400]}")
        resp.raise_for_status()

    if failures:
        print("failures summary:")
        for failure in failures:
            print(f"  - {failure['title']}: {failure['reason']}")


if __name__ == "__main__":
    main()
