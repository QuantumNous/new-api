import { PricingPage, parsePricingSearch } from "@/components/pricing-page";
import { getPageContent } from "@/content/pages";
import { buildMetadata } from "@/lib/seo";

const content = getPageContent("pricing", "en");

export const metadata = buildMetadata({
  title: content.title,
  description: content.description,
  pathname: "/pricing",
});

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function Page(props: Props) {
  const searchParams = await props.searchParams;
  return <PricingPage locale="en" search={parsePricingSearch(searchParams)} />;
}
