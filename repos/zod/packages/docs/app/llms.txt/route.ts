import { source } from "@/loaders/source";

// cached forever
export const revalidate = false;

function stringifyTitle(title: any): string {
  if (typeof title === "string") return title;
  if (typeof title === "number" || typeof title === "bigint" || typeof title === "boolean") {
    return String(title);
  }

  // Handle React elements and complex objects
  if (title && typeof title === "object") {
    // If it's a React element with props.children
    if (title.props?.children) {
      return stringifyTitle(title.props.children);
    }

    // If it's an array, join the elements
    if (Array.isArray(title)) {
      return title.map(stringifyTitle).join("");
    }

    // If it has a textContent property
    if (title.textContent) {
      return String(title.textContent);
    }

    // Try to extract text from common React element patterns
    if (title.type && (title.type === "span" || title.type === "code" || typeof title.type === "string")) {
      if (typeof title.props?.children === "string") {
        return title.props.children;
      }
    }
  }

  return "";
}

export async function GET() {
  const pages = source.getPages();

  // Generate LLMS.txt content
  let txt = `# Zod

> Zod is a TypeScript-first schema validation library with static type inference. This documentation provides comprehensive coverage of Zod 4's features, API, and usage patterns.

`;

  // Process each page
  for (const page of pages) {
    // Skip separator entries that start with "---"
    const title = stringifyTitle(page.data.title);
    if (title.startsWith("---")) {
      continue;
    }

    // Create section for each page
    txt += `## ${title || "Untitled"}\n\n`;

    // Add main page link with description from frontmatter
    const pageUrl = `https://zod.dev${page.url}`;
    const description = page.data.description || "Documentation page";
    txt += `- [${title || "Untitled"}](${pageUrl}): ${description}\n`;

    // Add TOC sections for deep linking
    if (page.data.toc && page.data.toc.length > 0) {
      // Group sections by depth for better organization
      const sections = page.data.toc.filter((item: any) => item.depth >= 2 && item.depth <= 4);

      if (sections.length > 0) {
        txt += "\n";

        for (const section of sections) {
          const sectionTitle = stringifyTitle(section.title);
          if (!sectionTitle) continue;

          const anchor = section.url.replace("#", "");
          const fullUrl = `https://zod.dev${page.url}?id=${anchor}`;

          txt += `- [${sectionTitle}](${fullUrl})\n`;
        }
      }
    }

    txt += "\n";
  }

  txt += `---

This documentation covers Zod v4, a TypeScript-first schema validation library. Use the URLs above to access specific pages and sections for detailed information about schema definition, validation, error handling, and advanced patterns.
`;

  return new Response(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
