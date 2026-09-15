/** Returns { prefix, clean } for a `NN-name` path segment. */
export const parseSegment = segment => {
  const match = segment.match(/^(\d+)-(.+)$/);
  return match
    ? { prefix: Number(match[1]), clean: match[2] }
    : { prefix: null, clean: segment };
};

/** Strips the first in-body `# H1` line (frontmatter title is the page H1). */
const stripLeadingH1 = mdx => {
  const fmMatch = mdx.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  const fmEnd = fmMatch ? fmMatch[0].length : 0;
  const body = mdx.slice(fmEnd);
  const stripped = body.replace(/^\s*#[ \t][^\n]*\n?/, "\n");
  return mdx.slice(0, fmEnd) + stripped;
};

const linkReplacements = [
  ['#ui-message-stream-protocol', '#data-stream-protocol'],
  ['#ui-message-stream', '#ui-message-stream-example'],
  ['#multi-modal-messages', '#file-parts'],
  ['#validating-messages-from-database', '#validating-messages-on-the-server'],
  ['#multi-step-calls', '#multi-step-calls-using-stopwhen'],
  ['#attachments-experimental', '#attachments'],
  [
    '#structured-outputs-with-generatetext-and-streamtext',
    '#generating-structured-outputs',
  ],
  [
    '#simulate-data-stream-protocol-responses',
    '#simulate-ui-message-stream-responses',
  ],
  ['#tools-generate', '#tools.tool.generate'],
  ['#tooloopagent-class', '#toolloopagent-class'],
];

const rewriteLegacyLinks = line =>
  linkReplacements.reduce((rewritten, [from, to]) => {
    if (to.startsWith(from)) {
      const suffix = to.slice(from.length).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!${suffix})`,
        'g',
      );
      return rewritten.replace(pattern, to);
    }
    return rewritten.replaceAll(from, to);
  }, line);

/**
 * Rewrites code fence meta to fumadocs conventions and drops top-level MDX
 * imports that next-mdx-remote previously ignored.
 */
const rewriteLines = mdx => {
  let inFence = false;

  return mdx
    .split("\n")
    .map(line => {
      if (line.trimStart().startsWith("```")) {
        inFence = !inFence;
        let next = line.replace(
          /\b(?:filename|file)=(?:\{)?(["'])([^"']+)\1(?:\})?/g,
          'title=$1$2$1',
        );
        next = next.replace(
          /\bhighlight=(?:\{)?(["'])([^"']+)\1(?:\})?/g,
          '{$2}',
        );
        // Remap fence languages Shiki doesn't bundle.
        next = next.replace(/^(\s*```)prompt\b/, '$1txt');
        next = next.replace(/^(\s*```)env\b/, '$1dotenv');
        next = next.replace(/^(\s*```)rego\b/, '$1txt');
        return next;
      }
      if (!inFence && /^import\s/.test(line)) {
        return null;
      }
      const rewrittenLine = !inFence ? rewriteLegacyLinks(line) : line;
      if (
        !inFence &&
        /^#{1,6}\s/.test(rewrittenLine) &&
        /<[A-Z]/.test(rewrittenLine)
      ) {
        // Heading JSX is unavailable in fumadocs' module-scope TOC export.
        return rewrittenLine
          .replace(/<([A-Z][\w.]*)[^>]*>([^<]*)<\/\1>/g, '($2)')
          .replace(/<[A-Z][\w.]*[^>]*\/>/g, '')
          .trimEnd();
      }
      return rewrittenLine;
    })
    .filter(line => line !== null)
    .join("\n");
};

const addLegacyAnchors = mdx => {
  const title = mdx.match(/^---\r?\n[\s\S]*?^title:\s*(.+)$/m)?.[1]?.trim();

  if (title === 'streamText') {
    return mdx.replace(
      '\n### Returns',
      '\n<span id="result" />\n<span id="result-object" />\n\n### Returns',
    );
  }
  if (title === 'Output') {
    return mdx.replace(
      '\n### `Output.object()`',
      '\n<span id="output-object" />\n\n### `Output.object()`',
    );
  }
  if (title === 'Telemetry') {
    const frontmatter = mdx.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    const offset = frontmatter?.[0].length ?? 0;
    return `${mdx.slice(0, offset)}\n<span id="telemetry" />\n${mdx.slice(offset)}`;
  }
  return mdx;
};

export const transformMdx = mdx =>
  addLegacyAnchors(stripLeadingH1(rewriteLines(mdx)));
