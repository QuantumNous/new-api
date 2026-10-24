import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
// eslint-disable-next-line import/extensions
import { releases } from '../../src/data/releases.ts';
import { mdxToMarkdown } from './mdxToMarkdown.mjs';

describe('mdxToMarkdown', () => {
  // A snapshpot test for the Accordion MDX content.
  // Serves as an integration test for the markdown generation of component docs.
  it('should transform Accordion MDX content to markdown with metadata', async () => {
    // Read the actual Accordion MDX file
    const accordionMdxPath = path.resolve(
      import.meta.dirname,
      '../../src/app/(docs)/react/components/accordion/page.mdx',
    );
    const accordionMdxContent = fs.readFileSync(accordionMdxPath, 'utf-8');

    // Transform the MDX content
    const result = await mdxToMarkdown(accordionMdxContent, accordionMdxPath);

    // Verify the result structure
    expect(result).toBeTypeOf('object');
    expect(result).toHaveProperty('markdown');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('subtitle');
    expect(result).toHaveProperty('description');

    // Verify extracted metadata
    expect(result.title).toBe('Accordion');
    expect(result.subtitle).toBe('A set of collapsible panels with headings.');
    expect(result.description).toBe(
      'A high-quality, unstyled React accordion component that displays a set of collapsible panels with headings.',
    );

    // Snapshot test the complete result
    expect(result.markdown).toMatchSnapshot();
  });

  // A snapshpot test for the useRender MDX content.
  // Serves as an integration test for the markdown generation of utils docs.
  it('should transform Direction Provider MDX content to markdown with metadata', async () => {
    // Read the actual Direcrion Provider MDX file
    const directionProviderMdxPath = path.resolve(
      import.meta.dirname,
      '../../src/app/(docs)/react/utils/direction-provider/page.mdx',
    );
    const directionProviderMdxContent = fs.readFileSync(directionProviderMdxPath, 'utf-8');

    // Transform the MDX content
    const result = await mdxToMarkdown(directionProviderMdxContent, directionProviderMdxPath);

    // Verify the result structure
    expect(result).toBeTypeOf('object');
    expect(result).toHaveProperty('markdown');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('subtitle');
    expect(result).toHaveProperty('description');

    // Verify extracted metadata
    expect(result.title).toBe('Direction Provider');
    expect(result.subtitle).toBe('Enables RTL behavior for Base UI components.');
    expect(result.description).toBe(
      'A direction provider component that enables RTL behavior for Base UI components.',
    );

    // Snapshot test the complete result
    expect(result.markdown).toMatchSnapshot();
  });

  it('should include all releases from releases.ts', async () => {
    const releasesMdxPath = path.resolve(
      import.meta.dirname,
      '../../src/app/(docs)/react/overview/releases/page.mdx',
    );
    const releasesMdxContent = fs.readFileSync(releasesMdxPath, 'utf-8');

    const urlPath = '/react/overview/releases';
    const urlsWithMdVersion = new Set([
      urlPath,
      ...releases.map((r) => `/react/overview/releases/${r.versionSlug}`),
    ]);
    const result = await mdxToMarkdown(releasesMdxContent, releasesMdxPath, {
      urlPath,
      urlsWithMdVersion,
    });

    // Strip markdown backslash escapes (e.g. \<) for content comparison
    const normalized = result.markdown.replace(/\\(.)/g, '$1');
    // Split into per-release sections so duplicate highlights are verified per release
    const sections = normalized.split(/(?=^### )/m);

    for (const release of releases) {
      const heading = `### [${release.version}](/react/overview/releases/${release.versionSlug}.md)`;
      expect(result.markdown).toContain(heading);

      const section = sections.find((s) => s.startsWith(heading));
      expect(section).toBeDefined();
      for (const highlight of release.highlights) {
        expect(section).toContain(`- ${highlight}`);
      }
    }
  });
});
