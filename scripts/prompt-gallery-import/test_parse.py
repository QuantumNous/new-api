import json
import sys
import textwrap

import pytest

import import_awesome_gpt_image as script
from import_awesome_gpt_image import (
    PARSE_WARNINGS,
    dedupe_slugs,
    image_ext,
    parse_readme,
    platform_for,
    slugify,
)

SAMPLE = textwrap.dedent('''
    ## 📷 Photography & Realism

    ### Rice Grain Micro Typography
    <img width="500" alt="Rice Grain Micro Typography" src="https://pbs.twimg.com/media/HGc-2eKWYAATrs9?format=jpg&name=large" />

    **Prompt:**
    ```text
    A massive pile of rice, and on one single grain of rice there is tiny text that reads "wOw"
    ```
    **Source:** [@adonis_singh](https://x.com/adonis_singh/status/2046673729082560919)

    ### GTA Comparison Case
    | GPT Image 1.5 | GPT Image 2 |
    |:-------------:|:-----------:|
    | ![GPT Image 1.5](https://pbs.twimg.com/media/OLD.jpg) | ![GPT Image 2](https://pbs.twimg.com/media/NEW.jpg) |

    **Prompt:**
    ```text
    gameplay screenshot of a lion fighting an npc
    ```
    **Comment:** funny result
    **Source:** [@flowersslop](https://x.com/flowersslop/status/2040693687500341568) | [OpenNana](https://opennana.com/x)

    ## 🎮 Gaming & Entertainment

    ### Chinese Prompt Case
    <img width="500" alt="Chinese" src="assets/opennana/some-pic.jpg" />

    **Prompt:**
    ```text
    宋朝人的朋友圈截图
    ```
    **English Translation:**
    ```text
    A WeChat Moments screenshot from the Song dynasty
    ```
    **Source:** [@someone](https://x.com/someone/status/1)
''')


def test_slugify():
    assert slugify("Rice Grain Micro Typography") == "rice-grain-micro-typography"
    assert slugify("  A/B: Test!  ") == "a-b-test"


def test_parse_extracts_all_cases():
    cases = parse_readme(SAMPLE)
    assert len(cases) == 3

    first = cases[0]
    assert first["title"] == "Rice Grain Micro Typography"
    assert first["category_tag"] == "photography"
    assert first["image_src"].startswith("https://pbs.twimg.com/media/HGc-2eKWYAATrs9")
    assert first["prompt"].startswith("A massive pile of rice")
    assert first["sources"] == [
        {"label": "@adonis_singh", "url": "https://x.com/adonis_singh/status/2046673729082560919"}
    ]


def test_parse_comparison_takes_gpt_image_2_column():
    case = parse_readme(SAMPLE)[1]
    assert case["image_src"] == "https://pbs.twimg.com/media/NEW.jpg"
    assert case["comment"] == "funny result"
    assert len(case["sources"]) == 2


def test_parse_keeps_translation_and_relative_asset():
    case = parse_readme(SAMPLE)[2]
    assert case["category_tag"] == "gaming"
    assert case["image_src"] == "assets/opennana/some-pic.jpg"
    assert "宋朝人" in case["prompt"]
    assert "Song dynasty" in case["prompt_en"]


def test_parse_inline_translation():
    # The live README puts translations on one line, not in a second fence.
    sample = textwrap.dedent('''
        ## 🎮 Game & Entertainment

        ### Gacha Screen
        <img width="500" alt="Gacha" src="https://pbs.twimg.com/media/AAA.jpg" />

        **Prompt:**
        ```text
        日本のソシャゲのガチャ画面を生成して、
        ```
        **English Translation:** Generate a Japanese social game gacha screen.
        **Source:** [@x](https://x.com/x/status/2)
    ''')
    case = parse_readme(sample)[0]
    assert case["category_tag"] == "gaming"
    assert case["prompt_en"] == "Generate a Japanese social game gacha screen."


