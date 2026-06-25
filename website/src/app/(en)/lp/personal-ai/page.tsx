import { EdmLandingPage } from "@/components/edm-landing-page";
import { getEdmCampaign, getEdmMetadataInput } from "@/lib/edm-landing";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata(getEdmMetadataInput("personal-ai", "en"));

export default function Page() {
  return <EdmLandingPage campaign={getEdmCampaign("personal-ai", "en")} locale="en" pathname="/lp/personal-ai" />;
}
