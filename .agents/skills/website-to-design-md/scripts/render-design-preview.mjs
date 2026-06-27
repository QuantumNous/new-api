#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const inputArg = process.argv[2] ?? "design.md";
const outputArg = process.argv[3] ?? defaultOutputPath(inputArg);

const inputPath = path.resolve(process.cwd(), inputArg);
const outputPath = path.resolve(process.cwd(), outputArg);
const previewShellTemplate = await fs.readFile(new URL("../assets/design-preview-shell.template.html", import.meta.url), "utf8");

const markdown = await fs.readFile(inputPath, "utf8");
const data = buildDesignData(markdown, inputPath, outputPath);
const html = renderPreviewDocument(data);

await fs.writeFile(outputPath, html, "utf8");
console.log(`Rendered ${path.basename(outputPath)} from ${path.basename(inputPath)}`);

function defaultOutputPath(filePath) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}-preview.html`);
}

function buildDesignData(markdownText, markdownFilePath, htmlFilePath) {
  const documentTitle = extractDocumentTitle(markdownText) ?? path.basename(markdownFilePath, ".md");
  const sections = parseHeadingSections(markdownText, 2).map((section) => ({
    ...section,
    subsections: parseHeadingSections(section.content, 3),
  }));

  const visualTheme = findSection(sections, "Visual Theme");
  const colorPalette = findSection(sections, "Color Palette");
  const typography = findSection(sections, "Typography");
  const components = findSection(sections, "Component");
  const layout = findSection(sections, "Layout");
  const depth = findSection(sections, "Depth");
  const dosAndDonts = findSection(sections, "Do");
  const responsive = findSection(sections, "Responsive");
  const promptGuide = findSection(sections, "Agent Prompt Guide");
  const observedPages = findSection(sections, "Observed Pages");
  const themeModes = findSection(sections, "Theme Modes") ?? findSubsectionAsSection(colorPalette, "Theme Modes");

  const leadParagraphs = getLeadParagraphs(visualTheme?.content ?? "");
  const descriptor = firstSentence(leadParagraphs[0]) ?? "Design system preview";
  const summary = leadParagraphs[1] ?? leadParagraphs[0] ?? "Structured design system extracted from a live website.";
  const keyCharacteristics = parseBulletItems(findSubsectionContent(visualTheme, "Key Characteristics"));

  const colorRows = parseFirstTable(colorPalette?.content ?? "").map((row) => ({
    role: cleanText(row.role),
    name: cleanText(row.semantic_name ?? row.semantic ?? row.name),
    rawValue: cleanText(row.value),
    swatch: extractColor(cleanText(row.value)),
    usage: cleanText(row.usage),
  }));

  const quickColors = parseDefinitionList(findSubsectionContent(promptGuide, "Quick Color Reference"));
  const surfaceDefinitions = parseDefinitionList(findSubsectionContent(colorPalette, "Surface & Overlay"));
  const shadowDefinitions = parseDefinitionList(findSubsectionContent(colorPalette, "Shadows & Depth"));
  const typographyFamilyDefinitions = parseDefinitionList(findSubsectionContent(typography, "Font Family"));
  const themeModeSpec = buildThemeModeSpec(themeModes?.content ?? "");

  const typographyRows = parseFirstTable(findSubsectionContent(typography, "Hierarchy") || typography?.content || "").map(
    (row) => ({
      role: cleanText(row.role),
      font: cleanText(row.font),
      size: cleanText(row.size),
      weight: cleanText(row.weight),
      lineHeight: cleanText(row.line_height),
      tracking: cleanText(row.letter_spacing),
      notes: cleanText(row.notes),
    })
  );

  const spacingDefinitions = parseDefinitionList(findSubsectionContent(layout, "Spacing System"));
  const radiusDefinitions = parseDefinitionList(findSubsectionContent(layout, "Border Radius Scale"));
  const spacingValues = extractRepeatedValues(spacingDefinitions.get("Repeated spacing values") ?? "");
  const baseUnit = spacingDefinitions.get("Base unit") ?? spacingValues[0] ?? "8px";

  const buttonSection = findSubsectionContent(components, "Buttons and Links");
  const primaryButton = parseBoldBlock(buttonSection, "Primary CTA");
  const secondaryButton = parseBoldBlock(buttonSection, "Secondary CTA");
  const cardSection = findSubsectionContent(components, "Cards and Containers");
  const cardDefinitions = parseDefinitionList(cardSection);

  const typographySpec = buildTypographySpec(typographyRows, typographyFamilyDefinitions);
  const spacingSpec = buildSpacingSpec(baseUnit, spacingValues, radiusDefinitions);
  const buttonSpec = buildButtonSpec(primaryButton, secondaryButton, typographySpec, spacingSpec);
  const theme = buildThemeTokens(
    colorRows,
    quickColors,
    surfaceDefinitions,
    shadowDefinitions,
    cardDefinitions,
    typographySpec
  );

  const paletteGroups = splitPalette(colorRows, theme);
  const depthRows = parseFirstTable(depth?.content ?? "").map((row) => ({
    level: cleanText(row.level),
    treatment: cleanText(row.treatment),
    use: cleanText(row.use),
  }));

  const breakpointRows = parseFirstTable(findSubsectionContent(responsive, "Breakpoints") || responsive?.content || "").map(
    (row) => ({
      name: cleanText(row.name),
      width: cleanText(row.width),
      change: cleanText(row.key_changes ?? row.key_change ?? row.changes),
    })
  );

  const doItems = parseBulletItems(findSubsectionContent(dosAndDonts, "Do"));
  const dontItems = parseBulletItems(findSubsectionContent(dosAndDonts, "Don't"));
  const examplePrompts = parseLabeledBullets(findSubsectionContent(promptGuide, "Example Component Prompts"));
  const readyPrompt = getLeadParagraphs(findSubsectionContent(promptGuide, "Ready-to-Use Prompt"))[0] ?? "";
  const quickSummary = getLeadParagraphs(findSubsectionContent(promptGuide, "Quick Summary")).join(" ");
  const observedUrl = extractObservedUrl(observedPages?.content ?? markdownText);
  const relativeMarkdownPath = toPosixPath(
    path.relative(path.dirname(htmlFilePath), markdownFilePath) || path.basename(markdownFilePath)
  );

  return {
    documentTitle,
    markdownText,
    markdownFileName: path.basename(markdownFilePath),
    relativeMarkdownPath,
    descriptor,
    summary,
    keyCharacteristics,
    colorRows,
    paletteGroups,
    typographyRows,
    typographySpec,
    spacingSpec,
    buttonSpec,
    theme,
    depthRows,
    breakpointRows,
    doItems,
    dontItems,
    examplePrompts,
    readyPrompt,
    quickSummary,
    observedUrl,
    themeModeSpec,
    cardDefinitions,
    sections,
    previewHtml: renderStructuredMarkdown(sections, typographySpec, theme, spacingSpec),
  };
}

function renderPreviewDocument(data) {
  const sourceHtml = escapeHtml(data.markdownText);
  const paletteMarkup = renderPaletteCard(data.paletteGroups, data.theme, data.spacingSpec);
  const themeModesMarkup = renderThemeModesCard(data.themeModeSpec, data.theme);
  const typographyMarkup = renderTypographyRows(data.typographyRows, data.typographySpec, data.theme, data.spacingSpec);
  const spacingMarkup = renderSpacingCard(data.spacingSpec);
  const componentMarkup = renderComponentCard(data.buttonSpec, data.cardDefinitions, data.theme, data.typographySpec, data.spacingSpec);
  const systemNotesMarkup = renderSystemNotesCard(data.breakpointRows, data.depthRows);
  const promptMarkup = renderPromptCard(data.examplePrompts, data.readyPrompt, data.quickSummary);
  const doDontMarkup = renderDoDontCard(data.doItems, data.dontItems);

  return applyTemplate(previewShellTemplate, {
    DOCUMENT_TITLE: escapeHtml(data.documentTitle),
    STYLE_BLOCK: buildStyleBlock(data),
    SITE_TITLE: escapeHtml(data.documentTitle),
    DESCRIPTOR: escapeHtml(descriptorForDisplay(data.descriptor)),
    CHIPS: renderHeroChips(data.keyCharacteristics),
    SUMMARY: escapeHtml(data.summary),
    OBSERVED_LINK: renderObservedLink(data.observedUrl),
    PALETTE_MARKUP: paletteMarkup,
    THEME_MODES_MARKUP: themeModesMarkup,
    TYPOGRAPHY_MARKUP: typographyMarkup,
    SPACING_MARKUP: spacingMarkup,
    COMPONENT_MARKUP: componentMarkup,
    SYSTEM_NOTES_MARKUP: systemNotesMarkup,
    PROMPT_MARKUP: promptMarkup,
    DO_DONT_MARKUP: doDontMarkup,
    MARKDOWN_FILENAME: escapeHtml(data.markdownFileName),
    RELATIVE_MARKDOWN_PATH: escapeAttribute(data.relativeMarkdownPath),
    SOURCE_HTML: sourceHtml,
    PREVIEW_HTML: data.previewHtml,
  });
}

function applyTemplate(template, values) {
  return Object.entries(values).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, value),
    template
  );
}

function renderHeroChips(items) {
  return items
    .slice(0, 6)
    .map((item) => `<span class="chip">${escapeHtml(shortChip(item))}</span>`)
    .join("");
}

function renderObservedLink(url) {
  if (!url) {
    return "";
  }

  return `<a class="observed-link" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>`;
}

function buildStyleBlock(data) {
  return `      :root {
        --page-bg: ${escapeCssValue(data.theme.background)};
        --page-bg-muted: ${escapeCssValue(data.theme.backgroundMuted)};
        --surface-bg: ${escapeCssValue(data.theme.surface)};
        --surface-bg-muted: ${escapeCssValue(data.theme.surfaceMuted)};
        --surface-border: ${escapeCssValue(data.theme.border)};
        --surface-border-strong: ${escapeCssValue(data.theme.borderStrong)};
        --surface-shadow: ${escapeCssValue(data.theme.shadow)};
        --surface-shadow-soft: ${escapeCssValue(data.theme.softShadow)};
        --ink: ${escapeCssValue(data.theme.ink)};
        --muted: ${escapeCssValue(data.theme.muted)};
        --subtle: ${escapeCssValue(data.theme.subtle)};
        --accent: ${escapeCssValue(data.theme.accent)};
        --font-body: ${escapeCssValue(data.typographySpec.primaryFamily)};
        --font-display: ${escapeCssValue(data.typographySpec.displayFamily)};
        --font-mono: ${escapeCssValue(data.typographySpec.monoFamily)};
        --body-size: ${escapeCssValue(data.typographySpec.bodySize)};
        --body-line: ${escapeCssValue(data.typographySpec.bodyLineHeight)};
        --body-weight: ${escapeCssValue(data.typographySpec.bodyWeight)};
        --label-size: ${escapeCssValue(data.typographySpec.labelSize)};
        --label-line: ${escapeCssValue(data.typographySpec.labelLineHeight)};
        --label-track: ${escapeCssValue(data.typographySpec.labelTracking)};
        --title-size: ${escapeCssValue(data.typographySpec.previewTitleSize)};
        --title-line: ${escapeCssValue(data.typographySpec.previewTitleLineHeight)};
        --title-track: ${escapeCssValue(data.typographySpec.previewTitleTracking)};
        --section-size: ${escapeCssValue(data.typographySpec.sectionSize)};
        --section-line: ${escapeCssValue(data.typographySpec.sectionLineHeight)};
        --section-track: ${escapeCssValue(data.typographySpec.sectionTracking)};
        --source-size: ${escapeCssValue(data.typographySpec.sourceSize)};
        --source-line: ${escapeCssValue(data.typographySpec.sourceLineHeight)};
        --space-1: ${escapeCssValue(data.spacingSpec.space1)};
        --space-2: ${escapeCssValue(data.spacingSpec.space2)};
        --space-3: ${escapeCssValue(data.spacingSpec.space3)};
        --space-4: ${escapeCssValue(data.spacingSpec.space4)};
        --space-5: ${escapeCssValue(data.spacingSpec.space5)};
        --space-6: ${escapeCssValue(data.spacingSpec.space6)};
        --radius-panel: ${escapeCssValue(data.spacingSpec.panelRadius)};
        --radius-card: ${escapeCssValue(data.spacingSpec.cardRadius)};
        --radius-micro: ${escapeCssValue(data.spacingSpec.microRadius)};
        --radius-pill: ${escapeCssValue(data.spacingSpec.pillRadius)};
        --button-height: ${escapeCssValue(data.buttonSpec.primaryHeight)};
        --button-font-size: ${escapeCssValue(data.buttonSpec.fontSize)};
        --button-weight: ${escapeCssValue(data.buttonSpec.fontWeight)};
        --button-radius: ${escapeCssValue(data.buttonSpec.primaryRadius)};
        --secondary-button-radius: ${escapeCssValue(data.buttonSpec.secondaryRadius)};
        --layout-gap: ${escapeCssValue(data.spacingSpec.layoutGap)};
        --page-padding: ${escapeCssValue(data.spacingSpec.pagePadding)};
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        min-width: 320px;
        color: var(--ink);
        font-family: var(--font-body);
        font-size: var(--body-size);
        font-weight: var(--body-weight);
        line-height: var(--body-line);
        background:
          radial-gradient(circle at top, color-mix(in srgb, var(--accent) 8%, transparent), transparent 30%),
          linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-muted) 100%);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background-image:
          linear-gradient(color-mix(in srgb, var(--surface-border) 56%, transparent) 1px, transparent 1px),
          linear-gradient(90deg, color-mix(in srgb, var(--surface-border) 56%, transparent) 1px, transparent 1px);
        background-size: 100% calc(${escapeCssValue(data.spacingSpec.gridSize)}), calc(${escapeCssValue(data.spacingSpec.gridSize)}) 100%;
        mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.3), transparent 88%);
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      button {
        font: inherit;
      }

      .shell {
        width: min(1440px, calc(100vw - (var(--page-padding) * 2)));
        margin: 0 auto;
        padding: var(--page-padding) 0 calc(var(--page-padding) * 1.2);
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(340px, 0.92fr) minmax(420px, 1fr);
        gap: var(--layout-gap);
        align-items: start;
      }

      .stack {
        display: grid;
        gap: var(--space-4);
      }

      .panel {
        overflow: hidden;
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-panel);
        background: linear-gradient(180deg, color-mix(in srgb, var(--surface-bg) 88%, white) 0%, var(--surface-bg) 100%);
        box-shadow: var(--surface-shadow);
      }

      .panel-inner {
        padding: var(--space-4);
      }

      .hero-card {
        position: relative;
      }

      .hero-card::before {
        content: "";
        position: absolute;
        left: var(--space-4);
        right: var(--space-4);
        top: 0;
        height: 3px;
        border-radius: 999px;
        background: ${escapeCssValue(buildGradientStrip(data.paletteGroups, data.theme))};
      }

      .eyebrow {
        margin-bottom: var(--space-2);
        color: var(--muted);
        font-size: var(--label-size);
        line-height: var(--label-line);
        letter-spacing: var(--label-track);
        text-transform: uppercase;
      }

      .site-title,
      .section-title {
        margin: 0;
        color: var(--ink);
        font-family: var(--font-display);
        font-weight: 600;
      }

      .site-title {
        font-size: var(--title-size);
        line-height: var(--title-line);
        letter-spacing: var(--title-track);
      }

      .descriptor {
        margin: var(--space-2) 0 0;
        max-width: 42ch;
        color: var(--muted);
        font-size: var(--body-size);
        line-height: var(--body-line);
      }

      .summary {
        margin: var(--space-3) 0 0;
        max-width: 56ch;
        color: var(--muted);
        font-size: var(--body-size);
        line-height: var(--body-line);
      }

      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: var(--space-3) 0 0;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        min-height: calc(${escapeCssValue(data.spacingSpec.baseUnit)} * 3);
        padding: 0 var(--space-2);
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-pill);
        background: var(--surface-bg);
        color: var(--ink);
        font-size: var(--label-size);
        line-height: var(--label-line);
        box-shadow: var(--surface-shadow-soft);
      }

      .observed-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin-top: var(--space-4);
        padding-top: var(--space-3);
        border-top: 1px solid var(--surface-border);
        color: var(--muted);
        font-size: var(--label-size);
        overflow-wrap: anywhere;
      }

      .observed-link::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent);
      }

      .section-title {
        font-size: var(--section-size);
        line-height: var(--section-line);
        letter-spacing: var(--section-track);
      }

      .section-subtitle {
        margin: var(--space-2) 0 var(--space-4);
        color: var(--muted);
        font-size: var(--body-size);
        line-height: var(--body-line);
      }

      .palette-grid,
      .theme-mode-grid,
      .type-list,
      .component-card,
      .prompt-list,
      .mini-grid,
      .token-table {
        display: grid;
        gap: var(--space-2);
      }

      .palette-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-2);
      }

      .palette-row.neutral-row {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .theme-mode-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-3);
      }

      .theme-mode-card {
        display: grid;
        gap: var(--space-2);
        padding: var(--space-3);
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-card);
        background: color-mix(in srgb, var(--surface-bg) 92%, white);
      }

      .theme-mode-card.is-dark {
        background: #111111;
        color: #f4f4f4;
        border-color: rgba(255, 255, 255, 0.12);
      }

      .theme-mode-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }

      .theme-mode-label {
        color: var(--subtle);
        font-size: var(--label-size);
        line-height: var(--label-line);
        letter-spacing: var(--label-track);
        text-transform: uppercase;
      }

      .theme-mode-card.is-dark .theme-mode-label {
        color: rgba(255, 255, 255, 0.7);
      }

      .theme-mode-note {
        margin: 0;
        color: var(--muted);
        font-size: calc(var(--body-size) - 1px);
        line-height: calc(var(--body-line) - 4px);
      }

      .theme-mode-card.is-dark .theme-mode-note {
        color: rgba(255, 255, 255, 0.82);
      }

      .theme-swatch-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-2);
      }

      .theme-swatch {
        display: grid;
        gap: 6px;
      }

      .theme-swatch-box {
        height: 72px;
        border-radius: calc(var(--radius-card) - 4px);
        border: 1px solid color-mix(in srgb, var(--surface-border-strong) 75%, transparent);
      }

      .theme-mode-card.is-dark .theme-swatch-box {
        border-color: rgba(255, 255, 255, 0.14);
      }

      .theme-swatch-name {
        color: inherit;
        font-size: 12px;
        line-height: 1.3;
      }

      .theme-swatch-value {
        color: var(--subtle);
        font-size: 11px;
        line-height: 1.3;
      }

      .theme-mode-card.is-dark .theme-swatch-value {
        color: rgba(255, 255, 255, 0.62);
      }

      .swatch {
        display: grid;
        gap: var(--space-2);
      }

      .swatch-box {
        min-height: calc(${escapeCssValue(data.spacingSpec.baseUnit)} * 12);
        border-radius: var(--radius-card);
        border: 1px solid color-mix(in srgb, var(--surface-border-strong) 75%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 4%, transparent);
      }

      .swatch-label,
      .token-heading,
      .prompt-card strong,
      .card-preview h4 {
        color: var(--ink);
        font-family: var(--font-display);
        font-size: var(--body-size);
        line-height: var(--body-line);
        font-weight: 600;
      }

      .swatch-meta,
      .type-metrics,
      .mini-label,
      .copy-state,
      .file-tab,
      .ghost-button,
      .segmented button {
        color: var(--muted);
        font-size: var(--label-size);
        line-height: var(--label-line);
      }

      .type-row {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr) auto;
        gap: var(--space-2);
        align-items: baseline;
        padding: var(--space-2) 0;
        border-top: 1px solid var(--surface-border);
      }

      .type-row:first-child,
      .mini-row:first-child,
      .token-row:first-child {
        border-top: 0;
        padding-top: 0;
      }

      .type-role {
        color: var(--muted);
        font-size: var(--label-size);
        line-height: var(--label-line);
        letter-spacing: var(--label-track);
        text-transform: uppercase;
      }

      .type-sample {
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .split-card {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-4);
      }

      .token-row,
      .mini-row {
        display: grid;
        gap: var(--space-2);
        align-items: start;
        padding-top: var(--space-2);
        border-top: 1px solid var(--surface-border);
      }

      .token-row {
        grid-template-columns: 1fr auto;
      }

      .mini-row {
        grid-template-columns: 88px minmax(0, 1fr);
      }

      .mini-content,
      .prompt-card p,
      .card-preview p {
        color: var(--muted);
        font-size: var(--body-size);
        line-height: var(--body-line);
      }

      .radius-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-2);
      }

      .radius-card,
      .prompt-card {
        padding: var(--space-3);
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-card);
        background: var(--surface-bg-muted);
        box-shadow: var(--surface-shadow-soft);
      }

      .radius-demo {
        aspect-ratio: 1;
        width: 100%;
        border: 1px solid var(--surface-border-strong);
        background: var(--surface-bg);
      }

      .radius-name {
        margin-top: var(--space-2);
        color: var(--ink);
        font-size: var(--body-size);
        line-height: var(--body-line);
        font-weight: 600;
      }

      .radius-value {
        margin-top: 4px;
        color: var(--muted);
        font-size: var(--label-size);
      }

      .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }

      .cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: var(--button-height);
        padding: 0 var(--space-3);
        border-radius: var(--button-radius);
        font-family: var(--font-body);
        font-size: var(--button-font-size);
        font-weight: var(--button-weight);
        line-height: 1;
        letter-spacing: normal;
      }

      .cta-primary {
        border: 1px solid transparent;
        background: ${escapeCssValue(data.buttonSpec.primaryBackground)};
        color: ${escapeCssValue(data.buttonSpec.primaryText)};
        border-radius: ${escapeCssValue(data.buttonSpec.primaryRadius)};
      }

      .cta-secondary {
        border: 1px solid ${escapeCssValue(data.buttonSpec.secondaryBorder)};
        background: ${escapeCssValue(data.buttonSpec.secondaryBackground)};
        color: ${escapeCssValue(data.buttonSpec.secondaryText)};
        border-radius: ${escapeCssValue(data.buttonSpec.secondaryRadius)};
        box-shadow: var(--surface-shadow-soft);
      }

      .card-preview {
        padding: ${escapeCssValue(data.spacingSpec.cardPadding)};
        border-radius: ${escapeCssValue(data.spacingSpec.cardRadius)};
        border: 1px solid color-mix(in srgb, var(--surface-border-strong) 72%, transparent);
        background: var(--surface-bg);
        color: var(--ink);
        box-shadow: ${escapeCssValue(data.theme.shadow)};
      }

      .card-preview h4 {
        margin: 0 0 var(--space-1);
      }

      .source-shell {
        position: sticky;
        top: var(--page-padding);
      }

      .source-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4) var(--space-2);
        border-bottom: 1px solid var(--surface-border);
      }

      .file-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 2px var(--space-3);
      }

      .file-tab {
        padding: 0 0 var(--space-2);
        border-bottom: 2px solid transparent;
      }

      .file-tab.active {
        color: var(--ink);
        border-bottom-color: var(--ink);
        font-weight: 600;
      }

      .source-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-4);
        border-bottom: 1px solid var(--surface-border);
      }

      .segmented {
        display: inline-flex;
        padding: 3px;
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-pill);
        background: var(--surface-bg-muted);
      }

      .segmented button {
        border: 0;
        border-radius: var(--radius-pill);
        background: transparent;
        padding: 6px 12px;
        cursor: pointer;
      }

      .segmented button.is-active {
        background: var(--surface-bg);
        color: var(--ink);
        box-shadow: var(--surface-shadow-soft);
      }

      .toolbar-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-left: auto;
      }

      .ghost-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border: 1px solid var(--surface-border);
        border-radius: ${escapeCssValue(data.spacingSpec.microRadius)};
        background: var(--surface-bg);
        box-shadow: var(--surface-shadow-soft);
        cursor: pointer;
      }

      .source-body {
        max-height: calc(100vh - (var(--page-padding) * 2) - 120px);
        overflow: auto;
      }

      .source-view,
      .rendered-view {
        margin: 0;
        padding: var(--space-4);
      }

      .source-view {
        color: var(--ink);
        font-family: var(--font-mono);
        font-size: var(--source-size);
        line-height: var(--source-line);
        white-space: pre-wrap;
        word-break: break-word;
        background: var(--surface-bg);
      }

      .rendered-view {
        color: var(--ink);
        font-family: var(--font-body);
        font-size: var(--body-size);
        line-height: var(--body-line);
        background: var(--surface-bg);
      }

      .rendered-view[hidden],
      .source-view[hidden] {
        display: none;
      }

      .rendered-view h2,
      .rendered-view h3 {
        margin: var(--space-4) 0 var(--space-2);
        color: var(--ink);
        font-family: var(--font-display);
        font-weight: 600;
      }

      .rendered-view h2 {
        font-size: var(--section-size);
        line-height: var(--section-line);
        letter-spacing: var(--section-track);
      }

      .rendered-view h2:first-child {
        margin-top: 0;
      }

      .rendered-view h3 {
        color: var(--muted);
        font-size: calc(${escapeCssValue(data.typographySpec.previewTitleSize)} - 4px);
        line-height: calc(${escapeCssValue(data.typographySpec.previewTitleLineHeight)} - 4px);
      }

      .rendered-view p,
      .rendered-view li {
        color: var(--muted);
      }

      .rendered-view ul,
      .rendered-view ol {
        margin: 0 0 var(--space-3) 20px;
        padding: 0;
      }

      .rendered-view table {
        width: 100%;
        border-collapse: collapse;
        margin: var(--space-2) 0 var(--space-4);
      }

      .rendered-view th,
      .rendered-view td {
        padding: var(--space-2) var(--space-2);
        border: 1px solid var(--surface-border);
        text-align: left;
        vertical-align: top;
        font-size: var(--label-size);
        line-height: var(--label-line);
      }

      .rendered-view th {
        color: var(--ink);
        background: var(--surface-bg-muted);
      }

      .rendered-view code {
        padding: 0.14em 0.4em;
        border-radius: ${escapeCssValue(data.spacingSpec.microRadius)};
        background: var(--surface-bg-muted);
        color: var(--ink);
        font-family: var(--font-mono);
        font-size: 0.92em;
      }

      @media (max-width: 1120px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .source-shell {
          position: relative;
          top: 0;
        }

        .source-body {
          max-height: none;
        }
      }

      @media (max-width: 760px) {
        .shell {
          width: min(100vw - (${escapeCssValue(data.spacingSpec.space2)} * 2), 100%);
          padding-top: ${escapeCssValue(data.spacingSpec.space2)};
        }

        .panel-inner,
        .source-view,
        .rendered-view {
          padding-left: var(--space-3);
          padding-right: var(--space-3);
        }

        .palette-row,
        .palette-row.neutral-row,
        .theme-mode-grid,
        .theme-swatch-row,
        .split-card,
        .radius-grid {
          grid-template-columns: 1fr;
        }

        .type-row,
        .mini-row {
          grid-template-columns: 1fr;
        }
      }`;
}

function renderPaletteCard(groups, theme, spacingSpec) {
  const primaryRow = groups.primary.length
    ? `<div class="palette-row">${groups.primary.map((item) => renderSwatch(item, theme, spacingSpec)).join("")}</div>`
    : "";
  const neutralRow = groups.neutral.length
    ? `<div class="palette-row neutral-row">${groups.neutral.map((item) => renderSwatch(item, theme, spacingSpec)).join("")}</div>`
    : "";

  return `<div class="palette-grid">${primaryRow}${neutralRow}</div>`;
}

function renderThemeModesCard(themeModeSpec, theme) {
  if (!themeModeSpec.hasModes) {
    return `<div class="prompt-card"><strong>Single mode detected</strong><p>No explicit <code>Theme Modes</code> section was detected in the markdown. If the product supports both light and dark themes, document both so the preview can render them side by side.</p></div>`;
  }

  return `<div class="theme-mode-grid">${[themeModeSpec.light, themeModeSpec.dark]
    .filter(Boolean)
    .map((mode) => renderThemeMode(mode, theme))
    .join("")}</div>`;
}

function renderThemeMode(mode, theme) {
  const swatches = [
    ["Background", mode.background || theme.background],
    ["Surface", mode.surface || theme.surface],
    ["Text", mode.text || theme.ink],
    ["Accent", mode.accent || theme.accent],
  ]
    .map(
      ([label, value]) => `<div class="theme-swatch">
        <div class="theme-swatch-box" style="background:${escapeAttribute(value)};"></div>
        <div class="theme-swatch-name">${escapeHtml(label)}</div>
        <div class="theme-swatch-value">${escapeHtml(value)}</div>
      </div>`
    )
    .join("");

  return `<div class="theme-mode-card ${mode.isDark ? "is-dark" : ""}">
    <div class="theme-mode-head">
      <strong>${escapeHtml(mode.label)}</strong>
      <span class="theme-mode-label">${escapeHtml(mode.isDark ? "Dark" : "Light")}</span>
    </div>
    ${mode.notes ? `<p class="theme-mode-note">${escapeHtml(mode.notes)}</p>` : ""}
    <div class="theme-swatch-row">${swatches}</div>
  </div>`;
}

function renderSwatch(item, theme) {
  const swatch = item.swatch ?? theme.surface;
  return `<div class="swatch">
    <div class="swatch-box" style="background:${escapeAttribute(swatch)};"></div>
    <div class="swatch-label">${escapeHtml(item.name || item.role || "Token")}</div>
    <div class="swatch-meta">
      <span>${escapeHtml(item.rawValue || swatch)}</span>
      <span>${escapeHtml(item.role || item.usage || "")}</span>
    </div>
  </div>`;
}

function renderTypographyRows(rows, typographySpec, theme) {
  if (!rows.length) {
    return `<div class="token-row"><span>No typography table detected.</span><span>${escapeHtml(typographySpec.primaryFamily)}</span></div>`;
  }

  return rows
    .slice(0, 10)
    .map((row) => {
      const sample = /mono/i.test(`${row.role} ${row.font}`) ? "const preview = true;" : "The quick brown fox jumps";
      const fontSize = clampNumber(extractFirstNumber(row.size), 12, 48) ?? extractFirstNumber(typographySpec.bodySize) ?? 16;
      const lineHeight = clampNumber(extractFirstNumber(row.lineHeight), fontSize, 56) ?? Math.round(fontSize * 1.4);
      const weight = clampNumber(extractWeight(row.weight), 300, 700) ?? 500;
      const tracking = extractTracking(row.tracking);
      const fontFamily = /mono/i.test(`${row.role} ${row.font}`) ? typographySpec.monoFamily : typographySpec.displayFamily;

      return `<div class="type-row">
        <div class="type-role">${escapeHtml(row.role || "Type")}</div>
        <div
          class="type-sample"
          style="font-size:${escapeAttribute(`${fontSize}px`)}; line-height:${escapeAttribute(`${lineHeight}px`)}; font-weight:${escapeAttribute(String(weight))}; letter-spacing:${escapeAttribute(tracking)}; font-family:${escapeAttribute(fontFamily)};"
        >
          ${escapeHtml(sample)}
        </div>
        <div class="type-metrics">${escapeHtml(compactMetrics(row))}</div>
      </div>`;
    })
    .join("");
}

function renderSpacingCard(spacingSpec) {
  const spacingRows = spacingSpec.scaleEntries
    .map(
      ([label, value]) => `<div class="token-row">
        <span>${escapeHtml(label)}</span>
        <span>${escapeHtml(value)}</span>
      </div>`
    )
    .join("");

  const radiusRows = spacingSpec.radiusEntries
    .map(
      ([name, value]) => `<div class="radius-card">
        <div class="radius-demo" style="border-radius:${escapeAttribute(value)};"></div>
        <div class="radius-name">${escapeHtml(name)}</div>
        <div class="radius-value">${escapeHtml(value)}</div>
      </div>`
    )
    .join("");

  return `<div class="split-card">
    <div>
      <h3 class="token-heading">Spacing</h3>
      <div class="token-table">${spacingRows}</div>
    </div>
    <div>
      <h3 class="token-heading">Border Radius</h3>
      <div class="radius-grid">${radiusRows}</div>
    </div>
  </div>`;
}

function renderComponentCard(buttonSpec, cardDefinitions, theme, typographySpec, spacingSpec) {
  const cardSummary = cardDefinitions.get("Surface style") || "White framed module with restrained shadow and precise spacing.";

  return `<div class="component-card">
    <div class="button-row">
      <span class="cta cta-primary">Start Deploying</span>
      <span class="cta cta-secondary">Get a Demo</span>
    </div>
    <div class="card-preview">
      <h4>System Card Preview</h4>
      <p>${escapeHtml(cardSummary)}</p>
    </div>
  </div>`;
}

function renderSystemNotesCard(breakpointRows, depthRows) {
  const breakpointMarkup = breakpointRows.length
    ? breakpointRows
        .slice(0, 4)
        .map(
          (row) => `<div class="mini-row">
            <div class="mini-label">${escapeHtml(row.name)}</div>
            <div class="mini-content"><strong>${escapeHtml(row.width)}</strong><br />${escapeHtml(row.change)}</div>
          </div>`
        )
        .join("")
    : `<div class="mini-row"><div class="mini-label">Responsive</div><div class="mini-content">No breakpoint table detected.</div></div>`;

  const depthMarkup = depthRows.length
    ? depthRows
        .slice(0, 4)
        .map(
          (row) => `<div class="mini-row">
            <div class="mini-label">${escapeHtml(row.level)}</div>
            <div class="mini-content"><strong>${escapeHtml(row.treatment)}</strong><br />${escapeHtml(row.use)}</div>
          </div>`
        )
        .join("")
    : `<div class="mini-row"><div class="mini-label">Depth</div><div class="mini-content">No depth table detected.</div></div>`;

  return `<div class="split-card">
    <div>
      <h3 class="token-heading">Breakpoints</h3>
      <div class="mini-grid">${breakpointMarkup}</div>
    </div>
    <div>
      <h3 class="token-heading">Elevation</h3>
      <div class="mini-grid">${depthMarkup}</div>
    </div>
  </div>`;
}

function buildThemeModeSpec(sectionContent) {
  const lightContent = extractNamedSubsection(sectionContent, "Light Mode");
  const darkContent = extractNamedSubsection(sectionContent, "Dark Mode");

  return {
    hasModes: Boolean(lightContent || darkContent),
    light: lightContent ? parseThemeModeVariant("Light Mode", lightContent, false) : null,
    dark: darkContent ? parseThemeModeVariant("Dark Mode", darkContent, true) : null,
  };
}

function parseThemeModeVariant(label, content, isDark) {
  const definitions = parseDefinitionList(content);
  const paragraphs = getLeadParagraphs(content);
  const notes =
    paragraphs.find((paragraph) => paragraph && !paragraph.includes(":")) ??
    cleanText(content.split("\n").find((line) => line.trim() && !line.startsWith("-") && !line.includes(":")) ?? "");

  return {
    label,
    isDark,
    background: extractColor(definitions.get("Background") ?? "") ?? "",
    surface: extractColor(definitions.get("Surface") ?? "") ?? "",
    text: extractColor(definitions.get("Text") ?? "") ?? "",
    accent: extractColor(definitions.get("Accent") ?? "") ?? "",
    notes,
  };
}

function renderPromptCard(examplePrompts, readyPrompt, quickSummary) {
  const summaryBlock = quickSummary
    ? `<div class="prompt-card"><strong>Quick Summary</strong><p>${escapeHtml(quickSummary)}</p></div>`
    : "";

  const promptsMarkup = examplePrompts.length
    ? examplePrompts
        .slice(0, 4)
        .map(
          (item) => `<div class="prompt-card">
            <strong>${escapeHtml(item.label)}</strong>
            <p>${escapeHtml(item.value)}</p>
          </div>`
        )
        .join("")
    : `<div class="prompt-card"><strong>Prompt guide</strong><p>No example prompts detected.</p></div>`;

  const readyBlock = readyPrompt
    ? `<div class="prompt-card"><strong>Ready-to-Use Prompt</strong><p>${escapeHtml(readyPrompt)}</p></div>`
    : "";

  return `<div class="prompt-list">${summaryBlock}${promptsMarkup}${readyBlock}</div>`;
}

function renderDoDontCard(doItems, dontItems) {
  const doMarkup = doItems
    .slice(0, 4)
    .map((item) => `<div class="mini-row"><div class="mini-label">Do</div><div class="mini-content">${escapeHtml(item)}</div></div>`)
    .join("");

  const dontMarkup = dontItems
    .slice(0, 4)
    .map((item) => `<div class="mini-row"><div class="mini-label">Don't</div><div class="mini-content">${escapeHtml(item)}</div></div>`)
    .join("");

  return `<div class="split-card" style="margin-top:var(--space-4);">
    <div>
      <h3 class="token-heading">Do</h3>
      <div class="mini-grid">${doMarkup || `<div class="mini-row"><div class="mini-label">Do</div><div class="mini-content">Not detected.</div></div>`}</div>
    </div>
    <div>
      <h3 class="token-heading">Don't</h3>
      <div class="mini-grid">${dontMarkup || `<div class="mini-row"><div class="mini-label">Don't</div><div class="mini-content">Not detected.</div></div>`}</div>
    </div>
  </div>`;
}

function renderStructuredMarkdown(sections, typographySpec, theme, spacingSpec) {
  return sections.map((section) => `<section>${renderHeading(2, section.title)}${renderMarkdownBlocks(section.content)}</section>`).join("");
}

function renderMarkdownBlocks(text) {
  const lines = text.split("\n");
  const html = [];
  let index = 0;
  let paragraphBuffer = [];

  function flushParagraph() {
    if (!paragraphBuffer.length) {
      return;
    }

    const paragraph = paragraphBuffer.join(" ").trim();
    if (paragraph) {
      html.push(`<p>${renderInlineMarkdown(paragraph)}</p>`);
    }
    paragraphBuffer = [];
  }

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      html.push(renderHeading(3, trimmed.replace(/^###\s+/, "")));
      index += 1;
      continue;
    }

    if (trimmed.startsWith("|")) {
      flushParagraph();
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      html.push(renderMarkdownTable(tableLines));
      continue;
    }

    if (/^- /.test(trimmed)) {
      flushParagraph();
      const listItems = [];
      while (index < lines.length) {
        const current = lines[index];
        const currentTrimmed = current.trim();
        if (!currentTrimmed) {
          break;
        }

        const bulletMatch = currentTrimmed.match(/^- (.*)$/);
        if (bulletMatch) {
          listItems.push(bulletMatch[1]);
          index += 1;
          continue;
        }

        if (/^\s{2,}\S/.test(current) && listItems.length) {
          listItems[listItems.length - 1] += ` ${currentTrimmed}`;
          index += 1;
          continue;
        }

        break;
      }
      html.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      flushParagraph();
      const listItems = [];
      while (index < lines.length) {
        const current = lines[index];
        const currentTrimmed = current.trim();
        if (!currentTrimmed) {
          break;
        }

        const itemMatch = currentTrimmed.match(/^\d+\.\s+(.*)$/);
        if (itemMatch) {
          listItems.push(itemMatch[1]);
          index += 1;
          continue;
        }

        if (/^\s{2,}\S/.test(current) && listItems.length) {
          listItems[listItems.length - 1] += ` ${currentTrimmed}`;
          index += 1;
          continue;
        }

        break;
      }
      html.push(`<ol>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    paragraphBuffer.push(trimmed);
    index += 1;
  }

  flushParagraph();
  return html.join("");
}

