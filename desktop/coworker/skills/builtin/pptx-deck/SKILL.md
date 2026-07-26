---
name: pptx-deck
description: Produce PowerPoint (.pptx) presentations — pitch decks, review decks, training slides with title/content layouts, bullet hierarchies, tables, and images. Use whenever the deliverable is a slide deck.
---

# PowerPoint deck production

Produce .pptx files with `python-pptx` via `run_shell`. Write a Python script and run it.

## Workflow

1. Outline the deck first and get it confirmed: one line per slide (title + key points). A good deck is written before it is rendered.
2. Check the library: `python -c "import pptx"`. Install with `pip install python-pptx` if missing.
3. Generate with a script. Core patterns:

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation()                      # or Presentation("template.pptx")
prs.slide_width, prs.slide_height = Inches(13.33), Inches(7.5)   # 16:9

title_slide = prs.slides.add_slide(prs.slide_layouts[0])
title_slide.shapes.title.text = "2026 Product Review"
title_slide.placeholders[1].text = "Team · July 2026"

slide = prs.slides.add_slide(prs.slide_layouts[1])    # Title and Content
slide.shapes.title.text = "Highlights"
body = slide.placeholders[1].text_frame
body.text = "Shipped desktop app"                      # first bullet
for text, level in [("Beta on macOS + Windows", 1), ("Grew MAU 24%", 0)]:
    p = body.add_paragraph()
    p.text, p.level = text, level

pic_slide = prs.slides.add_slide(prs.slide_layouts[5])  # Title Only
pic_slide.shapes.title.text = "Architecture"
pic_slide.shapes.add_picture("diagram.png", Inches(1), Inches(1.5), width=Inches(11))

prs.save("deck.pptx")
```

4. Verify: reload with `Presentation(path)` and check `len(prs.slides)` and slide titles. Report the absolute path.

## Guidelines

- One idea per slide; at most ~6 bullets, each under ~10 words. Move detail to speaker notes (`slide.notes_slide.notes_text_frame.text`).
- Use layout placeholders (`slide_layouts[0/1/5]`) rather than free-floating textboxes so the user's template theming applies.
- If the user provides a company template .pptx, start from it — layouts and brand colors come free.
- Tables: `shapes.add_table(rows, cols, left, top, width, height)`; keep them small, decks are not spreadsheets.
- Charts are usually better rendered as an image (matplotlib → PNG → `add_picture`) than as native pptx charts.
