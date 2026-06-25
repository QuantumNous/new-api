import { EdmLandingPage } from "@/components/edm-landing-page";
import { getEdmCampaign, getEdmMetadataInput } from "@/lib/edm-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata(getEdmMetadataInput("cto-ai-savings", "en"));

export default function Page() {
  return <EdmLandingPage campaign={getEdmCampaign("cto-ai-savings", "en")} locale="en" pathname="/lp/cto-ai-savings" />;
}