function renderMarkdownTable(lines) {
  const rows = lines.map((line) => splitMarkdownTableLine(line));
  if (rows.length < 2) {
    return "";
  }

  const header = rows[0];
  const body = rows.slice(2);

  return `<table><thead><tr>${header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${body
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function renderHeading(level, text) {
  return `<h${level}>${renderInlineMarkdown(text)}</h${level}>`;
}

function renderInlineMarkdown(text) {
  let output = escapeHtml(text);
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return output;
}

function extractDocumentTitle(text) {
  const match = text.match(/^#\s+Design System:\s+(.+)$/m);
  return match ? cleanText(match[1]) : null;
}

function parseHeadingSections(text, level) {
  const heading = "#".repeat(level);
  const regex = new RegExp(`^${heading}\\s+(.+)$`, "gm");
  const matches = [...text.matchAll(regex)];

  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
    return {
      title: cleanText(match[1]),
      content: text.slice(start, end).trim(),
    };
  });
}

function findSection(sections, fragment) {
  const lowered = fragment.toLowerCase();
  return sections.find((section) => section.title.toLowerCase().includes(lowered)) ?? null;
}

function findSubsectionContent(section, fragment) {
  if (!section?.subsections?.length) {
    return "";
  }

  const lowered = fragment.toLowerCase();
  return section.subsections.find((subsection) => subsection.title.toLowerCase().includes(lowered))?.content ?? "";
}

function findSubsectionAsSection(section, fragment) {
  if (!section?.subsections?.length) {
    return null;
  }

  const lowered = fragment.toLowerCase();
  const subsection = section.subsections.find((item) => item.title.toLowerCase().includes(lowered));
  if (!subsection) {
    return null;
  }

  return {
    ...subsection,
    subsections: parseHeadingSections(subsection.content, 4),
  };
}

function extractNamedSubsection(text, title) {
  const subsections = parseHeadingSections(text, 3);
  return subsections.find((section) => section.title.toLowerCase().includes(title.toLowerCase()))?.content ?? "";
}

function getLeadParagraphs(text) {
  const beforeSubsections = text.split(/^###\s+/m)[0];
  return beforeSubsections
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter((paragraph) => !paragraph.startsWith("|"))
    .filter((paragraph) => !paragraph.startsWith("- "))
    .filter((paragraph) => !/^\d+\./.test(paragraph))
    .map((paragraph) => cleanText(paragraph));
}

function parseBulletItems(text) {
  const lines = text.split("\n");
  const items = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^- (.*)$/);

    if (bulletMatch) {
      if (current) {
        items.push(cleanText(current));
      }
      current = bulletMatch[1];
      continue;
    }

    if (current && trimmed && !trimmed.startsWith("###") && !trimmed.startsWith("|")) {
      current += ` ${trimmed}`;
    }
  }

  if (current) {
    items.push(cleanText(current));
  }

  return items;
}

function parseDefinitionList(text) {
  const definitions = new Map();
  for (const item of parseBulletItems(text)) {
    const match = item.match(/^(.+?):\s*(.+)$/);
    if (match) {
      definitions.set(cleanText(match[1]), cleanText(match[2]));
    }
  }
  return definitions;
}

function parseLabeledBullets(text) {
  return parseBulletItems(text)
    .map((item) => {
      const match = item.match(/^(.+?):\s*(.+)$/);
      return match ? { label: cleanText(match[1]), value: cleanText(match[2]) } : null;
    })
    .filter(Boolean);
}

function parseBoldBlock(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\*\\*${escaped}\\*\\*([\\s\\S]*?)(?=\\n\\*\\*[^\\n]+\\*\\*|$)`, "i");
  const match = text.match(pattern);
  return parseDefinitionList(match?.[1] ?? "");
}

