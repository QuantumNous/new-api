---
name: "make-a-doc"
description: "Make a doc\nPage-style document, printable out of the box"
---
When making a document (resume, one-pager, memo, letter, report), render it as a paper page on the web AND make it print perfectly with zero tweaking.

# Screen presentation
- Page container: max-width 816px (US Letter at 96dpi), centered (margin auto), white background, ~64–72px padding, a subtle shadow (e.g. 0 2px 12px rgba(0,0,0,0.08)), and 2–4px border-radius. The page sits on a muted neutral body background (e.g. #F0EEE6) so it reads as paper on a desk.
- Multi-page documents: one .page container per page with a visible gap between them.
- Document typography, not web typography: 14–16px body with a clear hierarchy, real inner margins, never edge-to-edge text. Restrained palette — documents are mostly ink on paper.

# Print (the browser's Print must produce a clean document)
- @media print: remove the body background, the page shadow/border/radius, and any on-screen chrome (toolbars, download buttons); the page container becomes width auto, margin 0, padding 0.
- Set @page { margin: 0.75in; } and rely on it for outer margins.
- break-inside: avoid on sections, heading+first-paragraph groups, list items, and table rows so nothing splits awkwardly; break-after: page between .page containers.
- print-color-adjust: exact on any element whose background carries meaning (e.g. a resume's skill tags); otherwise let backgrounds drop.
- Links print legibly in body ink — never rely on hover styling.
