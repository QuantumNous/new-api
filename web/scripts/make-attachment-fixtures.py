#!/usr/bin/env python3
"""Generate minimal but spec-valid OOXML / PDF fixtures for the attachment parser tests.

Deliberately uses only the standard library so the fixtures are byte-for-byte
reproducible without extra tooling. Run with:

    python3 scripts/make-attachment-fixtures.py <outdir>
"""
import os
import sys
import zipfile
import zlib

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

CONTENT_TYPES_DOCX = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

RELS_DOCX = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

DOCUMENT_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>Quarterly report</w:t></w:r></w:p>
<w:p><w:r><w:t>Revenue grew by 12 percent.</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Highlighted: </w:t></w:r><w:r><w:t>retention up</w:t></w:r></w:p>
</w:body>
</w:document>"""

CONTENT_TYPES_XLSX = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
</Types>"""

RELS_XLSX = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

WORKBOOK_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheets><sheet name="Q1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets>
</workbook>"""

WORKBOOK_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"""

SHARED_STRINGS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
<si><t>Region</t></si>
<si><t>Revenue</t></si>
<si><t>North</t></si>
<si><t>1200</t></si>
</sst>"""

SHEET1 = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
<row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><v>42.5</v></c></row>
</sheetData>
</worksheet>"""

CONTENT_TYPES_PPTX = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
</Types>"""

RELS_PPTX = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"""

PRESENTATION_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldIdLst><p:sldId id="256" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></p:sldIdLst>
</p:presentation>"""

PRESENTATION_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>"""

SLIDE1 = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:txBody><a:p><a:r><a:t>Roadmap 2026</a:t></a:r></a:p><a:p><a:r><a:t>Ship playground attachments</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld>
</p:sld>"""

SLIDE2 = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:txBody><a:p><a:r><a:t>Thanks</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld>
</p:sld>"""


def write_zip(path, parts, stored=()):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, data in parts:
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_STORED if name in stored else zipfile.ZIP_DEFLATED
            zf.writestr(info, data)


write_zip(
    os.path.join(OUT, 'sample.docx'),
    [
        ('[Content_Types].xml', CONTENT_TYPES_DOCX),
        ('_rels/.rels', RELS_DOCX),
        ('word/document.xml', DOCUMENT_XML),
    ],
)

write_zip(
    os.path.join(OUT, 'sample.xlsx'),
    [
        ('[Content_Types].xml', CONTENT_TYPES_XLSX),
        ('_rels/.rels', RELS_XLSX),
        ('xl/workbook.xml', WORKBOOK_XML),
        ('xl/_rels/workbook.xml.rels', WORKBOOK_RELS),
        ('xl/sharedStrings.xml', SHARED_STRINGS),
        ('xl/worksheets/sheet1.xml', SHEET1),
    ],
    # Mixed compression: the central directory walk must honour both methods.
    stored={'xl/sharedStrings.xml'},
)

write_zip(
    os.path.join(OUT, 'sample.pptx'),
    [
        ('[Content_Types].xml', CONTENT_TYPES_PPTX),
        ('_rels/.rels', RELS_PPTX),
        ('ppt/presentation.xml', PRESENTATION_XML),
        ('ppt/_rels/presentation.xml.rels', PRESENTATION_RELS),
        ('ppt/slides/slide1.xml', SLIDE1),
        ('ppt/slides/slide2.xml', SLIDE2),
    ],
)

# Not a zip archive at all: the parser must fail gracefully.
with open(os.path.join(OUT, 'corrupt.xlsx'), 'wb') as fh:
    fh.write(b'not a zip archive at all')


def make_pdf(path, pages):
    """pages: list of list-of-lines. Uses Helvetica, uncompressed content streams."""
    objs = []
    n_pages = len(pages)

    def add(body):
        objs.append(body)
        return len(objs)  # 1-based object number

    catalog_num = None
    pages_num = None
    font_num = None

    # Reserve numbers: 1 catalog, 2 pages, 3 font, then page/content pairs.
    objs = ['', '', '']  # placeholders for 1..3
    font_num = 3
    page_nums = []
    content_nums = []
    for _ in range(n_pages):
        page_nums.append(len(objs) + 1)
        objs.append('')
        content_nums.append(len(objs) + 1)
        objs.append('')

    def set_obj(num, body):
        objs[num - 1] = body

    set_obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
    set_obj(2, '<< /Type /Pages /Kids [%s] /Count %d >>' % (' '.join('%d 0 R' % n for n in page_nums), n_pages))
    set_obj(font_num, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')

    for i, lines in enumerate(pages):
        text = ''.join('BT /F1 18 Tf 72 %d Td (%s) Tj ET\n' % (720 - idx * 26, line.replace('(', r'\(').replace(')', r'\)')) for idx, line in enumerate(lines))
        raw = text.encode('latin-1')
        set_obj(content_nums[i], '<< /Length %d >>\nstream\n%sendstream' % (len(raw), text))
        set_obj(page_nums[i], '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>' % (font_num, content_nums[i]))

    out = bytearray(b'%PDF-1.4\n')
    offsets = []
    for num, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += ('%d 0 obj\n%s\nendobj\n' % (num, body)).encode('latin-1')
    xref_at = len(out)
    out += ('xref\n0 %d\n' % (len(objs) + 1)).encode('latin-1')
    out += b'0000000000 65535 f \n'
    for off in offsets:
        out += ('%010d 00000 n \n' % off).encode('latin-1')
    out += ('trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xref_at)).encode('latin-1')
    with open(path, 'wb') as fh:
        fh.write(bytes(out))


make_pdf(
    os.path.join(OUT, 'sample.pdf'),
    [
        ['Attachment text extraction', 'Page one body'],
        ['Second page line'],
    ],
)

with open(os.path.join(OUT, 'corrupt.pdf'), 'wb') as fh:
    fh.write(b'%PDF-1.4\ngarbage garbage garbage\n%%EOF\n')

print('fixtures written to', OUT)
for name in sorted(os.listdir(OUT)):
    print(' ', name, os.path.getsize(os.path.join(OUT, name)))