function parseFirstTable(text) {
  const lines = text.split("\n");
  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      current.push(line.trim());
      continue;
    }

    if (current.length >= 2) {
      blocks.push(current);
    }
    current = [];
  }

  if (current.length >= 2) {
    blocks.push(current);
  }

  if (!blocks.length) {
    return [];
  }

  const rows = blocks[0].map((line) => splitMarkdownTableLine(line));
  if (rows.length < 2) {
    return [];
  }

  const header = rows[0].map((cell) => normalizeKey(cell));
  return rows.slice(2).map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cleanText(cells[index] ?? "")]))
  );
}

function splitMarkdownTableLine(line) {
  return line.split("|").slice(1, -1).map((cell) => cell.trim());
}

function normalizeKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildTypographySpec(rows, familyDefinitions) {
  const heroRow = findTypographyRow(rows, [/hero/i]) ?? rows[0] ?? null;
  const sectionRow = findTypographyRow(rows, [/section headline/i, /product category/i]) ?? rows[1] ?? heroRow;
  const bodyRow = findTypographyRow(rows, [/body copy/i, /^body$/i, /body/i]) ?? rows[0] ?? null;
  const labelRow = findTypographyRow(rows, [/label/i, /eyebrow/i, /nav/i]) ?? bodyRow;
  const monoRow = findTypographyRow(rows, [/mono/i, /utility/i]) ?? null;

  const primaryFamily = normalizeFontStack(familyDefinitions.get("Primary"), false);
  const monoFamily = normalizeFontStack(familyDefinitions.get("Monospace"), true);

  const bodySize = metricWithClamp(bodyRow?.size, 14, 18, "16px");
  const bodyLineHeight = metricWithClamp(bodyRow?.lineHeight, 20, 32, "24px");
  const labelSize = metricWithClamp(labelRow?.size, 12, 14, "12px");
  const labelLineHeight = metricWithClamp(labelRow?.lineHeight, 16, 22, "20px");
  const labelTracking = metricTracking(labelRow?.tracking, "0.04em");
  const sectionSize = metricWithClamp(sectionRow?.size, 20, 32, "24px");
  const sectionLineHeight = metricWithClamp(sectionRow?.lineHeight, 24, 40, "32px");
  const sectionTracking = metricTracking(sectionRow?.tracking, "-0.02em");
  const previewTitleSize = metricWithClamp(sectionRow?.size ?? heroRow?.size, 24, 32, "28px");
  const previewTitleLineHeight = metricWithClamp(sectionRow?.lineHeight ?? heroRow?.lineHeight, 28, 38, "32px");
  const previewTitleTracking = metricTracking(sectionRow?.tracking ?? heroRow?.tracking, "-0.03em");
  const sourceSize = metricWithClamp(monoRow?.size, 12, 14, "13px");
  const sourceLineHeight = metricWithClamp(bodyRow?.lineHeight, 20, 28, "22px");

  return {
    primaryFamily,
    displayFamily: primaryFamily,
    monoFamily,
    bodySize,
    bodyLineHeight,
    bodyWeight: extractWeight(bodyRow?.weight) ? String(extractWeight(bodyRow.weight)) : "400",
    labelSize,
    labelLineHeight,
    labelTracking,
    sectionSize,
    sectionLineHeight,
    sectionTracking,
    previewTitleSize,
    previewTitleLineHeight,
    previewTitleTracking,
    sourceSize,
    sourceLineHeight,
  };
}

