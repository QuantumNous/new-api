import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EMPTY_DIRECTORY_FILTERS } from "@/lib/model-directory-filters";
import { ModelsFilterSidebar, type FilterGroup } from "./models-filter-sidebar";

const groups: FilterGroup[] = [
  {
    key: "modalities",
    label: "Capabilities",
    defaultOpen: true,
    options: [{ value: "chat", label: "Chat" }],
  },
  {
    key: "vendors",
    label: "Makers",
    defaultOpen: false,
    options: [{ value: "OpenAI", label: "OpenAI" }],
  },
];

function renderSidebar() {
  return renderToStaticMarkup(
    <ModelsFilterSidebar
      groups={groups}
      filters={EMPTY_DIRECTORY_FILTERS}
      rows={[]}
      title="Filters"
      resetLabel="Reset"
      canReset={false}
      onToggle={() => undefined}
      onReset={() => undefined}
    />
  );
}

function contentWrappers(html: string) {
  return Array.from(
    html.matchAll(/<div (?=[^>]*class="[^"]*grid transition-\[grid-template-rows,opacity\])(?=[^>]*grid-rows-\[[^\]]+\])[^>]*>/g)
  ).map(([wrapper]) => wrapper);
}

describe("ModelsFilterSidebar", () => {
  test("hides closed filter options from accessibility APIs while keeping open groups exposed", () => {
    const html = renderSidebar();

    expect(html).toContain("aria-expanded=\"true\"");
    expect(html).toContain("aria-expanded=\"false\"");

    const wrappers = contentWrappers(html);

    expect(wrappers).toHaveLength(2);
    expect(wrappers[0]).toContain("grid-rows-[1fr]");
    expect(wrappers[0]).not.toContain("aria-hidden");
    expect(wrappers[0]).not.toContain("inert");
    expect(wrappers[1]).toContain("grid-rows-[0fr]");
    expect(wrappers[1]).toContain("aria-hidden=\"true\"");
    expect(wrappers[1]).toContain("inert");
  });
});
