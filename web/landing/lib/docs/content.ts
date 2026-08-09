import "server-only";

import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { z } from "zod";

import { docsConfig } from "@/app/docs/docs.config";
import type { DocDocument, DocsNavigationSection, DocSummary } from "@/lib/docs/types";

const docsDirectory = path.join(process.cwd(), "content", "docs");
const cacheDocuments = process.env.NODE_ENV === "production";
let allDocumentsCache: DocDocument[] | undefined;
let docsIndexDocumentCache: DocDocument | undefined;

const frontmatterSchema = z
  .object({
    title: z.string().trim().min(1, "title 不能为空"),
    description: z.string().trim().min(1, "description 不能为空").optional(),
    order: z.number().int().nonnegative("order 不能小于 0"),
  })
  .strict();

function getMarkdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return getMarkdownFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
  });
}

function parseDocument(filePath: string, sectionDirectory: string): DocDocument {
  const source = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(source);
  const parsedFrontmatter = frontmatterSchema.safeParse(data);

  if (!parsedFrontmatter.success) {
    const details = z.prettifyError(parsedFrontmatter.error);
    throw new Error(
      `文档 frontmatter 校验失败：${path.relative(process.cwd(), filePath)}\n${details}`,
    );
  }

  const relativePath = path.relative(docsDirectory, filePath);
  const slug = relativePath.replace(/\.md$/, "").split(path.sep);

  return {
    ...parsedFrontmatter.data,
    content,
    href: `/docs/${slug.join("/")}`,
    sectionDirectory,
    slug,
  };
}

function toSummary(document: DocDocument): DocSummary {
  return {
    title: document.title,
    description: document.description,
    order: document.order,
    href: document.href,
    slug: document.slug,
  };
}

export function getAllDocuments(): DocDocument[] {
  if (cacheDocuments && allDocumentsCache) return allDocumentsCache;

  const configuredDirectories = new Set(docsConfig.sections.map((section) => section.directory));

  if (fs.existsSync(docsDirectory)) {
    const unknownDirectories = fs
      .readdirSync(docsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !configuredDirectories.has(entry.name))
      .map((entry) => entry.name);

    if (unknownDirectories.length > 0) {
      throw new Error(
        `以下文档目录尚未在 app/docs/docs.config.ts 中配置：${unknownDirectories.join(", ")}`,
      );
    }
  }

  const documents = docsConfig.sections
    .toSorted((a, b) => a.order - b.order)
    .flatMap((section) =>
      getMarkdownFiles(path.join(docsDirectory, section.directory))
        .map((filePath) => parseDocument(filePath, section.directory))
        .toSorted((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh-CN")),
    );

  if (cacheDocuments) allDocumentsCache = documents;
  return documents;
}

export function getDocument(slug: string[]): DocDocument | undefined {
  const normalizedSlug = slug.join("/");
  return getAllDocuments().find((document) => document.slug.join("/") === normalizedSlug);
}

export function getDocsIndexDocument(): DocDocument {
  if (cacheDocuments && docsIndexDocumentCache) return docsIndexDocumentCache;

  const filePath = path.join(docsDirectory, "index.md");

  if (!fs.existsSync(filePath)) {
    throw new Error("缺少文档首页：content/docs/index.md");
  }

  const document = parseDocument(filePath, "");

  const indexDocument = {
    ...document,
    href: "/docs",
    slug: [],
  };

  if (cacheDocuments) docsIndexDocumentCache = indexDocument;
  return indexDocument;
}

export function getDocsNavigation(): DocsNavigationSection[] {
  const documents = getAllDocuments();

  return docsConfig.sections
    .toSorted((a, b) => a.order - b.order)
    .map((section) => ({
      directory: section.directory,
      title: section.title,
      documents: documents
        .filter((document) => document.sectionDirectory === section.directory)
        .map(toSummary),
    }))
    .filter((section) => section.documents.length > 0);
}

export function getAdjacentDocuments(document: DocDocument): {
  previous?: DocSummary;
  next?: DocSummary;
} {
  const documents = getAllDocuments();
  const currentIndex = documents.findIndex(
    (candidate) => candidate.slug.join("/") === document.slug.join("/"),
  );

  return {
    previous: documents[currentIndex - 1] ? toSummary(documents[currentIndex - 1]) : undefined,
    next: documents[currentIndex + 1] ? toSummary(documents[currentIndex + 1]) : undefined,
  };
}