function buildSpacingSpec(baseUnitText, spacingValues, radiusDefinitions) {
  const baseNumber = clampNumber(extractFirstNumber(baseUnitText), 4, 12) ?? 8;
  const values = dedupeBy(
    spacingValues
      .map((value) => clampNumber(extractFirstNumber(value), 4, 64))
      .filter((value) => value != null)
      .sort((left, right) => left - right),
    (value) => value
  );

  const picked = values.length ? values : [baseNumber, baseNumber * 1.5, baseNumber * 2, baseNumber * 3, baseNumber * 4];
  const pickNear = (target, fallback) => {
    const found = picked.find((value) => value >= target);
    return `${Math.round(found ?? fallback)}px`;
  };

  const radiusMicro = extractLengthByKey(radiusDefinitions, [/micro/i, /utility/i]) ?? `${baseNumber - 2}px`;
  const radiusCard = extractLengthByKey(radiusDefinitions, [/standard/i, /module/i]) ?? `${baseNumber}px`;
  const radiusPill = extractLengthByKey(radiusDefinitions, [/pill/i, /rail/i]) ?? "999px";
  const radiusLarge = extractLengthByKey(radiusDefinitions, [/large/i]) ?? radiusCard;

  return {
    baseUnit: `${baseNumber}px`,
    gridSize: `${baseNumber * 6}px`,
    pagePadding: pickNear(baseNumber * 3, baseNumber * 3),
    layoutGap: pickNear(baseNumber * 2.5, baseNumber * 2.5),
    cardPadding: pickNear(baseNumber * 2, baseNumber * 2),
    panelRadius: radiusCard,
    cardRadius: radiusCard,
    microRadius: radiusMicro,
    pillRadius: radiusPill,
    largeRadius: radiusLarge,
    space1: `${baseNumber}px`,
    space2: pickNear(baseNumber * 1.5, baseNumber * 1.5),
    space3: pickNear(baseNumber * 2, baseNumber * 2),
    space4: pickNear(baseNumber * 3, baseNumber * 3),
    space5: pickNear(baseNumber * 4, baseNumber * 4),
    space6: pickNear(baseNumber * 5, baseNumber * 5),
    scaleEntries: [
      ["Base unit", `${baseNumber}px`],
      ["Step 2", pickNear(baseNumber * 1.5, baseNumber * 1.5)],
      ["Step 3", pickNear(baseNumber * 2, baseNumber * 2)],
      ["Step 4", pickNear(baseNumber * 3, baseNumber * 3)],
      ["Step 5", pickNear(baseNumber * 4, baseNumber * 4)],
    ],
    radiusEntries: [
      ["Micro utility", radiusMicro],
      ["Standard module", radiusCard],
      ["Category rail", extractLengthByKey(radiusDefinitions, [/category/i, /rail/i]) ?? radiusPill],
      ["CTA pill", radiusPill],
    ],
  };
}

