import { BlogIndexPage, parseBlogSearch } from "@/components/blog-pages";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "flatkey.ai Blog",
  description: "Insights, product notes, and implementation guides for teams building on AI APIs.",
  pathname: "/blog",
});

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function Page(props: Props) {
  const searchParams = await props.searchParams;
  return <BlogIndexPage locale="en" search={parseBlogSearch(searchParams)} />;
}
