import { isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { IconInfoCircle } from "@tabler/icons-react";
import { MarkdownAsync, type Components } from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { CopyCodeButton } from "@/components/docs/copy-code-button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function getTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return getTextContent(node.props.children);
  return "";
}

const markdownComponents: Components = {
  a({ href = "", children, className, title }) {
    const linkClassName = cn(className, href.startsWith("#") && "text-inherit no-underline");

    if (href.startsWith("/")) {
      return (
        <Link href={href} className={linkClassName} title={title}>
          {children}
        </Link>
      );
    }

    const isExternal = href.startsWith("http://") || href.startsWith("https://");
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
        className={linkClassName}
        title={title}
      >
        {children}
      </a>
    );
  },
  h2({ children, id }) {
    return (
      <h2
        id={id}
        className="mt-12 mb-4 font-bold tracking-[-0.03em] text-neutral-900 [font-size:var(--docs-text-h2)] [line-height:1.2]"
      >
        {children}
      </h2>
    );
  },
  h3({ children, id }) {
    return (
      <h3
        id={id}
        className="mt-10 mb-3 font-bold tracking-[-0.02em] text-neutral-900 [font-size:var(--docs-text-h3)] [line-height:1.25]"
      >
        {children}
      </h3>
    );
  },
  h4({ children, id }) {
    return (
      <h4
        id={id}
        className="mt-8 mb-3 font-bold tracking-[-0.015em] text-neutral-900 [font-size:var(--docs-text-h4)] [line-height:1.3]"
      >
        {children}
      </h4>
    );
  },
  h5({ children, id }) {
    return (
      <h5
        id={id}
        className="mt-7 mb-2 font-bold text-neutral-900 [font-size:var(--docs-text-h5)] [line-height:1.35]"
      >
        {children}
      </h5>
    );
  },
  h6({ children, id }) {
    return (
      <h6
        id={id}
        className="mt-6 mb-2 font-bold text-neutral-900 [font-size:var(--docs-text-h6)] [line-height:1.4]"
      >
        {children}
      </h6>
    );
  },
  pre({ children }) {
    const code = getTextContent(children).replace(/\n$/, "");

    return (
      <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-neutral-950">
        <pre
          className="m-0 overflow-x-auto rounded-none bg-transparent p-5 font-mono text-neutral-50 [font-size:var(--docs-text-sm)] leading-7"
          style={{ margin: 0 }}
        >
          {children}
        </pre>
        <CopyCodeButton value={code} />
      </div>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-6 grid grid-cols-[auto_1fr] gap-x-2 rounded-lg border border-black/[0.06] bg-neutral-50 px-2.5 py-2 text-left text-sm">
        <IconInfoCircle aria-hidden="true" />
        <div className="leading-6 text-neutral-700 [font-size:var(--docs-text-sm)] [&>p]:m-0">
          {children}
        </div>
      </blockquote>
    );
  },
  hr() {
    return <Separator className="my-10" />;
  },
  table({ children }) {
    return <Table>{children}</Table>;
  },
  thead({ children }) {
    return <TableHeader>{children}</TableHeader>;
  },
  tbody({ children }) {
    return <TableBody>{children}</TableBody>;
  },
  tr({ children }) {
    return <TableRow>{children}</TableRow>;
  },
  th({ children, align, colSpan, rowSpan }) {
    return (
      <TableHead align={align} colSpan={colSpan} rowSpan={rowSpan}>
        {children}
      </TableHead>
    );
  },
  td({ children, align, colSpan, rowSpan }) {
    return (
      <TableCell align={align} colSpan={colSpan} rowSpan={rowSpan}>
        {children}
      </TableCell>
    );
  },
};

export async function Markdown({ content }: { content: string }) {
  const renderedContent = await MarkdownAsync({
    children: content,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: "wrap",
          properties: { className: ["docs-heading-anchor"] },
        },
      ],
      [
        rehypePrettyCode,
        {
          theme: "github-dark",
          keepBackground: false,
        },
      ],
    ],
    components: markdownComponents,
  });

  return <div className="docs-prose prose prose-neutral max-w-none">{renderedContent}</div>;
}