function buildButtonSpec(primaryButton, secondaryButton, typographySpec, spacingSpec) {
  const primaryBackground = extractColor(primaryButton.get("Background") ?? "") ?? "#171717";
  const primaryText = extractColor(primaryButton.get("Text") ?? "") ?? readableTextColor(primaryBackground);
  const secondaryBackground = extractColor(secondaryButton.get("Background") ?? "") ?? "#ffffff";
  const secondaryText = extractColor(secondaryButton.get("Text") ?? "") ?? "#171717";
  const secondaryBorder = extractColor(secondaryButton.get("Ring") ?? "") ?? secondaryText;
  const fontSize = metricWithClamp(primaryButton.get("Text style"), 12, 14, typographySpec.labelSize);
  const fontWeight = String(extractWeight(primaryButton.get("Text style")) ?? 500);
  const primaryHeight = metricWithClamp(primaryButton.get("Common size") ?? primaryButton.get("Height"), 36, 44, "40px");
  const primaryRadius = extractLength(primaryButton.get("Radius") ?? "") ?? spacingSpec.pillRadius;
  const secondaryRadius = extractLength(secondaryButton.get("Radius") ?? "") ?? spacingSpec.pillRadius;

  return {
    primaryBackground,
    primaryText,
    secondaryBackground,
    secondaryText,
    secondaryBorder,
    fontSize,
    fontWeight,
    primaryHeight,
    primaryRadius,
    secondaryRadius,
  };
}

