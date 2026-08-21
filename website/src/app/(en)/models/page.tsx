import { ModelsPage, parsePricingSearch } from "@/components/pricing-page";
import { buildDirectorySeo } from "@/lib/model-directory-seo";
import { buildMetadata } from "@/lib/seo";

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

// Metadata depends on the active filters: the bare directory and single
// series/vendor views are indexable landing pages with their own titles, while
// arbitrary filter combinations are noindex and canonical to /models. See
// model-directory-seo.ts for the policy.
export async function generateMetadata(props: Props) {
  const searchParams = await props.searchParams;
  const seo = buildDirectorySeo("en", searchParams);
  return buildMetadata({
    title: seo.title,
    description: seo.description,
    pathname: seo.canonicalQuery ? `/models?${seo.canonicalQuery}` : "/models",
    noIndex: seo.noIndex,
  });
}

export default async function Page(props: Props) {
  const searchParams = await props.searchParams;
  return <ModelsPage locale="en" search={parsePricingSearch(searchParams)} searchParams={searchParams} />;
}
