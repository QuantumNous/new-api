import { ModelsPage, parsePricingSearch } from "@/components/pricing-page";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "AI model directory and live pricing",
  description: "Search flatkey.ai supported AI models by provider, endpoint, pricing type, and live availability.",
  pathname: "/models",
});

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function Page(props: Props) {
  const searchParams = await props.searchParams;
  return <ModelsPage locale="en" search={parsePricingSearch(searchParams)} />;
}