function buildThemeTokens(colorRows, quickColors, surfaceDefinitions, shadowDefinitions, cardDefinitions, typographySpec) {
  const fromRows = (patterns, fallback) =>
    colorRows.find((row) => patterns.some((pattern) => pattern.test(`${row.role} ${row.name} ${row.usage}`)))?.swatch ?? fallback;
  const fromQuick = (name) => extractColor(quickColors.get(name) ?? "");

  const background =
    fromQuick("Background") ??
    extractColor(surfaceDefinitions.get("Main page surface") ?? "") ??
    fromRows([/background/i, /page surface/i, /cloud/i], "#fafafa");
  const surface =
    fromQuick("Elevated surface") ??
    extractColor(surfaceDefinitions.get("Elevated card and control surface") ?? "") ??
    fromRows([/elevated surface/i, /surface/i, /white/i], "#ffffff");
  const ink = fromQuick("Heading text") ?? fromRows([/ink/i, /heading/i, /text/i], "#171717");
  const muted = fromQuick("Body text") ?? fromRows([/body text/i, /quiet body/i, /slate/i, /muted/i], "#4d4d4d");
  const border = fromQuick("Ring / border") ?? fromRows([/border/i, /ring/i, /divider/i, /line/i], "#ebebeb");
  const accent = fromQuick("Accent / focus") ?? fromRows([/accent/i, /focus/i, /blue/i], "#0072f5");
  const shadow =
    normalizeShadow(cardDefinitions.get("Signature shadow stack")) ??
    normalizeShadow(shadowDefinitions.get("Card shadow")) ??
    "0 0 0 1px rgba(0, 0, 0, 0.08), 0 2px 2px rgba(0, 0, 0, 0.04), 0 8px 8px -8px rgba(0, 0, 0, 0.04)";
  const ringShadow =
    normalizeShadow(shadowDefinitions.get("Ring border")) ??
    `0 0 0 1px ${border}`;

  return {
    background,
    backgroundMuted: mixSurface(background, surface),
    surface,
    surfaceMuted: mixSurface(surface, background),
    ink,
    muted,
    subtle: mixText(ink, background, 0.46),
    border,
    borderStrong: mixText(ink, background, 0.14),
    accent,
    shadow,
    softShadow: ringShadow,
    fontFamily: typographySpec.primaryFamily,
  };
}

