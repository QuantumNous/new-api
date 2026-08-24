import { ApifyAlternativePage } from "@/components/apify-alternative-page";
import { getApifyAlternativeMetadataInput } from "@/lib/tools-conquest-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata(getApifyAlternativeMetadataInput());

export default function Page() {
  return <ApifyAlternativePage />;
}
