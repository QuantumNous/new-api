import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelsFeaturedCarousel } from "./models-featured-carousel";
import { getDirectoryCopy } from "@/lib/model-directory-copy";
import { FEATURED_SLIDES } from "@/lib/model-directory-featured";

describe("ModelsFeaturedCarousel", () => {
  test("keeps Seedance 2.5 and MiniMax H3 at the front of the carousel", () => {
    expect(FEATURED_SLIDES.slice(0, 2).map((slide) => slide.modelName)).toEqual(["seedance-2.5", "MiniMax-H3"]);
  });

  test("loads the GPT-5.6 Sol artwork from the CDN", () => {
    const slide = FEATURED_SLIDES.find((item) => item.modelName === "gpt-5.6-sol");

    expect(slide?.image).toBe("https://cdn.shulex-voc.com/flatkey/models-featured/openai.jpg");
    expect(slide?.video).toBe("https://cdn.shulex-voc.com/flatkey/models-featured/openai.mp4");
  });

  test("renders the complete featured-model description without a line clamp", () => {
    const slide = FEATURED_SLIDES[0];
    const html = renderToStaticMarkup(
      <ModelsFeaturedCarousel
        slides={[slide]}
        copy={getDirectoryCopy("en")}
        locale="en"
      />,
    );

    expect(html).toContain(slide.blurb.en);
    expect(html).toContain("whitespace-normal");
    expect(html).not.toContain("line-clamp-3");
  });
});
