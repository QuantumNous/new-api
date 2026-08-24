import { MarketLandingPage } from "@/components/market-landing-page";
import { getMarketMetadataInput } from "@/lib/market-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata(getMarketMetadataInput("/in")!);

export default function Page() {
  return <MarketLandingPage slug="/in" />;
}
