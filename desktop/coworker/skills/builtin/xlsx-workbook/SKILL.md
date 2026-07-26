---
name: xlsx-workbook
description: Produce Excel (.xlsx) workbooks — data tables, budgets, trackers, exports with formulas, number formats, and charts. Use whenever the deliverable is a spreadsheet.
---

# Excel workbook production

Produce .xlsx files with `openpyxl` via `run_shell`. Write a Python script and run it.

## Workflow

1. Agree the sheet layout first: sheets, header row, column order, which columns are computed.
2. Check the library: `python -c "import openpyxl"`. Install with `pip install openpyxl` if missing.
3. Generate with a script. Core patterns:

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference

wb = Workbook()
ws = wb.active
ws.title = "Budget"

headers = ["Item", "Owner", "Amount", "Notes"]
ws.append(headers)
for cell in ws[1]:
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = PatternFill("solid", fgColor="4472C4")

for row in rows:
    ws.append(row)

ws.append(["Total", "", f"=SUM(C2:C{ws.max_row})", ""])   # real formula, not a computed constant
for col in range(1, len(headers) + 1):
    width = max(len(str(c.value or "")) for c in ws[get_column_letter(col)])
    ws.column_dimensions[get_column_letter(col)].width = min(width + 2, 50)
ws.freeze_panes = "A2"

for cell in ws["C"]:
    cell.number_format = "#,##0.00"

chart = BarChart()
chart.add_data(Reference(ws, min_col=3, min_row=1, max_row=ws.max_row - 1), titles_from_data=True)
chart.set_categories(Reference(ws, min_col=1, min_row=2, max_row=ws.max_row - 1))
ws.add_chart(chart, "F2")

wb.save("budget.xlsx")
```

4. Verify: reload with `openpyxl.load_workbook(path)` and check `ws.max_row` / sample cells. Report the absolute path.

## Guidelines

- Totals and derived cells must be real Excel formulas so the workbook stays live when the user edits values.
- Always set number formats for money/percent columns; never store formatted strings.
- Freeze the header row and auto-size columns for readability.
- Multiple datasets → multiple sheets (`wb.create_sheet("Q2")`), not one sprawling sheet.
- Reading existing workbooks also works via `openpyxl.load_workbook`; preserve the user's sheets and only touch what the task requires.
