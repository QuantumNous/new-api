import { BlogIndexPage, parseBlogSearch } from "@/components/blog-pages";
import { getCopy } from "@/lib/copy";
import { buildMetadata } from "@/lib/seo";

const copy = getCopy("en").blog;

export const metadata = buildMetadata({
  title: copy.title,
  description: copy.description,
  pathname: "/blog",
});

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function Page(props: Props) {
  const searchParams = await props.searchParams;
  return <BlogIndexPage locale="en" search={parseBlogSearch(searchParams)} />;
}
