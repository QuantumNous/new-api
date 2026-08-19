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

GCS objects are keyed by item slug and served with Cache-Control
max-age=31536000 (1 year): re-uploading under the same name (--force)
means cached clients may keep seeing the old image for up to max-age.
"""

import argparse
import datetime
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse

import requests

UPSTREAM_RAW = "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main/README.md"
UPSTREAM_ASSET_BASE = "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main/"
IMPORT_BATCH_LIMIT = 100
FIXED_MODEL = "gpt-image-2"

# Upstream "## emoji Title" -> tag. Unknown headings (Resources, Contributing,
# ...) are skipped; when a skipped section carries prompt fences it is recorded
# in PARSE_WARNINGS and main() reports it as a failure (exit 1), so upstream
# category drift cannot silently drop cases.
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
# "**Source:**" / italic "*Source: ...*" / bare "Source:" variants.
SOURCE_MARKER_RE = re.compile(r"\*{0,2}(?<![A-Za-z])Source:\*{0,2}", re.IGNORECASE)
COMMENT_RE = re.compile(r"\*\*Comment:\*\* *(.+)")
# Live README style: "**English Translation:** <text>" on one line (no fence).
INLINE_TRANSLATION_RE = re.compile(r"\*\*English Translation:\*\* *(.+)")


# Unknown H2 section titles that carry ```text prompt fences, collected by the
# most recent parse_readme call (reset at parse start). Pure link sections
# (Resources, Contributing, ... without fences) are not recorded. main() turns
# these into hard failures so upstream category drift cannot silently drop
# cases from the import.
PARSE_WARNINGS = []


def parse_readme(markdown):
    """Parse upstream README into a list of case dicts.

    Side effect: resets and fills PARSE_WARNINGS with the titles of unknown
    H2 sections that contain prompt fences.
    """
    PARSE_WARNINGS.clear()
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
                section_end = next(
                    (p for p, k, _ in marks[idx + 1:] if k == "h2"), len(markdown)
                )
                if "```text" in markdown[pos:section_end]:
                    PARSE_WARNINGS.append(title)
                    print(
                        f"WARNING: skipping unmapped section {title!r} which contains prompt fences",
                        file=sys.stderr,
                    )
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
    marker = SOURCE_MARKER_RE.search(block)
    if marker:
        for label, url in SOURCE_LINK_RE.findall(block[marker.end():]):
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


GPT_IMAGE_COL_RE = re.compile(r"GPT[- ]?Image", re.IGNORECASE)
NON_GPT_COL_RE = re.compile(r"Nano Banana|Reference|Original", re.IGNORECASE)


def split_table_row(line):
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def image_in_cell(cell):
    tag = IMG_TAG_RE.search(cell)
    if tag:
        return tag.group(1)
    md = MD_IMG_RE.search(cell)
    if md:
        return md.group(2)
    return None


def pick_comparison_image(block):
    """In a comparison table, return the image under the GPT-Image column.

    Live README headers: `| Nano Banana 2 | GPT-Image |`,
    `| Reference | GPT-Image | Nano Banana 2 |`, `| GPT Image 1.5 | GPT Image 2 |`.
    Cells are HTML <img alt="image"> (alt useless) or ![alt](url), so the
    header column position decides; alt matching is only a fallback.
    """
    lines = [l for l in block.splitlines() if l.strip().startswith("|")]
    col_idx = None
    for line in lines:
        cells = split_table_row(line)
        candidates = [
            i for i, cell in enumerate(cells)
            if GPT_IMAGE_COL_RE.search(cell) and not NON_GPT_COL_RE.search(cell)
        ]
        if not candidates:
            continue
        preferred = [i for i in candidates if "1.5" not in cells[i]]
        col_idx = (preferred or candidates)[-1]
        break
    if col_idx is None:
        return None
    for line in lines:
        cells = split_table_row(line)
        if col_idx < len(cells):
            img = image_in_cell(cells[col_idx])
            if img:
                return img
    # Fallback: match by alt text when row shape did not line up.
    for alt, src in MD_IMG_RE.findall(block):
        if GPT_IMAGE_COL_RE.search(alt) and not NON_GPT_COL_RE.search(alt) and "1.5" not in alt:
            return src
    return None


def pick_image(block):
    """Single image: <img src>. Comparison table: take the GPT-Image column."""
    comparison = pick_comparison_image(block)
    if comparison:
        return comparison
    tag = IMG_TAG_RE.search(block)
    if tag:
        return tag.group(1)
    md_imgs = MD_IMG_RE.findall(block)
    if md_imgs:
        return md_imgs[0][1]
    return None


def resolve_image_url(src):
    if src.startswith("http://") or src.startswith("https://"):
        return src
    return UPSTREAM_ASSET_BASE + src.lstrip("./")


def image_ext(url, content_type):
    suffix = pathlib.PurePosixPath(urllib.parse.urlsplit(url).path).suffix.lower()
    if suffix in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        return ".jpg" if suffix == ".jpeg" else suffix
    ct = content_type or ""
    for needle, ext in (("png", ".png"), ("webp", ".webp"), ("gif", ".gif")):
        if needle in ct:
            return ext
    return ".jpg"


def gcs_object_exists(gcloud_bin, bucket, name):
    # Note: any gcloud failure (auth, network, ...) is treated as "not found",
    # which just means we re-upload; the subsequent cp surfaces real errors.
    result = subprocess.run(
        [gcloud_bin, "storage", "objects", "describe", f"gs://{bucket}/{name}"],
        capture_output=True,
    )
    return result.returncode == 0


def upload_to_gcs(gcloud_bin, local_path, bucket, name):
    subprocess.run(
        [
            gcloud_bin, "storage", "cp",
            "--cache-control", "public, max-age=31536000",
            str(local_path), f"gs://{bucket}/{name}",
        ],
        check=True,
    )


X_HOSTNAMES = {"x.com", "www.x.com", "twitter.com", "mobile.twitter.com"}


def platform_for(url):
    hostname = (urllib.parse.urlsplit(url).hostname or "").lower()
    if hostname in X_HOSTNAMES:
        return "X"
    if hostname == "mp.weixin.qq.com" or hostname.endswith(".weixin.qq.com") or hostname == "weixin.qq.com":
        return "WeChat"
    return "Web"


def build_import_item(case, slug, image_url, captured_at):
    output = {}
    if case["prompt_en"]:
        output["translation"] = case["prompt_en"]
    if len(case["sources"]) > 1:
        output["extra_sources"] = case["sources"][1:]

    primary = case["sources"][0] if case["sources"] else {"label": "awesome-gpt-image", "url": "https://github.com/ZeroLu/awesome-gpt-image"}
    platform = platform_for(primary["url"])
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


def dedupe_slugs(slugs):
    """Return slugs with -2/-3... suffixes on duplicates, order preserved.

    Used-set algorithm: a generated suffix can itself collide with a later
    (or earlier) literal slug like "foo-2", so uniqueness is checked against
    everything emitted so far, not just the duplicate count per base.
    """
    used = set()
    result = []
    for base in slugs:
        candidate = base
        n = 2
        while candidate in used:
            candidate = f"{base}-{n}"
            n += 1
        used.add(candidate)
        result.append(candidate)
    return result


def main():
    # Windows consoles/redirects may default to a non-UTF-8 codec; prompt text
    # is full of CJK, so an unguarded print could raise UnicodeEncodeError
    # mid-run (worst case right before raise_for_status, mislabeling a batch).
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=os.environ.get("PROMPT_GALLERY_API_BASE", ""))
    parser.add_argument("--token", default=os.environ.get("PROMPT_LIBRARY_IMPORT_TOKEN", ""))
    parser.add_argument("--bucket", default=os.environ.get("PROMPT_GALLERY_BUCKET", ""))
    parser.add_argument("--dry-run", action="store_true", help="parse only; write items.json without upload/import")
    parser.add_argument(
        "--force", action="store_true",
        help="re-upload images even if the GCS object exists; objects are slug-keyed "
             "with 1-year Cache-Control, so cached clients may see the old image for up to max-age",
    )
    parser.add_argument("--out", default="items.json")
    args = parser.parse_args()

    print(f"fetching {UPSTREAM_RAW}")
    readme = requests.get(UPSTREAM_RAW, timeout=30)
    readme.raise_for_status()
    cases = parse_readme(readme.text)
    print(f"parsed {len(cases)} cases")

    # Unknown category sections carrying prompt fences mean the parser dropped
    # cases (upstream drift). Abort before any side effect — image downloads,
    # GCS uploads, import POSTs — so automated retries cannot compound a
    # half-imported state. --dry-run has no side effects and continues: the
    # items.json it writes helps a human diagnose the drift; the drift is
    # recorded as failures there so the run still exits 1 via the summary.
    if PARSE_WARNINGS and not args.dry_run:
        for section in PARSE_WARNINGS:
            print(f"FAILED {section}: unknown category section with prompt fences", file=sys.stderr)
        sys.exit(1)

    captured_at = datetime.date.today().isoformat()
    items, failures = [], []
    # Dedupe up front so GCS object names always match the final item slugs.
    # Keep base slugs too: an empty base (fully non-Latin title) is a per-item
    # failure even when dedupe would suffix a later duplicate to "-2".
    base_slugs = [slugify(case["title"]) for case in cases]
    final_slugs = dedupe_slugs(base_slugs)

    if args.dry_run:
        # Category drift is a failure in dry-run too, but recorded through the
        # summary machinery instead of an early exit: items.json still gets
        # written below so a human can diagnose, then the run exits 1.
        for section in PARSE_WARNINGS:
            failures.append({"title": section, "reason": "unknown category section with prompt fences"})
            print(f"FAILED {section}: unknown category section with prompt fences", file=sys.stderr)
        for case, base, slug in zip(cases, base_slugs, final_slugs):
            if not base:
                failures.append({"title": case["title"], "reason": "empty slug after slugify"})
                print(f"FAILED {case['title']}: empty slug after slugify", file=sys.stderr)
                continue
            items.append(build_import_item(case, slug, resolve_image_url(case["image_src"]), captured_at))
    else:
        if not args.bucket:
            sys.exit("--bucket is required unless --dry-run")
        gcloud_bin = shutil.which("gcloud")
        if gcloud_bin is None:
            sys.exit("gcloud not found on PATH")
        with tempfile.TemporaryDirectory() as tmp:
            for case, base, slug in zip(cases, base_slugs, final_slugs):
                if not base:
                    failures.append({"title": case["title"], "reason": "empty slug after slugify"})
                    print(f"FAILED {case['title']}: empty slug after slugify", file=sys.stderr)
                    continue
                src_url = resolve_image_url(case["image_src"])
                try:
                    resp = requests.get(src_url, timeout=60)
                    resp.raise_for_status()
                    ext = image_ext(src_url, resp.headers.get("content-type"))
                    object_name = f"prompt-gallery/{slug}{ext}"
                    if args.force or not gcs_object_exists(gcloud_bin, args.bucket, object_name):
                        local = pathlib.Path(tmp) / f"{slug}{ext}"
                        local.write_bytes(resp.content)
                        upload_to_gcs(gcloud_bin, local, args.bucket, object_name)
                        print(f"uploaded {object_name}")
                    else:
                        print(f"exists, skip {object_name}")
                    gcs_url = f"https://storage.googleapis.com/{args.bucket}/{object_name}"
                    items.append(build_import_item(case, slug, gcs_url, captured_at))
                except Exception as exc:  # noqa: BLE001 - continue on per-item failure
                    failures.append({"title": case["title"], "reason": str(exc)})
                    print(f"FAILED {case['title']}: {exc}", file=sys.stderr)

    pathlib.Path(args.out).write_text(json.dumps({"items": items}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(items)} items to {args.out}; {len(failures)} failures")

    batch_errors = []
    if not args.dry_run:
        if not args.api_base or not args.token:
            sys.exit("--api-base and --token are required to import (or rerun with --dry-run)")
        for start in range(0, len(items), IMPORT_BATCH_LIMIT):
            batch_no = start // IMPORT_BATCH_LIMIT + 1
            batch = items[start:start + IMPORT_BATCH_LIMIT]
            try:
                resp = requests.post(
                    f"{args.api_base.rstrip('/')}/api/prompt-library/import",
                    json={"items": batch},
                    headers={"Authorization": f"Bearer {args.token}"},
                    timeout=60,
                )
                print(f"batch {batch_no}: HTTP {resp.status_code} {resp.text[:400]}")
                resp.raise_for_status()
            except Exception as exc:  # noqa: BLE001 - keep importing remaining batches
                batch_errors.append(f"batch {batch_no}: {exc}")
                print(f"FAILED batch {batch_no}: {exc}", file=sys.stderr)

    if failures:
        print("failures summary:")
        for failure in failures:
            print(f"  - {failure['title']}: {failure['reason']}")
    if batch_errors:
        print("batch errors:")
        for err in batch_errors:
            print(f"  - {err}")
    if failures or batch_errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
