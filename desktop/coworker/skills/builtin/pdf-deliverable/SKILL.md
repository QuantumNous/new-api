---
name: pdf-deliverable
description: Produce typeset PDF documents — reports, letters, invoices, one-pagers, certificates. Use whenever the final deliverable is a PDF (not when merely reading a PDF; the app reads PDFs natively).
---

# PDF production

Produce PDFs with `reportlab` via `run_shell`. For content-heavy documents prefer platypus (flowables) over raw canvas drawing.

## Workflow

1. Confirm content and page format first (A4 vs letter, portrait vs landscape).
2. Check the library: `python -c "import reportlab"`. Install with `pip install reportlab` if missing.
3. Generate with a script. Core patterns:

```python
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)

styles = getSampleStyleSheet()
h1, body = styles["Heading1"], styles["BodyText"]

story = [
    Paragraph("Monthly Operations Report", styles["Title"]),
    Spacer(1, 6 * mm),
    Paragraph("Summary", h1),
    Paragraph("All systems nominal. Two incidents resolved.", body),
]

data = [["Service", "Uptime", "Incidents"], ["API", "99.98%", "1"], ["Web", "99.99%", "1"]]
table = Table(data, hAlign="LEFT")
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4472C4")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
    ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
]))
story.append(table)

SimpleDocTemplate("report.pdf", pagesize=A4,
                  leftMargin=20 * mm, rightMargin=20 * mm,
                  topMargin=18 * mm, bottomMargin=18 * mm).build(story)
```

4. Verify the file exists and is non-trivial (`ls -la`), then report the absolute path. The app can preview PDFs, so the user can open it in place.

## Guidelines

- CJK / Vietnamese text: register a Unicode font first, or glyphs render as black boxes:

```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("Body", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"))
```

  Then use `ParagraphStyle(..., fontName="Body")`. On Windows try `C:\\Windows\\Fonts\\arialuni.ttf` or `msyh.ttc`.
- Page headers/footers: pass `onPage` callbacks (`doc.build(story, onFirstPage=fn, onLaterPages=fn)`) drawing with the canvas (page numbers, footer rule).
- Invoices/certificates with exact positioning: use `reportlab.pdfgen.canvas` directly instead of platypus.
- Keep one script per document for deterministic regeneration.
