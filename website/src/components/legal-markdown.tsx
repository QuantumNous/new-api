import { cn } from "@/lib/utils";

type HeadingBlock = {
  type: "heading";
  level: 2 | 3 | 4;
  text: string;
  id: string;
};

type ParagraphBlock = {
  type: "paragraph";
  text: string;
};

type ListBlock = {
  type: "list";
  ordered: boolean;
  items: string[];
};

type Block = HeadingBlock | ParagraphBlock | ListBlock;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripMarkdown(value: string): string {
  return value.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").trim();
}

function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: ListBlock | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      if (level === 1) continue;
      const text = stripMarkdown(heading[2]);
      blocks.push({
        type: "heading",
        level: Math.min(level, 4) as 2 | 3 | 4,
        text,
        id: slugify(text),
      });
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(line);
    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const nextOrdered = Boolean(ordered);
      const item = stripMarkdown((unordered ?? ordered)?.[1] ?? "");
      if (!list || list.ordered !== nextOrdered) {
        flushList();
        list = { type: "list", ordered: nextOrdered, items: [] };
      }
      list.items.push(item);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

export function getLegalHeadings(markdown: string) {
  return parseMarkdown(markdown).filter((block): block is HeadingBlock => block.type === "heading" && block.level === 2);
}

export function LegalMarkdown(props: { markdown: string; className?: string }) {
  const blocks = parseMarkdown(props.markdown);

  return (
    <div className={cn("legal-content min-w-0", props.className)}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = `h${block.level}` as "h2" | "h3" | "h4";
          return (
            <Heading key={`${block.id}-${index}`} id={block.id}>
              {block.text}
            </Heading>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item}`}>{item}</li>
              ))}
            </List>
          );
        }
        return <p key={index}>{stripMarkdown(block.text)}</p>;
      })}
    </div>
  );
}
