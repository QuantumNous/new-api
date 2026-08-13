import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelsDirectoryTable } from "./models-directory-table";
import { getModelsDirectoryTableCopy } from "./pricing-explorer";

describe("ModelsDirectoryTable", () => {
  test("uses models-page table labels and marks missing health data unknown", () => {
    const html = renderToStaticMarkup(
      <ModelsDirectoryTable
        locale="en"
        copy={getModelsDirectoryTableCopy("en")}
        rows={[
          {
            name: "gpt-5-mini",
            vendor: "OpenAI",
            official: "$0.5",
            discounted: "$0.2",
            officialUsd: 0.5,
            discountedUsd: 0.2,
            iconKey: "openai",
          },
        ]}
      />
    );

    expect(html).toContain("Our price");
    expect(html).toContain("Health Score");
    expect(html).not.toContain("After bonus");
    expect(html).not.toContain("30-day health");
    expect(html).toContain("600ms");
    expect(html).toContain("Health Score: —");
    expect(html).not.toContain(">100%</span>");
    expect(html.match(/style="height:8px"/g) ?? []).toHaveLength(5);
  });
});