# Live README comparison-table variants: headers use "GPT-Image" (hyphen),
# competitor "Nano Banana 2" columns, and HTML <img> cells whose alt is just
# "image" — only the header column position identifies the right image.
REAL_TABLE_SAMPLE = textwrap.dedent('''
    ## 🎮 Game & Entertainment

    ### Two Column HTML Cells
    | Nano Banana 2 | GPT-Image |
    |:-------------:|:---------:|
    | <img width="400" alt="image" src="https://example.com/nano.jpg" /> | <img width="400" alt="image" src="https://example.com/gpt.jpg" />|

    **Prompt:**
    ```text
    convenience store at night
    ```
    *Source: [卡尔的AI沃茨](https://mp.weixin.qq.com/s/abc)*

    ### Reference Middle Column
    | Reference | GPT-Image | Nano Banana 2 |
    |:---------:|:---------:|:-------------:|
    | <img alt="image" src="https://example.com/ref.jpg" /> | <img alt="image" src="https://example.com/gpt-mid.jpg" /> | <img alt="image" src="https://example.com/nano2.jpg" /> |

    **Prompt:**
    ```text
    pet brand poster
    ```

    ### Original Last Column
    | Original | Nano Banana 2 | GPT-Image |
    |:--------:|:-------------:|:---------:|
    | ![Original](https://example.com/orig.jpg) | ![Nano Banana 2](https://example.com/nano3.jpg) | ![GPT-Image](https://example.com/gpt-last.jpg) |

    **Prompt:**
    ```text
    comic page coloring
    ```
    **Source:** [@x](https://x.com/x/status/3)
''')


def test_parse_real_comparison_tables_take_gpt_image_column():
    cases = parse_readme(REAL_TABLE_SAMPLE)
    assert [c["image_src"] for c in cases] == [
        "https://example.com/gpt.jpg",
        "https://example.com/gpt-mid.jpg",
        "https://example.com/gpt-last.jpg",
    ]


def test_parse_italic_source_line():
    case = parse_readme(REAL_TABLE_SAMPLE)[0]
    assert case["sources"] == [
        {"label": "卡尔的AI沃茨", "url": "https://mp.weixin.qq.com/s/abc"}
    ]


def test_dedupe_slugs():
    assert dedupe_slugs(["a", "a", "b", "a"]) == ["a", "a-2", "b", "a-3"]
    assert dedupe_slugs([]) == []


def test_dedupe_slugs_suffix_collision_with_literal():
    # A generated "-2" suffix can collide with a literal "foo-2" slug; the
    # used-set walk must keep first occurrences stable and everything unique.
    result = dedupe_slugs(["foo", "foo-2", "foo"])
    assert result == ["foo", "foo-2", "foo-3"]
    assert len(set(result)) == len(result)
    # Literal arriving after the generated suffix collides the other way.
    result2 = dedupe_slugs(["foo", "foo", "foo-2"])
    assert result2[0] == "foo"
    assert result2[1] == "foo-2"  # first duplicate keeps the lowest free suffix
    assert len(set(result2)) == len(result2)


def test_parse_records_unknown_section_with_fences_as_warning():
    sample = textwrap.dedent('''
        ## 📷 Photography & Realism

        ### Known Case
        <img width="500" alt="k" src="https://example.com/k.jpg" />

        **Prompt:**
        ```text
        known prompt
        ```

        ## 🧪 Brand New Category

        ### Dropped Case
        <img width="500" alt="d" src="https://example.com/d.jpg" />

        **Prompt:**
        ```text
        dropped prompt
        ```
    ''')
    cases = parse_readme(sample)
    assert [c["title"] for c in cases] == ["Known Case"]
    assert PARSE_WARNINGS == ["🧪 Brand New Category"]


DRIFTED_README = textwrap.dedent('''
    ## 📷 Photography & Realism

    ### Known Case
    <img width="500" alt="k" src="https://example.com/k.jpg" />

    **Prompt:**
    ```text
    known prompt
    ```
    **Source:** [@k](https://x.com/k/status/1)

    ## 🧪 Brand New Category

    ### Dropped Case
    <img width="500" alt="d" src="https://example.com/d.jpg" />

    **Prompt:**
    ```text
    dropped prompt
    ```
''')


class _FakeReadmeResponse:
    def __init__(self, text):
        self.text = text

    def raise_for_status(self):
        pass


