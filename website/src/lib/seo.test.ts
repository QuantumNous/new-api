import { describe, expect, test } from "bun:test";
import { buildMetadata } from "./seo";

describe("buildMetadata", () => {
  test("adds a default social image for Open Graph and Twitter metadata", () => {
    const metadata = buildMetadata({
      title: "flatkey.ai pricing",
      description: "One API key for every top AI model.",
      pathname: "/pricing",
    });

    expect(metadata.openGraph?.images).toEqual([
      { url: "https://flatkey.ai/flatkey-logo-light.png" },
    ]);
    expect(metadata.twitter?.images).toEqual([
      "https://flatkey.ai/flatkey-logo-light.png",
    ]);
  });

  test("keeps page-specific social images when provided", () => {
    const metadata = buildMetadata({
      title: "Blog post",
      description: "A specific article.",
      pathname: "/blog/post",
      image: "https://cdn.example.test/post.png",
    });

    expect(metadata.openGraph?.images).toEqual([
      { url: "https://cdn.example.test/post.png" },
    ]);
    expect(metadata.twitter?.images).toEqual([
      "https://cdn.example.test/post.png",
    ]);
  });
});