function splitPalette(rows, theme) {
  const uniqueRows = dedupeBy(rows.filter((row) => row.swatch), (row) => `${row.name}-${row.swatch}`);
  const fallbackRows = [
    { name: "Background", role: "Page surface", rawValue: theme.background, swatch: theme.background, usage: "Page surface" },
    { name: "Surface", role: "Elevated surface", rawValue: theme.surface, swatch: theme.surface, usage: "Card surface" },
    { name: "Ink", role: "Primary text", rawValue: theme.ink, swatch: theme.ink, usage: "Headings and primary text" },
    { name: "Muted", role: "Supporting text", rawValue: theme.muted, swatch: theme.muted, usage: "Body copy" },
    { name: "Accent", role: "Interactive accent", rawValue: theme.accent, swatch: theme.accent, usage: "Focus and highlights" },
    { name: "Border", role: "Divider", rawValue: theme.border, swatch: theme.border, usage: "Lines and separators" },
  ];
  const palette = uniqueRows.length ? uniqueRows : fallbackRows;

  return {
    primary: palette.slice(0, 3),
    neutral: palette.slice(3, 7),
  };
}

function buildGradientStrip(groups, theme) {
  const colors = dedupeBy(
    [...groups.primary, ...groups.neutral].map((item) => item.swatch).filter(Boolean),
    (value) => value
  ).slice(0, 4);

  const palette = colors.length ? colors : [theme.ink, theme.muted, theme.accent, theme.surface];
  return `linear-gradient(90deg, ${palette
    .map((color, index) => `${color} ${Math.round((index / Math.max(palette.length - 1, 1)) * 100)}%`)
    .join(", ")})`;
}

