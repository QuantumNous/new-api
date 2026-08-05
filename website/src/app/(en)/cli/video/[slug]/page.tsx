import { notFound } from "next/navigation";
import { CliMediaPromptDetailPage, getCliMediaDetailMetadata } from "@/components/cli-media-library-page";
import { getCliMediaPromptItems } from "@/lib/prompt-library";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getCliMediaPromptItems("video").map((item) => ({ slug: item.slug }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const meta = getCliMediaDetailMetadata("video", params.slug, "en");
  if (!meta) return {};
  return buildMetadata({
    title: meta.title,
    description: meta.description,
    pathname: meta.pathname,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  const meta = getCliMediaDetailMetadata("video", params.slug, "en");
  if (!meta) notFound();
  return <CliMediaPromptDetailPage kind="video" locale="en" slug={params.slug} />;
}
