import textwrap

from import_awesome_gpt_image import parse_readme, slugify

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
