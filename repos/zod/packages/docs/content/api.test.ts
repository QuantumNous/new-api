import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

type SourceLine = {
  text: string;
  number: number;
};

type CodeFence = {
  startLine: number;
  lineCount: number;
};

type TabBlock = {
  value: string;
  line: number;
  codeFences: CodeFence[];
};

type TabsBlock = {
  startLine: number;
  tabs: TabBlock[];
};

const apiDocsPath = resolve(dirname(fileURLToPath(import.meta.url)), "api.mdx");

test("Zod and Zod Mini tabbed API examples have matching code block heights", async () => {
  const source = await readFile(apiDocsPath, "utf8");
  const tabsBlocks = extractTabsBlocks(source);
  const failures: string[] = [];
  let comparedBlocks = 0;

  for (const block of tabsBlocks) {
    assertExpectedTabLabels(block, failures);

    const zodTab = block.tabs.find((tab) => tab.value === "Zod");
    const zodMiniTab = block.tabs.find((tab) => tab.value === "Zod Mini");

    if (!zodTab || !zodMiniTab) {
      continue;
    }

    comparedBlocks += 1;
    compareCodeFences(block, zodTab, zodMiniTab, failures);
  }

  expect(comparedBlocks).toBeGreaterThan(0);
  expect(failures).toEqual([]);
});

function extractTabsBlocks(source: string): TabsBlock[] {
  const lines = stripMdxComments(source);
  const blocks: TabsBlock[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (!line || !/<Tabs\b/.test(line.text)) {
      continue;
    }

    const tabs: TabBlock[] = [];
    let currentTab: TabBlock | undefined;

    for (index += 1; index < lines.length; index++) {
      const blockLine = lines[index];

      if (!blockLine || /<\/Tabs>/.test(blockLine.text)) {
        break;
      }

      const tabValue = getTabValue(blockLine.text);

      if (tabValue) {
        currentTab = { value: tabValue, line: blockLine.number, codeFences: [] };
        tabs.push(currentTab);
        continue;
      }

      if (/<\/Tab>/.test(blockLine.text)) {
        currentTab = undefined;
        continue;
      }

      if (currentTab && blockLine.text.trimStart().startsWith("```")) {
        const codeFence = readCodeFence(lines, index, blockLine.number);
        currentTab.codeFences.push(codeFence);
        index += codeFence.lineCount + 1;
      }
    }

    blocks.push({ startLine: line.number, tabs });
  }

  return blocks;
}

function stripMdxComments(source: string): SourceLine[] {
  const lines = source.split(/\r?\n/);
  const sourceLines: SourceLine[] = [];
  let inCodeFence = false;
  const mdxCommentState = { inComment: false };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const isFenceBoundary = line.trimStart().startsWith("```");

    if (isFenceBoundary) {
      inCodeFence = !inCodeFence;
    }

    sourceLines.push({
      text: inCodeFence ? line : stripMdxCommentSegments(line, mdxCommentState),
      number: index + 1,
    });
  }

  return sourceLines;
}

function stripMdxCommentSegments(line: string, state: { inComment: boolean }): string {
  let result = "";
  let index = 0;

  while (index < line.length) {
    if (state.inComment) {
      const commentEnd = line.indexOf("*/}", index);

      if (commentEnd === -1) {
        return result;
      }

      state.inComment = false;
      index = commentEnd + 3;
      continue;
    }

    const commentStart = line.indexOf("{/*", index);

    if (commentStart === -1) {
      result += line.slice(index);
      break;
    }

    result += line.slice(index, commentStart);
    state.inComment = true;
    index = commentStart + 3;
  }

  return result;
}

function getTabValue(line: string): string | undefined {
  const quotedValue = line.match(/<Tab\b[^>]*\bvalue\s*=\s*(["'])(.*?)\1/);

  if (quotedValue?.[2]) {
    return quotedValue[2];
  }

  const expressionValue = line.match(/<Tab\b[^>]*\bvalue\s*=\s*\{\s*(["'])(.*?)\1\s*\}/);
  return expressionValue?.[2];
}

function readCodeFence(lines: SourceLine[], fenceStartIndex: number, startLine: number): CodeFence {
  let lineCount = 0;

  for (let index = fenceStartIndex + 1; index < lines.length; index++) {
    const line = lines[index];

    if (!line || line.text.trimStart().startsWith("```")) {
      break;
    }

    lineCount += 1;
  }

  return { startLine, lineCount };
}

function assertExpectedTabLabels(block: TabsBlock, failures: string[]): void {
  const hasZodishTab = block.tabs.some((tab) => isLikelyTabValue(tab.value, "Zod"));
  const hasZodMiniishTab = block.tabs.some((tab) => isLikelyTabValue(tab.value, "Zod Mini"));

  if (!hasZodishTab || !hasZodMiniishTab) {
    return;
  }

  for (const tab of block.tabs) {
    for (const expectedValue of ["Zod", "Zod Mini"]) {
      if (tab.value !== expectedValue && isLikelyTabValue(tab.value, expectedValue)) {
        failures.push(
          `api.mdx:${tab.line} has likely ${expectedValue} tab label typo: expected value="${expectedValue}", found value="${tab.value}".`
        );
      }
    }
  }
}

function compareCodeFences(block: TabsBlock, zodTab: TabBlock, zodMiniTab: TabBlock, failures: string[]): void {
  if (zodTab.codeFences.length !== zodMiniTab.codeFences.length) {
    failures.push(
      `api.mdx:${block.startLine} has ${zodTab.codeFences.length} Zod code fence(s) and ${zodMiniTab.codeFences.length} Zod Mini code fence(s).`
    );
    return;
  }

  for (let index = 0; index < zodTab.codeFences.length; index++) {
    const zodFence = zodTab.codeFences[index];
    const zodMiniFence = zodMiniTab.codeFences[index];

    if (!zodFence || !zodMiniFence || zodFence.lineCount === zodMiniFence.lineCount) {
      continue;
    }

    failures.push(
      `api.mdx:${block.startLine} code fence #${index + 1} has ${zodFence.lineCount} Zod line(s) at line ${zodFence.startLine} and ${zodMiniFence.lineCount} Zod Mini line(s) at line ${zodMiniFence.startLine}.`
    );
  }
}

function isLikelyTabValue(actual: string, expected: string): boolean {
  const normalizedActual = normalizeTabValue(actual);
  const normalizedExpected = normalizeTabValue(expected);
  return normalizedActual === normalizedExpected || getEditDistance(normalizedActual, normalizedExpected) <= 1;
}

function normalizeTabValue(value: string): string {
  return value.toLowerCase().replaceAll(/[\s_-]/g, "");
}

function getEditDistance(left: string, right: string): number {
  let previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex++) {
    const currentRow = [leftIndex + 1];

    for (let rightIndex = 0; rightIndex < right.length; rightIndex++) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      currentRow.push(
        Math.min(
          currentRow[rightIndex] + 1,
          previousRow[rightIndex + 1] + 1,
          previousRow[rightIndex] + substitutionCost
        )
      );
    }

    previousRow = currentRow;
  }

  return previousRow[right.length] ?? 0;
}