function findTypographyRow(rows, patterns) {
  return rows.find((row) => patterns.some((pattern) => pattern.test(row.role)));
}

function normalizeFontStack(rawValue, mono = false) {
  const fallback = mono
    ? 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, monospace'
    : '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

  if (!rawValue) {
    return fallback;
  }

  const candidate = extractFontFamilyCandidate(rawValue);
  if (!candidate) {
    return fallback;
  }

  const family = formatFontFamilyToken(candidate);
  if (!family) {
    return fallback;
  }

  return `${family}, ${fallback}`;
}

function extractFontFamilyCandidate(rawValue) {
  const cleaned = cleanText(rawValue).replace(/`/g, "");
  if (!cleaned) {
    return null;
  }

  const segments = cleaned
    .split(",")
    .map((segment) => segment.split(/\bwith\b/i)[0].trim())
    .filter(Boolean);

  return segments.find(isLikelyFontFamilyToken) ?? null;
}

function isLikelyFontFamilyToken(value) {
  if (!value) {
    return false;
  }

  const normalized = value
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.length > 40) {
    return false;
  }

  if (/[;:{}<>]/.test(normalized)) {
    return false;
  }

  if (
    /\b(observed|dominant|identity|styling|interface|page|used|appears|feels|looks|mode|primary|secondary|headline|body copy|supporting)\b/i.test(
      normalized
    )
  ) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount > 4) {
    return false;
  }

  return /^[A-Za-z0-9 "'-]+$/.test(normalized) || /^(?:-apple-system|BlinkMacSystemFont|system-ui|ui-[a-z-]+)$/i.test(normalized);
}

function formatFontFamilyToken(value) {
  const normalized = value
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  if (/^(?:-apple-system|BlinkMacSystemFont|system-ui|ui-[a-z-]+|serif|sans-serif|monospace|cursive|fantasy|emoji|math|fangsong)$/i.test(normalized)) {
    return normalized;
  }

  return /\s/.test(normalized) ? `"${normalized}"` : normalized;
}

function metricWithClamp(rawValue, min, max, fallback) {
  const number = clampNumber(extractFirstNumber(rawValue ?? ""), min, max);
  return number == null ? fallback : `${number}px`;
}

function metricTracking(rawValue, fallback) {
  const tracking = extractTracking(rawValue ?? "");
  return tracking === "normal" ? fallback : tracking;
}

function extractLengthByKey(definitions, patterns) {
  for (const [key, value] of definitions.entries()) {
    if (patterns.some((pattern) => pattern.test(key))) {
      const length = extractLength(value);
      if (length) {
        return length;
      }
    }
  }
  return null;
}

function normalizeShadow(value) {
  if (!value) {
    return null;
  }
  return value.replace(/\s+/g, " ").trim();
}

function mixSurface(background, surface) {
  const bg = parseColor(background);
  const fg = parseColor(surface);
  if (!bg || !fg) {
    return surface;
  }
  const mix = bg.map((value, index) => Math.round((value + fg[index]) / 2));
  return `rgb(${mix.join(", ")})`;
}

function mixText(foreground, background, ratio) {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) {
    return foreground;
  }

  const mix = fg.map((value, index) => Math.round((value * ratio) + (bg[index] * (1 - ratio))));
  return `rgb(${mix.join(", ")})`;
}

function extractObservedUrl(text) {
  const match = text.match(/https?:\/\/[^\s)`]+/);
  return match ? match[0] : "";
}

function extractRepeatedValues(text) {
  const values = [...text.matchAll(/`([^`]+)`/g)].map((match) => cleanText(match[1]));
  return dedupeBy(values, (value) => value);
}

function extractColor(value) {
  const match = value.match(/#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/);
  return match ? match[0] : null;
}

function extractFirstNumber(value) {
  const match = `${value}`.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function extractWeight(value) {
  const match = `${value}`.match(/\b([3-9]00)\b/);
  return match ? Number(match[1]) : null;
}

function extractLength(value) {
  const match = `${value}`.match(/-?\d+(?:\.\d+)?(?:px|rem|em|%)?/);
  return match ? match[0] : null;
}

function extractTracking(value) {
  const match = `${value}`.match(/-?\d+(?:\.\d+)?(?:px|em|rem)/);
  return match ? match[0] : "normal";
}

function compactMetrics(row) {
  return [row.size, row.weight, row.lineHeight].filter(Boolean).join(" • ");
}

function firstSentence(text) {
  const match = text.match(/.+?[.!?](?:\s|$)/);
  return match ? cleanText(match[0]) : cleanText(text);
}

function shortChip(text) {
  return text.length > 32 ? `${text.slice(0, 32).trim()}...` : text;
}

function descriptorForDisplay(text) {
  return text.length > 92 ? `${text.slice(0, 92).trim()}...` : text;
}

function readableTextColor(color) {
  const rgb = parseColor(color);
  if (!rgb) {
    return "#171717";
  }

  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.62 ? "#171717" : "#ffffff";
}

function parseColor(value) {
  if (!value) {
    return null;
  }

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const normalized =
      hex[1].length === 3 ? hex[1].split("").map((part) => `${part}${part}`).join("") : hex[1];
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ];
  }

  const rgb = value.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    return rgb[1]
      .split(",")
      .slice(0, 3)
      .map((part) => Number.parseFloat(part.trim()))
      .map((part) => Math.max(0, Math.min(255, part)));
  }

  return null;
}

function clampNumber(value, min, max) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Math.max(min, Math.min(max, value));
}

function cleanText(text) {
  return stripMarkdown(`${text}`).replace(/\s+/g, " ").trim();
}

function stripMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function escapeHtml(value) {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeCssValue(value) {
  return `${value ?? ""}`
    .replace(/<\/style/gi, "<\\/style")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[{};]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
