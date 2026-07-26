---
name: docx-report
description: Produce polished Word (.docx) documents — reports, proposals, briefs, letters, meeting summaries. Use whenever the deliverable is a .docx file with proper headings, styles, tables, or a title page.
---

# Word document production

Produce .docx files with `python-docx` via `run_shell`. Write a small Python script and run it; never hand-assemble OOXML.

## Workflow

1. Confirm the content outline first: title, sections, and any data tables. Draft the text before touching the file.
2. Check the library: `python -c "import docx"`. If missing, install with `pip install python-docx` (ask approval as usual).
3. Generate with a script. Core patterns:

```python
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()
doc.core_properties.title = "Q3 Review"

title = doc.add_heading("Q3 Business Review", level=0)   # title style
doc.add_paragraph("Prepared for Acme Corp").alignment = WD_ALIGN_PARAGRAPH.CENTER

doc.add_heading("Summary", level=1)
p = doc.add_paragraph()
p.add_run("Revenue grew ").bold = False
p.add_run("18%").bold = True

table = doc.add_table(rows=1, cols=3)
table.style = "Light Grid Accent 1"
hdr = table.rows[0].cells
hdr[0].text, hdr[1].text, hdr[2].text = "Region", "Q2", "Q3"
for region, q2, q3 in data:
    row = table.add_row().cells
    row[0].text, row[1].text, row[2].text = region, f"{q2:,}", f"{q3:,}"

doc.add_page_break()
doc.save("report.docx")
```

4. Save into the workspace (or the session's writable root) with a descriptive filename.
5. Verify: reopen with `docx.Document(path)` and assert paragraph/table counts, or list `doc.paragraphs[:5]`. Report the absolute path of the finished file.

## Guidelines

- Use built-in heading levels (0–3) and table styles instead of manual font fiddling; they keep the document consistent and themeable in Word.
- Long documents: add a page break before each top-level section.
- Numbers in tables: right-align and thousands-separate (`f"{n:,}"`).
- Keep one script per document so a re-run regenerates it deterministically.
- If the user supplies a .docx template, open it (`Document("template.docx")`) and append; do not rebuild their styling from scratch.
