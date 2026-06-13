import { BlogIndexPage } from "@/components/blog-pages";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Blog",
  description: "AI API gateway, model routing, billing, and operations articles from flatkey.ai.",
  pathname: "/blog",
});

export default function Page() {
  return <BlogIndexPage locale="en" />;
}