def _run_main_with_drifted_readme(monkeypatch, argv):
    fetched_urls = []

    def fake_get(url, **kwargs):
        fetched_urls.append(url)
        if url == script.UPSTREAM_RAW:
            return _FakeReadmeResponse(DRIFTED_README)
        raise AssertionError(f"unexpected download of {url!r} after category drift")

    monkeypatch.setattr(script.requests, "get", fake_get)
    monkeypatch.setattr(
        script, "upload_to_gcs",
        lambda *a, **k: (_ for _ in ()).throw(AssertionError("upload attempted after category drift")),
    )
    monkeypatch.setattr(sys, "argv", argv)
    with pytest.raises(SystemExit) as excinfo:
        script.main()
    return excinfo.value.code, fetched_urls


def test_main_exits_before_side_effects_on_unknown_section(monkeypatch, tmp_path):
    # Non-dry-run: category drift must abort BEFORE any image download, GCS
    # upload, or import POST — only the README fetch may have happened.
    code, fetched_urls = _run_main_with_drifted_readme(
        monkeypatch,
        ["import_awesome_gpt_image.py", "--bucket", "b", "--api-base", "https://h", "--token", "t",
         "--out", str(tmp_path / "items.json")],
    )
    assert code == 1
    assert fetched_urls == [script.UPSTREAM_RAW]
    assert not (tmp_path / "items.json").exists()


def test_main_dry_run_still_writes_items_then_exits_1_on_unknown_section(monkeypatch, tmp_path):
    # Dry-run has no side effects: items.json is still written (it helps a
    # human diagnose the drift) and the known-category cases are in it, but
    # the run must still exit 1.
    out = tmp_path / "items.json"
    code, fetched_urls = _run_main_with_drifted_readme(
        monkeypatch,
        ["import_awesome_gpt_image.py", "--dry-run", "--out", str(out)],
    )
    assert code == 1
    assert fetched_urls == [script.UPSTREAM_RAW]
    written = json.loads(out.read_text(encoding="utf-8"))
    assert [item["slug"] for item in written["items"]] == ["known-case"]


def test_parse_stays_silent_on_pure_link_sections():
    sample = textwrap.dedent('''
        ## 📷 Photography & Realism

        ### Known Case
        <img width="500" alt="k" src="https://example.com/k.jpg" />

        **Prompt:**
        ```text
        known prompt
        ```

        ## Resources

        - [Some link](https://example.com)

        ## Contributing

        PRs welcome.
    ''')
    cases = parse_readme(sample)
    assert len(cases) == 1
    assert PARSE_WARNINGS == []


def test_parse_warnings_reset_between_runs():
    with_warning = textwrap.dedent('''
        ## 🧪 Unknown Section

        ### Case
        <img alt="x" src="https://example.com/x.jpg" />

        **Prompt:**
        ```text
        p
        ```
    ''')
    parse_readme(with_warning)
    assert PARSE_WARNINGS == ["🧪 Unknown Section"]
    parse_readme(SAMPLE)
    assert PARSE_WARNINGS == []


def test_image_ext_uses_url_path_suffix():
    # Extension must come from the URL path, not substrings elsewhere in the URL.
    assert image_ext("https://h/x.png?format=jpg", None) == ".png"
    assert image_ext("https://h/a.jpeg", None) == ".jpg"
    assert image_ext("https://h/a.webp", None) == ".webp"
    # No path suffix: fall back to content-type, then .jpg.
    assert image_ext("https://h/assets/abc123", "image/png") == ".png"
    assert image_ext("https://h/assets/abc123", "image/webp") == ".webp"
    assert image_ext("https://h/assets/abc123", "image/gif") == ".gif"
    assert image_ext("https://h/assets/abc123", None) == ".jpg"
    # ".jpg" appearing only in the query string must not count.
    assert image_ext("https://h/assets/abc?name=x.jpg", "image/png") == ".png"


def test_platform_for_uses_hostname():
    assert platform_for("https://x.com/u/status/1") == "X"
    assert platform_for("https://www.x.com/u/status/1") == "X"
    assert platform_for("https://twitter.com/u/status/1") == "X"
    assert platform_for("https://mobile.twitter.com/u/status/1") == "X"
    assert platform_for("https://mp.weixin.qq.com/s/abc") == "WeChat"
    # "x.com" as a substring of another host must not classify as X.
    assert platform_for("https://www.wix.com/site") == "Web"
    assert platform_for("https://opennana.com/x") == "Web"
